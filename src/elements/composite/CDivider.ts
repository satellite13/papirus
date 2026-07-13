import type { Bounds, Size } from '@/types';
import type { CComponentStyle, SerializedCComponent } from './CComponent';
import { CompositeComponentBase } from './CompositeComponentBase';

export interface CDividerOptions {
  id?: string;
  color?: string;
  thickness?: number;
  style?: CComponentStyle;
}

const DEFAULT_COLOR = '#cccccc';
const DEFAULT_THICKNESS = 1;

/**
 * A horizontal or vertical divider line for CompositeNode.
 * Direction is determined by the parent container:
 * - In a column container → horizontal line
 * - In a row container → vertical line
 */
export class CDivider extends CompositeComponentBase {
  readonly type = 'divider' as const;
  readonly id?: string;
  style: CComponentStyle;

  private _color: string;
  private _thickness: number;

  constructor(options: CDividerOptions = {}) {
    super();
    this.id = options.id;
    this._color = options.color ?? DEFAULT_COLOR;
    this._thickness = options.thickness ?? DEFAULT_THICKNESS;
    this.style = options.style ?? {};
  }

  get color(): string {
    return this._color;
  }
  set color(value: string) {
    if (this._color !== value) {
      this._color = value;
      this.markChanged();
    }
  }

  get thickness(): number {
    return this._thickness;
  }
  set thickness(value: number) {
    if (this._thickness !== value) {
      this._thickness = value;
      this.markChanged();
    }
  }

  measure(_ctx: CanvasRenderingContext2D): Size {
    // Divider is thin along one axis — which axis depends on parent direction.
    // We report a small square; the parent's flex layout will stretch it.
    return { width: this._thickness, height: this._thickness };
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    ctx.save();
    ctx.strokeStyle = this._color;
    ctx.lineWidth = this._thickness;
    ctx.globalAlpha *= this.style.opacity ?? 1;

    // Draw along the longer axis of the assigned bounds
    ctx.beginPath();
    if (bounds.width >= bounds.height) {
      // Horizontal line
      const y = bounds.y + bounds.height / 2;
      ctx.moveTo(bounds.x, y);
      ctx.lineTo(bounds.x + bounds.width, y);
    } else {
      // Vertical line
      const x = bounds.x + bounds.width / 2;
      ctx.moveTo(x, bounds.y);
      ctx.lineTo(x, bounds.y + bounds.height);
    }
    ctx.stroke();
    ctx.restore();
  }

  serialize(): SerializedCComponent {
    const data: SerializedCComponent = { type: 'divider' };
    if (this.id !== undefined) data.id = this.id;
    if (this._color !== DEFAULT_COLOR) data.color = this._color;
    if (this._thickness !== DEFAULT_THICKNESS) data.thickness = this._thickness;
    if (this.style && Object.keys(this.style).length > 0) data.style = this.style;
    return data;
  }

  toSVG(bounds: Bounds): string {
    if (this.style.visible === false) return '';

    if (bounds.width >= bounds.height) {
      const y = bounds.y + bounds.height / 2;
      return `<line x1="${bounds.x}" y1="${y}" x2="${bounds.x + bounds.width}" y2="${y}" stroke="${this._color}" stroke-width="${this._thickness}" />`;
    } else {
      const x = bounds.x + bounds.width / 2;
      return `<line x1="${x}" y1="${bounds.y}" x2="${x}" y2="${bounds.y + bounds.height}" stroke="${this._color}" stroke-width="${this._thickness}" />`;
    }
  }
}
