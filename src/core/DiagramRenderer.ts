import { EventEmitter } from '@/events/EventEmitter';
import type { StyleManager } from '@/styles/StyleManager';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { PathObstacle } from '@/elements/paths';
import type { Bounds, DiagramOptions, Point, ScrollbarOptions, ViewportState } from '@/types';
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

const DEFAULT_SCROLLBAR_OPTIONS: ScrollbarOptions = {
  enabled: true,
  autoHide: false,
  autoHideDelay: 1200,
  fadeDuration: 220,
  thickness: 6,
  hoverThickness: 8,
  minThumbLength: 24,
  hitAreaPadding: 4,
  pageScrollRatio: 0.8,
  trackColor: '',
  thumbColor: '',
  thumbHoverColor: '',
  thumbActiveColor: '',
};

const DEFAULT_OPTIONS: Required<Omit<DiagramOptions, 'scrollbar'>> = {
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

interface OverlayDragPlugin extends DiagramPlugin {
  beginOverlayDrag?(renderer: DiagramRenderer, screenX: number, screenY: number): unknown | null;
  updateOverlayDrag?(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number,
    payload: unknown
  ): boolean;
  endOverlayDrag?(renderer: DiagramRenderer, payload: unknown): void;
}

export interface OverlayDragSession {
  plugin: OverlayDragPlugin;
  payload: unknown;
}

type ScrollbarAxis = 'horizontal' | 'vertical';

interface ScrollbarTrackMetrics {
  trackX: number;
  trackY: number;
  trackLength: number;
  thickness: number;
  thumbLength: number;
  thumbOffset: number;
  maxScroll: number;
}

interface ScrollbarMetrics {
  contentBounds: Bounds;
  viewportBounds: Bounds;
  thickness: number;
  horizontal: ScrollbarTrackMetrics | null;
  vertical: ScrollbarTrackMetrics | null;
}

/**
 * Main diagram renderer class
 * Manages canvas, coordinate system, and render loop
 */
export class DiagramRenderer extends EventEmitter<DiagramEvents> {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: Required<Omit<DiagramOptions, 'scrollbar'>>;
  private readonly scrollbar: ScrollbarOptions;
  private plugins: DiagramPlugin[] = [];
  private styleManager?: StyleManager;
  private underlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private overlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private interactionManager: InteractionManager | null = null;
  private contextMenuManager: ContextMenuManager | null = null;
  private readonly animationManager: AnimationManager;
  private frameTime = 0;
  private scrollbarHoveredAxis: ScrollbarAxis | null = null;
  private scrollbarActiveAxis: ScrollbarAxis | null = null;
  private scrollbarLastInteractionAt = 0;
  private lastScrollbarAlpha = -1;

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
    this.scrollbar = this.resolveScrollbarOptions(options);

    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    this.devicePixelRatio = this.options.retina ? window.devicePixelRatio || 1 : 1;
    this._zoom = this.options.initialZoom;
    this.animationManager = new AnimationManager(this.options.animations);
    this.scrollbarLastInteractionAt = performance.now();

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
      this.scrollbarLastInteractionAt = performance.now();
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
      this.scrollbarLastInteractionAt = performance.now();
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
      this.scrollbarLastInteractionAt = performance.now();
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
      if (this.scrollbar.enabled && this.scrollbar.autoHide) {
        const alpha = this.getScrollbarAlpha(now);
        if (Math.abs(alpha - this.lastScrollbarAlpha) > 0.001) {
          this._dirty = true;
          this.lastScrollbarAlpha = alpha;
        }
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

    // Render nodes (middle layer)
    for (const node of this._nodes.values()) {
      if (node.visible) {
        this.renderElementWithAnimation(ctx, node, () => node.render(ctx));
        node.clearDirty();
      }
    }

    // Render edges above nodes so lines/markers stay visible over figures.
    for (const edge of this._edges.values()) {
      if (edge.visible) {
        this.renderElementWithAnimation(ctx, edge, () => edge.render(ctx));
        edge.clearDirty();
      }
    }

    // Render edge handles (topmost layer)
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
      const obstacles: PathObstacle[] = Array.from(this._nodes.values())
        .map((node) => ({
          x: node.x - 8,
          y: node.y - 8,
          width: node.width + 16,
          height: node.height + 16,
          role:
            node.id === edge.from.nodeId
              ? ('source' as const)
              : node.id === edge.to.nodeId
                ? ('target' as const)
                : ('other' as const),
        }));

      edge.updateEndpoints(fromPoint, toPoint, fromDir, toDir, { obstacles });
    }
  }

  private renderScrollbars(ctx: CanvasRenderingContext2D): void {
    const metrics = this.getScrollbarMetrics();
    if (!metrics) {
      return;
    }

    const alpha = this.getScrollbarAlpha(this.frameTime);
    this.lastScrollbarAlpha = alpha;
    if (alpha <= 0.001) {
      return;
    }

    const colors = this.resolveScrollbarColors();
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
    ctx.globalAlpha = alpha;

    if (metrics.horizontal) {
      const isHovered = this.scrollbarHoveredAxis === 'horizontal';
      const isActive = this.scrollbarActiveAxis === 'horizontal';
      const thickness = isHovered || isActive ? this.scrollbar.hoverThickness : this.scrollbar.thickness;
      const trackY = metrics.horizontal.trackY + (metrics.horizontal.thickness - thickness) / 2;
      const radius = thickness / 2;
      const thumbColor = isActive
        ? colors.thumbActive
        : isHovered
          ? colors.thumbHover
          : colors.thumb;

      ctx.fillStyle = colors.track;
      drawRoundedRect(
        metrics.horizontal.trackX,
        trackY,
        metrics.horizontal.trackLength,
        thickness,
        radius
      );
      ctx.fill();

      ctx.fillStyle = thumbColor;
      drawRoundedRect(
        metrics.horizontal.trackX + metrics.horizontal.thumbOffset,
        trackY,
        metrics.horizontal.thumbLength,
        thickness,
        radius
      );
      ctx.fill();
    }

    if (metrics.vertical) {
      const isHovered = this.scrollbarHoveredAxis === 'vertical';
      const isActive = this.scrollbarActiveAxis === 'vertical';
      const thickness = isHovered || isActive ? this.scrollbar.hoverThickness : this.scrollbar.thickness;
      const trackX = metrics.vertical.trackX + (metrics.vertical.thickness - thickness) / 2;
      const radius = thickness / 2;
      const thumbColor = isActive
        ? colors.thumbActive
        : isHovered
          ? colors.thumbHover
          : colors.thumb;

      ctx.fillStyle = colors.track;
      drawRoundedRect(
        trackX,
        metrics.vertical.trackY,
        thickness,
        metrics.vertical.trackLength,
        radius
      );
      ctx.fill();

      ctx.fillStyle = thumbColor;
      drawRoundedRect(
        trackX,
        metrics.vertical.trackY + metrics.vertical.thumbOffset,
        thickness,
        metrics.vertical.thumbLength,
        radius
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

  notifyScrollbarInteraction(): void {
    this.scrollbarLastInteractionAt = performance.now();
    this.markDirty();
  }

  setScrollbarActiveAxis(axis: ScrollbarAxis | null): void {
    if (this.scrollbarActiveAxis === axis) {
      return;
    }
    this.scrollbarActiveAxis = axis;
    if (axis !== null) {
      this.notifyScrollbarInteraction();
    } else {
      this.markDirty();
    }
  }

  updateScrollbarHover(screenX: number, screenY: number): boolean {
    const axis = this.hitTestScrollbarArea(screenX, screenY);
    if (this.scrollbarHoveredAxis !== axis) {
      this.scrollbarHoveredAxis = axis;
      this.markDirty();
      if (axis !== null) {
        this.notifyScrollbarInteraction();
      }
    }
    return axis !== null;
  }

  clearScrollbarHover(): void {
    if (this.scrollbarHoveredAxis !== null) {
      this.scrollbarHoveredAxis = null;
      this.markDirty();
    }
  }

  hitTestScrollbarThumb(
    screenX: number,
    screenY: number
  ): { axis: ScrollbarAxis; pointerOffset: number } | null {
    const metrics = this.getScrollbarMetrics();
    if (!metrics) {
      return null;
    }

    const localPoint = this.screenToCanvas(screenX, screenY);
    if (!localPoint) {
      return null;
    }

    const { x, y } = localPoint;
    const hitPadding = this.scrollbar.hitAreaPadding;

    if (metrics.horizontal) {
      const thumbStartX = metrics.horizontal.trackX + metrics.horizontal.thumbOffset;
      if (
        x >= thumbStartX - hitPadding &&
        x <= thumbStartX + metrics.horizontal.thumbLength + hitPadding &&
        y >= metrics.horizontal.trackY - hitPadding &&
        y <= metrics.horizontal.trackY + metrics.horizontal.thickness + hitPadding
      ) {
        return {
          axis: 'horizontal',
          pointerOffset: x - thumbStartX,
        };
      }
    }

    if (metrics.vertical) {
      const thumbStartY = metrics.vertical.trackY + metrics.vertical.thumbOffset;
      if (
        x >= metrics.vertical.trackX - hitPadding &&
        x <= metrics.vertical.trackX + metrics.vertical.thickness + hitPadding &&
        y >= thumbStartY - hitPadding &&
        y <= thumbStartY + metrics.vertical.thumbLength + hitPadding
      ) {
        return {
          axis: 'vertical',
          pointerOffset: y - thumbStartY,
        };
      }
    }

    return null;
  }

  dragScrollbarThumb(
    axis: ScrollbarAxis,
    screenX: number,
    screenY: number,
    pointerOffset: number
  ): boolean {
    const metrics = this.getScrollbarMetrics();
    if (!metrics) {
      return false;
    }

    const localPoint = this.screenToCanvas(screenX, screenY);
    if (!localPoint) {
      return false;
    }

    if (axis === 'horizontal' && metrics.horizontal) {
      const travel = Math.max(0, metrics.horizontal.trackLength - metrics.horizontal.thumbLength);
      const desiredThumbOffset = localPoint.x - metrics.horizontal.trackX - pointerOffset;
      const clampedThumbOffset = Math.min(Math.max(desiredThumbOffset, 0), travel);
      const scrollX =
        travel > 0 && metrics.horizontal.maxScroll > 0
          ? (clampedThumbOffset / travel) * metrics.horizontal.maxScroll
          : 0;
      const viewportX = metrics.contentBounds.x + scrollX;
      this.offsetX = -viewportX * this._zoom;
      this.notifyScrollbarInteraction();
      return true;
    }

    if (axis === 'vertical' && metrics.vertical) {
      const travel = Math.max(0, metrics.vertical.trackLength - metrics.vertical.thumbLength);
      const desiredThumbOffset = localPoint.y - metrics.vertical.trackY - pointerOffset;
      const clampedThumbOffset = Math.min(Math.max(desiredThumbOffset, 0), travel);
      const scrollY =
        travel > 0 && metrics.vertical.maxScroll > 0
          ? (clampedThumbOffset / travel) * metrics.vertical.maxScroll
          : 0;
      const viewportY = metrics.contentBounds.y + scrollY;
      this.offsetY = -viewportY * this._zoom;
      this.notifyScrollbarInteraction();
      return true;
    }

    return false;
  }

  clickScrollbarTrack(screenX: number, screenY: number): boolean {
    const metrics = this.getScrollbarMetrics();
    if (!metrics) {
      return false;
    }
    const localPoint = this.screenToCanvas(screenX, screenY);
    if (!localPoint) {
      return false;
    }

    if (metrics.horizontal) {
      const { trackX, trackY, trackLength, thumbOffset, thumbLength, maxScroll } = metrics.horizontal;
      const inTrack =
        localPoint.x >= trackX &&
        localPoint.x <= trackX + trackLength &&
        localPoint.y >= trackY &&
        localPoint.y <= trackY + metrics.horizontal.thickness;
      if (inTrack) {
        const thumbStart = trackX + thumbOffset;
        const thumbEnd = thumbStart + thumbLength;
        if (localPoint.x < thumbStart || localPoint.x > thumbEnd) {
          const direction = localPoint.x < thumbStart ? -1 : 1;
          const step = metrics.viewportBounds.width * this.scrollbar.pageScrollRatio * direction;
          const currentScrollX = Math.min(
            Math.max(metrics.viewportBounds.x - metrics.contentBounds.x, 0),
            maxScroll
          );
          const nextScrollX = Math.min(Math.max(currentScrollX + step, 0), maxScroll);
          const viewportX = metrics.contentBounds.x + nextScrollX;
          this.offsetX = -viewportX * this.zoom;
          this.notifyScrollbarInteraction();
          return true;
        }
      }
    }

    if (metrics.vertical) {
      const { trackX, trackY, trackLength, thumbOffset, thumbLength, maxScroll } = metrics.vertical;
      const inTrack =
        localPoint.x >= trackX &&
        localPoint.x <= trackX + metrics.vertical.thickness &&
        localPoint.y >= trackY &&
        localPoint.y <= trackY + trackLength;
      if (inTrack) {
        const thumbStart = trackY + thumbOffset;
        const thumbEnd = thumbStart + thumbLength;
        if (localPoint.y < thumbStart || localPoint.y > thumbEnd) {
          const direction = localPoint.y < thumbStart ? -1 : 1;
          const step = metrics.viewportBounds.height * this.scrollbar.pageScrollRatio * direction;
          const currentScrollY = Math.min(
            Math.max(metrics.viewportBounds.y - metrics.contentBounds.y, 0),
            maxScroll
          );
          const nextScrollY = Math.min(Math.max(currentScrollY + step, 0), maxScroll);
          const viewportY = metrics.contentBounds.y + nextScrollY;
          this.offsetY = -viewportY * this.zoom;
          this.notifyScrollbarInteraction();
          return true;
        }
      }
    }

    return false;
  }

  scrollViewportBy(screenDx: number, screenDy: number): boolean {
    const scrollState = this.getScrollState();
    if (!scrollState) {
      return false;
    }
    const worldDx = screenDx / this.zoom;
    const worldDy = screenDy / this.zoom;
    const currentViewportX = scrollState.viewportBounds.x;
    const currentViewportY = scrollState.viewportBounds.y;
    const maxScrollX = Math.max(0, scrollState.contentBounds.width - scrollState.viewportBounds.width);
    const maxScrollY = Math.max(0, scrollState.contentBounds.height - scrollState.viewportBounds.height);
    const nextViewportX = Math.min(
      Math.max(currentViewportX + worldDx, scrollState.contentBounds.x),
      scrollState.contentBounds.x + maxScrollX
    );
    const nextViewportY = Math.min(
      Math.max(currentViewportY + worldDy, scrollState.contentBounds.y),
      scrollState.contentBounds.y + maxScrollY
    );

    this.offsetX = -nextViewportX * this.zoom;
    this.offsetY = -nextViewportY * this.zoom;
    this.notifyScrollbarInteraction();
    return true;
  }

  scrollViewportToStart(): boolean {
    const scrollState = this.getScrollState();
    if (!scrollState) {
      return false;
    }
    this.offsetX = -scrollState.contentBounds.x * this.zoom;
    this.offsetY = -scrollState.contentBounds.y * this.zoom;
    this.notifyScrollbarInteraction();
    return true;
  }

  scrollViewportToEnd(): boolean {
    const scrollState = this.getScrollState();
    if (!scrollState) {
      return false;
    }
    const maxScrollX = Math.max(0, scrollState.contentBounds.width - scrollState.viewportBounds.width);
    const maxScrollY = Math.max(0, scrollState.contentBounds.height - scrollState.viewportBounds.height);
    const targetViewportX = scrollState.contentBounds.x + maxScrollX;
    const targetViewportY = scrollState.contentBounds.y + maxScrollY;
    this.offsetX = -targetViewportX * this.zoom;
    this.offsetY = -targetViewportY * this.zoom;
    this.notifyScrollbarInteraction();
    return true;
  }

  beginOverlayDrag(screenX: number, screenY: number): OverlayDragSession | null {
    for (const plugin of this.plugins) {
      const interactivePlugin = plugin as OverlayDragPlugin;
      if (!interactivePlugin.beginOverlayDrag) {
        continue;
      }
      const payload = interactivePlugin.beginOverlayDrag(this, screenX, screenY);
      if (payload !== null && payload !== undefined) {
        return { plugin: interactivePlugin, payload };
      }
    }
    return null;
  }

  updateOverlayDrag(session: OverlayDragSession, screenX: number, screenY: number): boolean {
    return session.plugin.updateOverlayDrag?.(this, screenX, screenY, session.payload) ?? false;
  }

  endOverlayDrag(session: OverlayDragSession): void {
    session.plugin.endOverlayDrag?.(this, session.payload);
  }

  screenToCanvas(screenX: number, screenY: number): Point | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const scaleX = rect.width / this.options.width;
    const scaleY = rect.height / this.options.height;
    return {
      x: (screenX - rect.left) / scaleX,
      y: (screenY - rect.top) / scaleY,
    };
  }

  private getScrollbarMetrics(): ScrollbarMetrics | null {
    if (!this.scrollbar.enabled) {
      return null;
    }

    const rawContentBounds = this.getContentBounds();
    if (!rawContentBounds) {
      return null;
    }

    const viewportBounds = this.getViewportBounds();
    const unionMinX = Math.min(rawContentBounds.x, viewportBounds.x);
    const unionMinY = Math.min(rawContentBounds.y, viewportBounds.y);
    const unionMaxX = Math.max(rawContentBounds.x + rawContentBounds.width, viewportBounds.x + viewportBounds.width);
    const unionMaxY = Math.max(rawContentBounds.y + rawContentBounds.height, viewportBounds.y + viewportBounds.height);
    const contentBounds = {
      x: unionMinX,
      y: unionMinY,
      width: unionMaxX - unionMinX,
      height: unionMaxY - unionMinY,
    };

    const contentWidth = Math.max(contentBounds.width, 1);
    const contentHeight = Math.max(contentBounds.height, 1);
    const showHorizontal = contentWidth > viewportBounds.width + 0.01;
    const showVertical = contentHeight > viewportBounds.height + 0.01;
    if (!showHorizontal && !showVertical) {
      return null;
    }

    const { width, height } = this.options;
    const padding = 6;
    const thickness = this.scrollbar.thickness;
    const spacing = 4;
    const minThumbLength = this.scrollbar.minThumbLength;

    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return null;
    }

    const horizontalTrackLength = Math.max(0, availableWidth - (showVertical ? thickness + spacing : 0));
    const verticalTrackLength = Math.max(0, availableHeight - (showHorizontal ? thickness + spacing : 0));

    const horizontalTrackX = padding;
    const horizontalTrackY = height - padding - thickness;
    const verticalTrackX = width - padding - thickness;
    const verticalTrackY = padding;

    let horizontal: ScrollbarTrackMetrics | null = null;
    if (showHorizontal && horizontalTrackLength > 0) {
      const maxScrollX = Math.max(0, contentWidth - viewportBounds.width);
      const scrollX = Math.min(Math.max(viewportBounds.x - contentBounds.x, 0), maxScrollX);
      const ratioX = viewportBounds.width / contentWidth;
      const thumbLength = Math.min(horizontalTrackLength, Math.max(minThumbLength, horizontalTrackLength * ratioX));
      const travel = Math.max(0, horizontalTrackLength - thumbLength);
      const thumbOffset = maxScrollX > 0 ? (scrollX / maxScrollX) * travel : 0;
      horizontal = {
        trackX: horizontalTrackX,
        trackY: horizontalTrackY,
        trackLength: horizontalTrackLength,
        thickness,
        thumbLength,
        thumbOffset,
        maxScroll: maxScrollX,
      };
    }

    let vertical: ScrollbarTrackMetrics | null = null;
    if (showVertical && verticalTrackLength > 0) {
      const maxScrollY = Math.max(0, contentHeight - viewportBounds.height);
      const scrollY = Math.min(Math.max(viewportBounds.y - contentBounds.y, 0), maxScrollY);
      const ratioY = viewportBounds.height / contentHeight;
      const thumbLength = Math.min(verticalTrackLength, Math.max(minThumbLength, verticalTrackLength * ratioY));
      const travel = Math.max(0, verticalTrackLength - thumbLength);
      const thumbOffset = maxScrollY > 0 ? (scrollY / maxScrollY) * travel : 0;
      vertical = {
        trackX: verticalTrackX,
        trackY: verticalTrackY,
        trackLength: verticalTrackLength,
        thickness,
        thumbLength,
        thumbOffset,
        maxScroll: maxScrollY,
      };
    }

    if (!horizontal && !vertical) {
      return null;
    }

    return {
      contentBounds,
      viewportBounds,
      thickness: this.scrollbar.thickness,
      horizontal,
      vertical,
    };
  }

  private resolveScrollbarOptions(options: DiagramOptions): ScrollbarOptions {
    const fallbackEnabled = options.scrollbarOverlay ?? DEFAULT_SCROLLBAR_OPTIONS.enabled;
    const resolved: ScrollbarOptions = {
      ...DEFAULT_SCROLLBAR_OPTIONS,
      enabled: fallbackEnabled,
    };
    if (typeof options.scrollbar === 'boolean') {
      resolved.enabled = options.scrollbar;
      return resolved;
    }
    if (options.scrollbar) {
      return { ...resolved, ...options.scrollbar };
    }
    return resolved;
  }

  private resolveScrollbarColors(): {
    track: string;
    thumb: string;
    thumbHover: string;
    thumbActive: string;
  } {
    const isDarkTheme = this.styleManager?.theme.name === 'dark';
    const fallback = isDarkTheme
      ? {
          track: 'rgba(148, 163, 184, 0.22)',
          thumb: 'rgba(226, 232, 240, 0.68)',
          thumbHover: 'rgba(226, 232, 240, 0.86)',
          thumbActive: 'rgba(248, 250, 252, 0.96)',
        }
      : {
          track: 'rgba(15, 23, 42, 0.16)',
          thumb: 'rgba(51, 65, 85, 0.7)',
          thumbHover: 'rgba(30, 41, 59, 0.82)',
          thumbActive: 'rgba(15, 23, 42, 0.9)',
        };

    return {
      track: this.scrollbar.trackColor || fallback.track,
      thumb: this.scrollbar.thumbColor || fallback.thumb,
      thumbHover: this.scrollbar.thumbHoverColor || fallback.thumbHover,
      thumbActive: this.scrollbar.thumbActiveColor || fallback.thumbActive,
    };
  }

  private getScrollbarAlpha(now: number): number {
    if (!this.scrollbar.autoHide) {
      return 1;
    }
    if (this.scrollbarActiveAxis !== null || this.scrollbarHoveredAxis !== null) {
      return 1;
    }
    const elapsed = now - this.scrollbarLastInteractionAt;
    if (elapsed <= this.scrollbar.autoHideDelay) {
      return 1;
    }
    if (this.scrollbar.fadeDuration <= 0) {
      return 0;
    }
    const fadeProgress = (elapsed - this.scrollbar.autoHideDelay) / this.scrollbar.fadeDuration;
    return Math.max(0, 1 - fadeProgress);
  }

  private hitTestScrollbarArea(screenX: number, screenY: number): ScrollbarAxis | null {
    const metrics = this.getScrollbarMetrics();
    if (!metrics) {
      return null;
    }
    const localPoint = this.screenToCanvas(screenX, screenY);
    if (!localPoint) {
      return null;
    }
    const hitPadding = this.scrollbar.hitAreaPadding;

    if (metrics.horizontal) {
      const inHorizontalTrack =
        localPoint.x >= metrics.horizontal.trackX - hitPadding &&
        localPoint.x <= metrics.horizontal.trackX + metrics.horizontal.trackLength + hitPadding &&
        localPoint.y >= metrics.horizontal.trackY - hitPadding &&
        localPoint.y <= metrics.horizontal.trackY + metrics.horizontal.thickness + hitPadding;
      if (inHorizontalTrack) {
        return 'horizontal';
      }
    }

    if (metrics.vertical) {
      const inVerticalTrack =
        localPoint.x >= metrics.vertical.trackX - hitPadding &&
        localPoint.x <= metrics.vertical.trackX + metrics.vertical.thickness + hitPadding &&
        localPoint.y >= metrics.vertical.trackY - hitPadding &&
        localPoint.y <= metrics.vertical.trackY + metrics.vertical.trackLength + hitPadding;
      if (inVerticalTrack) {
        return 'vertical';
      }
    }
    return null;
  }

  private getScrollState(): { contentBounds: Bounds; viewportBounds: Bounds } | null {
    const rawContentBounds = this.getContentBounds();
    if (!rawContentBounds) {
      return null;
    }
    const viewportBounds = this.getViewportBounds();
    const unionMinX = Math.min(rawContentBounds.x, viewportBounds.x);
    const unionMinY = Math.min(rawContentBounds.y, viewportBounds.y);
    const unionMaxX = Math.max(
      rawContentBounds.x + rawContentBounds.width,
      viewportBounds.x + viewportBounds.width
    );
    const unionMaxY = Math.max(
      rawContentBounds.y + rawContentBounds.height,
      viewportBounds.y + viewportBounds.height
    );
    return {
      contentBounds: {
        x: unionMinX,
        y: unionMinY,
        width: unionMaxX - unionMinX,
        height: unionMaxY - unionMinY,
      },
      viewportBounds,
    };
  }

}
