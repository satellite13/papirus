import { Element, generateId } from './Element';
import { Port, type PortOptions } from './Port';
import { TextLabel, type TextLabelOptions } from './TextLabel';
import { NodeImage, type NodeImageOptions, type NodeImagePlacement } from './NodeImage';
import type { StyleManager } from '@/styles/StyleManager';
import type {
  Bounds,
  ContentInsetSides,
  NodeStyle,
  Point,
  Size,
} from '@/types';
import { shallowEqual } from '@/utils/style';
import { getIconBoxSize, getIconBounds } from '@/utils/iconLayout';
import {
  DEFAULT_SELECTION_COLOR,
  NODE_HITBOX_PADDING,
  RESIZE_HANDLE_OFFSET,
  RESIZE_HANDLE_SIZE,
} from '@/constants';

/** Badge shown in top-left corner of node (e.g. interactive property indicator) */
export interface NodeBadgeOption {
  id: string;
  iconUrl: string;
}

const BADGE_SIZE = 15;
const BADGE_OFFSET = 4;
const BADGE_GAP = 4;

export interface NodeOptions {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: NodeStyle;
  styleClass?: string;
  label?: string | TextLabelOptions;
  icon?: NodeImageOptions;
  /** Content area insets per side (default 0 = full bounds). Number = same on all sides. */
  contentInset?: number | ContentInsetSides;
  ports?: PortOptions[];
  showPortsAlways?: boolean;
  anchorPoints?: AnchorPointsConfig;
  resizeHandlesEnabled?: boolean;
  /** Optional badges drawn in top-left corner of content area */
  badges?: NodeBadgeOption[];
}

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
export type AnchorId = `${'top' | 'right' | 'bottom' | 'left'}:${number}`;

/**
 * Validate if a string is a valid AnchorId format
 */
export function isValidAnchorId(id: string): id is AnchorId {
  return /^(top|right|bottom|left):\d+$/.test(id);
}

export interface AnchorPointsConfig {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

const DEFAULT_NODE_STYLE: NodeStyle = {
  fillColor: '#ffffff',
  strokeColor: '#333333',
  strokeWidth: 2,
  opacity: 1,
};

/**
 * Abstract base class for diagram nodes
 */
export abstract class Node extends Element {
  protected _ports: Port[] = [];
  protected _label?: TextLabel;
  protected _icon?: NodeImage;
  protected _badges: NodeBadgeOption[] = [];
  protected _nodeStyle: NodeStyle;
  protected _showPortsAlways: boolean;
  protected _anchorPoints: Required<AnchorPointsConfig>;
  protected _defaultSize: Size;
  protected _resizeHandlesEnabled: boolean;
  protected _contentInset: Required<ContentInsetSides>;
  private _attachToOutlineGetter?: () => boolean;
  private _anchorCache: { id: AnchorId; point: Point }[] | null = null;
  private _badgeImageCache = new Map<string, { img: HTMLImageElement; loaded: boolean }>();
  private _hoveredBadgeIndex = -1;

  protected constructor(options: NodeOptions) {
    super({
      id: options.id ?? generateId('node'),
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      style: options.style,
      styleClass: options.styleClass,
    });

    this._defaultSize = { width: options.width, height: options.height };
    this._nodeStyle = { ...DEFAULT_NODE_STYLE, ...options.style };
    this._showPortsAlways = options.showPortsAlways ?? false;
    this._anchorPoints = this.normalizeAnchorPoints(options.anchorPoints);
    this._resizeHandlesEnabled = options.resizeHandlesEnabled ?? true;
    this._contentInset = this.normalizeContentInset(options.contentInset);

    if (options.label !== undefined) {
      if (typeof options.label === 'string') {
        this._label = new TextLabel({
          text: options.label,
          onChange: (): void => this.markDirty(),
        });
      } else {
        this._label = new TextLabel({ ...options.label, onChange: (): void => this.markDirty() });
      }
    }

    if (options.icon !== undefined) {
      this._icon = new NodeImage(options.icon, () => this.markDirty());
    }

    if (options.ports !== undefined) {
      for (const portOptions of options.ports) {
        this.addPort(portOptions);
      }
    }

    if (options.badges !== undefined && options.badges.length > 0) {
      this._badges = options.badges.map((b) => ({ id: b.id, iconUrl: b.iconUrl }));
      this.ensureBadgeImagesLoaded();
    }
  }

