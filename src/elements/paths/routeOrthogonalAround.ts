import type { Point } from '@/types';
import { DEFAULT_END_STUB, END_STUB_FACING_START_MIN } from '@/constants';
import { ROUTE_BEND_COST, orthogonalRouteCost } from './routeCost';
import { MinHeap } from './minHeap';

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
  /** Containing container around the source (route around it). */
  parent?: RouteRect;
  /** Source node owning `from` — avoid re-entering after exit. */
  source?: RouteRect;
  target?: RouteRect;
  /**
   * Sibling / other nodes to avoid (e.g. stack mates inside a container).
   * Not used as exit blockers — only as mid-path obstacles.
   */
  others?: RouteRect[];
  margin?: number;
  exitDistance?: number;
  /** Stub before `to` when the route turns there; default DEFAULT_END_STUB. */
  endStubLength?: number;
};

const DEFAULT_MARGIN = 12;
const DEFAULT_EXIT = 20;
/** Prefer mid-gap over hugging obstacle borders among routes with equal bends. */
const CONTOUR_BAND = 18;
/** Tie-breaker only: an 800 px hug costs one bend. */
const CONTOUR_COST_PER_PX = 0.2;

type Axis = 'h' | 'v';

function axisOf(side: Side): Axis {
  return side === 'left' || side === 'right' ? 'h' : 'v';
}

