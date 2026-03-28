import { Node, type NodeOptions } from '../Node';
import type { Bounds, Point, Size } from '@/types';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { CComponent } from './CComponent';
import type { CContainer } from './CContainer';

export type CompositeShapeType = 'rectangle' | 'circle' | 'diamond' | 'custom';

export interface CompositeNodeOptions extends NodeOptions {
  content: CContainer;
  shapeType?: CompositeShapeType;
  cornerRadius?: number;
  pathFactory?: (width: number, height: number) => Path2D;
  autoSize?: boolean;
  minWidth?: number;
  minHeight?: number;
}

/**
 * A node that renders a tree of child components (CText, CIcon, CShape, CDivider, CContainer)
 * arranged via a flexbox-like layout engine.
 */
export class CompositeNode extends Node {
  private _content: CContainer;
  private _shapeType: CompositeShapeType;
  private _cornerRadius: number;
  private _pathFactory?: (width: number, height: number) => Path2D;
  private _autoSize: boolean;
  private _minWidth: number;
  private _minHeight: number;

  constructor(options: CompositeNodeOptions) {
    super(options);
    this._content = options.content;
    this._shapeType = options.shapeType ?? 'rectangle';
    this._cornerRadius = options.cornerRadius ?? 0;
    this._pathFactory = options.pathFactory;
    this._autoSize = options.autoSize ?? true;
    this._minWidth = options.minWidth ?? 0;
    this._minHeight = options.minHeight ?? 0;

    // Wire content dirty propagation to node
    this._content.setOnChange(() => this.markDirty());
  }

  get typeName(): string {
    return 'composite';
  }

  get content(): CContainer {
    return this._content;
  }

  get shapeType(): CompositeShapeType {
    return this._shapeType;
  }

  get cornerRadius(): number {
    return this._cornerRadius;
  }

  get autoSize(): boolean {
    return this._autoSize;
  }
  set autoSize(value: boolean) {
    if (this._autoSize !== value) {
      this._autoSize = value;
      this.markDirty();
    }
  }

  get minWidth(): number {
    return this._minWidth;
  }

  get minHeight(): number {
    return this._minHeight;
  }

  /**
   * Find a component by id in the content tree.
   */
  getComponent(id: string): CComponent | undefined {
    if (this._content.id === id) return this._content;
    return this._content.findById(id);
  }

  /**
   * Hit test the component tree. Returns the deepest component at the given world point.
   */
  getComponentAtPoint(worldPoint: Point): CComponent | null {
    const bounds = this.getContentBounds();
    return this._content.hitTest(worldPoint, bounds);
  }

  private getContentBounds(): Bounds {
    return this.getLabelContainerBounds(this.getBounds());
  }

  // --- Shape rendering ---

  override hitTest(point: Point): boolean {
    if (this._shapeType === 'circle') {
      return this.hitTestEllipse(point);
    }
    if (this._shapeType === 'diamond') {
      return this.hitTestDiamond(point);
    }
    // rectangle, custom — bounding box
    return super.hitTest(point);
  }

  private hitTestEllipse(point: Point): boolean {
    const center = this.getCenter();
    const padding = NODE_HITBOX_PADDING;
    const rx = this._width / 2 + padding;
    const ry = this._height / 2 + padding;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }

  private hitTestDiamond(point: Point): boolean {
    const center = this.getCenter();
    const padding = NODE_HITBOX_PADDING;
    const hw = this._width / 2 + padding;
    const hh = this._height / 2 + padding;
    const dx = Math.abs(point.x - center.x);
    const dy = Math.abs(point.y - center.y);
    return dx / hw + dy / hh <= 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Auto-size BEFORE drawing shape so bounds are correct
    if (this._autoSize) {
      this.applyAutoSize(ctx);
    }

    const { x, y, width, height } = this.getBounds();
    const style = this.style;
    const baseOpacity = style.opacity ?? 1;
    const fillOpacity = style.fillOpacity ?? 1;
    const strokeOpacity = style.strokeOpacity ?? 1;

    this.applyStyle(ctx);

    // Draw outer shape
    ctx.beginPath();
    this.buildShapePath(ctx, x, y, width, height);
    ctx.closePath();

    ctx.globalAlpha = baseOpacity * fillOpacity;
    ctx.fill();
    ctx.globalAlpha = baseOpacity * strokeOpacity;
    ctx.stroke();
    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }

