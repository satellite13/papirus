import { Element, generateId } from './Element';
import { Port, type PortOptions } from './Port';
import { TextLabel, type TextLabelOptions } from './TextLabel';
import {
  NodeImage,
  type NodeImageOptions,
  type NodeImagePlacement,
  isCornerPlacement,
} from './NodeImage';
import type { StyleManager } from '@/styles/StyleManager';
import type { Bounds, LabelPlacement, NodeStyle, Point, Size } from '@/types';
export type { LabelPlacement } from '../types';
import { shallowEqual } from '@/utils/style';
import {
  DEFAULT_SELECTION_COLOR,
  NODE_HITBOX_PADDING,
  RESIZE_HANDLE_OFFSET,
  RESIZE_HANDLE_SIZE,
} from '@/constants';

export interface NodeOptions {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: NodeStyle;
  styleClass?: string;
  label?: string | TextLabelOptions;
  labelPlacement?: LabelPlacement;
  icon?: NodeImageOptions;
  ports?: PortOptions[];
  showPortsAlways?: boolean;
  anchorPoints?: AnchorPointsConfig;
  resizeHandlesEnabled?: boolean;
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
  protected _nodeStyle: NodeStyle;
  protected _showPortsAlways: boolean;
  protected _anchorPoints: Required<AnchorPointsConfig>;
  protected _defaultSize: Size;
  protected _labelPlacement: LabelPlacement;
  protected _resizeHandlesEnabled: boolean;
  private _attachToOutlineGetter?: () => boolean;
  private _anchorCache: { id: AnchorId; point: Point }[] | null = null;

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
    this._labelPlacement = options.labelPlacement ?? 'auto';
    this._resizeHandlesEnabled = options.resizeHandlesEnabled ?? true;

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
   * Label placement inside the node
   */
  get labelPlacement(): LabelPlacement {
    return this._labelPlacement;
  }

  set labelPlacement(value: LabelPlacement) {
    if (this._labelPlacement !== value) {
      this._labelPlacement = value;
      this.markDirty();
    }
  }

