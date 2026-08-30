import type { DiagramRenderer } from '../DiagramRenderer';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';

export interface RulersOverlayOptions extends BaseOverlayOptions {
  thickness?: number;
  backgroundColor?: string;
  textColor?: string;
  tickColor?: string;
}

interface TickBake {
  zoom: number;
  pixelRatio: number;
  worldLeft: number;
  worldTop: number;
  worldRight: number;
  worldBottom: number;
  horizontal: HTMLCanvasElement;
  vertical: HTMLCanvasElement;
}

export class RulersOverlay extends BaseOverlay {
  private readonly thickness: number;
  private readonly backgroundColor: string;
  private readonly textColor: string;
  private readonly tickColor: string;
  private tickBake: TickBake | null = null;
  private tickBakeGeneration = 0;

  constructor(options: RulersOverlayOptions = {}) {
    super(options.enabled ?? true);
    this.thickness = options.thickness ?? 20;
    this.backgroundColor = options.backgroundColor ?? '#f4f4f5';
    this.textColor = options.textColor ?? '#52525b';
    this.tickColor = options.tickColor ?? '#a1a1aa';
  }

  getTickBakeGeneration(): number {
    return this.tickBakeGeneration;
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addOverlayRenderer((ctx) => {
      if (!this.enabled) return;

      const thickness = this.thickness;
      const zoom = renderer.zoom;
      const worldLeft = -renderer.offsetX / zoom;
      const worldTop = -renderer.offsetY / zoom;

      ctx.save();
      ctx.setTransform(renderer.pixelRatio, 0, 0, renderer.pixelRatio, 0, 0);

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, renderer.width, thickness);
      ctx.fillRect(0, 0, thickness, renderer.height);

      const bake = this.ensureTickBake(renderer);
      const srcX = (worldLeft - bake.worldLeft) * zoom;
      const srcY = (worldTop - bake.worldTop) * zoom;
      const pr = renderer.pixelRatio;

      ctx.drawImage(
        bake.horizontal,
        srcX * pr,
        0,
        renderer.width * pr,
        thickness * pr,
        0,
        0,
        renderer.width,
        thickness
      );
      ctx.drawImage(
        bake.vertical,
        0,
        srcY * pr,
        thickness * pr,
        renderer.height * pr,
        0,
        0,
        thickness,
        renderer.height
      );

      ctx.restore();
    });
  }

  private ensureTickBake(renderer: DiagramRenderer): TickBake {
    const zoom = renderer.zoom;
    const worldLeft = -renderer.offsetX / zoom;
    const worldTop = -renderer.offsetY / zoom;
    const worldRight = worldLeft + renderer.width / zoom;
    const worldBottom = worldTop + renderer.height / zoom;

    if (
      this.tickBake !== null &&
      this.tickBake.zoom === zoom &&
      this.tickBake.pixelRatio === renderer.pixelRatio &&
      worldLeft >= this.tickBake.worldLeft &&
      worldRight <= this.tickBake.worldRight &&
      worldTop >= this.tickBake.worldTop &&
      worldBottom <= this.tickBake.worldBottom
    ) {
      return this.tickBake;
    }

    const extraX = renderer.width / zoom;
    const extraY = renderer.height / zoom;
    const bakeLeft = worldLeft - extraX;
    const bakeTop = worldTop - extraY;
    const bakeRight = worldRight + extraX;
    const bakeBottom = worldBottom + extraY;
    const pr = Math.max(1, renderer.pixelRatio);
    const thickness = this.thickness;
    const step = this.getTickStep(zoom);

    const horizontal = this.tickBake?.horizontal ?? document.createElement('canvas');
    const vertical = this.tickBake?.vertical ?? document.createElement('canvas');
    const hWidth = Math.max(1, Math.ceil((bakeRight - bakeLeft) * zoom));
    const vHeight = Math.max(1, Math.ceil((bakeBottom - bakeTop) * zoom));
    horizontal.width = Math.max(1, Math.ceil(hWidth * pr));
    horizontal.height = Math.max(1, Math.ceil(thickness * pr));
    vertical.width = Math.max(1, Math.ceil(thickness * pr));
    vertical.height = Math.max(1, Math.ceil(vHeight * pr));

    const hCtx = horizontal.getContext('2d');
    const vCtx = vertical.getContext('2d');
    if (hCtx !== null) {
      hCtx.setTransform(pr, 0, 0, pr, 0, 0);
      hCtx.clearRect(0, 0, hWidth, thickness);
      hCtx.strokeStyle = this.tickColor;
      hCtx.fillStyle = this.textColor;
      hCtx.font = '10px sans-serif';
      hCtx.textAlign = 'left';
      hCtx.textBaseline = 'top';
      hCtx.beginPath();
      for (let x = Math.floor(bakeLeft / step) * step; x <= bakeRight; x += step) {
        const screenX = (x - bakeLeft) * zoom;
        hCtx.moveTo(screenX, thickness);
        hCtx.lineTo(screenX, thickness - 6);
        hCtx.fillText(`${Math.round(x)}`, screenX + 2, 2);
      }
      hCtx.stroke();
    }

    if (vCtx !== null) {
      vCtx.setTransform(pr, 0, 0, pr, 0, 0);
      vCtx.clearRect(0, 0, thickness, vHeight);
      vCtx.strokeStyle = this.tickColor;
      vCtx.fillStyle = this.textColor;
      vCtx.font = '10px sans-serif';
      vCtx.textAlign = 'left';
      vCtx.textBaseline = 'top';
      vCtx.beginPath();
      for (let y = Math.floor(bakeTop / step) * step; y <= bakeBottom; y += step) {
        const screenY = (y - bakeTop) * zoom;
        vCtx.moveTo(thickness, screenY);
        vCtx.lineTo(thickness - 6, screenY);
        vCtx.save();
        vCtx.translate(2, screenY + 2);
        vCtx.rotate(-Math.PI / 2);
        vCtx.fillText(`${Math.round(y)}`, 0, 0);
        vCtx.restore();
      }
      vCtx.stroke();
    }

    this.tickBakeGeneration += 1;
    this.tickBake = {
      zoom,
      pixelRatio: renderer.pixelRatio,
      worldLeft: bakeLeft,
      worldTop: bakeTop,
      worldRight: bakeRight,
      worldBottom: bakeBottom,
      horizontal,
      vertical,
    };
    return this.tickBake;
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
