import { Element, generateId } from './Element';
import { TextLabel, type TextLabelOptions } from './TextLabel';
import type {
  ArrowType,
  ArrowMarkerConfig,
  Bounds,
  EdgeEndpoint,
  EdgePathType,
  EdgeStyle,
  EdgeLabelBackground,
  Point,
} from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import { shallowEqual } from '@/utils/style';
import { getClosestPointOnPath, getPathPointAt } from '@/utils/edgePath';
import { bezierPoint, segmentRectIntersections, distance } from '@/utils/geometry';
import {
  type PathStrategy,
  type PathStrategyOptions,
  StraightPathStrategy,
  PolylinePathStrategy,
  BezierPathStrategy,
} from './paths';
import { EDGE_HANDLE_RADIUS, DEFAULT_SELECTION_COLOR, DEFAULT_HOVER_COLOR } from '@/constants';
import { getCanvasMarkerLength, renderEdgeMarkers } from './edge/EdgeMarkerRenderer';
import {
  getEdgeLabelPosition,
  getEdgeLabelRotation,
  renderEdgeLabel,
  type EdgeLabelLayoutOptions,
} from './edge/EdgeLabelRenderer';

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
  /** Position along the path (0 = source, 0.5 = midpoint, 1 = target). Default 0.5 */
  labelPosition?: number;
  /** Rotate label text to follow the path tangent */
  labelFollowPath?: boolean;
  labelBackground?: EdgeLabelBackground;
  lockAnchors?: boolean;
  labelLineGap?: boolean;
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
  private _labelPosition: number;
  private _labelFollowPath: boolean;
  private _labelBackground?: EdgeLabelBackground;
  private _labelLineGap: boolean;
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
  private _bindingListener?: () => void;

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
    this._labelPosition = options.labelPosition ?? 0.5;
    this._labelFollowPath = options.labelFollowPath ?? false;
    this._labelBackground = options.labelBackground;
    this._labelLineGap = options.labelLineGap ?? false;

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
    this._bindingListener?.();
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
    this._bindingListener?.();
    this.markDirty();
  }

  /**
   * Notified when from/to binding changes (ports / outline params / node ids).
   * Used by DiagramRenderer to resync endpoints without doing so on every pan frame.
   */
  setBindingListener(listener?: () => void): void {
    this._bindingListener = listener;
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
      if (value !== 'editable-polyline' && this._controlPoints?.length) {
        // Clears control points and recalculates via the controlPoints setter.
        this.controlPoints = undefined;
      } else {
        // Strategy changed (e.g. bezier → straight): rebuild path immediately so
        // render does not keep drawing the previous multi-point curve as a polyline.
        this.recalculatePath();
      }
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
   * Position along path (0 = source, 0.5 = midpoint, 1 = target)
   */
  get labelPosition(): number {
    return this._labelPosition;
  }

  set labelPosition(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    if (this._labelPosition !== clamped) {
      this._labelPosition = clamped;
      this.markDirty();
    }
  }

  /**
   * Whether label text rotates to follow the path tangent
   */
  get labelFollowPath(): boolean {
    return this._labelFollowPath;
  }

  set labelFollowPath(value: boolean) {
    if (this._labelFollowPath !== value) {
      this._labelFollowPath = value;
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
   * Whether to create a gap in the edge line under the label.
   */
  get labelLineGap(): boolean {
    return this._labelLineGap;
  }

  set labelLineGap(value: boolean) {
    if (this._labelLineGap !== value) {
      this._labelLineGap = value;
      this.markDirty();
    }
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
    const cps =
      this._controlPoints && this._controlPoints.length > 0
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
    // Skip path rebuild when nothing moved — critical for pan/zoom frames where
    // DiagramRenderer still syncs endpoints for every edge.
    if (
      this._path.length > 0 &&
      this._fromPoint.x === fromPoint.x &&
      this._fromPoint.y === fromPoint.y &&
      this._toPoint.x === toPoint.x &&
      this._toPoint.y === toPoint.y &&
      this._fromDir === fromDir &&
      this._toDir === toDir
    ) {
      this._pathOptions = options;
      return;
    }
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
        ? getCanvasMarkerLength(this._startMarker)
        : 0;
    const endOffset =
      this._endMarker && this._endMarker.type !== 'none'
        ? getCanvasMarkerLength(this._endMarker)
        : 0;

    // Helper to build a polyline representation of the path
    const buildPolyline = (): Point[] => {
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
        return samples;
      }
      return path.map((p) => ({ ...p }));
    };

    // Shorten polyline at both ends by given offsets (for markers)
    const shortenPolyline = (points: Point[], start: number, end: number): Point[] => {
      if (points.length < 2) {
        return points;
      }

      const totalLength = (): number => {
        let len = 0;
        for (let i = 1; i < points.length; i++) {
          len += distance(points[i - 1]!, points[i]!);
        }
        return len;
      };

      let pts = points;
      const remainingStart = Math.max(0, start);
      const remainingEnd = Math.max(0, end);
      const total = totalLength();
      if (remainingStart + remainingEnd >= total) {
        const mid = points[0]!;
        return [mid];
      }

      // Shorten from start
      if (remainingStart > 0) {
        const newPoints: Point[] = [];
        let accumulated = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i]!;
          const p1 = pts[i + 1]!;
          const segLen = distance(p0, p1);
          if (accumulated + segLen >= remainingStart) {
            const t = (remainingStart - accumulated) / segLen;
            const newStart: Point = {
              x: p0.x + (p1.x - p0.x) * t,
              y: p0.y + (p1.y - p0.y) * t,
            };
            newPoints.push(newStart);
            for (let j = i + 1; j < pts.length; j++) {
              newPoints.push({ ...pts[j]! });
            }
            pts = newPoints;
            break;
          }
          accumulated += segLen;
        }
      }

      // Shorten from end
      if (remainingEnd > 0 && pts.length > 1) {
        const newPoints: Point[] = [];
        let accumulated = 0;
        for (let i = pts.length - 1; i > 0; i--) {
          const p0 = pts[i - 1]!;
          const p1 = pts[i]!;
          const segLen = distance(p0, p1);
          if (accumulated + segLen >= remainingEnd) {
            const t = (remainingEnd - accumulated) / segLen;
            const newEnd: Point = {
              x: p1.x + (p0.x - p1.x) * t,
              y: p1.y + (p0.y - p1.y) * t,
            };
            newPoints.push(newEnd);
            for (let j = i - 1; j >= 0; j--) {
              newPoints.push({ ...pts[j]! });
            }
            pts = newPoints.reverse();
            break;
          }
          accumulated += segLen;
        }
      }

      return pts;
    };

    const shouldCreateGap = this._label !== undefined && this._labelLineGap;

    if (!shouldCreateGap) {
      // Legacy behavior without gaps
      const start = path[0]!;
      const startNext = path[1]!;
      const startAngle = Math.atan2(startNext.y - start.y, startNext.x - start.x);
      const shortenedStart = {
        x: start.x + startOffset * Math.cos(startAngle),
        y: start.y + startOffset * Math.sin(startAngle),
      };

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
          const segmentEnd = i + 2 === path.length - 1 ? shortenedEnd : path[i + 2]!;
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, segmentEnd.x, segmentEnd.y);
        }
      } else {
        for (let i = 1; i < path.length - 1; i++) {
          ctx.lineTo(path[i]!.x, path[i]!.y);
        }
        ctx.lineTo(shortenedEnd.x, shortenedEnd.y);
      }

      ctx.stroke();
      return;
    }

    // Build shortened polyline for gap calculation and rendering
    let polyline = buildPolyline();
    polyline = shortenPolyline(polyline, startOffset, endOffset);
    if (polyline.length < 2) {
      return;
    }

    // Compute label bounds (center from path midpoint + offset, size from measured label)
    this._label!.measure(ctx);
    const labelCenter = this.getLabelPosition();
    if (!labelCenter) {
      return;
    }

    const labelWidth = this._label!.measuredWidth;
    const labelHeight = this._label!.measuredHeight;

    // When label is rotated, compute axis-aligned bounding box of the rotated rect
    const rot = this.getLabelRotation();
    let effectiveWidth = labelWidth;
    let effectiveHeight = labelHeight;
    if (rot !== 0) {
      const cosR = Math.abs(Math.cos(rot));
      const sinR = Math.abs(Math.sin(rot));
      effectiveWidth = labelWidth * cosR + labelHeight * sinR;
      effectiveHeight = labelWidth * sinR + labelHeight * cosR;
    }

    const labelRect: Bounds = {
      x: labelCenter.x - effectiveWidth / 2,
      y: labelCenter.y - effectiveHeight / 2,
      width: effectiveWidth,
      height: effectiveHeight,
    };

    type SegmentIntersection = { segIndex: number; t: number; point: Point };
    const segmentIntersections: SegmentIntersection[] = [];

    for (let i = 0; i < polyline.length - 1; i++) {
      const p0 = polyline[i]!;
      const p1 = polyline[i + 1]!;
      const intersections = segmentRectIntersections(p0, p1, labelRect);
      for (const inter of intersections) {
        segmentIntersections.push({
          segIndex: i,
          t: inter.t,
          point: inter.point,
        });
      }
    }

    if (segmentIntersections.length < 2) {
      // No meaningful intersection with label rect: draw as single polyline
      ctx.beginPath();
      ctx.moveTo(polyline[0]!.x, polyline[0]!.y);
      for (let i = 1; i < polyline.length; i++) {
        ctx.lineTo(polyline[i]!.x, polyline[i]!.y);
      }
      ctx.stroke();
      return;
    }

    segmentIntersections.sort((a, b) => {
      if (a.segIndex === b.segIndex) {
        return a.t - b.t;
      }
      return a.segIndex - b.segIndex;
    });

    ctx.beginPath();
    ctx.moveTo(polyline[0]!.x, polyline[0]!.y);

    let entered = false;
    let exited = false;

    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i + 1]!;

      const currentIntersections = segmentIntersections.filter((it) => it.segIndex === i);

      if (!entered && currentIntersections.length > 0) {
        // First time we meet an intersection: entry into label rect
        const first = currentIntersections[0]!;
        ctx.lineTo(first.point.x, first.point.y);
        entered = true;

        const maybeExit = currentIntersections.length > 1 ? currentIntersections[1]! : undefined;
        if (maybeExit) {
          // Enter and exit on the same segment
          ctx.moveTo(maybeExit.point.x, maybeExit.point.y);
          exited = true;
          // Draw remainder of the segment after exit
          ctx.lineTo(p1.x, p1.y);
        }
        continue;
      }

      if (entered && !exited && currentIntersections.length > 0) {
        // We are leaving the label rect on this segment
        const lastOnSegment = currentIntersections[currentIntersections.length - 1]!;
        ctx.moveTo(lastOnSegment.point.x, lastOnSegment.point.y);
        exited = true;
        ctx.lineTo(p1.x, p1.y);
        continue;
      }

      if (!entered || exited) {
        ctx.lineTo(p1.x, p1.y);
      }
      // While inside gap (entered && !exited), skip drawing
    }

    ctx.stroke();
  }

  private renderArrows(ctx: CanvasRenderingContext2D): void {
    renderEdgeMarkers(ctx, {
      path: this._path,
      type: this._type,
      arrowType: this._arrowType,
      startMarker: this._startMarker,
      endMarker: this._endMarker,
    });
  }

  private renderLabel(ctx: CanvasRenderingContext2D): void {
    renderEdgeLabel(ctx, {
      ...this.getLabelLayoutOptions(),
      label: this._label,
      background: this._labelBackground,
    });
  }

  /**
   * Point and tangent on the current path at a normalized length position (0..1).
   */
  getPointAt(pathParam = 0.5): { point: Point; angle: number } | null {
    if (this._path.length < 2) {
      return null;
    }
    return getPathPointAt(this._path, this._type, pathParam);
  }

  /**
   * Nearest point on this edge's path to `point` (world coordinates).
   */
  getClosestPointOnPath(
    point: Point
  ): { point: Point; pathParam: number; distance: number } | null {
    return getClosestPointOnPath(this._path, this._type, point);
  }

  /**
   * Get world position of label center along path.
   */
  getLabelPosition(): Point | null {
    return getEdgeLabelPosition(this.getLabelLayoutOptions());
  }

  /**
   * Get label rotation angle in radians (if labelFollowPath is true).
   */
  getLabelRotation(): number {
    return getEdgeLabelRotation(this.getLabelLayoutOptions());
  }

  private getLabelLayoutOptions(): EdgeLabelLayoutOptions {
    return {
      path: this._path,
      type: this._type,
      position: this._labelPosition,
      offset: this._labelOffset,
      followPath: this._labelFollowPath,
    };
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