  /**
   * Node style
   */
  override get style(): NodeStyle {
    return this._nodeStyle;
  }

  override set style(value: NodeStyle) {
    this._nodeStyle = { ...DEFAULT_NODE_STYLE, ...value };
    this._style = value;
    this.markDirty();
  }

  applyStyleManager(styleManager: StyleManager): void {
    const baseStyle = styleManager.getNodeStyle(this._state, this._styleClass);
    const mergedStyle = { ...baseStyle, ...this._style };
    if (!shallowEqual(this._nodeStyle, mergedStyle)) {
      this._nodeStyle = mergedStyle;
      this.markDirty();
    }

    if (this._label) {
      this._label.applyStyleManager(styleManager);
    }

    for (const port of this._ports) {
      port.applyStyleManager(styleManager);
    }
  }

  /**
   * Ports on this node
   */
  get ports(): readonly Port[] {
    return this._ports;
  }

  /**
   * Text label
   */
  get label(): TextLabel | undefined {
    return this._label;
  }

  set label(value: TextLabel | string | undefined) {
    if (value === undefined) {
      this._label = undefined;
    } else if (typeof value === 'string') {
      this._label = new TextLabel({ text: value, onChange: (): void => this.markDirty() });
    } else {
      this._label = value;
      this._label.setOnChange((): void => this.markDirty());
    }
    this.markDirty();
  }

  /**
   * Node icon/image
   */
  get icon(): NodeImage | undefined {
    return this._icon;
  }

  set icon(value: NodeImage | NodeImageOptions | undefined) {
    if (value === undefined) {
      this._icon = undefined;
    } else if (value instanceof NodeImage) {
      this._icon = value;
    } else {
      this._icon = new NodeImage(value, () => this.markDirty());
    }
    this.markDirty();
  }

  /**
   * Badges shown in top-left corner of node (e.g. interactive property icons)
   */
  get badges(): NodeBadgeOption[] {
    return this._badges;
  }

  set badges(value: NodeBadgeOption[]) {
    this._badges = Array.isArray(value) ? value.map((b) => ({ id: b.id, iconUrl: b.iconUrl })) : [];
    this.ensureBadgeImagesLoaded();
    this.markDirty();
  }

  /**
   * Set which badge index is under the pointer (-1 for none). Used for hover highlight and cursor.
   */
  setBadgeHover(index: number): void {
    if (this._hoveredBadgeIndex === index) return;
    this._hoveredBadgeIndex = index;
    this.markDirty();
  }

  /**
   * Return badge at world point, or null if point is not over a badge.
   */
  getBadgeAtPoint(worldPoint: Point): { id: string; index: number } | null {
    if (this._badges.length === 0) {
      return null;
    }
    const bounds = this.getBounds();
    const contentBounds = this.getLabelContainerBounds(bounds);
    const localX = worldPoint.x - (contentBounds.x + BADGE_OFFSET);
    const localY = worldPoint.y - (contentBounds.y + BADGE_OFFSET);
    for (let i = 0; i < this._badges.length; i++) {
      const badge = this._badges[i];
      if (badge === undefined) continue;
      const x = i * (BADGE_SIZE + BADGE_GAP);
      if (
        localX >= x &&
        localX <= x + BADGE_SIZE &&
        localY >= 0 &&
        localY <= BADGE_SIZE
      ) {
        return { id: badge.id, index: i };
      }
    }
    return null;
  }

  /**
   * Add a port to this node
   */
  addPort(options: PortOptions): Port {
    const port = new Port(options);
    this._ports.push(port);
    this.markDirty();
    return port;
  }

  /**
   * Remove a port by ID
   */
  removePort(portId: string): boolean {
    const index = this._ports.findIndex((p) => p.id === portId);
    if (index === -1) {
      return false;
    }
    this._ports.splice(index, 1);
    this.markDirty();
    return true;
  }

  /**
   * Get a port by ID
   */
  getPort(portId: string): Port | undefined {
    return this._ports.find((p) => p.id === portId);
  }

  /**
   * Get absolute position of a port
   */
  getPortPosition(portId: string): Point | undefined {
    const port = this.getPort(portId);
    if (port === undefined) {
      return undefined;
    }
    return port.getAbsolutePosition(this);
  }

