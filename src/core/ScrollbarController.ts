import type { Bounds, DiagramOptions, Point, ScrollbarOptions } from '@/types';
import { drawRoundedRectPath } from '@/utils/geometry';

export type ScrollbarAxis = 'horizontal' | 'vertical';

interface ScrollbarTrackMetrics {
  trackX: number;
  trackY: number;
  trackLength: number;
  thickness: number;
  thumbLength: number;
  thumbOffset: number;
  maxScroll: number;
}

interface ScrollbarMetrics {
  contentBounds: Bounds;
  viewportBounds: Bounds;
  horizontal: ScrollbarTrackMetrics | null;
  vertical: ScrollbarTrackMetrics | null;
}

export interface ScrollbarHost {
  getWidth(): number;
  getHeight(): number;
  getZoom(): number;
  getOffsetX(): number;
  setOffsetX(value: number): void;
  getOffsetY(): number;
  setOffsetY(value: number): void;
  getPixelRatio(): number;
  markDirty(): void;
  screenToCanvas(screenX: number, screenY: number): Point | null;
  getContentBounds(): Bounds | null;
  isDarkTheme(): boolean;
}

const DEFAULT_SCROLLBAR_OPTIONS: ScrollbarOptions = {
  enabled: true,
  autoHide: false,
  autoHideDelay: 1200,
  fadeDuration: 220,
  thickness: 6,
  hoverThickness: 8,
  minThumbLength: 24,
  hitAreaPadding: 4,
  pageScrollRatio: 0.8,
  trackColor: '',
  thumbColor: '',
  thumbHoverColor: '',
  thumbActiveColor: '',
};

export class ScrollbarController {
  private readonly options: ScrollbarOptions;
  private hoveredAxis: ScrollbarAxis | null = null;
  private activeAxis: ScrollbarAxis | null = null;
  private lastInteractionAt = performance.now();
  private lastAlpha = -1;

  constructor(
    private readonly host: ScrollbarHost,
    diagramOptions: DiagramOptions
  ) {
    this.options = ScrollbarController.resolveOptions(diagramOptions);
  }

  updateAnimation(now: number): boolean {
    if (!this.options.enabled || !this.options.autoHide) {
      return false;
    }
    const alpha = this.getAlpha(now);
    if (Math.abs(alpha - this.lastAlpha) <= 0.001) {
      return false;
    }
    this.lastAlpha = alpha;
    return true;
  }

  render(ctx: CanvasRenderingContext2D, frameTime: number): void {
    const metrics = this.getMetrics();
    if (!metrics) {
      return;
    }
    const alpha = this.getAlpha(frameTime);
    this.lastAlpha = alpha;
    if (alpha <= 0.001) {
      return;
    }

    const colors = this.resolveColors();
    ctx.save();
    const pixelRatio = this.host.getPixelRatio();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.globalAlpha = alpha;

    if (metrics.horizontal) {
      const isHovered = this.hoveredAxis === 'horizontal';
      const isActive = this.activeAxis === 'horizontal';
      const thickness =
        isHovered || isActive ? this.options.hoverThickness : this.options.thickness;
      const trackY = metrics.horizontal.trackY + (metrics.horizontal.thickness - thickness) / 2;
      const radius = thickness / 2;
      ctx.fillStyle = colors.track;
      drawRoundedRectPath(
        ctx,
        metrics.horizontal.trackX,
        trackY,
        metrics.horizontal.trackLength,
        thickness,
        radius
      );
      ctx.fill();
      ctx.fillStyle = isActive ? colors.thumbActive : isHovered ? colors.thumbHover : colors.thumb;
      drawRoundedRectPath(
        ctx,
        metrics.horizontal.trackX + metrics.horizontal.thumbOffset,
        trackY,
        metrics.horizontal.thumbLength,
        thickness,
        radius
      );
      ctx.fill();
    }

    if (metrics.vertical) {
      const isHovered = this.hoveredAxis === 'vertical';
      const isActive = this.activeAxis === 'vertical';
      const thickness =
        isHovered || isActive ? this.options.hoverThickness : this.options.thickness;
      const trackX = metrics.vertical.trackX + (metrics.vertical.thickness - thickness) / 2;
      const radius = thickness / 2;
      ctx.fillStyle = colors.track;
      drawRoundedRectPath(
        ctx,
        trackX,
        metrics.vertical.trackY,
        thickness,
        metrics.vertical.trackLength,
        radius
      );
      ctx.fill();
      ctx.fillStyle = isActive ? colors.thumbActive : isHovered ? colors.thumbHover : colors.thumb;
      drawRoundedRectPath(
        ctx,
        trackX,
        metrics.vertical.trackY + metrics.vertical.thumbOffset,
        thickness,
        metrics.vertical.thumbLength,
        radius
      );
      ctx.fill();
    }
    ctx.restore();
  }

