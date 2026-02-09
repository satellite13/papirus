import type { DiagramPlugin, DiagramRenderer } from '../DiagramRenderer';
import type { Bounds } from '@/types';
import { getContentBounds } from '@/utils/contentBounds';

export interface MiniMapOptions {
  enabled?: boolean;
  width?: number;
  height?: number;
  padding?: number;
  backgroundColor?: string;
  borderColor?: string;
  viewportColor?: string;
}

export class MiniMap implements DiagramPlugin {
  private readonly options: Required<MiniMapOptions>;
  private removeOverlay: (() => void) | null = null;

  constructor(options: MiniMapOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      width: options.width ?? 180,
      height: options.height ?? 120,
      padding: options.padding ?? 12,
      backgroundColor: options.backgroundColor ?? 'rgba(24, 24, 27, 0.5)',
      borderColor: options.borderColor ?? '#52525b',
      viewportColor: options.viewportColor ?? '#22c55e',
    };
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addOverlayRenderer((ctx) => {
      if (!this.options.enabled) return;
      const bounds = getContentBounds({
        nodes: renderer.nodes.values(),
        edges: renderer.edges.values(),
        groups: renderer.groups.values(),
      });
      if (!bounds) return;

      const { width, height, padding } = this.options;
      const x = renderer.width - width - padding;
      const y = renderer.height - height - padding;

      ctx.save();
      ctx.setTransform(renderer.pixelRatio, 0, 0, renderer.pixelRatio, 0, 0);

      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = this.options.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      const scale = Math.min(width / bounds.width, height / bounds.height);
      const offsetX = x + (width - bounds.width * scale) / 2;
      const offsetY = y + (height - bounds.height * scale) / 2;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.translate(-bounds.x, -bounds.y);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1 / scale;

      for (const edge of renderer.edges.values()) {
        if (!edge.visible) continue;
        const path = edge.path;
        if (path.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0]!.x, path[0]!.y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i]!.x, path[i]!.y);
        }
        ctx.stroke();
      }

      for (const node of renderer.nodes.values()) {
        if (!node.visible) continue;
        const b = node.getBounds();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }

      ctx.restore();

      const viewBounds = this.getViewportBounds(renderer);
      let viewX = offsetX + (viewBounds.x - bounds.x) * scale;
      let viewY = offsetY + (viewBounds.y - bounds.y) * scale;
      let viewW = viewBounds.width * scale;
      let viewH = viewBounds.height * scale;

      const minX = x;
      const minY = y;
      const maxX = x + width;
      const maxY = y + height;

      if (viewX < minX) {
        viewW -= minX - viewX;
        viewX = minX;
      }
      if (viewY < minY) {
        viewH -= minY - viewY;
        viewY = minY;
      }
      if (viewX + viewW > maxX) {
        viewW = maxX - viewX;
      }
      if (viewY + viewH > maxY) {
        viewH = maxY - viewY;
      }

      if (viewW < 0 || viewH < 0) {
        ctx.restore();
        return;
      }

      ctx.strokeStyle = this.options.viewportColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(viewX, viewY, viewW, viewH);

      ctx.restore();
    });
  }

  destroy(): void {
    this.removeOverlay?.();
    this.removeOverlay = null;
  }

  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  private getViewportBounds(renderer: DiagramRenderer): Bounds {
    return {
      x: -renderer.offsetX / renderer.zoom,
      y: -renderer.offsetY / renderer.zoom,
      width: renderer.width / renderer.zoom,
      height: renderer.height / renderer.zoom,
    };
  }
}
