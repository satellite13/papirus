import type { DiagramPlugin, DiagramRenderer } from '../DiagramRenderer';
import type { Bounds } from '@/types';
import { getContentBounds } from '@/utils/contentBounds';

export type MiniMapAnchor = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface MiniMapOptions {
  enabled?: boolean;
  width?: number;
  height?: number;
  padding?: number;
  backgroundColor?: string;
  borderColor?: string;
  viewportColor?: string;
  anchor?: MiniMapAnchor;
}

interface MiniMapLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  bounds: Bounds;
  scale: number;
  mapOffsetX: number;
  mapOffsetY: number;
  viewportBounds: Bounds;
  viewRect: Bounds;
}

interface MiniMapDragPayload {
  pointerOffsetX: number;
  pointerOffsetY: number;
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
      anchor: options.anchor ?? 'bottom-right',
    };
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addOverlayRenderer((ctx) => {
      if (!this.options.enabled) return;
      const layout = this.computeLayout(renderer);
      if (!layout) return;
      const { x, y, width, height, bounds, scale, mapOffsetX, mapOffsetY, viewRect } = layout;

      ctx.save();
      ctx.setTransform(renderer.pixelRatio, 0, 0, renderer.pixelRatio, 0, 0);

      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = this.options.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      ctx.save();
      ctx.translate(mapOffsetX, mapOffsetY);
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

      if (viewRect.width < 0 || viewRect.height < 0) {
        ctx.restore();
        return;
      }

      ctx.strokeStyle = this.options.viewportColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

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

  beginOverlayDrag(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number
  ): MiniMapDragPayload | null {
    if (!this.options.enabled) {
      return null;
    }
    const layout = this.computeLayout(renderer);
    if (!layout) {
      return null;
    }
    const point = renderer.screenToCanvas(screenX, screenY);
    if (!point) {
      return null;
    }

    const insideViewport =
      point.x >= layout.viewRect.x &&
      point.x <= layout.viewRect.x + layout.viewRect.width &&
      point.y >= layout.viewRect.y &&
      point.y <= layout.viewRect.y + layout.viewRect.height;
    if (!insideViewport) {
      return null;
    }

    return {
      pointerOffsetX: point.x - layout.viewRect.x,
      pointerOffsetY: point.y - layout.viewRect.y,
    };
  }

  updateOverlayDrag(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number,
    payload: unknown
  ): boolean {
    if (!this.options.enabled) {
      return false;
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('pointerOffsetX' in payload) ||
      !('pointerOffsetY' in payload)
    ) {
      return false;
    }
    const dragPayload = payload as MiniMapDragPayload;
    const layout = this.computeLayout(renderer);
    if (!layout) {
      return false;
    }
    const point = renderer.screenToCanvas(screenX, screenY);
    if (!point) {
      return false;
    }

    const desiredViewX = point.x - dragPayload.pointerOffsetX;
    const desiredViewY = point.y - dragPayload.pointerOffsetY;
    const desiredViewportX = layout.bounds.x + (desiredViewX - layout.mapOffsetX) / layout.scale;
    const desiredViewportY = layout.bounds.y + (desiredViewY - layout.mapOffsetY) / layout.scale;
    const maxScrollX = Math.max(0, layout.bounds.width - layout.viewportBounds.width);
    const maxScrollY = Math.max(0, layout.bounds.height - layout.viewportBounds.height);
    const clampedViewportX = Math.min(
      Math.max(desiredViewportX, layout.bounds.x),
      layout.bounds.x + maxScrollX
    );
    const clampedViewportY = Math.min(
      Math.max(desiredViewportY, layout.bounds.y),
      layout.bounds.y + maxScrollY
    );

    renderer.offsetX = -clampedViewportX * renderer.zoom;
    renderer.offsetY = -clampedViewportY * renderer.zoom;
    return true;
  }

  private getViewportBounds(renderer: DiagramRenderer): Bounds {
    return {
      x: -renderer.offsetX / renderer.zoom,
      y: -renderer.offsetY / renderer.zoom,
      width: renderer.width / renderer.zoom,
      height: renderer.height / renderer.zoom,
    };
  }

  private computeLayout(renderer: DiagramRenderer): MiniMapLayout | null {
    const rawBounds = getContentBounds({
      nodes: renderer.nodes.values(),
      edges: renderer.edges.values(),
      groups: renderer.groups.values(),
    });
    if (!rawBounds) {
      return null;
    }

    const { width, height, padding, anchor } = this.options;
    const x =
      anchor === 'bottom-left' || anchor === 'top-left' ? padding : renderer.width - width - padding;
    const y =
      anchor === 'top-left' || anchor === 'top-right' ? padding : renderer.height - height - padding;

    const viewportBounds = this.getViewportBounds(renderer);
    const unionMinX = Math.min(rawBounds.x, viewportBounds.x);
    const unionMinY = Math.min(rawBounds.y, viewportBounds.y);
    const unionMaxX = Math.max(rawBounds.x + rawBounds.width, viewportBounds.x + viewportBounds.width);
    const unionMaxY = Math.max(rawBounds.y + rawBounds.height, viewportBounds.y + viewportBounds.height);
    const bounds = {
      x: unionMinX,
      y: unionMinY,
      width: unionMaxX - unionMinX,
      height: unionMaxY - unionMinY,
    };

    const scale = Math.min(width / bounds.width, height / bounds.height);
    const mapOffsetX = x + (width - bounds.width * scale) / 2;
    const mapOffsetY = y + (height - bounds.height * scale) / 2;

    let viewX = mapOffsetX + (viewportBounds.x - bounds.x) * scale;
    let viewY = mapOffsetY + (viewportBounds.y - bounds.y) * scale;
    let viewW = viewportBounds.width * scale;
    let viewH = viewportBounds.height * scale;

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

    return {
      x,
      y,
      width,
      height,
      bounds,
      scale,
      mapOffsetX,
      mapOffsetY,
      viewportBounds,
      viewRect: {
        x: viewX,
        y: viewY,
        width: viewW,
        height: viewH,
      },
    };
  }
}
