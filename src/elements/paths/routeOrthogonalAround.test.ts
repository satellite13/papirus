import { describe, expect, it } from 'vitest';
import { routeOrthogonalAround } from './routeOrthogonalAround';

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
