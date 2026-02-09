import { Node, type NodeOptions } from '../Node';
import { NODE_HITBOX_PADDING } from '@/constants';
import type { Point } from '@/types';

export interface CustomShapeNodeOptions extends NodeOptions {
  path: Path2D | ((width: number, height: number) => Path2D);
}

/**
 * Node with custom Path2D shape
 */
export class CustomShapeNode extends Node {
  private _pathFactory: (width: number, height: number) => Path2D;
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
  }

  get typeName(): string {
    return 'custom';
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
    this.applyStyle(ctx);

    ctx.save();
    ctx.translate(this._x, this._y);

    const path = this.getPath();
    ctx.fill(path);
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
};
