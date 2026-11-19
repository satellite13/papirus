import { describe, it, expect } from 'vitest';
import { reduceOrthogonalBends } from './reduceOrthogonalBends';
import { countBends } from './routeCost';
import { segmentIntersectsOpenInterior, type RouteRect } from './routeOrthogonalAround';

const staircase = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 30 },
  { x: 60, y: 30 },
  { x: 60, y: 60 },
  { x: 100, y: 60 },
  { x: 100, y: 84 },
  { x: 100, y: 100 },
];

function hits(path: { x: number; y: number }[], obstacles: RouteRect[]): boolean {
  for (let i = 1; i < path.length; i++) {
    if (obstacles.some((o) => segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, o))) {
      return true;
    }
  }
  return false;
}

function reversalCount(path: readonly { x: number; y: number }[]): number {
  let n = 0;
  let prev: { dx: number; dy: number } | null = null;
  for (let i = 1; i < path.length; i++) {
    const dx = Math.sign(path[i]!.x - path[i - 1]!.x);
    const dy = Math.sign(path[i]!.y - path[i - 1]!.y);
    if (dx === 0 && dy === 0) continue;
    if (prev && prev.dx === -dx && prev.dy === -dy) n++;
    prev = { dx, dy };
  }
  return n;
}

function hasReversal(path: { x: number; y: number }[]): boolean {
  return reversalCount(path) > 0;
}

function direction(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
}

describe('reduceOrthogonalBends', () => {
  it('never reverses into the end stub', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 90 },
      { x: 100, y: 90 },
      { x: 130, y: 90 },
      { x: 130, y: 84 },
      { x: 100, y: 84 },
      { x: 100, y: 100 },
    ];
    const obstacles: RouteRect[] = [
      { x: 76, y: 96, width: 48, height: 48 },
      { x: 40, y: 70, width: 40, height: 18 },
      { x: 90, y: 20, width: 20, height: 40 },
    ];
    const result = reduceOrthogonalBends(path, obstacles);
    const last = [result[result.length - 2]!, result[result.length - 1]!];
    expect(last[0]!.x).toBe(100);
    expect(last[1]!.y - last[0]!.y).toBeGreaterThanOrEqual(16);
    expect(hasReversal(result)).toBe(false);
    expect(hits(result, obstacles.slice(1))).toBe(false);
  });

  it('never reverses out of the start stub', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: -50 },
      { x: -60, y: -50 },
      { x: -60, y: 0 },
      { x: -100, y: 0 },
      { x: -100, y: 30 },
      { x: -100, y: 50 },
    ];
    const result = reduceOrthogonalBends(path, []);
    expect(result[1]!.y).toBe(0);
    expect(result[1]!.x).toBeGreaterThan(0);
    expect(hasReversal(result)).toBe(false);
    expect(countBends(result)).toBeLessThan(countBends(path));
  });

  it('never flips a stub direction or adds a U-turn to an input that has one', () => {
    const startSpike = [
      { x: 200, y: 300 },
      { x: 232, y: 300 },
      { x: 147, y: 300 },
      { x: 147, y: 96 },
      { x: 280, y: 96 },
      { x: 280, y: 80 },
    ];
    const obstacles: RouteRect[] = [{ x: 156, y: 136, width: 208, height: 148 }];
    const bothSpikes = [
      { x: 100, y: 120 },
      { x: 80, y: 120 },
      { x: 176, y: 120 },
      { x: 160, y: 120 },
    ];
    for (const [path, obs] of [
      [startSpike, obstacles],
      [bothSpikes, []],
    ] as const) {
      const result = reduceOrthogonalBends([...path], [...obs]);
      const n = path.length;
      const m = result.length;
      expect(result[0]).toEqual(path[0]);
      expect(result[m - 1]).toEqual(path[n - 1]);
      expect(direction(result[0]!, result[1]!)).toEqual(direction(path[0]!, path[1]!));
      expect(direction(result[m - 2]!, result[m - 1]!)).toEqual(
        direction(path[n - 2]!, path[n - 1]!)
      );
      expect(reversalCount(result)).toBeLessThanOrEqual(reversalCount(path));
      expect(hits(result, [...obs])).toBe(false);
    }
  });

  it('collapses a staircase into an L', () => {
    expect(reduceOrthogonalBends(staircase, [])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('rejects bridges through obstacles', () => {
    const obstacles: RouteRect[] = [{ x: 40, y: -20, width: 80, height: 40 }];
    const result = reduceOrthogonalBends(staircase, obstacles);
    expect(hits(result, obstacles)).toBe(false);
    expect(countBends(result)).toBe(3);
    expect(countBends(result)).toBeLessThan(countBends(staircase));
  });

  it('keeps first/last segment directions and never shortens the end stub', () => {
    const obstacles: RouteRect[] = [{ x: 40, y: -20, width: 80, height: 40 }];
    const result = reduceOrthogonalBends(staircase, obstacles);
    const first = [result[0]!, result[1]!];
    const last = [result[result.length - 2]!, result[result.length - 1]!];
    expect(first[1]!.y).toBe(0);
    expect(first[1]!.x).toBeGreaterThan(0);
    expect(last[0]!.x).toBe(100);
    expect(last[1]!.y - last[0]!.y).toBeGreaterThanOrEqual(16);
  });

  it('cuts a loop that returns to the same point without duplicate vertices', () => {
    const loop = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(reduceOrthogonalBends(loop, [])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ]);
  });

  it('leaves a minimal path unchanged (only colinear cleanup)', () => {
    const z = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 84, y: 50 },
      { x: 100, y: 50 },
    ];
    expect(reduceOrthogonalBends(z, [])).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
  });

  it('returns short and non-orthogonal paths as is', () => {
    const short = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(reduceOrthogonalBends(short, [])).toBe(short);
    const diagonal = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 20 }, { x: 30, y: 20 }];
    expect(reduceOrthogonalBends(diagonal, [])).toBe(diagonal);
  });
});
