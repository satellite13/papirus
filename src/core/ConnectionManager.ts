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
  OUTLINE_SNAP_SCREEN_TOLERANCE,
  ANCHOR_POINT_HITBOX_RADIUS,
  ANCHOR_POINT_HOVER_RADIUS,
  ANCHOR_POINT_RADIUS,
  BEZIER_MAX_OFFSET,
} from '@/constants';
import { clonePoints, distance } from '@/utils/geometry';
import { getDirectionFromOutlineParam } from '@/utils/direction';
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
  controlPointDragStart: [];
  controlPointDragEnd: [];
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
  private snapToGrid: boolean;
  private gridSize: number;
  private attachToOutline: boolean;
  private previewPathType: ConnectionPreviewPathType;

  constructor(options: ConnectionManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.createEdge = options.createEdge;
    this.addEdge = options.addEdge ?? ((edge): void => this.renderer.addEdge(edge));
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
    this.attachToOutline = options.attachToOutline ?? false;
    this.previewPathType = options.previewPathType ?? 'bezier';
  }

  /**
   * Enable/disable attach-to-outline mode (edges attach anywhere on shape contour)
   */
  setAttachToOutline(enabled: boolean): void {
    this.attachToOutline = enabled;
    this.renderer.attachToOutline = enabled;
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
    return this.activeControlPointDrag !== null;
  }

  /**
   * Сброс hover портов/якорей (курсор над миникартой и т.п., без вызова updateHover).
   */
  clearPointerHover(): void {
    if (this.hoverDisabled) {
      return;
    }
    if (this.hoverNodeId !== null || this.hoverAnchorId !== null) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
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
    if (this.hoverNodeId !== null || this.hoverAnchorId !== null) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
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
   * When attachToOutline + Shift: start from anywhere on node outline.
   * Otherwise: requires clicking on an anchor/port so that node drag still works.
   */
  tryStartConnectionAtPoint(event: InputEvent): boolean {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return false;
    }
    const point = { x: event.worldX, y: event.worldY };
    const node = this.getNodeAtPoint(point, false);
    if (!node) {
      return false;
    }

    if (this.attachToOutline && event.shiftKey) {
      const { point: outlinePoint, param } = node.getClosestPointOnOutline(point);
      this.sourceNode = node;
      this.isConnecting = true;
      this.sourceAnchorId = null;
      this.sourcePoint = outlinePoint;
      this.sourceOutlineParam = param;
      this.previewEndpoint = point;
      this.emit('connectionStart', node);
      this.renderer.markDirty();
      return true;
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
    if (this.tryStartEditableControlInteraction(event)) {
      return true;
    }

    const point = { x: event.worldX, y: event.worldY };
    const handleRadius = EDGE_HANDLE_RADIUS / Math.max(this.renderer.zoom, 0.0001);

    // Check selected edges for handle hit
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

    if (this.attachToOutline) {
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
        snappedDir = getDirectionFromOutlineParam(bestResult.param);

        const otherNode = this.reconnectingEndpoint === 'start' ? toNode : fromNode;
        if (otherNode) {
          const alignRef = edge.isEditablePolyline()
            ? this.getNearestBendPointForAxisAlignment(edge, this.reconnectingEndpoint!)
            : this.reconnectingEndpoint === 'start'
              ? this.getTargetPointForReconnect(edge, toNode!, 'to', snappedPoint)
              : this.getTargetPointForReconnect(edge, fromNode!, 'from', snappedPoint);
          snappedPoint = this.applyAxisAlignmentToPoint(snappedPoint, alignRef);
          const reprojected = targetNode.getClosestPointOnOutline(snappedPoint);
          snappedPoint = reprojected.point;
          this.reconnectingOutlineParam = reprojected.param;
          snappedDir = getDirectionFromOutlineParam(reprojected.param);
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
      obstacles.push({
        id: node.id,
        x: node.x - 8,
        y: node.y - 8,
        width: node.width + 16,
        height: node.height + 16,
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
      return getDirectionFromOutlineParam(ep.outlineParam);
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
    const edgeDrop = this.findEdgeDropTarget(cursorPoint);
    if (edgeDrop) {
      let nodeDistance = Infinity;
      if (targetNode) {
        const dx = cursorPoint.x - snappedPoint.x;
        const dy = cursorPoint.y - snappedPoint.y;
        nodeDistance = Math.sqrt(dx * dx + dy * dy);
      }
      if (!targetNode || edgeDrop.distance < nodeDistance) {
        targetNode = null;
        this.previewTargetNodeId = null;
        this.previewTargetOutlineParam = null;
        this.previewTargetAnchorId = null;
        snappedPoint = edgeDrop.point;
        this.previewTargetEdgeId = edgeDrop.edge.id;
        this.previewTargetPathParam = edgeDrop.pathParam;
      }
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

      let node = this.getNodeAtPoint(point, true);
      if (!node && this.attachToOutline && this.reconnectingTargetNodeId) {
        node = this.renderer.getNode(this.reconnectingTargetNodeId) ?? null;
      }
      if (node) {
        if (this.attachToOutline && this.reconnectingOutlineParam !== null) {
          const endpoint: EdgeEndpoint = {
            nodeId: node.id,
            outlineParam: this.reconnectingOutlineParam,
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
            portId: this.sourceAnchorId
              ? `${ANCHOR_PORT_PREFIX}${this.sourceAnchorId}`
              : undefined,
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
    if (!this.isConnecting) {
      return;
    }

    this.emit('connectionEnd', null);
    this.reset();
    this.renderer.markDirty();
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
      const fromDir =
        this.sourceOutlineParam !== null
          ? getDirectionFromOutlineParam(this.sourceOutlineParam)
          : this.sourceAnchorId?.split(':')[0];
      const toDir =
        this.previewTargetOutlineParam !== null
          ? getDirectionFromOutlineParam(this.previewTargetOutlineParam)
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
    point: Point
  ): { edge: Edge; edgeId: string; pathParam: number; point: Point; distance: number } | null {
    const tolerance = Math.max(14, 20 / Math.max(this.renderer.zoom, 0.0001));
    let best: { edge: Edge; pathParam: number; point: Point; distance: number } | null = null;
    for (const edge of this.renderer.edges.values()) {
      if (!edge.visible || edge.path.length < 2) continue;
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

  /**
   * Render anchors when hovering a node (not connecting)
   */
  renderHoverAnchors(ctx: CanvasRenderingContext2D): void {
    if (this.isConnecting || this.isReconnecting) {
      return;
    }

    this.renderEditablePolylineControls(ctx);

    if (this.attachToOutline) {
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
        this.drawPlus(radius, ctx, anchor);
      }
    }

    ctx.restore();
  }

  private tryStartEditableControlInteraction(event: InputEvent): boolean {
    const point = { x: event.worldX, y: event.worldY };
    const pointRadius = EDGE_CONTROL_POINT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const addRadius = EDGE_ADD_CONTROL_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const pointRadiusSq = pointRadius * pointRadius;
    const addRadiusSq = addRadius * addRadius;
    const edges = [...this.renderer.edges.values()];

    for (let i = edges.length - 1; i >= 0; i--) {
      const edge = edges[i]!;
      if (edge.state !== 'selected' || !edge.isEditablePolyline()) {
        continue;
      }

      const controlPoints = edge.getEditableControlPoints();
      if (controlPoints.length === 0) continue;

      for (let i = 0; i < controlPoints.length; i++) {
        const dx = point.x - controlPoints[i]!.x;
        const dy = point.y - controlPoints[i]!.y;
        if (dx * dx + dy * dy > pointRadiusSq) {
          continue;
        }

        if (!edge.controlPoints || edge.controlPoints.length === 0) {
          edge.controlPoints = controlPoints;
        }
        this.activeControlPointDrag = { edge, index: i };
        this.emit('controlPointDragStart');
        this.renderer.markDirty();
        return true;
      }

      const insertControls = this.getInsertControls(edge);
      for (const insertControl of insertControls) {
        const dx = point.x - insertControl.point.x;
        const dy = point.y - insertControl.point.y;
        if (dx * dx + dy * dy > addRadiusSq) {
          continue;
        }

        const materialized = edge.controlPoints
          ? clonePoints(edge.controlPoints)
          : clonePoints(controlPoints);
        materialized.splice(insertControl.index, 0, this.snapPoint(insertControl.point));
        edge.controlPoints = materialized;
        this.activeControlPointDrag = { edge, index: insertControl.index };
        this.emit('controlPointDragStart');
        this.renderer.markDirty();
        return true;
      }
    }

    return false;
  }

  private renderEditablePolylineControls(ctx: CanvasRenderingContext2D): void {
    const pointRadius = EDGE_CONTROL_POINT_RADIUS / Math.max(this.renderer.zoom, 0.0001);
    const addRadius = EDGE_ADD_CONTROL_RADIUS / Math.max(this.renderer.zoom, 0.0001);

    ctx.save();
    ctx.setLineDash([]);

    for (const edge of this.renderer.edges.values()) {
      if (edge.state !== 'selected' || !edge.isEditablePolyline()) {
        continue;
      }

      const controlPoints = edge.getEditableControlPoints();
      const insertControls = this.getInsertControls(edge);
      for (const insertControl of insertControls) {
        this.drawAddControl(ctx, insertControl.point, addRadius);
      }

      for (const point of controlPoints) {
        this.drawControlPoint(ctx, point, pointRadius);
      }
    }

    ctx.restore();
  }

  private getInsertControls(edge: Edge): { point: Point; index: number }[] {
    const vertices = edge.getPathVertices();
    const controls: { point: Point; index: number }[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const start = vertices[i]!;
      const end = vertices[i + 1]!;
      controls.push({
        point: {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
        index: i,
      });
    }
    return controls;
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

  private drawAddControl(ctx: CanvasRenderingContext2D, point: Point, radius: number): void {
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
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / Math.max(this.renderer.zoom, 0.0001);
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

    const xCandidates = [prev.x, next.x];
    const yCandidates = [prev.y, next.y];

    let closestXDist = Infinity;
    for (const candidate of xCandidates) {
      const dist = Math.abs(point.x - candidate);
      if (dist <= tolerance && dist < closestXDist) {
        closestXDist = dist;
        x = candidate;
      }
    }

    let closestYDist = Infinity;
    for (const candidate of yCandidates) {
      const dist = Math.abs(point.y - candidate);
      if (dist <= tolerance && dist < closestYDist) {
        closestYDist = dist;
        y = candidate;
      }
    }

    return { x, y };
  }

  private drawPlus(
    radius: number,
    ctx: CanvasRenderingContext2D,
    anchor: { id: AnchorId; point: Point }
  ): void {
    const plusSize = radius * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(anchor.point.x - plusSize, anchor.point.y);
    ctx.lineTo(anchor.point.x + plusSize, anchor.point.y);
    ctx.moveTo(anchor.point.x, anchor.point.y - plusSize);
    ctx.lineTo(anchor.point.x, anchor.point.y + plusSize);
    ctx.stroke();
    return;
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
          this.drawPlus(radius, ctx, anchor);
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

  private updateHover(point: Point): void {
    if (this.hoverDisabled) {
      return;
    }

    const node = this.getNodeAtPoint(point, false);
    const prevNodeId = this.hoverNodeId;
    const prevAnchorId = this.hoverAnchorId;

    if (!node) {
      this.hoverNodeId = null;
      this.hoverAnchorId = null;
    } else {
      this.hoverNodeId = node.id;
      const anchor = this.getAnchorAtPoint(node, point);
      this.hoverAnchorId = anchor?.id ?? null;
    }

    if (prevNodeId !== this.hoverNodeId || prevAnchorId !== this.hoverAnchorId) {
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
