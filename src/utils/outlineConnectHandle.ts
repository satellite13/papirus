import type { Bounds, Point } from '@/types';

export type OutlineSide = 'top' | 'right' | 'bottom' | 'left';

/** World offset of the outline connect handle from the contour at zoom 1. */
export const OUTLINE_CONNECT_HANDLE_OFFSET = 0;

/** Extra world distance (zoom 1) before the handle may jump to another side. */
export const OUTLINE_CONNECT_HANDLE_HYSTERESIS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function closestPointOnRectSide(bounds: Bounds, side: OutlineSide, pointer: Point): Point {
  const { x, y, width, height } = bounds;
  switch (side) {
    case 'top':
      return { x: clamp(pointer.x, x, x + width), y };
    case 'bottom':
      return { x: clamp(pointer.x, x, x + width), y: y + height };
    case 'left':
      return { x, y: clamp(pointer.y, y, y + height) };
    case 'right':
      return { x: x + width, y: clamp(pointer.y, y, y + height) };
  }
}

export function closestPointOnRectOutline(
  bounds: Bounds,
  pointer: Point
): { side: OutlineSide; point: Point } {
  const sides: OutlineSide[] = ['top', 'right', 'bottom', 'left'];
  let side = sides[0]!;
  let point = closestPointOnRectSide(bounds, side, pointer);
  let best = dist(pointer, point);
  for (let i = 1; i < sides.length; i++) {
    const nextSide = sides[i]!;
    const nextPoint = closestPointOnRectSide(bounds, nextSide, pointer);
    const nextDist = dist(pointer, nextPoint);
    if (nextDist < best) {
      side = nextSide;
      point = nextPoint;
      best = nextDist;
    }
  }
  return { side, point };
}

export function nearestOutlineSide(bounds: Bounds, point: Point): OutlineSide {
  return closestPointOnRectOutline(bounds, point).side;
}

export function getOutlineConnectHandle(
  bounds: Bounds,
  pointer: Point,
  offset: number,
  prevSide?: OutlineSide | null,
  hysteresis: number = OUTLINE_CONNECT_HANDLE_HYSTERESIS
): { side: OutlineSide; attach: Point; handle: Point } {
  const closest = closestPointOnRectOutline(bounds, pointer);
  let side = closest.side;
  let attach = closest.point;
  if (prevSide && prevSide !== closest.side) {
    const stay = closestPointOnRectSide(bounds, prevSide, pointer);
    if (dist(pointer, stay) <= dist(pointer, closest.point) + hysteresis) {
      side = prevSide;
      attach = stay;
    }
  }
  if (offset === 0) {
    return { side, attach, handle: attach };
  }
  const outward: Record<OutlineSide, Point> = {
    top: { x: 0, y: -offset },
    right: { x: offset, y: 0 },
    bottom: { x: 0, y: offset },
    left: { x: -offset, y: 0 },
  };
  const delta = outward[side];
  return {
    side,
    attach,
    handle: { x: attach.x + delta.x, y: attach.y + delta.y },
  };
}
