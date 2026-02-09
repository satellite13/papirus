import { Element, generateId } from './Element';
import type { Node } from './Node';
import type { Bounds, ElementStyle, Point } from '@/types';
import type { StyleManager } from '@/styles/StyleManager';
import { shallowEqual } from '@/utils/style';
import { pointInRect } from '@/utils/geometry';

export interface GroupOptions {
  id?: string;
  style?: ElementStyle;
  styleClass?: string;
  label?: string;
  padding?: number;
}

const DEFAULT_GROUP_STYLE: ElementStyle = {
  fillColor: 'rgba(200, 200, 200, 0.2)',
  strokeColor: '#999999',
  strokeWidth: 1,
  lineDash: [8, 4],
  opacity: 1,
};

/**
 * Container for grouping nodes
 */
export class Group extends Element {
  private _children: (Node | Group)[] = [];
  private _label?: string;
  private _padding: number;
  private _groupStyle: ElementStyle;

  constructor(options: GroupOptions = {}) {
    super({
      id: options.id ?? generateId('group'),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      style: options.style,
      styleClass: options.styleClass,
    });

    this._groupStyle = { ...DEFAULT_GROUP_STYLE, ...options.style };
    this._label = options.label;
    this._padding = options.padding ?? 20;
  }

  /**
   * Children of this group
   */
  get children(): readonly (Node | Group)[] {
    return this._children;
  }

  /**
   * Group label
   */
  get label(): string | undefined {
    return this._label;
  }

  set label(value: string | undefined) {
    this._label = value;
    this.markDirty();
  }

  /**
   * Padding around children
   */
  get padding(): number {
    return this._padding;
  }

  set padding(value: number) {
    if (this._padding !== value) {
      this._padding = value;
      this.recalculateBounds();
    }
  }

  /**
   * Group style
   */
  override get style(): ElementStyle {
    return this._groupStyle;
  }

  override set style(value: ElementStyle) {
    this._groupStyle = { ...DEFAULT_GROUP_STYLE, ...value };
    this._style = value;
    this.markDirty();
  }

  applyStyleManager(styleManager: StyleManager): void {
    const baseStyle = styleManager.getGroupStyle(false, this._styleClass);
    const mergedStyle = { ...baseStyle, ...this._style };
    if (!shallowEqual(this._groupStyle, mergedStyle)) {
      this._groupStyle = mergedStyle;
      this.markDirty();
    }
  }

  /**
   * Add a child to this group
   */
  addChild(child: Node | Group): void {
    if (!this._children.includes(child)) {
      this._children.push(child);
      this.recalculateBounds();
    }
  }

  /**
   * Remove a child from this group
   */
  removeChild(childId: string): boolean {
    const index = this._children.findIndex((c) => c.id === childId);
    if (index === -1) {
      return false;
    }
    this._children.splice(index, 1);
    this.recalculateBounds();
    return true;
  }

  /**
   * Check if a child is in this group (recursive)
   */
  hasChild(childId: string): boolean {
    for (const child of this._children) {
      if (child.id === childId) {
        return true;
      }
      if (child instanceof Group && child.hasChild(childId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all nested children (flattened)
   */
  getAllChildren(): (Node | Group)[] {
    const result: (Node | Group)[] = [];
    for (const child of this._children) {
      result.push(child);
      if (child instanceof Group) {
        result.push(...child.getAllChildren());
      }
    }
    return result;
  }

  /**
   * Recalculate bounds from children
   */
  recalculateBounds(): void {
    if (this._children.length === 0) {
      this._x = 0;
      this._y = 0;
      this._width = 0;
      this._height = 0;
      this.markDirty();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const child of this._children) {
      const bounds = child.getBounds();
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    this._x = minX - this._padding;
    this._y = minY - this._padding;
    this._width = maxX - minX + this._padding * 2;
    this._height = maxY - minY + this._padding * 2;

    this.markDirty();
  }

  hitTest(point: Point): boolean {
    const bounds = this.getBounds();
    return pointInRect(point, bounds);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._children.length === 0) {
      return;
    }

    const { x, y, width, height } = this.getBounds();
    const style = this._groupStyle;

    // Draw background
    ctx.fillStyle = style.fillColor ?? 'rgba(200, 200, 200, 0.2)';
    ctx.globalAlpha = style.opacity ?? 1;
    ctx.fillRect(x, y, width, height);

    // Draw border
    ctx.strokeStyle = style.strokeColor ?? '#999999';
    ctx.lineWidth = style.strokeWidth ?? 1;

    if (this._state === 'selected') {
      ctx.lineWidth = Math.max(style.strokeWidth ?? 1, 2);
    }

    const lineDash = style.lineDash ?? [];
    ctx.setLineDash(lineDash.length > 0 ? lineDash : []);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);

    // Draw label
    if (this._label !== undefined) {
      ctx.fillStyle = '#666666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(this._label, x + 8, y + 4);
    }

    ctx.globalAlpha = 1;

    // Render children
    for (const child of this._children) {
      if (child.visible) {
        child.render(ctx);
      }
    }
  }

  override getBounds(): Bounds {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    };
  }
}
