import type { Point } from '@/types';
import type { PathStrategy, PathStrategyOptions, PathObstacle } from './PathStrategy';
import { routeOrthogonalAround, type Side } from './routeOrthogonalAround';
import { distance, distanceToSegment } from '@/utils/geometry';
import { isHorizontal, isVertical, isOppositeDirections } from '@/utils/direction';

function isSide(v: string | undefined): v is Side {
  return v === 'top' || v === 'right' || v === 'bottom' || v === 'left';
}

function resolveParentAndTarget(
  from: Point,
  to: Point,
  obstacles: PathObstacle[]
): { parent?: PathObstacle; target?: PathObstacle } {
  const target =
    obstacles.find((o) => o.role === 'target') ??
    obstacles.find((o) => {
      const onVertical =
        (Math.abs(to.x - o.x) < 1 || Math.abs(to.x - (o.x + o.width)) < 1) &&
        to.y >= o.y - 1 &&
        to.y <= o.y + o.height + 1;
      const onHorizontal =
        (Math.abs(to.y - o.y) < 1 || Math.abs(to.y - (o.y + o.height)) < 1) &&
        to.x >= o.x - 1 &&
        to.x <= o.x + o.width + 1;
      return onVertical || onHorizontal;
    });

  const parent = obstacles.find(
    (o) =>
      o !== target &&
      from.x >= o.x &&
      from.x <= o.x + o.width &&
      from.y >= o.y &&
      from.y <= o.y + o.height
  );

  return { parent, target };
}

const MIN_SEGMENT_LENGTH = 20;
const SELF_LOOP_MIN_DISTANCE = 1;
const SELF_LOOP_OFFSET = 42;
const SELF_LOOP_SPREAD = 20;
const CORNER_BYPASS_DISTANCE = 220;
const CORNER_BYPASS_CLEARANCE = 34;
const OPPOSITE_BYPASS_DISTANCE = 280;
const OPPOSITE_BYPASS_CLEARANCE = 36;
const OPPOSITE_BYPASS_ARC = 48;
const OBSTACLE_ROUTING_DISTANCE = 1200;
const OBSTACLE_MARGIN = 12;
const ROUTE_EXIT_DISTANCE = 32;
const TURN_PENALTY = 70;
const FIRST_VERTICAL_PENALTY = 28;

function expandObstacles(obstacles: PathObstacle[], margin: number): PathObstacle[] {
  return obstacles.map((obstacle) => ({
    ...obstacle,
    x: obstacle.x - margin,
    y: obstacle.y - margin,
    width: obstacle.width + margin * 2,
    height: obstacle.height + margin * 2,
  }));
}

function pointInsideObstacle(point: Point, obstacle: PathObstacle): boolean {
  return (
    point.x >= obstacle.x &&
    point.x <= obstacle.x + obstacle.width &&
    point.y >= obstacle.y &&
    point.y <= obstacle.y + obstacle.height
  );
}

function segmentIntersectsExpandedObstacle(a: Point, b: Point, obstacle: PathObstacle): boolean {
  const minX = obstacle.x;
  const maxX = obstacle.x + obstacle.width;
  const minY = obstacle.y;
  const maxY = obstacle.y + obstacle.height;

  if (Math.abs(a.x - b.x) < 0.001) {
    const x = a.x;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    return x >= minX && x <= maxX && y2 >= minY && y1 <= maxY;
  }

  if (Math.abs(a.y - b.y) < 0.001) {
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    return y >= minY && y <= maxY && x2 >= minX && x1 <= maxX;
  }

  return false;
}

function simplifyPath(path: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of path) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - point.x) > 0.001 || Math.abs(prev.y - point.y) > 0.001) {
      out.push(point);
    }
  }
  return out;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function moveByDir(point: Point, dir: string | undefined, distance: number): Point {
  switch (dir) {
    case 'top':
      return { x: point.x, y: point.y - distance };
    case 'bottom':
      return { x: point.x, y: point.y + distance };
    case 'left':
      return { x: point.x - distance, y: point.y };
    case 'right':
      return { x: point.x + distance, y: point.y };
    default:
      return point;
  }
}

