import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { SelectionManager } from './SelectionManager';
import type { InputEvent } from '@/events/InputHandler';
import type { Node } from '@/elements/Node';
import type { Bounds, Point } from '@/types';
import { ALIGNMENT_SCREEN_TOLERANCE, DRAG_START_THRESHOLD, EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE } from '@/constants';
import { distance, mergeBounds, clonePoints, rectsIntersect } from '@/utils/geometry';

interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  from: number;
  to: number;
}

/**
 * Drag events
 */
export interface DragEvents {
  dragstart: [nodeIds: string[], startPoint: Point];
  drag: [nodeIds: string[], currentPoint: Point, delta: Point];
  dragend: [nodeIds: string[], endPoint: Point];
}

export interface DragManagerOptions {
  renderer: DiagramRenderer;
  selectionManager: SelectionManager;
  snapToGrid?: boolean;
  gridSize?: number;
  alignToNodes?: boolean;
  /** Screen distance (px) for alignment guides; when set, overrides ALIGNMENT_SCREEN_TOLERANCE. */
  alignmentScreenTolerance?: number;
}

/**
 * Manages node dragging
 */
export class DragManager extends EventEmitter<DragEvents> {
  private renderer: DiagramRenderer;
  private selectionManager: SelectionManager;
  private snapToGrid: boolean;
  private gridSize: number;
  private alignToNodes: boolean;
  private alignmentScreenTolerance: number;

  private isDragging = false;
  private draggedNodes: Node[] = [];
  private dragStartPoint: Point | null = null;
  private lastDragPoint: Point | null = null;
  private initialPositions = new Map<string, Point>();
  private editableBendFollow = new Map<
    string,
    Array<{ edgeId: string; controlPointIndex: number; axis: 'vertical' | 'horizontal' }>
  >();
  /** Edges (editable-polyline) where both endpoints are in selection — control points follow delta */
  private editablePolylineFullyConnectedEdges = new Set<string>();
  /** Snapshot of control points at drag start for cancel/restore */
  private initialControlPointsForFullyConnected = new Map<string, Point[]>();
  private alignmentGuides: AlignmentGuide[] = [];
  private _handledMouseDown = false;
  private draggedGroupSelection = false;

  constructor(options: DragManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.selectionManager = options.selectionManager;
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
    this.alignToNodes = options.alignToNodes ?? true;
    this.alignmentScreenTolerance =
      options.alignmentScreenTolerance ?? ALIGNMENT_SCREEN_TOLERANCE;
  }

  /**
   * Check if currently dragging
   */
  get dragging(): boolean {
    return this.isDragging;
  }

  /**
   * Check if last mousedown was handled (for skipping click handling)
   */
  get handledMouseDown(): boolean {
    return this._handledMouseDown;
  }

