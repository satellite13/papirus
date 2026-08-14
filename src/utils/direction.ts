export type Direction = 'top' | 'right' | 'bottom' | 'left' | undefined;

export type OutlineBounds = { width: number; height: number };

/**
 * Map outline param [0,1) to cardinal direction.
 *
 * When `bounds` are provided, uses the same perimeter walk as
 * `Node.getConnectionPointAtOutlineParam` (top → right → bottom → left).
 * Equal-quarter mapping is only a fallback for square-ish shapes / legacy callers —
 * on wide/short nodes it wrongly labels the left half of the bottom edge as `left`.
 */
export function getDirectionFromOutlineParam(
  param: number,
  bounds?: OutlineBounds
): Exclude<Direction, undefined> {
  const p = ((param % 1) + 1) % 1;
  const w = bounds?.width ?? 0;
  const h = bounds?.height ?? 0;
  if (w > 0 && h > 0) {
    const peri = 2 * (w + h);
    let s = p * peri;
    if (s < w) return 'top';
    s -= w;
    if (s < h) return 'right';
    s -= h;
    if (s < w) return 'bottom';
    return 'left';
  }
  if (p < 0.25) return 'top';
  if (p < 0.5) return 'right';
  if (p < 0.75) return 'bottom';
  return 'left';
}

/** Snap a vector to a cardinal side (Y-down canvas). */
export function directionFromDelta(dx: number, dy: number): Exclude<Direction, undefined> {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

export function isHorizontal(dir?: string): boolean {
  return dir === 'left' || dir === 'right';
}

export function isVertical(dir?: string): boolean {
  return dir === 'top' || dir === 'bottom';
}

export function isOppositeDirections(fromDir?: string, toDir?: string): boolean {
  return (
    (fromDir === 'left' && toDir === 'right') ||
    (fromDir === 'right' && toDir === 'left') ||
    (fromDir === 'top' && toDir === 'bottom') ||
    (fromDir === 'bottom' && toDir === 'top')
  );
}

export function directionToVector(dir?: string): { x: number; y: number } {
  switch (dir) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}
