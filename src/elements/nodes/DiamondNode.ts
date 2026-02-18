import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Bounds, Point } from '@/types';

/**
 * Diamond/rhombus node for decision points
 */
export class DiamondNode extends Node {
  constructor(options: NodeOptions) {
    super(options);
  }

  get typeName(): string {
    return 'diamond';
  }

  override hitTest(point: Point): boolean {
    // Check if point is inside the diamond
    const center = this.getCenter();
    const padding = NODE_HITBOX_PADDING;
    const hw = this._width / 2 + padding;
    const hh = this._height / 2 + padding;

    // Use normalized distance formula for diamond/rhombus
    // Point is inside if |dx|/hw + |dy|/hh <= 1
    const dx = Math.abs(point.x - center.x);
    const dy = Math.abs(point.y - center.y);

    return dx / hw + dy / hh <= 1;
  }

  protected override getOutlinePointToward(target: Point): Point {
    const center = this.getCenter();
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    const hw = this._width / 2;
    const hh = this._height / 2;

    if (dx === 0 && dy === 0) {
      return center;
    }

    const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    return {
      x: center.x + dx * t,
      y: center.y + dy * t,
    };
  }

  protected override getLabelContainerBounds(bounds: Bounds): Bounds {
    const width = bounds.width / 2;
    const height = bounds.height / 2;
    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const center = this.getCenter();
    const hw = this._width / 2;
    const hh = this._height / 2;

    this.applyStyle(ctx);

    ctx.beginPath();
    ctx.moveTo(center.x, center.y - hh); // Top
    ctx.lineTo(center.x + hw, center.y); // Right
    ctx.lineTo(center.x, center.y + hh); // Bottom
    ctx.lineTo(center.x - hw, center.y); // Left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }
}