  notifyInteraction(): void {
    this.lastInteractionAt = performance.now();
    this.host.markDirty();
  }

  setActiveAxis(axis: ScrollbarAxis | null): void {
    if (this.activeAxis === axis) return;
    this.activeAxis = axis;
    if (axis === null) this.host.markDirty();
    else this.notifyInteraction();
  }

  updateHover(screenX: number, screenY: number): boolean {
    const axis = this.hitTestArea(screenX, screenY);
    if (this.hoveredAxis !== axis) {
      this.hoveredAxis = axis;
      this.host.markDirty();
      if (axis !== null) this.notifyInteraction();
    }
    return axis !== null;
  }

  clearHover(): void {
    if (this.hoveredAxis === null) return;
    this.hoveredAxis = null;
    this.host.markDirty();
  }

  hitTestThumb(
    screenX: number,
    screenY: number
  ): { axis: ScrollbarAxis; pointerOffset: number } | null {
    const metrics = this.getMetrics();
    const point = this.host.screenToCanvas(screenX, screenY);
    if (!metrics || !point) return null;
    const padding = this.options.hitAreaPadding;
    if (metrics.horizontal) {
      const start = metrics.horizontal.trackX + metrics.horizontal.thumbOffset;
      if (
        point.x >= start - padding &&
        point.x <= start + metrics.horizontal.thumbLength + padding &&
        point.y >= metrics.horizontal.trackY - padding &&
        point.y <= metrics.horizontal.trackY + metrics.horizontal.thickness + padding
      ) {
        return { axis: 'horizontal', pointerOffset: point.x - start };
      }
    }
    if (metrics.vertical) {
      const start = metrics.vertical.trackY + metrics.vertical.thumbOffset;
      if (
        point.x >= metrics.vertical.trackX - padding &&
        point.x <= metrics.vertical.trackX + metrics.vertical.thickness + padding &&
        point.y >= start - padding &&
        point.y <= start + metrics.vertical.thumbLength + padding
      ) {
        return { axis: 'vertical', pointerOffset: point.y - start };
      }
    }
    return null;
  }

  dragThumb(axis: ScrollbarAxis, screenX: number, screenY: number, pointerOffset: number): boolean {
    const metrics = this.getMetrics();
    const point = this.host.screenToCanvas(screenX, screenY);
    if (!metrics || !point) return false;
    const track = axis === 'horizontal' ? metrics.horizontal : metrics.vertical;
    if (!track) return false;
    const coordinate = axis === 'horizontal' ? point.x : point.y;
    const trackStart = axis === 'horizontal' ? track.trackX : track.trackY;
    const travel = Math.max(0, track.trackLength - track.thumbLength);
    const thumbOffset = Math.min(Math.max(coordinate - trackStart - pointerOffset, 0), travel);
    const scroll = travel > 0 && track.maxScroll > 0 ? (thumbOffset / travel) * track.maxScroll : 0;
    const viewportStart =
      (axis === 'horizontal' ? metrics.contentBounds.x : metrics.contentBounds.y) + scroll;
    if (axis === 'horizontal') this.host.setOffsetX(-viewportStart * this.host.getZoom());
    else this.host.setOffsetY(-viewportStart * this.host.getZoom());
    this.notifyInteraction();
    return true;
  }

  clickTrack(screenX: number, screenY: number): boolean {
    const metrics = this.getMetrics();
    const point = this.host.screenToCanvas(screenX, screenY);
    if (!metrics || !point) return false;
    if (metrics.horizontal && this.clickTrackAxis('horizontal', metrics, point)) return true;
    return metrics.vertical ? this.clickTrackAxis('vertical', metrics, point) : false;
  }

  scrollBy(screenDx: number, screenDy: number): boolean {
    const state = this.getScrollState();
    if (!state) return false;
    const zoom = this.host.getZoom();
    const maxX = Math.max(0, state.contentBounds.width - state.viewportBounds.width);
    const maxY = Math.max(0, state.contentBounds.height - state.viewportBounds.height);
    const x = Math.min(
      Math.max(state.viewportBounds.x + screenDx / zoom, state.contentBounds.x),
      state.contentBounds.x + maxX
    );
    const y = Math.min(
      Math.max(state.viewportBounds.y + screenDy / zoom, state.contentBounds.y),
      state.contentBounds.y + maxY
    );
    this.host.setOffsetX(-x * zoom);
    this.host.setOffsetY(-y * zoom);
    this.notifyInteraction();
    return true;
  }