  /**
   * Find port at a point
   */
  getPortAtPoint(point: Point): Port | undefined {
    for (const port of this._ports) {
      if (port.hitTest(point, this)) {
        return port;
      }
    }
    return undefined;
  }

  /**
   * Apply style to canvas context
   */
  protected applyStyle(ctx: CanvasRenderingContext2D): void {
    const style = this._nodeStyle;

    ctx.fillStyle = style.fillColor ?? '#ffffff';
    ctx.strokeStyle = style.strokeColor ?? '#333333';
    ctx.lineWidth = style.strokeWidth ?? 2;
    ctx.globalAlpha = style.opacity ?? 1;
    if (style.lineDash !== undefined && style.lineDash.length > 0) {
      ctx.setLineDash(style.lineDash);
    } else {
      ctx.setLineDash([]);
    }
    if (style.lineDashOffset !== undefined) {
      ctx.lineDashOffset = style.lineDashOffset;
    }

    // Highlight for hover state only
    if (this._state === 'hover') {
      ctx.strokeStyle = '#6366f1';
    }
  }

  /**
   * Whether to always show ports
   */
  get showPortsAlways(): boolean {
    return this._showPortsAlways;
  }

  set showPortsAlways(value: boolean) {
    if (this._showPortsAlways !== value) {
      this._showPortsAlways = value;
      this.markDirty();
    }
  }

  /**
   * Mark this element as needing re-render and invalidate anchor cache
   */
  override markDirty(): void {
    super.markDirty();
    this.invalidateAnchorCache();
  }

  /**
   * Invalidate anchor cache
   */
  private invalidateAnchorCache(): void {
    this._anchorCache = null;
  }

  get resizeHandlesEnabled(): boolean {
    return this._resizeHandlesEnabled;
  }

  set resizeHandlesEnabled(value: boolean) {
    if (this._resizeHandlesEnabled !== value) {
      this._resizeHandlesEnabled = value;
      this.markDirty();
    }
  }

  /**
   * Anchor points configuration (per side)
   */
  get anchorPoints(): Required<AnchorPointsConfig> {
    return this._anchorPoints;
  }

  set anchorPoints(value: AnchorPointsConfig) {
    this._anchorPoints = this.normalizeAnchorPoints(value);
    this.markDirty();
  }

  /**
   * Default size (initial width/height)
   */
  get defaultSize(): Size {
    return { ...this._defaultSize };
  }

  /**
   * Content area insets (per side). When all zero, content area = node bounds.
   */
  get contentInset(): Required<ContentInsetSides> {
    return { ...this._contentInset };
  }

  set contentInset(value: number | ContentInsetSides) {
    this._contentInset = this.normalizeContentInset(value);
    this.markDirty();
  }

  /**
   * Set getter for attachToOutline (called by DiagramRenderer when node is added)
   */
  setAttachToOutlineGetter(getter: (() => boolean) | undefined): void {
    this._attachToOutlineGetter = getter;
  }

  /**
   * Render ports
   */
  protected renderPorts(ctx: CanvasRenderingContext2D): void {
    if (this._attachToOutlineGetter?.()) {
      return;
    }
    // Show ports when hovered, selected, dragging, or if showPortsAlways is set
    const shouldShow =
      this._showPortsAlways ||
      this._ports.some((port) => port.hovered) ||
      this._state === 'hover' ||
      this._state === 'selected' ||
      this._state === 'dragging';

    if (!shouldShow) {
      return;
    }

    for (const port of this._ports) {
      port.render(ctx, this);
    }
  }

  /**
   * Calculate layout for icon and label.
   * Label always gets full content area; icon is placed within the same content area.
   */
  protected calculateContentLayout(
    bounds: Bounds,
    iconBoxSize?: Size,
    _labelSize?: Size
  ): { iconBounds: Bounds; labelBounds: Bounds } {
    const contentBounds = this.getLabelContainerBounds(bounds);
    let iconBounds = contentBounds;
    if (this._icon && iconBoxSize) {
      iconBounds = this.getIconBounds(
        contentBounds,
        iconBoxSize,
        this._icon.placement
      );
    }
    return { iconBounds, labelBounds: contentBounds };
  }