  /**
   * Default size (initial width/height)
   */
  get defaultSize(): Size {
    return { ...this._defaultSize };
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
   * Calculate layout for icon and label
   * Returns computed bounds for both elements
   */
  protected calculateContentLayout(
    bounds: Bounds,
    iconBoxSize?: Size,
    labelSize?: Size
  ): { iconBounds: Bounds; labelBounds: Bounds } {
    let iconBounds = bounds;
    let labelBounds = this.getLabelContainerBounds(bounds);

    if (this._icon && iconBoxSize) {
      iconBounds = this.getIconBounds(bounds, iconBoxSize, this._icon.placement);
    }

    if (
      this._icon &&
      this._label &&
      iconBoxSize &&
      labelSize &&
      this._labelPlacement === 'auto' &&
      this._icon.placement !== 'center'
    ) {
      const gap = this._icon.gap;
      const placement = this._icon.placement;

      if (isCornerPlacement(placement)) {
        const contentBounds = this.getLabelContainerBounds(bounds);
        iconBounds = this.getIconBounds(contentBounds, iconBoxSize, placement);
        // Reserve icon corner + gap so label does not overlap
        const w = iconBoxSize.width + gap;
        const h = iconBoxSize.height + gap;
        switch (placement) {
          case 'top-left':
            labelBounds = {
              x: contentBounds.x + w,
              y: contentBounds.y + h,
              width: Math.max(0, contentBounds.width - w),
              height: Math.max(0, contentBounds.height - h),
            };
            break;
          case 'top-right':
            labelBounds = {
              x: contentBounds.x,
              y: contentBounds.y + h,
              width: Math.max(0, contentBounds.width - w),
              height: Math.max(0, contentBounds.height - h),
            };
            break;
          case 'bottom-left':
            labelBounds = {
              x: contentBounds.x + w,
              y: contentBounds.y,
              width: Math.max(0, contentBounds.width - w),
              height: Math.max(0, contentBounds.height - h),
            };
            break;
          case 'bottom-right':
            labelBounds = {
              x: contentBounds.x,
              y: contentBounds.y,
              width: Math.max(0, contentBounds.width - w),
              height: Math.max(0, contentBounds.height - h),
            };
            break;
          default:
            labelBounds = contentBounds;
        }
      } else {
        const contentBounds = this.getLabelContainerBounds(bounds);
        // Use contentBounds for both icon and label so gap is consistent (space between icon box and label)
        switch (placement) {
          case 'top':
            iconBounds = {
              x: contentBounds.x,
              y: contentBounds.y,
              width: contentBounds.width,
              height: iconBoxSize.height,
            };
            labelBounds = {
              x: contentBounds.x,
              y: contentBounds.y + iconBoxSize.height + gap,
              width: contentBounds.width,
              height: Math.max(0, contentBounds.height - iconBoxSize.height - gap),
            };
            break;
          case 'bottom':
            iconBounds = {
              x: contentBounds.x,
              y: contentBounds.y + contentBounds.height - iconBoxSize.height,
              width: contentBounds.width,
              height: iconBoxSize.height,
            };
            labelBounds = {
              x: contentBounds.x,
              y: contentBounds.y,
              width: contentBounds.width,
              height: Math.max(0, contentBounds.height - iconBoxSize.height - gap),
            };
            break;
          case 'left':
            iconBounds = {
              x: contentBounds.x,
              y: contentBounds.y,
              width: iconBoxSize.width,
              height: contentBounds.height,
            };
            labelBounds = {
              x: contentBounds.x + iconBoxSize.width + gap,
              y: contentBounds.y,
              width: Math.max(0, contentBounds.width - iconBoxSize.width - gap),
              height: contentBounds.height,
            };
            break;
          case 'right':
            iconBounds = {
              x: contentBounds.x + contentBounds.width - iconBoxSize.width,
              y: contentBounds.y,
              width: iconBoxSize.width,
              height: contentBounds.height,
            };
            labelBounds = {
              x: contentBounds.x,
              y: contentBounds.y,
              width: Math.max(0, contentBounds.width - iconBoxSize.width - gap),
              height: contentBounds.height,
            };
            break;
        }
      }
    } else if (this._label && labelSize) {
      const autoBounds = this.getAutoLabelBounds(bounds, iconBoxSize);
      labelBounds = this.getLabelBounds(autoBounds, labelSize, this._labelPlacement);
    }

    return { iconBounds, labelBounds };
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
    const iconBoxSize = this._icon ? this.getIconBoxSize() : undefined;
    const autoBounds = this.getAutoLabelBounds(bounds, iconBoxSize);

    this._label.setAutoMaxWidth(autoBounds.width);
    const labelSize = this._label.measure(ctx);

    const { labelBounds } = this.calculateContentLayout(bounds, iconBoxSize, labelSize);

    const lines = this._label.getWrappedLines(ctx, Math.max(0, autoBounds.width));
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
   * Get world position of label center.
   */
  getLabelPosition(): Point {
    const bounds = this.getBounds();
    const placement = this._labelPlacement === 'auto' ? 'center' : this._labelPlacement;

    switch (placement) {
      case 'top':
        return { x: bounds.x + bounds.width / 2, y: bounds.y };
      case 'bottom':
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
      case 'left':
        return { x: bounds.x, y: bounds.y + bounds.height / 2 };
      case 'right':
        return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
      default:
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }
  }

  /**
   * Render icon, label, and ports
   */
  protected renderContents(ctx: CanvasRenderingContext2D): void {
    // Reset dash settings so icon/label/ports render solid
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    let bounds = this.getBounds();
    const iconBoxSize = this._icon ? this.getIconBoxSize() : undefined;

    if (this._label) {
      this._label.setAutoMaxWidth(this.getAutoLabelBounds(bounds, iconBoxSize).width);
    }
    const labelSize = this._label ? this._label.measure(ctx) : undefined;

    if (labelSize || iconBoxSize) {
      this.ensureContentsFit(labelSize, iconBoxSize);
      // Re-measure after potential resize
      if (this._label && iconBoxSize) {
        bounds = this.getBounds();
        this._label.setAutoMaxWidth(this.getAutoLabelBounds(bounds, iconBoxSize).width);
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
    let minWidth = 0;
    let minHeight = 0;

    const labelContainer = this.getLabelContainerBounds(bounds);
    const widthFactor = labelContainer.width > 0 ? bounds.width / labelContainer.width : 1;
    const heightFactor = labelContainer.height > 0 ? bounds.height / labelContainer.height : 1;

    if (labelSize) {
      minWidth = Math.max(minWidth, labelSize.width * widthFactor);
      minHeight = Math.max(minHeight, labelSize.height * heightFactor);
    }

    if (iconBoxSize) {
      minWidth = Math.max(minWidth, iconBoxSize.width);
      minHeight = Math.max(minHeight, iconBoxSize.height);
    }

    if (labelSize && iconBoxSize && this._icon) {
      const gap = this._icon.gap;
      const labelPlacement = this._labelPlacement === 'auto' ? 'center' : this._labelPlacement;
      const iconPlacement = this._icon.placement;

      if (this._labelPlacement === 'auto' && iconPlacement !== 'center') {
        if (isCornerPlacement(iconPlacement)) {
          // Label area is content minus (icon + gap) corner; ensure it fits label
          minWidth = Math.max(minWidth, iconBoxSize.width + gap + labelSize.width);
          minHeight = Math.max(minHeight, iconBoxSize.height + gap + labelSize.height);
        } else if (iconPlacement === 'top' || iconPlacement === 'bottom') {
          minHeight = Math.max(minHeight, iconBoxSize.height + gap + labelSize.height);
          minWidth = Math.max(minWidth, iconBoxSize.width, labelSize.width);
        } else if (iconPlacement === 'left' || iconPlacement === 'right') {
          minWidth = Math.max(minWidth, iconBoxSize.width + gap + labelSize.width);
          minHeight = Math.max(minHeight, iconBoxSize.height, labelSize.height);
        }
      } else {
        const labelHorizontal = labelPlacement === 'left' || labelPlacement === 'right';
        const labelVertical = labelPlacement === 'top' || labelPlacement === 'bottom';
        const iconHorizontal = iconPlacement === 'left' || iconPlacement === 'right';
        const iconVertical = iconPlacement === 'top' || iconPlacement === 'bottom';
        const labelSharesIconAxis =
          (iconHorizontal && (labelPlacement === 'center' || labelPlacement === iconPlacement)) ||
          (iconVertical && (labelPlacement === 'center' || labelPlacement === iconPlacement));

        if (labelHorizontal && iconHorizontal && labelPlacement !== iconPlacement) {
          minWidth = Math.max(minWidth, iconBoxSize.width + gap + labelSize.width);
        }
        if (labelVertical && iconVertical && labelPlacement !== iconPlacement) {
          minHeight = Math.max(minHeight, iconBoxSize.height + gap + labelSize.height);
        }
        if (labelSharesIconAxis) {
          if (iconHorizontal) {
            minWidth = Math.max(minWidth, iconBoxSize.width + gap + labelSize.width);
          }
          if (iconVertical) {
            minHeight = Math.max(minHeight, iconBoxSize.height + gap + labelSize.height);
          }
        }
      }
    }

    return { width: minWidth, height: minHeight };
  }

  protected getLabelContainerBounds(bounds: Bounds): Bounds {
    return bounds;
  }

  private getAutoLabelBounds(bounds: Bounds, iconBoxSize?: Size): Bounds {
    const contentBounds = this.getLabelContainerBounds(bounds);
    if (!this._icon || !iconBoxSize || this._icon.placement === 'center') {
      return contentBounds;
    }

    const gap = this._icon.gap;
    if (isCornerPlacement(this._icon.placement)) {
      const w = iconBoxSize.width + gap;
      const h = iconBoxSize.height + gap;
      switch (this._icon.placement) {
        case 'top-left':
          return {
            x: contentBounds.x + w,
            y: contentBounds.y + h,
            width: Math.max(0, contentBounds.width - w),
            height: Math.max(0, contentBounds.height - h),
          };
        case 'top-right':
          return {
            x: contentBounds.x,
            y: contentBounds.y + h,
            width: Math.max(0, contentBounds.width - w),
            height: Math.max(0, contentBounds.height - h),
          };
        case 'bottom-left':
          return {
            x: contentBounds.x + w,
            y: contentBounds.y,
            width: Math.max(0, contentBounds.width - w),
            height: Math.max(0, contentBounds.height - h),
          };
        case 'bottom-right':
          return {
            x: contentBounds.x,
            y: contentBounds.y,
            width: Math.max(0, contentBounds.width - w),
            height: Math.max(0, contentBounds.height - h),
          };
        default:
          return contentBounds;
      }
    }

    switch (this._icon.placement) {
      case 'left':
        return {
          x: contentBounds.x + iconBoxSize.width + gap,
          y: contentBounds.y,
          width: Math.max(0, contentBounds.width - iconBoxSize.width - gap),
          height: contentBounds.height,
        };
      case 'right':
        return {
          x: contentBounds.x,
          y: contentBounds.y,
          width: Math.max(0, contentBounds.width - iconBoxSize.width - gap),
          height: contentBounds.height,
        };
      case 'top':
        return {
          x: contentBounds.x,
          y: contentBounds.y + iconBoxSize.height + gap,
          width: contentBounds.width,
          height: Math.max(0, contentBounds.height - iconBoxSize.height - gap),
        };
      case 'bottom':
        return {
          x: contentBounds.x,
          y: contentBounds.y,
          width: contentBounds.width,
          height: Math.max(0, contentBounds.height - iconBoxSize.height - gap),
        };
      default:
        return contentBounds;
    }
  }

  private getLabelBounds(bounds: Bounds, labelSize: Size, placement: LabelPlacement): Bounds {
    const normalizedPlacement = placement === 'auto' ? 'center' : placement;
    const width = Math.min(labelSize.width, bounds.width);
    const height = Math.min(labelSize.height, bounds.height);

    let x = bounds.x + (bounds.width - width) / 2;
    let y = bounds.y + (bounds.height - height) / 2;

    switch (normalizedPlacement) {
      case 'top':
        y = bounds.y;
        break;
      case 'bottom':
        y = bounds.y + bounds.height - height;
        break;
      case 'left':
        x = bounds.x;
        break;
      case 'right':
        x = bounds.x + bounds.width - width;
        break;
      default:
        break;
    }

    return { x, y, width, height };
  }

  private getIconBoxSize(): Size | undefined {
    if (!this._icon) {
      return undefined;
    }

    const { width, height } = this._icon.getSize();
    if (width <= 0 || height <= 0) {
      return undefined;
    }

    const padding = this._icon.options.padding ?? 8;
    const margin = Math.max(0, this._icon.options.margin ?? 0);
    return {
      width: width + padding * 2 + margin * 2,
      height: height + padding * 2 + margin * 2,
    };
  }

  private getIconBounds(bounds: Bounds, iconBoxSize: Size, placement: NodeImagePlacement): Bounds {
    switch (placement) {
      case 'top':
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: iconBoxSize.height,
        };
      case 'bottom':
        return {
          x: bounds.x,
          y: bounds.y + bounds.height - iconBoxSize.height,
          width: bounds.width,
          height: iconBoxSize.height,
        };
      case 'left':
        return {
          x: bounds.x,
          y: bounds.y,
          width: iconBoxSize.width,
          height: bounds.height,
        };
      case 'right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width,
          y: bounds.y,
          width: iconBoxSize.width,
          height: bounds.height,
        };
      case 'top-left':
        return {
          x: bounds.x,
          y: bounds.y,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'top-right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width,
          y: bounds.y,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'bottom-left':
        return {
          x: bounds.x,
          y: bounds.y + bounds.height - iconBoxSize.height,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      case 'bottom-right':
        return {
          x: bounds.x + bounds.width - iconBoxSize.width,
          y: bounds.y + bounds.height - iconBoxSize.height,
          width: iconBoxSize.width,
          height: iconBoxSize.height,
        };
      default:
        return bounds;
    }
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
