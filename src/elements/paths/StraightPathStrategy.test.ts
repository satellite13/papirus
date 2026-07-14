import { describe, expect, it } from 'vitest';
import { StraightPathStrategy } from './StraightPathStrategy';

describe('StraightPathStrategy', () => {
  const strategy = new StraightPathStrategy();

  it('returns the two endpoints', () => {
    expect(strategy.calculatePath({ x: 1, y: 2 }, { x: 10, y: 20 })).toEqual([
      { x: 1, y: 2 },
      { x: 10, y: 20 },
    ]);
  });

  it('hit-tests a point near the line', () => {
    const path = strategy.calculatePath({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(strategy.hitTest({ x: 5, y: 1 }, path, 2)).toBe(true);
    expect(strategy.hitTest({ x: 5, y: 5 }, path, 2)).toBe(false);
    expect(strategy.hitTest({ x: 0, y: 0 }, [], 2)).toBe(false);
  });
});
