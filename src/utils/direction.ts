export type Direction = 'top' | 'right' | 'bottom' | 'left' | undefined;

/**
 * Map outline param [0,1) to cardinal direction (top → right → bottom → left).
 */
export function getDirectionFromOutlineParam(param: number): Exclude<Direction, undefined> {
  const p = ((param % 1) + 1) % 1;
  if (p < 0.25) return 'top';
  if (p < 0.5) return 'right';
  if (p < 0.75) return 'bottom';
  return 'left';
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
