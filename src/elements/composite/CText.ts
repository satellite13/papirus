import type { Bounds, Size } from '@/types';
import type { CComponent, CComponentStyle, SerializedCComponent } from './CComponent';

export interface CTextOptions {
  id?: string;
  text: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  maxLines?: number;
  lineHeight?: number;
  /** Optional marker for host apps (not used for composite name edit; use `bindToProperty: '__name__'`). */
  role?: string;
  /** Bind displayed text to a property (`__name__` = node display name; enables double-click name edit on composite). */
  bindToProperty?: string;
  /** Rotation in degrees (e.g. -90 for vertical swimlane text) */
  rotation?: number;
  style?: CComponentStyle;
}

const DEFAULT_FONT_FAMILY = 'sans-serif';
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_HEIGHT = 1.2;
const DEFAULT_COLOR = '#000000';

/**
 * Lightweight text component for CompositeNode.
 * Renders directly via canvas ctx without delegating to TextLabel.
 */
export class CText implements CComponent {
  readonly type = 'text' as const;
  readonly id?: string;
  style: CComponentStyle;

  private _text: string;
  private _fontFamily: string;
  private _fontWeight: string;
  private _fontStyle: string;
  private _fontSize: number;
  private _color: string;
  private _align: 'left' | 'center' | 'right';
  private _verticalAlign: 'top' | 'middle' | 'bottom';
  private _maxLines?: number;
  private _lineHeight: number;
  private _role?: string;
  private _bindToProperty?: string;
  private _rotation: number;
  private _onChange?: () => void;
  private _cachedLines: string[] | null = null;

  constructor(options: CTextOptions) {
    this.id = options.id;
    this._text = options.text;
    this._fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;
    this._fontWeight = options.fontWeight ?? 'normal';
    this._fontStyle = options.fontStyle ?? 'normal';
    this._fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    this._color = options.color ?? DEFAULT_COLOR;
    this._align = options.align ?? 'center';
    this._verticalAlign = options.verticalAlign ?? 'middle';
    this._maxLines = options.maxLines;
    this._lineHeight = options.lineHeight ?? DEFAULT_LINE_HEIGHT;
    this._role = options.role;
    this._bindToProperty = options.bindToProperty;
    this._rotation = options.rotation ?? 0;
    this.style = options.style ?? {};
  }

  // --- Property accessors with dirty notification ---

  get text(): string {
    return this._text;
  }
  set text(value: string) {
    if (this._text !== value) {
      this._text = value;
      this._cachedLines = null;
      this._onChange?.();
    }
  }

  get fontFamily(): string {
    return this._fontFamily;
  }
  set fontFamily(value: string) {
    if (this._fontFamily !== value) {
      this._fontFamily = value;
      this._onChange?.();
    }
  }

  get fontWeight(): string {
    return this._fontWeight;
  }
  set fontWeight(value: string) {
    if (this._fontWeight !== value) {
      this._fontWeight = value;
      this._onChange?.();
    }
  }

  get fontStyle(): string {
    return this._fontStyle;
  }
  set fontStyle(value: string) {
    if (this._fontStyle !== value) {
      this._fontStyle = value;
      this._onChange?.();
    }
  }

  get fontSize(): number {
    return this._fontSize;
  }
  set fontSize(value: number) {
    if (this._fontSize !== value) {
      this._fontSize = value;
      this._onChange?.();
    }
  }

  get color(): string {
    return this._color;
  }
  set color(value: string) {
    if (this._color !== value) {
      this._color = value;
      this._onChange?.();
    }
  }

  get align(): 'left' | 'center' | 'right' {
    return this._align;
  }
  set align(value: 'left' | 'center' | 'right') {
    if (this._align !== value) {
      this._align = value;
      this._onChange?.();
    }
  }

