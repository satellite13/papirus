import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { InputEvent } from '@/events/InputHandler';
import type { AnchorId, Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { EdgeEndpoint, Point } from '@/types';
import { ANCHOR_PORT_PREFIX, EDGE_HANDLE_RADIUS, ANCHOR_POINT_RADIUS, ANCHOR_POINT_HOVER_RADIUS, ANCHOR_POINT_HITBOX_RADIUS, BEZIER_MAX_OFFSET } from '@/constants';

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

export interface ConnectionManagerOptions {
  renderer: DiagramRenderer;
  createEdge: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  addEdge?: (edge: Edge) => void;
}

/**
 * Manages port-to-port connection creation
 */
export class ConnectionManager extends EventEmitter<ConnectionEvents> {
  private renderer: DiagramRenderer;
  private readonly createEdge: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  private readonly addEdge: (edge: Edge) => void;

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

  constructor(options: ConnectionManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.createEdge = options.createEdge;
    this.addEdge = options.addEdge ?? ((edge): void => this.renderer.addEdge(edge));
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
      const nearestAnchor = targetNode.getNearestAnchor(cursorPoint);
      if (nearestAnchor) {
        snappedPoint = nearestAnchor.point;
        this.previewTargetAnchorId = nearestAnchor.id;
      }
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
   * Get the node ID at the other end of the reconnecting edge
   */
  private getOtherNodeId(): string | null {
    if (!this.reconnectingEdge) return null;
    return this.reconnectingEndpoint === 'start'
      ? this.reconnectingEdge.to.nodeId
      : this.reconnectingEdge.from.nodeId;
  }

  /**
   * Handle mouse up to complete or cancel connection
   */
  handleMouseUp(event: InputEvent): boolean {
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
      // Create the edge
      const targetAnchor = targetNode.getNearestAnchor(point);
      const from: EdgeEndpoint = {
        nodeId: this.sourceNode!.id,
        portId: this.sourceAnchorId ? `${ANCHOR_PORT_PREFIX}${this.sourceAnchorId}` : undefined,
      };
      const to: EdgeEndpoint = {
        nodeId: targetNode.id,
        portId: targetAnchor ? `${ANCHOR_PORT_PREFIX}${targetAnchor.id}` : undefined,
      };

      createdEdge = this.createEdge(from, to);
      this.addEdge(createdEdge);
      this.emit('connect', createdEdge);
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

  private isCompatibleTarget(node: Node): boolean {
    // Can't connect to same node
    return node.id !== this.sourceNode?.id;
  }

  private reset(): void {
    this.isConnecting = false;
    this.sourceNode = null;
    this.sourcePoint = null;
    this.previewEndpoint = null;
    this.sourceAnchorId = null;
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
  }

  /**
   * Render anchors when hovering a node (not connecting)
   */
  renderHoverAnchors(ctx: CanvasRenderingContext2D): void {
    if (this.isConnecting || this.isReconnecting) {
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

    const anchors = node.getAnchors();
    const nearest = node.getNearestAnchor(point);
    if (anchors.length === 0) {
      return;
    }

    ctx.save();
    ctx.setLineDash([]);

    for (const anchor of anchors) {
      const isNearest = nearest && anchor.id === nearest.id;
      const radius = isNearest ? ANCHOR_POINT_HOVER_RADIUS : ANCHOR_POINT_RADIUS;

      // Draw anchor circle
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(anchor.point.x, anchor.point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw white plus on nearest
      if (isNearest) {
        this.drawPlus(radius, ctx, anchor);
      }
    }

    ctx.restore();
  }

  private getNodeAtPoint(point: Point, reconnecting: boolean): Node | null {
    const nodes = Array.from(this.renderer.nodes.values());
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!;
      if (!node.visible || !node.hitTest(point)) {
        continue;
      }

      if (reconnecting) {
        const otherId = this.getOtherNodeId();
        if (otherId && node.id === otherId) {
          continue;
        }
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
