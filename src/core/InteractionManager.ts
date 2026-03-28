import { InputHandler } from '@/events/InputHandler';
import type {
  InputEvent,
  WheelInputEvent,
  PanInputEvent,
  PinchInputEvent,
} from '@/events/InputHandler';
import type { DiagramRenderer, OverlayDragSession } from './DiagramRenderer';
import { SelectionManager } from './SelectionManager';
import { DragManager } from './DragManager';
import { ResizeManager } from './ResizeManager';
import { NavigationManager } from './NavigationManager';
import { ConnectionManager } from './ConnectionManager';
import type { ConnectionPreviewPathType } from './ConnectionManager';
import {
  ChangeEdgePropertiesCommand,
  ChangeGroupPropertiesCommand,
  ChangeNodePropertiesCommand,
  HistoryManager,
  MoveNodesCommand,
  RemoveNodeFromGroupsCommand,
  createEdgeSnapshot,
  createGroupSnapshot,
  createNodeSnapshot,
} from './HistoryManager';
import type { Bounds, EdgeEndpoint, Point, SerializedEdge, SerializedNode } from '@/types';
import { Edge } from '@/elements/Edge';
import type { Group } from '@/elements/Group';
import type { Node } from '@/elements/Node';
import {
  ChangeEditablePolylineControlPointsCommand,
  CompositeCommand,
} from './history/commands';
import { LabelEditor } from './LabelEditor';
import { shallowEqual } from '@/utils/style';
import { clonePoints, mergeBounds } from '@/utils/geometry';
import type { Command } from '@/types';

export interface InteractionKeymap {
  deleteKeys: string[];
  copyKey: string;
  pasteKey: string;
  undoKey: string;
  redoKey: string;
}

export interface InteractionManagerOptions {
  renderer: DiagramRenderer;
  createEdge?: (from: EdgeEndpoint, to: EdgeEndpoint) => Edge;
  nodeFactory?: (data: SerializedNode) => Node;
  edgeFactory?: (data: SerializedEdge) => Edge;
  snapToGrid?: boolean;
  gridSize?: number;
  alignToNodes?: boolean;
  /** Screen distance (px) within which alignment guides snap when dragging. Overrides default from constants. */
  alignmentScreenTolerance?: number;
  /** When true, edges can be attached anywhere on the shape outline (not just ports) */
  attachToOutline?: boolean;
  /** Preview path type while creating a new connection */
  previewPathType?: ConnectionPreviewPathType;
  /** When true, disable editing interactions and keep navigation/selection only */
  navigationOnly?: boolean;
  keymap?: Partial<InteractionKeymap>;
}

const DEFAULT_KEYMAP: InteractionKeymap = {
  deleteKeys: ['Delete', 'Backspace'],
  copyKey: 'c',
  pasteKey: 'v',
  undoKey: 'z',
  redoKey: 'y',
};

export class InteractionManager {
  private readonly renderer: DiagramRenderer;
  private inputHandler: InputHandler;
  private readonly selectionManager: SelectionManager;
  private readonly dragManager: DragManager;
  private readonly resizeManager: ResizeManager;
  private readonly navigationManager: NavigationManager;
  private readonly connectionManager: ConnectionManager;
  private readonly historyManager: HistoryManager;
  private readonly navigationOnly: boolean;
  private keymap: InteractionKeymap;
  private overlayCleanup: (() => void) | null = null;

  private dragStartPositions = new Map<string, { x: number; y: number }>();
  private dragStartEditablePolylinePoints = new Map<string, Point[]>();
  private reconnectOrigins = new Map<
    string,
    { endpoint: 'start' | 'end'; original: EdgeEndpoint }
  >();

  private clipboard: {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  } | null = null;

  private pendingPropertyChanges = new Map<
    string,
    {
      kind: 'node' | 'edge' | 'group';
      id: string;
      before:
        | ReturnType<typeof createNodeSnapshot>
        | ReturnType<typeof createEdgeSnapshot>
        | ReturnType<typeof createGroupSnapshot>;
      after:
        | ReturnType<typeof createNodeSnapshot>
        | ReturnType<typeof createEdgeSnapshot>
        | ReturnType<typeof createGroupSnapshot>;
      timerId: number;
    }
  >();
  private propertyChangeDebounceMs = 350;
  private labelEditor = new LabelEditor();
  private scrollbarDragState: { axis: 'horizontal' | 'vertical'; pointerOffset: number } | null =
    null;
  private handledScrollbarMouseDown = false;
  private overlayDragSession: OverlayDragSession | null = null;
  private handledOverlayMouseDown = false;

