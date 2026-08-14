import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Bounds, Point } from '@/types';

/**
 * Ellipse/circle node
 */
export class CircleNode extends Node {
  constructor(options: NodeOptions) {
    super(options);
  }

  get typeName(): string {
    return 'circle';
  }

  /**
   * Horizontal radius
   */
  get radiusX(): number {
    return this._width / 2;
  }

  /**
   * Vertical radius
   */
  get radiusY(): number {
    return this._height / 2;
  }

  override hitTest(point: Point): boolean {
    const center = this.getCenter();
    const padding = NODE_HITBOX_PADDING;
    const rx = this._width / 2 + padding;
    const ry = this._height / 2 + padding;

    // Ellipse equation: (x-h)²/rx² + (y-k)²/ry² <= 1
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }

  override getOutlineDirection(param: number): 'top' | 'right' | 'bottom' | 'left' {
    return this.outlineDirectionFromCenter(param);
  }

  override getConnectionPointAtOutlineParam(param: number): Point {
    const center = this.getCenter();
    const rx = this._width / 2;
    const ry = this._height / 2;
    const t = ((param % 1) + 1) % 1 * Math.PI * 2;
    const angle = Math.PI * 1.5 - t;
    return {
      x: center.x + rx * Math.cos(angle),
      y: center.y + ry * Math.sin(angle),
    };
  }

  override getClosestPointOnOutline(target: Point): { point: Point; param: number } {
    const point = this.getOutlinePointToward(target);
    const center = this.getCenter();
    const rx = this._width / 2;
    const ry = this._height / 2;
    const t = Math.atan2(
      (point.y - center.y) / ry,
      (point.x - center.x) / rx
    );
    const param = (Math.PI * 1.5 - t) / (Math.PI * 2);
    const normalizedParam = ((param % 1) + 1) % 1;
    return { point, param: normalizedParam };
  }

  protected override getOutlinePointToward(target: Point): Point {
    const center = this.getCenter();
    const rx = this._width / 2;
    const ry = this._height / 2;
    const dx = target.x - center.x;
    const dy = target.y - center.y;

    if (dx === 0 && dy === 0) {
      return center;
    }

    const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    };
  }

  protected override getLabelContainerBounds(bounds: Bounds): Bounds {
    const width = bounds.width / Math.SQRT2;
    const height = bounds.height / Math.SQRT2;
    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const center = this.getCenter();
    const rx = this._width / 2;
    const ry = this._height / 2;
    const style = this.style;
    const baseOpacity = style.opacity ?? 1;
    const fillOpacity = style.fillOpacity ?? 1;
    const strokeOpacity = style.strokeOpacity ?? 1;

    this.applyStyle(ctx);

    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.globalAlpha = baseOpacity * fillOpacity;
    ctx.fill();
    ctx.globalAlpha = baseOpacity * strokeOpacity;
    ctx.stroke();

    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }
}
