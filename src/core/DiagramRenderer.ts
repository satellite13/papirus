import { EventEmitter } from '@/events/EventEmitter';
import type { StyleManager } from '@/styles/StyleManager';
import type { Node } from '@/elements/Node';
import type { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { PathObstacle } from '@/elements/paths';
import type { Bounds, DiagramOptions, Point, ViewportState } from '@/types';
import { InteractionManager } from './InteractionManager';
import type { InteractionManagerOptions } from './InteractionManager';
import { applyStyleManagerToElements } from '@/utils/style';
import { getContentBounds } from '@/utils/contentBounds';
import { rectsIntersect } from '@/utils/geometry';
import { AnimationManager } from './AnimationManager';
import { ContextMenuManager } from './ContextMenuManager';
import { EdgeEndpointUpdater } from './EdgeEndpointUpdater';
import { ScrollbarController } from './ScrollbarController';
import type { ScrollbarAxis } from './ScrollbarController';
import type { DiagramSurface, OverlayDragSession } from './DiagramSurface';

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
  nodeBadgeClick: [nodeId: string, badgeId: string];
  componentClick: [
    nodeId: string,
    component: import('@/elements/composite/CComponent').CComponent,
    point: Point,
  ];
}

export interface DiagramPlugin {
  name?: string;
  install(renderer: DiagramRenderer): void;
  destroy?(renderer: DiagramRenderer): void;
}

/** Extra CSS pixels around the viewport so labels and markers are not clipped by culling. */
const VIEWPORT_CULL_PAD_PX = 48;

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
  beginOverlayDrag?(renderer: DiagramRenderer, screenX: number, screenY: number): unknown;
  updateOverlayDrag?(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number,
    payload: unknown
  ): boolean;
  endOverlayDrag?(renderer: DiagramRenderer, payload: unknown): void;
}

/** Оверлей, который перехватывает указатель в экранных координатах (миникарта и т.п.). */
interface OverlayPointerBlocker extends DiagramPlugin {
  blocksDiagramPointerAtScreen?(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number
  ): boolean;
}

export type { OverlayDragSession } from './DiagramSurface';

/**
 * Main diagram renderer class
 * Manages canvas, coordinate system, and render loop
 */
export class DiagramRenderer extends EventEmitter<DiagramEvents> implements DiagramSurface {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: Required<Omit<DiagramOptions, 'scrollbar'>>;
  private plugins: DiagramPlugin[] = [];
  private styleManager?: StyleManager;
  private underlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private overlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  /** Оверлеи поверх обычных (превью связей, рамка выделения): миникарта, чтобы не перекрывалась «стрелками» и UI взаимодействия. */
  private topOverlayRenderers = new Set<(ctx: CanvasRenderingContext2D) => void>();
  private interactionManager: InteractionManager | null = null;
  private contextMenuManager: ContextMenuManager | null = null;
  private readonly animationManager: AnimationManager;
  private readonly scrollbarController: ScrollbarController;
  private readonly edgeEndpointUpdater: EdgeEndpointUpdater;
  private frameTime = 0;

  private _zoom = 1;
  private _offsetX = 0;
  private _offsetY = 0;
  private _dirty = true;
  private _styleDirty = true;
  /** Node/edge layout changed — edge endpoints must be resynced before paint. */
  private _contentDirty = true;
  private _destroyed = false;
  /** Chrome may drop the accelerated 2D backing store; nothing can be painted until it returns. */
  private _contextLost = false;
  private _canvasRect: DOMRectReadOnly | null = null;
  private _nodeObstaclesCache: PathObstacle[] | null = null;

  private animationFrameId: number | null = null;
  private devicePixelRatio: number;

  private _nodes = new Map<string, Node>();
  private _edges = new Map<string, Edge>();
  private _groups = new Map<string, Group>();
  private _attachToOutline = false;
  /** Reverse index: nodeId -> edgeIds connected to this node */
  private _nodeEdgeIndex = new Map<string, Set<string>>();

  /** When true, ports and anchor points are hidden (attach anywhere on outline) */
  get attachToOutline(): boolean {
    return this._attachToOutline;
  }

