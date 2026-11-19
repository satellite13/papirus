import type { Point } from '@/types';

export const ROUTE_BEND_COST = 160;

const EPS = 0.001;

type Axis = 'h' | 'v';

function segmentAxis(a: Point, b: Point): Axis | null {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx < EPS && dy < EPS) return null;
  if (dy < EPS) return 'h';
  if (dx < EPS) return 'v';
  return null;
}

export function countBends(path: readonly Point[]): number {
  let bends = 0;
  let prev: Axis | null = null;
  for (let i = 1; i < path.length; i++) {
    const axis = segmentAxis(path[i - 1]!, path[i]!);
    if (!axis) continue;
    if (prev && axis !== prev) bends++;
    prev = axis;
  }
  return bends;
}

export function orthogonalRouteCost(path: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y);
  }
  return length + countBends(path) * ROUTE_BEND_COST;
}
