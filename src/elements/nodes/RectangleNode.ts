import { Node, type NodeOptions } from '../Node';

export interface RectangleNodeOptions extends NodeOptions {
  cornerRadius?: number;
}

/**
 * Rectangular node with optional rounded corners
 */
export class RectangleNode extends Node {
  private _cornerRadius: number;

  constructor(options: RectangleNodeOptions) {
    super(options);
    this._cornerRadius = options.cornerRadius ?? options.style?.cornerRadius ?? 0;
  }

  get typeName(): string {
    return 'rectangle';
  }

  /**
   * Corner radius for rounded rectangles
   */
  get cornerRadius(): number {
    return this._cornerRadius;
  }

  set cornerRadius(value: number) {
    if (this._cornerRadius !== value) {
      this._cornerRadius = value;
      this.markDirty();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, height } = this.getBounds();
    const radius = Math.min(this._cornerRadius, width / 2, height / 2);
    const style = this.style;
    const baseOpacity = style.opacity ?? 1;
    const fillOpacity = style.fillOpacity ?? 1;
    const strokeOpacity = style.strokeOpacity ?? 1;

    this.applyStyle(ctx);

    ctx.beginPath();

    if (radius > 0) {
      // Rounded rectangle
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.arcTo(x + width, y, x + width, y + radius, radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
      ctx.lineTo(x + radius, y + height);
      ctx.arcTo(x, y + height, x, y + height - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
    } else {
      // Sharp rectangle
      ctx.rect(x, y, width, height);
    }

    ctx.closePath();
    ctx.globalAlpha = baseOpacity * fillOpacity;
    ctx.fill();
    ctx.globalAlpha = baseOpacity * strokeOpacity;
    ctx.stroke();

    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }
}
