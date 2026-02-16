import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { SelectionManager } from './SelectionManager';
import type { InputEvent } from '@/events/InputHandler';
import type { Node } from '@/elements/Node';
import type { Point } from '@/types';

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
}

/**
 * Manages node dragging
 */
export class DragManager extends EventEmitter<DragEvents> {
  private renderer: DiagramRenderer;
  private selectionManager: SelectionManager;
  private snapToGrid: boolean;
  private gridSize: number;

  private isDragging = false;
  private draggedNodes: Node[] = [];
  private dragStartPoint: Point | null = null;
  private lastDragPoint: Point | null = null;
  private initialPositions = new Map<string, Point>();
  private _handledMouseDown = false;
  private draggedGroupSelection = false;

  constructor(options: DragManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.selectionManager = options.selectionManager;
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
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
    const edge = node === undefined && group === undefined ? this.renderer.getEdge(element.id) : undefined;
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
      const dx = point.x - this.dragStartPoint.x;
      const dy = point.y - this.dragStartPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 3) {
        return false;
      }

      // Start dragging
      this.isDragging = true;
      this._handledMouseDown = true; // Mark as handled now that drag started
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

    // Move nodes using initial position + total offset
    for (const node of this.draggedNodes) {
      const initial = this.initialPositions.get(node.id);
      if (initial === undefined) continue;

      let newX = initial.x + totalDelta.x;
      let newY = initial.y + totalDelta.y;

      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      node.x = newX;
      node.y = newY;
    }

    this.lastDragPoint = point;
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
    this.draggedGroupSelection = false;
    // Note: _handledMouseDown is reset at the start of next handleMouseDown
    // to prevent click handler from firing after mouseup
  }
}