  get verticalAlign(): 'top' | 'middle' | 'bottom' {
    return this._verticalAlign;
  }
  set verticalAlign(value: 'top' | 'middle' | 'bottom') {
    if (this._verticalAlign !== value) {
      this._verticalAlign = value;
      this._onChange?.();
    }
  }

  get maxLines(): number | undefined {
    return this._maxLines;
  }
  set maxLines(value: number | undefined) {
    if (this._maxLines !== value) {
      this._maxLines = value;
      this._onChange?.();
    }
  }

  get lineHeight(): number {
    return this._lineHeight;
  }

  get role(): string | undefined {
    return this._role;
  }

  get bindToProperty(): string | undefined {
    return this._bindToProperty;
  }

  get rotation(): number {
    return this._rotation;
  }
  set rotation(value: number) {
    if (this._rotation !== value) {
      this._rotation = value;
      this._onChange?.();
    }
  }

  setOnChange(cb: (() => void) | undefined): void {
    this._onChange = cb;
  }

  private getFont(): string {
    return `${this._fontStyle} ${this._fontWeight} ${this._fontSize}px ${this._fontFamily}`;
  }

  private getLineHeightPx(): number {
    return this._fontSize * this._lineHeight;
  }

  /**
   * Word-wrap text to fit within maxWidth.
   */
  wrapText(ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
    ctx.font = this.getFont();
    const words = this._text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    if (this._maxLines !== undefined && lines.length > this._maxLines) {
      const truncated = lines.slice(0, this._maxLines);
      const lastLine = truncated[truncated.length - 1];
      if (lastLine !== undefined) {
        truncated[truncated.length - 1] = lastLine + '…';
      }
      return truncated;
    }

    return lines;
  }

  measure(ctx: CanvasRenderingContext2D): Size {
    ctx.font = this.getFont();
    const lineHeightPx = this.getLineHeightPx();

    // Split by newlines first, then measure each
    const rawLines = this._text.split('\n');
    let maxWidth = 0;
    for (const line of rawLines) {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxWidth) {
        maxWidth = metrics.width;
      }
    }

    let lineCount = rawLines.length;
    if (this._maxLines !== undefined && lineCount > this._maxLines) {
      lineCount = this._maxLines;
    }

    const width = maxWidth;
    const height = lineCount * lineHeightPx;

    // For rotated text, swap dimensions
    if (this._rotation === 90 || this._rotation === -90) {
      return { width: height, height: width };
    }

    return { width, height };
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    const opacity = this.style.opacity ?? 1;
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.font = this.getFont();
    ctx.fillStyle = this._color;

    const isRotated = this._rotation === 90 || this._rotation === -90;

    // For rotated text, work in the rotated coordinate system
    const textBounds = isRotated
      ? { x: bounds.x, y: bounds.y, width: bounds.height, height: bounds.width }
      : bounds;

    const lines = this.wrapText(ctx, textBounds.width);
    this._cachedLines = lines;
    const lineHeightPx = this.getLineHeightPx();
    const totalTextHeight = lines.length * lineHeightPx;

    // Horizontal alignment
    let textAlign: CanvasTextAlign;
    let xBase: number;
    switch (this._align) {
      case 'left':
        textAlign = 'left';
        xBase = textBounds.x;
        break;
      case 'right':
        textAlign = 'right';
        xBase = textBounds.x + textBounds.width;
        break;
      default:
        textAlign = 'center';
        xBase = textBounds.x + textBounds.width / 2;
        break;
    }

