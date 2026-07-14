import { describe, expect, it } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';

describe('PolylinePathStrategy', () => {
  const strategy = new PolylinePathStrategy();

  it('routes horizontal-dominant endpoints through vertical bends', () => {
    expect(strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 20 })).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 20 },
    ]);
  });

  it('routes vertical-dominant endpoints through horizontal bends', () => {
    expect(strategy.calculatePath({ x: 0, y: 0 }, { x: 20, y: 100 })).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 20, y: 50 },
      { x: 20, y: 100 },
    ]);
  });

  it('uses editable control points or creates a midpoint', () => {
    expect(
      strategy.calculatePath(
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        undefined,
        undefined,
        { editablePolyline: true, controlPoints: [{ x: 5, y: 8 }] }
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 8 },
      { x: 20, y: 20 },
    ]);
    expect(
      strategy.calculatePath(
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        undefined,
        undefined,
        { editablePolyline: true }
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]);
  });

  it('creates a directed orthogonal route', () => {
    const path = strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 'right', 'top');
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('creates a self-loop outside the endpoint', () => {
    const path = strategy.calculatePath(
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      'bottom',
      'bottom',
      { selfLoop: true }
    );
    expect(path).toHaveLength(4);
    expect(path[1]!.y).toBeGreaterThan(10);
  });

  it('hit-tests every segment', () => {
    const path = strategy.calculatePath({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(strategy.hitTest({ x: 50, y: 10 }, path, 1)).toBe(true);
    expect(strategy.hitTest({ x: 75, y: 50 }, path, 1)).toBe(false);
  });
});
