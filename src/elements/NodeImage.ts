import type { Bounds } from '@/types';

export type NodeImageCornerPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type NodeImageEdgePlacement = 'top' | 'bottom' | 'left' | 'right';

export function isCornerPlacement(placement: NodeImagePlacement): placement is NodeImageCornerPlacement {
  return placement === 'top-left' || placement === 'top-right' || placement === 'bottom-left' || placement === 'bottom-right';
}

export type NodeImageFit = 'contain' | 'cover' | 'stretch' | 'none';
export type NodeImagePlacement =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface NodeImageOptions {
  source: string | HTMLImageElement;
  width?: number;
  height?: number;
  fit?: NodeImageFit;
  placement?: NodeImagePlacement;
  scaleWithBounds?: boolean;
  padding?: number;
  margin?: number;
  gap?: number;
  opacity?: number;
  strokeColor?: string;
  fillColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  offsetX?: number;
  offsetY?: number;
}

const svgTextCache = new Map<string, Promise<string>>();

function styleSetColor(style: string, key: 'stroke' | 'fill', color: string): string {
  const hasKey = new RegExp(`${key}\\s*:`).test(style);
  if (hasKey) {
    return style.replace(new RegExp(`${key}\\s*:[^;]+`), `${key}:${color}`);
  }
  const suffix = style.trim().endsWith(';') || style.trim() === '' ? '' : ';';
  return `${style}${suffix}${key}:${color};`;
}

function tintSvg(svgText: string, strokeColor?: string, fillColor?: string): string {
  if (!strokeColor && !fillColor) return svgText;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    return svgText;
  }

  const all = [root, ...Array.from(root.querySelectorAll('*'))] as Element[];
  for (const el of all) {
    const stroke = el.getAttribute('stroke');
    if (strokeColor && stroke !== null && stroke.toLowerCase() !== 'none') {
      el.setAttribute('stroke', strokeColor);
    }
    const fill = el.getAttribute('fill');
    if (fillColor && fill !== null && fill.toLowerCase() !== 'none') {
      el.setAttribute('fill', fillColor);
    }
    const style = el.getAttribute('style');
    if (style) {
      let next = style;
      if (strokeColor && /stroke\s*:\s*(?!none)/.test(style)) {
        next = styleSetColor(next, 'stroke', strokeColor);
      }
      if (fillColor && /fill\s*:\s*(?!none)/.test(style)) {
        next = styleSetColor(next, 'fill', fillColor);
      }
      if (next !== style) {
        el.setAttribute('style', next);
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}

function isSvgMarkup(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('<svg') || trimmed.includes('<svg');
}

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%0D/g, '')
    .replace(/%09/g, ' ')
    .replace(/%20/g, ' ');
  return `data:image/svg+xml;utf8,${encoded}`;
}

/**
 * Image helper for node rendering (supports images and inline SVG).
 */
export class NodeImage {
  private _options: NodeImageOptions;
  private _image: HTMLImageElement;
  private _loaded = false;
  private _naturalWidth = 0;
  private _naturalHeight = 0;
  private _onChange?: () => void;
  private _sourceVersion = 0;

  constructor(options: NodeImageOptions, onChange?: () => void) {
    this._options = { ...options };
    this._onChange = onChange;
    this._image = this.resolveImage(options.source);
    this.attachHandlers();
    this.applySource(options.source);
  }

  get options(): NodeImageOptions {
    return this._options;
  }

  set options(value: NodeImageOptions) {
    this._options = { ...value };
    this.setSource(value.source);
  }

  get placement(): NodeImagePlacement {
    return this._options.placement ?? 'center';
  }

  get gap(): number {
    return this._options.gap ?? 6;
  }