    // Vertical alignment
    let yStart: number;
    switch (this._verticalAlign) {
      case 'top':
        yStart = textBounds.y + lineHeightPx / 2;
        break;
      case 'bottom':
        yStart = textBounds.y + textBounds.height - totalTextHeight + lineHeightPx / 2;
        break;
      default: // middle
        yStart =
          textBounds.y + (textBounds.height - totalTextHeight) / 2 + lineHeightPx / 2;
        break;
    }

    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    if (isRotated) {
      // Translate to center of bounds, rotate, then draw
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((this._rotation * Math.PI) / 180);
      // Adjust coordinates relative to rotated center
      const offsetX = xBase - (textBounds.x + textBounds.width / 2);
      const offsetY = yStart - (textBounds.y + textBounds.height / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, offsetX, offsetY + i * lineHeightPx);
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, xBase, yStart + i * lineHeightPx);
      }
    }

    ctx.restore();
  }

  hitTest(
    point: { x: number; y: number },
    bounds: Bounds
  ): CComponent | null {
    if (this.style.visible === false) return null;
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      return this;
    }
    return null;
  }

  serialize(): SerializedCComponent {
    const data: SerializedCComponent = {
      type: 'text',
      text: this._text,
    };
    if (this.id !== undefined) data.id = this.id;
    if (this.style && Object.keys(this.style).length > 0) data.style = this.style;
    if (this._fontFamily !== DEFAULT_FONT_FAMILY) data.fontFamily = this._fontFamily;
    if (this._fontWeight !== 'normal') data.fontWeight = this._fontWeight;
    if (this._fontStyle !== 'normal') data.fontStyle = this._fontStyle;
    if (this._fontSize !== DEFAULT_FONT_SIZE) data.fontSize = this._fontSize;
    if (this._color !== DEFAULT_COLOR) data.color = this._color;
    if (this._align !== 'center') data.align = this._align;
    if (this._verticalAlign !== 'middle') data.verticalAlign = this._verticalAlign;
    if (this._maxLines !== undefined) data.maxLines = this._maxLines;
    if (this._lineHeight !== DEFAULT_LINE_HEIGHT) data.lineHeight = this._lineHeight;
    if (this._bindToProperty !== undefined) data.bindToProperty = this._bindToProperty;
    if (this._role !== undefined) data.role = this._role;
    if (this._rotation !== 0) data.rotation = this._rotation;
    return data;
  }

  toSVG(bounds: Bounds): string {
    if (this.style.visible === false) return '';

    const lineHeightPx = this.getLineHeightPx();
    // Use cached wrapped lines from last render() if available, otherwise fall back to raw lines
    const displayLines = this._cachedLines ?? this._text.split('\n');
    const totalTextHeight = displayLines.length * lineHeightPx;

    let anchor: string;
    let xBase: number;
    switch (this._align) {
      case 'left':
        anchor = 'start';
        xBase = bounds.x;
        break;
      case 'right':
        anchor = 'end';
        xBase = bounds.x + bounds.width;
        break;
      default:
        anchor = 'middle';
        xBase = bounds.x + bounds.width / 2;
        break;
    }

    let yStart: number;
    switch (this._verticalAlign) {
      case 'top':
        yStart = bounds.y + lineHeightPx * 0.75;
        break;
      case 'bottom':
        yStart = bounds.y + bounds.height - totalTextHeight + lineHeightPx * 0.75;
        break;
      default:
        yStart =
          bounds.y + (bounds.height - totalTextHeight) / 2 + lineHeightPx * 0.75;
        break;
    }

    const fontAttrs = [
      `font-family="${this._fontFamily}"`,
      `font-size="${this._fontSize}"`,
      this._fontWeight !== 'normal' ? `font-weight="${this._fontWeight}"` : '',
      this._fontStyle !== 'normal' ? `font-style="${this._fontStyle}"` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const transform =
      this._rotation !== 0
        ? ` transform="rotate(${this._rotation}, ${bounds.x + bounds.width / 2}, ${bounds.y + bounds.height / 2})"`
        : '';

    const tspans = displayLines
      .map(
        (line, i) =>
          `<tspan x="${xBase}" dy="${i === 0 ? 0 : lineHeightPx}">${escapeXml(line)}</tspan>`
      )
      .join('');

    return `<text x="${xBase}" y="${yStart}" ${fontAttrs} fill="${this._color}" text-anchor="${anchor}"${transform}>${tspans}</text>`;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
