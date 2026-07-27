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
};

const DEFAULT_MARGIN = 12;
const DEFAULT_EXIT = 20;
const BEND_PENALTY = 0.001;
/** Prefer mid-gap over hugging obstacle borders (same Manhattan, fewer bends). */
const CONTOUR_BAND = 18;
const CONTOUR_PENALTY = 140;

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
 * Scaled by segment length so a long “lick” along a wide BP costs far more than a short stub.
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
  // Per-pixel crawl cost: a long glued jog must lose to an outer route.
  return segLen * (CONTOUR_PENALTY / 10) * proximity;
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
  exitDistance: number,
  rawTarget?: RouteRect,
  rawNeighbor?: RouteRect
): Point {
  const stub = moveByDir(to, toDir, exitDistance);
  if (!rawTarget || !rawNeighbor) return stub;

  // Prefer the visual mid-gap over a fixed stub when the approach faces a neighbor.
  // Keeps the long jog off the target contour (ArchiMate BP bottom above Product).
  const mid = facingGapMid(rawTarget, rawNeighbor);
  if (!mid) return stub;

  switch (toDir) {
    case 'bottom':
      if (mid.y > to.y && rawNeighbor.y >= rawTarget.y + rawTarget.height) {
        return { x: to.x, y: mid.y };
      }
      break;
    case 'top':
      if (mid.y < to.y && rawNeighbor.y + rawNeighbor.height <= rawTarget.y) {
        return { x: to.x, y: mid.y };
      }
      break;
    case 'right':
      if (mid.x > to.x && rawNeighbor.x >= rawTarget.x + rawTarget.width) {
        return { x: mid.x, y: to.y };
      }
      break;
    case 'left':
      if (mid.x < to.x && rawNeighbor.x + rawNeighbor.width <= rawTarget.x) {
        return { x: mid.x, y: to.y };
      }
      break;
  }
  return stub;
}

/**
 * When nodes face each other closer than 2×exitDistance, fixed stubs cross
 * (startExit past endEntry). That draws a U-turn "tail" at the first bend.
 * Meet both stubs on the mid-gap instead.
 */
