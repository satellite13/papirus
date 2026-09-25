import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramSurface } from './DiagramSurface';
import type { SelectionManager } from './SelectionManager';
import type { InputEvent } from '@/events/InputHandler';
import type { Bounds, Point } from '@/types';
import type { Node, ResizeHandle } from '@/elements/Node';
import { distance } from '@/utils/geometry';

function cursorForResizeHandle(handle: ResizeHandle): string {
  return handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize';
}

/**
 * Resize events
 */
export interface ResizeEvents {
  resizeStart: [nodeId: string, handle: ResizeHandle, startBounds: Bounds];
  resize: [nodeId: string, bounds: Bounds, delta: Point];
  resizeEnd: [nodeId: string, bounds: Bounds];
}

export interface ResizeManagerOptions {
  renderer: DiagramSurface;
  selectionManager: SelectionManager;
  snapToGrid?: boolean;
  gridSize?: number;
  minSize?: number;
}

/**
 * Manages node resizing via corner handles
 */
export class ResizeManager extends EventEmitter<ResizeEvents> {
  private renderer: DiagramSurface;
  private selectionManager: SelectionManager;
  private snapToGrid: boolean;
  private gridSize: number;
  private readonly minSize: number;
  private minWidth: number;
  private minHeight: number;

  private isResizing = false;
  private resizedNodeId: string | null = null;
  private handle: ResizeHandle | null = null;
  private startPoint: Point | null = null;
  private startBounds: Bounds | null = null;
  private _handledMouseDown = false;

  constructor(options: ResizeManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.selectionManager = options.selectionManager;
    this.snapToGrid = options.snapToGrid ?? false;
    this.gridSize = options.gridSize ?? 20;
    this.minSize = options.minSize ?? 20;
    this.minWidth = this.minSize;
    this.minHeight = this.minSize;
  }

  /**
   * Check if currently resizing
   */
  get resizing(): boolean {
    return this.isResizing;
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
   * Handle mouse down - start potential resize
   */
  handleMouseDown(event: InputEvent): boolean {
    this._handledMouseDown = false;

    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return false;
    }

    const selectedIds = Array.from(this.selectionManager.selectedIds);
    if (selectedIds.length !== 1) {
      return false;
    }

    const node = this.renderer.getNode(selectedIds[0]!);
    if (!node) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };
    const hit = node.hitTestResizeHandle(point);
    if (!hit) {
      return false;
    }