/** Push `point` along `dir` until it clears every obstacle (plus margin). */
function moveOutsideObstacles(
  point: Point,
  dir: string | undefined,
  obstacles: PathObstacle[],
  minDistance: number
): Point {
  if (!dir || obstacles.length === 0) {
    return moveByDir(point, dir, minDistance);
  }
  const expanded = expandObstacles(obstacles, OBSTACLE_MARGIN);
  let dist = minDistance;
  let candidate = moveByDir(point, dir, dist);
  const step = 16;
  const maxDist = 4000;
  while (dist < maxDist && expanded.some((obstacle) => pointInsideObstacle(candidate, obstacle))) {
    dist += step;
    candidate = moveByDir(point, dir, dist);
  }
  return candidate;
}

function inferExitDir(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Prefer horizontal exit when comparable (source side).
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

/** Outward side at `to` we should approach from (not opposite of fromDir). */
function inferApproachDir(from: Point, to: Point): string {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  // Any real above/below relationship → vertical arrival. Even a small gap under a
  // wide Business Process must not flip to left/right (that crawls the bottom edge).
  if (Math.abs(dy) > 1) {
    return dy >= 0 ? 'bottom' : 'top';
  }
  if (Math.abs(dx) > 1) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * Resolve approach side at `to`.
 * - Explicit top/bottom ports are trusted (never replaced by left/right).
 * - Explicit left/right ports are overridden when geometry is clearly above/below,
 *   so we do not crawl along wide node edges.
 */
function resolveApproachDir(from: Point, to: Point, toDir: string | undefined): string {
  const geometric = inferApproachDir(from, to);
  if (toDir && isVertical(toDir)) {
    return toDir;
  }
  if (toDir && isHorizontal(toDir) && isVertical(geometric)) {
    return geometric;
  }
  return toDir ?? geometric;
}

function buildRoutedPolyline(
  from: Point,
  to: Point,
  fromDir: string | undefined,
  toDir: string | undefined,
  obstacles: PathObstacle[]
): Point[] | null {
  if (obstacles.length === 0) {
    return null;
  }

  const effectiveFromDir = fromDir ?? inferExitDir(from, to);
  const effectiveToDir = resolveApproachDir(from, to, toDir);

  const startExit = moveOutsideObstacles(from, effectiveFromDir, obstacles, ROUTE_EXIT_DISTANCE);
  const endEntry = moveOutsideObstacles(to, effectiveToDir, obstacles, ROUTE_EXIT_DISTANCE);
  const expanded = expandObstacles(obstacles, OBSTACLE_MARGIN);

  const xs = new Set<number>([startExit.x, endEntry.x]);
  const ys = new Set<number>([startExit.y, endEntry.y]);
  for (const obstacle of expanded) {
    xs.add(obstacle.x - 1);
    xs.add(obstacle.x + obstacle.width + 1);
    ys.add(obstacle.y - 1);
    ys.add(obstacle.y + obstacle.height + 1);
  }

  type GraphNode = { x: number; y: number };
  const nodes: GraphNode[] = [];
  const nodeIndex = new Map<string, number>();
  const nodeKey = (x: number, y: number): string => `${x}|${y}`;
  const addNode = (x: number, y: number): void => {
    const key = nodeKey(x, y);
    if (nodeIndex.has(key)) return;
    const point = { x, y };
    if (expanded.some((obstacle) => pointInsideObstacle(point, obstacle))) {
      return;
    }
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
  if (startIdx == null || goalIdx == null) {
    return null;
  }

  const edges = new Map<number, Array<{ to: number; dir: 'h' | 'v'; length: number }>>();
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
      if (!expanded.some((obstacle) => segmentIntersectsExpandedObstacle(a, b, obstacle))) {
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
      if (!expanded.some((obstacle) => segmentIntersectsExpandedObstacle(a, b, obstacle))) {
        const length = manhattan(a, b);
        pushEdge(list[i - 1]!, list[i]!, 'h', length);
        pushEdge(list[i]!, list[i - 1]!, 'h', length);
      }
    }
  }

  type DirState = 'h' | 'v' | 's';
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
        stepCost += TURN_PENALTY;
      }
      if (current.dir === 's' && nextDir === 'v') {
        stepCost += FIRST_VERTICAL_PENALTY;
      }
      const nextG = current.g + stepCost;
      const nextKey = makeStateKey(edge.to, nextDir);
      if (nextG >= (best.get(nextKey) ?? Infinity)) {
        continue;
      }
      best.set(nextKey, nextG);
      prev.set(nextKey, current.key);
      const h = manhattan(nodes[edge.to]!, nodes[goalIdx]!);
      open.push({ node: edge.to, dir: nextDir, g: nextG, f: nextG + h, key: nextKey });
    }
  }

  if (!goalKey) {
    return null;
  }

  const routed: Point[] = [];
  let cursor: string | undefined = goalKey;
  while (cursor) {
    const [nodePart] = cursor.split(':');
    const node = nodes[Number(nodePart)]!;
    routed.push({ x: node.x, y: node.y });
    cursor = prev.get(cursor);
  }
  routed.reverse();

  const internal = simplifyPath(routed).filter(
    (_, idx, arr) => idx !== 0 && idx !== arr.length - 1
  );
  return simplifyPath([from, startExit, ...internal, endEntry, to]);
}

