import { describe, it, expect } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { segmentIntersectsOpenInterior } from './routeOrthogonalAround';

describe('basic-example polyline routing', () => {
  const s = new PolylinePathStrategy();
  const start = { id: 'start', x: 100, y: 100, width: 120, height: 60 };
  const process = { id: 'process', x: 300, y: 100, width: 140, height: 60 };
  const check = { id: 'check', x: 520, y: 80, width: 100, height: 100 };
  const error = { id: 'error', x: 520, y: 280, width: 120, height: 60 };
  const end = { id: 'end', x: 700, y: 100, width: 80, height: 60 };
  const pad = (n: typeof start, role?: 'target' | 'other' | 'source') => ({
    id: n.id,
    x: n.x - 8,
    y: n.y - 8,
    width: n.width + 16,
    height: n.height + 16,
    ...(role ? { role } : {}),
  });

  it('Start(top)→Process does not cut back through Start', () => {
    const obstacles = [
      pad(start, 'source'),
      pad(process, 'target'),
      pad(check),
      pad(error),
      pad(end),
    ];
    const path = s.calculatePath(
      { x: 160, y: 100 },
      { x: 300, y: 130 },
      'top',
      'left',
      { obstacles }
    );
    // After the exit stub, no segment may re-enter Start's body.
    for (let i = 2; i < path.length; i++) {
      expect(
        segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, start),
        `segment ${i - 1}→${i} crosses Start`
      ).toBe(false);
    }
    // Stays above Start until past its right edge.
    expect(path[1]!.y).toBeLessThan(start.y);
    expect(path.some((p) => p.y < start.y && p.x >= start.x + start.width)).toBe(true);
  });

  it('Check(bottom)→Error(top) is a short orthogonal approach', () => {
    const obstacles = [
      pad(start),
      pad(process),
      pad(check, 'source'),
      pad(error, 'target'),
      pad(end),
    ];
    const path = s.calculatePath(
      { x: 570, y: 180 },
      { x: 580, y: 280 },
      'bottom',
      'top',
      { obstacles }
    );
    const pre = path[path.length - 2]!;
    expect(pre.y).toBeLessThan(280);
    expect(Math.abs(pre.x - 580)).toBeLessThan(0.5);
    for (let i = 1; i < path.length; i++) {
      expect(segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, error)).toBe(false);
    }
  });
});
