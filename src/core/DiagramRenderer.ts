import { EventEmitter } from '@/events/EventEmitter';
import type { StyleManager } from '@/styles/StyleManager';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { Bounds, DiagramOptions, Point, ViewportState } from '@/types';
import { InteractionManager } from './InteractionManager';
import type { InteractionManagerOptions } from './InteractionManager';
import { ANCHOR_PORT_PREFIX } from '@/constants';
import { applyStyleManagerToElements } from '@/utils/applyStyleManager';
import { getContentBounds } from '@/utils/contentBounds';
import { AnimationManager } from './AnimationManager';
import { ContextMenuManager } from './ContextMenuManager';

/**
 * Events emitted by DiagramRenderer
 */
export interface DiagramEvents {
  render: [];
  zoom: [zoom: number];
  pan: [offsetX: number, offsetY: number];
  select: [elementIds: string[]];
  nodeAdd: [node: Node];
  nodeRemove: [node: Node];
  edgeAdd: [edge: Edge];
  edgeRemove: [edge: Edge];
}

export interface DiagramPlugin {
  name?: string;
  install(renderer: DiagramRenderer): void;
  destroy?(renderer: DiagramRenderer): void;
}

const DEFAULT_OPTIONS: Required<DiagramOptions> = {
  width: 800,
  height: 600,
  backgroundColor: '#ffffff',
  retina: true,
  minZoom: 0.1,
  maxZoom: 5,
  initialZoom: 1,
  snapToGrid: false,
  scrollbarOverlay: true,
  animations: {
    enabled: false,
  },
};

/**
 * Main diagram renderer class
 * Manages canvas, coordinate system, and render loop
 */
export class DiagramRenderer extends EventEmitter<DiagramEvents> {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: Required<DiagramOptions>;
  private plugins: DiagramPlugin[] = [];
  private styleManager?: StyleManager;
  private underlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private overlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private interactionManager: InteractionManager | null = null;
  private contextMenuManager: ContextMenuManager | null = null;
  private readonly animationManager: AnimationManager;
  private frameTime = 0;

  private _zoom = 1;
  private _offsetX = 0;
  private _offsetY = 0;
  private _dirty = true;
  private _destroyed = false;

  private animationFrameId: number | null = null;
  private devicePixelRatio: number;

  private _nodes = new Map<string, Node>();
  private _edges = new Map<string, Edge>();
  private _groups = new Map<string, Group>();

  constructor(canvas: HTMLCanvasElement | string, options: DiagramOptions = {}) {
    super();
    this.canvas = this.resolveCanvas(canvas);
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    this.devicePixelRatio = this.options.retina ? window.devicePixelRatio || 1 : 1;
    this._zoom = this.options.initialZoom;
    this.animationManager = new AnimationManager(this.options.animations);

    this.setupCanvas();
    this.startRenderLoop();
  }

