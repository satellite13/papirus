import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Point } from '@/types';

const OUTLINE_SAMPLE_COUNT = 64;

export interface CustomShapeNodeOptions extends NodeOptions {
  path: Path2D | ((width: number, height: number) => Path2D);
  /**
   * SVG path string for export. Required for correct SVG export of custom shapes.
   * Path coordinates are in local space (0,0 = top-left, width×height = node bounds).
   * If omitted, SVG export falls back to a rectangle.
   */
  svgPath?: string | ((width: number, height: number) => string);
  shapeType?: string;
}

/**
 * Node with custom Path2D shape
 */
export class CustomShapeNode extends Node {
  private _pathFactory: (width: number, height: number) => Path2D;
  private _svgPathFactory: ((width: number, height: number) => string) | null = null;
  private _shapeType?: string;
  private _cachedPath: Path2D | null = null;
  private _cachedWidth = 0;
  private _cachedHeight = 0;
  private _cachedOutline: { points: Point[]; lengths: number[]; totalLength: number } | null = null;

  constructor(options: CustomShapeNodeOptions) {
    super(options);

    if (options.path instanceof Path2D) {
      const staticPath = options.path;
      this._pathFactory = (): Path2D => staticPath;
    } else {
      this._pathFactory = options.path;
    }

    if (options.svgPath !== undefined) {
      if (typeof options.svgPath === 'string') {
        const staticSvg = options.svgPath;
        this._svgPathFactory = (): string => staticSvg;
      } else {
        this._svgPathFactory = options.svgPath;
      }
    }

    this._shapeType = options.shapeType;
  }

  get typeName(): string {
    return 'custom';
  }

  get shapeType(): string | undefined {
    return this._shapeType;
  }

  set shapeType(value: string | undefined) {
    if (this._shapeType !== value) {
      this._shapeType = value;
      this.markDirty();
    }
  }

  /**
   * Set a new path factory
   */
  setPathFactory(factory: (width: number, height: number) => Path2D): void {
    this._pathFactory = factory;
    this._cachedPath = null;
    this._cachedOutline = null;
    this.markDirty();
  }

  /**
   * Get the current path (cached)
   */
  getPath(): Path2D {
    if (
      this._cachedPath === null ||
      this._cachedWidth !== this._width ||
      this._cachedHeight !== this._height
    ) {
      this._cachedPath = this._pathFactory(this._width, this._height);
      this._cachedWidth = this._width;
      this._cachedHeight = this._height;
      this._cachedOutline = null;
    }
    return this._cachedPath;
  }

  /**
   * Get SVG path string for export. Returns null if svgPath was not provided.
   */
  getSvgPath(): string | null {
    if (this._svgPathFactory === null) {
      return null;
    }
    return this._svgPathFactory(this._width, this._height);
  }

  /**
   * Set SVG path for export. Call when shape changes.
   */
  setSvgPath(value: string | ((width: number, height: number) => string) | undefined): void {
    if (value === undefined) {
      this._svgPathFactory = null;
    } else if (typeof value === 'string') {
      this._svgPathFactory = (): string => value;
    } else {
      this._svgPathFactory = value;
    }
    this.markDirty();
  }

