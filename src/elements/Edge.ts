import { Element, generateId } from './Element';
import { TextLabel, type TextLabelOptions } from './TextLabel';
import type {
  ArrowType,
  ArrowMarkerConfig,
  EdgeEndpoint,
  EdgePathType,
  EdgeStyle,
  EdgeLabelBackground,
  Point,
} from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import { shallowEqual } from '@/utils/style';
import { bezierPoint, drawRoundedRectPath } from '@/utils/geometry';
import {
  type PathStrategy,
  type PathStrategyOptions,
  StraightPathStrategy,
  PolylinePathStrategy,
  BezierPathStrategy,
} from './paths';
import {
  EDGE_HANDLE_RADIUS,
  ARROW_SIZE,
  ARROW_ANGLE,
  MARKER_SIZES,
  EDGE_LABEL_BACKGROUND_PADDING,
  EDGE_LABEL_BACKGROUND_RADIUS,
  DEFAULT_SELECTION_COLOR,
  DEFAULT_HOVER_COLOR,
} from '@/constants';

export interface EdgeOptions {
  id?: string;
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  type?: EdgePathType;
  controlPoints?: Point[];
  arrowType?: ArrowType;
  startMarker?: ArrowMarkerConfig;
  endMarker?: ArrowMarkerConfig;
  style?: EdgeStyle;
  styleClass?: string;
  label?: string | TextLabelOptions;
  labelOffset?: number;
  labelBackground?: EdgeLabelBackground;
  lockAnchors?: boolean;
}

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  strokeColor: '#666666',
  strokeWidth: 2,
  opacity: 1,
};

export type { PathStrategy };

/**
 * Connection edge between nodes
 */
export class Edge extends Element {
  private _from: EdgeEndpoint;
  private _to: EdgeEndpoint;
  private _type: EdgePathType;
  private _arrowType: ArrowType;
  private _startMarker?: ArrowMarkerConfig;
  private _endMarker?: ArrowMarkerConfig;
  private _edgeStyle: EdgeStyle;
  private _label?: TextLabel;
  private _labelOffset: number;
  private _labelBackground?: EdgeLabelBackground;
  private _path: Point[] = [];
  private _pathStrategy: PathStrategy;
  private _autoUpdateEndpoints = true;
  private _lockAnchors: boolean;
  private _controlPoints?: Point[];
  private _pathOptions?: PathStrategyOptions;

  // Cached positions for rendering
  private _fromPoint: Point = { x: 0, y: 0 };
  private _toPoint: Point = { x: 0, y: 0 };
  private _fromDir?: string;
  private _toDir?: string;

  constructor(options: EdgeOptions) {
    super({
      id: options.id ?? generateId('edge'),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      style: options.style,
      styleClass: options.styleClass,
    });

    this._from = options.from;
    this._to = options.to;
    this._type = options.type ?? 'straight';
    this._arrowType = options.arrowType ?? 'single';
    this._controlPoints = options.controlPoints;
    this._startMarker = options.startMarker;
    this._endMarker = options.endMarker;
    this._edgeStyle = { ...DEFAULT_EDGE_STYLE, ...options.style };
    this._pathStrategy = this.getPathStrategy(this._type);
    this._lockAnchors = options.lockAnchors ?? true;
    this._labelOffset = options.labelOffset ?? 0;
    this._labelBackground = options.labelBackground;

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
  }

  /**
   * Source endpoint
   */
  get from(): EdgeEndpoint {
    return this._from;
  }

  set from(value: EdgeEndpoint) {
    this._from = value;
    this.markDirty();
  }

  /**
   * Target endpoint
   */
  get to(): EdgeEndpoint {
    return this._to;
  }

  set to(value: EdgeEndpoint) {
    this._to = value;
    this.markDirty();
  }

  /**
   * Edge type
   */
  get type(): EdgePathType {
    return this._type;
  }

  set type(value: EdgePathType) {
    if (this._type !== value) {
      this._type = value;
      this._pathStrategy = this.getPathStrategy(value);
      this.markDirty();
    }
  }

  /**
   * Arrow type (legacy)
   */
  get arrowType(): ArrowType {
    return this._arrowType;
  }

  set arrowType(value: ArrowType) {
    if (this._arrowType !== value) {
      this._arrowType = value;
      this.markDirty();
    }
  }

  /**
   * Start marker configuration
   */
  get startMarker(): ArrowMarkerConfig | undefined {
    return this._startMarker;
  }

