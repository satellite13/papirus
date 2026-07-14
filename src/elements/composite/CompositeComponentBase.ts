import type { Bounds } from '@/types';
import type { CComponent, CComponentStyle } from './CComponent';

/**
 * Shared change notification and default bounds hit testing for composite components.
 */
export abstract class CompositeComponentBase implements CComponent {
  abstract readonly type: CComponent['type'];
  abstract readonly id?: string;
  abstract style: CComponentStyle;

  protected _onChange?: () => void;

  setOnChange(cb: (() => void) | undefined): void {
    this._onChange = cb;
  }

  hitTest(point: { x: number; y: number }, bounds: Bounds): CComponent | null {
    if (this.style.visible === false) return null;

    return point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
      ? this
      : null;
  }

  protected markChanged(): void {
    this._onChange?.();
  }

  abstract measure(ctx: CanvasRenderingContext2D): { width: number; height: number };
  abstract render(ctx: CanvasRenderingContext2D, bounds: Bounds): void;
  abstract serialize(): ReturnType<CComponent['serialize']>;
  abstract toSVG(bounds: Bounds): string;
}
