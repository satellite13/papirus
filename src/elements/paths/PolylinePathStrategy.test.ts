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
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 100 };
    const path = strategy.calculatePath(from, to, 'right', 'top');
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
    // Exit along fromDir (right), arrive along toDir (top → vertical).
    expect(path[1]!.x).toBeGreaterThan(from.x);
    expect(Math.abs(path[1]!.y - from.y)).toBeLessThan(0.5);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(pre.y).toBeLessThan(to.y);
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

  it('routes left→bottom around parent without crossing via routeOrthogonalAround', () => {
    const path = strategy.calculatePath(
      { x: 200, y: 260 },
      { x: 280, y: 90 },
      'left',
      'bottom',
      {
        obstacles: [
          { id: 'parent', x: 160, y: 200, width: 220, height: 160, role: 'other' },
          { id: 'bp', x: 40, y: 40, width: 400, height: 50, role: 'target' },
        ],
      }
    );
    expect(path[1]!.x).toBeLessThan(200);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - 280)).toBeLessThan(0.5);
    expect(pre.y).toBeGreaterThan(90);
  });
});
