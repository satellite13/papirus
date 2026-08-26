import { EventEmitter } from '@/events/EventEmitter';
import type { DiagramSurface } from './DiagramSurface';
import type {
  InputEvent,
  WheelInputEvent,
  PanInputEvent,
  PinchInputEvent,
} from '@/events/InputHandler';
import type { Bounds, Point } from '@/types';
import { getContentBounds } from '@/utils/contentBounds';

/**
 * Navigation events
 */
export interface NavigationEvents {
  panStart: [];
  pan: [offsetX: number, offsetY: number];
  panEnd: [];
  zoomChange: [zoom: number, center: Point];
}

export interface NavigationManagerOptions {
  renderer: DiagramSurface;
  zoomSensitivity?: number;
  panButton?: number;
}

/**
 * Manages canvas panning and zooming
 */
export class NavigationManager extends EventEmitter<NavigationEvents> {
  private renderer: DiagramSurface;
  private readonly zoomSensitivity: number;
  private readonly panButton: number;

  private isPanning = false;
  private panStart: Point | null = null;
  private spacePressed = false;

  constructor(options: NavigationManagerOptions) {
    super();
    this.renderer = options.renderer;
    this.zoomSensitivity = options.zoomSensitivity ?? 0.001;
    this.panButton = options.panButton ?? 1; // Middle mouse button
  }

  /**
   * Check if currently panning
   */
  get panning(): boolean {
    return this.isPanning;
  }

  /**
   * Handle wheel event for zooming
   */
  handleWheel(event: WheelInputEvent): void {
    const sensitivity = event.ctrlKey ? this.zoomSensitivity * 0.2 : this.zoomSensitivity;
    const zoomFactor = 1 - event.deltaY * sensitivity;
    const oldZoom = this.renderer.zoom;
    const oldOffsetX = this.renderer.offsetX;
    const oldOffsetY = this.renderer.offsetY;

    // World position under cursor (calculated with old zoom)
    const worldX = event.worldX;
    const worldY = event.worldY;

    // Apply new zoom
    this.renderer.zoom = oldZoom * zoomFactor;
    const actualNewZoom = this.renderer.zoom; // may be clamped by min/max

    // Adjust offset to keep cursor at same world position
    // Formula: newOffset = oldOffset + worldPos * (oldZoom - newZoom)
    this.renderer.offsetX = oldOffsetX + worldX * (oldZoom - actualNewZoom);
    this.renderer.offsetY = oldOffsetY + worldY * (oldZoom - actualNewZoom);

    this.emit('zoomChange', this.renderer.zoom, { x: worldX, y: worldY });
  }

  /**
   * Handle touch pan gesture
   */
  handlePanGesture(event: PanInputEvent): void {
    this.renderer.offsetX += event.deltaX;
    this.renderer.offsetY += event.deltaY;
    this.emit('pan', this.renderer.offsetX, this.renderer.offsetY);
  }

  /**
   * Handle touch pinch gesture
   */
  handlePinch(event: PinchInputEvent): void {
    const oldZoom = this.renderer.zoom;
    const oldOffsetX = this.renderer.offsetX;
    const oldOffsetY = this.renderer.offsetY;

    const worldX = event.worldX;
    const worldY = event.worldY;

    this.renderer.zoom = oldZoom * event.scale;
    const actualNewZoom = this.renderer.zoom;

    this.renderer.offsetX = oldOffsetX + worldX * (oldZoom - actualNewZoom);
    this.renderer.offsetY = oldOffsetY + worldY * (oldZoom - actualNewZoom);

    this.emit('zoomChange', this.renderer.zoom, { x: worldX, y: worldY });
  }

  /**
   * Handle mouse down for panning
   */
  handleMouseDown(event: InputEvent): boolean {
    // Middle mouse button or space+left click
    if (event.button === this.panButton || (this.spacePressed && event.button === 0)) {
      this.startPan(event);
      return true;
    }
    return false;
  }

  /**
   * Handle mouse move for panning
   */
  handleMouseMove(event: InputEvent): boolean {
    if (!this.isPanning || this.panStart === null) {
      return false;
    }

    const dx = event.screenX - this.panStart.x;
    const dy = event.screenY - this.panStart.y;

    this.renderer.offsetX += dx;
    this.renderer.offsetY += dy;

    this.panStart = { x: event.screenX, y: event.screenY };
    this.emit('pan', this.renderer.offsetX, this.renderer.offsetY);

    return true;
  }

  /**
   * Handle mouse up for panning
   */
  handleMouseUp(_event: InputEvent): boolean {
    if (!this.isPanning) {
      return false;
    }

    this.endPan();
    return true;
  }

  /**
   * Handle key down for space panning
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !this.spacePressed) {
      this.spacePressed = true;
    }
  }

  /**
   * Handle key up for space panning
   */
  handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spacePressed = false;
      if (this.isPanning) {
        this.endPan();
      }
    }
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number, center?: Point): void {
    const centerPoint = center ?? {
      x: this.renderer.width / 2,
      y: this.renderer.height / 2,
    };

    const oldZoom = this.renderer.zoom;
    const oldOffsetX = this.renderer.offsetX;
    const oldOffsetY = this.renderer.offsetY;

    // Get world position at center point
    const worldPos = this.renderer.screenToWorld(centerPoint.x, centerPoint.y);

    // Apply new zoom
    this.renderer.zoom = zoom;
    const actualNewZoom = this.renderer.zoom; // may be clamped by min/max

    // Adjust offset to keep center point at same world position
    this.renderer.offsetX = oldOffsetX + worldPos.x * (oldZoom - actualNewZoom);
    this.renderer.offsetY = oldOffsetY + worldPos.y * (oldZoom - actualNewZoom);

    this.emit('zoomChange', this.renderer.zoom, centerPoint);
  }

  /**
   * Fit all content in view
   */
  fitToView(padding = 50): void {
    const bounds = getContentBounds({
      nodes: this.renderer.nodes.values(),
      includeInvisible: true,
    });
    if (bounds === null) {
      return;
    }

    this.zoomToRect(bounds, padding);
  }

  /**
   * Zoom to fit a specific rectangle
   */
  zoomToRect(rect: Bounds, padding = 50): void {
    const viewWidth = this.renderer.width - padding * 2;
    const viewHeight = this.renderer.height - padding * 2;

    const scaleX = viewWidth / rect.width;
    const scaleY = viewHeight / rect.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    this.renderer.zoom = scale;

    // Center the content
    const contentCenterX = rect.x + rect.width / 2;
    const contentCenterY = rect.y + rect.height / 2;

    this.renderer.offsetX = this.renderer.width / 2 - contentCenterX * scale;
    this.renderer.offsetY = this.renderer.height / 2 - contentCenterY * scale;

    this.emit('zoomChange', this.renderer.zoom, { x: contentCenterX, y: contentCenterY });
  }

  /**
   * Zoom to a selection bounds
   */
  zoomToSelection(bounds: Bounds, padding = 50): void {
    this.zoomToRect(bounds, padding);
  }

  /**
   * Reset view to default
   */
  resetView(): void {
    this.renderer.zoom = 1;
    this.renderer.offsetX = 0;
    this.renderer.offsetY = 0;
    this.emit('zoomChange', 1, { x: 0, y: 0 });
  }

  startPan(event: InputEvent): void {
    this.isPanning = true;
    this.panStart = { x: event.screenX, y: event.screenY };
    this.renderer.beginLowResPan();
    this.emit('panStart');
  }

  private endPan(): void {
    this.isPanning = false;
    this.panStart = null;
    this.renderer.endLowResPan();
    this.emit('panEnd');
  }
}
