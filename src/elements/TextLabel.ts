import type { Bounds, Point, TextStyle } from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import { shallowEqual } from '@/utils/style';

export interface TextLabelOptions {
  text: string;
  style?: TextStyle;
  maxWidth?: number;
  padding?: number;
  margin?: number;
  styleClass?: string;
  onChange?: () => void;
}

const DEFAULT_STYLE: Required<TextStyle> = {
  font: '14px sans-serif',
  fontSize: 14,
  fontFamily: 'sans-serif',
  fontWeight: 'normal',
  color: '#000000',
  opacity: 1,
  align: 'center',
  baseline: 'middle',
};

/**
 * Text label for nodes and edges
 */
export class TextLabel {
  private _text: string;
  private _style: TextStyle;
  private _localStyle: TextStyle;
  private _maxWidth?: number;
  private readonly _padding: number;
  private readonly _margin: number;
  private _lines: string[] = [];
  private _measuredWidth = 0;
  private _measuredHeight = 0;
  private _styleClass?: string;
  private _onChange?: () => void;
  private _measureDirty = true;

  constructor(options: TextLabelOptions) {
    this._text = options.text;
    this._localStyle = { ...options.style };
    this._style = { ...DEFAULT_STYLE, ...options.style };
    this._maxWidth = options.maxWidth;
    this._padding = options.padding ?? 8;
    this._margin = Number.isFinite(options.margin) ? Math.max(0, options.margin ?? 0) : 0;
    this._styleClass = options.styleClass;
    this._onChange = options.onChange;
  }

  /**
   * Label text
   */
  get text(): string {
    return this._text;
  }

  set text(value: string) {
    if (this._text !== value) {
      this._text = value;
      this._lines = [];
      this._measureDirty = true;
      this._onChange?.();
    }
  }

  /**
   * Text style
   */
  get style(): TextStyle {
    return this._style;
  }

  set style(value: TextStyle) {
    this._localStyle = { ...value };
    this._style = { ...DEFAULT_STYLE, ...value };
    this._lines = [];
    this._measureDirty = true;
    this._onChange?.();
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
      this._lines = [];
      this._measureDirty = true;
      this._onChange?.();
    }
  }

  /**
   * Maximum width for text wrapping
   */
  get maxWidth(): number | undefined {
    return this._maxWidth;
  }

  set maxWidth(value: number | undefined) {
    this._maxWidth = value;
    this._lines = [];
    this._measureDirty = true;
    this._onChange?.();
  }

  /**
   * Label padding
   */
  get padding(): number {
    return this._padding;
  }

  /**
   * Label margin
   */
  get margin(): number {
    return this._margin;
  }

  applyStyleManager(styleManager: StyleManager): void {
    const baseStyle = styleManager.getTextStyle(this._styleClass);
    const mergedStyle = { ...baseStyle, ...this._localStyle };
    if (!shallowEqual(this._style, mergedStyle)) {
      this._style = mergedStyle;
      this._lines = [];
      this._measureDirty = true;
      this._onChange?.();
    }
  }

  setOnChange(handler?: () => void): void {
    this._onChange = handler;
  }

  /**
   * Measured width after layout
   */
  get measuredWidth(): number {
    return this._measuredWidth;
  }

  /**
   * Measured height after layout
   */
  get measuredHeight(): number {
    return this._measuredHeight;
  }

  /**
   * Measure and layout text, returns dimensions
   */
  measure(ctx: CanvasRenderingContext2D): { width: number; height: number } {
    if (!this._measureDirty && this._lines.length > 0) {
      return {
        width: this._measuredWidth,
        height: this._measuredHeight,
      };
    }

    this.applyStyle(ctx);

    const lineHeight = (this._style.fontSize ?? 14) * 1.2;

    if (this._maxWidth !== undefined) {
      const maxWidth = Math.max(0, this._maxWidth - this._margin * 2);
      this._lines = this.wrapText(ctx, this._text, Math.max(0, maxWidth - this._padding * 2));
    } else {
      this._lines = this._text.split('\n');
    }

    // Calculate dimensions
    let maxLineWidth = 0;
    for (const line of this._lines) {
      const metrics = ctx.measureText(line);
      maxLineWidth = Math.max(maxLineWidth, metrics.width);
    }

    this._measuredWidth = maxLineWidth + this._padding * 2 + this._margin * 2;
    this._measuredHeight = this._lines.length * lineHeight + this._padding * 2 + this._margin * 2;
    this._measureDirty = false;

    return {
      width: this._measuredWidth,
      height: this._measuredHeight,
    };
  }

  /**
   * Render the label within bounds
   */
  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this._lines.length === 0) {
      this.measure(ctx);
    }

    this.applyStyle(ctx);

    const lineHeight = (this._style.fontSize ?? 14) * 1.2;
    const totalHeight = this._lines.length * lineHeight;

    const margin = this._margin;
    const innerBounds: Bounds = {
      x: bounds.x + margin,
      y: bounds.y + margin,
      width: Math.max(0, bounds.width - margin * 2),
      height: Math.max(0, bounds.height - margin * 2),
    };

    // Calculate starting position based on alignment
    let x: number;
    switch (this._style.align) {
      case 'left':
        x = innerBounds.x + this._padding;
        break;
      case 'right':
        x = innerBounds.x + innerBounds.width - this._padding;
        break;
      default:
        x = innerBounds.x + innerBounds.width / 2;
    }

    const startY = innerBounds.y + (innerBounds.height - totalHeight) / 2 + lineHeight / 2;

    ctx.fillStyle = this._style.color ?? '#000000';

    for (let i = 0; i < this._lines.length; i++) {
      const line = this._lines[i]!;
      const y = startY + i * lineHeight;
      ctx.fillText(line, x, y);
    }
  }

  /**
   * Render at a specific point (for edge labels)
   */
  renderAt(ctx: CanvasRenderingContext2D, point: Point): void {
    if (this._lines.length === 0) {
      this.measure(ctx);
    }

    this.applyStyle(ctx);

    const lineHeight = (this._style.fontSize ?? 14) * 1.2;
    const totalHeight = this._lines.length * lineHeight;
    const startY = point.y - totalHeight / 2 + lineHeight / 2;

    ctx.fillStyle = this._style.color ?? '#000000';

    for (let i = 0; i < this._lines.length; i++) {
      const line = this._lines[i]!;
      const y = startY + i * lineHeight;
      ctx.fillText(line, point.x, y);
    }
  }

  private applyStyle(ctx: CanvasRenderingContext2D): void {
    const fontSize = this._style.fontSize ?? 14;
    const fontFamily = this._style.fontFamily ?? 'sans-serif';
    const fontWeight = this._style.fontWeight ?? 'normal';

    // Always construct font from individual properties to ensure fontSize changes are applied
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = this._style.align ?? 'center';
    ctx.textBaseline = this._style.baseline ?? 'middle';
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
    }

    return lines.length > 0 ? lines : [''];
  }
}