export function clampFacingExitEntry(
  from: Point,
  to: Point,
  fromDir: Side,
  toDir: Side,
  startExit: Point,
  endEntry: Point
): { startExit: Point; endEntry: Point } {
  if (fromDir === 'bottom' && toDir === 'top' && to.y > from.y && startExit.y > endEntry.y) {
    const midY = (from.y + to.y) / 2;
    return {
      startExit: { x: startExit.x, y: midY },
      endEntry: { x: endEntry.x, y: midY },
    };
  }
  if (fromDir === 'top' && toDir === 'bottom' && to.y < from.y && startExit.y < endEntry.y) {
    const midY = (from.y + to.y) / 2;
    return {
      startExit: { x: startExit.x, y: midY },
      endEntry: { x: endEntry.x, y: midY },
    };
  }
  if (fromDir === 'right' && toDir === 'left' && to.x > from.x && startExit.x > endEntry.x) {
    const midX = (from.x + to.x) / 2;
    return {
      startExit: { x: midX, y: startExit.y },
      endEntry: { x: midX, y: endEntry.y },
    };
  }
  if (fromDir === 'left' && toDir === 'right' && to.x < from.x && startExit.x < endEntry.x) {
    const midX = (from.x + to.x) / 2;
    return {
      startExit: { x: midX, y: startExit.y },
      endEntry: { x: midX, y: endEntry.y },
    };
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

type GraphEdge = { to: number; dir: 'h' | 'v'; length: number };

function buildCornerGraph(
  startExit: Point,
  endEntry: Point,
  obstacles: RouteRect[],
  parent?: RouteRect,
  target?: RouteRect,
  margin?: number
): { nodes: Point[]; edges: Map<number, GraphEdge[]>; startIdx: number; goalIdx: number } | null {
  const { xs, ys } = collectLatticeCoords(startExit, endEntry, obstacles, parent, target, margin);
  const nodes: Point[] = [];
  const nodeIndex = new Map<string, number>();
  const nodeKey = (x: number, y: number): string => `${x}|${y}`;

  const addNode = (x: number, y: number): void => {
    const key = nodeKey(x, y);
    if (nodeIndex.has(key)) return;
    const point = { x, y };
    if (obstacles.some((o) => pointInOpenInterior(point, o))) return;
    nodeIndex.set(key, nodes.length);
    nodes.push(point);
  };

  for (const x of xs) {
    for (const y of ys) {
      addNode(x, y);
    }
  }
  addNode(startExit.x, startExit.y);
  addNode(endEntry.x, endEntry.y);

  const startIdx = nodeIndex.get(nodeKey(startExit.x, startExit.y));
  const goalIdx = nodeIndex.get(nodeKey(endEntry.x, endEntry.y));
  if (startIdx == null || goalIdx == null) return null;

  const edges = new Map<number, GraphEdge[]>();
  const pushEdge = (a: number, b: number, dir: 'h' | 'v', length: number): void => {
    const list = edges.get(a) ?? [];
    list.push({ to: b, dir, length });
    edges.set(a, list);
  };

  const byX = new Map<number, number[]>();
  const byY = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const xsList = byX.get(node.x) ?? [];
    xsList.push(i);
    byX.set(node.x, xsList);
    const ysList = byY.get(node.y) ?? [];
    ysList.push(i);
    byY.set(node.y, ysList);
  }

  for (const list of byX.values()) {
    list.sort((a, b) => nodes[a]!.y - nodes[b]!.y);
    for (let i = 1; i < list.length; i++) {
      const a = nodes[list[i - 1]!]!;
      const b = nodes[list[i]!]!;
      if (!segmentHitsObstacles(a, b, obstacles)) {
        const length = manhattan(a, b) + contourProximityPenalty(a, b, obstacles);
        pushEdge(list[i - 1]!, list[i]!, 'v', length);
        pushEdge(list[i]!, list[i - 1]!, 'v', length);
      }
    }
  }

  for (const list of byY.values()) {
    list.sort((a, b) => nodes[a]!.x - nodes[b]!.x);
    for (let i = 1; i < list.length; i++) {
      const a = nodes[list[i - 1]!]!;
      const b = nodes[list[i]!]!;
      if (!segmentHitsObstacles(a, b, obstacles)) {
        const length = manhattan(a, b) + contourProximityPenalty(a, b, obstacles);
        pushEdge(list[i - 1]!, list[i]!, 'h', length);
        pushEdge(list[i]!, list[i - 1]!, 'h', length);
      }
    }
  }

  return { nodes, edges, startIdx, goalIdx };
}

type DirState = 'h' | 'v' | 's';

function searchMidPath(
  nodes: Point[],
  edges: Map<number, GraphEdge[]>,
  startIdx: number,
  goalIdx: number
): Point[] | null {
  type QueueState = { node: number; dir: DirState; g: number; f: number; key: string };
  const makeStateKey = (node: number, dir: DirState): string => `${node}:${dir}`;
  const open: QueueState[] = [];
  const best = new Map<string, number>();
  const prev = new Map<string, string>();
  const startKey = makeStateKey(startIdx, 's');
  best.set(startKey, 0);
  open.push({
    node: startIdx,
    dir: 's',
    g: 0,
    f: manhattan(nodes[startIdx]!, nodes[goalIdx]!),
    key: startKey,
  });

  let goalKey: string | null = null;
  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    if (current.node === goalIdx) {
      goalKey = current.key;
      break;
    }

    for (const edge of edges.get(current.node) ?? []) {
      const nextDir = edge.dir;
      let stepCost = edge.length;
      if (current.dir !== 's' && current.dir !== nextDir) {
        stepCost += BEND_PENALTY;
      }
      const nextG = current.g + stepCost;
      const nextKey = makeStateKey(edge.to, nextDir);
      if (nextG >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, nextG);
      prev.set(nextKey, current.key);
      open.push({
        node: edge.to,
        dir: nextDir,
        g: nextG,
        f: nextG + manhattan(nodes[edge.to]!, nodes[goalIdx]!),
        key: nextKey,
      });
    }
  }

  if (!goalKey) return null;

  const path: Point[] = [];
  let key: string | undefined = goalKey;
  while (key) {
    const nodeIdx = Number(key.split(':')[0]);
    path.unshift(nodes[nodeIdx]!);
    key = prev.get(key);
  }
  return path;
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

function fallbackOuterRoute(startExit: Point, endEntry: Point, obstacles: RouteRect[]): Point[] {
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
  let bestLen = Infinity;
  for (const candidate of candidates) {
    const simplified = simplifyPath(candidate);
    if (!pathIsValid(simplified, obstacles)) continue;
    const len = simplified.reduce((sum, p, i) => {
      if (i === 0) return 0;
      return sum + manhattan(simplified[i - 1]!, p);
    }, 0);
    if (len < bestLen) {
      bestLen = len;
      best = simplified;
    }
  }

  // Last resort: orthogonal elbow even if it clips — never a diagonal.
  return best ?? orthogonalElbow(startExit, endEntry);
}

function routeMidPath(
  startExit: Point,
  endEntry: Point,
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
    const mid = searchMidPath(graph.nodes, graph.edges, graph.startIdx, graph.goalIdx);
    if (mid && pathIsValid(mid, obstacles)) return mid;
  }

  return fallbackOuterRoute(startExit, endEntry, obstacles);
}

