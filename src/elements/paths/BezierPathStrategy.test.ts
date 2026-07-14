import { describe, expect, it } from 'vitest';
import { BezierPathStrategy } from './BezierPathStrategy';

describe('BezierPathStrategy', () => {
  const strategy = new BezierPathStrategy();

  it('creates an automatic cubic path', () => {
    const path = strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(path).toHaveLength(4);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[3]).toEqual({ x: 100, y: 20 });
  });

  it('uses endpoint directions for control points', () => {
    expect(strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left')).toEqual(
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]
    );
  });

  it('accepts explicit cubic control points', () => {
    expect(
      strategy.calculatePath(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        undefined,
        undefined,
        { controlPoints: [{ x: 2, y: 0 }, { x: 8, y: 10 }] }
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 8, y: 10 },
      { x: 10, y: 10 },
    ]);
  });

  it('creates an outer self-loop', () => {
    const path = strategy.calculatePath(
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      'top',
      'top',
      { selfLoop: true }
    );
    expect(path).toHaveLength(4);
    expect(path[1]!.y).toBeLessThan(10);
  });

  it('hit-tests a sampled curve', () => {
    const path = strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left');
    expect(strategy.hitTest({ x: 50, y: 0 }, path, 2)).toBe(true);
    expect(strategy.hitTest({ x: 50, y: 30 }, path, 2)).toBe(false);
    expect(strategy.hitTest({ x: 0, y: 0 }, path.slice(0, 3), 2)).toBe(false);
  });
});
