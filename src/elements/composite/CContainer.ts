import type { Bounds, Size } from '@/types';
import {
  normalizeSides,
  type CComponent,
  type CComponentStyle,
  type SerializedCComponent,
  type SidesConfig,
} from './CComponent';
import { flexLayout, type FlexChild, type FlexConfig } from './FlexLayout';

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
export class CContainer implements CComponent {
  readonly type = 'container' as const;
  readonly id?: string;
  style: CComponentStyle;

  private _direction: 'row' | 'column';
  private _justifyContent: FlexConfig['justifyContent'];
  private _alignItems: FlexConfig['alignItems'];
  private _gap: number;
  private _padding: number | SidesConfig;
  private _children: CComponent[];
  private _onChange?: () => void;

  // Cached layout results (invalidated on change)
  private _cachedBounds: Bounds[] | null = null;

  constructor(options: CContainerOptions = {}) {
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

  setOnChange(cb: (() => void) | undefined): void {
    this._onChange = cb;
  }

  private handleChildChange(): void {
    this._cachedBounds = null;
    this._onChange?.();
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

  private buildFlexChildren(ctx: CanvasRenderingContext2D): FlexChild[] {
    return this._children.map((child) => {
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
    // Layout at infinite size to get natural content size
    const result = flexLayout(
      { width: 100000, height: 100000 },
      this.getFlexConfig(),
      flexChildren
    );
    return result.contentSize;
  }

  render(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    if (this.style.visible === false) return;

    const flexChildren = this.buildFlexChildren(ctx);
    const result = flexLayout(
      { width: bounds.width, height: bounds.height },
      this.getFlexConfig(),
      flexChildren
    );

    this._cachedBounds = result.childBounds;

    const opacity = this.style.opacity ?? 1;
    if (opacity < 1) {
      ctx.save();
      ctx.globalAlpha *= opacity;
    }

    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i]!;
      if (child.style.visible === false) continue;
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

  hitTest(
    point: { x: number; y: number },
    bounds: Bounds
  ): CComponent | null {
    if (this.style.visible === false) return null;

    // Use cached bounds if available, otherwise can't hit test children
    if (!this._cachedBounds) return null;

    // Iterate back-to-front (last child is on top)
    for (let i = this._children.length - 1; i >= 0; i--) {
      const child = this._children[i]!;
      if (child.style.visible === false) continue;
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
   * Find a component by id recursively.
   */
  findById(id: string): CComponent | undefined {
    for (const child of this._children) {
      if (child.id === id) return child;
      if (child.type === 'container') {
        const found = (child as CContainer).findById(id);
        if (found) return found;
      }
      if (child.type === 'shape') {
        // CShape has a content container — search recursively is handled in CShape
        const content = (child as { content?: CContainer }).content;
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

    const flexChildren: FlexChild[] = this._children.map((child) => {
      const s = child.style;
      // For SVG export, we need a measurement context — use a fallback size
      return {
        measure: { width: 50, height: 20 }, // approximate; real measurement needs ctx
        minSize: { width: 0, height: 0 },
        flexGrow: s.flexGrow ?? 0,
        flexShrink: s.flexShrink ?? 1,
        flexBasis: s.flexBasis ?? 'auto',
        alignSelf: s.alignSelf ?? 'auto',
        margin: normalizeSides(s.margin),
      };
    });

    const result = flexLayout(
      { width: bounds.width, height: bounds.height },
      this.getFlexConfig(),
      flexChildren
    );

    const childSvg = this._children
      .map((child, i) => {
        const cb = result.childBounds[i]!;
        return child.toSVG({
          x: bounds.x + cb.x,
          y: bounds.y + cb.y,
          width: cb.width,
          height: cb.height,
        });
      })
      .join('');

    return `<g>${childSvg}</g>`;
  }
}