  /**
   * Get label bounds and wrapped lines for SVG export. Replicates renderContents layout logic.
   * Returns the bounds passed to label.render() and the wrapped text lines, or null if no label.
   */
  getLabelBoundsForExport(
    ctx: CanvasRenderingContext2D
  ): { bounds: Bounds; lines: string[] } | null {
    if (!this._label) {
      return null;
    }

    const bounds = this.getBounds();
    const contentBounds = this.getLabelContainerBounds(bounds);
    const iconBoxSize = this._icon ? this.getIconBoxSize() : undefined;

    this._label.setAutoMaxWidth(contentBounds.width);
    const labelSize = this._label.measure(ctx);

    const { labelBounds } = this.calculateContentLayout(
      bounds,
      iconBoxSize,
      labelSize
    );

    const lines = this._label.getWrappedLines(
      ctx,
      Math.max(0, contentBounds.width)
    );
    return { bounds: labelBounds, lines };
  }

  /**
   * Render label
   */
  protected renderLabel(ctx: CanvasRenderingContext2D, bounds: Bounds = this.getBounds()): void {
    if (this._label === undefined) {
      return;
    }

    const labelOpacity = this._label.style.opacity ?? 1;
    ctx.globalAlpha = labelOpacity;
    this._label.render(ctx, bounds);
    ctx.globalAlpha = 1;
  }

  /**
   * Get world position of label center (center of content area).
   */
  getLabelPosition(): Point {
    const bounds = this.getLabelContainerBounds(this.getBounds());
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  /**
   * Render icon, label, and ports
   */
  protected renderContents(ctx: CanvasRenderingContext2D): void {
    // Reset dash settings so icon/label/ports render solid
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    let bounds = this.getBounds();
    this.renderBadges(ctx, bounds);
    const iconBoxSize = this._icon ? this.getIconBoxSize() : undefined;

    if (this._label) {
      this._label.setAutoMaxWidth(this.getLabelContainerBounds(bounds).width);
    }
    const labelSize = this._label ? this._label.measure(ctx) : undefined;

    if (labelSize || iconBoxSize) {
      this.ensureContentsFit(labelSize, iconBoxSize);
      // Re-measure after potential resize
      if (this._label && iconBoxSize) {
        bounds = this.getBounds();
        this._label.setAutoMaxWidth(this.getLabelContainerBounds(bounds).width);
      }
    }

    const { iconBounds, labelBounds } = this.calculateContentLayout(
      this.getBounds(),
      iconBoxSize,
      labelSize
    );

    if (this._icon) {
      this._icon.render(ctx, iconBounds);
    }

    this.renderLabel(ctx, labelBounds);
    this.renderPorts(ctx);
  }

  private ensureBadgeImagesLoaded(): void {
    for (const badge of this._badges) {
      const url = badge.iconUrl;
      if (!url || this._badgeImageCache.has(url)) {
        continue;
      }
      const img = new Image();
      img.decoding = 'async';
      this._badgeImageCache.set(url, { img, loaded: false });
      img.onload = (): void => {
        const entry = this._badgeImageCache.get(url);
        if (entry) {
          entry.loaded = true;
          this.markDirty();
        }
      };
      img.onerror = (): void => {
        this.markDirty();
      };
      img.src = url;
    }
  }

  protected renderBadges(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this._badges.length === 0) {
      return;
    }
    const contentBounds = this.getLabelContainerBounds(bounds);
    const x0 = contentBounds.x + BADGE_OFFSET;
    const y0 = contentBounds.y + BADGE_OFFSET;
    const radius = 2;
    for (let i = 0; i < this._badges.length; i++) {
      const badge = this._badges[i];
      if (badge === undefined) continue;
      const x = x0 + i * (BADGE_SIZE + BADGE_GAP);
      const isHovered = this._hoveredBadgeIndex === i;
      if (isHovered) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        ctx.roundRect(x, y0, BADGE_SIZE, BADGE_SIZE, radius);
        ctx.fill();
        ctx.restore();
      }
      const entry = this._badgeImageCache.get(badge.iconUrl);
      if (entry?.loaded && entry.img.naturalWidth > 0) {
        ctx.save();
        const img = entry.img;
        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        const scale = Math.min(BADGE_SIZE / sw, BADGE_SIZE / sh, 1);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = x + (BADGE_SIZE - dw) / 2;
        const dy = y0 + (BADGE_SIZE - dh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, sw, sh, dx, dy, dw, dh);
        ctx.restore();
      }
    }
  }