  renderAlignmentGuides(ctx: CanvasRenderingContext2D): void {
    if (!this.alignToNodes || !this.isDragging || this.alignmentGuides.length === 0) {
      return;
    }

    const zoom = Math.max(this.renderer.zoom, 0.0001);
    ctx.save();
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5 / zoom;

    for (const guide of this.alignmentGuides) {
      ctx.beginPath();
      if (guide.orientation === 'vertical') {
        ctx.moveTo(guide.position, guide.from);
        ctx.lineTo(guide.position, guide.to);
      } else {
        ctx.moveTo(guide.from, guide.position);
        ctx.lineTo(guide.to, guide.position);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Enable/disable snap to grid
   */
  setSnapToGrid(enabled: boolean, gridSize?: number): void {
    this.snapToGrid = enabled;
    if (gridSize !== undefined) {
      this.gridSize = gridSize;
    }
  }

  /**
   * Enable/disable smart alignment to other nodes while dragging.
   */
  setAlignmentEnabled(enabled: boolean): void {
    this.alignToNodes = enabled;
    if (!enabled && this.alignmentGuides.length > 0) {
      this.alignmentGuides = [];
      this.renderer.markDirty();
    }
  }

  /**
   * Handle mouse down - start potential drag
   */
  handleMouseDown(event: InputEvent): boolean {
    // Reset handledMouseDown at the start of new interaction
    this._handledMouseDown = false;

    const point = { x: event.worldX, y: event.worldY };
    const element = this.renderer.getElementAtPoint(point);

    if (element === undefined) {
      return false;
    }

    // Check if it's a node
    const node = this.renderer.getNode(element.id);
    const group = node === undefined ? this.renderer.getGroup(element.id) : undefined;
    const edge =
      node === undefined && group === undefined ? this.renderer.getEdge(element.id) : undefined;
    if (node === undefined && group === undefined && edge === undefined) {
      return false;
    }

    // Edge dragging: allow dragging selected nodes through edge hit area.
    // Useful for relation anchors that are hidden and hard to click directly.
    if (edge !== undefined) {
      if (edge.state !== 'selected') {
        return false;
      }
      const hasSelectedNodes = Array.from(this.selectionManager.selectedIds).some(
        (id) => this.renderer.getNode(id) !== undefined
      );
      if (!hasSelectedNodes) {
        return false;
      }
      this._handledMouseDown = true;
      this.dragStartPoint = point;
      this.lastDragPoint = point;
      this.draggedGroupSelection = false;
      this.draggedNodes = [];
      this.initialPositions.clear();
      for (const id of this.selectionManager.selectedIds) {
        const selectedNode = this.renderer.getNode(id);
        if (selectedNode !== undefined) {
          this.addDraggedNode(selectedNode);
        }
      }
      return this.draggedNodes.length > 0;
    }

    const targetId = node?.id ?? group!.id;

    // Handle selection based on modifier keys
    if (!this.selectionManager.isSelected(targetId)) {
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+click on unselected: add to selection
        this.selectionManager.addToSelection(targetId);
      } else {
        // Regular click on unselected: select only this element
        this.selectionManager.select(targetId);
      }
      // Mark as handled since we changed selection
      this._handledMouseDown = true;
    }
    // If already selected - don't mark as handled yet
    // Let click event handle toggle (Ctrl+click) or re-select (regular click)
    // We'll mark as handled if actual drag starts

    // Prepare for drag
    this.dragStartPoint = point;
    this.lastDragPoint = point;
    this.draggedGroupSelection = false;

    // Get all selected nodes (expand groups to children)
    this.draggedNodes = [];
    for (const id of this.selectionManager.selectedIds) {
      const selectedNode = this.renderer.getNode(id);
      if (selectedNode !== undefined) {
        this.addDraggedNode(selectedNode);
        continue;
      }

      const selectedGroup = this.renderer.getGroup(id);
      if (selectedGroup !== undefined) {
        this.draggedGroupSelection = true;
        for (const child of selectedGroup.getAllChildren()) {
          const childNode = this.renderer.getNode(child.id);
          if (childNode) {
            this.addDraggedNode(childNode);
          }
        }
      }
    }

    return true;
  }

  /**
   * Handle mouse move - update drag
   */
  handleMouseMove(event: InputEvent): boolean {
    if (this.dragStartPoint === null) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };

    // Check if we've moved enough to start dragging
    if (!this.isDragging) {
      const dist = distance(point, this.dragStartPoint);

      if (dist < DRAG_START_THRESHOLD) {
        return false;
      }

      // Start dragging
      this.isDragging = true;
      this._handledMouseDown = true; // Mark as handled now that drag started
      this.buildEditableBendFollowBindings();
      this.alignmentGuides = [];
      for (const node of this.draggedNodes) {
        node.state = 'dragging';
      }
      this.emit(
        'dragstart',
        this.draggedNodes.map((n) => n.id),
        this.dragStartPoint
      );
    }

    // Calculate total offset from drag start (not incremental delta)
    const totalDelta = {
      x: point.x - this.dragStartPoint.x,
      y: point.y - this.dragStartPoint.y,
    };

    // Delta from last point (for event)
    const delta = {
      x: point.x - this.lastDragPoint!.x,
      y: point.y - this.lastDragPoint!.y,
    };

    const alignedDelta = this.resolveAlignmentDelta(totalDelta);

    // Move nodes using initial position + total offset
    let firstDelta: Point | null = null;
    for (const node of this.draggedNodes) {
      const initial = this.initialPositions.get(node.id);
      if (initial === undefined) continue;
      const prevX = node.x;
      const prevY = node.y;

      let newX = initial.x + alignedDelta.x;
      let newY = initial.y + alignedDelta.y;

      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      node.x = newX;
      node.y = newY;
      const dx = newX - prevX;
      const dy = newY - prevY;
      if (firstDelta === null) {
        firstDelta = { x: dx, y: dy };
      }
      this.followNearestEditableBend(node.id, dx, dy);
    }

    if (firstDelta !== null) {
      this.followEditableBendForFullyConnectedEdges(firstDelta.x, firstDelta.y);
    }
    this.emit(
      'drag',
      this.draggedNodes.map((n) => n.id),
      point,
      delta
    );
    this.renderer.markDirty();

    return true;
  }

  /**
   * Handle mouse up - end drag
   */
  handleMouseUp(event: InputEvent): boolean {
    if (this.dragStartPoint === null) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };
    const wasDragging = this.isDragging;

    if (this.isDragging) {
      // Restore selected state
      for (const node of this.draggedNodes) {
        node.state = 'selected';
      }
      this.emit(
        'dragend',
        this.draggedNodes.map((n) => n.id),
        point
      );
      if (this.draggedGroupSelection) {
        this.selectionManager.clearSelection();
      }
    }

    this.reset();
    this.renderer.markDirty();

    return wasDragging;
  }

