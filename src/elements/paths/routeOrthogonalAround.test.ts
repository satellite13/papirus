import { describe, expect, it } from 'vitest';
import {
  contourProximityPenalty,
  routeOrthogonalAround,
  searchMidPath,
  type GraphEdge,
} from './routeOrthogonalAround';
import { ROUTE_BEND_COST, countBends } from './routeCost';

const parent = { id: 'parent', x: 160, y: 200, width: 220, height: 160 };
const target = { id: 'bp', x: 40, y: 40, width: 400, height: 50 };

function segmentHitsExpanded(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  margin: number
): boolean {
  const r = {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  };
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

describe('routeOrthogonalAround terminals', () => {
  it('exits left and arrives vertically into bottom from outside', () => {
    const from = { x: 200, y: 260 };
    const to = { x: 280, y: 90 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'left',
      toDir: 'bottom',
      parent,
      target,
      margin: 12,
      exitDistance: 20,
    });

    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);

    const p1 = path[1]!;
    expect(p1.x).toBeLessThan(from.x);
    expect(Math.abs(p1.y - from.y)).toBeLessThan(0.5);

    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(pre.y).toBeGreaterThan(to.y);
  });

  it('arrives from the right outside for toDir=right', () => {
    const from = { x: 200, y: 260 };
    const to = { x: 440, y: 65 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'left',
      toDir: 'right',
      parent,
      target: { id: 'bp', x: 40, y: 40, width: 400, height: 50 },
      margin: 12,
      exitDistance: 20,
    });
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.y - to.y)).toBeLessThan(0.5);
    expect(pre.x).toBeGreaterThan(to.x);
  });
});

describe('routeOrthogonalAround obstacles', () => {
  it('does not cross parent or target interiors (left→bottom via gap)', () => {
    const from = { x: 200, y: 260 };
    const to = { x: 280, y: 90 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'left',
      toDir: 'bottom',
      parent,
      target,
      margin: 12,
      exitDistance: 20,
    });
    for (let i = 2; i < path.length - 1; i++) {
      expect(segmentHitsExpanded(path[i - 1]!, path[i]!, parent, 12)).toBe(false);
      expect(segmentHitsExpanded(path[i - 1]!, path[i]!, target, 12)).toBe(false);
    }
  });

  it('left→right uses gap under target, not a path through target body', () => {
    const from = { x: 200, y: 260 };
    const to = { x: 440, y: 65 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'left',
      toDir: 'right',
      parent,
      target,
      margin: 12,
      exitDistance: 20,
    });
    for (let i = 2; i < path.length - 1; i++) {
      expect(segmentHitsExpanded(path[i - 1]!, path[i]!, target, 12)).toBe(false);
    }
    const ys = path.map((p) => p.y);
    const minY = Math.min(...ys);
    const targetBottom = 40 + 50;
    const parentTop = 200;
    expect(path.some((p) => p.y > targetBottom && p.y < parentTop)).toBe(true);
    expect(minY).toBeGreaterThan(0);
  });
});

const sides = ['left', 'right', 'top', 'bottom'] as const;

function fromPointForDir(fromDir: (typeof sides)[number]): { x: number; y: number } {
  switch (fromDir) {
    case 'left':
      return { x: 250, y: 250 };
    case 'right':
      return { x: 250, y: 250 };
    case 'top':
      return { x: 250, y: 210 };
    case 'bottom':
      return { x: 250, y: 330 };
  }
}