export function routeOrthogonalAround(input: RouteOrthogonalAroundInput): Point[] {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const exitDistance = input.exitDistance ?? DEFAULT_EXIT;
  const others = input.others ?? [];

  // Both endpoints inside parent → internal edge: stay in the container and dodge
  // siblings. Otherwise parent is a solid outer blocker (nested → outside target).
  const internalParent =
    !!input.parent &&
    pointInRectClosed(input.from, input.parent) &&
    pointInRectClosed(input.to, input.parent);

  // Clear the outer blocker first (container), else the source node itself.
  const exitBlocker = internalParent ? input.source : (input.parent ?? input.source);
  let rawStartExit = computeStartExit(
    input.from,
    input.fromDir,
    exitBlocker,
    margin,
    exitDistance
  );
  const gapNeighbor = internalParent
    ? input.source
    : (input.parent ?? input.source);
  const peeledTargetNeighbor =
    input.target && gapNeighbor ? peelForFacingGap(input.target, gapNeighbor) : null;

  // Park the approach on the visual mid-gap so the long jog is not glued to the target.
  let rawEndEntry = computeEndEntry(
    input.to,
    input.toDir,
    exitDistance,
    peeledTargetNeighbor?.a,
    peeledTargetNeighbor?.b
  );

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
    rawEndEntry
  );

  let sourceObs = input.source ? expandRect(input.source, margin) : undefined;
  let parentObs =
    input.parent && !internalParent ? expandRect(input.parent, margin) : undefined;
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
    startExit,
    endEntry,
    obstacles,
    latticeA,
    latticeB,
    margin
  ).slice(1, -1);

  // If mid already ends on the approach ray outside `to`, skip endEntry — otherwise
  // a fixed exitDistance stub overshoots and simplify has to cut a visible spur.
  const lastMid = mid[mid.length - 1];
  const alreadyApproaching =
    !!lastMid && isOnApproachOutside(lastMid, input.to, input.toDir, 1);

  const raw = [
    input.from,
    startExit,
    ...mid,
    ...(alreadyApproaching ? [] : [endEntry]),
    input.to,
  ];
  return simplifyPath(
    ensureOrthogonalPath(raw, { exitDir: input.fromDir, enterDir: input.toDir })
  );
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
export function ensureOrthogonalPath(
  path: Point[],
  options?: EnsureOrthogonalOptions
): Point[] {
  if (path.length < 2) return path;
  const out: Point[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const prev = out[out.length - 1]!;
    const next = path[i]!;
    const axisAligned =
      Math.abs(prev.x - next.x) < 0.001 || Math.abs(prev.y - next.y) < 0.001;
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