  constructor(options: InteractionManagerOptions) {
    this.renderer = options.renderer;
    this.navigationOnly = options.navigationOnly ?? false;
    this.inputHandler = new InputHandler({
      canvas: this.renderer.getCanvas(),
      screenToWorld: (x, y): { x: number; y: number } => this.renderer.screenToWorld(x, y),
    });

    this.selectionManager = new SelectionManager(this.renderer);
    this.dragManager = new DragManager({
      renderer: this.renderer,
      selectionManager: this.selectionManager,
      snapToGrid: options.snapToGrid ?? this.renderer.snapToGrid,
      gridSize: options.gridSize ?? 20,
      alignToNodes: options.alignToNodes ?? true,
      alignmentScreenTolerance: options.alignmentScreenTolerance,
    });
    this.resizeManager = new ResizeManager({
      renderer: this.renderer,
      selectionManager: this.selectionManager,
      snapToGrid: options.snapToGrid ?? this.renderer.snapToGrid,
      gridSize: options.gridSize ?? 20,
    });
    this.navigationManager = new NavigationManager({ renderer: this.renderer });
    this.historyManager = new HistoryManager();

    this.keymap = { ...DEFAULT_KEYMAP, ...options.keymap };

    const attachToOutline = options.attachToOutline ?? false;
    this.renderer.attachToOutline = attachToOutline;
    this.connectionManager = new ConnectionManager({
      renderer: this.renderer,
      createEdge:
        options.createEdge ??
        ((from, to): Edge => new Edge({ from, to, type: 'bezier', arrowType: 'single' })),
      snapToGrid: options.snapToGrid ?? this.renderer.snapToGrid,
      gridSize: options.gridSize ?? 20,
      attachToOutline,
      previewPathType: options.previewPathType,
      addEdge: (edge): void => {
        this.historyManager.execute({
          execute: (): void => this.renderer.addEdge(edge),
          undo: (): void => {
            this.renderer.removeEdge(edge.id);
          },
        });
      },
    });

    this.setupEvents(options);
  }

  get selection(): SelectionManager {
    return this.selectionManager;
  }

  get drag(): DragManager {
    return this.dragManager;
  }

  get resize(): ResizeManager {
    return this.resizeManager;
  }

  get navigation(): NavigationManager {
    return this.navigationManager;
  }

  get connection(): ConnectionManager {
    return this.connectionManager;
  }

  get history(): HistoryManager {
    return this.historyManager;
  }

  /**
   * Records drag-start positions for node IDs moved together with the selection by the host app
   * (e.g. contained nodes while Papirus only reports the container in drag events).
   * Call from a `dragstart` listener after the default handler; skips IDs already captured.
   * Also snapshots editable-polyline control points for edges incident to those nodes (for undo).
   */
  recordAdditionalDragStartPositions(nodeIds: string[]): void {
    for (const id of nodeIds) {
      if (this.dragStartPositions.has(id)) {
        continue;
      }
      const node = this.renderer.getNode(id);
      if (node !== undefined) {
        this.dragStartPositions.set(id, { x: node.x, y: node.y });
      }
    }
    this.snapshotEditablePolylineControlPointsForEdgesTouchingNodes(nodeIds);
  }

  private snapshotEditablePolylineControlPointsForEdgesTouchingNodes(nodeIds: Iterable<string>): void {
    const idSet = new Set(nodeIds);
    for (const edge of this.renderer.edges.values()) {
      if (!edge.hasEditableControlPoints()) {
        continue;
      }
      if (!idSet.has(edge.from.nodeId) && !idSet.has(edge.to.nodeId)) {
        continue;
      }
      if (this.dragStartEditablePolylinePoints.has(edge.id)) {
        continue;
      }
      this.dragStartEditablePolylinePoints.set(edge.id, clonePoints(edge.controlPoints!));
    }
  }

  private editablePolylinePointsEqual(a: Point[], b: Point[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      const p = a[i]!;
      const q = b[i]!;
      if (p.x !== q.x || p.y !== q.y) {
        return false;
      }
    }
    return true;
  }

  changeNodeProperties(nodeId: string, apply: (node: Node) => void): void {
    const node = this.renderer.getNode(nodeId);
    if (!node) {
      return;
    }
    const before = createNodeSnapshot(node);
    apply(node);
    const after = createNodeSnapshot(node);
    if (shallowEqual(before, after)) {
      return;
    }
    this.renderer.markStyleDirty();
    this.queuePropertyChange('node', nodeId, before, after);
  }

