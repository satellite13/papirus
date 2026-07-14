import type { Bounds, ElementState, ElementStyle, Point, Size } from '@/types';

let nextId = 1;

/**
 * Generate a unique element ID
 */
export function generateId(prefix = 'el'): string {
  return `${prefix}_${nextId++}`;
}

/**
 * Reset ID counter (for testing)
 * @internal
 */
export function resetIdCounter(): void {
  nextId = 1;
}

/**
 * Abstract base class for all diagram elements
 */
export abstract class Element {
  readonly id: string;
  protected _x: number;
  protected _y: number;
  protected _width: number;
  protected _height: number;
  protected _state: ElementState = 'normal';
  protected _style: ElementStyle;
  protected _styleClass?: string;
  protected _dirty = true;
  protected _visible = true;
  private _dirtyListener?: () => void;

  /**
   * Custom data attached to this element
   */
  data: Record<string, unknown> = {};

  protected constructor(options: {
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style?: ElementStyle;
    styleClass?: string;
  }) {
    this.id = options.id ?? generateId();
    this._x = options.x;
    this._y = options.y;
    this._width = options.width;
    this._height = options.height;
    this._style = options.style ?? {};
    this._styleClass = options.styleClass;
  }

  /**
   * X position in world coordinates
   */
  get x(): number {
    return this._x;
  }

  set x(value: number) {
    if (this._x !== value) {
      this._x = value;
      this.markDirty();
    }
  }

  /**
   * Y position in world coordinates
   */
  get y(): number {
    return this._y;
  }

  set y(value: number) {
    if (this._y !== value) {
      this._y = value;
      this.markDirty();
    }
  }

  /**
   * Position as Point
   */
  get position(): Point {
    return { x: this._x, y: this._y };
  }

  set position(value: Point) {
    const changed = this._x !== value.x || this._y !== value.y;
    this._x = value.x;
    this._y = value.y;
    if (changed) {
      this.markDirty();
    }
  }

  /**
   * Width of the element
   */
  get width(): number {
    return this._width;
  }

  set width(value: number) {
    if (this._width !== value) {
      this._width = value;
      this.markDirty();
    }
  }

  /**
   * Height of the element
   */
  get height(): number {
    return this._height;
  }

  set height(value: number) {
    if (this._height !== value) {
      this._height = value;
      this.markDirty();
    }
  }

  /**
   * Size as Size object
   */
  get size(): Size {
    return { width: this._width, height: this._height };
  }

  set size(value: Size) {
    const changed = this._width !== value.width || this._height !== value.height;
    this._width = value.width;
    this._height = value.height;
    if (changed) {
      this.markDirty();
    }
  }

  /**
   * Current interaction state
   */
  get state(): ElementState {
    return this._state;
  }

  set state(value: ElementState) {
    if (this._state !== value) {
      this._state = value;
      this.markDirty();
    }
  }

  /**
   * Style properties
   */
  get style(): ElementStyle {
    return this._style;
  }

  set style(value: ElementStyle) {
    this._style = value;
    this.markDirty();
  }

  /**
   * Raw style overrides (without theme/class merge)
   */
  get styleOverrides(): ElementStyle {
    return this._style;
  }

  /**
   * Clear raw style overrides
   */
  clearStyleOverrides(): void {
    if (Object.keys(this._style).length === 0) {
      return;
    }
    this._style = {};
    this.markDirty();
  }

  /**
   * Style class name for StyleManager
   */
  get styleClass(): string | undefined {
    return this._styleClass;
  }

  set styleClass(value: string | undefined) {
    if (this._styleClass !== value) {
      this._styleClass = value;
      this.markDirty();
    }
  }

  /**
   * Whether the element needs to be re-rendered
   */
  get dirty(): boolean {
    return this._dirty;
  }

  /**
   * Whether the element is visible
   */
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (this._visible !== value) {
      this._visible = value;
      this.markDirty();
    }
  }

  /**
   * Mark this element as needing re-render
   */
  markDirty(): void {
    this._dirty = true;
    this._dirtyListener?.();
  }

  /**
   * Clear the dirty flag after rendering
   */
  clearDirty(): void {
    this._dirty = false;
  }

  /**
   * Register a dirty listener (used by DiagramRenderer)
   */
  setDirtyListener(listener?: () => void): void {
    this._dirtyListener = listener;
  }

  /**
   * Get the bounding box of this element
   */
  getBounds(): Bounds {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    };
  }

  /**
   * Get the center point of this element
   */
  getCenter(): Point {
    return {
      x: this._x + this._width / 2,
      y: this._y + this._height / 2,
    };
  }

  /**
   * Test if a point is within this element
   * @param point - Point in world coordinates
   */
  abstract hitTest(point: Point): boolean;

  /**
   * Render this element to the canvas
   * @param ctx - Canvas rendering context
   */
  abstract render(ctx: CanvasRenderingContext2D): void;
}
