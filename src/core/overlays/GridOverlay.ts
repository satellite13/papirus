import type { DiagramRenderer } from '../DiagramRenderer';
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
      const gridSize = this.gridSize;
      const color = this.color;

      const startX = Math.floor(-renderer.offsetX / renderer.zoom / gridSize) * gridSize;
      const startY = Math.floor(-renderer.offsetY / renderer.zoom / gridSize) * gridSize;
      const endX = Math.ceil((width - renderer.offsetX) / renderer.zoom / gridSize) * gridSize;
      const endY = Math.ceil((height - renderer.offsetY) / renderer.zoom / gridSize) * gridSize;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / renderer.zoom;
      ctx.beginPath();

      for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }

      for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }

      ctx.stroke();
    });
  }
}
