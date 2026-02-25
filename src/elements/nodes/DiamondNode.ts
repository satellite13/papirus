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

  override getConnectionPointAtOutlineParam(param: number): Point {
    const center = this.getCenter();
    const hw = this._width / 2;
    const hh = this._height / 2;
    const vertices: Point[] = [
      { x: center.x, y: center.y - hh },
      { x: center.x + hw, y: center.y },
      { x: center.x, y: center.y + hh },
      { x: center.x - hw, y: center.y },
    ];
    const segLen = Math.sqrt(hw * hw + hh * hh);
    const perimeter = 4 * segLen;
    let s = ((param % 1) + 1) % 1 * perimeter;

    for (let i = 0; i < 4; i++) {
      if (s < segLen) {
        const a = vertices[i]!;
        const b = vertices[(i + 1) % 4]!;
        const t = s / segLen;
        return {
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
        };
      }
      s -= segLen;
    }
    return vertices[0]!;
  }

  override getClosestPointOnOutline(target: Point): { point: Point; param: number } {
    const center = this.getCenter();
    const hw = this._width / 2;
    const hh = this._height / 2;
    const vertices: Point[] = [
      { x: center.x, y: center.y - hh },
      { x: center.x + hw, y: center.y },
      { x: center.x, y: center.y + hh },
      { x: center.x - hw, y: center.y },
    ];
    const segLen = Math.sqrt(hw * hw + hh * hh);
    const P = 4 * segLen;

    const projectSegment = (
      ax: number, ay: number, bx: number, by: number,
      segStartParam: number
    ): { point: Point; param: number; distSq: number } => {
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((target.x - ax) * dx + (target.y - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const distSq = (target.x - px) ** 2 + (target.y - py) ** 2;
      const param = segStartParam + (t * segLen) / P;
      return { point: { x: px, y: py }, param, distSq };
    };

    let best = projectSegment(vertices[0]!.x, vertices[0]!.y, vertices[1]!.x, vertices[1]!.y, 0);
    for (let i = 1; i < 4; i++) {
      const a = vertices[i]!;
      const b = vertices[(i + 1) % 4]!;
      const r = projectSegment(a.x, a.y, b.x, b.y, (i * segLen) / P);
      if (r.distSq < best.distSq) best = r;
    }
    return { point: best.point, param: best.param };
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