  set startMarker(value: ArrowMarkerConfig | undefined) {
    this._startMarker = value;
    this.markDirty();
  }

  /**
   * End marker configuration
   */
  get endMarker(): ArrowMarkerConfig | undefined {
    return this._endMarker;
  }

  set endMarker(value: ArrowMarkerConfig | undefined) {
    this._endMarker = value;
    this.markDirty();
  }

  /**
   * Label offset from center of path
   */
  get labelOffset(): number {
    return this._labelOffset;
  }

  set labelOffset(value: number) {
    if (this._labelOffset !== value) {
      this._labelOffset = value;
      this.markDirty();
    }
  }

  /**
   * Label background configuration
   */
  get labelBackground(): EdgeLabelBackground | undefined {
    return this._labelBackground;
  }

  set labelBackground(value: EdgeLabelBackground | undefined) {
    this._labelBackground = value;
    this.markDirty();
  }

  /**
   * Control points for custom paths.
   * For bezier format: [cp1, cp2, end, cp1, cp2, end, ...]
   * For editable-polyline: [point1, point2, ...]
   */
  get controlPoints(): Point[] | undefined {
    return this._controlPoints;
  }

  set controlPoints(value: Point[] | undefined) {
    this._controlPoints = value;
    this.recalculatePath();
  }

  /**
   * Whether this edge uses editable polyline controls.
   */
  isEditablePolyline(): boolean {
    return this._type === 'editable-polyline';
  }

  /**
   * Whether this edge has editable control points (editable-polyline with non-empty controlPoints).
   */
  hasEditableControlPoints(): boolean {
    return this.isEditablePolyline() && !!this._controlPoints?.length;
  }

  /**
   * Returns path vertices for editable polyline: [startPoint, ...controlPoints, endPoint].
   * Requires endpoints to be updated (startPoint/endPoint valid).
   */
  getPathVertices(): Point[] {
    const cps = this._controlPoints && this._controlPoints.length > 0
      ? this._controlPoints
      : this.getEditableControlPoints();
    return [this._fromPoint, ...cps, this._toPoint];
  }

  /**
   * Returns current editable control points.
   * For a fresh editable-polyline edge, exposes a virtual midpoint handle.
   */
  getEditableControlPoints(): Point[] {
    if (!this.isEditablePolyline()) {
      return [];
    }
    if (this._controlPoints && this._controlPoints.length > 0) {
      return this._controlPoints.map((point) => ({ ...point }));
    }
    return [
      {
        x: (this._fromPoint.x + this._toPoint.x) / 2,
        y: (this._fromPoint.y + this._toPoint.y) / 2,
      },
    ];
  }

  /**
   * Edge style
   */
  override get style(): EdgeStyle {
    return this._edgeStyle;
  }

  override set style(value: EdgeStyle) {
    this._edgeStyle = { ...DEFAULT_EDGE_STYLE, ...value };
    this._style = value;
    this.markDirty();
  }

  applyStyleManager(styleManager: StyleManager): void {
    const baseStyle = styleManager.getEdgeStyle(this._state, this._styleClass);
    let mergedStyle: EdgeStyle = { ...baseStyle, ...this._style };

    if (this._state !== 'normal') {
      const normalStyle = styleManager.getEdgeStyle('normal', this._styleClass);
      if (
        mergedStyle.strokeColor === baseStyle.strokeColor &&
        normalStyle.strokeColor !== undefined
      ) {
        mergedStyle = { ...mergedStyle, strokeColor: normalStyle.strokeColor };
      }
    }

    if (!shallowEqual(this._edgeStyle, mergedStyle)) {
      this._edgeStyle = mergedStyle;
      this.markDirty();
    }

    if (this._label) {
      this._label.applyStyleManager(styleManager);
    }
  }

  /**
   * Edge label
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
   * Current path points
   */
  get path(): readonly Point[] {
    return this._path;
  }

  /**
   * Auto-update endpoints from connected nodes
   */
  get autoUpdateEndpoints(): boolean {
    return this._autoUpdateEndpoints;
  }

  set autoUpdateEndpoints(value: boolean) {
    this._autoUpdateEndpoints = value;
  }

  /**
   * Whether to lock edge endpoints to anchor points
   */
  get lockAnchors(): boolean {
    return this._lockAnchors;
  }

  set lockAnchors(value: boolean) {
    this._lockAnchors = value;
  }

  /**
   * Get start point position (for handle rendering)
   */
  get startPoint(): Point {
    return this._fromPoint;
  }

