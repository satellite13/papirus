import type { DiagramRenderer } from '../DiagramRenderer';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';

export interface RulersOverlayOptions extends BaseOverlayOptions {
  thickness?: number;
  backgroundColor?: string;
  textColor?: string;
  tickColor?: string;
}

export class RulersOverlay extends BaseOverlay {
  private readonly thickness: number;
  private readonly backgroundColor: string;
  private readonly textColor: string;
  private readonly tickColor: string;

  constructor(options: RulersOverlayOptions = {}) {
    super(options.enabled ?? true);
    this.thickness = options.thickness ?? 20;
    this.backgroundColor = options.backgroundColor ?? '#f4f4f5';
    this.textColor = options.textColor ?? '#52525b';
    this.tickColor = options.tickColor ?? '#a1a1aa';
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addOverlayRenderer((ctx) => {
      if (!this.enabled) return;

      const thickness = this.thickness;
      ctx.save();
      ctx.setTransform(renderer.pixelRatio, 0, 0, renderer.pixelRatio, 0, 0);

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, renderer.width, thickness);
      ctx.fillRect(0, 0, thickness, renderer.height);

      ctx.strokeStyle = this.tickColor;
      ctx.fillStyle = this.textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const step = this.getTickStep(renderer.zoom);
      const worldLeft = -renderer.offsetX / renderer.zoom;
      const worldTop = -renderer.offsetY / renderer.zoom;
      const worldRight = worldLeft + renderer.width / renderer.zoom;
      const worldBottom = worldTop + renderer.height / renderer.zoom;

      ctx.beginPath();
      for (let x = Math.floor(worldLeft / step) * step; x <= worldRight; x += step) {
        const screenX = x * renderer.zoom + renderer.offsetX;
        ctx.moveTo(screenX, thickness);
        ctx.lineTo(screenX, thickness - 6);
        ctx.fillText(`${Math.round(x)}`, screenX + 2, 2);
      }

      for (let y = Math.floor(worldTop / step) * step; y <= worldBottom; y += step) {
        const screenY = y * renderer.zoom + renderer.offsetY;
        ctx.moveTo(thickness, screenY);
        ctx.lineTo(thickness - 6, screenY);
        ctx.save();
        ctx.translate(2, screenY + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${Math.round(y)}`, 0, 0);
        ctx.restore();
      }

      ctx.stroke();
      ctx.restore();
    });
  }

  private getTickStep(zoom: number): number {
    const targetPx = 80;
    const rawStep = targetPx / zoom;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    if (normalized < 1.5) return magnitude;
    if (normalized < 3) return 2 * magnitude;
    if (normalized < 7) return 5 * magnitude;
    return 10 * magnitude;
  }
}