  private buildShapePath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    switch (this._shapeType) {
      case 'circle': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      }
      case 'diamond': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, cy);
        ctx.lineTo(cx, y + h);
        ctx.lineTo(x, cy);
        break;
      }
      case 'custom': {
        if (this._pathFactory) {
          const path = this._pathFactory(w, h);
          // Save/restore to translate path to position
          ctx.save();
          ctx.translate(x, y);
          ctx.fill(path);
          ctx.stroke(path);
          ctx.restore();
          return; // path already filled/stroked
        }
        // Fallback to rectangle
        this.buildRectPath(ctx, x, y, w, h);
        break;
      }
      default:
        // rectangle
        this.buildRectPath(ctx, x, y, w, h);
        break;
    }
  }

  private buildRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const radius = Math.min(this._cornerRadius, w / 2, h / 2);
    if (radius > 0) {
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  // --- Content rendering (overrides Node.renderContents) ---

  protected override renderContents(ctx: CanvasRenderingContext2D): void {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    const contentBounds = this.getContentBounds();
    this._content.render(ctx, contentBounds);

    // Render ports (from Node)
    this.renderPorts(ctx);
  }

  private applyAutoSize(ctx: CanvasRenderingContext2D): void {
    const contentSize = this._content.measure(ctx);
    const inset = this.contentInset;

    const neededWidth = Math.max(
      this._minWidth,
      contentSize.width + inset.left + inset.right
    );
    const neededHeight = Math.max(
      this._minHeight,
      contentSize.height + inset.top + inset.bottom
    );

    // Only grow, never shrink
    if (neededWidth > this._width) {
      this._width = neededWidth;
    }
    if (neededHeight > this._height) {
      this._height = neededHeight;
    }
  }

  /** Debug: get measured content size (call with canvas context). */
  debugMeasure(ctx: CanvasRenderingContext2D): {
    contentSize: { width: number; height: number };
    nodeSize: { width: number; height: number };
    inset: { top: number; right: number; bottom: number; left: number };
  } {
    return {
      contentSize: this._content.measure(ctx),
      nodeSize: { width: this._width, height: this._height },
      inset: this.contentInset,
    };
  }

  // --- Outline methods for connections (delegate based on shapeType) ---

  override getLabelContainerBounds(bounds: Bounds): Bounds {
    if (this._shapeType === 'circle') {
      // Inscribed rectangle in ellipse
      const factor = 1 / Math.SQRT2;
      const w = bounds.width * factor;
      const h = bounds.height * factor;
      return {
        x: bounds.x + (bounds.width - w) / 2,
        y: bounds.y + (bounds.height - h) / 2,
        width: w,
        height: h,
      };
    }
    if (this._shapeType === 'diamond') {
      // Inscribed rectangle in diamond (half size)
      const w = bounds.width / 2;
      const h = bounds.height / 2;
      return {
        x: bounds.x + (bounds.width - w) / 2,
        y: bounds.y + (bounds.height - h) / 2,
        width: w,
        height: h,
      };
    }

    // Apply contentInset
    const ci = this.contentInset;
    return {
      x: bounds.x + ci.left,
      y: bounds.y + ci.top,
      width: Math.max(0, bounds.width - ci.left - ci.right),
      height: Math.max(0, bounds.height - ci.top - ci.bottom),
    };
  }

  /**
   * Get the minimum content size needed for the content tree.
   * Useful for external auto-sizing logic.
   */
  getContentMinSize(ctx: CanvasRenderingContext2D): Size {
    return this._content.measure(ctx);
  }
}
