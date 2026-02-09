import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Point } from '@/types';

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

  render(ctx: CanvasRenderingContext2D): void {
    const center = this.getCenter();
    const rx = this._width / 2;
    const ry = this._height / 2;

    this.applyStyle(ctx);

    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }
}