  changeEdgeProperties(edgeId: string, apply: (edge: Edge) => void): void {
    const edge = this.renderer.getEdge(edgeId);
    if (!edge) {
      return;
    }
    const before = createEdgeSnapshot(edge);
    apply(edge);
    const after = createEdgeSnapshot(edge);
    if (shallowEqual(before, after)) {
      return;
    }
    this.renderer.markStyleDirty();
    this.queuePropertyChange('edge', edgeId, before, after);
  }

  changeGroupProperties(groupId: string, apply: (group: Group) => void): void {
    const group = this.renderer.getGroup(groupId);
    if (!group) {
      return;
    }
    const before = createGroupSnapshot(group);
    apply(group);
    const after = createGroupSnapshot(group);
    if (shallowEqual(before, after)) {
      return;
    }
    this.renderer.markStyleDirty();
    this.queuePropertyChange('group', groupId, before, after);
  }

  removeNodeFromGroups(nodeId: string, groupIds?: string[]): void {
    const node = this.renderer.getNode(nodeId);
    if (!node) {
      return;
    }
    const groups =
      groupIds ??
      Array.from(this.renderer.groups.values())
        .filter((group) => group.hasChild(nodeId))
        .map((group) => group.id);
    if (groups.length === 0) {
      return;
    }
    this.historyManager.execute(
      new RemoveNodeFromGroupsCommand(
        (id) => this.renderer.getGroup(id),
        (id) => this.renderer.getNode(id),
        nodeId,
        groups
      )
    );
  }

  deleteByIds(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    const command = this.buildDeleteCommand(ids);
    this.historyManager.execute(command);
    this.selectionManager.clearSelection();
    this.renderer.markDirty();
  }

  zoomToSelection(padding = 50): void {
    const bounds = this.getSelectionBounds();
    if (bounds) {
      this.navigationManager.zoomToSelection(bounds, padding);
    }
  }

  destroy(): void {
    this.labelEditor.finish(false);
    if (this.overlayDragSession) {
      this.renderer.endOverlayDrag(this.overlayDragSession);
      this.overlayDragSession = null;
    }
    if (this.scrollbarDragState) {
      this.renderer.setScrollbarActiveAxis(null);
      this.scrollbarDragState = null;
    }
    this.renderer.clearScrollbarHover();
    this.inputHandler.destroy();
    this.overlayCleanup?.();
    this.overlayCleanup = null;
  }

  private setupEvents(options: InteractionManagerOptions): void {
    this.overlayCleanup = this.renderer.addOverlayRenderer((ctx) => {
      this.selectionManager.renderSelectionRect(ctx);
      if (!this.navigationOnly) {
        this.dragManager.renderAlignmentGuides(ctx);
        this.connectionManager.renderPreview(ctx);
        this.connectionManager.renderHoverAnchors(ctx);
        for (const id of this.selectionManager.selectedIds) {
          const node = this.renderer.getNode(id);
          if (node) {
            node.renderResizeHandles(ctx);
          }
        }
      }
    });

    this.inputHandler.on('mousedown', (event) => this.handleMouseDown(event));
    this.inputHandler.on('mousemove', (event) => this.handleMouseMove(event));
    this.inputHandler.on('mouseup', (event) => this.handleMouseUp(event));
    this.inputHandler.on('click', (event) => this.handleClick(event));
    this.inputHandler.on('dblclick', (event) => this.handleDoubleClick(event));
    this.inputHandler.on('wheel', (event) => this.handleWheel(event));
    this.inputHandler.on('pan', (event) => this.handlePan(event));
    this.inputHandler.on('pinch', (event) => this.handlePinch(event));
    this.inputHandler.on('keydown', (event) => this.handleKeyDown(event, options));
    this.inputHandler.on('keyup', (event) => this.handleKeyUp(event));

    if (!this.navigationOnly) {
      this.dragManager.on('dragstart', (nodeIds) => {
        this.connectionManager.disableHover();
        this.dragStartPositions.clear();
        this.dragStartEditablePolylinePoints.clear();
        for (const id of nodeIds) {
          const node = this.renderer.getNode(id);
          if (node) {
            this.dragStartPositions.set(id, { x: node.x, y: node.y });
          }
        }
        this.snapshotEditablePolylineControlPointsForEdgesTouchingNodes(nodeIds);
      });

      this.dragManager.on('dragend', () => {
        this.connectionManager.enableHover();

        const nodePositions = new Map<
          string,
          { before: { x: number; y: number }; after: { x: number; y: number } }
        >();
        for (const id of this.dragStartPositions.keys()) {
          const node = this.renderer.getNode(id);
          const before = this.dragStartPositions.get(id);
          if (!node || !before) continue;
          const after = { x: node.x, y: node.y };
          if (before.x !== after.x || before.y !== after.y) {
            nodePositions.set(id, { before, after });
          }
        }

        const polylineChanges = new Map<string, { before: Point[]; after: Point[] }>();
        for (const edge of this.renderer.edges.values()) {
          if (!edge.hasEditableControlPoints()) {
            continue;
          }
          const beforePts = this.dragStartEditablePolylinePoints.get(edge.id);
          if (beforePts === undefined) {
            continue;
          }
          const afterPts = clonePoints(edge.controlPoints!);
          if (!this.editablePolylinePointsEqual(beforePts, afterPts)) {
            polylineChanges.set(edge.id, {
              before: clonePoints(beforePts),
              after: afterPts,
            });
          }
        }

        const parts: Command[] = [];
        if (polylineChanges.size > 0) {
          parts.push(
            new ChangeEditablePolylineControlPointsCommand(
              (id) => this.renderer.getEdge(id),
              polylineChanges
            )
          );
        }
        if (nodePositions.size > 0) {
          parts.push(new MoveNodesCommand((id) => this.renderer.getNode(id), nodePositions));
        }

        if (parts.length === 1) {
          this.historyManager.execute(parts[0]!);
        } else if (parts.length > 1) {
          this.historyManager.execute(new CompositeCommand(parts));
        }
      });

      this.connectionManager.on('edgeReconnectStart', (edge, endpoint, original) => {
        this.reconnectOrigins.set(edge.id, { endpoint, original: { ...original } });
      });

      this.connectionManager.on('edgeReconnect', (edge, endpoint) => {
        const origin = this.reconnectOrigins.get(edge.id);
        if (!origin || origin.endpoint !== endpoint) {
          return;
        }

        const before = origin.original;
        const after = endpoint === 'start' ? edge.from : edge.to;
        if (this.endpointsEqual(before, after)) {
          this.reconnectOrigins.delete(edge.id);
          return;
        }

        this.historyManager.execute({
          execute: () => {
            if (endpoint === 'start') {
              edge.from = { ...after };
            } else {
              edge.to = { ...after };
            }
            this.renderer.markDirty();
          },
          undo: () => {
            if (endpoint === 'start') {
              edge.from = { ...before };
            } else {
              edge.to = { ...before };
            }
            this.renderer.markDirty();
          },
        });
        this.reconnectOrigins.delete(edge.id);
      });
    }

    this.historyManager.on('change', () => {
      this.renderer.markDirty();
    });
  }