  private getOutlineSample(): { points: Point[]; lengths: number[]; totalLength: number } | null {
    this.getPath();
    if (
      this._cachedOutline !== null &&
      this._cachedWidth === this._width &&
      this._cachedHeight === this._height
    ) {
      return this._cachedOutline;
    }

    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const ctx = canvas?.getContext('2d');
    if (!ctx) {
      return null;
    }

    const path = this.getPath();
    const cx = this._width / 2;
    const cy = this._height / 2;
    const maxR = Math.max(this._width, this._height);

    const isInside = (lx: number, ly: number): boolean => ctx.isPointInPath(path, lx, ly);

    const getBoundaryPoint = (dx: number, dy: number): Point => {
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) return { x: cx, y: cy };
      const ux = dx / len;
      const uy = dy / len;
      let lo = 0;
      let hi = maxR;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const px = cx + ux * mid;
        const py = cy + uy * mid;
        if (isInside(px, py)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const t = (lo + hi) / 2;
      return { x: cx + ux * t, y: cy + uy * t };
    };

    const points: Point[] = [];
    for (let i = 0; i < OUTLINE_SAMPLE_COUNT; i++) {
      const angle = (i / OUTLINE_SAMPLE_COUNT) * Math.PI * 2 - Math.PI / 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      points.push(getBoundaryPoint(dx, dy));
    }

    const lengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < OUTLINE_SAMPLE_COUNT; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % OUTLINE_SAMPLE_COUNT]!;
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      lengths.push(segLen);
      totalLength += segLen;
    }

    this._cachedOutline = { points, lengths, totalLength };
    return this._cachedOutline;
  }

  private localToWorld(p: Point): Point {
    return { x: p.x + this._x, y: p.y + this._y };
  }

  override getOutlineDirection(param: number): 'top' | 'right' | 'bottom' | 'left' {
    if (!this.getOutlineSample()) {
      return super.getOutlineDirection(param);
    }
    return this.outlineDirectionFromCenter(param);
  }

  override getConnectionPointAtOutlineParam(param: number): Point {
    const sample = this.getOutlineSample();
    if (!sample) return super.getConnectionPointAtOutlineParam(param);
    const { points, lengths, totalLength } = sample;
    let s = ((param % 1) + 1) % 1 * totalLength;

    for (let i = 0; i < OUTLINE_SAMPLE_COUNT; i++) {
      const segLen = lengths[i]!;
      if (s < segLen) {
        const a = points[i]!;
        const b = points[(i + 1) % OUTLINE_SAMPLE_COUNT]!;
        const t = segLen > 0 ? s / segLen : 0;
        const local = {
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
        };
        return this.localToWorld(local);
      }
      s -= segLen;
    }
    return this.localToWorld(points[0]!);
  }

  override getClosestPointOnOutline(target: Point): { point: Point; param: number } {
    const sample = this.getOutlineSample();
    if (!sample) return super.getClosestPointOnOutline(target);
    const { points, lengths, totalLength } = sample;
    const localTarget = { x: target.x - this._x, y: target.y - this._y };

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
      let t = lenSq > 0 ? ((localTarget.x - ax) * dx + (localTarget.y - ay) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx;
      const py = ay + t * dy;
      const distSq = (localTarget.x - px) ** 2 + (localTarget.y - py) ** 2;
      const param = segStartParam + (segLen > 0 ? (t * segLen) / totalLength : 0);
      return { point: { x: px, y: py }, param, distSq };
    };

    let best = projectSegment(
      points[0]!.x,
      points[0]!.y,
      points[1]!.x,
      points[1]!.y,
      lengths[0]!,
      0
    );
    let segStartParam = lengths[0]! / totalLength;

    for (let i = 1; i < OUTLINE_SAMPLE_COUNT; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % OUTLINE_SAMPLE_COUNT]!;
      const segLen = lengths[i]!;
      const r = projectSegment(a.x, a.y, b.x, b.y, segLen, segStartParam);
      if (r.distSq < best.distSq) best = r;
      segStartParam += segLen / totalLength;
    }

    const param = ((best.param % 1) + 1) % 1;
    return { point: this.localToWorld(best.point), param };
  }

  protected override getOutlinePointToward(target: Point): Point {
    if (typeof document === 'undefined') {
      return super.getOutlinePointToward(target);
    }

    const center = this.getCenter();
    const dx = target.x - center.x;
    const dy = target.y - center.y;

    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      return center;
    }

    const localCenter = { x: this._width / 2, y: this._height / 2 };
    const localDx = target.x - center.x;
    const localDy = target.y - center.y;

    const boundary = this.getBoundaryPointOnRay(localCenter.x, localCenter.y, localDx, localDy);
    return this.localToWorld(boundary);
  }

  private getBoundaryPointOnRay(ox: number, oy: number, dx: number, dy: number): Point {
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return { x: ox, y: oy };
    const ux = dx / len;
    const uy = dy / len;
    const maxR = Math.max(this._width, this._height) * 2;
    const path = this.getPath();

    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return { x: ox, y: oy };
    const isInside = (lx: number, ly: number): boolean => ctx.isPointInPath(path, lx, ly);

    let lo = 0;
    let hi = maxR;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const px = ox + ux * mid;
      const py = oy + uy * mid;
      if (isInside(px, py)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const t = (lo + hi) / 2;
    return { x: ox + ux * t, y: oy + uy * t };
  }

  override hitTest(point: Point): boolean {
    // Create an offscreen canvas for hit testing
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (ctx === null) {
      // Fallback to bounding box
      return super.hitTest(point);
    }

    // Translate point to local coordinates
    const localX = point.x - this._x;
    const localY = point.y - this._y;

    const path = this.getPath();
    if (ctx.isPointInPath(path, localX, localY)) {
      return true;
    }

    ctx.lineWidth = NODE_HITBOX_PADDING * 2;
    return ctx.isPointInStroke(path, localX, localY);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const style = this.style;
    const baseOpacity = style.opacity ?? 1;
    const fillOpacity = style.fillOpacity ?? 1;
    const strokeOpacity = style.strokeOpacity ?? 1;

    this.applyStyle(ctx);

    ctx.save();
    ctx.translate(this._x, this._y);

    const path = this.getPath();
    ctx.globalAlpha = baseOpacity * fillOpacity;
    ctx.fill(path);
    ctx.globalAlpha = baseOpacity * strokeOpacity;
    ctx.stroke(path);

    ctx.restore();
    ctx.globalAlpha = 1;

    this.renderContents(ctx);
  }
}

