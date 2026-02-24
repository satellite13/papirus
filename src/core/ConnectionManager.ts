import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { InputEvent } from '@/events/InputHandler';
import type { AnchorId, Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { EdgeEndpoint, Point } from '@/types';
import {
  ANCHOR_PORT_PREFIX,
  EDGE_HANDLE_RADIUS,
  EDGE_CONTROL_POINT_RADIUS,
  EDGE_ADD_CONTROL_RADIUS,
  ANCHOR_POINT_RADIUS,
  ANCHOR_POINT_HOVER_RADIUS,
  ANCHOR_POINT_HITBOX_RADIUS,
  BEZIER_MAX_OFFSET,
} from '@/constants';

const EDGE_AXIS_MAGNET_SCREEN_TOLERANCE = 10;

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
}

export type ConnectionValidator = (sourceNodeId: string, targetNodeId: string) => boolean;

export interface ConnectionManagerOptions {
  renderer: DiagramRenderer;
  createEdge: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  addEdge?: (edge: Edge) => void;
  snapToGrid?: boolean;
  gridSize?: number;
}

/**
 * Manages port-to-port connection creation
 */
export class ConnectionManager extends EventEmitter<ConnectionEvents> {
  private renderer: DiagramRenderer;
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

  // Edge reconnection state
  private isReconnecting = false;
  private reconnectingEdge: Edge | null = null;
  private reconnectingEndpoint: 'start' | 'end' | null = null;
  private originalEdgeEndpoint: EdgeEndpoint | null = null;
  private activeControlPointDrag: { edge: Edge; index: number } | null = null;
  private snapToGrid: boolean;
  private gridSize: number;

