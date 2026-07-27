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
const BEND_PENALTY = 0.001;

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

function computeEndEntry(to: Point, toDir: Side, exitDistance: number): Point {
  return moveByDir(to, toDir, exitDistance);
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

  if (parent && target && margin != null) {
    const ep = expandRect(parent, margin);
    const et = expandRect(target, margin);

    const addGapY = (gapY: number): void => {
      ySet.add(gapY);
      const left = Math.min(ep.x, et.x, startExit.x, endEntry.x);
      const right = Math.max(ep.x + ep.width, et.x + et.width, startExit.x, endEntry.x);
      xSet.add(left);
      xSet.add(right);
      xSet.add(startExit.x);
      xSet.add(endEntry.x);
    };

    const addGapX = (gapX: number): void => {
      xSet.add(gapX);
      const top = Math.min(ep.y, et.y, startExit.y, endEntry.y);
      const bottom = Math.max(ep.y + ep.height, et.y + et.height, startExit.y, endEntry.y);
      ySet.add(top);
      ySet.add(bottom);
      ySet.add(startExit.y);
      ySet.add(endEntry.y);
    };

    if (et.y + et.height < ep.y) {
      addGapY((et.y + et.height + ep.y) / 2);
    }
    if (ep.y + ep.height < et.y) {
      addGapY((ep.y + ep.height + et.y) / 2);
    }
    if (et.x + et.width < ep.x) {
      addGapX((et.x + et.width + ep.x) / 2);
    }
    if (ep.x + ep.width < et.x) {
      addGapX((ep.x + ep.width + et.x) / 2);
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
        const length = manhattan(a, b);
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
        const length = manhattan(a, b);
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

function fallbackOuterRoute(startExit: Point, endEntry: Point, obstacles: RouteRect[]): Point[] {
  if (obstacles.length === 0) {
    if (Math.abs(startExit.x - endEntry.x) < 0.001 || Math.abs(startExit.y - endEntry.y) < 0.001) {
      return [startExit, endEntry];
    }
    return [startExit, { x: startExit.x, y: endEntry.y }, endEntry];
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

  return best ?? [startExit, { x: startExit.x, y: endEntry.y }, endEntry];
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
  const startExit = computeStartExit(
    input.from,
    input.fromDir,
    input.parent,
    margin,
    exitDistance
  );
  const endEntry = computeEndEntry(input.to, input.toDir, exitDistance);

  const obstacles: RouteRect[] = [];
  if (input.parent) obstacles.push(expandRect(input.parent, margin));
  if (input.target) obstacles.push(expandRect(input.target, margin));

  const mid = routeMidPath(
    startExit,
    endEntry,
    obstacles,
    input.parent,
    input.target,
    margin
  ).slice(1, -1);

  return simplifyPath([input.from, startExit, ...mid, endEntry, input.to]);
}