/**
 * Helper function to create common shapes as Path2D
 */
export const ShapeFactories = {
  /**
   * Hexagon shape
   */
  hexagon: (width: number, height: number): Path2D => {
    const path = new Path2D();
    const inset = width * 0.25;

    path.moveTo(inset, 0);
    path.lineTo(width - inset, 0);
    path.lineTo(width, height / 2);
    path.lineTo(width - inset, height);
    path.lineTo(inset, height);
    path.lineTo(0, height / 2);
    path.closePath();

    return path;
  },

  /**
   * Parallelogram shape
   */
  parallelogram: (width: number, height: number): Path2D => {
    const path = new Path2D();
    const skew = width * 0.2;

    path.moveTo(skew, 0);
    path.lineTo(width, 0);
    path.lineTo(width - skew, height);
    path.lineTo(0, height);
    path.closePath();

    return path;
  },

  /**
   * Cylinder shape (for databases)
   */
  cylinder: (width: number, height: number): Path2D => {
    const path = new Path2D();
    const ellipseHeight = height * 0.15;

    // Top ellipse
    path.ellipse(width / 2, ellipseHeight, width / 2, ellipseHeight, 0, 0, Math.PI * 2);

    // Body
    path.moveTo(0, ellipseHeight);
    path.lineTo(0, height - ellipseHeight);
    path.ellipse(width / 2, height - ellipseHeight, width / 2, ellipseHeight, 0, Math.PI, 0);
    path.lineTo(width, ellipseHeight);

    return path;
  },

  /**
   * Document shape
   */
  document: (width: number, height: number): Path2D => {
    const path = new Path2D();
    const waveHeight = height * 0.1;

    path.moveTo(0, 0);
    path.lineTo(width, 0);
    path.lineTo(width, height - waveHeight);
    path.quadraticCurveTo(width * 0.75, height, width * 0.5, height - waveHeight);
    path.quadraticCurveTo(width * 0.25, height - waveHeight * 2, 0, height - waveHeight);
    path.closePath();

    return path;
  },

  /**
   * SVG path strings for export. Use with CustomShapeNodeOptions.svgPath.
   */
  svg: {
    hexagon: (w: number, h: number): string =>
      `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h / 2} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h / 2} Z`,
    parallelogram: (w: number, h: number): string => {
      const skew = w * 0.2;
      return `M ${skew} 0 L ${w} 0 L ${w - skew} ${h} L 0 ${h} Z`;
    },
    cylinder: (w: number, h: number): string => {
      const eh = h * 0.15;
      const rx = w / 2;
      return `M 0 ${eh} L 0 ${h - eh} A ${rx} ${eh} 0 0 1 ${w} ${h - eh} L ${w} ${eh} A ${rx} ${eh} 0 0 1 0 ${eh} Z`;
    },
    document: (w: number, h: number): string => {
      const wh = h * 0.1;
      return `M 0 0 L ${w} 0 L ${w} ${h - wh} Q ${w * 0.75} ${h} ${w * 0.5} ${h - wh} Q ${w * 0.25} ${h - wh * 2} 0 ${h - wh} Z`;
    },
    /** Chamfered rectangle (cut corners) */
    chamfered: (w: number, h: number): string => {
      const cut = Math.max(6, Math.min(20, w * 0.18, h * 0.18));
      return `M ${cut} 0 L ${w - cut} 0 L ${w} ${cut} L ${w} ${h - cut} L ${w - cut} ${h} L ${cut} ${h} L 0 ${h - cut} L 0 ${cut} Z`;
    },
  },
};