  /**
   * Cancel current drag operation
   */
  cancelDrag(): void {
    if (this.isDragging) {
      // Restore original positions
      for (const node of this.draggedNodes) {
        const initial = this.initialPositions.get(node.id);
        if (initial !== undefined) {
          node.x = initial.x;
          node.y = initial.y;
        }
        node.state = 'selected';
      }
      // Restore control points for fully-connected editable polyline edges
      for (const [edgeId, points] of this.initialControlPointsForFullyConnected) {
        const edge = this.renderer.getEdge(edgeId);
        if (edge) {
          edge.controlPoints = clonePoints(points);
        }
      }
    }

    this.reset();
    this.renderer.markDirty();
  }

  private addDraggedNode(node: Node): void {
    if (this.initialPositions.has(node.id)) {
      return;
    }
    this.draggedNodes.push(node);
    this.initialPositions.set(node.id, { x: node.x, y: node.y });
  }

  private reset(): void {
    this.isDragging = false;
    this.draggedNodes = [];
    this.dragStartPoint = null;
    this.lastDragPoint = null;
    this.initialPositions.clear();
    this.editableBendFollow.clear();
    this.editablePolylineFullyConnectedEdges.clear();
    this.initialControlPointsForFullyConnected.clear();
    this.alignmentGuides = [];
    this.draggedGroupSelection = false;
    // Note: _handledMouseDown is reset at the start of next handleMouseDown
    // to prevent click handler from firing after mouseup
  }