  private handleMouseDown(event: InputEvent): void {
    this.handledScrollbarMouseDown = false;
    this.handledOverlayMouseDown = false;

    const overlayDrag = this.renderer.beginOverlayDrag(event.screenX, event.screenY);
    if (overlayDrag) {
      this.overlayDragSession = overlayDrag;
      this.handledOverlayMouseDown = true;
      return;
    }

    if (!this.navigationOnly) {
      if (this.resizeManager.handleMouseDown(event)) {
        return;
      }
      if (this.connectionManager.tryStartReconnection(event)) {
        return;
      }
      if (this.connectionManager.tryStartConnectionAtPoint(event)) {
        return;
      }
    }

    const scrollbarHit = this.renderer.hitTestScrollbarThumb(event.screenX, event.screenY);
    if (scrollbarHit) {
      this.scrollbarDragState = scrollbarHit;
      this.handledScrollbarMouseDown = true;
      this.renderer.setScrollbarActiveAxis(scrollbarHit.axis);
      this.renderer.notifyScrollbarInteraction();
      return;
    }

    if (this.renderer.clickScrollbarTrack(event.screenX, event.screenY)) {
      this.handledScrollbarMouseDown = true;
      return;
    }

    const point = { x: event.worldX, y: event.worldY };
    const hitElement = this.renderer.getInteractableElementAtPoint(point, event.screenX, event.screenY);

    if (event.button === 0) {
      if (this.navigationOnly) {
        this.selectionManager.clearSelection();
        this.navigationManager.startPan(event);
        return;
      }
      if (hitElement === undefined) {
        if (event.ctrlKey || event.metaKey) {
          this.selectionManager.startSelectionRect(point);
          return;
        }
        this.selectionManager.clearSelection();
        this.navigationManager.startPan(event);
        return;
      }
    }

    if (this.navigationManager.handleMouseDown(event)) {
      return;
    }

    if (this.navigationOnly) {
      return;
    }

    // Connection creation now starts from anchor points without modifiers

    if (this.dragManager.handleMouseDown(event)) {
      return;
    }
  }