  /**
   * Minimal size required to fit current contents
   */
  getContentMinSize(ctx: CanvasRenderingContext2D): Size {
    const bounds = this.getBounds();
    const labelSize = this._label ? this._label.measure(ctx) : undefined;
    const iconBoxSize = this._icon ? this.getIconBoxSize() : undefined;
    return this.calculateContentMinSize(labelSize, iconBoxSize, bounds);
  }

  /**
   * Render resize handles when selected
   */
  renderResizeHandles(ctx: CanvasRenderingContext2D): void {
    if (this._state !== 'selected' || !this._resizeHandlesEnabled) {
      return;
    }

    const bounds = this.getBounds();
    const offset = RESIZE_HANDLE_OFFSET;
    const size = RESIZE_HANDLE_SIZE;
    const half = size / 2;

    ctx.save();

    // Draw dashed selection rectangle
    ctx.strokeStyle = DEFAULT_SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      bounds.x - offset,
      bounds.y - offset,
      bounds.width + offset * 2,
      bounds.height + offset * 2
    );

    // Draw resize handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = DEFAULT_SELECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    for (const handle of this.getResizeHandlePositions()) {
      ctx.beginPath();
      ctx.rect(handle.x - half, handle.y - half, size, size);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Hit test a resize handle
   */
  hitTestResizeHandle(point: Point): ResizeHandle | null {
    if (this._state !== 'selected') {
      return null;
    }

    const size = RESIZE_HANDLE_SIZE;
    const half = size / 2;

    for (const handle of this.getResizeHandlePositions()) {
      if (
        point.x >= handle.x - half &&
        point.x <= handle.x + half &&
        point.y >= handle.y - half &&
        point.y <= handle.y + half
      ) {
        return handle.type;
      }
    }

    return null;
  }

  /**
   * Default bounding box hit test
   */
  hitTest(point: Point): boolean {
    const bounds = this.getBounds();
    const padding = NODE_HITBOX_PADDING;
    return (
      point.x >= bounds.x - padding &&
      point.x <= bounds.x + bounds.width + padding &&
      point.y >= bounds.y - padding &&
      point.y <= bounds.y + bounds.height + padding
    );
  }

  /**
   * Get a connection point on the node boundary toward a target point,
   * snapped to nearest anchor point on the contour.
   */
  getConnectionPoint(target: Point): Point {
    const anchors = this.getAnchorsOnOutline();
    if (anchors.length === 0) {
      return this.getOutlinePointToward(target);
    }

    let closest = anchors[0]!;
    let minDist = (target.x - closest.point.x) ** 2 + (target.y - closest.point.y) ** 2;

    for (let i = 1; i < anchors.length; i++) {
      const anchor = anchors[i]!;
      const dist = (target.x - anchor.point.x) ** 2 + (target.y - anchor.point.y) ** 2;
      if (dist < minDist) {
        minDist = dist;
        closest = anchor;
      }
    }

    return closest.point;
  }

  /**
   * Get all anchors on the outline
   */
  getAnchors(): { id: AnchorId; point: Point }[] {
    return this.getAnchorsOnOutline();
  }

  /**
   * Get all anchor points on the outline
   */
  getAnchorPoints(): Point[] {
    return this.getAnchorsOnOutline().map((anchor) => anchor.point);
  }

  /**
   * Get anchor IDs for sides that have ports
   */
  getPortAnchorIds(): string[] {
    const portSides = new Set<string>();
    for (const port of this._ports) {
      if (typeof port.position === 'string') {
        portSides.add(port.position);
      }
    }
    const anchors = this.getAnchorsOnOutline();
    return anchors
      .filter((anchor) => {
        const side = anchor.id.split(':')[0];
        return side && portSides.has(side);
      })
      .map((anchor) => anchor.id);
  }

  /**
   * Get nearest anchor that belongs to a port side
   */
  getNearestPortAnchor(target: Point): { id: AnchorId; point: Point } | null {
    const portAnchorIds = this.getPortAnchorIds();
    if (portAnchorIds.length === 0) {
      return null;
    }
    const anchors = this.getAnchorsOnOutline().filter((anchor) =>
      portAnchorIds.includes(anchor.id)
    );
    if (anchors.length === 0) {
      return null;
    }

    let closest = anchors[0]!;
    let minDist = (target.x - closest.point.x) ** 2 + (target.y - closest.point.y) ** 2;

    for (let i = 1; i < anchors.length; i++) {
      const anchor = anchors[i]!;
      const dist = (target.x - anchor.point.x) ** 2 + (target.y - anchor.point.y) ** 2;
      if (dist < minDist) {
        minDist = dist;
        closest = anchor;
      }
    }

    return closest;
  }

