import type { Bounds, Size } from '@/types';
import {
  normalizeSides,
  type CComponent,
  type CComponentStyle,
  type SerializedCComponent,
  type SidesConfig,
} from './CComponent';
import { CompositeComponentBase } from './CompositeComponentBase';
import { flexLayout, type FlexChild, type FlexConfig } from './FlexLayout';
import type { CShape } from './CShape';
import type { CText } from './CText';

function isCContainer(component: CComponent): component is CContainer {
  return component.type === 'container';
}

function isCShape(component: CComponent): component is CShape {
  return component.type === 'shape';
}

function isCText(component: CComponent): component is CText {
  return component.type === 'text';
}

export interface CContainerOptions {
  id?: string;
  direction?: 'row' | 'column';
  justifyContent?: FlexConfig['justifyContent'];
  alignItems?: FlexConfig['alignItems'];
  gap?: number;
  padding?: number | SidesConfig;
  children?: CComponent[];
  style?: CComponentStyle;
}

/**
 * Flex container component for CompositeNode.
 * Lays out children using a flexbox-like algorithm.
 */
export class CContainer extends CompositeComponentBase {
  readonly type = 'container' as const;
  readonly id?: string;
  style: CComponentStyle;

  private _direction: 'row' | 'column';
  private _justifyContent: FlexConfig['justifyContent'];
  private _alignItems: FlexConfig['alignItems'];
  private _gap: number;
  private _padding: number | SidesConfig;
  private _children: CComponent[];

  // Cached layout results from last render (used by hitTest and toSVG)
  private _cachedBounds: Bounds[] | null = null;
  private _cachedContainerBounds: Bounds | null = null;
  private _layoutChildren: CComponent[] | null = null;
  private _suppressBoundName = false;

  constructor(options: CContainerOptions = {}) {
    super();
    this.id = options.id;
    this._direction = options.direction ?? 'column';
    this._justifyContent = options.justifyContent ?? 'start';
    this._alignItems = options.alignItems ?? 'stretch';
    this._gap = options.gap ?? 0;
    this._padding = options.padding ?? 0;
    this._children = options.children ?? [];
    this.style = options.style ?? {};

    // Wire onChange on existing children
    for (const child of this._children) {
      child.setOnChange(() => this.handleChildChange());
    }
  }

  get direction(): 'row' | 'column' {
    return this._direction;
  }

  get justifyContent(): FlexConfig['justifyContent'] {
    return this._justifyContent;
  }

  get alignItems(): FlexConfig['alignItems'] {
    return this._alignItems;
  }

  get gap(): number {
    return this._gap;
  }

  get padding(): number | SidesConfig {
    return this._padding;
  }

  get children(): readonly CComponent[] {
    return this._children;
  }

  /**
   * When true, CText bound to `__name__` is omitted from measure/render/hit/SVG.
   * Used when CompositeNode draws the name as an external Node.label.
   */
  setSuppressBoundName(value: boolean): void {
    if (this._suppressBoundName === value) {
      return;
    }
    this._suppressBoundName = value;
    this._cachedBounds = null;
    this._layoutChildren = null;
    for (const child of this._children) {
      if (isCContainer(child)) {
        child.setSuppressBoundName(value);
      }
      if (isCShape(child) && child.content) {
        child.content.setSuppressBoundName(value);
      }
    }
  }

  private isLayoutSkipped(child: CComponent): boolean {
    if (child.style.visible === false) {
      return true;
    }
    return this._suppressBoundName && isCText(child) && child.bindToProperty === '__name__';
  }

  private getLayoutChildren(): CComponent[] {
    return this._children.filter((child) => !this.isLayoutSkipped(child));
  }

  addChild(child: CComponent): void {
    child.setOnChange(() => this.handleChildChange());
    this._children.push(child);
    this.handleChildChange();
  }

  removeChild(index: number): CComponent | undefined {
    const removed = this._children.splice(index, 1)[0];
    if (removed) {
      removed.setOnChange(undefined);
      this.handleChildChange();
    }
    return removed;
  }

  insertChild(index: number, child: CComponent): void {
    child.setOnChange(() => this.handleChildChange());
    this._children.splice(index, 0, child);
    this.handleChildChange();
  }

  private handleChildChange(): void {
    this._cachedBounds = null;
    this.markChanged();
  }

  private getFlexConfig(): FlexConfig {
    return {
      direction: this._direction,
      justifyContent: this._justifyContent,
      alignItems: this._alignItems,
      gap: this._gap,
      padding: this._padding,
    };
  }

  private buildFlexChildren(
    ctx: CanvasRenderingContext2D,
    children: readonly CComponent[] = this.getLayoutChildren()
  ): FlexChild[] {
    return children.map((child) => {
      const s = child.style;
      const measured = child.measure(ctx);
      return {
        measure: measured,
        minSize: { width: 0, height: 0 },
        flexGrow: s.flexGrow ?? 0,
        flexShrink: s.flexShrink ?? 1,
        flexBasis: s.flexBasis ?? 'auto',
        alignSelf: s.alignSelf ?? 'auto',
        margin: normalizeSides(s.margin),
      };
    });
  }