  setSource(source: string | HTMLImageElement): void {
    this._loaded = false;
    this._naturalWidth = 0;
    this._naturalHeight = 0;
    this._image = this.resolveImage(source);
    this.attachHandlers();
    this.applySource(source);
    this._onChange?.();
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (!this._loaded) {
      return;
    }

    const padding = this._options.padding ?? 8;
    const margin = Math.max(0, this._options.margin ?? 0);
    const fit = this._options.fit ?? 'none';
    const scaleWithBounds = this._options.scaleWithBounds ?? false;
    const opacity = this._options.opacity ?? 1;
    const align = this._options.align ?? 'center';
    const verticalAlign = this._options.verticalAlign ?? 'center';
    const offsetX = this._options.offsetX ?? 0;
    const offsetY = this._options.offsetY ?? 0;

    const innerBounds: Bounds = {
      x: bounds.x + margin,
      y: bounds.y + margin,
      width: Math.max(0, bounds.width - margin * 2),
      height: Math.max(0, bounds.height - margin * 2),
    };
    const availableWidth = Math.max(0, innerBounds.width - padding * 2);
    const availableHeight = Math.max(0, innerBounds.height - padding * 2);

    let drawWidth = this._options.width ?? this._naturalWidth;
    let drawHeight = this._options.height ?? this._naturalHeight;

    if (scaleWithBounds) {
      if (fit === 'contain' || fit === 'cover') {
        const scaleX = availableWidth / this._naturalWidth;
        const scaleY = availableHeight / this._naturalHeight;
        const scale = fit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
        drawWidth = this._naturalWidth * scale;
        drawHeight = this._naturalHeight * scale;
      } else if (fit === 'stretch') {
        drawWidth = availableWidth;
        drawHeight = availableHeight;
      }
    }

    const maxWidth = Math.max(0, availableWidth);
    const maxHeight = Math.max(0, availableHeight);
    drawWidth = Math.min(drawWidth, maxWidth);
    drawHeight = Math.min(drawHeight, maxHeight);

    let x = innerBounds.x + padding;
    let y = innerBounds.y + padding;

    if (align === 'center') {
      x = innerBounds.x + (innerBounds.width - drawWidth) / 2;
    } else if (align === 'right') {
      x = innerBounds.x + innerBounds.width - drawWidth - padding;
    }

    if (verticalAlign === 'center') {
      y = innerBounds.y + (innerBounds.height - drawHeight) / 2;
    } else if (verticalAlign === 'bottom') {
      y = innerBounds.y + innerBounds.height - drawHeight - padding;
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this._image, x + offsetX, y + offsetY, drawWidth, drawHeight);
    ctx.restore();
  }

  getSize(): { width: number; height: number } {
    const width = this._options.width ?? this._naturalWidth;
    const height = this._options.height ?? this._naturalHeight;
    return { width, height };
  }

  private resolveImage(source: string | HTMLImageElement): HTMLImageElement {
    if (source instanceof HTMLImageElement) {
      return source;
    }

    const img = new Image();
    img.decoding = 'async';
    return img;
  }

  private async applySource(source: string | HTMLImageElement): Promise<void> {
    if (source instanceof HTMLImageElement) {
      return;
    }
    const version = ++this._sourceVersion;

    // Inline SVG markup source
    if (isSvgMarkup(source)) {
      const tinted = tintSvg(source, this._options.strokeColor, this._options.fillColor);
      if (version !== this._sourceVersion) return;
      this._image.src = svgToDataUrl(tinted);
      return;
    }

    // URL source with optional SVG tinting
    const shouldTint = !!this._options.strokeColor || !!this._options.fillColor;
    if (shouldTint && source.toLowerCase().endsWith('.svg')) {
      let svgPromise = svgTextCache.get(source);
      if (!svgPromise) {
        svgPromise = fetch(source).then((r) => (r.ok ? r.text() : ''));
        svgTextCache.set(source, svgPromise);
      }
      const svgText = await svgPromise;
      if (version !== this._sourceVersion) return;
      if (svgText) {
        const tinted = tintSvg(svgText, this._options.strokeColor, this._options.fillColor);
        this._image.src = svgToDataUrl(tinted);
        return;
      }
    }

    if (version !== this._sourceVersion) return;
    this._image.src = source;
  }

  private attachHandlers(): void {
    if (this._image.complete && this._image.naturalWidth > 0) {
      this._loaded = true;
      this._naturalWidth = this._image.naturalWidth;
      this._naturalHeight = this._image.naturalHeight;
      return;
    }

    this._image.onload = (): void => {
      this._loaded = true;
      this._naturalWidth = this._image.naturalWidth;
      this._naturalHeight = this._image.naturalHeight;
      this._onChange?.();
    };
    this._image.onerror = (): void => {
      this._loaded = false;
      this._onChange?.();
    };
  }
}