  /**
   * Get nearest anchor to a target point
   */
  getNearestAnchor(target: Point): { id: AnchorId; point: Point } | null {
    const anchors = this.getAnchorsOnOutline();
    if (anchors.length === 0) {
      return null;
    }

    let closest = anchors[0]!;
    let minDist = (target.x - closest.point.x) ** 2 + (target.y - closest.point.y) ** 2;

    for (let i = 1; i < anchors.length; i++) {
      const anchor = anchors[i]!;
      const dist = (target.x - anchor.point.x) ** 2 + (target.y - anchor.point.y) ** 2;
      if (dist < minDist) {
        minDist = dist;
        closest = anchor;
      }
    }

    return closest;
  }

  /**
   * Get anchor point by id
   */
  getAnchorPointById(anchorId: string): Point | null {
    if (!isValidAnchorId(anchorId)) {
      return null;
    }
    const anchors = this.getAnchorsOnOutline();
    const match = anchors.find((anchor) => anchor.id === anchorId);
    return match?.point ?? null;
  }

  /**
   * Get shape-specific bounds (can be overridden for non-rectangular shapes)
   */
  override getBounds(): Bounds {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    };
  }

  /**
   * Get the type name of this node
   */
  abstract get typeName(): string;

  /**
   * Get point on outline at normalized param (0-1 along perimeter).
   * Base implementation uses rectangular outline. Override for non-rectangular shapes.
   */
  getConnectionPointAtOutlineParam(param: number): Point {
    const bounds = this.getBounds();
    const { x, y, width: w, height: h } = bounds;
    const perimeter = 2 * (w + h);
    let s = (((param % 1) + 1) % 1) * perimeter;

    if (s < w) return { x: x + s, y };
    s -= w;
    if (s < h) return { x: x + w, y: y + s };
    s -= h;
    if (s < w) return { x: x + w - s, y: y + h };
    s -= w;
    return { x, y: y + h - s };
  }

  /**
   * Get closest point on outline and its param (0-1).
   * Base implementation uses rectangular outline. Override for non-rectangular shapes.
   */
  getClosestPointOnOutline(target: Point): { point: Point; param: number } {
    const bounds = this.getBounds();
    const { x, y, width: w, height: h } = bounds;
    const P = 2 * (w + h);

    const projectSegment = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      segLen: number,
      segStartParam: number
    ): { point: Point; param: number; distSq: number } => {
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((target.x - ax) * dx + (target.y - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const distSq = (target.x - px) ** 2 + (target.y - py) ** 2;
      const param = segStartParam + (t * segLen) / P;
      return { point: { x: px, y: py }, param, distSq };
    };

    let best = projectSegment(x, y, x + w, y, w, 0);
    let r = projectSegment(x + w, y, x + w, y + h, h, w / P);
    if (r.distSq < best.distSq) best = r;
    r = projectSegment(x + w, y + h, x, y + h, w, (w + h) / P);
    if (r.distSq < best.distSq) best = r;
    r = projectSegment(x, y + h, x, y, h, (2 * w + h) / P);
    if (r.distSq < best.distSq) best = r;

    return { point: best.point, param: best.param };
  }

  /**
   * Get intersection point on the shape outline toward the target.
   * Override for non-rectangular shapes.
   */
  protected getOutlinePointToward(target: Point): Point {
    const bounds = this.getBounds();
    const center = this.getCenter();
    const dx = target.x - center.x;
    const dy = target.y - center.y;

    if (dx === 0 && dy === 0) {
      return center;
    }

    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;

    const scaleX = halfW / Math.abs(dx);
    const scaleY = halfH / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);

    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    };
  }

  private getResizeHandlePositions(
    offset = RESIZE_HANDLE_OFFSET
  ): { type: ResizeHandle; x: number; y: number }[] {
    const { x, y, width, height } = this.getBounds();

    return [
      { type: 'nw', x: x - offset, y: y - offset },
      { type: 'ne', x: x + width + offset, y: y - offset },
      { type: 'se', x: x + width + offset, y: y + height + offset },
      { type: 'sw', x: x - offset, y: y + height + offset },
    ];
  }

  private ensureContentsFit(labelSize?: Size, iconBoxSize?: Size): void {
    const bounds = this.getBounds();
    const minSize = this.calculateContentMinSize(labelSize, iconBoxSize, bounds);

    if (minSize.width > bounds.width) {
      this.width = minSize.width;
    }
    if (minSize.height > bounds.height) {
      this.height = minSize.height;
    }
  }

  private calculateContentMinSize(
    labelSize: Size | undefined,
    iconBoxSize: Size | undefined,
    bounds: Bounds
  ): Size {
    const labelContainer = this.getLabelContainerBounds(bounds);
    const widthFactor =
      labelContainer.width > 0 ? bounds.width / labelContainer.width : 1;
    const heightFactor =
      labelContainer.height > 0 ? bounds.height / labelContainer.height : 1;

    const minContentWidth = Math.max(
      labelSize?.width ?? 0,
      iconBoxSize?.width ?? 0
    );
    const minContentHeight = Math.max(
      labelSize?.height ?? 0,
      iconBoxSize?.height ?? 0
    );

    return {
      width: minContentWidth * widthFactor,
      height: minContentHeight * heightFactor,
    };
  }

  protected getLabelContainerBounds(bounds: Bounds): Bounds {
    const { top, right, bottom, left } = this._contentInset;
    const x = bounds.x + left;
    const y = bounds.y + top;
    const width = Math.max(0, bounds.width - left - right);
    const height = Math.max(0, bounds.height - top - bottom);
    return { x, y, width, height };
  }

  private normalizeContentInset(
    value?: number | ContentInsetSides
  ): Required<ContentInsetSides> {
    const n = (v: number | undefined): number =>
      v !== undefined && Number.isFinite(v) ? Math.max(0, v) : 0;
    if (value === undefined) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    if (typeof value === 'number') {
      const v = n(value);
      return { top: v, right: v, bottom: v, left: v };
    }
    return {
      top: n(value.top),
      right: n(value.right),
      bottom: n(value.bottom),
      left: n(value.left),
    };
  }

  private getIconBoxSize(): Size | undefined {
    if (!this._icon) {
      return undefined;
    }

    const { width, height } = this._icon.getSize();
    if (width <= 0 || height <= 0) {
      return undefined;
    }

    return getIconBoxSize({ width, height }, this._icon.inset);
  }

  private getIconBounds(bounds: Bounds, iconBoxSize: Size, placement: NodeImagePlacement): Bounds {
    const ins = this._icon?.inset ?? 0;
    return getIconBounds(bounds, iconBoxSize, placement, ins);
  }

  private normalizeAnchorPoints(config?: AnchorPointsConfig): Required<AnchorPointsConfig> {
    const normalize = (value: number | undefined): number => {
      if (value === undefined) return 1;
      if (!Number.isFinite(value)) return 1;
      return Math.max(0, Math.floor(value));
    };

    return {
      top: normalize(config?.top),
      right: normalize(config?.right),
      bottom: normalize(config?.bottom),
      left: normalize(config?.left),
    };
  }

  private getAnchorsOnOutline(): { id: AnchorId; point: Point }[] {
    if (this._anchorCache !== null) {
      return this._anchorCache;
    }

    const { top, right, bottom, left } = this._anchorPoints;
    const bounds = this.getBounds();
    const anchors: { id: AnchorId; point: Point }[] = [];

    const addPoints = (
      side: 'top' | 'right' | 'bottom' | 'left',
      count: number,
      cb: (t: number) => Point
    ): void => {
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const id: AnchorId = `${side}:${i}`;
        anchors.push({ id, point: cb(t) });
      }
    };

    addPoints('top', top, (t) => ({ x: bounds.x + bounds.width * t, y: bounds.y }));
    addPoints('bottom', bottom, (t) => ({
      x: bounds.x + bounds.width * t,
      y: bounds.y + bounds.height,
    }));
    addPoints('left', left, (t) => ({ x: bounds.x, y: bounds.y + bounds.height * t }));
    addPoints('right', right, (t) => ({
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height * t,
    }));

    if (anchors.length === 0) {
      this._anchorCache = [];
      return [];
    }

    const result = anchors.map((anchor) => ({
      id: anchor.id,
      point: this.getOutlinePointToward(anchor.point),
    }));
    this._anchorCache = result;
    return result;
  }
}