  private handleMouseMove(event: InputEvent): void {
    if (event.originalEvent instanceof MouseEvent && event.originalEvent.buttons === 0) {
      if (this.overlayDragSession) {
        this.renderer.endOverlayDrag(this.overlayDragSession);
        this.overlayDragSession = null;
      }
      if (this.scrollbarDragState) {
        this.renderer.setScrollbarActiveAxis(null);
        this.scrollbarDragState = null;
      }
      if (this.navigationManager.panning) {
        this.navigationManager.handleMouseUp(event);
      }
    }

    const overScrollbar = this.renderer.updateScrollbarHover(event.screenX, event.screenY);
    const overOverlayPointerSink = this.renderer.blocksDiagramPointerAtScreen(
      event.screenX,
      event.screenY
    );

    this.renderer.updateBadgeHover(
      overScrollbar || overOverlayPointerSink
        ? { x: -1e9, y: -1e9 }
        : { x: event.worldX, y: event.worldY }
    );

    if (this.overlayDragSession) {
      const moved = this.renderer.updateOverlayDrag(
        this.overlayDragSession,
        event.screenX,
        event.screenY
      );
      if (moved) {
        return;
      }
      this.renderer.endOverlayDrag(this.overlayDragSession);
      this.overlayDragSession = null;
    }

    if (this.scrollbarDragState) {
      const moved = this.renderer.dragScrollbarThumb(
        this.scrollbarDragState.axis,
        event.screenX,
        event.screenY,
        this.scrollbarDragState.pointerOffset
      );
      if (moved) {
        return;
      }
      this.renderer.setScrollbarActiveAxis(null);
      this.scrollbarDragState = null;
    }

    const blockDiagramRoutesUnderOverlay =
      overOverlayPointerSink &&
      !this.navigationManager.panning &&
      !this.connectionManager.connecting &&
      !this.connectionManager.isEditingEdgeControlPoint &&
      !this.resizeManager.resizing &&
      !this.dragManager.dragging &&
      this.selectionManager.selectionRectangle === null;

    if (
      overOverlayPointerSink &&
      !this.connectionManager.connecting &&
      !this.connectionManager.isEditingEdgeControlPoint
    ) {
      this.connectionManager.clearPointerHover();
    }

    if (overScrollbar || blockDiagramRoutesUnderOverlay) {
      return;
    }

    if (!this.navigationOnly) {
      if (this.resizeManager.handleMouseMove(event)) {
        return;
      }

      if (this.connectionManager.handleMouseMove(event)) {
        return;
      }

      if (this.dragManager.handleMouseMove(event)) {
        return;
      }
    }

    if (this.selectionManager.selectionRectangle !== null) {
      this.selectionManager.updateSelectionRect({ x: event.worldX, y: event.worldY });
      return;
    }

    this.navigationManager.handleMouseMove(event);
  }

  private handleMouseUp(event: InputEvent): void {
    if (this.overlayDragSession) {
      this.renderer.endOverlayDrag(this.overlayDragSession);
      this.overlayDragSession = null;
      return;
    }

    if (this.scrollbarDragState) {
      this.scrollbarDragState = null;
      this.renderer.setScrollbarActiveAxis(null);
      return;
    }

    if (!this.navigationOnly) {
      if (this.resizeManager.handleMouseUp()) {
        return;
      }

      if (this.connectionManager.handleMouseUp(event)) {
        return;
      }

      if (this.dragManager.handleMouseUp(event)) {
        return;
      }
    }

    if (this.selectionManager.selectionRectangle !== null) {
      this.selectionManager.endSelectionRect();
      return;
    }

    this.navigationManager.handleMouseUp(event);
  }

  private handleClick(event: InputEvent): void {
    if (this.handledOverlayMouseDown) {
      this.handledOverlayMouseDown = false;
      return;
    }

    if (this.handledScrollbarMouseDown) {
      this.handledScrollbarMouseDown = false;
      return;
    }

    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }

    if (
      this.dragManager.handledMouseDown ||
      this.resizeManager.handledMouseDown ||
      this.connectionManager.connecting
    ) {
      return;
    }

