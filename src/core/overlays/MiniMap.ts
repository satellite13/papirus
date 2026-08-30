import type { DiagramRenderer } from '../DiagramRenderer';
import type { Bounds, Point } from '@/types';
import { getContentBounds } from '@/utils/contentBounds';
import { BaseOverlay, type BaseOverlayOptions } from './BaseOverlay';

export type MiniMapAnchor = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface MiniMapOptions extends BaseOverlayOptions {
  width?: number;
  height?: number;
  padding?: number;
  /** Отступ (в мировых координатах) вокруг контента — расширяет область, в пределах которой можно перемещать view. По умолчанию 0. */
  contentMargin?: number;
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

type MiniMapDragPayload =
  | { kind: 'viewport'; pointerOffsetX: number; pointerOffsetY: number }
  | { kind: 'block' };

export class MiniMap extends BaseOverlay {
  private readonly options: Required<Omit<MiniMapOptions, 'enabled'>>;
  /**
   * Cached raster of node boxes. Rebuilt only when {@link DiagramRenderer.getContentRevision}
   * or the map projection key changes — not on every pan.
   */
  private contentBake: {
    revision: number;
    projectionKey: string;
    canvas: HTMLCanvasElement;
  } | null = null;

  constructor(options: MiniMapOptions = {}) {
    super(options.enabled ?? true);
    this.options = {
      width: options.width ?? 180,
      height: options.height ?? 120,
      padding: options.padding ?? 12,
      contentMargin: options.contentMargin ?? 0,
      backgroundColor: options.backgroundColor ?? 'rgba(24, 24, 27, 0.5)',
      borderColor: options.borderColor ?? '#52525b',
      viewportColor: options.viewportColor ?? '#22c55e',
      anchor: options.anchor ?? 'bottom-right',
    };
  }

  /** Cached bake projection; stable across pan if only the viewport moved. */
  getContentBakeProjectionKey(): string | null {
    return this.contentBake?.projectionKey ?? null;
  }

  install(renderer: DiagramRenderer): void {
    this.removeOverlay = renderer.addTopOverlayRenderer((ctx) => {
      if (!this.enabled) return;
      const layout = this.computeLayout(renderer);
      if (!layout) return;
      const { x, y, width, height, viewRect } = layout;

      ctx.save();
      ctx.setTransform(renderer.pixelRatio, 0, 0, renderer.pixelRatio, 0, 0);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = this.options.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      const bake = this.ensureContentBake(renderer, layout);
      ctx.drawImage(bake, x, y, width, height);

      if (viewRect.width >= 0 && viewRect.height >= 0) {
        ctx.strokeStyle = this.options.viewportColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
      }

      ctx.restore();
    });
  }

  private ensureContentBake(
    renderer: DiagramRenderer,
    layout: MiniMapLayout
  ): HTMLCanvasElement {
    const { x, y, width, height, bounds, scale, mapOffsetX, mapOffsetY } = layout;
    const revision = renderer.getContentRevision();
    const projectionKey = [
      width,
      height,
      Math.round(bounds.x),
      Math.round(bounds.y),
      Math.round(bounds.width),
      Math.round(bounds.height),
      scale.toFixed(5),
      Math.round(mapOffsetX),
      Math.round(mapOffsetY),
    ].join('|');

    if (
      this.contentBake !== null &&
      this.contentBake.revision === revision &&
      this.contentBake.projectionKey === projectionKey
    ) {
      return this.contentBake.canvas;
    }

    const canvas = this.contentBake?.canvas ?? document.createElement('canvas');
    const pixelRatio = Math.max(1, Math.min(2, renderer.pixelRatio));
    canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
    canvas.height = Math.max(1, Math.ceil(height * pixelRatio));
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return canvas;
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(mapOffsetX - x, mapOffsetY - y);
    ctx.scale(scale, scale);
    ctx.translate(-bounds.x, -bounds.y);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    for (const node of renderer.nodes.values()) {
      if (!node.visible) continue;
      const b = node.getBounds();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }

    ctx.restore();
    this.contentBake = { revision, projectionKey, canvas };
    return canvas;
  }

  beginOverlayDrag(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number
  ): MiniMapDragPayload | null {
    const hit = this.hitTestMiniMap(renderer, screenX, screenY);
    if (!hit) {
      return null;
    }
    const { layout, canvasPoint: point } = hit;

    const vr = layout.viewRect;
    const viewportOk = vr.width >= 0 && vr.height >= 0;
    const insideViewport =
      viewportOk &&
      point.x >= vr.x &&
      point.x <= vr.x + vr.width &&
      point.y >= vr.y &&
      point.y <= vr.y + vr.height;
    if (insideViewport) {
      return {
        kind: 'viewport',
        pointerOffsetX: point.x - vr.x,
        pointerOffsetY: point.y - vr.y,
      };
    }

    return { kind: 'block' };
  }

  blocksDiagramPointerAtScreen(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number
  ): boolean {
    return this.hitTestMiniMap(renderer, screenX, screenY) !== null;
  }

  updateOverlayDrag(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number,
    payload: unknown
  ): boolean {
    if (!this.enabled) {
      return false;
    }
    if (typeof payload !== 'object' || payload === null || !('kind' in payload)) {
      return false;
    }
    const dragPayload = payload as MiniMapDragPayload;
    if (dragPayload.kind === 'block') {
      return true;
    }
    if (dragPayload.kind !== 'viewport') {
      return false;
    }
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

  private hitTestMiniMap(
    renderer: DiagramRenderer,
    screenX: number,
    screenY: number
  ): { layout: MiniMapLayout; canvasPoint: Point } | null {
    if (!this.enabled) {
      return null;
    }
    const layout = this.computeLayout(renderer);
    if (!layout) {
      return null;
    }
    const canvasPoint = renderer.screenToCanvas(screenX, screenY);
    if (!canvasPoint) {
      return null;
    }
    const { x, y, width, height } = layout;
    if (
      canvasPoint.x < x ||
      canvasPoint.x > x + width ||
      canvasPoint.y < y ||
      canvasPoint.y > y + height
    ) {
      return null;
    }
    return { layout, canvasPoint };
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
      groups: renderer.groups.values(),
    });
    if (!rawBounds) {
      return null;
    }

    const margin = this.options.contentMargin;
    const bounds = {
      x: rawBounds.x - margin,
      y: rawBounds.y - margin,
      width: rawBounds.width + 2 * margin,
      height: rawBounds.height + 2 * margin,
    };

    const { width, height, padding, anchor } = this.options;
    const x =
      anchor === 'bottom-left' || anchor === 'top-left' ? padding : renderer.width - width - padding;
    const y =
      anchor === 'top-left' || anchor === 'top-right' ? padding : renderer.height - height - padding;

    const viewportBounds = this.getViewportBounds(renderer);
    const scale = Math.min(
      width / Math.max(bounds.width, 1),
      height / Math.max(bounds.height, 1)
    );
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
