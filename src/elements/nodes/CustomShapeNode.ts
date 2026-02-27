import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Point } from '@/types';

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