describe('routeOrthogonalAround side matrix', () => {
  for (const fromDir of sides) {
    for (const toDir of sides) {
      it(`${fromDir} → ${toDir}: terminals ⊥ and no cross`, () => {
        const from = fromPointForDir(fromDir);
        const to =
          toDir === 'bottom'
            ? { x: 260, y: 90 }
            : toDir === 'top'
              ? { x: 260, y: 40 }
              : toDir === 'left'
                ? { x: 40, y: 65 }
                : { x: 440, y: 65 };

        const path = routeOrthogonalAround({
          from,
          to,
          fromDir,
          toDir,
          parent,
          target,
          margin: 12,
          exitDistance: 20,
        });

        expect(path[0]).toEqual(from);
        expect(path[path.length - 1]).toEqual(to);

        const p1 = path[1]!;
        if (fromDir === 'left') expect(p1.x).toBeLessThan(from.x);
        if (fromDir === 'right') expect(p1.x).toBeGreaterThan(from.x);
        if (fromDir === 'top') expect(p1.y).toBeLessThan(from.y);
        if (fromDir === 'bottom') expect(p1.y).toBeGreaterThan(from.y);

        const pre = path[path.length - 2]!;
        if (toDir === 'left' || toDir === 'right') {
          expect(Math.abs(pre.y - to.y)).toBeLessThan(0.5);
          expect(Math.abs(pre.x - to.x)).toBeGreaterThan(1);
        } else {
          expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
          expect(Math.abs(pre.y - to.y)).toBeGreaterThan(1);
        }

        for (let i = 2; i < path.length - 1; i++) {
          expect(segmentHitsExpanded(path[i - 1]!, path[i]!, parent, 12)).toBe(false);
          expect(segmentHitsExpanded(path[i - 1]!, path[i]!, target, 12)).toBe(false);
        }
        expect(segmentHitsExpanded(pre, to, target, 0)).toBe(false);
      });
    }
  }
});

function linkGraph(
  nodes: { x: number; y: number }[],
  links: Array<[number, number, 'h' | 'v', number?]>
): Map<number, GraphEdge[]> {
  const edges = new Map<number, GraphEdge[]>();
  for (const [a, b, dir, len] of links) {
    const length = len ?? Math.abs(nodes[a]!.x - nodes[b]!.x) + Math.abs(nodes[a]!.y - nodes[b]!.y);
    edges.set(a, [...(edges.get(a) ?? []), { to: b, dir, length }]);
    edges.set(b, [...(edges.get(b) ?? []), { to: a, dir, length }]);
  }
  return edges;
}

