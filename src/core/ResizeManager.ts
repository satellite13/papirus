import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramRenderer } from './DiagramRenderer';
import type { SelectionManager } from './SelectionManager';
import type { InputEvent } from '@/events/InputHandler';
import type { Bounds, Point } from '@/types';
import type { ResizeHandle } from '@/elements/Node';

/**
 * Resize events
 */
export interface ResizeEvents {
  resizeStart: [nodeId: string, handle: ResizeHandle, startBounds: Bounds];
  resize: [nodeId: string, bounds: Bounds, delta: Point];
  resizeEnd: [nodeId: string, bounds: Bounds];
}

export interface ResizeManagerOptions {
  renderer: DiagramRenderer;
  selectionManager: SelectionManager;
  snapToGrid?: boolean;
  gridSize?: number;
  minSize?: number;
}

/**
 * Manages node resizing via corner handles
 */
export class ResizeManager extends EventEmitter<ResizeEvents> {
  private renderer: DiagramRenderer;
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
    const contentMinSize = node.getContentMinSize(this.renderer.getContext());
    this.minWidth = Math.max(this.minSize, contentMinSize.width);
    this.minHeight = Math.max(this.minSize, contentMinSize.height);
    return true;
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
      const dx = point.x - this.startPoint.x;
      const dy = point.y - this.startPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 3) {
        return false;
      }
      this.isResizing = true;
      this._handledMouseDown = true;
      node.state = 'dragging';
      this.emit('resizeStart', node.id, this.handle, this.startBounds);
    }

    const bounds = this.calculateBounds(point);
    node.x = bounds.x;
    node.y = bounds.y;
    node.width = bounds.width;
    node.height = bounds.height;

    this.emit('resize', node.id, bounds, {
      x: bounds.x - this.startBounds.x,
      y: bounds.y - this.startBounds.y,
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
