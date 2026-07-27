import type { Point } from '@/types';

export type Side = 'top' | 'right' | 'bottom' | 'left';

export type RouteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  id?: string;
};

export type RouteOrthogonalAroundInput = {
  from: Point;
  to: Point;
  fromDir: Side;
  toDir: Side;
  parent?: RouteRect;
  target?: RouteRect;
  margin?: number;
  exitDistance?: number;
};

const DEFAULT_MARGIN = 12;
const DEFAULT_EXIT = 20;

function expandRect(r: RouteRect, m: number): RouteRect {
  return { ...r, x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

function moveByDir(p: Point, dir: Side, d: number): Point {
  switch (dir) {
    case 'top':
      return { x: p.x, y: p.y - d };
    case 'bottom':
      return { x: p.x, y: p.y + d };
    case 'left':
      return { x: p.x - d, y: p.y };
    case 'right':
      return { x: p.x + d, y: p.y };
  }
}

function pointInRect(p: Point, r: RouteRect): boolean {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

/** Push along dir until outside expanded parent (and at least exitDistance). */
function computeStartExit(
  from: Point,
  fromDir: Side,
  parent: RouteRect | undefined,
  margin: number,
  exitDistance: number
): Point {
  let p = moveByDir(from, fromDir, exitDistance);
  if (!parent) return p;
  const expanded = expandRect(parent, margin);
  let guard = 0;
  while (pointInRect(p, expanded) && guard++ < 64) {
    p = moveByDir(p, fromDir, exitDistance);
  }
  if (pointInRect(p, expanded)) {
    const e = expanded;
    switch (fromDir) {
      case 'left':
        p = { x: e.x - 1, y: from.y };
        break;
      case 'right':
        p = { x: e.x + e.width + 1, y: from.y };
        break;
      case 'top':
        p = { x: from.x, y: e.y - 1 };
        break;
      case 'bottom':
        p = { x: from.x, y: e.y + e.height + 1 };
        break;
    }
  }
  return p;
}

function computeEndEntry(to: Point, toDir: Side, exitDistance: number): Point {
  return moveByDir(to, toDir, exitDistance);
}

function orthogonalConnect(a: Point, b: Point): Point[] {
  if (Math.abs(a.x - b.x) < 0.001 || Math.abs(a.y - b.y) < 0.001) return [a, b];
  return [a, { x: a.x, y: b.y }, b]; // temporary; Task 3 replaces with graph
}

function simplifyPath(path: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of path) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.001 || Math.abs(prev.y - p.y) > 0.001) out.push(p);
  }
  let i = 0;
  while (i + 2 < out.length) {
    const a = out[i]!;
    const b = out[i + 1]!;
    const c = out[i + 2]!;
    const colinear =
      (Math.abs(a.x - b.x) < 0.001 && Math.abs(b.x - c.x) < 0.001) ||
      (Math.abs(a.y - b.y) < 0.001 && Math.abs(b.y - c.y) < 0.001);
    if (colinear && i > 0 && i + 2 < out.length - 1) out.splice(i + 1, 1);
    else i++;
  }
  return out;
}

export function routeOrthogonalAround(input: RouteOrthogonalAroundInput): Point[] {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const exitDistance = input.exitDistance ?? DEFAULT_EXIT;
  const startExit = computeStartExit(
    input.from,
    input.fromDir,
    input.parent,
    margin,
    exitDistance
  );
  const endEntry = computeEndEntry(input.to, input.toDir, exitDistance);
  const mid = orthogonalConnect(startExit, endEntry).slice(1, -1);
  return simplifyPath([input.from, startExit, ...mid, endEntry, input.to]);
}
