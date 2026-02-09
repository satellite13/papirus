import { EventEmitter } from './EventEmitter';
import type { Point } from '@/types';

/**
 * Input events
 */
export interface InputEvents {
  click: [event: InputEvent];
  dblclick: [event: InputEvent];
  mousedown: [event: InputEvent];
  mouseup: [event: InputEvent];
  mousemove: [event: InputEvent];
  wheel: [event: WheelInputEvent];
  pan: [event: PanInputEvent];
  pinch: [event: PinchInputEvent];
  keydown: [event: KeyboardEvent];
  keyup: [event: KeyboardEvent];
}

/**
 * Normalized input event
 */
export interface InputEvent {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  button: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  originalEvent: MouseEvent | TouchEvent;
}

/**
 * Wheel input event
 */
export interface WheelInputEvent extends InputEvent {
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  originalEvent: WheelEvent;
}

/**
 * Pan gesture event (touch)
 */
export interface PanInputEvent extends InputEvent {
  deltaX: number;
  deltaY: number;
}

/**
 * Pinch gesture event (touch)
 */
export interface PinchInputEvent extends InputEvent {
  scale: number;
}

export interface InputHandlerOptions {
  canvas: HTMLCanvasElement;
  screenToWorld: (screenX: number, screenY: number) => Point;
}

/**
 * Handles mouse, touch, and keyboard input
 * Normalizes events and converts coordinates
 */
export class InputHandler extends EventEmitter<InputEvents> {
  private readonly canvas: HTMLCanvasElement;
  private screenToWorld: (screenX: number, screenY: number) => Point;
  private boundHandlers = new Map<string, EventListener>();
  private lastTouchDistance: number | null = null;
  private lastTouchCenter: Point | null = null;

  constructor(options: InputHandlerOptions) {
    super();
    this.canvas = options.canvas;
    this.screenToWorld = options.screenToWorld;
    this.setupEventListeners();
  }

  /**
   * Update the coordinate transform function
   */
  setScreenToWorld(fn: (screenX: number, screenY: number) => Point): void {
    this.screenToWorld = fn;
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    for (const [eventName, handler] of this.boundHandlers) {
      if (eventName.startsWith('key')) {
        window.removeEventListener(eventName, handler);
      } else {
        this.canvas.removeEventListener(eventName, handler);
      }
    }
    this.boundHandlers.clear();
    this.removeAllListeners();
  }

  private setupEventListeners(): void {
    // Mouse events
    this.addCanvasListener('click', this.handleClick.bind(this));
    this.addCanvasListener('dblclick', this.handleDblClick.bind(this));
    this.addCanvasListener('mousedown', this.handleMouseDown.bind(this));
    this.addCanvasListener('mouseup', this.handleMouseUp.bind(this));
    this.addCanvasListener('mousemove', this.handleMouseMove.bind(this));
    this.addCanvasListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Touch events
    this.addCanvasListener('touchstart', this.handleTouchStart.bind(this));
    this.addCanvasListener('touchend', this.handleTouchEnd.bind(this));
    this.addCanvasListener('touchmove', this.handleTouchMove.bind(this));

    // Keyboard events (on window)
    this.addWindowListener('keydown', this.handleKeyDown.bind(this));
    this.addWindowListener('keyup', this.handleKeyUp.bind(this));

    // Prevent context menu on canvas
    this.addCanvasListener('contextmenu', (e) => e.preventDefault());
  }

  private addCanvasListener(
    eventName: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    this.canvas.addEventListener(eventName, handler, options);
    this.boundHandlers.set(eventName, handler);
  }

  private addWindowListener(eventName: string, handler: EventListener): void {
    window.addEventListener(eventName, handler);
    this.boundHandlers.set(eventName, handler);
  }

  private handleClick(e: Event): void {
    const event = this.normalizeMouseEvent(e as MouseEvent);
    this.emit('click', event);
  }

  private handleDblClick(e: Event): void {
    const event = this.normalizeMouseEvent(e as MouseEvent);
    this.emit('dblclick', event);
  }

  private handleMouseDown(e: Event): void {
    const event = this.normalizeMouseEvent(e as MouseEvent);
    this.emit('mousedown', event);
  }

  private handleMouseUp(e: Event): void {
    const event = this.normalizeMouseEvent(e as MouseEvent);
    this.emit('mouseup', event);
  }

  private handleMouseMove(e: Event): void {
    const event = this.normalizeMouseEvent(e as MouseEvent);
    this.emit('mousemove', event);
  }

