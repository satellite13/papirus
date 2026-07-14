import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramSurface } from './DiagramSurface';
import type { Node } from '@/elements/Node';
import type { InputEvent } from '@/events/InputHandler';
import type { Bounds, Point } from '@/types';
import { rectsIntersect } from '@/utils/geometry';
import { SELECTION_RECT_MIN_SIZE, DEFAULT_SELECTION_COLOR } from '@/constants';

/**
 * Selection events
 */
export interface SelectionEvents {
  select: [selectedIds: string[]];
  selectionStart: [point: Point];
  selectionMove: [bounds: Bounds];
  selectionEnd: [bounds: Bounds];
}

/**
 * Manages element selection
 */
export class SelectionManager extends EventEmitter<SelectionEvents> {
  private renderer: DiagramSurface;
  private _selectedIds = new Set<string>();
  private selectionStart: Point | null = null;
  private selectionRect: Bounds | null = null;

  constructor(renderer: DiagramSurface) {
    super();
    this.renderer = renderer;
  }

  /**
   * Currently selected element IDs
   */
  get selectedIds(): ReadonlySet<string> {
    return this._selectedIds;
  }

  /**
   * Current selection rectangle (during drag selection)
   */
  get selectionRectangle(): Bounds | null {
    return this.selectionRect;
  }

  /**
   * Check if an element is selected
   */
  isSelected(elementId: string): boolean {
    return this._selectedIds.has(elementId);
  }

  /**
   * Select a single element
   */
  select(elementId: string): void {
    this.clearSelection();
    this._selectedIds.add(elementId);
    this.updateElementStates();
    this.emitSelect();
  }

  /**
   * Add element to selection
   */
  addToSelection(elementId: string): void {
    this._selectedIds.add(elementId);
    this.updateElementStates();
    this.emitSelect();
  }

  /**
   * Remove element from selection
   */
  removeFromSelection(elementId: string): void {
    this._selectedIds.delete(elementId);
    this.updateElementStates();
    this.emitSelect();
  }

  /**
   * Toggle element selection
   */
  toggleSelection(elementId: string): void {
    if (this._selectedIds.has(elementId)) {
      this._selectedIds.delete(elementId);
    } else {
      this._selectedIds.add(elementId);
    }
    this.updateElementStates();
    this.emitSelect();
  }

  /**
   * Select multiple elements
   */
  selectMultiple(elementIds: string[]): void {
    this.clearSelection();
    for (const id of elementIds) {
      this._selectedIds.add(id);
    }
    this.updateElementStates();
    this.emitSelect();
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    if (this._selectedIds.size > 0) {
      this._selectedIds.clear();
      this.updateElementStates();
      this.emitSelect();
    }
  }

  /**
   * Handle click event
   */
  handleClick(event: InputEvent): void {
    const point = { x: event.worldX, y: event.worldY };
    const element = this.renderer.getInteractableElementAtPoint(
      point,
      event.screenX,
      event.screenY
    );

    if (element === undefined) {
      if (!event.ctrlKey && !event.metaKey) {
        this.clearSelection();
      }
      return;
    }

    const node = element as Node;
    if (typeof node.getBadgeAtPoint === 'function') {
      const badge = node.getBadgeAtPoint(point);
      if (badge !== null) {
        this.renderer.emit('nodeBadgeClick', element.id, badge.id);
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      this.toggleSelection(element.id);
    } else {
      this.select(element.id);
    }
  }

  /**
   * Start selection rectangle
   */
  startSelectionRect(point: Point): void {
    this.selectionStart = point;
    this.selectionRect = { x: point.x, y: point.y, width: 0, height: 0 };
    this.emit('selectionStart', point);
  }

  /**
   * Update selection rectangle
   */
  updateSelectionRect(point: Point): void {
    if (this.selectionStart === null) {
      return;
    }

    const x = Math.min(this.selectionStart.x, point.x);
    const y = Math.min(this.selectionStart.y, point.y);
    const width = Math.abs(point.x - this.selectionStart.x);
    const height = Math.abs(point.y - this.selectionStart.y);

    this.selectionRect = { x, y, width, height };
    this.emit('selectionMove', this.selectionRect);
    this.renderer.markDirty();
  }

  /**
   * End selection rectangle and select enclosed elements
   */
  endSelectionRect(): void {
    if (this.selectionRect === null) {
      return;
    }

    const rect = this.selectionRect;
    const selected: string[] = [];

    // Find nodes within selection rect
    for (const node of this.renderer.nodes.values()) {
      const bounds = node.getBounds();
      if (rectsIntersect(rect, bounds)) {
        selected.push(node.id);
      }
    }

    // Find groups within selection rect
    for (const group of this.renderer.groups.values()) {
      const bounds = group.getBounds();
      if (rectsIntersect(rect, bounds)) {
        selected.push(group.id);
      }
    }

    if (selected.length > 0) {
      this.selectMultiple(selected);
    }

    this.emit('selectionEnd', rect);
    this.selectionStart = null;
    this.selectionRect = null;
    this.renderer.markDirty();
  }

  /**
   * Cancel selection rectangle
   */
  cancelSelectionRect(): void {
    this.selectionStart = null;
    this.selectionRect = null;
    this.renderer.markDirty();
  }

  /**
   * Render selection rectangle
   */
  renderSelectionRect(ctx: CanvasRenderingContext2D): void {
    if (this.selectionRect === null) {
      return;
    }

    const { x, y, width, height } = this.selectionRect;

    // Skip if rectangle is too small (just started)
    if (width < SELECTION_RECT_MIN_SIZE && height < SELECTION_RECT_MIN_SIZE) {
      return;
    }

    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = DEFAULT_SELECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }

  private updateElementStates(): void {
    const updateState = (elements: Iterable<{ id: string; state: string }>): void => {
      for (const element of elements) {
        if (this._selectedIds.has(element.id)) {
          element.state = 'selected';
        } else if (element.state === 'selected') {
          element.state = 'normal';
        }
      }
    };

    updateState(this.renderer.nodes.values());
    updateState(this.renderer.edges.values());
    updateState(this.renderer.groups.values());

    this.renderer.markDirty();
    this.renderer.markStyleDirty();
  }

  private emitSelect(): void {
    this.emit('select', Array.from(this._selectedIds));
    this.renderer.emit('select', Array.from(this._selectedIds));
  }
}
