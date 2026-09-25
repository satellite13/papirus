import type { Bounds, Size } from '@/types';
import {
  normalizeSides,
  type CComponent,
  type CComponentStyle,
  type SerializedCComponent,
  type SidesConfig,
} from './CComponent';
import type { CContainer } from './CContainer';
import { CompositeComponentBase } from './CompositeComponentBase';

export interface CShapeOptions {
  id?: string;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  cornerRadius?: number;
  padding?: number | SidesConfig;
  onClick?: (component: CComponent) => void;
  content?: CContainer;
  style?: CComponentStyle;
}

/**
 * A bordered box component for CompositeNode.
 * Can contain a CContainer for recursive composition (e.g. UML class sections).
 */
export class CShape extends CompositeComponentBase {
  readonly type = 'shape' as const;
  readonly id?: string;
  style: CComponentStyle;
  onClick?: (component: CComponent) => void;

  private _borderColor?: string;
  private _borderWidth: number;
  private _backgroundColor?: string;
  private _cornerRadius: number;
  private _padding: number | SidesConfig;
  private _content?: CContainer;

  constructor(options: CShapeOptions = {}) {
    super();
    this.id = options.id;
    this._borderColor = options.borderColor;
    this._borderWidth = options.borderWidth ?? 0;
    this._backgroundColor = options.backgroundColor;
    this._cornerRadius = options.cornerRadius ?? 0;
    this._padding = options.padding ?? 0;
    this.onClick = options.onClick;
    this._content = options.content;
    this.style = options.style ?? {};

    if (this._content) {
      this._content.setOnChange(() => this.markChanged());
    }
  }

  get borderColor(): string | undefined {
    return this._borderColor;
  }
  set borderColor(value: string | undefined) {
    if (this._borderColor !== value) {
      this._borderColor = value;
      this.markChanged();
    }
  }

  get borderWidth(): number {
    return this._borderWidth;
  }
  set borderWidth(value: number) {
    if (this._borderWidth !== value) {
      this._borderWidth = value;
      this.markChanged();
    }
  }

  get backgroundColor(): string | undefined {
    return this._backgroundColor;
  }
  set backgroundColor(value: string | undefined) {
    if (this._backgroundColor !== value) {
      this._backgroundColor = value;
      this.markChanged();
    }
  }

  get cornerRadius(): number {
    return this._cornerRadius;
  }

  get padding(): number | SidesConfig {
    return this._padding;
  }

  get content(): CContainer | undefined {
    return this._content;
  }

  measure(ctx: CanvasRenderingContext2D, maxWidth?: number): Size {
    const pad = normalizeSides(this._padding);
    const bw = this._borderWidth;

    if (this._content) {
      const innerWidth =
        maxWidth === undefined ? undefined : Math.max(0, maxWidth - pad.left - pad.right - bw * 2);
      const contentSize = this._content.measure(ctx, innerWidth);
      return {
        width: contentSize.width + pad.left + pad.right + bw * 2,
        height: contentSize.height + pad.top + pad.bottom + bw * 2,
      };
    }

    return {
      width: pad.left + pad.right + bw * 2,
      height: pad.top + pad.bottom + bw * 2,
    };
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    ctx.save();
    ctx.globalAlpha *= this.style.opacity ?? 1;

    const { x, y, width, height } = bounds;

    // Draw background
    if (this._backgroundColor) {
      ctx.fillStyle = this._backgroundColor;
      if (this._cornerRadius > 0 && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, this._cornerRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
    }

    // Draw border
    if (this._borderColor && this._borderWidth > 0) {
      ctx.strokeStyle = this._borderColor;
      ctx.lineWidth = this._borderWidth;
      if (this._cornerRadius > 0 && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, this._cornerRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, width, height);
      }
    }

    // Render content within padded area
    if (this._content) {
      const pad = normalizeSides(this._padding);
      const bw = this._borderWidth;
      this._content.render(ctx, {
        x: x + pad.left + bw,
        y: y + pad.top + bw,
        width: Math.max(0, width - pad.left - pad.right - bw * 2),
        height: Math.max(0, height - pad.top - pad.bottom - bw * 2),
      });
    }

    ctx.restore();
  }

  hitTest(point: { x: number; y: number }, bounds: Bounds): CComponent | null {
    if (!super.hitTest(point, bounds)) return null;

    // Try to hit test content first
    if (this._content) {
      const pad = normalizeSides(this._padding);
      const bw = this._borderWidth;
      const contentBounds = {
        x: bounds.x + pad.left + bw,
        y: bounds.y + pad.top + bw,
        width: Math.max(0, bounds.width - pad.left - pad.right - bw * 2),
        height: Math.max(0, bounds.height - pad.top - pad.bottom - bw * 2),
      };
      const hit = this._content.hitTest(point, contentBounds);
      if (hit) return hit;
    }

    // Return self as the hit target
    return this;
  }

  serialize(): SerializedCComponent {
    const data: SerializedCComponent = { type: 'shape' };
    if (this.id !== undefined) data.id = this.id;
    if (this.style && Object.keys(this.style).length > 0) data.style = this.style;
    if (this._borderColor) data.borderColor = this._borderColor;
    if (this._borderWidth !== 0) data.borderWidth = this._borderWidth;
    if (this._backgroundColor) data.backgroundColor = this._backgroundColor;
    if (this._cornerRadius !== 0) data.cornerRadius = this._cornerRadius;
    if (
      (typeof this._padding === 'number' && this._padding !== 0) ||
      (typeof this._padding === 'object' &&
        Object.values(this._padding).some((v) => v !== undefined && v !== 0))
    ) {
      data.padding = this._padding;
    }
    if (this._content) {
      data.content = this._content.serialize();
    }
    return data;
  }

  toSVG(bounds: Bounds): string {
    if (this.style.visible === false) return '';

    let svg = '';
    const { x, y, width, height } = bounds;

    // Background + border rect
    const hasFill = !!this._backgroundColor;
    const hasStroke = !!this._borderColor && this._borderWidth > 0;

    if (hasFill || hasStroke) {
      const fill = hasFill ? `fill="${this._backgroundColor}"` : 'fill="none"';
      const stroke = hasStroke
        ? `stroke="${this._borderColor}" stroke-width="${this._borderWidth}"`
        : '';
      const rx = this._cornerRadius > 0 ? ` rx="${this._cornerRadius}"` : '';
      svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${fill} ${stroke}${rx} />`;
    }

    // Content
    if (this._content) {
      const pad = normalizeSides(this._padding);
      const bw = this._borderWidth;
      svg += this._content.toSVG({
        x: x + pad.left + bw,
        y: y + pad.top + bw,
        width: Math.max(0, width - pad.left - pad.right - bw * 2),
        height: Math.max(0, height - pad.top - pad.bottom - bw * 2),
      });
    }

    return svg;
  }
}