  constructor(options: ConnectionManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.createEdge = options.createEdge;
    this.addEdge = options.addEdge ?? ((edge): void => this.renderer.addEdge(edge));
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
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
   * Handle mouse down on a node
   */
  handleNodeMouseDown(event: InputEvent, node: Node): boolean {
    this.sourceNode = node;
    this.isConnecting = true;
    const target = { x: event.worldX, y: event.worldY };
    const anchor = node.getNearestAnchor(target);
    this.sourceAnchorId = anchor?.id ?? null;
    this.sourcePoint = anchor?.point ?? node.getConnectionPoint(target);
    this.previewEndpoint = target;

    this.emit('connectionStart', node);
    return true;
  }

  /**
   * Check if mouse is over a port and start connection
   */
  tryStartConnection(event: InputEvent): boolean {
    const point = { x: event.worldX, y: event.worldY };

    // First check if clicking on edge handle for reconnection
    if (this.tryStartReconnection(event)) {
      return true;
    }

    const node = this.getNodeAtPoint(point, false);
    if (node) {
      return this.handleNodeMouseDown(event, node);
    }

    return false;
  }

  /**
   * Try to start connection from a hovered anchor point
   */
  tryStartConnectionAtPoint(event: InputEvent): boolean {
    const point = { x: event.worldX, y: event.worldY };
    const node = this.getNodeAtPoint(point, false);
    if (!node) {
      return false;
    }

    const hover = this.getAnchorAtPoint(node, point);
    if (!hover) {
      return false;
    }

    this.sourceNode = node;
    this.isConnecting = true;
    this.sourceAnchorId = hover.id;
    this.sourcePoint = hover.point;
    this.previewEndpoint = point;

    this.emit('connectionStart', node);
    this.renderer.markDirty();
    return true;
  }

  /**
   * Try to start edge reconnection from handle
   */
  tryStartReconnection(event: InputEvent): boolean {
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
    const fromNode = this.renderer.getNode(edge.from.nodeId);
    const toNode = this.renderer.getNode(edge.to.nodeId);

    // Try to snap to nearest anchor point on target node
    let snappedPoint = point;
    let snappedDir: string | undefined;
    const targetNode = this.getNodeAtPoint(point, true);
    if (targetNode) {
      const nearestAnchor = targetNode.getNearestAnchor(point);
      if (nearestAnchor) {
        snappedPoint = nearestAnchor.point;
        snappedDir = nearestAnchor.id.split(':')[0];
      }
    }

    this.reconnectPoint = snappedPoint;

    if (this.reconnectingEndpoint === 'start') {
      if (toNode) {
        const toAnchorId = edge.to.portId?.replace(ANCHOR_PORT_PREFIX, '');
        const target = toAnchorId
          ? toNode.getAnchorPointById(toAnchorId) ?? toNode.getConnectionPoint(snappedPoint)
          : toNode.getConnectionPoint(snappedPoint);
        const toDir = toAnchorId?.split(':')[0];
        edge.updateEndpoints(snappedPoint, target, snappedDir, toDir);
      }
    } else {
      if (fromNode) {
        const fromAnchorId = edge.from.portId?.replace(ANCHOR_PORT_PREFIX, '');
        const start = fromAnchorId
          ? fromNode.getAnchorPointById(fromAnchorId) ?? fromNode.getConnectionPoint(snappedPoint)
          : fromNode.getConnectionPoint(snappedPoint);
        const fromDir = fromAnchorId?.split(':')[0];
        edge.updateEndpoints(start, snappedPoint, fromDir, snappedDir);
      }
    }

    this.renderer.markDirty();
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

    // Try to snap to nearest anchor point on target node
    let snappedPoint = cursorPoint;
    this.previewTargetAnchorId = null;
    const targetNode = this.getNodeAtPoint(cursorPoint, false);
    if (targetNode && this.isCompatibleTarget(targetNode)) {
      const forbidden = this._connectionValidator && this.sourceNode &&
        !this._connectionValidator(this.sourceNode.id, targetNode.id);
      if (forbidden) {
        this.setCursor('not-allowed');
      } else {
        this.setCursor('crosshair');
        const nearestAnchor = targetNode.getNearestAnchor(cursorPoint);
        if (nearestAnchor) {
          snappedPoint = nearestAnchor.point;
          this.previewTargetAnchorId = nearestAnchor.id;
        }
      }
    } else {
      this.setCursor('crosshair');
    }

    this.previewEndpoint = snappedPoint;
    // Only update source point if we didn't start from a specific anchor
    if (this.sourceNode && !this.sourceAnchorId) {
      this.sourcePoint = this.sourceNode.getConnectionPoint(this.previewEndpoint);
    }

    this.emit(
      'connectionMove',
      this.sourcePoint!,
      this.previewEndpoint
    );
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
    const edges = Array.from(this.renderer.edges.values()).reverse();

    for (const edge of edges) {
      if (edge.state !== 'selected' || !edge.isEditablePolyline()) {
        continue;
      }
      if (!edge.controlPoints || edge.controlPoints.length === 0) {
        continue;
      }

      for (let i = 0; i < edge.controlPoints.length; i++) {
        const controlPoint = edge.controlPoints[i]!;
        const dx = point.x - controlPoint.x;
        const dy = point.y - controlPoint.y;
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }

        const next = [...edge.controlPoints];
        next.splice(i, 1);
        edge.controlPoints = next.length > 0 ? next : undefined;
        if (
          this.activeControlPointDrag &&
          this.activeControlPointDrag.edge.id === edge.id &&
          this.activeControlPointDrag.index === i
        ) {
          this.activeControlPointDrag = null;
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
      this.renderer.markDirty();
      return true;
    }

    // Handle edge reconnection completion
    if (this.isReconnecting && this.reconnectingEdge) {
      const point = { x: event.worldX, y: event.worldY };
      let reconnected = false;

      const node = this.getNodeAtPoint(point, true);
      if (node) {
        const anchor = node.getNearestAnchor(point);
        // Update the edge endpoint
        if (this.reconnectingEndpoint === 'start') {
          this.reconnectingEdge.from = {
            nodeId: node.id,
            portId:
              this.reconnectingEdge.lockAnchors && anchor
                ? `${ANCHOR_PORT_PREFIX}${anchor.id}`
                : undefined,
          };
        } else {
          this.reconnectingEdge.to = {
            nodeId: node.id,
            portId:
              this.reconnectingEdge.lockAnchors && anchor
                ? `${ANCHOR_PORT_PREFIX}${anchor.id}`
                : undefined,
          };
        }
        reconnected = true;
        this.emit('edgeReconnect', this.reconnectingEdge, this.reconnectingEndpoint!);
      }

      // If not dropped on valid port, restore original endpoint
      if (!reconnected && this.originalEdgeEndpoint) {
        if (this.reconnectingEndpoint === 'start') {
          this.reconnectingEdge.from = this.originalEdgeEndpoint;
        } else {
          this.reconnectingEdge.to = this.originalEdgeEndpoint;
        }
        // Emit to trigger updateEdgePaths and restore original position
        this.emit('edgeReconnect', this.reconnectingEdge, this.reconnectingEndpoint!);
      }

      this.resetReconnection();
      this.renderer.markDirty();
      return true;
    }

    if (!this.isConnecting) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };
    let createdEdge: Edge | null = null;

    // Check if we're over a valid target node
    const targetNode = this.getNodeAtPoint(point, false);
    if (targetNode) {
      // Check validator if set
      const allowed = !this._connectionValidator ||
        this._connectionValidator(this.sourceNode!.id, targetNode.id);
      if (allowed) {
        // Create the edge
        const nearestTargetAnchor = targetNode.getNearestAnchor(point);
        const sourceAnchorId = this.sourceAnchorId;
        const from: EdgeEndpoint = {
          nodeId: this.sourceNode!.id,
          portId: sourceAnchorId ? `${ANCHOR_PORT_PREFIX}${sourceAnchorId}` : undefined,
        };
        const to: EdgeEndpoint = {
          nodeId: targetNode.id,
          portId: nearestTargetAnchor ? `${ANCHOR_PORT_PREFIX}${nearestTargetAnchor.id}` : undefined,
        };

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
      this.renderAnchorHighlights(ctx, this.reconnectPoint, true);
      return;
    }

    if (!this.isConnecting || this.previewEndpoint === null) {
      return;
    }

    const start = this.sourcePoint!;
    const end = this.previewEndpoint;

    // Extract directions from anchor IDs
    const fromDir = this.sourceAnchorId?.split(':')[0];
    const toDir = this.previewTargetAnchorId?.split(':')[0];

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // Draw bezier curve for preview
    this.drawBezierPreview(ctx, start, end, fromDir, toDir);

    ctx.setLineDash([]);

    this.renderAnchorHighlights(ctx, end, false);
  }

  /**
   * Get control point offset based on direction
   */
  private getDirectionOffset(dir: string | undefined, distance: number): Point {
    const offset = Math.min(distance * 0.5, BEZIER_MAX_OFFSET);
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
   * Draw a Bézier curve preview between two points
   */
  private drawBezierPreview(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    fromDir?: string,
    toDir?: string
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    // If directions are specified, use them for control points
    if (fromDir || toDir) {
      const fromOffset = this.getDirectionOffset(fromDir, distance);
      const toOffset = this.getDirectionOffset(toDir, distance);

      ctx.bezierCurveTo(
        start.x + fromOffset.x, start.y + fromOffset.y,
        end.x + toOffset.x, end.y + toOffset.y,
        end.x, end.y
      );
    } else {
      // Default behavior: auto-detect direction
      const offset = Math.min(Math.abs(dx), Math.abs(dy), BEZIER_MAX_OFFSET) * 0.5 + 50;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal dominant
        const offsetX = offset * Math.sign(dx || 1);
        ctx.bezierCurveTo(
          start.x + offsetX, start.y,
          end.x - offsetX, end.y,
          end.x, end.y
        );
      } else {
        // Vertical dominant
        ctx.bezierCurveTo(
          start.x, start.y + offset * Math.sign(dy || 1),
          end.x, end.y - offset * Math.sign(dy || 1),
          end.x, end.y
        );
      }
    }

    ctx.stroke();
  }

  private isCompatibleTarget(_node: Node): boolean {
    // Self-loop edges are allowed.
    return true;
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
    this.setCursor('');
  }

  private resetReconnection(): void {
    this.isReconnecting = false;
    if (this.reconnectingEdge) {
      this.reconnectingEdge.autoUpdateEndpoints = true;
    }
    this.reconnectingEdge = null;
    this.reconnectingEndpoint = null;
    this.originalEdgeEndpoint = null;
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
    const edges = Array.from(this.renderer.edges.values()).reverse();

    for (const edge of edges) {
      if (edge.state !== 'selected' || !edge.isEditablePolyline()) {
        continue;
      }

      const controlPoints = edge.getEditableControlPoints();
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
        this.renderer.markDirty();
        return true;
      }

      const insertControls = this.getInsertControls(edge, controlPoints);
      for (const insertControl of insertControls) {
        const dx = point.x - insertControl.point.x;
        const dy = point.y - insertControl.point.y;
        if (dx * dx + dy * dy > addRadiusSq) {
          continue;
        }

        const materialized = edge.controlPoints ? [...edge.controlPoints] : [...controlPoints];
        materialized.splice(insertControl.index, 0, this.snapPoint(insertControl.point));
        edge.controlPoints = materialized;
        this.activeControlPointDrag = { edge, index: insertControl.index };
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
      const insertControls = this.getInsertControls(edge, controlPoints);
      for (const insertControl of insertControls) {
        this.drawAddControl(ctx, insertControl.point, addRadius);
      }

      for (const point of controlPoints) {
        this.drawControlPoint(ctx, point, pointRadius);
      }
    }

    ctx.restore();
  }

  private getInsertControls(edge: Edge, controlPoints: Point[]): { point: Point; index: number }[] {
    const vertices = [edge.startPoint, ...controlPoints, edge.endPoint];
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

  private drawPlus(radius: number, ctx: CanvasRenderingContext2D, anchor: { id: AnchorId; point: Point }): void {
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

  private renderAnchorHighlights(ctx: CanvasRenderingContext2D, point: Point, reconnecting: boolean): void {
    const node = this.getNodeAtPoint(point, reconnecting);
    if (!node) {
      return;
    }

    // Check if connection to this target is allowed
    const forbidden = this._connectionValidator && this.sourceNode &&
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

  private drawCross(radius: number, ctx: CanvasRenderingContext2D, anchor: { id: AnchorId; point: Point }): void {
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
    const anchors = node.getAnchors();
    if (anchors.length === 0) {
      return null;
    }

    const radius = ANCHOR_POINT_HITBOX_RADIUS;
    const radiusSq = radius * radius;
    let closest: { id: string; point: Point } | null = null;
    let minDist = Infinity;

    for (const anchor of anchors) {
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
