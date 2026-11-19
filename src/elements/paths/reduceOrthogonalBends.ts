import type { Point } from '@/types';
import { collapseColinearPoints } from '@/utils/orthogonalSegmentDrag';
import { orthogonalRouteCost } from './routeCost';
import { segmentIntersectsOpenInterior, type RouteRect } from './routeOrthogonalAround';

const MAX_PASSES = 8;
const EPS = 0.001;

function isOrthogonal(path: readonly Point[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (Math.abs(a.x - b.x) >= EPS && Math.abs(a.y - b.y) >= EPS) return false;
  }
  return true;
}

function dedupe(path: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of path) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) >= EPS || Math.abs(prev.y - p.y) >= EPS) {
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

function bridges(a: Point, b: Point): Point[][] {
  if (Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS) return [[]];
  return [[{ x: a.x, y: b.y }], [{ x: b.x, y: a.y }]];
}

function bridgeHits(chain: readonly Point[], obstacles: readonly RouteRect[]): boolean {
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]!;
    const b = chain[i]!;
    if (obstacles.some((o) => segmentIntersectsOpenInterior(a, b, o))) return true;
  }
  return false;
}

function improveOnce(path: Point[], obstacles: readonly RouteRect[]): Point[] | null {
  const n = path.length;
  let best: Point[] | null = null;
  let bestCost = orthogonalRouteCost(path);
  for (let i = 1; i <= n - 4; i++) {
    for (let j = i + 2; j <= n - 2; j++) {
      const a = path[i]!;
      const b = path[j]!;
      for (const bridge of bridges(a, b)) {
        if (bridgeHits([a, ...bridge, b], obstacles)) continue;
        const candidate = [...path.slice(0, i + 1), ...bridge, ...path.slice(j)];
        const cost = orthogonalRouteCost(candidate);
        if (cost < bestCost - EPS) {
          best = candidate;
          bestCost = cost;
        }
      }
    }
  }
  return best;
}

/**
 * Replaces interior sub-chains with a straight run or an L when that lowers
 * `orthogonalRouteCost` without crossing obstacles. `path[0..1]` and
 * `path[n-2..n-1]` stay in place, so the end directions are preserved.
 */
export function reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[] {
  if (path.length <= 3 || !isOrthogonal(path)) return path;
  let current = dedupe(path);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const improved = improveOnce(current, obstacles);
    if (!improved) break;
    current = improved;
  }
  return collapseColinearPoints(current, EPS);
}