  set attachToOutline(value: boolean) {
    if (this._attachToOutline !== value) {
      this._attachToOutline = value;
      this.markDirty();
    }
  }

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
    this.scrollbarController = new ScrollbarController(
      {
        getWidth: (): number => this.width,
        getHeight: (): number => this.height,
        getZoom: (): number => this.zoom,
        getOffsetX: (): number => this.offsetX,
        setOffsetX: (value: number): void => {
          this.offsetX = value;
        },
        getOffsetY: (): number => this.offsetY,
        setOffsetY: (value: number): void => {
          this.offsetY = value;
        },
        getPixelRatio: (): number => this.pixelRatio,
        markDirty: (): void => this.markDirty(),
        screenToCanvas: (x, y): Point | null => this.screenToCanvas(x, y),
        getContentBounds: (): Bounds | null => this.getContentBounds(),
        isDarkTheme: (): boolean => this.styleManager?.theme.name === 'dark',
      },
      options
    );
    this.edgeEndpointUpdater = new EdgeEndpointUpdater({
      getNodes: (): ReadonlyMap<string, Node> => this.nodes,
      getEdges: (): ReadonlyMap<string, Edge> => this.edges,
      getNodeObstacles: (): PathObstacle[] => this.getNodeObstacles(),
    });

    this.setupCanvas();
    this.canvas.addEventListener('contextlost', this.handleContextLost);
    this.canvas.addEventListener('contextrestored', this.handleContextRestored);
    this.startRenderLoop();
  }

  private readonly handleContextLost = (): void => {
    this._contextLost = true;
  };

  private readonly handleContextRestored = (): void => {
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      return;
    }
    this._contextLost = false;
    // Do not assign canvas.width/height here: that resets the backing store and
    // Chrome often fires another contextlost on a large accelerated canvas.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    this.markDirty();
  };

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
      this.scrollbarController.notifyInteraction();
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
      this.scrollbarController.notifyInteraction();
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
      this.scrollbarController.notifyInteraction();
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
    this._styleDirty = true;
    this.markDirty();
  }

  /**
   * Get current StyleManager
   */
  getStyleManager(): StyleManager | undefined {
    return this.styleManager;
  }

  /**
   * Mark styles as dirty (force re-apply on next render)
   */
  markStyleDirty(): void {
    this._styleDirty = true;
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
    const nextRatio = this.resolvePixelRatio();
    const sizeChanged =
      this.options.width !== width ||
      this.options.height !== height ||
      this.devicePixelRatio !== nextRatio;
    this.options.width = width;
    this.options.height = height;
    if (sizeChanged) {
      this.setupCanvas();
      this.markDirty();
    }
    this.updateCanvasRect();
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
  enableInteractions(
    options: Omit<InteractionManagerOptions, 'renderer'> = {}
  ): InteractionManager {
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
  enableContextMenu(
    options: ConstructorParameters<typeof ContextMenuManager>[1]
  ): ContextMenuManager {
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
   * Верхний оверлей: после обычных оверлеев (превью связи, направляющие, рамка выделения), до скроллбаров.
   * Для миникарты и прочего «хрома» поверх рёбер и интерактивного UI.
   */
  addTopOverlayRenderer(renderer: (ctx: CanvasRenderingContext2D) => void): () => void {
    this.topOverlayRenderers.add(renderer);
    this.markDirty();
    return () => {
      this.topOverlayRenderers.delete(renderer);
      this.markDirty();
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
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
    const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
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
    node.setDirtyListener(() => this.markContentDirty());
    node.setAttachToOutlineGetter(() => this._attachToOutline);
    this._nodes.set(node.id, node);
    this.animationManager.registerEnter(node.id);
    this.markContentDirty();
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
    // Style/label dirty → repaint only. Binding changes go through markContentDirty below.
    edge.setDirtyListener(() => this.markDirty());
    edge.setBindingListener(() => this.markContentDirty());
    this._edges.set(edge.id, edge);
    // Update reverse index (node ends only; edge-attached ends use edgeId)
    if (edge.from.nodeId) this._updateEdgeIndex(edge.id, edge.from.nodeId, true);
    if (edge.to.nodeId) this._updateEdgeIndex(edge.id, edge.to.nodeId, true);
    this.animationManager.registerEnter(edge.id);
    this.markContentDirty();
    this.emit('edgeAdd', edge);
  }

  /**
   * Update edge reverse index
   */
  private _updateEdgeIndex(edgeId: string, nodeId: string, add: boolean): void {
    let edgeIds = this._nodeEdgeIndex.get(nodeId);
    if (!edgeIds) {
      edgeIds = new Set();
      this._nodeEdgeIndex.set(nodeId, edgeIds);
    }
    if (add) {
      edgeIds.add(edgeId);
    } else {
      edgeIds.delete(edgeId);
      if (edgeIds.size === 0) {
        this._nodeEdgeIndex.delete(nodeId);
      }
    }
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

    // Use reverse index to find connected edges (O(1) instead of O(n))
    const edgesToRemove = this._nodeEdgeIndex.get(nodeId);
    if (edgesToRemove) {
      // Copy to array since removeEdgeImmediate will modify the index
      for (const edgeId of Array.from(edgesToRemove)) {
        this.removeEdgeImmediate(edgeId);
      }
    }

    for (const group of this._groups.values()) {
      group.removeChild(nodeId);
    }

    this._nodes.delete(nodeId);
    node.setDirtyListener(undefined);
    node.setAttachToOutlineGetter(undefined);
    this.markContentDirty();
    this.emit('nodeRemove', node);
    return true;
  }

  private removeEdgeImmediate(edgeId: string): boolean {
    const edge = this._edges.get(edgeId);
    if (edge === undefined) {
      return false;
    }

    // Edges attached to this edge (junctions) must go with the host.
    const dependents: string[] = [];
    for (const other of this._edges.values()) {
      if (other.id === edgeId) continue;
      if (other.from.edgeId === edgeId || other.to.edgeId === edgeId) {
        dependents.push(other.id);
      }
    }
    for (const dependentId of dependents) {
      this.removeEdgeImmediate(dependentId);
    }

    // Clean up reverse index
    if (edge.from.nodeId) this._updateEdgeIndex(edgeId, edge.from.nodeId, false);
    if (edge.to.nodeId) this._updateEdgeIndex(edgeId, edge.to.nodeId, false);

    this._edges.delete(edgeId);
    edge.setDirtyListener(undefined);
    edge.setBindingListener(undefined);
    this.markContentDirty();
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
   * Find element at a point. Edges are painted above nodes, so a stroke over a
   * nested pool/lane fill is hit before the covering container.
   */
  getElementAtPoint(worldPoint: Point): Node | Edge | Group | undefined {
    let bestEdge: Edge | undefined;
    let bestDist = Infinity;
    for (const edge of this._edges.values()) {
      if (!edge.visible) {
        continue;
      }

      const baseTolerance = Math.max((edge.style.strokeWidth ?? 2) * 2, 8);
      const tolerance = baseTolerance / Math.max(this._zoom, 0.0001);
      const closest = edge.getClosestPointOnPath(worldPoint);
      if (closest && closest.distance <= tolerance && closest.distance < bestDist) {
        bestDist = closest.distance;
        bestEdge = edge;
      }
    }
    if (bestEdge) {
      return bestEdge;
    }

    const nodesArray = Array.from(this._nodes.values());
    for (let i = nodesArray.length - 1; i >= 0; i--) {
      const node = nodesArray[i]!;
      if (node.visible && node.hitTest(worldPoint)) {
        return node;
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
   * Элемент в точке worldPoint, если курсор (screen) не над оверлеем вроде миникарты.
   * Иначе undefined — взаимодействие как с пустым местом (стрелка под миникартой не выделяется).
   */
  getInteractableElementAtPoint(
    worldPoint: Point,
    screenX: number,
    screenY: number
  ): Node | Edge | Group | undefined {
    if (this.blocksDiagramPointerAtScreen(screenX, screenY)) {
      return undefined;
    }
    return this.getElementAtPoint(worldPoint);
  }

  /**
   * Update badge hover state and canvas cursor based on pointer position.
   * Call from mousemove to show hover highlight and pointer cursor over badges.
   */
  updateBadgeHover(worldPoint: Point): void {
    const element = this.getElementAtPoint(worldPoint);
    let hoveredNodeId: string | null = null;
    let hoveredIndex = -1;
    const node = element as Node;
    if (element && typeof node.getBadgeAtPoint === 'function') {
      const badge = node.getBadgeAtPoint(worldPoint);
      if (badge !== null) {
        hoveredNodeId = node.id;
        hoveredIndex = badge.index;
      }
    }
    const cursor = hoveredNodeId !== null ? 'pointer' : '';
    if (this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor;
    }
    for (const n of this._nodes.values()) {
      n.setBadgeHover(n.id === hoveredNodeId ? hoveredIndex : -1);
    }
  }

  /**
   * Mark the diagram as needing re-render (viewport / cosmetics).
   * Does not resync edge endpoints — use {@link markContentDirty} after layout changes.
   */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Mark that node/edge layout changed and edge endpoints must be recalculated.
   * Pan/zoom should call {@link markDirty} only so path routing is not redone every frame.
   */
  markContentDirty(): void {
    this._contentDirty = true;
    this._nodeObstaclesCache = null;
    this._dirty = true;
  }

  /**
   * Visible world rectangle plus padding so labels and arrow markers are not culled early.
   */
  private getViewportWorldBounds(): Bounds {
    const zoom = this._zoom;
    const pad = VIEWPORT_CULL_PAD_PX / zoom;
    return {
      x: -this._offsetX / zoom - pad,
      y: -this._offsetY / zoom - pad,
      width: this.options.width / zoom + pad * 2,
      height: this.options.height / zoom + pad * 2,
    };
  }

  private intersectsViewport(bounds: Bounds, viewport: Bounds): boolean {
    return rectsIntersect(bounds, viewport);
  }

  /**
   * Edges without a computed path stay drawable so the first layout pass can paint them.
   */
  private edgeIntersectsViewport(edge: Edge, viewport: Bounds): boolean {
    if (edge.path.length === 0) {
      return true;
    }
    return this.intersectsViewport(edge.getBounds(), viewport);
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
    this.canvas.removeEventListener('contextlost', this.handleContextLost);
    this.canvas.removeEventListener('contextrestored', this.handleContextRestored);
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
    this._nodeEdgeIndex.clear();
  }

  /**
   * Clear all elements from the diagram
   */
  clear(): void {
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
    this._nodeEdgeIndex.clear();
    this.markDirty();
  }

  private nativePixelRatio(): number {
    return this.options.retina ? window.devicePixelRatio || 1 : 1;
  }

  private resolvePixelRatio(): number {
    return this.nativePixelRatio();
  }

  private setupCanvas(): void {
    const { width, height } = this.options;
    this.devicePixelRatio = this.resolvePixelRatio();

    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Set actual size for retina displays
    this.canvas.width = width * this.devicePixelRatio;
    this.canvas.height = height * this.devicePixelRatio;

    // Scale context for retina
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

    this.updateCanvasRect();
  }

  private updateCanvasRect(): void {
    this._canvasRect = this.canvas.getBoundingClientRect();
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
      if (this.scrollbarController.updateAnimation(now)) {
        this._dirty = true;
      }

      // Invalidate cached canvas rect every frame so that screenToWorld /
      // worldToScreen pick up layout changes (e.g. surrounding panels resized
      // or repositioned the canvas without changing its own dimensions).
      this._canvasRect = null;

      // Painting into a lost context draws nothing, so keep the frame dirty and wait
      // for contextrestored instead of swallowing the redraw request.
      if (this._dirty && !this._contextLost) {
        // Clear before paint so resize/markDirty during the frame still schedules the next one.
        // Setting canvas.width after paint would otherwise leave a blank buffer with _dirty=false.
        this._dirty = false;
        this.renderFrame(now);
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

    // Apply styles from StyleManager before rendering (only if dirty)
    if (this.styleManager && this._styleDirty) {
      applyStyleManagerToElements(
        this.styleManager,
        this._groups.values(),
        this._edges.values(),
        this._nodes.values()
      );
      this._styleDirty = false;
    }

    // Update group bounds before rendering
    for (const group of this._groups.values()) {
      group.recalculateBounds();
    }

    const viewport = this.getViewportWorldBounds();

    // Render groups (back layer)
    for (const group of this._groups.values()) {
      if (group.visible && this.intersectsViewport(group.getBounds(), viewport)) {
        this.renderElementWithAnimation(ctx, group, () => group.render(ctx));
        group.clearDirty();
      }
    }

    // Sync edge endpoints only after layout changes — not on every pan/zoom frame.
    if (this._contentDirty) {
      this.edgeEndpointUpdater.updateAll();
      this._contentDirty = false;
    }

    // Render nodes (middle layer)
    for (const node of this._nodes.values()) {
      if (node.visible && this.intersectsViewport(node.getVisualBounds(), viewport)) {
        this.renderElementWithAnimation(ctx, node, () => node.render(ctx));
        node.clearDirty();
      }
    }

    // Render edges above nodes so lines/markers stay visible over figures.
    for (const edge of this._edges.values()) {
      if (edge.visible && this.edgeIntersectsViewport(edge, viewport)) {
        this.renderElementWithAnimation(ctx, edge, () => edge.render(ctx));
        edge.clearDirty();
      }
    }

    // Ручки концов рёбер (над линиями; выше — оверлеи взаимодействия и topOverlay, напр. миникарта)
    for (const edge of this._edges.values()) {
      if (edge.visible && this.edgeIntersectsViewport(edge, viewport)) {
        edge.renderHandles(ctx);
      }
    }

    for (const overlayRenderer of this.overlayRenderers) {
      overlayRenderer(ctx);
    }

    for (const topOverlay of this.topOverlayRenderers) {
      topOverlay(ctx);
    }

    this.scrollbarController.render(ctx, this.frameTime);
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

  /**
   * Update edge endpoints to reflect current node positions
   * Called during drag to keep control points in sync
   */
  updateEdgeEndpointsForDrag(): void {
    this.edgeEndpointUpdater.updateForDrag();
  }

  private getNodeObstacles(): PathObstacle[] {
    if (this._nodeObstaclesCache !== null) {
      return this._nodeObstaclesCache;
    }

    // Keep pad modest: ArchiMate stacks nodes ~12px apart; 8px/side sealed mid-gap
    // corridors and forced contour crawl along Business Process bottoms.
    const pad = 4;
    this._nodeObstaclesCache = Array.from(this._nodes.values()).map((node) => ({
      id: node.id,
      x: node.x - pad,
      y: node.y - pad,
      width: node.width + pad * 2,
      height: node.height + pad * 2,
      role: 'other' as const,
    }));

    return this._nodeObstaclesCache;
  }

  private getContentBounds(): Bounds | null {
    return getContentBounds({
      nodes: this._nodes.values(),
      edges: this._edges.values(),
      groups: this._groups.values(),
    });
  }

  notifyScrollbarInteraction(): void {
    this.scrollbarController.notifyInteraction();
  }

  setScrollbarActiveAxis(axis: ScrollbarAxis | null): void {
    this.scrollbarController.setActiveAxis(axis);
  }

  updateScrollbarHover(screenX: number, screenY: number): boolean {
    return this.scrollbarController.updateHover(screenX, screenY);
  }

  clearScrollbarHover(): void {
    this.scrollbarController.clearHover();
  }

  hitTestScrollbarThumb(
    screenX: number,
    screenY: number
  ): { axis: ScrollbarAxis; pointerOffset: number } | null {
    return this.scrollbarController.hitTestThumb(screenX, screenY);
  }

  dragScrollbarThumb(
    axis: ScrollbarAxis,
    screenX: number,
    screenY: number,
    pointerOffset: number
  ): boolean {
    return this.scrollbarController.dragThumb(axis, screenX, screenY, pointerOffset);
  }

  clickScrollbarTrack(screenX: number, screenY: number): boolean {
    return this.scrollbarController.clickTrack(screenX, screenY);
  }

  scrollViewportBy(screenDx: number, screenDy: number): boolean {
    return this.scrollbarController.scrollBy(screenDx, screenDy);
  }

  scrollViewportToStart(): boolean {
    return this.scrollbarController.scrollToStart();
  }

  scrollViewportToEnd(): boolean {
    return this.scrollbarController.scrollToEnd();
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

  /**
   * Точка (client / screen) попадает в оверлей, который не должен «пробрасывать» hit-test в диаграмму.
   */
  blocksDiagramPointerAtScreen(screenX: number, screenY: number): boolean {
    for (const plugin of this.plugins) {
      const blocker = plugin as OverlayPointerBlocker;
      if (blocker.blocksDiagramPointerAtScreen?.(this, screenX, screenY)) {
        return true;
      }
    }
    return false;
  }

  updateOverlayDrag(session: OverlayDragSession, screenX: number, screenY: number): boolean {
    const plugin = session.plugin as OverlayDragPlugin;
    return plugin.updateOverlayDrag?.(this, screenX, screenY, session.payload) ?? false;
  }

  endOverlayDrag(session: OverlayDragSession): void {
    const plugin = session.plugin as OverlayDragPlugin;
    plugin.endOverlayDrag?.(this, session.payload);
  }

  screenToCanvas(screenX: number, screenY: number): Point | null {
    const rect = this._canvasRect ?? this.canvas.getBoundingClientRect();
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
}