    this.selectionManager.handleClick(event);
  }

  private handleDoubleClick(event: InputEvent): void {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }

    if (
      this.dragManager.handledMouseDown ||
      this.resizeManager.handledMouseDown ||
      this.connectionManager.connecting
    ) {
      return;
    }

    if (this.navigationOnly) {
      return;
    }

    if (this.connectionManager.handleDoubleClick(event)) {
      return;
    }

    const point = { x: event.worldX, y: event.worldY };
    const edgeByLabel = this.getEdgeLabelAtPoint(point);
    if (edgeByLabel) {
      const labelPosition = edgeByLabel.getLabelPosition() ?? point;
      this.startLabelEdit('edge', edgeByLabel.id, edgeByLabel.label?.text ?? '', labelPosition);
      return;
    }

    const hitElement = this.renderer.getInteractableElementAtPoint(point, event.screenX, event.screenY);
    if (!hitElement) {
      this.labelEditor.finish(true, (kind, id, value) => this.handleLabelCommit(kind, id, value));
      return;
    }

    if ('typeName' in hitElement) {
      const editText = hitElement.label?.editableText ?? hitElement.label?.text ?? '';
      this.startLabelEdit('node', hitElement.id, editText, hitElement.getLabelPosition());
      return;
    }

    if ('from' in hitElement && 'to' in hitElement) {
      const labelPosition = hitElement.getLabelPosition() ?? point;
      this.startLabelEdit('edge', hitElement.id, hitElement.label?.text ?? '', labelPosition);
    }
  }

  private getEdgeLabelAtPoint(point: Point): Edge | null {
    const zoom = Math.max(this.renderer.zoom, 0.0001);
    const maxDistance = 28 / zoom;
    const maxDistanceSq = maxDistance * maxDistance;

    let closestEdge: Edge | null = null;
    let closestDistanceSq = Infinity;

    for (const edge of this.renderer.edges.values()) {
      if (!edge.visible || !edge.label) {
        continue;
      }

      const labelPosition = edge.getLabelPosition();
      if (!labelPosition) {
        continue;
      }

      const dx = point.x - labelPosition.x;
      const dy = point.y - labelPosition.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > maxDistanceSq || distanceSq >= closestDistanceSq) {
        continue;
      }

      closestDistanceSq = distanceSq;
      closestEdge = edge;
    }

    return closestEdge;
  }

  private handleWheel(event: WheelInputEvent): void {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }
    this.navigationManager.handleWheel(event);
  }

  private handlePan(event: PanInputEvent): void {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }
    this.navigationManager.handlePanGesture(event);
  }

  private handlePinch(event: PinchInputEvent): void {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }
    this.navigationManager.handlePinch(event);
  }

  private handleKeyDown(event: KeyboardEvent, options: InteractionManagerOptions): void {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;
    // Use event.code for letter keys to work with any keyboard layout (e.g. Russian)
    const key = event.code.startsWith('Key')
      ? event.code.slice(3).toLowerCase()
      : event.key.toLowerCase();

    this.navigationManager.handleKeyDown(event);

    if (this.handleViewportNavigationKey(event)) {
      return;
    }

    if (this.navigationOnly) {
      return;
    }

    if (isCtrlOrMeta && (key === 'z' || key === 'y')) {
      this.flushPendingPropertyChanges();
    }

    if (this.historyManager.handleKeyDown(event)) {
      return;
    }

    if (this.keymap.deleteKeys.includes(event.key)) {
      event.preventDefault();
      this.deleteSelection();
      return;
    }

    if (isCtrlOrMeta && key === this.keymap.copyKey) {
      event.preventDefault();
      this.copySelection();
      return;
    }

    if (isCtrlOrMeta && key === this.keymap.pasteKey) {
      event.preventDefault();
      this.pasteSelection(options);
      return;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.navigationManager.handleKeyUp(event);
  }

  private handleViewportNavigationKey(event: KeyboardEvent): boolean {
    switch (event.key) {
      case 'PageDown':
        event.preventDefault();
        this.renderer.scrollViewportBy(0, this.renderer.height * 0.8);
        return true;
      case 'PageUp':
        event.preventDefault();
        this.renderer.scrollViewportBy(0, -this.renderer.height * 0.8);
        return true;
      case 'Home':
        event.preventDefault();
        this.renderer.scrollViewportToStart();
        return true;
      case 'End':
        event.preventDefault();
        this.renderer.scrollViewportToEnd();
        return true;
      default:
        return false;
    }
  }

  private startLabelEdit(
    kind: 'node' | 'edge',
    id: string,
    text: string,
    worldPosition: Point
  ): void {
    this.labelEditor.start(
      kind,
      id,
      text,
      worldPosition,
      (x, y) => this.renderer.worldToScreen(x, y),
      (k, i, value) => this.handleLabelCommit(k, i, value)
    );
  }

  private handleLabelCommit(kind: 'node' | 'edge', id: string, nextValue: string): void {
    if (kind === 'node') {
      this.changeNodeProperties(id, (node) => {
        const value = nextValue.trim();
        if (value.length === 0) {
          node.label = undefined;
          return;
        }
        if (!node.label) {
          node.label = value;
          return;
        }
        if (node.label.editableText !== undefined) {
          node.label.editableText = value;
          node.label.text = value;
        } else {
          node.label.text = value;
        }
      });
      return;
    }

    this.changeEdgeProperties(id, (edge) => {
      const value = nextValue.trim();
      if (value.length === 0) {
        edge.label = undefined;
        return;
      }
      if (!edge.label) {
        edge.label = value;
        return;
      }
      edge.label.text = value;
    });
  }

  private queuePropertyChange(
    kind: 'node' | 'edge' | 'group',
    id: string,
    before:
      | ReturnType<typeof createNodeSnapshot>
      | ReturnType<typeof createEdgeSnapshot>
      | ReturnType<typeof createGroupSnapshot>,
    after:
      | ReturnType<typeof createNodeSnapshot>
      | ReturnType<typeof createEdgeSnapshot>
      | ReturnType<typeof createGroupSnapshot>
  ): void {
    const key = `${kind}:${id}`;
    const existing = this.pendingPropertyChanges.get(key);
    if (existing) {
      existing.after = after;
      window.clearTimeout(existing.timerId);
      existing.timerId = window.setTimeout(
        () => this.flushPendingPropertyChange(key),
        this.propertyChangeDebounceMs
      );
      return;
    }

    const timerId = window.setTimeout(
      () => this.flushPendingPropertyChange(key),
      this.propertyChangeDebounceMs
    );
    this.pendingPropertyChanges.set(key, { kind, id, before, after, timerId });
  }

  private flushPendingPropertyChanges(): void {
    const keys = Array.from(this.pendingPropertyChanges.keys());
    for (const key of keys) {
      this.flushPendingPropertyChange(key);
    }
  }

  private flushPendingPropertyChange(key: string): void {
    const pending = this.pendingPropertyChanges.get(key);
    if (!pending) {
      return;
    }
    window.clearTimeout(pending.timerId);
    this.pendingPropertyChanges.delete(key);
    if (shallowEqual(pending.before as object, pending.after as object)) {
      return;
    }

    switch (pending.kind) {
      case 'node':
        this.historyManager.execute(
          new ChangeNodePropertiesCommand(
            (id) => this.renderer.getNode(id),
            pending.id,
            pending.before as ReturnType<typeof createNodeSnapshot>,
            pending.after as ReturnType<typeof createNodeSnapshot>
          )
        );
        this.renderer.markStyleDirty();
        break;
      case 'edge':
        this.historyManager.execute(
          new ChangeEdgePropertiesCommand(
            (id) => this.renderer.getEdge(id),
            pending.id,
            pending.before as ReturnType<typeof createEdgeSnapshot>,
            pending.after as ReturnType<typeof createEdgeSnapshot>
          )
        );
        this.renderer.markStyleDirty();
        break;
      case 'group':
        this.historyManager.execute(
          new ChangeGroupPropertiesCommand(
            (id) => this.renderer.getGroup(id),
            pending.id,
            pending.before as ReturnType<typeof createGroupSnapshot>,
            pending.after as ReturnType<typeof createGroupSnapshot>
          )
        );
        this.renderer.markStyleDirty();
        break;
    }
  }

  private deleteSelection(): void {
    const selectedIds = Array.from(this.selectionManager.selectedIds);
    this.deleteByIds(selectedIds);
  }

  private buildDeleteCommand(selectedIds: string[]): CompositeCommand {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const edgeIds = new Set<string>();
    const nodeIds = new Set<string>();
    const nodeGroupIds = new Map<string, string[]>();

    for (const id of selectedIds) {
      const node = this.renderer.getNode(id);
      if (node) {
        nodes.push(node);
        nodeIds.add(id);
        continue;
      }

      const edge = this.renderer.getEdge(id);
      if (edge && !edgeIds.has(edge.id)) {
        edgeIds.add(edge.id);
        edges.push(edge);
      }
    }

    if (nodeIds.size > 0) {
      for (const group of this.renderer.groups.values()) {
        for (const child of group.children) {
          if ('typeName' in child && nodeIds.has(child.id)) {
            const list = nodeGroupIds.get(child.id) ?? [];
            list.push(group.id);
            nodeGroupIds.set(child.id, list);
          }
        }
      }
    }

    for (const edge of this.renderer.edges.values()) {
      if (nodeIds.has(edge.from.nodeId) || nodeIds.has(edge.to.nodeId)) {
        if (!edgeIds.has(edge.id)) {
          edgeIds.add(edge.id);
          edges.push(edge);
        }
      }
    }

    return new CompositeCommand([
      {
        execute: (): void => {
          for (const edge of edges) {
            this.renderer.removeEdge(edge.id);
          }
          for (const node of nodes) {
            this.renderer.removeNode(node.id);
          }
        },
        undo: (): void => {
          for (const node of nodes) {
            this.renderer.addNode(node);
          }
          for (const node of nodes) {
            const groupIds = nodeGroupIds.get(node.id);
            if (!groupIds) {
              continue;
            }
            for (const groupId of groupIds) {
              const group = this.renderer.getGroup(groupId);
              if (group) {
                group.addChild(node);
              }
            }
          }
          for (const edge of edges) {
            this.renderer.addEdge(edge);
          }
        },
      },
    ]);
  }

  private copySelection(): void {
    const selectedIds = new Set(this.selectionManager.selectedIds);
    if (selectedIds.size === 0) {
      return;
    }

    const nodes: SerializedNode[] = [];
    const edges: SerializedEdge[] = [];
    const nodeIds = new Set<string>();

    for (const id of selectedIds) {
      const node = this.renderer.getNode(id);
      if (node) {
        nodes.push({
          id: node.id,
          type: node.typeName,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          style: node.style,
          styleClass: node.styleClass,
          label: node.label?.text,
          labelStyleClass: node.label?.styleClass,
          ports: node.ports.map((port) => ({
            id: port.id,
            type: port.type,
            position: port.position,
            styleClass: port.styleClass,
          })),
          data: Object.keys(node.data).length > 0 ? node.data : undefined,
        });
        nodeIds.add(node.id);
      }
    }

    for (const edge of this.renderer.edges.values()) {
      if (nodeIds.has(edge.from.nodeId) && nodeIds.has(edge.to.nodeId)) {
        edges.push({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          type: edge.type,
          controlPoints: edge.controlPoints,
          arrowType: edge.arrowType,
          style: edge.style,
          styleClass: edge.styleClass,
          label: edge.label?.text,
          labelStyleClass: edge.label?.styleClass,
          labelOffset: edge.labelOffset !== 0 ? edge.labelOffset : undefined,
          labelBackground: edge.labelBackground,
          labelLineGap: edge.labelLineGap ? true : undefined,
          data: Object.keys(edge.data).length > 0 ? edge.data : undefined,
        });
      }
    }

    this.clipboard = { nodes, edges };
  }

  private pasteSelection(options: InteractionManagerOptions): void {
    if (!this.clipboard || !options.nodeFactory || !options.edgeFactory) {
      return;
    }

    const offset: Point = { x: 20, y: 20 };
    const idMap = new Map<string, string>();
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    for (const nodeData of this.clipboard.nodes) {
      const newId = `${nodeData.id}_copy_${Date.now()}`;
      idMap.set(nodeData.id, newId);
      const copyData: SerializedNode = {
        ...nodeData,
        id: newId,
        x: nodeData.x + offset.x,
        y: nodeData.y + offset.y,
      };
      newNodes.push(options.nodeFactory(copyData));
    }

    for (const edgeData of this.clipboard.edges) {
      const fromNodeId = idMap.get(edgeData.from.nodeId);
      const toNodeId = idMap.get(edgeData.to.nodeId);
      if (!fromNodeId || !toNodeId) {
        continue;
      }
      const newId = `${edgeData.id}_copy_${Date.now()}`;
      const copyEdge: SerializedEdge = {
        ...edgeData,
        id: newId,
        from: { ...edgeData.from, nodeId: fromNodeId },
        to: { ...edgeData.to, nodeId: toNodeId },
      };
      newEdges.push(options.edgeFactory(copyEdge));
    }

    if (newNodes.length === 0 && newEdges.length === 0) {
      return;
    }

    this.historyManager.execute({
      execute: () => {
        for (const node of newNodes) {
          this.renderer.addNode(node);
        }
        for (const edge of newEdges) {
          this.renderer.addEdge(edge);
        }
      },
      undo: () => {
        for (const edge of newEdges) {
          this.renderer.removeEdge(edge.id);
        }
        for (const node of newNodes) {
          this.renderer.removeNode(node.id);
        }
      },
    });
  }

  private endpointsEqual(a: EdgeEndpoint, b: EdgeEndpoint): boolean {
    if (a.nodeId !== b.nodeId) return false;
    if ((a.portId ?? null) !== (b.portId ?? null)) return false;
    const aParam = a.outlineParam;
    const bParam = b.outlineParam;
    if (aParam === undefined && bParam === undefined) return true;
    if (aParam === undefined || bParam === undefined) return false;
    return Math.abs((aParam % 1) - (bParam % 1)) < 1e-9;
  }

  private getSelectionBounds(): Bounds | null {
    const sources: Bounds[] = [];
    for (const id of this.selectionManager.selectedIds) {
      const node = this.renderer.getNode(id);
      if (node) {
        sources.push(node.getBounds());
      }
    }
    return mergeBounds(sources);
  }
}
