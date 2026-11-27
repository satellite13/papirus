import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramSurface } from './DiagramSurface';
import type { InputEvent } from '@/events/InputHandler';
import type { AnchorId, Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { EdgeEndpoint, Point } from '@/types';
import {
  ANCHOR_PORT_PREFIX,
  EDGE_AXIS_MAGNET_SCREEN_TOLERANCE,
  EDGE_ADD_CONTROL_RADIUS,
  EDGE_CONTROL_POINT_RADIUS,
  EDGE_HANDLE_RADIUS,
  EDGE_DROP_FILL_SCREEN_TOLERANCE,
  OUTLINE_SNAP_SCREEN_TOLERANCE,
  OUTLINE_CONNECT_HANDLE_HIT_RADIUS,
  ANCHOR_POINT_HITBOX_RADIUS,
  ANCHOR_POINT_HOVER_RADIUS,
  ANCHOR_POINT_RADIUS,
  BEZIER_MAX_OFFSET,
  DRAG_START_THRESHOLD,
  EDGE_SEGMENT_INSERT_CLICK_DELAY_MS,
} from '@/constants';
import { clonePoints, distance } from '@/utils/geometry';
import { directionFromAngle } from '@/utils/edgePath';
import { getDirectionFromOutlineParam } from '@/utils/direction';
import {
  collapseColinearPoints,
  listOrthogonalRuns,
  moveOrthogonalRun,
  orthogonalRunMidpoint,
  resolveOrthogonalRun,
  segmentAxis,
  type OrthogonalRun,
} from '@/utils/orthogonalSegmentDrag';
import type { EdgePathType } from '@/types';
import {
  OUTLINE_CONNECT_HANDLE_HYSTERESIS,
  getOutlineConnectHandle,
  type OutlineSide,
} from '@/utils/outlineConnectHandle';
import type { PathObstacle } from '@/elements/paths';

/**
 * Connection events
 */
export interface ConnectionEvents {
  connectionStart: [fromNode: Node];
  connectionMove: [fromPoint: Point, toPoint: Point];
  connectionEnd: [edge: Edge | null];
  connect: [edge: Edge];
  edgeReconnectStart: [edge: Edge, endpoint: 'start' | 'end', original: EdgeEndpoint];
  edgeReconnect: [edge: Edge, endpoint: 'start' | 'end'];
  controlPointDragStart: [edge: Edge, before: Point[], beforeType: EdgePathType];
  controlPointDragEnd: [];
  labelDragStart: [edge: Edge];
  labelDragEnd: [];
}

export type ConnectionValidator = (sourceNodeId: string, targetNodeId: string) => boolean;
export type ConnectionPreviewPathType = 'straight' | 'bezier';

export interface ConnectionManagerOptions {
  renderer: DiagramSurface;
  createEdge: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  addEdge?: (edge: Edge) => void;
  snapToGrid?: boolean;
  gridSize?: number;
  /** When true, edges can be attached anywhere on the shape outline (not just ports) */
  attachToOutline?: boolean;
  /** Connection preview path type while dragging a new edge */
  previewPathType?: ConnectionPreviewPathType;
  /**
   * When false, editable-polyline editing points (bend handles, segment drag,
   * insert handles) are hidden and bend gestures are ignored. Label drag and
   * endpoint reconnection stay active. Default: true.
   */
  edgeEditPointsEnabled?: boolean;
}

/**
 * Manages port-to-port connection creation
 */
export class ConnectionManager extends EventEmitter<ConnectionEvents> {
  private renderer: DiagramSurface;
  private readonly createEdge: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  private readonly addEdge: (edge: Edge) => void;
  private _connectionValidator: ConnectionValidator | null = null;

  private isConnecting = false;
  private sourceNode: Node | null = null;
  private sourcePoint: Point | null = null;
  private previewEndpoint: Point | null = null;
  private sourceAnchorId: string | null = null;
  private hoverNodeId: string | null = null;
  private hoverAnchorId: string | null = null;
  private hoverPoint: Point | null = null;
  private hoverOutlineHandle = false;
  private hoverOutlineSide: OutlineSide | null = null;
  private hoverDisabled = false;
  private reconnectPoint: Point | null = null;
  private previewTargetAnchorId: string | null = null;
  private sourceOutlineParam: number | null = null;
  private previewTargetOutlineParam: number | null = null;
  private previewTargetNodeId: string | null = null;
  private previewTargetEdgeId: string | null = null;
  private previewTargetPathParam: number | null = null;

  // Edge reconnection state
  private isReconnecting = false;
  private reconnectingEdge: Edge | null = null;
  private reconnectingEndpoint: 'start' | 'end' | null = null;
  private originalEdgeEndpoint: EdgeEndpoint | null = null;
  private reconnectingOutlineParam: number | null = null;
  private reconnectingTargetNodeId: string | null = null;
  private activeControlPointDrag: { edge: Edge; index: number } | null = null;
  private activeSegmentDrag: {
    edge: Edge;
    run: OrthogonalRun;
    /** Midpoint of the run when the gesture started / last applied — for re-resolve. */
    trackMidpoint: Point;
  } | null = null;
  private activeLabelDrag: {
    edge: Edge;
    pointerOffsetX: number;
    pointerOffsetY: number;
  } | null = null;
  /** Single-click insert bend, deferred so double-click can open the label editor instead. */
  private pendingSegmentInsert: {
    edge: Edge;
    segmentIndex: number;
    point: Point;
    startX: number;
    startY: number;
  } | null = null;
  private pendingSegmentInsertTimer: ReturnType<typeof setTimeout> | null = null;
  private snapToGrid: boolean;
  private gridSize: number;
  private attachToOutline: boolean;
  private previewPathType: ConnectionPreviewPathType;
  private edgeEditPointsEnabled: boolean;

  constructor(options: ConnectionManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.createEdge = options.createEdge;
    this.addEdge = options.addEdge ?? ((edge): void => this.renderer.addEdge(edge));
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
    this.attachToOutline = options.attachToOutline ?? false;
    this.previewPathType = options.previewPathType ?? 'bezier';
    this.edgeEditPointsEnabled = options.edgeEditPointsEnabled ?? true;
  }

  /**
   * Enable/disable attach-to-outline mode (edges attach anywhere on shape contour)
   */
  setAttachToOutline(enabled: boolean): void {
    this.attachToOutline = enabled;
    this.renderer.attachToOutline = enabled;
  }

  /**
   * Show/hide editable polyline control points (bend handles, segment drag, insert
   * handles). When disabled, no editing points are rendered on edges and new bend
   * gestures are ignored; label drag and endpoint reconnection remain active.
   */
  setEdgeEditPointsEnabled(enabled: boolean): void {
    if (this.edgeEditPointsEnabled === enabled) {
      return;
    }
    this.edgeEditPointsEnabled = enabled;
    if (!enabled) {
      // A deferred single-click insert must not add a bend after the toggle goes off.
      this.cancelPendingSegmentInsert();
    }
    this.renderer.markDirty();
  }

  /**
   * Enable/disable snap to grid for editable polyline control points.
   */
  setSnapToGrid(enabled: boolean, gridSize?: number): void {
    this.snapToGrid = enabled;
    if (gridSize !== undefined) {
      this.gridSize = gridSize;
    }
  }

  /**
   * Set a validator that determines whether a connection between two nodes is allowed.
   * When set, disallowed targets show forbidden styling and connections are blocked.
   */
  set connectionValidator(validator: ConnectionValidator | null) {
    this._connectionValidator = validator;
  }

  /**
   * Check if currently creating a connection
   */
  get connecting(): boolean {
    return this.isConnecting || this.isReconnecting;
  }

  /**
   * Перетаскивание опорной точки полилинии рёбра
   */
  get isEditingEdgeControlPoint(): boolean {
    return (
      this.activeControlPointDrag !== null ||
      this.activeSegmentDrag !== null ||
      this.activeLabelDrag !== null
    );
  }

  /**
   * Сброс hover портов/якорей (курсор над миникартой и т.п., без вызова updateHover).
   */
  clearPointerHover(): void {
    if (this.hoverDisabled) {
      return;
    }
    if (this.hoverNodeId !== null || this.hoverAnchorId !== null || this.hoverOutlineHandle) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
      this.hoverPoint = null;
      this.hoverOutlineSide = null;
      this.clearOutlineHandleCursor();
      this.renderer.markDirty();
    }
  }

  /**
   * Check if currently reconnecting an edge
   */
  get reconnecting(): boolean {
    return this.isReconnecting;
  }

  /**
   * Get the edge being reconnected (to hide it during preview)
   */
  get reconnectingEdgeId(): string | null {
    return this.reconnectingEdge?.id ?? null;
  }

  /**
   * Current preview endpoint
   */
  get previewEnd(): Point | null {
    return this.previewEndpoint;
  }

  /**
   * Disable hover and clear state (used when dragging starts)
   */
  disableHover(): void {
    this.hoverDisabled = true;
    if (this.hoverNodeId !== null || this.hoverAnchorId !== null || this.hoverOutlineHandle) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
      this.hoverPoint = null;
      this.hoverOutlineSide = null;
      this.clearOutlineHandleCursor();
      this.renderer.markDirty();
    }
  }

  /**
   * Re-enable hover (used when dragging ends)
   */
  enableHover(): void {
    this.hoverDisabled = false;
  }

  /**
   * Try to start connection from a hovered anchor point.
   * When attachToOutline: drag the outline handle, or Shift+drag from the node body.
   * Otherwise: requires clicking on an anchor/port so that node drag still works.
   */
  tryStartConnectionAtPoint(event: InputEvent): boolean {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return false;
    }
    const point = { x: event.worldX, y: event.worldY };

    if (this.attachToOutline) {
      const handleHit = this.findOutlineConnectHandleAt(point);
      if (handleHit) {
        this.startOutlineConnection(handleHit.node, handleHit.attach);
        return true;
      }
    }

    const node = this.getNodeAtPoint(point, false);
    if (!node) {
      return false;
    }

    if (this.attachToOutline && event.shiftKey) {
      const { point: outlinePoint } = node.getClosestPointOnOutline(point);
      this.startOutlineConnection(node, outlinePoint);
      return true;
    }

    if (this.attachToOutline) {
      return false;
    }

    // Try to find anchor at point (for precise click on port)
    const hover = this.getAnchorAtPoint(node, point);
    if (hover) {
      this.sourceNode = node;
      this.isConnecting = true;
      this.sourceAnchorId = hover.id;
      this.sourcePoint = hover.point;
      this.previewEndpoint = point;
      if (this.attachToOutline) {
        const { param } = node.getClosestPointOnOutline(point);
        this.sourceOutlineParam = param;
      } else {
        this.sourceOutlineParam = null;
      }
      this.emit('connectionStart', node);
      this.renderer.markDirty();
      return true;
    }

    return false;
  }

  /**
   * Try to start edge reconnection from handle
   */
  tryStartReconnection(event: InputEvent): boolean {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };
    const handleRadius = EDGE_HANDLE_RADIUS / Math.max(this.renderer.zoom, 0.0001);

    // Endpoint handles win over mid-handles / bends / segment body — otherwise a short
    // first-run mid-handle steals reconnect near the port.
    for (const edge of this.renderer.edges.values()) {
      if (edge.state !== 'selected') {
        continue;
      }

      if (edge.hitTestStartHandle(point, handleRadius)) {
        this.isReconnecting = true;
        this.reconnectingEdge = edge;
        this.reconnectingEdge.autoUpdateEndpoints = false;
        this.reconnectingEndpoint = 'start';
        this.originalEdgeEndpoint = { ...edge.from };
        this.emit('edgeReconnectStart', edge, 'start', this.originalEdgeEndpoint);
        // Update edge to follow cursor immediately
        this.updateReconnectingEdge(point);
        return true;
      }

      if (edge.hitTestEndHandle(point, handleRadius)) {
        this.isReconnecting = true;
        this.reconnectingEdge = edge;
        this.reconnectingEdge.autoUpdateEndpoints = false;
        this.reconnectingEndpoint = 'end';
        this.originalEdgeEndpoint = { ...edge.to };
        this.emit('edgeReconnectStart', edge, 'end', this.originalEdgeEndpoint);
        // Update edge to follow cursor immediately
        this.updateReconnectingEdge(point);
        return true;
      }
    }

    if (this.tryStartEditableControlInteraction(event)) {
      return true;
    }

    return false;
  }

  /**
   * Update the reconnecting edge to follow cursor
   */
  private updateReconnectingEdge(point: Point): void {
    if (!this.reconnectingEdge) return;

    const edge = this.reconnectingEdge;
    const fromNode = edge.from.nodeId ? this.renderer.getNode(edge.from.nodeId) : undefined;
    const toNode = edge.to.nodeId ? this.renderer.getNode(edge.to.nodeId) : undefined;

    let snappedPoint = point;
    let snappedDir: string | undefined;
    let targetNode = this.getNodeAtPoint(point, true);

    const edgeDrop = this.originalEdgeEndpoint?.edgeId
      ? this.findEdgeDropTarget(point, {
          maxScreenPx: EDGE_DROP_FILL_SCREEN_TOLERANCE,
          skipEdgeIds: new Set([edge.id]),
        })
      : null;
    if (edgeDrop) {
      const at = edgeDrop.edge.getPointAt(edgeDrop.pathParam);
      snappedPoint = edgeDrop.point;
      snappedDir = at ? directionFromAngle(at.angle) : undefined;
      targetNode = null;
      this.reconnectingOutlineParam = null;
      this.reconnectingTargetNodeId = null;
    } else if (this.attachToOutline) {
      const tolerance = OUTLINE_SNAP_SCREEN_TOLERANCE / Math.max(this.renderer.zoom, 0.0001);
      const toleranceSq = tolerance * tolerance;
      let bestDistSq = Infinity;
      let bestResult: { node: Node; point: Point; param: number } | null = null;

      for (const node of this.renderer.nodes.values()) {
        if (!node.visible) continue;
        const { point: outlinePoint, param } = node.getClosestPointOnOutline(point);
        const dx = point.x - outlinePoint.x;
        const dy = point.y - outlinePoint.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= toleranceSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestResult = { node, point: outlinePoint, param };
        }
      }

      if (bestResult) {
        targetNode = bestResult.node;
        snappedPoint = bestResult.point;
        this.reconnectingOutlineParam = bestResult.param;
        this.reconnectingTargetNodeId = bestResult.node.id;
        snappedDir = bestResult.node.getOutlineDirection(bestResult.param);

        const otherNode = this.reconnectingEndpoint === 'start' ? toNode : fromNode;
        // Sliding along the same contour must follow the cursor. Axis magnet
        // otherwise pulls the point back to the line through the other end,
        // which is the previous attachment for an already-aligned edge.
        const slidingOnSameNode = this.originalEdgeEndpoint?.nodeId === bestResult.node.id;
        if (otherNode && !slidingOnSameNode) {
          const alignRef = edge.isEditablePolyline()
            ? this.getNearestBendPointForAxisAlignment(edge, this.reconnectingEndpoint!)
            : this.reconnectingEndpoint === 'start'
              ? this.getTargetPointForReconnect(edge, toNode!, 'to', snappedPoint)
              : this.getTargetPointForReconnect(edge, fromNode!, 'from', snappedPoint);
          snappedPoint = this.applyAxisAlignmentToPoint(snappedPoint, alignRef);
          const reprojected = targetNode.getClosestPointOnOutline(snappedPoint);
          snappedPoint = reprojected.point;
          this.reconnectingOutlineParam = reprojected.param;
          snappedDir = targetNode.getOutlineDirection(reprojected.param);
        }
      } else {
        this.reconnectingOutlineParam = null;
        this.reconnectingTargetNodeId = null;
      }
    } else if (targetNode) {
      const nearestAnchor = targetNode.getNearestAnchor(point);
      if (nearestAnchor) {
        snappedPoint = nearestAnchor.point;
        snappedDir = nearestAnchor.id.split(':')[0];
      }
      this.reconnectingOutlineParam = null;
      this.reconnectingTargetNodeId = null;
    } else {
      this.reconnectingOutlineParam = null;
      this.reconnectingTargetNodeId = null;
    }

    this.reconnectPoint = snappedPoint;

    if (this.reconnectingEndpoint === 'start') {
      if (toNode) {
        const target = this.getTargetPointForReconnect(edge, toNode, 'to', snappedPoint);
        const toDir = this.getTargetDirForReconnect(edge, 'to');
        // Exclude the node under the dragged start; keep fixed `to` as target obstacle.
        const sourceId = targetNode?.id ?? edge.from.nodeId;
        edge.updateEndpoints(
          snappedPoint,
          target,
          snappedDir,
          toDir,
          this.buildReconnectRoutingOptions(sourceId, toNode.id)
        );
      }
    } else {
      if (fromNode) {
        const start = this.getTargetPointForReconnect(edge, fromNode, 'from', snappedPoint);
        const fromDir = this.getTargetDirForReconnect(edge, 'from');
        edge.updateEndpoints(
          start,
          snappedPoint,
          fromDir,
          snappedDir,
          this.buildReconnectRoutingOptions(fromNode.id, targetNode?.id)
        );
      }
    }

    this.renderer.markDirty();
  }

  /**
   * Match DiagramRenderer.getNodeObstacles padding and EdgeEndpointUpdater roles
   * so reconnect preview uses the same polyline routing as updateAll.
   */
  private buildReconnectRoutingOptions(
    sourceNodeId: string | undefined,
    targetNodeId: string | undefined
  ): { obstacles: PathObstacle[] } {
    const obstacles: PathObstacle[] = [];
    for (const node of this.renderer.nodes.values()) {
      let role: PathObstacle['role'] = 'other';
      if (node.id === sourceNodeId) role = 'source';
      else if (node.id === targetNodeId) role = 'target';
      const pad = 4;
      obstacles.push({
        id: node.id,
        x: node.x - pad,
        y: node.y - pad,
        width: node.width + pad * 2,
        height: node.height + pad * 2,
        role,
      });
    }
    return { obstacles };
  }

  private getTargetPointForReconnect(
    edge: Edge,
    node: Node,
    endpoint: 'from' | 'to',
    fallbackPoint: Point
  ): Point {
    const ep = endpoint === 'from' ? edge.from : edge.to;
    if (this.attachToOutline && ep.outlineParam !== undefined) {
      return node.getConnectionPointAtOutlineParam(ep.outlineParam);
    }
    const anchorId = ep.portId?.replace(ANCHOR_PORT_PREFIX, '');
    if (anchorId) {
      return node.getAnchorPointById(anchorId) ?? node.getConnectionPoint(fallbackPoint);
    }
    return node.getConnectionPoint(fallbackPoint);
  }

  private getTargetDirForReconnect(edge: Edge, endpoint: 'from' | 'to'): string | undefined {
    const ep = endpoint === 'from' ? edge.from : edge.to;
    if (this.attachToOutline && ep.outlineParam !== undefined) {
      const node = ep.nodeId ? this.renderer.getNode(ep.nodeId) : undefined;
      return node
        ? node.getOutlineDirection(ep.outlineParam)
        : getDirectionFromOutlineParam(ep.outlineParam);
    }
    const anchorId = ep.portId?.replace(ANCHOR_PORT_PREFIX, '');
    return anchorId?.split(':')[0];
  }

  /**
   * For editable polyline: return the nearest bend point for axis alignment.
   * When reconnecting 'end', use last control point (or start). When reconnecting 'start', use first control point (or end).
   */
  private getNearestBendPointForAxisAlignment(edge: Edge, endpoint: 'start' | 'end'): Point {
    const cps = edge.isEditablePolyline()
      ? (edge.controlPoints ?? edge.getEditableControlPoints())
      : [];
    if (endpoint === 'end') {
      return cps.length > 0 ? cps[cps.length - 1]! : edge.startPoint;
    }
    return cps.length > 0 ? cps[0]! : edge.endPoint;
  }

  /**
   * When attachToOutline: snap moving point to horizontal/vertical alignment with fixed point.
   */
  private applyAxisAlignmentToPoint(moving: Point, fixed: Point): Point {
    const tolerance = EDGE_AXIS_MAGNET_SCREEN_TOLERANCE / Math.max(this.renderer.zoom, 0.0001);
    let x = moving.x;
    let y = moving.y;
    if (Math.abs(moving.x - fixed.x) <= tolerance) {
      x = fixed.x;
    }
    if (Math.abs(moving.y - fixed.y) <= tolerance) {
      y = fixed.y;
    }
    return { x, y };
  }

  /**
   * Handle mouse move during connection
   */
  handleMouseMove(event: InputEvent): boolean {
    if (this.pendingSegmentInsert) {
      const dx = event.worldX - this.pendingSegmentInsert.startX;
      const dy = event.worldY - this.pendingSegmentInsert.startY;
      if (dx * dx + dy * dy > DRAG_START_THRESHOLD * DRAG_START_THRESHOLD) {
        const pending = this.pendingSegmentInsert;
        this.cancelPendingSegmentInsert();
        // Dragging a straight (orthogonal) face moves the whole run — draw.io
        // style: the line slides as one piece instead of kinking at the grab
        // point. Alt keeps the legacy insert-a-bend-and-drag gesture, and
        // diagonal segments always insert a bend (the only way to reshape them).
        const faceRun = event.altKey
          ? null
          : this.findOrthogonalRunForSegment(pending.edge, pending.segmentIndex);
        if (faceRun) {
          this.beginSegmentDrag(pending.edge, faceRun);
        } else {
          // Insert the bend now and keep dragging it. Cancelling here dropped
          // insert-then-drag (magnet / undo tests).
          this.beginInsertBend(pending.edge, pending.segmentIndex, pending.point);
        }
      }
    }

    if (this.activeLabelDrag) {
      this.applyLabelDrag(this.activeLabelDrag.edge, {
        x: event.worldX,
        y: event.worldY,
      });
      this.renderer.markDirty();
      return true;
    }

    if (this.activeSegmentDrag) {
      const { edge, run, trackMidpoint } = this.activeSegmentDrag;
      const vertices = edge.getPathVertices();
      const rawPoint = this.snapPoint({ x: event.worldX, y: event.worldY });
      const currentRun = resolveOrthogonalRun(vertices, run, trackMidpoint) ?? run;
      const next = moveOrthogonalRun(vertices, currentRun, rawPoint);
      if (next) {
        edge.controlPoints = next;
        const afterVertices = edge.getPathVertices();
        const updated =
          resolveOrthogonalRun(afterVertices, currentRun, {
            x: currentRun.axis === 'vertical' ? rawPoint.x : trackMidpoint.x,
            y: currentRun.axis === 'horizontal' ? rawPoint.y : trackMidpoint.y,
          }) ?? currentRun;
        this.activeSegmentDrag.run = updated;
        this.activeSegmentDrag.trackMidpoint = orthogonalRunMidpoint(afterVertices, updated);
      }
      this.renderer.markDirty();
      return true;
    }

    if (this.activeControlPointDrag) {
      const controlPoints = this.activeControlPointDrag.edge.controlPoints
        ? [...this.activeControlPointDrag.edge.controlPoints]
        : this.activeControlPointDrag.edge.getEditableControlPoints();
      if (this.activeControlPointDrag.index < controlPoints.length) {
        const rawPoint = this.snapPoint({ x: event.worldX, y: event.worldY });
        const magnetized = this.applyAxisMagnet(
          this.activeControlPointDrag.edge,
          controlPoints,
          this.activeControlPointDrag.index,
          rawPoint
        );
        controlPoints[this.activeControlPointDrag.index] = magnetized;
        this.activeControlPointDrag.edge.controlPoints = controlPoints;
      }
      return true;
    }

    // Handle edge reconnection
    if (this.isReconnecting && this.reconnectingEdge) {
      const point = { x: event.worldX, y: event.worldY };

      // Update edge to follow cursor
      this.updateReconnectingEdge(point);

      return true;
    }

    if (!this.isConnecting) {
      this.updateHover({ x: event.worldX, y: event.worldY });
      return false;
    }

    const cursorPoint = { x: event.worldX, y: event.worldY };

    let snappedPoint = cursorPoint;
    this.previewTargetAnchorId = null;
    this.previewTargetOutlineParam = null;
    this.previewTargetNodeId = null;
    this.previewTargetEdgeId = null;
    this.previewTargetPathParam = null;
    const rawNode = this.getRawNodeAtPoint(cursorPoint);
    const forbiddenFill =
      !!this._connectionValidator &&
      !!this.sourceNode &&
      !!rawNode &&
      !this._connectionValidator(this.sourceNode.id, rawNode.id);
    const searchGroupFill =
      !!rawNode &&
      (forbiddenFill || this.nodeContainsSource(rawNode) || this.nodeLooksLikeContainer(rawNode));
    let targetNode = this.getNodeAtPoint(cursorPoint, false);

    if (this.attachToOutline) {
      const tolerance = OUTLINE_SNAP_SCREEN_TOLERANCE / Math.max(this.renderer.zoom, 0.0001);
      const toleranceSq = tolerance * tolerance;
      let bestDistSq = Infinity;
      let bestResult: { node: Node; point: Point; param: number } | null = null;

      for (const node of this.renderer.nodes.values()) {
        if (!node.visible || !this.isCompatibleTarget(node)) continue;
        const forbidden =
          this._connectionValidator &&
          this.sourceNode &&
          !this._connectionValidator(this.sourceNode.id, node.id);
        if (forbidden) continue;

        const { point: outlinePoint, param } = node.getClosestPointOnOutline(cursorPoint);
        const dx = cursorPoint.x - outlinePoint.x;
        const dy = cursorPoint.y - outlinePoint.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= toleranceSq && distSq < bestDistSq) {
          bestDistSq = distSq;
          bestResult = { node, point: outlinePoint, param };
        }
      }

      if (bestResult) {
        targetNode = bestResult.node;
        snappedPoint = bestResult.point;
        this.previewTargetOutlineParam = bestResult.param;
        this.previewTargetNodeId = bestResult.node.id;

        if (this.sourcePoint) {
          snappedPoint = this.applyAxisAlignmentToPoint(snappedPoint, this.sourcePoint);
          const reprojected = bestResult.node.getClosestPointOnOutline(snappedPoint);
          snappedPoint = reprojected.point;
          this.previewTargetOutlineParam = reprojected.param;
        }
      }
    } else if (targetNode && this.isCompatibleTarget(targetNode)) {
      const forbidden =
        this._connectionValidator &&
        this.sourceNode &&
        !this._connectionValidator(this.sourceNode.id, targetNode.id);
      if (!forbidden) {
        const nearestAnchor = targetNode.getNearestAnchor(cursorPoint);
        if (nearestAnchor) {
          snappedPoint = nearestAnchor.point;
          this.previewTargetAnchorId = nearestAnchor.id;
        }
      }
    }

    // Prefer edge drop when closer than outline/node snap (outline tolerance is larger).
    // A container fill must not steal an outline snap that is strictly closer than the stroke —
    // otherwise node→node attach-to-outline is remapped onto a nearby crossing edge.
    const edgeDrop = this.findEdgeDropTarget(
      cursorPoint,
      searchGroupFill ? { maxScreenPx: EDGE_DROP_FILL_SCREEN_TOLERANCE } : undefined
    );
    if (edgeDrop) {
      let nodeDistance = Infinity;
      if (targetNode) {
        const dx = cursorPoint.x - snappedPoint.x;
        const dy = cursorPoint.y - snappedPoint.y;
        nodeDistance = Math.sqrt(dx * dx + dy * dy);
      }
      const preferOutlineOverFillEdge =
        this.attachToOutline &&
        this.previewTargetOutlineParam !== null &&
        nodeDistance < edgeDrop.distance;
      if (
        (searchGroupFill && !preferOutlineOverFillEdge) ||
        !targetNode ||
        edgeDrop.distance <= nodeDistance
      ) {
        targetNode = null;
        this.previewTargetNodeId = null;
        this.previewTargetOutlineParam = null;
        this.previewTargetAnchorId = null;
        snappedPoint = edgeDrop.point;
        this.previewTargetEdgeId = edgeDrop.edge.id;
        this.previewTargetPathParam = edgeDrop.pathParam;
      }
    } else if (searchGroupFill) {
      targetNode = null;
      this.previewTargetNodeId = null;
      this.previewTargetOutlineParam = null;
      this.previewTargetAnchorId = null;
      snappedPoint = cursorPoint;
    }

    if (targetNode) {
      const forbidden =
        this._connectionValidator &&
        this.sourceNode &&
        !this._connectionValidator(this.sourceNode.id, targetNode.id);
      this.setCursor(forbidden ? 'not-allowed' : 'crosshair');
    } else {
      this.setCursor('crosshair');
    }

    this.previewEndpoint = snappedPoint;
    if (this.sourceNode && !this.sourceAnchorId && !this.sourceOutlineParam) {
      this.sourcePoint = this.sourceNode.getConnectionPoint(this.previewEndpoint);
    } else if (this.sourceNode && this.sourceOutlineParam !== null) {
      this.sourcePoint = this.sourceNode.getConnectionPointAtOutlineParam(this.sourceOutlineParam);
    }

    this.emit('connectionMove', this.sourcePoint!, this.previewEndpoint);
    this.renderer.markDirty();

    return true;
  }

  /**
   * Remove editable polyline bend by double click.
   */
  handleDoubleClick(event: InputEvent): boolean {
    if (!this.edgeEditPointsEnabled) {
      return false;
    }
    const point = { x: event.worldX, y: event.worldY };
    const radius = EDGE_CONTROL_POINT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const radiusSq = radius * radius;
    const edges = [...this.renderer.edges.values()];

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i]!;
      if (edge.state !== 'selected' || !edge.hasEditableControlPoints()) {
        continue;
      }

      const cps = edge.controlPoints!;
      for (let i = 0; i < cps.length; i++) {
        const controlPoint = cps[i]!;
        const dx = point.x - controlPoint.x;
        const dy = point.y - controlPoint.y;
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }

        const next = clonePoints(cps);
        next.splice(i, 1);
        edge.controlPoints = next.length > 0 ? next : undefined;
        if (
          this.activeControlPointDrag &&
          this.activeControlPointDrag.edge.id === edge.id &&
          this.activeControlPointDrag.index === i
        ) {
          this.activeControlPointDrag = null;
          this.emit('controlPointDragEnd');
        }
        this.renderer.markDirty();
        return true;
      }
    }

    return false;
  }

  /**
   * Handle mouse up to complete or cancel connection
   */
  handleMouseUp(event: InputEvent): boolean {
    if (this.pendingSegmentInsert) {
      this.armPendingSegmentInsert();
      return true;
    }
    if (this.activeLabelDrag) {
      this.activeLabelDrag = null;
      this.emit('labelDragEnd');
      this.renderer.markDirty();
      return true;
    }
    if (this.activeSegmentDrag) {
      this.activeSegmentDrag = null;
      this.emit('controlPointDragEnd');
      this.renderer.markDirty();
      return true;
    }
    if (this.activeControlPointDrag) {
      this.activeControlPointDrag = null;
      this.emit('controlPointDragEnd');
      this.renderer.markDirty();
      return true;
    }

    // Handle edge reconnection completion
    if (this.isReconnecting && this.reconnectingEdge) {
      const point = { x: event.worldX, y: event.worldY };
      let reconnected = false;

      const edgeDrop = this.originalEdgeEndpoint?.edgeId
        ? this.findEdgeDropTarget(point, {
            maxScreenPx: EDGE_DROP_FILL_SCREEN_TOLERANCE,
            skipEdgeIds: new Set([this.reconnectingEdge.id]),
          })
        : null;
      if (edgeDrop) {
        const endpoint: EdgeEndpoint = {
          edgeId: edgeDrop.edgeId,
          pathParam: edgeDrop.pathParam,
        };
        if (this.reconnectingEndpoint === 'start') {
          this.reconnectingEdge.from = endpoint;
        } else {
          this.reconnectingEdge.to = endpoint;
        }
        reconnected = true;
        this.emit('edgeReconnect', this.reconnectingEdge, this.reconnectingEndpoint!);
      }

      let node = this.getNodeAtPoint(point, true);
      if (!node && this.attachToOutline && this.reconnectingTargetNodeId) {
        node = this.renderer.getNode(this.reconnectingTargetNodeId) ?? null;
      }
      if (!reconnected && node) {
        if (this.attachToOutline) {
          // A drop inside the shape is farther than the outline snap, so the
          // move handler clears the param and would otherwise lock the nearest
          // port. Project onto the contour before the history event.
          const outlineParam =
            this.reconnectingOutlineParam !== null
              ? this.reconnectingOutlineParam
              : node.getClosestPointOnOutline(point).param;
          const endpoint: EdgeEndpoint = {
            nodeId: node.id,
            outlineParam,
          };
          if (this.reconnectingEndpoint === 'start') {
            this.reconnectingEdge.from = endpoint;
          } else {
            this.reconnectingEdge.to = endpoint;
          }
        } else {
          const anchor = node.getNearestAnchor(point);
          const portId =
            this.reconnectingEdge.lockAnchors && anchor
              ? `${ANCHOR_PORT_PREFIX}${anchor.id}`
              : undefined;
          if (this.reconnectingEndpoint === 'start') {
            this.reconnectingEdge.from = { nodeId: node.id, portId };
          } else {
            this.reconnectingEdge.to = { nodeId: node.id, portId };
          }
        }
        reconnected = true;
        this.emit('edgeReconnect', this.reconnectingEdge, this.reconnectingEndpoint!);
      }

      if (!reconnected && this.originalEdgeEndpoint) {
        if (this.reconnectingEndpoint === 'start') {
          this.reconnectingEdge.from = this.originalEdgeEndpoint;
        } else {
          this.reconnectingEdge.to = this.originalEdgeEndpoint;
        }
        this.emit('edgeReconnect', this.reconnectingEdge, this.reconnectingEndpoint!);
      }

      this.resetReconnection();
      // Force obstacle-aware endpoint sync (binding change already marks content dirty;
      // keep markDirty for immediate repaint if binding did not change).
      this.renderer.markDirty();
      return true;
    }

    if (!this.isConnecting) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };
    let createdEdge: Edge | null = null;

    const edgeDrop =
      this.previewTargetEdgeId != null && this.previewTargetPathParam != null
        ? {
            edgeId: this.previewTargetEdgeId,
            pathParam: this.previewTargetPathParam,
            point,
          }
        : this.findEdgeDropTarget(point);

    let targetNode = this.getNodeAtPoint(point, false);
    if (!targetNode && this.attachToOutline && this.previewTargetNodeId) {
      targetNode = this.renderer.getNode(this.previewTargetNodeId) ?? null;
    }

    // Preview edge snap wins over a node under the cursor (note→relation).
    if (edgeDrop && this.sourceNode && (!targetNode || this.previewTargetEdgeId != null)) {
      const from: EdgeEndpoint = this.attachToOutline
        ? {
            nodeId: this.sourceNode.id,
            outlineParam: this.sourceOutlineParam ?? undefined,
          }
        : {
            nodeId: this.sourceNode.id,
            portId: this.sourceAnchorId ? `${ANCHOR_PORT_PREFIX}${this.sourceAnchorId}` : undefined,
          };
      const to: EdgeEndpoint = {
        edgeId: edgeDrop.edgeId,
        pathParam: edgeDrop.pathParam,
      };
      createdEdge = this.createEdge(from, to);
      this.addEdge(createdEdge);
      this.emit('connect', createdEdge);
    } else if (targetNode) {
      const allowed =
        !this._connectionValidator || this._connectionValidator(this.sourceNode!.id, targetNode.id);
      if (allowed) {
        let from: EdgeEndpoint;
        let to: EdgeEndpoint;
        if (this.attachToOutline) {
          const targetOutline = targetNode.getClosestPointOnOutline(point);
          from = {
            nodeId: this.sourceNode!.id,
            outlineParam: this.sourceOutlineParam ?? undefined,
          };
          to = {
            nodeId: targetNode.id,
            outlineParam: targetOutline.param,
          };
        } else {
          const nearestTargetAnchor = targetNode.getNearestAnchor(point);
          from = {
            nodeId: this.sourceNode!.id,
            portId: this.sourceAnchorId ? `${ANCHOR_PORT_PREFIX}${this.sourceAnchorId}` : undefined,
          };
          to = {
            nodeId: targetNode.id,
            portId: nearestTargetAnchor
              ? `${ANCHOR_PORT_PREFIX}${nearestTargetAnchor.id}`
              : undefined,
          };
        }
        createdEdge = this.createEdge(from, to);
        this.addEdge(createdEdge);
        this.emit('connect', createdEdge);
      }
    }

    this.emit('connectionEnd', createdEdge);
    this.reset();
    this.renderer.markDirty();

    return true;
  }

  /**
   * Cancel current connection
   */
  cancelConnection(): void {
    if (this.isReconnecting) {
      this.restoreReconnectingEndpoint();
      this.resetReconnection();
      this.renderer.markDirty();
      return;
    }

    if (!this.isConnecting) {
      return;
    }

    this.emit('connectionEnd', null);
    this.reset();
    this.renderer.markDirty();
  }

  /**
   * Cancel any in-flight connect or reconnect gesture and restore edge auto-updates.
   */
  cancelAll(): void {
    this.cancelConnection();
  }

  /**
   * Render connection preview
   */
  renderPreview(ctx: CanvasRenderingContext2D): void {
    // For reconnection, the actual edge follows the cursor, no separate preview needed
    if (this.isReconnecting && this.reconnectPoint) {
      if (!this.attachToOutline) {
        this.renderAnchorHighlights(ctx, this.reconnectPoint, true);
      }
      return;
    }

    if (!this.isConnecting || this.previewEndpoint === null) {
      return;
    }

    const start = this.sourcePoint!;
    const end = this.previewEndpoint;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    if (this.previewPathType === 'straight') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else {
      const previewTarget =
        this.previewTargetNodeId != null
          ? this.renderer.getNode(this.previewTargetNodeId)
          : undefined;
      const fromDir =
        this.sourceOutlineParam !== null
          ? this.sourceNode
            ? this.sourceNode.getOutlineDirection(this.sourceOutlineParam)
            : getDirectionFromOutlineParam(this.sourceOutlineParam)
          : this.sourceAnchorId?.split(':')[0];
      const toDir =
        this.previewTargetOutlineParam !== null
          ? previewTarget
            ? previewTarget.getOutlineDirection(this.previewTargetOutlineParam)
            : getDirectionFromOutlineParam(this.previewTargetOutlineParam)
          : this.previewTargetAnchorId?.split(':')[0];
      this.drawBezierPreview(ctx, start, end, fromDir, toDir);
    }

    ctx.setLineDash([]);

    if (!this.attachToOutline) {
      this.renderAnchorHighlights(ctx, end, false);
    }
  }

  private isCompatibleTarget(_node: Node): boolean {
    // Self-loop edges are allowed.
    return true;
  }

  /**
   * Get control point offset based on direction
   */
  private getDirectionOffset(dir: string | undefined, dist: number): Point {
    const offset = Math.min(dist * 0.5, BEZIER_MAX_OFFSET);
    switch (dir) {
      case 'top':
        return { x: 0, y: -offset };
      case 'bottom':
        return { x: 0, y: offset };
      case 'left':
        return { x: -offset, y: 0 };
      case 'right':
        return { x: offset, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * Draw a Bezier curve preview between two points
   */
  private drawBezierPreview(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    fromDir?: string,
    toDir?: string
  ): void {
    const dist = distance(start, end);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    // If directions are specified, use them for control points
    if (fromDir || toDir) {
      const fromOffset = this.getDirectionOffset(fromDir, dist);
      const toOffset = this.getDirectionOffset(toDir, dist);

      ctx.bezierCurveTo(
        start.x + fromOffset.x,
        start.y + fromOffset.y,
        end.x + toOffset.x,
        end.y + toOffset.y,
        end.x,
        end.y
      );
    } else {
      // Default behavior: auto-detect direction
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const offset = Math.min(Math.abs(dx), Math.abs(dy), BEZIER_MAX_OFFSET) * 0.5 + 50;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal dominant
        const offsetX = offset * Math.sign(dx || 1);
        ctx.bezierCurveTo(start.x + offsetX, start.y, end.x - offsetX, end.y, end.x, end.y);
      } else {
        // Vertical dominant
        ctx.bezierCurveTo(
          start.x,
          start.y + offset * Math.sign(dy || 1),
          end.x,
          end.y - offset * Math.sign(dy || 1),
          end.x,
          end.y
        );
      }
    }

    ctx.stroke();
  }

  private setCursor(cursor: string): void {
    const canvas = this.renderer.getCanvas();
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  }

  private reset(): void {
    this.isConnecting = false;
    this.sourceNode = null;
    this.sourcePoint = null;
    this.previewEndpoint = null;
    this.sourceAnchorId = null;
    this.sourceOutlineParam = null;
    this.previewTargetOutlineParam = null;
    this.previewTargetNodeId = null;
    this.previewTargetEdgeId = null;
    this.previewTargetPathParam = null;
    this.setCursor('');
  }

  /**
   * Find the nearest edge under the cursor for junction / note→relation drops.
   */
  private findEdgeDropTarget(
    point: Point,
    options?: { maxScreenPx?: number; skipEdgeIds?: ReadonlySet<string> }
  ): { edge: Edge; edgeId: string; pathParam: number; point: Point; distance: number } | null {
    const tolerance =
      options?.maxScreenPx === undefined
        ? Math.max(14, 20 / Math.max(this.renderer.zoom, 0.0001))
        : options.maxScreenPx / Math.max(this.renderer.zoom, 0.0001);
    let best: { edge: Edge; pathParam: number; point: Point; distance: number } | null = null;
    for (const edge of this.renderer.edges.values()) {
      if (!edge.visible || edge.path.length < 2) continue;
      if (options?.skipEdgeIds?.has(edge.id)) continue;
      const closest = edge.getClosestPointOnPath(point);
      if (!closest || closest.distance > tolerance) continue;
      if (!best || closest.distance < best.distance) {
        best = {
          edge,
          pathParam: closest.pathParam,
          point: closest.point,
          distance: closest.distance,
        };
      }
    }
    if (!best) return null;
    return {
      edge: best.edge,
      edgeId: best.edge.id,
      pathParam: best.pathParam,
      point: best.point,
      distance: best.distance,
    };
  }

  private resetReconnection(): void {
    this.isReconnecting = false;
    if (this.reconnectingEdge) {
      this.reconnectingEdge.autoUpdateEndpoints = true;
    }
    this.reconnectingEdge = null;
    this.reconnectingEndpoint = null;
    this.originalEdgeEndpoint = null;
    this.reconnectingOutlineParam = null;
    this.reconnectingTargetNodeId = null;
    this.reconnectPoint = null;
    this.setCursor('');
  }

  private restoreReconnectingEndpoint(): void {
    if (!this.reconnectingEdge || !this.originalEdgeEndpoint || !this.reconnectingEndpoint) {
      return;
    }
    if (this.reconnectingEndpoint === 'start') {
      this.reconnectingEdge.from = this.originalEdgeEndpoint;
    } else {
      this.reconnectingEdge.to = this.originalEdgeEndpoint;
    }
  }

  /**
   * Render anchors when hovering a node (not connecting)
   */
  renderHoverAnchors(ctx: CanvasRenderingContext2D): void {
    if (this.isConnecting || this.isReconnecting) {
      return;
    }

    this.renderEditablePolylineControls(ctx);

    if (this.attachToOutline) {
      this.renderOutlineConnectHandle(ctx);
      return;
    }

    if (!this.hoverNodeId) {
      return;
    }

    const node = this.renderer.getNode(this.hoverNodeId);
    if (!node) {
      return;
    }

    const anchors = node.getAnchors();
    if (anchors.length === 0) {
      return;
    }

    ctx.save();
    ctx.setLineDash([]);

    for (const anchor of anchors) {
      const isHovered = anchor.id === this.hoverAnchorId;
      const radius = isHovered ? ANCHOR_POINT_HOVER_RADIUS : ANCHOR_POINT_RADIUS;

      // Draw anchor circle
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(anchor.point.x, anchor.point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw white plus on hover
      if (isHovered) {
        this.drawPlus(radius, ctx, anchor.point);
      }
    }

    ctx.restore();
  }

  private tryStartEditableControlInteraction(event: InputEvent): boolean {
    // A new press cancels a pending single-click insert (e.g. 2nd click of a double-click).
    this.clearPendingSegmentInsertTimer();

    const point = { x: event.worldX, y: event.worldY };
    const pointRadius = EDGE_CONTROL_POINT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const segmentRadius = EDGE_ADD_CONTROL_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const pointRadiusSq = pointRadius * pointRadius;
    const segmentRadiusSq = segmentRadius * segmentRadius;
    const edges = [...this.renderer.edges.values()];

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i]!;
      if (edge.state !== 'selected') {
        continue;
      }
      if (edge.type !== 'editable-polyline' && edge.type !== 'polyline') {
        continue;
      }

      // 1) Bend vertices (editable-polyline only)
      if (this.edgeEditPointsEnabled && edge.isEditablePolyline()) {
        const controlPoints = edge.getEditableControlPoints();
        const beforePoints = edge.controlPoints?.length
          ? clonePoints(edge.controlPoints)
          : clonePoints(controlPoints);
        const beforeType = edge.type;

        for (let ci = 0; ci < controlPoints.length; ci++) {
          const dx = point.x - controlPoints[ci]!.x;
          const dy = point.y - controlPoints[ci]!.y;
          if (dx * dx + dy * dy > pointRadiusSq) {
            continue;
          }

          if (!edge.controlPoints || edge.controlPoints.length === 0) {
            edge.controlPoints = controlPoints;
          }

          // A bend that sits inside a straight run moves the whole face
          // (draw.io-style) — the dot slides the entire colinear section, not
          // just its own vertex. Corners keep free vertex movement; Alt+drag
          // bends just this vertex (legacy kink gesture).
          const faceRun = event.altKey ? null : this.findColinearFaceRun(edge, ci);
          if (faceRun) {
            return this.beginSegmentDrag(edge, faceRun);
          }

          this.activeControlPointDrag = { edge, index: ci };
          this.emit('controlPointDragStart', edge, beforePoints, beforeType);
          this.renderer.markDirty();
          return true;
        }
      }

      const vertices = this.getRoutableVertices(edge);
      if (vertices.length < 2) {
        continue;
      }

      // 2) Mid-segment handle → orthogonal run drag (colinear segments share one handle)
      if (this.edgeEditPointsEnabled) {
        for (const run of listOrthogonalRuns(vertices)) {
          const mid = orthogonalRunMidpoint(vertices, run);
          const dx = point.x - mid.x;
          const dy = point.y - mid.y;
          if (dx * dx + dy * dy > segmentRadiusSq) {
            continue;
          }
          return this.beginSegmentDrag(edge, run);
        }
      }

      // 3) Label drag (selected edge with a label)
      if (this.hitSelectedEdgeLabel(edge, point)) {
        this.activeLabelDrag = {
          edge,
          pointerOffsetX: 0,
          pointerOffsetY: 0,
        };
        this.emit('labelDragStart', edge);
        this.renderer.markDirty();
        return true;
      }

      // 4) Click on segment body → pending insert (committed after delay unless dblclick)
      if (this.edgeEditPointsEnabled) {
        const hit = this.hitSegmentBody(edge, point);
        if (hit) {
          this.pendingSegmentInsert = {
            edge,
            segmentIndex: hit.segmentIndex,
            point: this.snapPoint(hit.point),
            startX: event.worldX,
            startY: event.worldY,
          };
          return true;
        }
      }
    }

    return false;
  }

  private clearPendingSegmentInsertTimer(): void {
    if (this.pendingSegmentInsertTimer !== null) {
      clearTimeout(this.pendingSegmentInsertTimer);
      this.pendingSegmentInsertTimer = null;
    }
  }

  /** Cancel deferred bend insert (e.g. when double-click opens the label editor). */
  cancelPendingSegmentInsert(): void {
    this.clearPendingSegmentInsertTimer();
    this.pendingSegmentInsert = null;
  }

  private armPendingSegmentInsert(): void {
    if (!this.pendingSegmentInsert) {
      return;
    }
    this.clearPendingSegmentInsertTimer();
    const snapshot = this.pendingSegmentInsert;
    this.pendingSegmentInsert = null;
    this.pendingSegmentInsertTimer = setTimeout(() => {
      this.pendingSegmentInsertTimer = null;
      this.commitSegmentInsert(snapshot.edge, snapshot.segmentIndex, snapshot.point);
    }, EDGE_SEGMENT_INSERT_CLICK_DELAY_MS);
  }

  private commitSegmentInsert(edge: Edge, segmentIndex: number, at: Point): void {
    if (!this.renderer.edges.has(edge.id) || edge.state !== 'selected') {
      return;
    }
    this.beginInsertBend(edge, segmentIndex, at);
    // Click-insert is not a drag — close the gesture for history/collab.
    if (this.activeControlPointDrag) {
      this.activeControlPointDrag = null;
      this.emit('controlPointDragEnd');
      this.renderer.markDirty();
    }
  }

  private hitSelectedEdgeLabel(edge: Edge, point: Point): boolean {
    if (!edge.label) {
      return false;
    }
    const labelPosition = edge.getLabelPosition();
    if (!labelPosition) {
      return false;
    }
    const zoom = Math.max(this.renderer.zoom, 0.0001);
    const maxDistance = 28 / zoom;
    const dx = point.x - labelPosition.x;
    const dy = point.y - labelPosition.y;
    return dx * dx + dy * dy <= maxDistance * maxDistance;
  }

  private getRoutableVertices(edge: Edge): Point[] {
    if (edge.isEditablePolyline()) {
      return edge.getPathVertices();
    }
    if (edge.type === 'polyline') {
      return edge.path.map((p) => ({ x: p.x, y: p.y }));
    }
    return [];
  }

  private beginSegmentDrag(edge: Edge, run: OrthogonalRun): boolean {
    const beforeType = edge.type;
    const beforePoints = edge.isEditablePolyline()
      ? edge.controlPoints?.length
        ? clonePoints(edge.controlPoints)
        : clonePoints(edge.getEditableControlPoints())
      : [];

    if (edge.type === 'polyline') {
      edge.type = 'editable-polyline';
    }
    if (!edge.isEditablePolyline()) {
      return false;
    }
    if (!edge.controlPoints?.length) {
      const cps = edge.getEditableControlPoints();
      if (cps.length) {
        edge.controlPoints = cps;
      }
    }

    // Seed mid from the run the user hit (before collapse shifts indices).
    const preCollapseVertices = edge.getPathVertices();
    const seedMid = orthogonalRunMidpoint(preCollapseVertices, {
      axis: run.axis,
      startIndex: Math.min(run.startIndex, Math.max(0, preCollapseVertices.length - 2)),
      endIndex: Math.min(
        Math.max(run.endIndex, run.startIndex + 1),
        Math.max(1, preCollapseVertices.length - 1)
      ),
    });

    // Drop router exit-stub waypoints so they never show as bend handles.
    if (edge.controlPoints?.length) {
      const collapsed = collapseColinearPoints(preCollapseVertices);
      const nextCps = collapsed.slice(1, -1);
      if (nextCps.length !== edge.controlPoints.length) {
        edge.controlPoints = nextCps;
      }
    }

    const vertices = edge.getPathVertices();
    const resolved = resolveOrthogonalRun(vertices, run, seedMid) ?? {
      axis: run.axis,
      startIndex: Math.min(run.startIndex, Math.max(0, vertices.length - 2)),
      endIndex: Math.min(
        Math.max(run.endIndex, run.startIndex + 1),
        Math.max(1, vertices.length - 1)
      ),
    };

    this.activeSegmentDrag = {
      edge,
      run: resolved,
      trackMidpoint: orthogonalRunMidpoint(vertices, resolved),
    };
    this.emit('controlPointDragStart', edge, beforePoints, beforeType);
    this.renderer.markDirty();
    return true;
  }

  private beginInsertBend(edge: Edge, segmentIndex: number, at: Point): boolean {
    const beforeType = edge.type;
    if (edge.type === 'polyline') {
      edge.type = 'editable-polyline';
    }
    if (!edge.isEditablePolyline()) {
      return false;
    }

    const controlPoints = edge.controlPoints?.length
      ? clonePoints(edge.controlPoints)
      : clonePoints(edge.getEditableControlPoints());
    const beforePoints = clonePoints(controlPoints);

    // Promote/collapse can shift vertex indices vs the click-time segmentIndex.
    // Re-resolve against the current path and project onto that segment.
    edge.controlPoints = controlPoints;
    const vertices = edge.getPathVertices();
    const resolved = this.resolveInsertSegment(vertices, at, segmentIndex);
    const insertIndex = resolved?.segmentIndex ?? segmentIndex;
    const insertAt = this.snapPoint(resolved?.point ?? at);
    const clampedIndex = Math.max(0, Math.min(insertIndex, controlPoints.length));
    controlPoints.splice(clampedIndex, 0, insertAt);
    edge.controlPoints = controlPoints;
    this.activeControlPointDrag = { edge, index: clampedIndex };
    this.emit('controlPointDragStart', edge, beforePoints, beforeType);
    this.renderer.markDirty();
    return true;
  }

  /**
   * Map a click to a segment index on the current vertices (cps insert index =
   * vertex segment index). Prefers the closest segment to `at`; `hintIndex` is
   * only a tie-break when distances are equal.
   */
  private resolveInsertSegment(
    vertices: readonly Point[],
    at: Point,
    hintIndex: number
  ): { segmentIndex: number; point: Point } | null {
    if (vertices.length < 2) {
      return null;
    }
    let best: { segmentIndex: number; point: Point; dist: number } | null = null;
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i]!;
      const b = vertices[i + 1]!;
      const point = this.closestPointOnSegment(at, a, b);
      const dist = distance(at, point);
      if (
        !best ||
        dist < best.dist - 1e-6 ||
        (Math.abs(dist - best.dist) <= 1e-6 && i === hintIndex)
      ) {
        best = { segmentIndex: i, point, dist };
      }
    }
    return best ? { segmentIndex: best.segmentIndex, point: best.point } : null;
  }

  /**
   * Hit any path segment (orthogonal or diagonal) for bend insertion.
   * Skips mid-handle hotspots of orthogonal runs (those are for segment drag).
   */
  private hitSegmentBody(edge: Edge, point: Point): { segmentIndex: number; point: Point } | null {
    const vertices = this.getRoutableVertices(edge);
    const tolerance = Math.max((edge.style.strokeWidth ?? 2) * 2, 8);
    const segmentRadius = EDGE_ADD_CONTROL_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const segmentRadiusSq = segmentRadius * segmentRadius;

    for (const run of listOrthogonalRuns(vertices)) {
      const mid = orthogonalRunMidpoint(vertices, run);
      const mdx = point.x - mid.x;
      const mdy = point.y - mid.y;
      if (mdx * mdx + mdy * mdy <= segmentRadiusSq) {
        return null;
      }
    }

    let best: { segmentIndex: number; point: Point; dist: number } | null = null;
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i]!;
      const b = vertices[i + 1]!;
      const closest = this.closestPointOnSegment(point, a, b);
      const dist = distance(point, closest);
      if (dist > tolerance) {
        continue;
      }
      if (!best || dist < best.dist) {
        best = { segmentIndex: i, point: closest, dist };
      }
    }
    return best ? { segmentIndex: best.segmentIndex, point: best.point } : null;
  }

  private closestPointOnSegment(point: Point, a: Point, b: Point): Point {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return { x: a.x, y: a.y };
    }
    let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  /** Orthogonal run that contains the given path segment, if any. */
  private findOrthogonalRunForSegment(edge: Edge, segmentIndex: number): OrthogonalRun | null {
    const vertices = this.getRoutableVertices(edge);
    for (const run of listOrthogonalRuns(vertices)) {
      if (segmentIndex >= run.startIndex && segmentIndex < run.endIndex) {
        return run;
      }
    }
    return null;
  }

  /**
   * Orthogonal run through the given editable bend when the bend sits inside a
   * straight section (both neighbours on the same axis) — dragging it slides
   * the whole face. Returns null for corners and diagonal-adjacent bends.
   */
  private findColinearFaceRun(edge: Edge, bendIndex: number): OrthogonalRun | null {
    const vertices = edge.getPathVertices();
    const vertexIndex = bendIndex + 1;
    if (vertexIndex < 1 || vertexIndex >= vertices.length - 1) {
      return null;
    }
    const axisIn = segmentAxis(vertices[vertexIndex - 1]!, vertices[vertexIndex]!);
    const axisOut = segmentAxis(vertices[vertexIndex]!, vertices[vertexIndex + 1]!);
    if (!axisIn || axisIn !== axisOut) {
      return null;
    }
    for (const run of listOrthogonalRuns(vertices)) {
      if (run.axis === axisIn && run.startIndex < vertexIndex && vertexIndex < run.endIndex) {
        return run;
      }
    }
    return null;
  }

  private applyLabelDrag(edge: Edge, pointer: Point): void {
    const closest = edge.getClosestPointOnPath(pointer);
    if (!closest) {
      return;
    }
    edge.labelPosition = closest.pathParam;
    const onPath = closest.point;
    if (edge.labelFollowPath) {
      const at = edge.getPointAt(closest.pathParam);
      const tangent = at?.angle ?? 0;
      const nx = Math.cos(tangent + Math.PI / 2);
      const ny = Math.sin(tangent + Math.PI / 2);
      edge.labelOffset = (pointer.x - onPath.x) * nx + (pointer.y - onPath.y) * ny;
    } else {
      // Default semantics: offset is world-vertical (see EdgeLabelRenderer).
      edge.labelOffset = pointer.y - onPath.y;
    }
  }

  private renderEditablePolylineControls(ctx: CanvasRenderingContext2D): void {
    if (!this.edgeEditPointsEnabled) {
      return;
    }
    const pointRadius = EDGE_CONTROL_POINT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const segmentRadius = EDGE_ADD_CONTROL_RADIUS / Math.max(this.renderer.zoom, 0.0001);

    ctx.save();
    ctx.setLineDash([]);

    for (const edge of this.renderer.edges.values()) {
      if (edge.state !== 'selected') {
        continue;
      }
      if (edge.type !== 'editable-polyline' && edge.type !== 'polyline') {
        continue;
      }

      const vertices = this.getRoutableVertices(edge);
      for (const run of listOrthogonalRuns(vertices)) {
        this.drawSegmentHandle(ctx, orthogonalRunMidpoint(vertices, run), segmentRadius, run.axis);
      }
      for (let i = 0; i < vertices.length - 1; i++) {
        const start = vertices[i]!;
        const end = vertices[i + 1]!;
        if (segmentAxis(start, end)) {
          continue;
        }
        if (distance(start, end) <= segmentRadius * 4) {
          continue;
        }
        this.drawInsertHandle(
          ctx,
          { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
          segmentRadius
        );
      }

      if (edge.isEditablePolyline()) {
        for (const point of edge.getEditableControlPoints()) {
          this.drawControlPoint(ctx, point, pointRadius);
        }
      }
    }

    ctx.restore();
  }

  private drawSegmentHandle(
    ctx: CanvasRenderingContext2D,
    point: Point,
    radius: number,
    axis: 'horizontal' | 'vertical'
  ): void {
    const zoom = Math.max(this.renderer.zoom, 0.0001);
    const along = radius * 2;
    const across = radius * 1.2;
    const corner = Math.min(across * 0.45, 2.5 / zoom);
    ctx.save();
    ctx.translate(point.x, point.y);
    // Elongate along the run: vertical edges get a 90° turn of the same capsule.
    if (axis === 'vertical') {
      ctx.rotate(Math.PI / 2);
    }
    this.pathRoundedRect(ctx, -along / 2, -across / 2, along, across, corner);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / zoom;
    ctx.stroke();
    ctx.restore();
  }

  private pathRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawInsertHandle(ctx: CanvasRenderingContext2D, point: Point, radius: number): void {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / Math.max(this.renderer.zoom, 0.0001);
    ctx.stroke();
    const plusSize = radius * 0.7;
    ctx.beginPath();
    ctx.moveTo(point.x - plusSize, point.y);
    ctx.lineTo(point.x + plusSize, point.y);
    ctx.moveTo(point.x, point.y - plusSize);
    ctx.lineTo(point.x, point.y + plusSize);
    ctx.stroke();
  }

  private drawControlPoint(ctx: CanvasRenderingContext2D, point: Point, radius: number): void {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / Math.max(this.renderer.zoom, 0.0001);
    ctx.stroke();
  }

  private snapPoint(point: Point): Point {
    if (!this.snapToGrid) {
      return point;
    }
    return {
      x: Math.round(point.x / this.gridSize) * this.gridSize,
      y: Math.round(point.y / this.gridSize) * this.gridSize,
    };
  }

  private applyAxisMagnet(edge: Edge, controlPoints: Point[], index: number, point: Point): Point {
    const vertices = [edge.startPoint, ...controlPoints, edge.endPoint];
    const prev = vertices[index];
    const next = vertices[index + 2];
    if (!prev || !next) {
      return point;
    }

    const tolerance = EDGE_AXIS_MAGNET_SCREEN_TOLERANCE / Math.max(this.renderer.zoom, 0.0001);
    let x = point.x;
    let y = point.y;

    // Snapping onto the segment between the neighbors collapses a new bend
    // back into a straight line, so the corner appears and then vanishes.
    const segmentHorizontal = Math.abs(prev.y - next.y) <= 0.001;
    const segmentVertical = Math.abs(prev.x - next.x) <= 0.001;

    if (!segmentVertical) {
      const xCandidates = [prev.x, next.x];
      let closestXDist = Infinity;
      for (const candidate of xCandidates) {
        const dist = Math.abs(point.x - candidate);
        if (dist <= tolerance && dist < closestXDist) {
          closestXDist = dist;
          x = candidate;
        }
      }
    }

    if (!segmentHorizontal) {
      const yCandidates = [prev.y, next.y];
      let closestYDist = Infinity;
      for (const candidate of yCandidates) {
        const dist = Math.abs(point.y - candidate);
        if (dist <= tolerance && dist < closestYDist) {
          closestYDist = dist;
          y = candidate;
        }
      }
    }

    return { x, y };
  }

  private drawPlus(
    radius: number,
    ctx: CanvasRenderingContext2D,
    point: Point,
    lineWidth = 1.5
  ): void {
    const plusSize = radius * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(point.x - plusSize, point.y);
    ctx.lineTo(point.x + plusSize, point.y);
    ctx.moveTo(point.x, point.y - plusSize);
    ctx.lineTo(point.x, point.y + plusSize);
    ctx.stroke();
  }

  private renderAnchorHighlights(
    ctx: CanvasRenderingContext2D,
    point: Point,
    reconnecting: boolean
  ): void {
    const node = this.getNodeAtPoint(point, reconnecting);
    if (!node) {
      return;
    }

    // Check if connection to this target is allowed
    const forbidden =
      this._connectionValidator &&
      this.sourceNode &&
      !this._connectionValidator(this.sourceNode.id, node.id);

    const anchors = node.getAnchors();
    const nearest = node.getNearestAnchor(point);
    if (anchors.length === 0) {
      return;
    }

    ctx.save();
    ctx.setLineDash([]);

    const fillColor = forbidden ? '#ef4444' : '#3b82f6';

    for (const anchor of anchors) {
      const isNearest = nearest && anchor.id === nearest.id;
      const radius = isNearest ? ANCHOR_POINT_HOVER_RADIUS : ANCHOR_POINT_RADIUS;

      // Draw anchor circle
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(anchor.point.x, anchor.point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw white plus/cross on nearest
      if (isNearest) {
        if (forbidden) {
          this.drawCross(radius, ctx, anchor);
        } else {
          this.drawPlus(radius, ctx, anchor.point);
        }
      }
    }

    ctx.restore();
  }

  private drawCross(
    radius: number,
    ctx: CanvasRenderingContext2D,
    anchor: { id: AnchorId; point: Point }
  ): void {
    const size = radius * 0.4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(anchor.point.x - size, anchor.point.y - size);
    ctx.lineTo(anchor.point.x + size, anchor.point.y + size);
    ctx.moveTo(anchor.point.x + size, anchor.point.y - size);
    ctx.lineTo(anchor.point.x - size, anchor.point.y + size);
    ctx.stroke();
  }

  private getNodeAtPoint(point: Point, reconnecting: boolean): Node | null {
    const nodes = Array.from(this.renderer.nodes.values());
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!;
      if (!node.visible || !node.hitTest(point)) {
        continue;
      }

      if (reconnecting) {
        return node;
      }

      if (this.isCompatibleTarget(node)) {
        return node;
      }
    }

    return null;
  }

  private getRawNodeAtPoint(point: Point): Node | null {
    const nodes = Array.from(this.renderer.nodes.values());
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!;
      if (node.visible && node.hitTest(point)) {
        return node;
      }
    }
    return null;
  }

  private nodeLooksLikeContainer(node: Node, source = this.sourceNode): boolean {
    if (!source || source.id === node.id) {
      return false;
    }
    const nodeArea = node.width * node.height;
    const sourceArea = Math.max(source.width * source.height, 1);
    return nodeArea >= sourceArea * 4;
  }

  private nodeContainsSource(node: Node, source = this.sourceNode): boolean {
    if (!source || source.id === node.id) {
      return false;
    }
    const sourceBounds = source.getBounds();
    const nodeBounds = node.getBounds();
    const cx = sourceBounds.x + sourceBounds.width / 2;
    const cy = sourceBounds.y + sourceBounds.height / 2;
    return (
      cx >= nodeBounds.x &&
      cx <= nodeBounds.x + nodeBounds.width &&
      cy >= nodeBounds.y &&
      cy <= nodeBounds.y + nodeBounds.height
    );
  }

  private startOutlineConnection(node: Node, attach: Point): void {
    const { point: outlinePoint, param } = node.getClosestPointOnOutline(attach);
    this.sourceNode = node;
    this.isConnecting = true;
    this.sourceAnchorId = null;
    this.sourcePoint = outlinePoint;
    this.sourceOutlineParam = param;
    this.previewEndpoint = attach;
    this.emit('connectionStart', node);
    this.renderer.markDirty();
  }

  private outlineHandleHysteresis(): number {
    return OUTLINE_CONNECT_HANDLE_HYSTERESIS / Math.max(this.renderer.zoom, 0.0001);
  }

  private outlineConnectHandleFor(
    node: Node,
    pointer: Point
  ): { attach: Point; handle: Point; side: OutlineSide } {
    const { point: onOutline } = node.getClosestPointOnOutline(pointer);
    const prevSide = node.id === this.hoverNodeId ? this.hoverOutlineSide : null;
    const geom = getOutlineConnectHandle(
      node.getBounds(),
      pointer,
      0,
      prevSide,
      this.outlineHandleHysteresis()
    );
    return { attach: onOutline, handle: onOutline, side: geom.side };
  }

  private outlineHandleHitRadius(): number {
    return OUTLINE_CONNECT_HANDLE_HIT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
  }

  private findOutlineConnectHandleAt(
    point: Point
  ): { node: Node; attach: Point; handle: Point } | null {
    if (!this.attachToOutline) {
      return null;
    }
    // Keep the selected edge's endpoint circle as the affordance — the outline "+"
    // would cover the same hotspot and steal the hover.
    if (this.isNearSelectedEdgeEndpoint(point)) {
      return null;
    }
    const radiusSq = this.outlineHandleHitRadius() ** 2;
    const nodes = Array.from(this.renderer.nodes.values());
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!;
      if (!node.visible || !this.isCompatibleTarget(node)) {
        continue;
      }
      if (node.hitTestResizeHandle(point)) {
        continue;
      }
      const { attach, handle } = this.outlineConnectHandleFor(node, point);
      const dx = point.x - handle.x;
      const dy = point.y - handle.y;
      if (dx * dx + dy * dy <= radiusSq) {
        return { node, attach, handle };
      }
    }
    return null;
  }

  /** True when the pointer is on a selected edge's start/end reconnect handle. */
  private isNearSelectedEdgeEndpoint(point: Point): boolean {
    const handleRadius = EDGE_HANDLE_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    for (const edge of this.renderer.edges.values()) {
      if (edge.state !== 'selected') {
        continue;
      }
      if (
        edge.hitTestStartHandle(point, handleRadius) ||
        edge.hitTestEndHandle(point, handleRadius)
      ) {
        return true;
      }
    }
    return false;
  }

  private renderOutlineConnectHandle(ctx: CanvasRenderingContext2D): void {
    if (!this.hoverOutlineHandle || !this.hoverNodeId || !this.hoverPoint) {
      return;
    }
    const node = this.renderer.getNode(this.hoverNodeId);
    if (!node) {
      return;
    }
    const { handle } = this.outlineConnectHandleFor(node, this.hoverPoint);
    const zoom = Math.max(this.renderer.zoom, 0.0001);
    // Screen-sized so the marker stays readable at any zoom and around the arrow tip.
    const radius = 8 / zoom;
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    this.drawPlus(radius, ctx, handle, 2 / zoom);
    ctx.restore();
  }

  private clearOutlineHandleCursor(): void {
    if (this.hoverOutlineHandle) {
      this.hoverOutlineHandle = false;
      this.setCursor('');
    }
  }

  private updateHover(point: Point): void {
    if (this.hoverDisabled) {
      return;
    }

    const handleHit = this.findOutlineConnectHandleAt(point);
    const node = handleHit?.node ?? this.getNodeAtPoint(point, false);
    const prevNodeId = this.hoverNodeId;
    const prevAnchorId = this.hoverAnchorId;
    const prevOutlineHandle = this.hoverOutlineHandle;

    this.hoverPoint = node ? point : null;
    if (!node) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
      this.hoverOutlineSide = null;
      this.clearOutlineHandleCursor();
    } else {
      this.hoverNodeId = node.id;
      // Port-mode "+" on an anchor that coincides with a selected edge end is the same clash.
      const nearSelectedEndpoint = this.isNearSelectedEdgeEndpoint(point);
      this.hoverAnchorId =
        handleHit || nearSelectedEndpoint ? null : (this.getAnchorAtPoint(node, point)?.id ?? null);
      this.hoverOutlineHandle = handleHit !== null && !nearSelectedEndpoint;
      if (this.attachToOutline) {
        this.hoverOutlineSide = this.outlineConnectHandleFor(node, point).side;
      }
      // The drawn port is the affordance. A crosshair sits on the same hotspot and hides it.
      if (!this.hoverOutlineHandle && prevOutlineHandle) {
        this.setCursor('');
      }
    }

    if (
      prevNodeId !== this.hoverNodeId ||
      prevAnchorId !== this.hoverAnchorId ||
      prevOutlineHandle !== this.hoverOutlineHandle ||
      (this.attachToOutline && node !== null)
    ) {
      this.renderer.markDirty();
    }
  }

  private getAnchorAtPoint(node: Node, point: Point): { id: string; point: Point } | null {
    // Get only port-side anchors if attachToOutline is disabled and node has ports
    const anchorIds =
      !this.attachToOutline && node.ports.length > 0 ? node.getPortAnchorIds() : null;

    const anchors = node.getAnchors();
    if (anchors.length === 0) {
      return null;
    }

    const radius = ANCHOR_POINT_HITBOX_RADIUS;
    const radiusSq = radius * radius;
    let closest: { id: string; point: Point } | null = null;
    let minDist = Infinity;

    for (const anchor of anchors) {
      // Skip anchors not on port sides when in port mode
      if (anchorIds && !anchorIds.includes(anchor.id)) {
        continue;
      }
      const dx = point.x - anchor.point.x;
      const dy = point.y - anchor.point.y;
      const dist = dx * dx + dy * dy;
      if (dist <= radiusSq && dist < minDist) {
        minDist = dist;
        closest = { id: anchor.id, point: anchor.point };
      }
    }

    return closest;
  }
}
