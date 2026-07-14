import type { Bounds, Size } from '@/types';
import type { CComponent, CComponentStyle, SerializedCComponent } from './CComponent';
import { tintSvg, isSvgMarkup, svgToDataUrl, isSvgUrl } from '@/utils/svgTint';
import { fetchSvgText } from '@/utils/svgAssetLoader';
import { CompositeComponentBase } from './CompositeComponentBase';

export interface CIconOptions {
  id?: string;
  source: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  bindsNotationIcon?: boolean;
  visible?: boolean;
  onClick?: (component: CComponent) => void;
  style?: CComponentStyle;
}

const DEFAULT_ICON_SIZE = 24;

/**
 * Lightweight SVG/image icon component for CompositeNode.
 */
export class CIcon extends CompositeComponentBase {
  readonly type = 'icon' as const;
  readonly id?: string;
  style: CComponentStyle;
  onClick?: (component: CComponent) => void;

  private _source: string;
  private _width: number;
  private _height: number;
  private _backgroundColor?: string;
  private _fillColor?: string;
  private _bindsNotationIcon: boolean;
  private _image: HTMLImageElement;
  private _loaded = false;

  constructor(options: CIconOptions) {
    super();
    this.id = options.id;
    this._source = options.source;
    this._width = options.width ?? DEFAULT_ICON_SIZE;
    this._height = options.height ?? DEFAULT_ICON_SIZE;
    this._backgroundColor = options.backgroundColor;
    this._fillColor = options.fillColor;
    this._bindsNotationIcon = options.bindsNotationIcon ?? false;
    this.onClick = options.onClick;
    this.style = options.style ?? {};
    if (options.visible === false) {
      this.style.visible = false;
    }

    this._image = new Image();
    this._image.onload = (): void => {
      this._loaded = true;
      this.markChanged();
    };
    this._image.onerror = (): void => {
      this.markChanged();
    };
    void this.loadSource(this._source);
  }

  get source(): string {
    return this._source;
  }
  set source(value: string) {
    if (this._source !== value) {
      this._source = value;
      this._loaded = false;
      void this.loadSource(value);
      this.markChanged();
    }
  }

  get width(): number {
    return this._width;
  }
  set width(value: number) {
    if (this._width !== value) {
      this._width = value;
      this.markChanged();
    }
  }

  get height(): number {
    return this._height;
  }
  set height(value: number) {
    if (this._height !== value) {
      this._height = value;
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

  get fillColor(): string | undefined {
    return this._fillColor;
  }
  set fillColor(value: string | undefined) {
    if (this._fillColor !== value) {
      this._fillColor = value;
      // Re-tint the SVG
      void this.loadSource(this._source);
      this.markChanged();
    }
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get bindsNotationIcon(): boolean {
    return this._bindsNotationIcon;
  }
  set bindsNotationIcon(value: boolean) {
    if (this._bindsNotationIcon !== value) {
      this._bindsNotationIcon = value;
      this.markChanged();
    }
  }

  private async loadSource(source: string): Promise<void> {
    if (isSvgMarkup(source)) {
      const tinted = this._fillColor ? tintSvg(source, undefined, this._fillColor) : source;
      this._image.src = svgToDataUrl(tinted);
    } else if (isSvgUrl(source) && this._fillColor) {
      try {
        const svgText = await fetchSvgText(source);
        const tinted = tintSvg(svgText, undefined, this._fillColor);
        this._image.src = svgToDataUrl(tinted);
      } catch {
        this._image.src = source;
      }
    } else {
      this._image.src = source;
    }
  }

  measure(_ctx: CanvasRenderingContext2D): Size {
    return { width: this._width, height: this._height };
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    const opacity = this.style.opacity ?? 1;
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha *= opacity;

    // Draw background rect if specified
    if (this._backgroundColor) {
      ctx.fillStyle = this._backgroundColor;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    // Draw image centered within bounds
    if (this._loaded) {
      const drawWidth = Math.min(this._width, bounds.width);
      const drawHeight = Math.min(this._height, bounds.height);
      const dx = bounds.x + (bounds.width - drawWidth) / 2;
      const dy = bounds.y + (bounds.height - drawHeight) / 2;
      ctx.drawImage(this._image, dx, dy, drawWidth, drawHeight);
    }

    ctx.restore();
  }

  serialize(): SerializedCComponent {
    const data: SerializedCComponent = {
      type: 'icon',
      source: this._source,
      width: this._width,
      height: this._height,
    };
    if (this.id !== undefined) data.id = this.id;
    if (this.style && Object.keys(this.style).length > 0) data.style = this.style;
    if (this._backgroundColor) data.backgroundColor = this._backgroundColor;
    if (this._fillColor) data.fillColor = this._fillColor;
    if (this._bindsNotationIcon) data.bindsNotationIcon = true;
    return data;
  }

  toSVG(bounds: Bounds): string {
    if (this.style.visible === false) return '';

    let svg = '';

    if (this._backgroundColor) {
      svg += `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${this._backgroundColor}" />`;
    }

    const drawWidth = Math.min(this._width, bounds.width);
    const drawHeight = Math.min(this._height, bounds.height);
    const dx = bounds.x + (bounds.width - drawWidth) / 2;
    const dy = bounds.y + (bounds.height - drawHeight) / 2;

    // For SVG export, reference the source as an image
    svg += `<image href="${escapeXmlAttr(this._source)}" x="${dx}" y="${dy}" width="${drawWidth}" height="${drawHeight}" />`;

    return svg;
  }
}

function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