  /**
   * Get end point position (for handle rendering)
   */
  get endPoint(): Point {
    return this._toPoint;
  }

  /**
   * Check if a point hits the start handle
   */
  hitTestStartHandle(point: Point, handleRadius = 8): boolean {
    const dx = point.x - this._fromPoint.x;
    const dy = point.y - this._fromPoint.y;
    return dx * dx + dy * dy <= handleRadius * handleRadius;
  }

  /**
   * Check if a point hits the end handle
   */
  hitTestEndHandle(point: Point, handleRadius = 8): boolean {
    const dx = point.x - this._toPoint.x;
    const dy = point.y - this._toPoint.y;
    return dx * dx + dy * dy <= handleRadius * handleRadius;
  }

  /**
   * Update edge endpoints from node positions
   * Called by DiagramRenderer when nodes move
   * @param fromPoint Start point
   * @param toPoint End point
   * @param fromDir Direction at start point (top, right, bottom, left)
   * @param toDir Direction at end point (top, right, bottom, left)
   */
  updateEndpoints(
    fromPoint: Point,
    toPoint: Point,
    fromDir?: string,
    toDir?: string,
    options?: PathStrategyOptions
  ): void {
    this._fromPoint = fromPoint;
    this._toPoint = toPoint;
    this._fromDir = fromDir;
    this._toDir = toDir;
    this._pathOptions = options;
    this.recalculatePath();
  }

  /**
   * Recalculate the path between endpoints
   */
  recalculatePath(): void {
    this._path = this._pathStrategy.calculatePath(
      this._fromPoint,
      this._toPoint,
      this._fromDir,
      this._toDir,
      {
        ...this._pathOptions,
        controlPoints: this._controlPoints,
        editablePolyline: this.isEditablePolyline(),
        selfLoop: this._from.nodeId === this._to.nodeId,
      }
    );
    this.updateBounds();
    this.markDirty();
  }

  private updateBounds(): void {
    if (this._path.length === 0) {
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of this._path) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    this._x = minX;
    this._y = minY;
    this._width = maxX - minX;
    this._height = maxY - minY;
  }

  hitTest(point: Point): boolean {
    const tolerance = Math.max((this._edgeStyle.strokeWidth ?? 2) * 2, 8);
    return this._pathStrategy.hitTest(point, this._path, tolerance);
  }

  /**
   * Hit test with explicit tolerance (world units)
   */
  hitTestWithTolerance(point: Point, tolerance: number): boolean {
    return this._pathStrategy.hitTest(point, this._path, tolerance);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._path.length < 2) {
      return;
    }

    if (this._state === 'selected' || this._state === 'hover') {
      this.renderHighlight(ctx);
    }