    this.resizedNodeId = node.id;
    this.handle = hit;
    this.startPoint = point;
    this.startBounds = node.getBounds();
    this.updateMinSize(node, this.startBounds.width);
    return true;
  }

  /**
   * Recompute content minimums at the given width: as the node narrows, text
   * wraps and the height floor grows to fit the wrapped lines.
   */
  private updateMinSize(node: Node, width: number): void {
    const contentMinSize = node.getContentMinSize(this.renderer.getContext(), width);
    this.minWidth = Math.max(this.minSize, contentMinSize.width);
    this.minHeight = Math.max(this.minSize, contentMinSize.height);
  }

  /**
   * Set canvas cursor when the pointer is over a selected node's resize handle.
   * Call after badge/connection hover so the resize cursor wins on corners.
   */
  updateHoverCursor(event: InputEvent): void {
    if (this.renderer.blocksDiagramPointerAtScreen(event.screenX, event.screenY)) {
      return;
    }

    const handle = this.isResizing ? this.handle : this.hitTestSelectedHandle(event);
    if (!handle) {
      return;
    }

    this.setCursor(cursorForResizeHandle(handle));
  }

  /**
   * Handle mouse move - update resize
   */
  handleMouseMove(event: InputEvent): boolean {
    if (!this.startPoint || !this.startBounds || !this.resizedNodeId || !this.handle) {
      return false;
    }

    const node = this.renderer.getNode(this.resizedNodeId);
    if (!node) {
      return false;
    }

    const point = { x: event.worldX, y: event.worldY };

    if (!this.isResizing) {
      const dist = distance(point, this.startPoint);
      if (dist < 3) {
        return false;
      }
      this.isResizing = true;
      this._handledMouseDown = true;
      node.state = 'dragging';
      this.emit('resizeStart', node.id, this.handle, this.startBounds);
    }

    // Refresh content minimums at the prospective width BEFORE clamping: a
    // stale height floor from a narrower position must not stick as the node
    // widens again (clamps are one-directional, so fresh values come first).
    const dx = point.x - this.startPoint.x;
    const prospectiveWidth = this.handle.includes('w')
      ? this.startBounds.width - dx
      : this.startBounds.width + dx;
    this.updateMinSize(node, prospectiveWidth);

    const bounds = this.calculateBounds(point);
    // Recompute at the final (post-snap) width, then re-clamp: grid snapping
    // can narrow the width and raise the height floor.
    this.updateMinSize(node, bounds.width);
    const clamped = this.applyMinSize(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      this.startBounds,
      this.handle
    );
    node.x = clamped.x;
    node.y = clamped.y;
    node.width = clamped.width;
    node.height = clamped.height;

    this.emit('resize', node.id, clamped, {
      x: clamped.x - this.startBounds.x,
      y: clamped.y - this.startBounds.y,
    });
    this.renderer.markDirty();
    return true;
  }

  /**
   * Handle mouse up - end resize
   */
  handleMouseUp(): boolean {
    if (!this.startPoint || !this.startBounds || !this.resizedNodeId) {
      return false;
    }

    const node = this.renderer.getNode(this.resizedNodeId);
    const wasResizing = this.isResizing;
    if (this.isResizing && node) {
      node.state = 'selected';
      this.emit('resizeEnd', node.id, node.getBounds());
    }

    this.reset();
    this.renderer.markDirty();
    return wasResizing;
  }

  /**
   * Cancel current resize operation
   */
  cancelResize(): void {
    if (this.isResizing && this.resizedNodeId && this.startBounds) {
      const node = this.renderer.getNode(this.resizedNodeId);
      if (node) {
        node.x = this.startBounds.x;
        node.y = this.startBounds.y;
        node.width = this.startBounds.width;
        node.height = this.startBounds.height;
        node.state = 'selected';
      }
    }

    this.reset();
    this.renderer.markDirty();
  }

  private calculateBounds(point: Point): Bounds {
    const start = this.startBounds!;
    const handle = this.handle!;
    const dx = point.x - this.startPoint!.x;
    const dy = point.y - this.startPoint!.y;

    let x = start.x;
    let y = start.y;
    let width = start.width;
    let height = start.height;

    if (handle.includes('e')) {
      width = start.width + dx;
    }
    if (handle.includes('s')) {
      height = start.height + dy;
    }
    if (handle.includes('w')) {
      x = start.x + dx;
      width = start.width - dx;
    }
    if (handle.includes('n')) {
      y = start.y + dy;
      height = start.height - dy;
    }

    ({ x, y, width, height } = this.applyMinSize(x, y, width, height, start, handle));

    if (this.snapToGrid) {
      const snap = (value: number): number => Math.round(value / this.gridSize) * this.gridSize;
      let right = x + width;
      let bottom = y + height;

      if (handle.includes('w')) {
        x = snap(x);
      }
      if (handle.includes('e')) {
        right = snap(right);
      }
      if (handle.includes('n')) {
        y = snap(y);
      }
      if (handle.includes('s')) {
        bottom = snap(bottom);
      }

      width = right - x;
      height = bottom - y;
      ({ x, y, width, height } = this.applyMinSize(x, y, width, height, start, handle));
    }

    return { x, y, width, height };
  }

  private applyMinSize(
    x: number,
    y: number,
    width: number,
    height: number,
    start: Bounds,
    handle: ResizeHandle
  ): Bounds {
    if (width < this.minWidth) {
      width = this.minWidth;
      if (handle.includes('w')) {
        x = start.x + start.width - this.minWidth;
      }
    }

    if (height < this.minHeight) {
      height = this.minHeight;
      if (handle.includes('n')) {
        y = start.y + start.height - this.minHeight;
      }
    }

    return { x, y, width, height };
  }

  private hitTestSelectedHandle(event: InputEvent): ResizeHandle | null {
    const selectedIds = Array.from(this.selectionManager.selectedIds);
    if (selectedIds.length !== 1) {
      return null;
    }

    const node = this.renderer.getNode(selectedIds[0]!);
    if (!node) {
      return null;
    }

    return node.hitTestResizeHandle({ x: event.worldX, y: event.worldY });
  }

  private setCursor(cursor: string): void {
    const canvas = this.renderer.getCanvas();
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  }

  private reset(): void {
    this.isResizing = false;
    this.resizedNodeId = null;
    this.handle = null;
    this.startPoint = null;
    this.startBounds = null;
    this.minWidth = this.minSize;
    this.minHeight = this.minSize;
  }
}
