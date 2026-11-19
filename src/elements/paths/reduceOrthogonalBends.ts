import type { Point } from '@/types';
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

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

/** `countBends` treats a 180° turn as no bend, so the cost alone would accept it. */
function hasReversal(chain: readonly Point[]): boolean {
  let prevDx = 0;
  let prevDy = 0;
  for (let i = 1; i < chain.length; i++) {
    const dx = chain[i]!.x - chain[i - 1]!.x;
    const dy = chain[i]!.y - chain[i - 1]!.y;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue;
    if (prevDx * dx + prevDy * dy < 0) return true;
    prevDx = dx;
    prevDy = dy;
  }
  return false;
}

/** Drops pass-through vertices only; a U-turn vertex is kept so stubs never flip direction. */
function collapseStraightRuns(path: readonly Point[]): Point[] {
  const out: Point[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = path[i]!;
    const next = path[i + 1]!;
    const inX = cur.x - prev.x;
    const inY = cur.y - prev.y;
    const outX = next.x - cur.x;
    const outY = next.y - cur.y;
    const colinear = Math.abs(inX * outY - inY * outX) < EPS;
    if (colinear && inX * outX + inY * outY > 0) continue;
    out.push(cur);
  }
  out.push(path[path.length - 1]!);
  return out;
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
        if (hasReversal([path[i - 1]!, a, ...bridge, b, path[j + 1]!])) continue;
        const tail = samePoint(a, b) ? path.slice(j + 1) : path.slice(j);
        const candidate = [...path.slice(0, i + 1), ...bridge, ...tail];
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
 * `orthogonalRouteCost` without crossing obstacles or turning back. The first
 * and last segments keep their direction and can only grow (when a neighbour
 * ends up on the same axis and merges into them).
 */
export function reduceOrthogonalBends(path: Point[], obstacles: RouteRect[]): Point[] {
  if (path.length <= 3 || !isOrthogonal(path)) return path;
  let current = dedupe(path);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const improved = improveOnce(current, obstacles);
    if (!improved) break;
    current = improved;
  }
  return collapseStraightRuns(dedupe(current));
}