    this.applyStyle(ctx);
    this.renderPath(ctx);
    this.renderArrows(ctx);
    this.renderLabel(ctx);
    // Note: handles are rendered separately via renderHandles() to appear on top of nodes
  }

  /**
   * Render drag handles when selected
   * Called separately after nodes to ensure handles appear on top
   */
  renderHandles(ctx: CanvasRenderingContext2D): void {
    if (this._state !== 'selected') {
      return;
    }

    this.renderHandle(ctx, this._fromPoint);
    this.renderHandle(ctx, this._toPoint);
  }

  private renderHandle(ctx: CanvasRenderingContext2D, point: Point): void {
    ctx.beginPath();
    ctx.arc(point.x, point.y, EDGE_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = DEFAULT_SELECTION_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private applyStyle(ctx: CanvasRenderingContext2D): void {
    const style = this._edgeStyle;

    ctx.strokeStyle = style.strokeColor ?? '#666666';
    ctx.lineWidth = style.strokeWidth ?? 2;
    const baseOpacity = style.opacity ?? 1;
    const strokeOpacity = style.strokeOpacity ?? 1;
    ctx.globalAlpha = baseOpacity * strokeOpacity;

    this.applyLineDash(ctx, style);

    if (style.lineCap !== undefined) {
      ctx.lineCap = style.lineCap;
    }

    if (style.lineJoin !== undefined) {
      ctx.lineJoin = style.lineJoin;
    }
  }

  private renderHighlight(ctx: CanvasRenderingContext2D): void {
    const style = this._edgeStyle;
    ctx.save();
    ctx.strokeStyle = this._state === 'selected' ? DEFAULT_SELECTION_COLOR : DEFAULT_HOVER_COLOR;
    ctx.lineWidth = (style.strokeWidth ?? 2) + (this._state === 'selected' ? 1 : 0);
    ctx.globalAlpha = 1;

    this.applyLineDash(ctx, style);

    if (style.lineCap !== undefined) {
      ctx.lineCap = style.lineCap;
    }

    if (style.lineJoin !== undefined) {
      ctx.lineJoin = style.lineJoin;
    }

    this.renderPath(ctx);
    ctx.restore();
  }

  private renderPath(ctx: CanvasRenderingContext2D): void {
    const path = this._path;
    if (path.length < 2) return;

    // Calculate how much to shorten the line at each end for markers
    const startOffset =
      this._startMarker && this._startMarker.type !== 'none'
        ? this.getMarkerLength(this._startMarker)
        : 0;
    const endOffset =
      this._endMarker && this._endMarker.type !== 'none'
        ? this.getMarkerLength(this._endMarker)
        : 0;

    // Get shortened start point
    const start = path[0]!;
    const startNext = path[1]!;
    const startAngle = Math.atan2(startNext.y - start.y, startNext.x - start.x);
    const shortenedStart = {
      x: start.x + startOffset * Math.cos(startAngle),
      y: start.y + startOffset * Math.sin(startAngle),
    };

    // Get shortened end point
    const end = path[path.length - 1]!;
    const endPrev = path[path.length - 2]!;
    const endAngle = Math.atan2(end.y - endPrev.y, end.x - endPrev.x);
    const shortenedEnd = {
      x: end.x - endOffset * Math.cos(endAngle),
      y: end.y - endOffset * Math.sin(endAngle),
    };

    ctx.beginPath();
    ctx.moveTo(shortenedStart.x, shortenedStart.y);

    if (this._type === 'bezier' && path.length >= 4) {
      for (let i = 1; i + 2 < path.length; i += 3) {
        const cp1 = path[i]!;
        const cp2 = path[i + 1]!;
        const end = i + 2 === path.length - 1 ? shortenedEnd : path[i + 2]!;
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
      }
    } else {
      for (let i = 1; i < path.length - 1; i++) {
        ctx.lineTo(path[i]!.x, path[i]!.y);
      }
      ctx.lineTo(shortenedEnd.x, shortenedEnd.y);
    }

    ctx.stroke();
  }

  private renderArrows(ctx: CanvasRenderingContext2D): void {
    const path = this._path;
    if (path.length < 2) {
      return;
    }

    // Use new marker system if configured, otherwise fall back to legacy arrowType
    const hasNewMarkers = this._startMarker !== undefined || this._endMarker !== undefined;

    if (hasNewMarkers) {
      // End marker
      if (this._endMarker && this._endMarker.type !== 'none') {
        const points = this.getMarkerPoints('end');
        if (points) {
          this.drawMarker(ctx, points.from, points.to, this._endMarker);
        }
      }

      // Start marker
      if (this._startMarker && this._startMarker.type !== 'none') {
        const points = this.getMarkerPoints('start');
        if (points) {
          this.drawMarker(ctx, points.from, points.to, this._startMarker);
        }
      }
    } else {
      // Legacy arrow type support
      if (this._arrowType === 'none') {
        return;
      }

      // Target arrow
      const endPoints = this.getMarkerPoints('end');
      if (endPoints) {
        this.drawArrowHead(ctx, endPoints.from, endPoints.to);
      }

      // Source arrow (for double)
      if (this._arrowType === 'double') {
        const startPoints = this.getMarkerPoints('start');
        if (startPoints) {
          this.drawArrowHead(ctx, startPoints.from, startPoints.to);
        }
      }
    }
  }

  private getMarkerPoints(position: 'start' | 'end'): { from: Point; to: Point } | null {
    const path = this._path;
    if (path.length < 2) {
      return null;
    }

    if (this._type === 'bezier' && path.length >= 4) {
      const start = path[0]!;
      const cp1 = path[1]!;
      const cp2 = path[2]!;
      const end = path[3]!;
      const epsilon = 0.001;

      const isSame = (a: Point, b: Point): boolean =>
        Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;

      if (position === 'end') {
        const endIndex = path.length - 1;
        const endPoint = path[endIndex]!;
        let from = path[endIndex - 1] ?? cp2;
        if (isSame(from, endPoint)) {
          from = path[endIndex - 2] ?? cp1;
          if (isSame(from, endPoint)) {
            from = start;
          }
        }
        return { from, to: endPoint };
      }

      let next = cp1;
      if (isSame(next, start)) {
        next = cp2;
        if (isSame(next, start)) {
          next = end;
        }
      }
      return { from: next, to: start };
    }

    if (position === 'end') {
      return { from: path[path.length - 2]!, to: path[path.length - 1]! };
    }

    return { from: path[1]!, to: path[0]! };
  }

  /**
   * Get the length of a marker (how much to shorten the line)
   */
  private getMarkerLength(config: ArrowMarkerConfig): number {
    const size = config.size ?? MARKER_SIZES[config.type] ?? ARROW_SIZE;
    switch (config.type) {
      case 'arrow':
        // Arrow length is size * cos(ARROW_ANGLE) for the back of the triangle
        return size * Math.cos(ARROW_ANGLE);
      case 'open':
        // Do not shorten line for open arrow
        return 0;
      case 'diamond':
        return size; // Diamond length is full size
      case 'circle':
        return size * 2; // Circle diameter
      default:
        return 0;
    }
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    config: ArrowMarkerConfig
  ): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = config.size ?? MARKER_SIZES[config.type] ?? ARROW_SIZE;
    const strokeColor = config.strokeColor ?? (ctx.strokeStyle as string);
    const fillColor = config.fillColor ?? strokeColor;
    const fillOpacity = config.fillOpacity ?? 1;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = strokeColor;

    switch (config.type) {
      case 'arrow':
        this.drawArrowMarker(ctx, to, angle, size, fillColor, fillOpacity);
        break;
      case 'open':
        this.drawOpenArrowMarker(ctx, to, angle, size);
        break;
      case 'diamond':
        this.drawDiamondMarker(ctx, to, angle, size, fillColor, fillOpacity);
        break;
      case 'circle':
        this.drawCircleMarker(ctx, to, angle, size, fillColor, fillOpacity);
        break;
    }

    ctx.restore();
  }

  private drawArrowMarker(
    ctx: CanvasRenderingContext2D,
    to: Point,
    angle: number,
    size: number,
    fillColor: string,
    fillOpacity: number
  ): void {
    const x1 = to.x - size * Math.cos(angle - ARROW_ANGLE);
    const y1 = to.y - size * Math.sin(angle - ARROW_ANGLE);
    const x2 = to.x - size * Math.cos(angle + ARROW_ANGLE);
    const y2 = to.y - size * Math.sin(angle + ARROW_ANGLE);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  private drawOpenArrowMarker(
    ctx: CanvasRenderingContext2D,
    to: Point,
    angle: number,
    size: number
  ): void {
    const x1 = to.x - size * Math.cos(angle - ARROW_ANGLE);
    const y1 = to.y - size * Math.sin(angle - ARROW_ANGLE);
    const x2 = to.x - size * Math.cos(angle + ARROW_ANGLE);
    const y2 = to.y - size * Math.sin(angle + ARROW_ANGLE);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(x1, y1);
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawDiamondMarker(
    ctx: CanvasRenderingContext2D,
    to: Point,
    angle: number,
    size: number,
    fillColor: string,
    fillOpacity: number
  ): void {
    const halfLength = size / 2;
    const halfWidth = size * 0.3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Diamond points relative to the tip
    const points = [
      { x: to.x, y: to.y }, // tip
      {
        x: to.x - halfLength * cos + halfWidth * sin,
        y: to.y - halfLength * sin - halfWidth * cos,
      },
      { x: to.x - size * cos, y: to.y - size * sin }, // back
      {
        x: to.x - halfLength * cos - halfWidth * sin,
        y: to.y - halfLength * sin + halfWidth * cos,
      },
    ];

    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.closePath();

    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  private drawCircleMarker(
    ctx: CanvasRenderingContext2D,
    to: Point,
    angle: number,
    size: number,
    fillColor: string,
    fillOpacity: number
  ): void {
    // Offset circle center back along the path so it doesn't overlap node
    const cx = to.x - size * Math.cos(angle);
    const cy = to.y - size * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);

    ctx.globalAlpha = fillOpacity;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  private drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - ARROW_SIZE * Math.cos(angle - ARROW_ANGLE),
      to.y - ARROW_SIZE * Math.sin(angle - ARROW_ANGLE)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - ARROW_SIZE * Math.cos(angle + ARROW_ANGLE),
      to.y - ARROW_SIZE * Math.sin(angle + ARROW_ANGLE)
    );
    ctx.stroke();
    ctx.restore();
  }

  private renderLabel(ctx: CanvasRenderingContext2D): void {
    if (this._label === undefined || this._path.length < 2) {
      return;
    }

    // Calculate midpoint of path with offset
    const midpoint = this.getPathMidpoint();
    const labelPosition = {
      x: midpoint.x,
      y: midpoint.y + this._labelOffset,
    };

    const labelOpacity = this._label.style.opacity ?? 1;

    // Draw background for label
    this._label.measure(ctx);
    const labelWidth = this._label.measuredWidth;
    const labelHeight = this._label.measuredHeight;

    const bgPadding = this._labelBackground?.padding ?? EDGE_LABEL_BACKGROUND_PADDING;
    const bgColor = this._labelBackground?.color ?? '#ffffff';
    const bgOpacity = this._labelBackground?.opacity ?? 1;
    const bgRadius = this._labelBackground?.borderRadius ?? EDGE_LABEL_BACKGROUND_RADIUS;

    const bgX = labelPosition.x - labelWidth / 2 - bgPadding;
    const bgY = labelPosition.y - labelHeight / 2 - bgPadding;
    const bgWidth = labelWidth + bgPadding * 2;
    const bgHeight = labelHeight + bgPadding * 2;

    ctx.fillStyle = bgColor;
    ctx.globalAlpha = bgOpacity;

    if (bgRadius > 0) {
      this.drawRoundedRect(ctx, bgX, bgY, bgWidth, bgHeight, bgRadius);
      ctx.fill();
    } else {
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    }

    ctx.globalAlpha = labelOpacity;
    this._label.renderAt(ctx, labelPosition);
    ctx.globalAlpha = 1;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    drawRoundedRectPath(ctx, x, y, width, height, radius);
  }

  private getPathMidpoint(): Point {
    const path = this._path;

    if (this._type === 'bezier' && path.length >= 4) {
      const samples: Point[] = [];
      const steps = 20;
      for (let i = 1; i + 2 < path.length; i += 3) {
        const p0 = path[i - 1]!;
        const p1 = path[i]!;
        const p2 = path[i + 1]!;
        const p3 = path[i + 2]!;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          if (samples.length > 0 && t === 0) {
            continue;
          }
          samples.push(bezierPoint(p0, p1, p2, p3, t));
        }
      }

      return this.getPolylineMidpoint(samples);
    }

    // For straight/polyline, find midpoint of total length
    return this.getPolylineMidpoint(path);
  }

  /**
   * Get world position of label center along path.
   */
  getLabelPosition(): Point | null {
    if (this._path.length < 2) {
      return null;
    }

    const midpoint = this.getPathMidpoint();
    return {
      x: midpoint.x,
      y: midpoint.y + this._labelOffset,
    };
  }

  private getPolylineMidpoint(path: Point[]): Point {
    if (path.length === 0) {
      return { x: 0, y: 0 };
    }
    if (path.length === 1) {
      return path[0]!;
    }

    let totalLength = 0;
    const segments: { start: Point; end: Point; length: number }[] = [];

    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1]!;
      const end = path[i]!;
      const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      segments.push({ start, end, length });
      totalLength += length;
    }

    const halfLength = totalLength / 2;
    let accumulated = 0;

    for (const seg of segments) {
      if (accumulated + seg.length >= halfLength) {
        const t = (halfLength - accumulated) / seg.length;
        return {
          x: seg.start.x + t * (seg.end.x - seg.start.x),
          y: seg.start.y + t * (seg.end.y - seg.start.y),
        };
      }
      accumulated += seg.length;
    }

    return path[0]!;
  }

  private getPathStrategy(type: EdgePathType): PathStrategy {
    switch (type) {
      case 'straight':
        return new StraightPathStrategy();
      case 'polyline':
        return new PolylinePathStrategy();
      case 'editable-polyline':
        return new PolylinePathStrategy();
      case 'bezier':
        return new BezierPathStrategy();
      default:
        return new StraightPathStrategy();
    }
  }

  private applyLineDash(ctx: CanvasRenderingContext2D, style: EdgeStyle): void {
    if (style.lineDash !== undefined && style.lineDash.length > 0) {
      ctx.setLineDash(style.lineDash);
    } else {
      ctx.setLineDash([]);
    }

    if (style.lineDashOffset !== undefined) {
      ctx.lineDashOffset = style.lineDashOffset;
    } else {
      ctx.lineDashOffset = 0;
    }
  }
}