  /**
   * Current zoom level
   */
  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    const clampedZoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, value));
    if (this._zoom !== clampedZoom) {
      this._zoom = clampedZoom;
      this.markDirty();
      this.emit('zoom', clampedZoom);
    }
  }

  /**
   * Horizontal offset (pan)
   */
  get offsetX(): number {
    return this._offsetX;
  }

  set offsetX(value: number) {
    if (this._offsetX !== value) {
      this._offsetX = value;
      this.markDirty();
      this.emit('pan', this._offsetX, this._offsetY);
    }
  }

  /**
   * Vertical offset (pan)
   */
  get offsetY(): number {
    return this._offsetY;
  }

  set offsetY(value: number) {
    if (this._offsetY !== value) {
      this._offsetY = value;
      this.markDirty();
      this.emit('pan', this._offsetX, this._offsetY);
    }
  }

  /**
   * Get viewport state
   */
  get viewport(): ViewportState {
    return {
      zoom: this._zoom,
      offsetX: this._offsetX,
      offsetY: this._offsetY,
    };
  }

  /**
   * Set viewport state
   */
  set viewport(state: ViewportState) {
    this._zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, state.zoom));
    this._offsetX = state.offsetX;
    this._offsetY = state.offsetY;
    this.markDirty();
    this.emit('zoom', this._zoom);
    this.emit('pan', this._offsetX, this._offsetY);
  }

  /**
   * All nodes in the diagram
   */
  get nodes(): ReadonlyMap<string, Node> {
    return this._nodes;
  }

  /**
   * All edges in the diagram
   */
  get edges(): ReadonlyMap<string, Edge> {
    return this._edges;
  }

  /**
   * All groups in the diagram
   */
  get groups(): ReadonlyMap<string, Group> {
    return this._groups;
  }

  /**
   * Canvas width in CSS pixels
   */
  get width(): number {
    return this.options.width;
  }

  /**
   * Canvas height in CSS pixels
   */
  get height(): number {
    return this.options.height;
  }

  /**
   * Snap-to-grid state
   */
  get snapToGrid(): boolean {
    return this.options.snapToGrid;
  }

  /**
   * Device pixel ratio used for rendering
   */
  get pixelRatio(): number {
    return this.devicePixelRatio;
  }

  /**
   * Access the underlying canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Access the rendering context (read-only usage)
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Set the StyleManager used for rendering
   */
  setStyleManager(styleManager: StyleManager | undefined): void {
    this.styleManager = styleManager;
    this.markDirty();
  }

  /**
   * Get current StyleManager
   */
  getStyleManager(): StyleManager | undefined {
    return this.styleManager;
  }

  /**
   * Access animation manager
   */
  getAnimationManager(): AnimationManager {
    return this.animationManager;
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.setupCanvas();
    this.markDirty();
  }

  /**
   * Register and install a plugin
   */
  use(plugin: DiagramPlugin): void {
    plugin.install(this);
    this.plugins.push(plugin);
  }

  /**
   * Enable built-in interaction handling
   */
  enableInteractions(options: Omit<InteractionManagerOptions, 'renderer'> = {}): InteractionManager {
    if (this.interactionManager) {
      return this.interactionManager;
    }
    this.interactionManager = new InteractionManager({ renderer: this, ...options });
    return this.interactionManager;
  }

  /**
   * Disable interaction handling
   */
  disableInteractions(): void {
    this.interactionManager?.destroy();
    this.interactionManager = null;
  }

  /**
   * Enable context menu handling
   */
  enableContextMenu(options: ConstructorParameters<typeof ContextMenuManager>[1]): ContextMenuManager {
    this.contextMenuManager?.destroy();
    this.contextMenuManager = new ContextMenuManager(this, options);
    return this.contextMenuManager;
  }

  /**
   * Disable context menu handling
   */
  disableContextMenu(): void {
    this.contextMenuManager?.destroy();
    this.contextMenuManager = null;
  }

  /**
   * Register an underlay renderer (called before elements)
   */
  addUnderlayRenderer(renderer: (ctx: CanvasRenderingContext2D) => void): () => void {
    this.underlayRenderers.add(renderer);
    this.markDirty();
    return () => {
      this.underlayRenderers.delete(renderer);
      this.markDirty();
    };
  }

  /**
   * Register an overlay renderer (called after main render)
   */
  addOverlayRenderer(renderer: (ctx: CanvasRenderingContext2D) => void): () => void {
    this.overlayRenderers.add(renderer);
    this.markDirty();
    return () => {
      this.overlayRenderers.delete(renderer);
      this.markDirty();
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.options.width;
    const scaleY = rect.height / this.options.height;
    const canvasX = (screenX - rect.left) / scaleX;
    const canvasY = (screenY - rect.top) / scaleY;
    const x = (canvasX - this._offsetX) / this._zoom;
    const y = (canvasY - this._offsetY) / this._zoom;
    return { x, y };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.options.width;
    const scaleY = rect.height / this.options.height;
    const x = (worldX * this._zoom + this._offsetX) * scaleX + rect.left;
    const y = (worldY * this._zoom + this._offsetY) * scaleY + rect.top;
    return { x, y };
  }

  /**
   * Add a node to the diagram
   */
  addNode(node: Node): void {
    node.setDirtyListener(() => this.markDirty());
    this._nodes.set(node.id, node);
    this.animationManager.registerEnter(node.id);
    this.markDirty();
    this.emit('nodeAdd', node);
  }

  /**
   * Remove a node from the diagram
   */
  removeNode(nodeId: string): boolean {
    const node = this._nodes.get(nodeId);
    if (node === undefined) {
      return false;
    }

    // Collect connected edges first to avoid modifying Map while iterating
    const edgesToRemove: string[] = [];
    for (const edge of this._edges.values()) {
      if (edge.from.nodeId === nodeId || edge.to.nodeId === nodeId) {
        edgesToRemove.push(edge.id);
      }
    }

    if (this.animationManager.enabled && !this.animationManager.isExiting(nodeId)) {
      for (const edgeId of edgesToRemove) {
        this.removeEdge(edgeId);
      }
      this.animationManager.registerExit(nodeId, () => {
        this.removeNodeImmediate(nodeId);
      });
      this.markDirty();
      return true;
    }

    return this.removeNodeImmediate(nodeId);
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): Node | undefined {
    return this._nodes.get(nodeId);
  }

  /**
   * Add an edge to the diagram
   */
  addEdge(edge: Edge): void {
    edge.setDirtyListener(() => this.markDirty());
    this._edges.set(edge.id, edge);
    this.animationManager.registerEnter(edge.id);
    this.markDirty();
    this.emit('edgeAdd', edge);
  }

  /**
   * Remove an edge from the diagram
   */
  removeEdge(edgeId: string): boolean {
    const edge = this._edges.get(edgeId);
    if (edge === undefined) {
      return false;
    }

    if (this.animationManager.enabled && !this.animationManager.isExiting(edgeId)) {
      this.animationManager.registerExit(edgeId, () => {
        this.removeEdgeImmediate(edgeId);
      });
      this.markDirty();
      return true;
    }

    return this.removeEdgeImmediate(edgeId);
  }

  private removeNodeImmediate(nodeId: string): boolean {
    const node = this._nodes.get(nodeId);
    if (node === undefined) {
      return false;
    }

    const edgesToRemove: string[] = [];
    for (const edge of this._edges.values()) {
      if (edge.from.nodeId === nodeId || edge.to.nodeId === nodeId) {
        edgesToRemove.push(edge.id);
      }
    }

    for (const edgeId of edgesToRemove) {
      this.removeEdgeImmediate(edgeId);
    }

    for (const group of this._groups.values()) {
      group.removeChild(nodeId);
    }

    this._nodes.delete(nodeId);
    node.setDirtyListener(undefined);
    this.markDirty();
    this.emit('nodeRemove', node);
    return true;
  }

  private removeEdgeImmediate(edgeId: string): boolean {
    const edge = this._edges.get(edgeId);
    if (edge === undefined) {
      return false;
    }

    this._edges.delete(edgeId);
    edge.setDirtyListener(undefined);
    this.markDirty();
    this.emit('edgeRemove', edge);
    return true;
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): Edge | undefined {
    return this._edges.get(edgeId);
  }

  /**
   * Add a group to the diagram
   */
  addGroup(group: Group): void {
    group.setDirtyListener(() => this.markDirty());
    this._groups.set(group.id, group);
    this.markDirty();
  }

  /**
   * Remove a group from the diagram
   */
  removeGroup(groupId: string): boolean {
    const group = this._groups.get(groupId);
    if (group === undefined) {
      return false;
    }
    this._groups.delete(groupId);
    group.setDirtyListener(undefined);
    this.markDirty();
    return true;
  }

  /**
   * Get a group by ID
   */
  getGroup(groupId: string): Group | undefined {
    return this._groups.get(groupId);
  }

  /**
   * Find element at a point (nodes, then edges, then groups)
   */
  getElementAtPoint(worldPoint: Point): Node | Edge | Group | undefined {
    // Check nodes first (front to back)
    const nodesArray = Array.from(this._nodes.values());
    for (let i = nodesArray.length - 1; i >= 0; i--) {
      const node = nodesArray[i]!;
      if (node.visible && node.hitTest(worldPoint)) {
        return node;
      }
    }

    // Check edges
    for (const edge of this._edges.values()) {
      if (!edge.visible) {
        continue;
      }

      const baseTolerance = Math.max((edge.style.strokeWidth ?? 2) * 2, 8);
      const tolerance = baseTolerance / Math.max(this._zoom, 0.0001);
      if (edge.hitTestWithTolerance(worldPoint, tolerance)) {
        return edge;
      }
    }

    // Check groups (back layer)
    for (const group of this._groups.values()) {
      if (group.visible && group.hitTest(worldPoint)) {
        return group;
      }
    }

    return undefined;
  }

  /**
   * Mark the diagram as needing re-render
   */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Force an immediate render
   */
  render(): void {
    this.renderFrame(performance.now());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._destroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.disableInteractions();
    this.disableContextMenu();
    for (const plugin of this.plugins) {
      plugin.destroy?.(this);
    }
    this.plugins = [];
    this.removeAllListeners();
    for (const node of this._nodes.values()) {
      node.setDirtyListener(undefined);
    }
    for (const edge of this._edges.values()) {
      edge.setDirtyListener(undefined);
    }
    for (const group of this._groups.values()) {
      group.setDirtyListener(undefined);
    }
    this._nodes.clear();
    this._edges.clear();
    this._groups.clear();
  }

  private setupCanvas(): void {
    const { width, height } = this.options;
    this.devicePixelRatio = this.options.retina ? window.devicePixelRatio || 1 : 1;

    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Set actual size for retina displays
    this.canvas.width = width * this.devicePixelRatio;
    this.canvas.height = height * this.devicePixelRatio;

    // Scale context for retina
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
  }

  private resolveCanvas(canvas: HTMLCanvasElement | string): HTMLCanvasElement {
    if (typeof canvas !== 'string') {
      return canvas;
    }

    const element = document.querySelector(canvas);
    if (element instanceof HTMLCanvasElement) {
      return element;
    }

    throw new Error(`Canvas element not found for selector: ${canvas}`);
  }

  private startRenderLoop(): void {
    const loop = (): void => {
      if (this._destroyed) {
        return;
      }

      const now = performance.now();
      const animationChanged = this.animationManager.update(now);
      if (animationChanged || this.animationManager.hasActive()) {
        this._dirty = true;
      }

      if (this._dirty) {
        this.renderFrame(now);
        this._dirty = false;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private renderFrame(now: number): void {
    this.frameTime = now;
    const ctx = this.ctx;
    const { width, height, backgroundColor } = this.options;

    // Reset transform for clearing
    ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Apply viewport transform
    ctx.translate(this._offsetX, this._offsetY);
    ctx.scale(this._zoom, this._zoom);

    for (const underlayRenderer of this.underlayRenderers) {
      underlayRenderer(ctx);
    }

    // Apply styles from StyleManager before rendering
    if (this.styleManager) {
    applyStyleManagerToElements(
      this.styleManager,
      this._groups.values(),
      this._edges.values(),
      this._nodes.values()
    );
    }

    // Update group bounds before rendering
    for (const group of this._groups.values()) {
      group.recalculateBounds();
    }

    // Render groups (back layer)
    for (const group of this._groups.values()) {
      if (group.visible) {
        this.renderElementWithAnimation(ctx, group, () => group.render(ctx));
        group.clearDirty();
      }
    }

    // Sync edge endpoints with node positions
    this.updateEdgeEndpoints();

    // Render edges (middle layer)
    for (const edge of this._edges.values()) {
      if (edge.visible) {
        this.renderElementWithAnimation(ctx, edge, () => edge.render(ctx));
        edge.clearDirty();
      }
    }

    // Render nodes (front layer)
    for (const node of this._nodes.values()) {
      if (node.visible) {
        this.renderElementWithAnimation(ctx, node, () => node.render(ctx));
        node.clearDirty();
      }
    }

    // Render edge handles (topmost layer, so they're above nodes)
    for (const edge of this._edges.values()) {
      if (edge.visible) {
        edge.renderHandles(ctx);
      }
    }

    for (const overlayRenderer of this.overlayRenderers) {
      overlayRenderer(ctx);
    }

    this.renderScrollbars(ctx);
    this.emit('render');
  }

  private renderElementWithAnimation(
    ctx: CanvasRenderingContext2D,
    element: { id: string; getBounds: () => Bounds },
    renderFn: () => void
  ): void {
    if (!this.animationManager.enabled) {
      renderFn();
      return;
    }

    const state = this.animationManager.getState(element.id, this.frameTime);
    if (state.opacity <= 0) {
      return;
    }

    if (state.opacity !== 1 || state.scale !== 1) {
      const bounds = element.getBounds();
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;

      ctx.save();
      ctx.globalAlpha *= state.opacity;
      if (state.scale !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(state.scale, state.scale);
        ctx.translate(-cx, -cy);
      }
      renderFn();
      ctx.restore();
      return;
    }

    renderFn();
  }

  private updateEdgeEndpoints(): void {
    for (const edge of this._edges.values()) {
      if (!edge.autoUpdateEndpoints) {
        continue;
      }

      const fromNode = this._nodes.get(edge.from.nodeId);
      const toNode = this._nodes.get(edge.to.nodeId);
      if (fromNode === undefined || toNode === undefined) {
        continue;
      }

      if (edge.lockAnchors) {
        if (!edge.from.portId) {
          const anchor = fromNode.getNearestAnchor(toNode.getCenter());
          if (anchor) {
            edge.from = { ...edge.from, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
          }
        }
        if (!edge.to.portId) {
          const anchor = toNode.getNearestAnchor(fromNode.getCenter());
          if (anchor) {
            edge.to = { ...edge.to, portId: `${ANCHOR_PORT_PREFIX}${anchor.id}` };
          }
        }
      }

      let fromPoint = fromNode.getConnectionPoint(toNode.getCenter());
      let toPoint = toNode.getConnectionPoint(fromNode.getCenter());
      let fromDir: string | undefined;
      let toDir: string | undefined;

      if (edge.lockAnchors && edge.from.portId?.startsWith(ANCHOR_PORT_PREFIX)) {
        const anchorId = edge.from.portId.slice(ANCHOR_PORT_PREFIX.length);
        const anchorPoint = fromNode.getAnchorPointById(anchorId);
        if (anchorPoint) {
          fromPoint = anchorPoint;
          // Extract direction from anchor ID (format: "side:index")
          fromDir = anchorId.split(':')[0];
        }
      }

      if (edge.lockAnchors && edge.to.portId?.startsWith(ANCHOR_PORT_PREFIX)) {
        const anchorId = edge.to.portId.slice(ANCHOR_PORT_PREFIX.length);
        const anchorPoint = toNode.getAnchorPointById(anchorId);
        if (anchorPoint) {
          toPoint = anchorPoint;
          // Extract direction from anchor ID (format: "side:index")
          toDir = anchorId.split(':')[0];
        }
      }
      edge.updateEndpoints(fromPoint, toPoint, fromDir, toDir);
    }
  }

  private renderScrollbars(ctx: CanvasRenderingContext2D): void {
    if (!this.options.scrollbarOverlay) {
      return;
    }

    const rawContentBounds = this.getContentBounds();
    if (!rawContentBounds) {
      return;
    }

    const viewportBounds = this.getViewportBounds();

    // Union of content and viewport to get the full scrollable area
    const unionMinX = Math.min(rawContentBounds.x, viewportBounds.x);
    const unionMinY = Math.min(rawContentBounds.y, viewportBounds.y);
    const unionMaxX = Math.max(rawContentBounds.x + rawContentBounds.width, viewportBounds.x + viewportBounds.width);
    const unionMaxY = Math.max(rawContentBounds.y + rawContentBounds.height, viewportBounds.y + viewportBounds.height);
    const contentBounds = { x: unionMinX, y: unionMinY, width: unionMaxX - unionMinX, height: unionMaxY - unionMinY };

    const contentWidth = Math.max(contentBounds.width, 1);
    const contentHeight = Math.max(contentBounds.height, 1);
    const showHorizontal = contentWidth > viewportBounds.width + 0.01;
    const showVertical = contentHeight > viewportBounds.height + 0.01;

    if (!showHorizontal && !showVertical) {
      return;
    }

    const { width, height } = this.options;
    const padding = 6;
    const thickness = 6;
    const spacing = 4;
    const minThumbLength = 24;
    const trackRadius = thickness / 2;

    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }

    const horizontalTrackLength = Math.max(
      0,
      availableWidth - (showVertical ? thickness + spacing : 0)
    );
    const verticalTrackLength = Math.max(
      0,
      availableHeight - (showHorizontal ? thickness + spacing : 0)
    );

    const horizontalTrackX = padding;
    const horizontalTrackY = height - padding - thickness;
    const verticalTrackX = width - padding - thickness;
    const verticalTrackY = padding;

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number): void => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    ctx.save();
    ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    ctx.globalAlpha = 0.75;

    const trackColor = 'rgba(15, 23, 42, 0.16)';
    const thumbColor = 'rgba(51, 65, 85, 0.7)';

    if (showHorizontal && horizontalTrackLength > 0) {
      const maxScrollX = Math.max(0, contentWidth - viewportBounds.width);
      const scrollX = Math.min(
        Math.max(viewportBounds.x - contentBounds.x, 0),
        maxScrollX
      );
      const ratioX = viewportBounds.width / contentWidth;
      const thumbLength = Math.min(
        horizontalTrackLength,
        Math.max(minThumbLength, horizontalTrackLength * ratioX)
      );
      const travel = Math.max(0, horizontalTrackLength - thumbLength);
      const thumbOffset = maxScrollX > 0 ? (scrollX / maxScrollX) * travel : 0;

      ctx.fillStyle = trackColor;
      drawRoundedRect(horizontalTrackX, horizontalTrackY, horizontalTrackLength, thickness, trackRadius);
      ctx.fill();

      ctx.fillStyle = thumbColor;
      drawRoundedRect(
        horizontalTrackX + thumbOffset,
        horizontalTrackY,
        thumbLength,
        thickness,
        trackRadius
      );
      ctx.fill();
    }

    if (showVertical && verticalTrackLength > 0) {
      const maxScrollY = Math.max(0, contentHeight - viewportBounds.height);
      const scrollY = Math.min(
        Math.max(viewportBounds.y - contentBounds.y, 0),
        maxScrollY
      );
      const ratioY = viewportBounds.height / contentHeight;
      const thumbLength = Math.min(
        verticalTrackLength,
        Math.max(minThumbLength, verticalTrackLength * ratioY)
      );
      const travel = Math.max(0, verticalTrackLength - thumbLength);
      const thumbOffset = maxScrollY > 0 ? (scrollY / maxScrollY) * travel : 0;

      ctx.fillStyle = trackColor;
      drawRoundedRect(verticalTrackX, verticalTrackY, thickness, verticalTrackLength, trackRadius);
      ctx.fill();

      ctx.fillStyle = thumbColor;
      drawRoundedRect(
        verticalTrackX,
        verticalTrackY + thumbOffset,
        thickness,
        thumbLength,
        trackRadius
      );
      ctx.fill();
    }

    ctx.restore();
  }

  private getContentBounds(): Bounds | null {
    return getContentBounds({
      nodes: this._nodes.values(),
      edges: this._edges.values(),
      groups: this._groups.values(),
    });
  }

  private getViewportBounds(): Bounds {
    return {
      x: -this._offsetX / this._zoom,
      y: -this._offsetY / this._zoom,
      width: this.options.width / this._zoom,
      height: this.options.height / this._zoom,
    };
  }

}