  private buildEditableBendFollowBindings(): void {
    this.editableBendFollow.clear();
    this.editablePolylineFullyConnectedEdges.clear();
    this.initialControlPointsForFullyConnected.clear();
    const draggedIds = new Set(this.draggedNodes.map((node) => node.id));
    const nodeBindings = new Map<string, Array<{ edgeId: string; controlPointIndex: number; axis: 'vertical' | 'horizontal' }>>();

    // Single pass: collect fully-connected edges and single-node bindings
    for (const edge of this.renderer.edges.values()) {
      if (!edge.hasEditableControlPoints()) {
        continue;
      }

      const isFromDragged = draggedIds.has(edge.from.nodeId);
      const isToDragged = draggedIds.has(edge.to.nodeId);

      if (isFromDragged && isToDragged) {
        this.editablePolylineFullyConnectedEdges.add(edge.id);
        this.initialControlPointsForFullyConnected.set(edge.id, clonePoints(edge.controlPoints!));
        continue;
      }

      for (const node of this.draggedNodes) {
        const isFrom = edge.from.nodeId === node.id;
        const isTo = edge.to.nodeId === node.id;
        if (!isFrom && !isTo) {
          continue;
        }

        const oppositeNodeId = isFrom ? edge.to.nodeId : edge.from.nodeId;
        if (draggedIds.has(oppositeNodeId)) {
          continue;
        }

        const controlPointIndex = isFrom ? 0 : edge.controlPoints!.length - 1;
        const nearestPoint = edge.controlPoints![controlPointIndex]!;
        const endpoint = isFrom ? edge.startPoint : edge.endPoint;
        const deltaX = Math.abs(nearestPoint.x - endpoint.x);
        const deltaY = Math.abs(nearestPoint.y - endpoint.y);

        if (deltaX <= EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE && deltaY <= EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE) {
          continue;
        }

        let axis: 'vertical' | 'horizontal' | null = null;
        if (deltaX <= EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE || deltaX <= deltaY) {
          axis = 'vertical';
        } else if (deltaY <= EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE || deltaY < deltaX) {
          axis = 'horizontal';
        }

        if (!axis) {
          continue;
        }

        const bindings = nodeBindings.get(node.id) ?? [];
        bindings.push({ edgeId: edge.id, controlPointIndex, axis });
        nodeBindings.set(node.id, bindings);
      }
    }

    for (const [nodeId, bindings] of nodeBindings) {
      if (bindings.length > 0) {
        this.editableBendFollow.set(nodeId, bindings);
      }
    }
  }

  private followNearestEditableBend(nodeId: string, deltaX: number, deltaY: number): void {
    const bindings = this.editableBendFollow.get(nodeId);
    if (!bindings || bindings.length === 0) {
      return;
    }

    for (const binding of bindings) {
      const edge = this.renderer.getEdge(binding.edgeId);
      if (!edge?.controlPoints) {
        continue;
      }
      if (binding.controlPointIndex < 0 || binding.controlPointIndex >= edge.controlPoints.length) {
        continue;
      }

      const nextControlPoints = [...edge.controlPoints];
      const point = { ...nextControlPoints[binding.controlPointIndex]! };
      if (binding.axis === 'vertical' && deltaX !== 0) {
        point.x += deltaX;
      } else if (binding.axis === 'horizontal' && deltaY !== 0) {
        point.y += deltaY;
      } else {
        continue;
      }
      nextControlPoints[binding.controlPointIndex] = point;
      edge.controlPoints = nextControlPoints;
    }
  }

  /**
   * For editable-polyline edges where both endpoints are dragged:
   * move all control points by the same delta to preserve relative positions.
   */
  private followEditableBendForFullyConnectedEdges(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    for (const edgeId of this.editablePolylineFullyConnectedEdges) {
      const edge = this.renderer.getEdge(edgeId);
      if (!edge?.controlPoints || edge.controlPoints.length === 0) {
        continue;
      }
      const nextControlPoints = edge.controlPoints.map((p) => ({
        x: p.x + deltaX,
        y: p.y + deltaY,
      }));
      edge.controlPoints = nextControlPoints;
    }
  }