  scrollToStart(): boolean {
    const state = this.getScrollState();
    if (!state) return false;
    const zoom = this.host.getZoom();
    this.host.setOffsetX(-state.contentBounds.x * zoom);
    this.host.setOffsetY(-state.contentBounds.y * zoom);
    this.notifyInteraction();
    return true;
  }

  scrollToEnd(): boolean {
    const state = this.getScrollState();
    if (!state) return false;
    const maxX = Math.max(0, state.contentBounds.width - state.viewportBounds.width);
    const maxY = Math.max(0, state.contentBounds.height - state.viewportBounds.height);
    const zoom = this.host.getZoom();
    this.host.setOffsetX(-(state.contentBounds.x + maxX) * zoom);
    this.host.setOffsetY(-(state.contentBounds.y + maxY) * zoom);
    this.notifyInteraction();
    return true;
  }

  private clickTrackAxis(axis: ScrollbarAxis, metrics: ScrollbarMetrics, point: Point): boolean {
    const track = axis === 'horizontal' ? metrics.horizontal : metrics.vertical;
    if (!track) return false;
    const coordinate = axis === 'horizontal' ? point.x : point.y;
    const cross = axis === 'horizontal' ? point.y : point.x;
    const start = axis === 'horizontal' ? track.trackX : track.trackY;
    const crossStart = axis === 'horizontal' ? track.trackY : track.trackX;
    if (
      coordinate < start ||
      coordinate > start + track.trackLength ||
      cross < crossStart ||
      cross > crossStart + track.thickness
    ) {
      return false;
    }
    const thumbStart = start + track.thumbOffset;
    const thumbEnd = thumbStart + track.thumbLength;
    if (coordinate >= thumbStart && coordinate <= thumbEnd) return false;
    const direction = coordinate < thumbStart ? -1 : 1;
    const viewportSize =
      axis === 'horizontal' ? metrics.viewportBounds.width : metrics.viewportBounds.height;
    const current =
      (axis === 'horizontal' ? metrics.viewportBounds.x : metrics.viewportBounds.y) -
      (axis === 'horizontal' ? metrics.contentBounds.x : metrics.contentBounds.y);
    const next = Math.min(
      Math.max(current + viewportSize * this.options.pageScrollRatio * direction, 0),
      track.maxScroll
    );
    const viewportStart =
      (axis === 'horizontal' ? metrics.contentBounds.x : metrics.contentBounds.y) + next;
    if (axis === 'horizontal') this.host.setOffsetX(-viewportStart * this.host.getZoom());
    else this.host.setOffsetY(-viewportStart * this.host.getZoom());
    this.notifyInteraction();
    return true;
  }