  private handleWheel(e: Event): void {
    e.preventDefault();
    const wheelEvent = e as WheelEvent;
    const baseEvent = this.normalizeMouseEvent(wheelEvent);
    const event: WheelInputEvent = {
      ...baseEvent,
      deltaX: wheelEvent.deltaX,
      deltaY: wheelEvent.deltaY,
      deltaZ: wheelEvent.deltaZ,
      originalEvent: wheelEvent,
    };
    this.emit('wheel', event);
  }

  private handleTouchStart(e: Event): void {
    const event = this.normalizeTouchEvent(e as TouchEvent);
    if (event !== null) {
      const touchEvent = e as TouchEvent;
      if (touchEvent.touches.length >= 2) {
        const { distance, center } = this.getTouchDistanceAndCenter(touchEvent);
        this.lastTouchDistance = distance;
        this.lastTouchCenter = center;
        return;
      }
      this.emit('mousedown', event);
    }
  }

  private handleTouchEnd(e: Event): void {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length < 2) {
      this.lastTouchDistance = null;
      this.lastTouchCenter = null;
    }

    const event = this.normalizeTouchEvent(touchEvent);
    if (event !== null) {
      this.emit('mouseup', event);
    }
  }

  private handleTouchMove(e: Event): void {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length >= 2) {
      const { distance, center } = this.getTouchDistanceAndCenter(touchEvent);
      if (this.lastTouchDistance !== null && this.lastTouchCenter !== null) {
        const deltaX = center.x - this.lastTouchCenter.x;
        const deltaY = center.y - this.lastTouchCenter.y;
        const scale = distance / this.lastTouchDistance;

        const worldPos = this.screenToWorld(center.x, center.y);
        const baseEvent: InputEvent = {
          screenX: center.x,
          screenY: center.y,
          worldX: worldPos.x,
          worldY: worldPos.y,
          button: 0,
          ctrlKey: touchEvent.ctrlKey,
          shiftKey: touchEvent.shiftKey,
          altKey: touchEvent.altKey,
          metaKey: touchEvent.metaKey,
          originalEvent: touchEvent,
        };

        if (deltaX !== 0 || deltaY !== 0) {
          this.emit('pan', { ...baseEvent, deltaX, deltaY });
        }
        if (scale !== 1) {
          this.emit('pinch', { ...baseEvent, scale });
        }
      }

      this.lastTouchDistance = distance;
      this.lastTouchCenter = center;
      return;
    }

    const event = this.normalizeTouchEvent(touchEvent);
    if (event !== null) {
      this.emit('mousemove', event);
    }
  }

  private handleKeyDown(e: Event): void {
    // Only handle if canvas has focus or no element is focused
    if (this.shouldHandleKeyboard()) {
      this.emit('keydown', e as KeyboardEvent);
    }
  }

  private handleKeyUp(e: Event): void {
    if (this.shouldHandleKeyboard()) {
      this.emit('keyup', e as KeyboardEvent);
    }
  }

  private shouldHandleKeyboard(): boolean {
    const active = document.activeElement;
    if (
      active === null ||
      active === document.body ||
      active === this.canvas ||
      active.tagName === 'CANVAS'
    ) {
      return true;
    }

    if (active instanceof HTMLElement) {
      if (active.isContentEditable) {
        return false;
      }

      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return false;
      }
    }

    return true;
  }

  private normalizeMouseEvent(e: MouseEvent): InputEvent {
    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    return {
      screenX: e.clientX,
      screenY: e.clientY,
      worldX: worldPos.x,
      worldY: worldPos.y,
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      originalEvent: e,
    };
  }

  private normalizeTouchEvent(e: TouchEvent): InputEvent | null {
    const touch = e.touches[0] ?? e.changedTouches[0];
    if (touch === undefined) {
      return null;
    }

    const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
    return {
      screenX: touch.clientX,
      screenY: touch.clientY,
      worldX: worldPos.x,
      worldY: worldPos.y,
      button: 0,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      originalEvent: e,
    };
  }

  private getTouchDistanceAndCenter(event: TouchEvent): { distance: number; center: Point } {
    const [t1, t2] = [event.touches[0], event.touches[1]];
    if (!t1 || !t2) {
      return { distance: 0, center: { x: 0, y: 0 } };
    }

    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    const center = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };

    return { distance: Math.hypot(dx, dy), center };
  }
}
