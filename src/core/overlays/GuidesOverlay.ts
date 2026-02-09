import type { DiagramRenderer } from '../DiagramRenderer';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';

export interface GuidesOverlayOptions extends BaseOverlayOptions {
  vertical?: number[];
  horizontal?: number[];
  color?: string;
  lineWidth?: number;
}

export class GuidesOverlay extends BaseOverlay {
  private vertical: number[];
  private horizontal: number[];
  private readonly color: string;
  private readonly lineWidth: number;

  constructor(options: GuidesOverlayOptions = {}) {
    super(options.enabled ?? true);
    this.vertical = options.vertical ?? [];
    this.horizontal = options.horizontal ?? [];
    this.color = options.color ?? 'rgba(59, 130, 246, 0.5)';
    this.lineWidth = options.lineWidth ?? 1;
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addOverlayRenderer((ctx) => {
      if (!this.enabled) return;

      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth / renderer.zoom;
      ctx.beginPath();

      const worldLeft = -renderer.offsetX / renderer.zoom;
      const worldTop = -renderer.offsetY / renderer.zoom;
      const worldRight = worldLeft + renderer.width / renderer.zoom;
      const worldBottom = worldTop + renderer.height / renderer.zoom;

      for (const x of this.vertical) {
        if (x < worldLeft || x > worldRight) continue;
        ctx.moveTo(x, worldTop);
        ctx.lineTo(x, worldBottom);
      }

      for (const y of this.horizontal) {
        if (y < worldTop || y > worldBottom) continue;
        ctx.moveTo(worldLeft, y);
        ctx.lineTo(worldRight, y);
      }

      ctx.stroke();
      ctx.restore();
    });
  }

  setGuides(vertical: number[], horizontal: number[]): void {
    this.vertical = vertical;
    this.horizontal = horizontal;
  }
}
