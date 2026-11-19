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

describe('reduceOrthogonalBends', () => {
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
