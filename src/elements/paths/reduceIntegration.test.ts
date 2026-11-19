import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./reduceOrthogonalBends', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reduceOrthogonalBends')>();
  return { ...actual, reduceOrthogonalBends: vi.fn(actual.reduceOrthogonalBends) };
});

import { reduceOrthogonalBends } from './reduceOrthogonalBends';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { segmentIntersectsOpenInterior } from './routeOrthogonalAround';

const spy = vi.mocked(reduceOrthogonalBends);
const s = new PolylinePathStrategy();
const pad = (
  r: { x: number; y: number; width: number; height: number },
  role: 'source' | 'target' | 'other' = 'other'
) => ({ x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8, role });

const a = { x: 100, y: 100, width: 100, height: 60 };
const b = { x: 360, y: 220, width: 100, height: 60 };

beforeEach(() => {
  spy.mockClear();
});

describe('reduceOrthogonalBends integration', () => {
  it('runs on auto routes', () => {
    const path = s.calculatePath({ x: 200, y: 130 }, { x: 360, y: 250 }, 'right', 'left', {
      obstacles: [pad(a, 'source'), pad(b, 'target')],
    });
    expect(path.length).toBeGreaterThan(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skips editable polylines and self-loop templates', () => {
    s.calculatePath({ x: 0, y: 0 }, { x: 100, y: 100 }, 'right', 'left', {
      editablePolyline: true,
      controlPoints: [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    });
    s.calculatePath({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 'top', 'top', { selfLoop: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it('skips nested edges leaving a container', () => {
    const container = { x: 60, y: 60, width: 200, height: 200 };
    const target = { x: 500, y: 300, width: 100, height: 60 };
    const wall = pad(container);
    const path = s.calculatePath({ x: 200, y: 130 }, { x: 500, y: 330 }, 'right', 'left', {
      obstacles: [wall, pad(a, 'source'), pad(target, 'target')],
    });
    expect(path.length).toBeGreaterThan(3);
    expect(spy).not.toHaveBeenCalled();
    // Leaves through the right wall on the anchor row, never re-enters or grazes the sides.
    expect(path[1]!.y).toBe(130);
    expect(path[1]!.x).toBeGreaterThan(wall.x + wall.width);
    for (let i = 2; i < path.length; i++) {
      expect(segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, wall)).toBe(false);
    }
  });

  it('ignores a container holding both ends', () => {
    const container = { x: 0, y: 0, width: 800, height: 600 };
    s.calculatePath({ x: 200, y: 130 }, { x: 360, y: 250 }, 'right', 'left', {
      obstacles: [pad(container), pad(a, 'source'), pad(b, 'target')],
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const checks = spy.mock.calls[0]![1];
    expect(checks.some((r) => r.width >= 800)).toBe(false);
    expect(checks).toHaveLength(2);
  });
});