  private resolveAlignmentDelta(totalDelta: Point): Point {
    this.alignmentGuides = [];
    if (!this.alignToNodes) {
      return totalDelta;
    }
    if (this.draggedNodes.length === 0) {
      return totalDelta;
    }

    const draggedBounds = this.getDraggedBounds(totalDelta);
    if (!draggedBounds) {
      return totalDelta;
    }

    const tolerance = this.alignmentScreenTolerance / Math.max(this.renderer.zoom, 0.0001);
    const draggedIds = new Set(this.draggedNodes.map((node) => node.id));
    const searchPadding = tolerance * 2;
    const searchBounds: Bounds = {
      x: draggedBounds.x - searchPadding,
      y: draggedBounds.y - searchPadding,
      width: draggedBounds.width + searchPadding * 2,
      height: draggedBounds.height + searchPadding * 2,
    };

    const movingXLines = [
      { key: 'start', value: draggedBounds.x },
      { key: 'center', value: draggedBounds.x + draggedBounds.width / 2 },
      { key: 'end', value: draggedBounds.x + draggedBounds.width },
    ];
    const movingYLines = [
      { key: 'start', value: draggedBounds.y },
      { key: 'center', value: draggedBounds.y + draggedBounds.height / 2 },
      { key: 'end', value: draggedBounds.y + draggedBounds.height },
    ];

    let bestVertical: {
      offset: number;
      x: number;
      fromY: number;
      toY: number;
      distance: number;
    } | null = null;
    let bestHorizontal: {
      offset: number;
      y: number;
      fromX: number;
      toX: number;
      distance: number;
    } | null = null;

    for (const node of this.renderer.nodes.values()) {
      if (!node.visible || draggedIds.has(node.id)) {
        continue;
      }
      const bounds = node.getBounds();
      if (!rectsIntersect(searchBounds, bounds)) {
        continue;
      }
      const targetXLines = [
        { key: 'start', value: bounds.x },
        { key: 'center', value: bounds.x + bounds.width / 2 },
        { key: 'end', value: bounds.x + bounds.width },
      ];
      const targetYLines = [
        { key: 'start', value: bounds.y },
        { key: 'center', value: bounds.y + bounds.height / 2 },
        { key: 'end', value: bounds.y + bounds.height },
      ];

      for (const moving of movingXLines) {
        for (const target of targetXLines) {
          if (moving.key !== target.key) {
            continue;
          }
          const dist = Math.abs(moving.value - target.value);
          if (dist > tolerance) {
            continue;
          }
          if (!bestVertical || dist < bestVertical.distance) {
            bestVertical = {
              offset: target.value - moving.value,
              x: target.value,
              fromY: Math.min(draggedBounds.y, bounds.y),
              toY: Math.max(draggedBounds.y + draggedBounds.height, bounds.y + bounds.height),
              distance: dist,
            };
          }
        }
      }

      for (const moving of movingYLines) {
        for (const target of targetYLines) {
          if (moving.key !== target.key) {
            continue;
          }
          const dist = Math.abs(moving.value - target.value);
          if (dist > tolerance) {
            continue;
          }
          if (!bestHorizontal || dist < bestHorizontal.distance) {
            bestHorizontal = {
              offset: target.value - moving.value,
              y: target.value,
              fromX: Math.min(draggedBounds.x, bounds.x),
              toX: Math.max(draggedBounds.x + draggedBounds.width, bounds.x + bounds.width),
              distance: dist,
            };
          }
        }
      }
    }

    const result = { ...totalDelta };
    if (bestVertical) {
      result.x += bestVertical.offset;
      this.alignmentGuides.push({
        orientation: 'vertical',
        position: bestVertical.x,
        from: bestVertical.fromY,
        to: bestVertical.toY,
      });
    }
    if (bestHorizontal) {
      result.y += bestHorizontal.offset;
      this.alignmentGuides.push({
        orientation: 'horizontal',
        position: bestHorizontal.y,
        from: bestHorizontal.fromX,
        to: bestHorizontal.toX,
      });
    }

    return result;
  }

  private getDraggedBounds(delta: Point): Bounds | null {
    const sources: Bounds[] = [];
    for (const node of this.draggedNodes) {
      const initial = this.initialPositions.get(node.id);
      if (!initial) continue;
      sources.push({
        x: initial.x + delta.x,
        y: initial.y + delta.y,
        width: node.width,
        height: node.height,
      });
    }
    return mergeBounds(sources);
  }
}