function expandRect(r: RouteRect, m: number): RouteRect {
  return { ...r, x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

/**
 * Diagram padding + router margin can seal a real visual gap between stacked nodes
 * (e.g. ArchiMate BP header above a Product ~12px apart, 8px pad each side).
 * Shrink facing sides of the expanded rects so a mid-gap corridor stays open.
 */
export function preserveFacingGap(
  expandedA: RouteRect,
  expandedB: RouteRect,
  rawA: RouteRect,
  rawB: RouteRect,
  minCorridor = 2
): [RouteRect, RouteRect] {
  let a = { ...expandedA };
  let b = { ...expandedB };

  const gapAAboveB = rawB.y - (rawA.y + rawA.height);
  if (gapAAboveB >= minCorridor) {
    const mid = (rawA.y + rawA.height + rawB.y) / 2;
    const half = minCorridor / 2;
    const aBottom = mid - half;
    const bTop = mid + half;
    if (a.y + a.height > aBottom) a = { ...a, height: Math.max(0, aBottom - a.y) };
    if (b.y < bTop) b = { ...b, height: Math.max(0, b.y + b.height - bTop), y: bTop };
    return [a, b];
  }

  const gapBAboveA = rawA.y - (rawB.y + rawB.height);
  if (gapBAboveA >= minCorridor) {
    const mid = (rawB.y + rawB.height + rawA.y) / 2;
    const half = minCorridor / 2;
    const bBottom = mid - half;
    const aTop = mid + half;
    if (b.y + b.height > bBottom) b = { ...b, height: Math.max(0, bBottom - b.y) };
    if (a.y < aTop) a = { ...a, height: Math.max(0, a.y + a.height - aTop), y: aTop };
    return [a, b];
  }

  const gapALeftOfB = rawB.x - (rawA.x + rawA.width);
  if (gapALeftOfB >= minCorridor) {
    const mid = (rawA.x + rawA.width + rawB.x) / 2;
    const half = minCorridor / 2;
    const aRight = mid - half;
    const bLeft = mid + half;
    if (a.x + a.width > aRight) a = { ...a, width: Math.max(0, aRight - a.x) };
    if (b.x < bLeft) b = { ...b, width: Math.max(0, b.x + b.width - bLeft), x: bLeft };
    return [a, b];
  }

  const gapBLeftOfA = rawA.x - (rawB.x + rawB.width);
  if (gapBLeftOfA >= minCorridor) {
    const mid = (rawB.x + rawB.width + rawA.x) / 2;
    const half = minCorridor / 2;
    const bRight = mid - half;
    const aLeft = mid + half;
    if (b.x + b.width > bRight) b = { ...b, width: Math.max(0, bRight - b.x) };
    if (a.x < aLeft) a = { ...a, width: Math.max(0, a.x + a.width - aLeft), x: aLeft };
    return [a, b];
  }

  return [a, b];
}

function insetRect(r: RouteRect, m: number): RouteRect | null {
  if (m <= 0) return r;
  const width = r.width - 2 * m;
  const height = r.height - 2 * m;
  if (width <= 1 || height <= 1) return null;
  return { ...r, x: r.x + m, y: r.y + m, width, height };
}

/** Midline of a positive gap between two raw rects, if any. */
export function facingGapMid(rawA: RouteRect, rawB: RouteRect): Point | null {
  if (rawA.y + rawA.height < rawB.y) {
    return {
      x: (rawA.x + rawA.width / 2 + rawB.x + rawB.width / 2) / 2,
      y: (rawA.y + rawA.height + rawB.y) / 2,
    };
  }
  if (rawB.y + rawB.height < rawA.y) {
    return {
      x: (rawA.x + rawA.width / 2 + rawB.x + rawB.width / 2) / 2,
      y: (rawB.y + rawB.height + rawA.y) / 2,
    };
  }
  if (rawA.x + rawA.width < rawB.x) {
    return {
      x: (rawA.x + rawA.width + rawB.x) / 2,
      y: (rawA.y + rawA.height / 2 + rawB.y + rawB.height / 2) / 2,
    };
  }
  if (rawB.x + rawB.width < rawA.x) {
    return {
      x: (rawB.x + rawB.width + rawA.x) / 2,
      y: (rawA.y + rawA.height / 2 + rawB.y + rawB.height / 2) / 2,
    };
  }
  return null;
}

/**
 * Obstacles arrive pre-padded (diagram pad 4–8). Peel common pad amounts so a
 * real visual gap between stacked nodes is visible to corridor / endEntry logic.
 */
export function peelForFacingGap(
  a: RouteRect,
  b: RouteRect
): { a: RouteRect; b: RouteRect } | null {
  for (const peel of [0, 4, 8]) {
    const aa = insetRect(a, peel);
    const bb = insetRect(b, peel);
    if (!aa || !bb) continue;
    if (facingGapMid(aa, bb)) return { a: aa, b: bb };
  }
  return null;
}

/** Clearance between two peeled rects on their facing axis (0 if overlapping/touching). */
export function facingGapSize(a: RouteRect, b: RouteRect): number {
  if (a.y + a.height < b.y) return b.y - (a.y + a.height);
  if (b.y + b.height < a.y) return a.y - (b.y + b.height);
  if (a.x + a.width < b.x) return b.x - (a.x + a.width);
  if (b.x + b.width < a.x) return a.x - (b.x + b.width);
  return 0;
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

function pointInOpenInterior(p: Point, r: RouteRect): boolean {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}

/** Axis-aligned segment vs open interior of a rect (boundary grazing allowed). */
export function segmentIntersectsOpenInterior(a: Point, b: Point, r: RouteRect): boolean {
  if (Math.abs(a.x - b.x) < 0.001) {
    const x = a.x;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    return x > r.x && x < r.x + r.width && y2 > r.y && y1 < r.y + r.height;
  }
  if (Math.abs(a.y - b.y) < 0.001) {
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    return y > r.y && y < r.y + r.height && x2 > r.x && x1 < r.x + r.width;
  }
  return true;
}

function segmentHitsObstacles(a: Point, b: Point, obstacles: RouteRect[]): boolean {
  return obstacles.some((o) => segmentIntersectsOpenInterior(a, b, o));
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Extra cost when a segment runs parallel to an obstacle edge inside CONTOUR_BAND.
 * Scaled by segment length; kept below a bend for realistic lengths.
 */
export function contourProximityPenalty(a: Point, b: Point, obstacles: RouteRect[]): number {
  if (obstacles.length === 0) return 0;
  const segLen = manhattan(a, b);
  if (segLen < 1) return 0;
  let minDist = Infinity;
  if (Math.abs(a.y - b.y) < 0.001) {
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    for (const o of obstacles) {
      // Only count edges the segment actually runs alongside (x-overlap).
      if (x2 < o.x - 1 || x1 > o.x + o.width + 1) continue;
      minDist = Math.min(minDist, Math.abs(y - o.y), Math.abs(y - (o.y + o.height)));
    }
  } else if (Math.abs(a.x - b.x) < 0.001) {
    const x = a.x;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    for (const o of obstacles) {
      if (y2 < o.y - 1 || y1 > o.y + o.height + 1) continue;
      minDist = Math.min(minDist, Math.abs(x - o.x), Math.abs(x - (o.x + o.width)));
    }
  } else {
    return 0;
  }
  if (!Number.isFinite(minDist) || minDist >= CONTOUR_BAND) return 0;
  const proximity = 1 - minDist / CONTOUR_BAND;
  return segLen * CONTOUR_COST_PER_PX * proximity;
}

/** Push along dir until outside expanded blocker (and at least exitDistance). */
function computeStartExit(
  from: Point,
  fromDir: Side,
  blocker: RouteRect | undefined,
  margin: number,
  exitDistance: number
): Point {
  let p = moveByDir(from, fromDir, exitDistance);
  if (!blocker) return p;
  const expanded = expandRect(blocker, margin);
  let guard = 0;
  while (pointInOpenInterior(p, expanded) && guard++ < 64) {
    p = moveByDir(p, fromDir, exitDistance);
  }
  if (pointInOpenInterior(p, expanded)) {
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

function pointInRectClosed(p: Point, r: RouteRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/**
 * Push a same-side exit/entry far enough that the orthogonal span between
 * `spanA` and `spanB` clears every `others` obstacle (siblings in a stack).
 */
function clearCorridorOfOthers(
  exit: Point,
  dir: Side,
  others: RouteRect[],
  spanA: Point,
  spanB: Point,
  margin: number
): Point {
  if (others.length === 0) return exit;
  let p = { ...exit };
  const y1 = Math.min(spanA.y, spanB.y);
  const y2 = Math.max(spanA.y, spanB.y);
  const x1 = Math.min(spanA.x, spanB.x);
  const x2 = Math.max(spanA.x, spanB.x);

  for (let guard = 0; guard < 64; guard++) {
    let blocked: RouteRect | undefined;
    for (const raw of others) {
      const o = expandRect(raw, margin);
      if (dir === 'left' || dir === 'right') {
        // Vertical corridor at p.x across [y1,y2]
        if (p.x > o.x && p.x < o.x + o.width && y2 > o.y && y1 < o.y + o.height) {
          blocked = o;
          break;
        }
      } else {
        // Horizontal corridor at p.y across [x1,x2]
        if (p.y > o.y && p.y < o.y + o.height && x2 > o.x && x1 < o.x + o.width) {
          blocked = o;
          break;
        }
      }
    }
    if (!blocked) return p;
    switch (dir) {
      case 'left':
        p = { x: blocked.x - 1, y: p.y };
        break;
      case 'right':
        p = { x: blocked.x + blocked.width + 1, y: p.y };
        break;
      case 'top':
        p = { x: p.x, y: blocked.y - 1 };
        break;
      case 'bottom':
        p = { x: p.x, y: blocked.y + blocked.height + 1 };
        break;
    }
  }
  return p;
}

/**
 * When same-side exits still share an axis that crosses a blocker (top→top over
 * a stacked target), slide the *start* exit to the nearer free side. Keep
 * endEntry on the approach ray at `to` so the final stub stays ⊥ to the side.
 */
function offsetSameSideAroundBlockers(
  startExit: Point,
  endEntry: Point,
  dir: Side,
  blockers: RouteRect[],
  margin: number,
  from: Point,
  to: Point
): { startExit: Point; endEntry: Point } {
  if (blockers.length === 0) return { startExit, endEntry };
  let s = { ...startExit };
  const e = { ...endEntry };
  const y1 = Math.min(from.y, to.y, s.y, e.y);
  const y2 = Math.max(from.y, to.y, s.y, e.y);
  const x1 = Math.min(from.x, to.x, s.x, e.x);
  const x2 = Math.max(from.x, to.x, s.x, e.x);

  for (const raw of blockers) {
    const o = expandRect(raw, margin);
    if (dir === 'top' || dir === 'bottom') {
      const crosses =
        s.x > o.x && s.x < o.x + o.width && y2 > o.y && y1 < o.y + o.height;
      if (!crosses) continue;
      const leftX = o.x - 1;
      const rightX = o.x + o.width + 1;
      s = { ...s, x: s.x <= o.x + o.width / 2 ? leftX : rightX };
    } else {
      const crosses =
        s.y > o.y && s.y < o.y + o.height && x2 > o.x && x1 < o.x + o.width;
      if (!crosses) continue;
      const topY = o.y - 1;
      const bottomY = o.y + o.height + 1;
      s = { ...s, y: s.y <= o.y + o.height / 2 ? topY : bottomY };
    }
  }
  return { startExit: s, endEntry: e };
}

/** True when collapsing same-side exits onto one rail would not pierce blockers. */
function canAlignSameSideExits(
  dir: Side,
  startExit: Point,
  endEntry: Point,
  from: Point,
  to: Point,
  blockers: RouteRect[],
  margin: number
): boolean {
  let alignedStart = { ...startExit };
  let alignedEnd = { ...endEntry };
  if (dir === 'left') {
    const x = Math.min(startExit.x, endEntry.x);
    alignedStart = { ...alignedStart, x };
    alignedEnd = { ...alignedEnd, x };
  } else if (dir === 'right') {
    const x = Math.max(startExit.x, endEntry.x);
    alignedStart = { ...alignedStart, x };
    alignedEnd = { ...alignedEnd, x };
  } else if (dir === 'top') {
    const y = Math.min(startExit.y, endEntry.y);
    alignedStart = { ...alignedStart, y };
    alignedEnd = { ...alignedEnd, y };
  } else {
    const y = Math.max(startExit.y, endEntry.y);
    alignedStart = { ...alignedStart, y };
    alignedEnd = { ...alignedEnd, y };
  }

  for (const raw of blockers) {
    const o = expandRect(raw, margin);
    if (segmentIntersectsOpenInterior(from, alignedStart, o)) return false;
    if (segmentIntersectsOpenInterior(alignedEnd, to, o)) return false;
    if (segmentIntersectsOpenInterior(alignedStart, alignedEnd, o)) return false;
  }
  return true;
}

function computeEndEntry(
  to: Point,
  toDir: Side,
  endStubLength: number,
  rawTarget?: RouteRect,
  rawNeighbor?: RouteRect
): Point {
  const stub = moveByDir(to, toDir, endStubLength);
  if (!rawTarget || !rawNeighbor) return stub;

  // Prefer the visual mid-gap over a fixed stub when the approach faces a neighbor.
  // Keeps the long jog off the target contour (ArchiMate BP bottom above Product).
  const mid = facingGapMid(rawTarget, rawNeighbor);
  if (!mid) return stub;

  // Peel is symmetric, so mirroring `to` (on the target edge) across the mid-gap
  // gives the neighbor edge on the same footing.
  const meetY = (): number => endStubMeet(2 * mid.y - to.y, to.y, endStubLength);
  const meetX = (): number => endStubMeet(2 * mid.x - to.x, to.x, endStubLength);

  switch (toDir) {
    case 'bottom':
      if (mid.y > to.y && rawNeighbor.y >= rawTarget.y + rawTarget.height) {
        return { x: to.x, y: meetY() };
      }
      break;
    case 'top':
      if (mid.y < to.y && rawNeighbor.y + rawNeighbor.height <= rawTarget.y) {
        return { x: to.x, y: meetY() };
      }
      break;
    case 'right':
      if (mid.x > to.x && rawNeighbor.x >= rawTarget.x + rawTarget.width) {
        return { x: meetX(), y: to.y };
      }
      break;
    case 'left':
      if (mid.x < to.x && rawNeighbor.x + rawNeighbor.width <= rawTarget.x) {
        return { x: meetX(), y: to.y };
      }
      break;
  }
  return stub;
}

/**
 * Coordinate of the turn between facing endpoints on the approach axis.
 * Mid-gap when it leaves `endStubLength`; otherwise `endStubLength` before `to`
 * while the source side keeps END_STUB_FACING_START_MIN; else mid-gap (no loop back).
 */
export function endStubMeet(fromC: number, toC: number, endStubLength: number): number {
  const gap = Math.abs(toC - fromC);
  const mid = (fromC + toC) / 2;
  if (gap / 2 >= endStubLength) return mid;
  if (gap >= endStubLength + END_STUB_FACING_START_MIN) {
    return toC - Math.sign(toC - fromC) * endStubLength;
  }
  return mid;
}

/**
 * When nodes face each other closer than exitDistance + endStubLength, fixed stubs
 * cross (startExit past endEntry). That draws a U-turn "tail" at the first bend.
 * Meet both stubs on one line instead (see endStubMeet).
 */
export function clampFacingExitEntry(
  from: Point,
  to: Point,
  fromDir: Side,
  toDir: Side,
  startExit: Point,
  endEntry: Point,
  endStubLength: number = DEFAULT_END_STUB
): { startExit: Point; endEntry: Point } {
  if (fromDir === 'bottom' && toDir === 'top' && to.y > from.y && startExit.y > endEntry.y) {
    const y = endStubMeet(from.y, to.y, endStubLength);
    return { startExit: { x: startExit.x, y }, endEntry: { x: endEntry.x, y } };
  }
  if (fromDir === 'top' && toDir === 'bottom' && to.y < from.y && startExit.y < endEntry.y) {
    const y = endStubMeet(from.y, to.y, endStubLength);
    return { startExit: { x: startExit.x, y }, endEntry: { x: endEntry.x, y } };
  }
  if (fromDir === 'right' && toDir === 'left' && to.x > from.x && startExit.x > endEntry.x) {
    const x = endStubMeet(from.x, to.x, endStubLength);
    return { startExit: { x, y: startExit.y }, endEntry: { x, y: endEntry.y } };
  }
  if (fromDir === 'left' && toDir === 'right' && to.x < from.x && startExit.x < endEntry.x) {
    const x = endStubMeet(from.x, to.x, endStubLength);
    return { startExit: { x, y: startExit.y }, endEntry: { x, y: endEntry.y } };
  }
  return { startExit, endEntry };
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
    const colinearV = Math.abs(a.x - b.x) < 0.001 && Math.abs(b.x - c.x) < 0.001;
    const colinearH = Math.abs(a.y - b.y) < 0.001 && Math.abs(b.y - c.y) < 0.001;
    const colinear = colinearV || colinearH;
    // Drop overshoot vertex: A→B→C where C lies between A and B on the same axis.
    const uturn =
      (colinearV && ((a.y < c.y && c.y < b.y) || (b.y < c.y && c.y < a.y))) ||
      (colinearH && ((a.x < c.x && c.x < b.x) || (b.x < c.x && c.x < a.x)));
    // Drop entry/exit spur: A→B→C where A lies between B and C (B overshoots then returns).
    // e.g. (170,68)→(170,60)→(170,80) above a top port — the visible "хвостик".
    const spur =
      (colinearV && ((b.y < a.y && a.y < c.y) || (c.y < a.y && a.y < b.y))) ||
      (colinearH && ((b.x < a.x && a.x < c.x) || (c.x < a.x && a.x < b.x)));
    if (uturn || spur || (colinear && i > 0 && i + 2 < out.length - 1)) out.splice(i + 1, 1);
    else i++;
  }
  return out;
}

function unionBBox(obstacles: RouteRect[]): RouteRect {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const o of obstacles) {
    x1 = Math.min(x1, o.x);
    y1 = Math.min(y1, o.y);
    x2 = Math.max(x2, o.x + o.width);
    y2 = Math.max(y2, o.y + o.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function collectLatticeCoords(
  startExit: Point,
  endEntry: Point,
  obstacles: RouteRect[],
  parent?: RouteRect,
  target?: RouteRect,
  margin?: number
): { xs: number[]; ys: number[] } {
  const xSet = new Set<number>([startExit.x, endEntry.x]);
  const ySet = new Set<number>([startExit.y, endEntry.y]);

  for (const o of obstacles) {
    xSet.add(o.x);
    xSet.add(o.x + o.width);
    ySet.add(o.y);
    ySet.add(o.y + o.height);
    xSet.add(o.x - 1);
    xSet.add(o.x + o.width + 1);
    ySet.add(o.y - 1);
    ySet.add(o.y + o.height + 1);
  }

  // Gap midlines from raw parent/target (not re-expanded): padding must not hide the corridor.
  if (parent && target) {
    const addGapY = (gapY: number): void => {
      ySet.add(gapY);
      const left = Math.min(parent.x, target.x, startExit.x, endEntry.x);
      const right = Math.max(
        parent.x + parent.width,
        target.x + target.width,
        startExit.x,
        endEntry.x
      );
      xSet.add(left);
      xSet.add(right);
      xSet.add(startExit.x);
      xSet.add(endEntry.x);
    };

    const addGapX = (gapX: number): void => {
      xSet.add(gapX);
      const top = Math.min(parent.y, target.y, startExit.y, endEntry.y);
      const bottom = Math.max(
        parent.y + parent.height,
        target.y + target.height,
        startExit.y,
        endEntry.y
      );
      ySet.add(top);
      ySet.add(bottom);
      ySet.add(startExit.y);
      ySet.add(endEntry.y);
    };

    const mid = facingGapMid(parent, target);
    if (mid) {
      if (parent.y + parent.height < target.y || target.y + target.height < parent.y) {
        addGapY(mid.y);
      } else {
        addGapX(mid.x);
      }
    } else if (margin != null) {
      // Fallback: expanded faces when raw rects already touch/overlap.
      const ep = expandRect(parent, margin);
      const et = expandRect(target, margin);
      if (et.y + et.height < ep.y) addGapY((et.y + et.height + ep.y) / 2);
      if (ep.y + ep.height < et.y) addGapY((ep.y + ep.height + et.y) / 2);
      if (et.x + et.width < ep.x) addGapX((et.x + et.width + ep.x) / 2);
      if (ep.x + ep.width < et.x) addGapX((ep.x + ep.width + et.x) / 2);
    }
  }

  return {
    xs: [...xSet].sort((a, b) => a - b),
    ys: [...ySet].sort((a, b) => a - b),
  };
}

export type GraphEdge = { to: number; dir: 'h' | 'v'; length: number };

function buildCornerGraph(
  startExit: Point,
  endEntry: Point,
  obstacles: RouteRect[],
  parent?: RouteRect,
  target?: RouteRect,
  margin?: number
): { nodes: Point[]; edges: Map<number, GraphEdge[]>; startIdx: number; goalIdx: number } | null {
  const { xs, ys } = collectLatticeCoords(startExit, endEntry, obstacles, parent, target, margin);
  const nx = xs.length;
  const ny = ys.length;
  const xAt = new Map(xs.map((x, i) => [x, i]));
  const yAt = new Map(ys.map((y, i) => [y, i]));
  const cell = (ix: number, iy: number): number => ix * ny + iy;

  // Obstacle edges are lattice lines, so open-interior tests reduce to index ranges.
  // blockedV / blockedH mark the lattice step from a cell to its +y / +x neighbour.
  const blockedCell = new Uint8Array(nx * ny);
  const blockedV = new Uint8Array(nx * ny);
  const blockedH = new Uint8Array(nx * ny);
  for (const o of obstacles) {
    const x0 = xAt.get(o.x);
    const x1 = xAt.get(o.x + o.width);
    const y0 = yAt.get(o.y);
    const y1 = yAt.get(o.y + o.height);
    if (x0 === undefined || x1 === undefined || y0 === undefined || y1 === undefined) continue;
    for (let ix = x0 + 1; ix < x1; ix++) {
      for (let iy = y0 + 1; iy < y1; iy++) blockedCell[cell(ix, iy)] = 1;
      for (let iy = y0; iy < y1; iy++) blockedV[cell(ix, iy)] = 1;
    }
    for (let iy = y0 + 1; iy < y1; iy++) {
      for (let ix = x0; ix < x1; ix++) blockedH[cell(ix, iy)] = 1;
    }
  }

  const nodes: Point[] = [];
  const nodeAt = new Int32Array(nx * ny).fill(-1);
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      if (blockedCell[cell(ix, iy)]) continue;
      nodeAt[cell(ix, iy)] = nodes.length;
      nodes.push({ x: xs[ix]!, y: ys[iy]! });
    }
  }

  const nodeOf = (p: Point): number => {
    const ix = xAt.get(p.x);
    const iy = yAt.get(p.y);
    return ix === undefined || iy === undefined ? -1 : nodeAt[cell(ix, iy)]!;
  };
  const startIdx = nodeOf(startExit);
  const goalIdx = nodeOf(endEntry);
  if (startIdx < 0 || goalIdx < 0) return null;

  const edges = new Map<number, GraphEdge[]>();
  for (let i = 0; i < nodes.length; i++) edges.set(i, []);
  const link = (a: number, b: number, dir: 'h' | 'v', near: RouteRect[]): void => {
    const pa = nodes[a]!;
    const pb = nodes[b]!;
    const length = manhattan(pa, pb) + contourProximityPenalty(pa, pb, near);
    edges.get(a)!.push({ to: b, dir, length });
    edges.get(b)!.push({ to: a, dir, length });
  };
  const nearLine = (
    c: number,
    lo: (o: RouteRect) => number,
    size: (o: RouteRect) => number
  ): RouteRect[] =>
    obstacles.filter(
      (o) => Math.min(Math.abs(c - lo(o)), Math.abs(c - lo(o) - size(o))) < CONTOUR_BAND
    );

  for (let ix = 0; ix < nx; ix++) {
    const near = nearLine(
      xs[ix]!,
      (o) => o.x,
      (o) => o.width
    );
    for (let iy = 1; iy < ny; iy++) {
      const a = nodeAt[cell(ix, iy - 1)]!;
      const b = nodeAt[cell(ix, iy)]!;
      if (a >= 0 && b >= 0 && !blockedV[cell(ix, iy - 1)]) link(a, b, 'v', near);
    }
  }
  for (let iy = 0; iy < ny; iy++) {
    const near = nearLine(
      ys[iy]!,
      (o) => o.y,
      (o) => o.height
    );
    for (let ix = 1; ix < nx; ix++) {
      const a = nodeAt[cell(ix - 1, iy)]!;
      const b = nodeAt[cell(ix, iy)]!;
      if (a >= 0 && b >= 0 && !blockedH[cell(ix - 1, iy)]) link(a, b, 'h', near);
    }
  }

  return { nodes, edges, startIdx, goalIdx };
}

/**
 * Fewest axis changes along [dir, ...remaining edge axes, goalAxis] when the remaining
 * edges must move along `needH` / `needV`. A null end imposes nothing.
 */
function minRemainingBends(
  dir: Axis | null,
  needH: boolean,
  needV: boolean,
  goalAxis: Axis | null
): number {
  if (needH && needV) return dir !== null && dir === goalAxis ? 2 : 1;
  if (!needH && !needV) return 0;
  const axis: Axis = needH ? 'h' : 'v';
  return (dir !== null && dir !== axis ? 1 : 0) + (goalAxis !== null && goalAxis !== axis ? 1 : 0);
}

const AXIS_STATE: Record<Axis, number> = { h: 0, v: 1 };
const NO_AXIS_STATE = 2;

/** Signed directions of the stubs around the searched mid path. */
export type MidPathStubs = {
  /** Direction the start stub travels (`fromDir`): the first edge must not turn back. */
  startDir?: Side;
  /** Outward side at the target (`toDir`): the last edge must not move outward. */
  goalDir?: Side;
};

function sideDot(side: Side, dx: number, dy: number): number {
  switch (side) {
    case 'top':
      return -dy;
    case 'bottom':
      return dy;
    case 'left':
      return -dx;
    case 'right':
      return dx;
  }
}

/**
 * A* over the corner graph: edge length + ROUTE_BEND_COST per axis change, plus one
 * more when the last edge arrives across `goalAxis`. A null axis means "free".
 * Axis state alone makes a 180° turn at a stub free; `stubs` forbids it (ignored on
 * a free end).
 */
export function searchMidPath(
  nodes: Point[],
  edges: Map<number, GraphEdge[]>,
  startIdx: number,
  goalIdx: number,
  startAxis: Axis | null,
  goalAxis: Axis | null,
  stubs?: MidPathStubs
): Point[] | null {
  const goal = nodes[goalIdx]!;
  const startDir = startAxis !== null ? stubs?.startDir : undefined;
  const goalDir = goalAxis !== null ? stubs?.goalDir : undefined;
  const turnsBack = (from: number, to: number): boolean => {
    if (startDir === undefined && goalDir === undefined) return false;
    const a = nodes[from]!;
    const b = nodes[to]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (startDir !== undefined && from === startIdx && sideDot(startDir, dx, dy) < 0) return true;
    return goalDir !== undefined && to === goalIdx && sideDot(goalDir, dx, dy) > 0;
  };
  // Admissible and consistent: edges cost ≥ their Manhattan length, and every remaining
  // path needs at least minRemainingBends axis changes (the goal-axis surcharge counts as one).
  const heuristic = (node: number, dir: Axis | null): number => {
    const p = nodes[node]!;
    if (node === goalIdx) return 0;
    const bends = minRemainingBends(dir, p.x !== goal.x, p.y !== goal.y, goalAxis);
    return manhattan(p, goal) + bends * ROUTE_BEND_COST;
  };

  type QueueState = {
    state: number;
    node: number;
    dir: Axis | null;
    g: number;
    f: number;
    seq: number;
  };
  const stateCount = nodes.length * 3;
  const bestG = new Float64Array(stateCount).fill(Infinity);
  const prevState = new Int32Array(stateCount).fill(-1);
  const closed = new Uint8Array(stateCount);
  const open = new MinHeap<QueueState>((a, b) => a.f < b.f || (a.f === b.f && a.seq < b.seq));
  let seq = 0;

  const startState = startIdx * 3 + (startAxis ? AXIS_STATE[startAxis] : NO_AXIS_STATE);
  bestG[startState] = 0;
  open.push({
    state: startState,
    node: startIdx,
    dir: startAxis,
    g: 0,
    f: heuristic(startIdx, startAxis),
    seq: seq++,
  });

  let goalState = -1;
  while (open.size > 0) {
    const current = open.pop()!;
    if (closed[current.state]) continue;
    closed[current.state] = 1;
    if (current.node === goalIdx) {
      goalState = current.state;
      break;
    }

    for (const edge of edges.get(current.node) ?? []) {
      const nextDir = edge.dir;
      const nextState = edge.to * 3 + AXIS_STATE[nextDir];
      if (closed[nextState]) continue;
      if (turnsBack(current.node, edge.to)) continue;
      let stepCost = edge.length;
      if (current.dir !== null && current.dir !== nextDir) stepCost += ROUTE_BEND_COST;
      // Arriving across the entry axis means one more bend into the end stub.
      if (edge.to === goalIdx && goalAxis !== null && nextDir !== goalAxis) {
        stepCost += ROUTE_BEND_COST;
      }
      const nextG = current.g + stepCost;
      if (nextG >= bestG[nextState]!) continue;
      bestG[nextState] = nextG;
      prevState[nextState] = current.state;
      open.push({
        state: nextState,
        node: edge.to,
        dir: nextDir,
        g: nextG,
        f: nextG + heuristic(edge.to, nextDir),
        seq: seq++,
      });
    }
  }

  if (goalState < 0) return null;

  const path: Point[] = [];
  for (let s = goalState; s >= 0; s = prevState[s]!) {
    path.push(nodes[Math.floor(s / 3)]!);
  }
  return path.reverse();
}

function pathIsValid(path: Point[], obstacles: RouteRect[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (segmentHitsObstacles(path[i - 1]!, path[i]!, obstacles)) return false;
  }
  return true;
}

/** Always orthogonal: never emit a diagonal between startExit and endEntry. */
function orthogonalElbow(startExit: Point, endEntry: Point): Point[] {
  if (Math.abs(startExit.x - endEntry.x) < 0.001 || Math.abs(startExit.y - endEntry.y) < 0.001) {
    return [startExit, endEntry];
  }
  return [startExit, { x: startExit.x, y: endEntry.y }, endEntry];
}

function fallbackOuterRoute(
  from: Point,
  to: Point,
  startExit: Point,
  endEntry: Point,
  obstacles: RouteRect[]
): Point[] {
  if (obstacles.length === 0) {
    return orthogonalElbow(startExit, endEntry);
  }

  const u = unionBBox(obstacles);
  const pad = 1;
  const top = u.y - pad;
  const bottom = u.y + u.height + pad;
  const left = u.x - pad;
  const right = u.x + u.width + pad;

  const candidates: Point[][] = [
    [startExit, { x: startExit.x, y: top }, { x: endEntry.x, y: top }, endEntry],
    [startExit, { x: startExit.x, y: bottom }, { x: endEntry.x, y: bottom }, endEntry],
    [startExit, { x: left, y: startExit.y }, { x: left, y: endEntry.y }, endEntry],
    [startExit, { x: right, y: startExit.y }, { x: right, y: endEntry.y }, endEntry],
    // Simple elbows (prefer when outer rails are blocked)
    [startExit, { x: startExit.x, y: endEntry.y }, endEntry],
    [startExit, { x: endEntry.x, y: startExit.y }, endEntry],
  ];

  let best: Point[] | null = null;
  let bestCost = Infinity;
  for (const candidate of candidates) {
    const simplified = simplifyPath(candidate);
    if (!pathIsValid(simplified, obstacles)) continue;
    const cost = orthogonalRouteCost([from, ...simplified, to]);
    if (cost < bestCost) {
      bestCost = cost;
      best = simplified;
    }
  }
  // Last resort: orthogonal elbow even if it clips — never a diagonal.
  return best ?? orthogonalElbow(startExit, endEntry);
}

function routeMidPath(
  from: Point,
  to: Point,
  startExit: Point,
  endEntry: Point,
  startAxis: Axis,
  goalAxis: Axis,
  obstacles: RouteRect[],
  parent?: RouteRect,
  target?: RouteRect,
  margin?: number
): Point[] {
  if (Math.abs(startExit.x - endEntry.x) < 0.001 || Math.abs(startExit.y - endEntry.y) < 0.001) {
    const direct = [startExit, endEntry];
    if (pathIsValid(direct, obstacles)) return direct;
  }

  const graph = buildCornerGraph(startExit, endEntry, obstacles, parent, target, margin);
  if (graph) {
    const mid = searchMidPath(
      graph.nodes,
      graph.edges,
      graph.startIdx,
      graph.goalIdx,
      startAxis,
      goalAxis
    );
    if (mid && pathIsValid(mid, obstacles)) return mid;
  }

  return fallbackOuterRoute(from, to, startExit, endEntry, obstacles);
}

export function routeOrthogonalAround(input: RouteOrthogonalAroundInput): Point[] {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const exitDistance = input.exitDistance ?? DEFAULT_EXIT;
  const endStubLength = input.endStubLength ?? DEFAULT_END_STUB;
  const others = input.others ?? [];

  // Both endpoints inside parent → internal edge: stay in the container and dodge
  // siblings. Otherwise parent is a solid outer blocker (nested → outside target).
  const internalParent =
    !!input.parent &&
    pointInRectClosed(input.from, input.parent) &&
    pointInRectClosed(input.to, input.parent);

  // Clear the outer blocker first (container), else the source node itself.
  const exitBlocker = internalParent ? input.source : (input.parent ?? input.source);
  let rawStartExit = computeStartExit(input.from, input.fromDir, exitBlocker, margin, exitDistance);
  const gapNeighbor = internalParent ? input.source : (input.parent ?? input.source);
  const peeledTargetNeighbor =
    input.target && gapNeighbor ? peelForFacingGap(input.target, gapNeighbor) : null;

  // Park the approach on the visual mid-gap so the long jog is not glued to the target.
  let rawEndEntry = computeEndEntry(
    input.to,
    input.toDir,
    endStubLength,
    peeledTargetNeighbor?.a,
    peeledTargetNeighbor?.b
  );
  // Mid-gap ignores siblings: one standing in the gap would swallow the entry point.
  if (
    others.some((o) => segmentIntersectsOpenInterior(rawEndEntry, input.to, expandRect(o, margin)))
  ) {
    rawEndEntry = computeEndEntry(input.to, input.toDir, endStubLength);
  }

  // Same-side elbows (left→left / top→top): clear siblings AND the target/source
  // so a wrap does not drop a straight segment through an endpoint node.
  if (input.fromDir === input.toDir) {
    const sameSideBlockers: RouteRect[] = [...others];
    if (input.target) sameSideBlockers.push(input.target);
    if (input.source) sameSideBlockers.push(input.source);

    if (sameSideBlockers.length > 0) {
      rawStartExit = clearCorridorOfOthers(
        rawStartExit,
        input.fromDir,
        sameSideBlockers,
        input.from,
        input.to,
        margin
      );
      rawEndEntry = clearCorridorOfOthers(
        rawEndEntry,
        input.toDir,
        sameSideBlockers,
        input.from,
        input.to,
        margin
      );
      // Lateral offset when the exit axis still lines up through the target
      // (top→top over a node below: clearCorridor only pushes further "out", not aside).
      ({ startExit: rawStartExit, endEntry: rawEndEntry } = offsetSameSideAroundBlockers(
        rawStartExit,
        rawEndEntry,
        input.fromDir,
        sameSideBlockers,
        margin,
        input.from,
        input.to
      ));
    }

    // Align exits only when from→exit / exit→to would not pierce blockers.
    // Unsafe align (pull startExit above target at the same x) collapses to a
    // vertical through the node after simplify drops the spur.
    if (
      canAlignSameSideExits(
        input.fromDir,
        rawStartExit,
        rawEndEntry,
        input.from,
        input.to,
        sameSideBlockers.length > 0
          ? sameSideBlockers
          : [input.target, input.source].filter((r): r is RouteRect => !!r),
        margin
      )
    ) {
      if (input.fromDir === 'left') {
        const x = Math.min(rawStartExit.x, rawEndEntry.x);
        rawStartExit = { ...rawStartExit, x };
        rawEndEntry = { ...rawEndEntry, x };
      } else if (input.fromDir === 'right') {
        const x = Math.max(rawStartExit.x, rawEndEntry.x);
        rawStartExit = { ...rawStartExit, x };
        rawEndEntry = { ...rawEndEntry, x };
      } else if (input.fromDir === 'top') {
        const y = Math.min(rawStartExit.y, rawEndEntry.y);
        rawStartExit = { ...rawStartExit, y };
        rawEndEntry = { ...rawEndEntry, y };
      } else if (input.fromDir === 'bottom') {
        const y = Math.max(rawStartExit.y, rawEndEntry.y);
        rawStartExit = { ...rawStartExit, y };
        rawEndEntry = { ...rawEndEntry, y };
      }
    }
  }

  const { startExit, endEntry } = clampFacingExitEntry(
    input.from,
    input.to,
    input.fromDir,
    input.toDir,
    rawStartExit,
    rawEndEntry,
    endStubLength
  );

  let sourceObs = input.source ? expandRect(input.source, margin) : undefined;
  let parentObs = input.parent && !internalParent ? expandRect(input.parent, margin) : undefined;
  let targetObs = input.target ? expandRect(input.target, margin) : undefined;

  const openCorridor = (
    expA: RouteRect,
    expB: RouteRect,
    inputA: RouteRect,
    inputB: RouteRect
  ): [RouteRect, RouteRect] => {
    const peeled = peelForFacingGap(inputA, inputB);
    if (peeled) return preserveFacingGap(expA, expB, peeled.a, peeled.b);
    return preserveFacingGap(expA, expB, inputA, inputB);
  };

  if (parentObs && targetObs && input.parent && input.target) {
    [parentObs, targetObs] = openCorridor(parentObs, targetObs, input.parent, input.target);
  } else if (sourceObs && targetObs && input.source && input.target) {
    [sourceObs, targetObs] = openCorridor(sourceObs, targetObs, input.source, input.target);
  }
  if (sourceObs && parentObs && input.source && input.parent) {
    [sourceObs, parentObs] = openCorridor(sourceObs, parentObs, input.source, input.parent);
  }

  const obstacles: RouteRect[] = [];
  if (sourceObs) obstacles.push(sourceObs);
  if (parentObs) obstacles.push(parentObs);
  if (targetObs) obstacles.push(targetObs);
  for (const other of others) {
    obstacles.push(expandRect(other, margin));
  }

  // Internal edges: lattice from source/target only — parent rails would pull
  // the graph outside the container (and nested grandparents onto the canvas).
  const peeledLattice =
    !internalParent && input.parent && input.target
      ? peelForFacingGap(input.parent, input.target)
      : input.source && input.target
        ? peelForFacingGap(input.source, input.target)
        : null;

  const latticeA =
    peeledLattice?.a ?? (internalParent ? input.source : (input.parent ?? input.source));
  const latticeB = peeledLattice?.b ?? input.target;

  const mid = routeMidPath(
    input.from,
    input.to,
    startExit,
    endEntry,
    axisOf(input.fromDir),
    axisOf(input.toDir),
    obstacles,
    latticeA,
    latticeB,
    margin
  ).slice(1, -1);

  // If mid already ends on the approach ray outside `to`, skip endEntry — otherwise
  // a fixed end stub overshoots and simplify has to cut a visible spur.
  const lastMid = mid[mid.length - 1];
  const alreadyApproaching =
    !!lastMid && isOnApproachOutside(lastMid, input.to, input.toDir, endStubLength);

  const raw = [input.from, startExit, ...mid, ...(alreadyApproaching ? [] : [endEntry]), input.to];
  return simplifyPath(ensureOrthogonalPath(raw, { exitDir: input.fromDir, enterDir: input.toDir }));
}

/** Elbow that leaves `prev` along `dir` first (source exit). */
function elbowExitFirst(prev: Point, next: Point, dir: Side): Point {
  switch (dir) {
    case 'left':
    case 'right':
      return { x: next.x, y: prev.y };
    case 'top':
    case 'bottom':
      return { x: prev.x, y: next.y };
  }
}

/** Elbow that arrives at `next` along `dir` last (target entry). */
function elbowEnterLast(prev: Point, next: Point, dir: Side): Point {
  switch (dir) {
    case 'left':
    case 'right':
      return { x: prev.x, y: next.y };
    case 'top':
    case 'bottom':
      return { x: next.x, y: prev.y };
  }
}

export interface EnsureOrthogonalOptions {
  /** Prefer leaving the first point along this side (avoids licking source face). */
  exitDir?: Side;
  /** Prefer arriving at the last point along this side. */
  enterDir?: Side;
}

/** Insert elbows so no consecutive points form a diagonal (safety net). */
export function ensureOrthogonalPath(path: Point[], options?: EnsureOrthogonalOptions): Point[] {
  if (path.length < 2) return path;
  const out: Point[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1]!;
    const next = path[i]!;
    const axisAligned = Math.abs(prev.x - next.x) < 0.001 || Math.abs(prev.y - next.y) < 0.001;
    if (!axisAligned) {
      const isFirst = out.length === 1;
      const isLast = i === path.length - 1;
      let elbow: Point;
      if (isFirst && options?.exitDir) {
        elbow = elbowExitFirst(prev, next, options.exitDir);
      } else if (isLast && options?.enterDir) {
        elbow = elbowEnterLast(prev, next, options.enterDir);
      } else {
        elbow = { x: prev.x, y: next.y };
      }
      out.push(elbow);
    }
    out.push(next);
  }
  return out;
}

function isOnApproachOutside(p: Point, to: Point, toDir: Side, minClearance: number): boolean {
  switch (toDir) {
    case 'top':
      return Math.abs(p.x - to.x) < 0.001 && p.y <= to.y - minClearance;
    case 'bottom':
      return Math.abs(p.x - to.x) < 0.001 && p.y >= to.y + minClearance;
    case 'left':
      return Math.abs(p.y - to.y) < 0.001 && p.x <= to.x - minClearance;
    case 'right':
      return Math.abs(p.y - to.y) < 0.001 && p.x >= to.x + minClearance;
  }
}