  private getMetrics(): ScrollbarMetrics | null {
    if (!this.options.enabled) return null;
    const state = this.getScrollState();
    if (!state) return null;
    const { contentBounds, viewportBounds } = state;
    const contentWidth = Math.max(contentBounds.width, 1);
    const contentHeight = Math.max(contentBounds.height, 1);
    const showHorizontal = contentWidth > viewportBounds.width + 0.01;
    const showVertical = contentHeight > viewportBounds.height + 0.01;
    if (!showHorizontal && !showVertical) return null;

    const padding = 6;
    const spacing = 4;
    const width = this.host.getWidth();
    const height = this.host.getHeight();
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) return null;
    const horizontalLength = Math.max(
      0,
      availableWidth - (showVertical ? this.options.thickness + spacing : 0)
    );
    const verticalLength = Math.max(
      0,
      availableHeight - (showHorizontal ? this.options.thickness + spacing : 0)
    );
    return {
      contentBounds,
      viewportBounds,
      horizontal: showHorizontal
        ? this.createTrack(
            horizontalLength,
            viewportBounds.width,
            contentWidth,
            viewportBounds.x - contentBounds.x,
            padding,
            height - padding - this.options.thickness
          )
        : null,
      vertical: showVertical
        ? this.createTrack(
            verticalLength,
            viewportBounds.height,
            contentHeight,
            viewportBounds.y - contentBounds.y,
            width - padding - this.options.thickness,
            padding
          )
        : null,
    };
  }

  private createTrack(
    length: number,
    viewportSize: number,
    contentSize: number,
    scroll: number,
    trackX: number,
    trackY: number
  ): ScrollbarTrackMetrics | null {
    if (length <= 0) return null;
    const maxScroll = Math.max(0, contentSize - viewportSize);
    const thumbLength = Math.min(
      length,
      Math.max(this.options.minThumbLength, length * (viewportSize / contentSize))
    );
    const travel = Math.max(0, length - thumbLength);
    return {
      trackX,
      trackY,
      trackLength: length,
      thickness: this.options.thickness,
      thumbLength,
      thumbOffset:
        maxScroll > 0 ? (Math.min(Math.max(scroll, 0), maxScroll) / maxScroll) * travel : 0,
      maxScroll,
    };
  }

  private getScrollState(): { contentBounds: Bounds; viewportBounds: Bounds } | null {
    const raw = this.host.getContentBounds();
    if (!raw) return null;
    const viewportBounds = this.getViewportBounds();
    const minX = Math.min(raw.x, viewportBounds.x);
    const minY = Math.min(raw.y, viewportBounds.y);
    const maxX = Math.max(raw.x + raw.width, viewportBounds.x + viewportBounds.width);
    const maxY = Math.max(raw.y + raw.height, viewportBounds.y + viewportBounds.height);
    return {
      contentBounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      viewportBounds,
    };
  }

  private getViewportBounds(): Bounds {
    const zoom = this.host.getZoom();
    return {
      x: -this.host.getOffsetX() / zoom,
      y: -this.host.getOffsetY() / zoom,
      width: this.host.getWidth() / zoom,
      height: this.host.getHeight() / zoom,
    };
  }

  private hitTestArea(screenX: number, screenY: number): ScrollbarAxis | null {
    const metrics = this.getMetrics();
    const point = this.host.screenToCanvas(screenX, screenY);
    if (!metrics || !point) return null;
    const padding = this.options.hitAreaPadding;
    for (const axis of ['horizontal', 'vertical'] as const) {
      const track = metrics[axis];
      if (!track) continue;
      const coordinate = axis === 'horizontal' ? point.x : point.y;
      const cross = axis === 'horizontal' ? point.y : point.x;
      const start = axis === 'horizontal' ? track.trackX : track.trackY;
      const crossStart = axis === 'horizontal' ? track.trackY : track.trackX;
      if (
        coordinate >= start - padding &&
        coordinate <= start + track.trackLength + padding &&
        cross >= crossStart - padding &&
        cross <= crossStart + track.thickness + padding
      ) {
        return axis;
      }
    }
    return null;
  }

  private getAlpha(now: number): number {
    if (!this.options.autoHide || this.activeAxis !== null || this.hoveredAxis !== null) return 1;
    const elapsed = now - this.lastInteractionAt;
    if (elapsed <= this.options.autoHideDelay) return 1;
    if (this.options.fadeDuration <= 0) return 0;
    return Math.max(0, 1 - (elapsed - this.options.autoHideDelay) / this.options.fadeDuration);
  }

  private resolveColors(): {
    track: string;
    thumb: string;
    thumbHover: string;
    thumbActive: string;
  } {
    const fallback = this.host.isDarkTheme()
      ? {
          track: 'rgba(148, 163, 184, 0.22)',
          thumb: 'rgba(226, 232, 240, 0.68)',
          thumbHover: 'rgba(226, 232, 240, 0.86)',
          thumbActive: 'rgba(248, 250, 252, 0.96)',
        }
      : {
          track: 'rgba(15, 23, 42, 0.16)',
          thumb: 'rgba(51, 65, 85, 0.7)',
          thumbHover: 'rgba(30, 41, 59, 0.82)',
          thumbActive: 'rgba(15, 23, 42, 0.9)',
        };
    return {
      track: this.options.trackColor || fallback.track,
      thumb: this.options.thumbColor || fallback.thumb,
      thumbHover: this.options.thumbHoverColor || fallback.thumbHover,
      thumbActive: this.options.thumbActiveColor || fallback.thumbActive,
    };
  }

  private static resolveOptions(options: DiagramOptions): ScrollbarOptions {
    const resolved = {
      ...DEFAULT_SCROLLBAR_OPTIONS,
      enabled: options.scrollbarOverlay ?? DEFAULT_SCROLLBAR_OPTIONS.enabled,
    };
    if (typeof options.scrollbar === 'boolean') return { ...resolved, enabled: options.scrollbar };
    return options.scrollbar ? { ...resolved, ...options.scrollbar } : resolved;
  }
}
