import type { DiagramRenderer } from '../DiagramRenderer';
import { adaptiveGridStep } from '@/utils/adaptiveGridStep';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';

export interface GridOverlayOptions extends BaseOverlayOptions {
  gridSize?: number;
  color?: string;
}

export class GridOverlay extends BaseOverlay {
  private gridSize: number;
  private color: string;

  constructor(options: GridOverlayOptions = {}) {
    super(options.enabled ?? true);
    this.gridSize = options.gridSize ?? 20;
    this.color = options.color ?? '#e0e0e0';
  }

  setColor(color: string): void {
    this.color = color;
  }

  setGridSize(size: number): void {
    this.gridSize = size;
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addUnderlayRenderer((ctx) => {
      if (!this.enabled) {
        return;
      }

      const width = renderer.width;
      const height = renderer.height;
      const zoom = renderer.zoom;
      const step = adaptiveGridStep(this.gridSize, zoom);

      const startX = Math.floor(-renderer.offsetX / zoom / step) * step;
      const startY = Math.floor(-renderer.offsetY / zoom / step) * step;
      const endX = Math.ceil((width - renderer.offsetX) / zoom / step) * step;
      const endY = Math.ceil((height - renderer.offsetY) / zoom / step) * step;

      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();

      for (let x = startX; x <= endX; x += step) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }

      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }

      ctx.stroke();
    });
  }
}