  measure(ctx: CanvasRenderingContext2D): Size {
    const flexChildren = this.buildFlexChildren(ctx);
    // For measurement, override all properties that depend on container size:
    // - justifyContent → 'start' (prevents main-axis offset from center/end/space-*)
    // - alignItems → 'start' (prevents cross-axis inflation from stretch/center/end)
    // - alignSelf → 'start' (same, per-child)
    // - flexGrow → 0 (prevents main-axis inflation into free space)
    const measureConfig = {
      ...this.getFlexConfig(),
      justifyContent: 'start' as const,
      alignItems: 'start' as const,
    };
    const measureChildren = flexChildren.map((c) => ({
      ...c,
      flexGrow: 0,
      alignSelf: 'start' as const,
    }));
    const result = flexLayout({ width: 100000, height: 100000 }, measureConfig, measureChildren);
    return result.contentSize;
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    const layoutChildren = this.getLayoutChildren();
    const flexChildren = this.buildFlexChildren(ctx, layoutChildren);
    const result = flexLayout(
      { width: bounds.width, height: bounds.height },
      this.getFlexConfig(),
      flexChildren
    );

    this._layoutChildren = layoutChildren;
    this._cachedBounds = result.childBounds;
    this._cachedContainerBounds = bounds;

    const opacity = this.style.opacity ?? 1;
    if (opacity < 1) {
      ctx.save();
      ctx.globalAlpha *= opacity;
    }

    for (let i = 0; i < layoutChildren.length; i++) {
      const child = layoutChildren[i]!;
      const cb = result.childBounds[i]!;
      // Translate child bounds to absolute position
      child.render(ctx, {
        x: bounds.x + cb.x,
        y: bounds.y + cb.y,
        width: cb.width,
        height: cb.height,
      });
    }

    if (opacity < 1) {
      ctx.restore();
    }
  }

  hitTest(point: { x: number; y: number }, bounds: Bounds): CComponent | null {
    if (this.style.visible === false) return null;

    // Use cached bounds if available, otherwise can't hit test children
    if (!this._cachedBounds || !this._layoutChildren) return null;

    // Iterate back-to-front (last child is on top)
    for (let i = this._layoutChildren.length - 1; i >= 0; i--) {
      const child = this._layoutChildren[i]!;
      const cb = this._cachedBounds[i]!;
      const absBounds = {
        x: bounds.x + cb.x,
        y: bounds.y + cb.y,
        width: cb.width,
        height: cb.height,
      };
      const hit = child.hitTest(point, absBounds);
      if (hit) return hit;
    }

    return null;
  }

  /**
   * First CText bound to `__name__`, including suppressed name text.
   */
  findBoundNameText(): CText | undefined {
    for (const child of this._children) {
      if (isCText(child) && child.bindToProperty === '__name__') {
        return child;
      }
      if (isCContainer(child)) {
        const found = child.findBoundNameText();
        if (found) return found;
      }
      if (isCShape(child) && child.content) {
        const found = child.content.findBoundNameText();
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Find a component by id recursively.
   */
  findById(id: string): CComponent | undefined {
    for (const child of this._children) {
      if (child.id === id) return child;
      if (isCContainer(child)) {
        const found = child.findById(id);
        if (found) return found;
      }
      if (isCShape(child)) {
        // CShape has a content container — search recursively is handled in CShape
        const content = child.content;
        if (content) {
          const found = content.findById(id);
          if (found) return found;
        }
      }
    }
    return undefined;
  }

  serialize(): SerializedCComponent {
    const data: SerializedCComponent = {
      type: 'container',
      direction: this._direction,
      children: this._children.map((c) => c.serialize()),
    };
    if (this.id !== undefined) data.id = this.id;
    if (this.style && Object.keys(this.style).length > 0) data.style = this.style;
    if (this._justifyContent !== 'start') data.justifyContent = this._justifyContent;
    if (this._alignItems !== 'stretch') data.alignItems = this._alignItems;
    if (this._gap !== 0) data.gap = this._gap;
    if (
      (typeof this._padding === 'number' && this._padding !== 0) ||
      (typeof this._padding === 'object' &&
        Object.values(this._padding).some((v) => v !== undefined && v !== 0))
    ) {
      data.padding = this._padding;
    }
    return data;
  }

  toSVG(bounds: Bounds): string {
    if (this.style.visible === false) return '';

    // Use cached bounds from last render() for accurate layout
    const cachedBounds = this._cachedBounds;
    const cachedContainer = this._cachedContainerBounds;
    const layoutChildren = this._layoutChildren ?? this.getLayoutChildren();

    const childSvg = layoutChildren
      .map((child, i) => {
        if (cachedBounds && cachedContainer) {
          // Use cached layout — translate from cached container origin to export bounds
          const cb = cachedBounds[i]!;
          const dx = bounds.x - cachedContainer.x;
          const dy = bounds.y - cachedContainer.y;
          return child.toSVG({
            x: cachedContainer.x + cb.x + dx,
            y: cachedContainer.y + cb.y + dy,
            width: cb.width,
            height: cb.height,
          });
        }
        // Fallback: distribute evenly (no ctx available for proper layout)
        const h = bounds.height / Math.max(1, layoutChildren.length);
        return child.toSVG({
          x: bounds.x,
          y: bounds.y + i * h,
          width: bounds.width,
          height: h,
        });
      })
      .join('');

    return `<g>${childSvg}</g>`;
  }
}
