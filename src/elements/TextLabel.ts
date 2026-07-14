import type { Bounds, ContentInsetSides, Point, TextStyle } from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import { shallowEqual } from '@/utils/style';
import { measureTextLines, wrapMeasuredText } from '@/utils/textMeasurer';

const DEFAULT_INSET = 8;

function normalizeTextInset(
  value: number | ContentInsetSides | undefined,
  fallback: number
): Required<ContentInsetSides> {
  const n = (v: number | undefined): number =>
    v !== undefined && Number.isFinite(v) ? Math.max(0, v) : fallback;
  if (value === undefined) {
    return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  }
  if (typeof value === 'number') {
    const v = n(value);
    return { top: v, right: v, bottom: v, left: v };
  }
  return {
    top: n(value.top),
    right: n(value.right),
    bottom: n(value.bottom),
    left: n(value.left),
  };
}

export interface TextLabelOptions {
  text: string;
  editableText?: string;
  style?: TextStyle;
  maxWidth?: number;
  /** Inset from bounds edge to text: number (all sides) or { top?, right?, bottom?, left? }. Backward compat: inset ?? margin ?? padding ?? 8 */
  inset?: number | ContentInsetSides;
  padding?: number;
  margin?: number;
  styleClass?: string;
  onChange?: () => void;
}

const DEFAULT_STYLE: TextStyle & { align: CanvasTextAlign; baseline: CanvasTextBaseline } = {
  font: '14px sans-serif',
  fontSize: 14,
  fontFamily: 'sans-serif',
  fontWeight: 'normal',
  color: '#000000',
  opacity: 1,
  align: 'center',
  baseline: 'middle',
  verticalAlign: 'middle',
};

/**
 * Text label for nodes and edges
 */
export class TextLabel {
  private _text: string;
  private _editableText?: string;
  private _style: TextStyle;
  private _localStyle: TextStyle;
  private _maxWidth?: number;
  private _autoMaxWidth?: number;
  private _inset: Required<ContentInsetSides>;
  private _lines: string[] = [];
  private _measuredWidth = 0;
  private _measuredHeight = 0;
  private _styleClass?: string;
  private _onChange?: () => void;
  private _measureDirty = true;

  constructor(options: TextLabelOptions) {
    this._text = options.text ?? '';
    this._editableText = options.editableText;
    this._localStyle = { ...options.style };
    this._style = { ...DEFAULT_STYLE, ...options.style };
    this._maxWidth = options.maxWidth;
    this._inset = normalizeTextInset(
      options.inset ?? options.margin ?? options.padding,
      DEFAULT_INSET
    );
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
    const next = value ?? '';
    if (this._text !== next) {
      this._text = next;
      this._lines = [];
      this._measureDirty = true;
      this._onChange?.();
    }
  }

  /**
   * Editable text shown in inline editor instead of display text.
   * When set, double-click editing will use this value.
   */
  get editableText(): string | undefined {
    return this._editableText;
  }

  set editableText(value: string | undefined) {
    if (this._editableText !== value) {
      this._editableText = value;
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
   * Raw text style overrides (without StyleManager merge)
   */
  get styleOverrides(): TextStyle {
    return { ...this._localStyle };
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
    if (this._maxWidth === value) {
      return;
    }
    this._maxWidth = value;
    this._lines = [];
    this._measureDirty = true;
    this._onChange?.();
  }

  /**
   * Internal max width used for automatic wrapping by container elements.
   */
  setAutoMaxWidth(value: number | undefined): void {
    if (this._autoMaxWidth === value) {
      return;
    }
    this._autoMaxWidth = value;
    this._lines = [];
    this._measureDirty = true;
  }

  /**
   * Inset from bounds edge to text (per side: top, right, bottom, left)
   */
  get inset(): Required<ContentInsetSides> {
    return { ...this._inset };
  }

  set inset(value: number | ContentInsetSides) {
    const next = normalizeTextInset(value, DEFAULT_INSET);
    if (
      this._inset.top !== next.top ||
      this._inset.right !== next.right ||
      this._inset.bottom !== next.bottom ||
      this._inset.left !== next.left
    ) {
      this._inset = next;
      this._lines = [];
      this._measureDirty = true;
      this._onChange?.();
    }
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
   * Get wrapped lines for export. Uses ctx to measure and wrap by words.
   * Call with maxWidth = inner bounds width (e.g. bounds.width - inset*2).
   */
  getWrappedLines(ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
    this.setAutoMaxWidth(maxWidth);
    this.measure(ctx);
    return this._lines;
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

    const effectiveMaxWidth = this._maxWidth ?? this._autoMaxWidth;

    const text = this._text ?? '';
    if (effectiveMaxWidth !== undefined) {
      const maxWidth = Math.max(0, effectiveMaxWidth - this._inset.left - this._inset.right);
      this._lines = wrapMeasuredText(ctx, text, maxWidth);
    } else {
      this._lines = text.split('\n');
    }

    // Calculate dimensions
    const maxLineWidth = measureTextLines(ctx, this._lines);

    this._measuredWidth = maxLineWidth + this._inset.left + this._inset.right;
    this._measuredHeight = this._lines.length * lineHeight + this._inset.top + this._inset.bottom;
    this._measureDirty = false;

    return {
      width: this._measuredWidth,
      height: this._measuredHeight,
    };
  }

  /**
   * Render the label within bounds
   */
  render(
    ctx: CanvasRenderingContext2D,
    bounds: Bounds,
    alignOverride?: 'left' | 'center' | 'right'
  ): void {
    if (this._lines.length === 0) {
      this.measure(ctx);
    }

    this.applyStyle(ctx);

    const align = alignOverride ?? this._style.align ?? 'center';
    if (alignOverride) {
      ctx.textAlign = align;
    }

    const lineHeight = (this._style.fontSize ?? 14) * 1.2;
    const totalHeight = this._lines.length * lineHeight;

    const innerBounds: Bounds = {
      x: bounds.x + this._inset.left,
      y: bounds.y + this._inset.top,
      width: Math.max(0, bounds.width - this._inset.left - this._inset.right),
      height: Math.max(0, bounds.height - this._inset.top - this._inset.bottom),
    };

    // Horizontal position inside innerBounds
    let x: number;
    switch (align) {
      case 'left':
        x = innerBounds.x;
        break;
      case 'right':
        x = innerBounds.x + innerBounds.width;
        break;
      default:
        x = innerBounds.x + innerBounds.width / 2;
    }

    const verticalAlign = this._style.verticalAlign ?? 'middle';
    let startY: number;
    switch (verticalAlign) {
      case 'top':
        startY = innerBounds.y + lineHeight / 2;
        break;
      case 'bottom':
        startY = innerBounds.y + innerBounds.height - totalHeight + lineHeight / 2;
        break;
      default:
        startY = innerBounds.y + (innerBounds.height - totalHeight) / 2 + lineHeight / 2;
    }

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

    // For edge labels, point is the visual center of the whole label bounds.
    // Rendering through bounds keeps per-side inset semantics consistent with node labels:
    // top/bottom and left/right act independently instead of collapsing into summed padding.
    const bounds: Bounds = {
      x: point.x - this._measuredWidth / 2,
      y: point.y - this._measuredHeight / 2,
      width: this._measuredWidth,
      height: this._measuredHeight,
    };
    this.render(ctx, bounds);
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
}
