import type { Bounds, LabelPlacement, Size } from '@/types';
import { pointInRect, rectUnion } from '@/utils/geometry';

export const DEFAULT_LABEL_GAP = 4;
export const MIN_EXTERNAL_LABEL_WRAP_WIDTH = 80;

export type ExternalLabelPlacement = 'top' | 'bottom' | 'left' | 'right';

export function isExternalLabelPlacement(
  placement?: LabelPlacement
): placement is ExternalLabelPlacement {
  return (
    placement === 'top' ||
    placement === 'bottom' ||
    placement === 'left' ||
    placement === 'right'
  );
}

export function externalLabelWrapWidth(shapeWidth: number): number {
  return Math.max(shapeWidth, MIN_EXTERNAL_LABEL_WRAP_WIDTH);
}

export function resolveExternalLabelBounds(
  shape: Bounds,
  placement: ExternalLabelPlacement,
  gap: number,
  measured: Size
): Bounds {
  const width = Math.max(0, measured.width);
  const height = Math.max(0, measured.height);
  const safeGap = Number.isFinite(gap) ? gap : DEFAULT_LABEL_GAP;

  switch (placement) {
    case 'top':
      return {
        x: shape.x + (shape.width - width) / 2,
        y: shape.y - safeGap - height,
        width,
        height,
      };
    case 'bottom':
      return {
        x: shape.x + (shape.width - width) / 2,
        y: shape.y + shape.height + safeGap,
        width,
        height,
      };
    case 'left':
      return {
        x: shape.x - safeGap - width,
        y: shape.y + (shape.height - height) / 2,
        width,
        height,
      };
    case 'right':
      return {
        x: shape.x + shape.width + safeGap,
        y: shape.y + (shape.height - height) / 2,
        width,
        height,
      };
  }
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return rectUnion(a, b);
}

export function pointInBounds(
  point: { x: number; y: number },
  bounds: Bounds
): boolean {
  return pointInRect(point, bounds);
}