describe('searchMidPath cost model', () => {
  // 0 → 5 directly (0 bends, inflated length) vs detour 0-1-2-3-4-5 (4 bends, 320 px).
  const nodes = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 10 },
    { x: 200, y: 10 },
    { x: 200, y: 0 },
    { x: 300, y: 0 },
  ];
  const detour: Array<[number, number, 'h' | 'v']> = [
    [0, 1, 'h'],
    [1, 2, 'v'],
    [2, 3, 'h'],
    [3, 4, 'v'],
    [4, 5, 'h'],
  ];

  it('takes a longer straight run while it costs less than the bends it saves', () => {
    const edges = linkGraph(nodes, [...detour, [0, 5, 'h', 800]]);
    expect(searchMidPath(nodes, edges, 0, 5, 'h', 'h')).toEqual([nodes[0], nodes[5]]);
  });

  it('accepts bends when the straight run is longer than their cost', () => {
    const edges = linkGraph(nodes, [...detour, [0, 5, 'h', 1000]]);
    expect(searchMidPath(nodes, edges, 0, 5, 'h', 'h')).toEqual(nodes);
  });

  it('counts the turn at the start stub and the arrival axis', () => {
    // start axis h, goal axis v: (0,0)→(100,0)→(100,100) is 1 bend;
    // (0,0)→(0,100)→(100,100) turns at the start and arrives horizontally.
    const sq = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
    ];
    const edges = linkGraph(sq, [
      [0, 1, 'v'],
      [1, 2, 'h'],
      [0, 3, 'h'],
      [3, 2, 'v'],
    ]);
    expect(searchMidPath(sq, edges, 0, 2, 'h', 'v')).toEqual([sq[0], sq[3], sq[2]]);
  });

  it('pays for arriving across the goal axis', () => {
    // Both routes leave along the start axis. Short: 1 bend, arrives v (+1 at the goal),
    // 10 px longer. Long: 2 bends, arrives h. Only the goal penalty tips it to the long one.
    const g = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ];
    const edges = linkGraph(g, [
      [0, 1, 'h'],
      [1, 2, 'h', 60],
      [2, 4, 'v'],
      [1, 3, 'v'],
      [3, 4, 'h'],
    ]);
    expect(searchMidPath(g, edges, 0, 4, 'h', 'h')).toEqual([g[0], g[1], g[3], g[4]]);
  });

  it('pays for turning right at the start node', () => {
    // Both routes arrive along the goal axis. One turns at the start (+1) and is 10 px
    // longer; the other keeps the start axis with the same inner bends. Only the start
    // penalty tips it to the latter.
    const g = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ];
    const edges = linkGraph(g, [
      [0, 1, 'v', 60],
      [1, 5, 'h'],
      [5, 2, 'h'],
      [2, 3, 'v'],
      [0, 4, 'h'],
      [4, 5, 'v'],
    ]);
    expect(searchMidPath(g, edges, 0, 3, 'h', 'v')).toEqual([g[0], g[4], g[5], g[2], g[3]]);
  });

  describe('stub directions', () => {
    // Start (0,0) exits upwards. Going back down to y=30 first and straight across
    // to the goal ties with crossing at y=0 and descending: same length, same bends.
    const g = [
      { x: 0, y: 0 },
      { x: 0, y: 30 },
      { x: 100, y: 30 },
      { x: 100, y: 0 },
    ];
    const links: Array<[number, number, 'h' | 'v']> = [
      [0, 1, 'v'],
      [1, 2, 'h'],
      [0, 3, 'h'],
      [3, 2, 'v'],
    ];

    it('never turns back against the start stub', () => {
      const path = searchMidPath(g, linkGraph(g, links), 0, 2, 'v', 'v', { startDir: 'top' });
      expect(path).toEqual([g[0], g[3], g[2]]);
    });

    it('never reaches the goal moving outward from the target', () => {
      // Goal (100,0) is the entry above a target (outward side 'top'). The cheap
      // route climbs into it from (100,30), i.e. outward; the only other one wraps.
      const path = searchMidPath(g, linkGraph(g, links), 1, 3, 'h', 'v', { goalDir: 'top' });
      expect(path).toEqual([g[1], g[0], g[3]]);
    });

    it('ignores the stub direction on a free end', () => {
      const edges = linkGraph(g, [[0, 1, 'v']]);
      expect(searchMidPath(g, edges, 0, 1, null, null, { startDir: 'top' })).toEqual([g[0], g[1]]);
      expect(searchMidPath(g, edges, 0, 1, 'v', null, { startDir: 'top' })).toBeNull();
    });
  });

  it('expands few states on an open lattice (bend-aware heuristic)', () => {
    // 41×41 open grid; the optimum is one bend. A plain Manhattan heuristic ties every
    // one-bend state with the optimum and expands most of the grid.
    const size = 41;
    const grid: { x: number; y: number }[] = [];
    for (let ix = 0; ix < size; ix++) {
      for (let iy = 0; iy < size; iy++) grid.push({ x: ix * 10, y: iy * 10 });
    }
    const id = (ix: number, iy: number) => ix * size + iy;
    const links: Array<[number, number, 'h' | 'v']> = [];
    for (let ix = 0; ix < size; ix++) {
      for (let iy = 0; iy < size; iy++) {
        if (iy + 1 < size) links.push([id(ix, iy), id(ix, iy + 1), 'v']);
        if (ix + 1 < size) links.push([id(ix, iy), id(ix + 1, iy), 'h']);
      }
    }
    class CountingMap<K, V> extends Map<K, V> {
      gets = 0;
      override get(key: K): V | undefined {
        this.gets++;
        return super.get(key);
      }
    }
    const edges = new CountingMap<number, GraphEdge[]>(linkGraph(grid, links));
    const goal = id(size - 1, size - 1);
    const path = searchMidPath(grid, edges, 0, goal, 'h', 'v');
    expect(countBends(path!)).toBe(1);
    expect(path![path!.length - 2]!.x).toBe(grid[goal]!.x);
    expect(edges.gets).toBeLessThan(4 * size);
  });
});

describe('contourProximityPenalty', () => {
  it('an 800 px hug costs less than one bend', () => {
    const penalty = contourProximityPenalty({ x: 0, y: 0 }, { x: 800, y: 0 }, [
      { x: 0, y: 1, width: 800, height: 50 },
    ]);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThan(ROUTE_BEND_COST);
  });
});