/**
 * Polyline path strategy
 */
export class PolylinePathStrategy implements PathStrategy {
  calculatePath(
    from: Point,
    to: Point,
    fromDir?: string,
    toDir?: string,
    _options?: PathStrategyOptions
  ): Point[] {
    const controlPoints = _options?.controlPoints;
    if (_options?.editablePolyline) {
      if (controlPoints && controlPoints.length > 0) {
        return [from, ...controlPoints, to];
      }
      return [from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to];
    }

    const dist = distance(from, to);
    const selfLoop = _options?.selfLoop ?? false;
    const obstacles = _options?.obstacles ?? [];

    if (selfLoop && dist < SELF_LOOP_MIN_DISTANCE && (fromDir || toDir)) {
      const dir = fromDir ?? toDir;
      switch (dir) {
        case 'bottom':
          return [
            from,
            { x: from.x - SELF_LOOP_SPREAD, y: from.y + SELF_LOOP_OFFSET },
            { x: from.x + SELF_LOOP_SPREAD, y: from.y + SELF_LOOP_OFFSET },
            to,
          ];
        case 'left':
          return [
            from,
            { x: from.x - SELF_LOOP_OFFSET, y: from.y + SELF_LOOP_SPREAD },
            { x: from.x - SELF_LOOP_OFFSET, y: from.y - SELF_LOOP_SPREAD },
            to,
          ];
        case 'right':
          return [
            from,
            { x: from.x + SELF_LOOP_OFFSET, y: from.y - SELF_LOOP_SPREAD },
            { x: from.x + SELF_LOOP_OFFSET, y: from.y + SELF_LOOP_SPREAD },
            to,
          ];
        case 'top':
        default:
          return [
            from,
            { x: from.x + SELF_LOOP_SPREAD, y: from.y - SELF_LOOP_OFFSET },
            { x: from.x - SELF_LOOP_SPREAD, y: from.y - SELF_LOOP_OFFSET },
            to,
          ];
      }
    }

    if (
      selfLoop &&
      dist < OPPOSITE_BYPASS_DISTANCE &&
      fromDir &&
      toDir &&
      isOppositeDirections(fromDir, toDir)
    ) {
      if (isHorizontal(fromDir) && isHorizontal(toDir)) {
        const fromStepX =
          fromDir === 'left' ? -OPPOSITE_BYPASS_CLEARANCE : OPPOSITE_BYPASS_CLEARANCE;
        const toStepX = toDir === 'left' ? -OPPOSITE_BYPASS_CLEARANCE : OPPOSITE_BYPASS_CLEARANCE;
        const sideY = from.x <= to.x ? -1 : 1;
        const outerY = from.y + sideY * OPPOSITE_BYPASS_ARC;
        return [
          from,
          { x: from.x + fromStepX, y: from.y },
          { x: from.x + fromStepX, y: outerY },
          { x: to.x + toStepX, y: outerY },
          { x: to.x + toStepX, y: to.y },
          to,
        ];
      }
      if (isVertical(fromDir) && isVertical(toDir)) {
        const fromStepY =
          fromDir === 'top' ? -OPPOSITE_BYPASS_CLEARANCE : OPPOSITE_BYPASS_CLEARANCE;
        const toStepY = toDir === 'top' ? -OPPOSITE_BYPASS_CLEARANCE : OPPOSITE_BYPASS_CLEARANCE;
        const sideX = from.y <= to.y ? 1 : -1;
        const outerX = from.x + sideX * OPPOSITE_BYPASS_ARC;
        return [
          from,
          { x: from.x, y: from.y + fromStepY },
          { x: outerX, y: from.y + fromStepY },
          { x: outerX, y: to.y + toStepY },
          { x: to.x, y: to.y + toStepY },
          to,
        ];
      }
    }

    if (
      selfLoop &&
      dist < CORNER_BYPASS_DISTANCE &&
      fromDir &&
      toDir &&
      ((isHorizontal(fromDir) && isVertical(toDir)) || (isVertical(fromDir) && isHorizontal(toDir)))
    ) {
      const fromOuter = {
        x:
          from.x +
          (fromDir === 'left'
            ? -CORNER_BYPASS_CLEARANCE
            : fromDir === 'right'
              ? CORNER_BYPASS_CLEARANCE
              : 0),
        y:
          from.y +
          (fromDir === 'top'
            ? -CORNER_BYPASS_CLEARANCE
            : fromDir === 'bottom'
              ? CORNER_BYPASS_CLEARANCE
              : 0),
      };
      const toOuter = {
        x:
          to.x +
          (toDir === 'left'
            ? -CORNER_BYPASS_CLEARANCE
            : toDir === 'right'
              ? CORNER_BYPASS_CLEARANCE
              : 0),
        y:
          to.y +
          (toDir === 'top'
            ? -CORNER_BYPASS_CLEARANCE
            : toDir === 'bottom'
              ? CORNER_BYPASS_CLEARANCE
              : 0),
      };
      const corner = isHorizontal(fromDir)
        ? { x: fromOuter.x, y: toOuter.y }
        : { x: toOuter.x, y: fromOuter.y };
      return [from, fromOuter, corner, toOuter, to];
    }

    // Nested / target-aware case: dedicated router (parent and/or target present).
    // Diagram obstacles already pad ~8px; margin 4 ≈ 12px total clearance.
    if (!selfLoop && isSide(fromDir) && isSide(toDir)) {
      const { parent, target } = resolveParentAndTarget(from, to, obstacles);
      const approachDir = resolveApproachDir(from, to, toDir);
      if ((parent || target) && isSide(approachDir)) {
        return routeOrthogonalAround({
          from,
          to,
          fromDir,
          toDir: approachDir,
          parent,
          target,
          margin: 4,
          exitDistance: 20,
        });
      }
    }

    // Generic multi-obstacle A* (no parent/target specialization)
    if (!selfLoop && dist < OBSTACLE_ROUTING_DISTANCE) {
      const routed = buildRoutedPolyline(from, to, fromDir, toDir, obstacles);
      if (routed) {
        return routed;
      }
    }

    // One-sided or partial dirs / directed without specialized obstacles
    if (fromDir || toDir) {
      return this.calculateDirectedPath(from, to, fromDir, toDir);
    }

    // Classic manhattan when dirs are absent
    const midX = (from.x + to.x) / 2;
    if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) {
      return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
    }
    const midY = (from.y + to.y) / 2;
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  }

  private calculateDirectedPath(from: Point, to: Point, fromDir?: string, toDir?: string): Point[] {
    const points: Point[] = [from];

    // Determine first segment based on fromDir
    const fromHorizontal = fromDir === 'left' || fromDir === 'right';
    const fromVertical = fromDir === 'top' || fromDir === 'bottom';
    const toHorizontal = toDir === 'left' || toDir === 'right';
    const toVertical = toDir === 'top' || toDir === 'bottom';

    if (fromVertical && toVertical) {
      // Both vertical: route with horizontal middle segment
      const midY = (from.y + to.y) / 2;
      const exitY =
        fromDir === 'top'
          ? Math.min(from.y - MIN_SEGMENT_LENGTH, midY)
          : Math.max(from.y + MIN_SEGMENT_LENGTH, midY);
      const entryY =
        toDir === 'top'
          ? Math.min(to.y - MIN_SEGMENT_LENGTH, midY)
          : Math.max(to.y + MIN_SEGMENT_LENGTH, midY);

      if (Math.abs(exitY - entryY) < 1) {
        points.push({ x: from.x, y: exitY });
        points.push({ x: to.x, y: exitY });
      } else {
        points.push({ x: from.x, y: exitY });
        points.push({ x: to.x, y: exitY });
      }
    } else if (fromHorizontal && toHorizontal) {
      // Both horizontal: route with vertical middle segment
      const midX = (from.x + to.x) / 2;
      const exitX =
        fromDir === 'left'
          ? Math.min(from.x - MIN_SEGMENT_LENGTH, midX)
          : Math.max(from.x + MIN_SEGMENT_LENGTH, midX);
      const entryX =
        toDir === 'left'
          ? Math.min(to.x - MIN_SEGMENT_LENGTH, midX)
          : Math.max(to.x + MIN_SEGMENT_LENGTH, midX);

      if (Math.abs(exitX - entryX) < 1) {
        points.push({ x: exitX, y: from.y });
        points.push({ x: exitX, y: to.y });
      } else {
        points.push({ x: exitX, y: from.y });
        points.push({ x: exitX, y: to.y });
      }
    } else if (fromVertical && toHorizontal) {
      // Exit along fromDir first; horizontal approach jog stays in the mid-gap.
      const exitY =
        fromDir === 'top' ? from.y - MIN_SEGMENT_LENGTH : from.y + MIN_SEGMENT_LENGTH;
      const entryX =
        toDir === 'left' ? to.x - MIN_SEGMENT_LENGTH : to.x + MIN_SEGMENT_LENGTH;
      const jogX = (from.x + to.x) / 2;
      const approachX =
        Math.abs(jogX - to.x) >= MIN_SEGMENT_LENGTH
          ? jogX
          : entryX;
      points.push({ x: from.x, y: exitY });
      points.push({ x: approachX, y: exitY });
      points.push({ x: approachX, y: to.y });
    } else if (fromHorizontal && toVertical) {
      // Exit along fromDir first; horizontal jog in mid-gap, then vertical into target.
      const exitX =
        fromDir === 'left' ? from.x - MIN_SEGMENT_LENGTH : from.x + MIN_SEGMENT_LENGTH;
      const jogY = (from.y + to.y) / 2;
      points.push({ x: exitX, y: from.y });
      points.push({ x: exitX, y: jogY });
      points.push({ x: to.x, y: jogY });
    } else {
      // Fallback: one corner
      const midX = (from.x + to.x) / 2;
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    }

    points.push(to);
    return points;
  }

  hitTest(point: Point, path: Point[], tolerance: number): boolean {
    for (let i = 1; i < path.length; i++) {
      if (distanceToSegment(point, path[i - 1]!, path[i]!) <= tolerance) {
        return true;
      }
    }
    return false;
  }
}
