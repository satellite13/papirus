import type { Bounds } from '@/types';
import { isSvgMarkup } from '@/utils/svgTint';
import { resolveTintedSvgDataUrl, resolveTintedSvgDataUrlSync } from '@/utils/svgAssetLoader';
import { computeIconDrawRect } from '@/utils/iconLayout';

export type NodeImageCornerPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type NodeImageEdgePlacement = 'top' | 'bottom' | 'left' | 'right';

export function isCornerPlacement(
  placement: NodeImagePlacement
): placement is NodeImageCornerPlacement {
  return (
    placement === 'top-left' ||
    placement === 'top-right' ||
    placement === 'bottom-left' ||
    placement === 'bottom-right'
  );
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
  /** Single inset from edge of icon zone to image. Backward compat when loading: inset ?? margin ?? padding ?? 6 */
  inset?: number;
  /** @deprecated Use inset. Accepted when loading old serialized data. */
  margin?: number;
  /** @deprecated Use inset. Accepted when loading old serialized data. */
  padding?: number;
  opacity?: number;
  strokeColor?: string;
  fillColor?: string;
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
    void this.applySource(options.source);
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

  /** Inset from edge of icon zone to image (single value for all sides) */
  get inset(): number {
    const v =
      this._options.inset ??
      this._options.margin ??
      this._options.padding;
    return v !== undefined && Number.isFinite(v) ? Math.max(0, v) : 6;
  }

  setSource(source: string | HTMLImageElement): void {
    this._loaded = false;
    this._naturalWidth = 0;
    this._naturalHeight = 0;
    this._image = this.resolveImage(source);
    this.attachHandlers();
    void this.applySource(source);
    this._onChange?.();
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (!this._loaded) {
      return;
    }

    const ins = this.inset;
    const opacity = this._options.opacity ?? 1;
    const drawRect = computeIconDrawRect(
      bounds,
      this._options,
      { width: this._naturalWidth, height: this._naturalHeight },
      ins
    );
    if (drawRect.width <= 0 || drawRect.height <= 0) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this._image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
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

    if (isSvgMarkup(source)) {
      const resolvedSource = resolveTintedSvgDataUrlSync(source, {
        strokeColor: this._options.strokeColor,
        fillColor: this._options.fillColor,
      });
      if (version !== this._sourceVersion) return;
      this._image.src = resolvedSource ?? source;
      return;
    }

    const resolvedSource = await resolveTintedSvgDataUrl(source, {
      strokeColor: this._options.strokeColor,
      fillColor: this._options.fillColor,
    });

    if (version !== this._sourceVersion) return;
    this._image.src = resolvedSource ?? source;
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
