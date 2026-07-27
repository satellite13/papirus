import { describe, expect, it } from 'vitest';
import { routeOrthogonalAround } from './routeOrthogonalAround';

const parent = { id: 'parent', x: 160, y: 200, width: 220, height: 160 };
const target = { id: 'bp', x: 40, y: 40, width: 400, height: 50 };

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
    expect(pre.y).toBeGreaterThan(to.y); // outside below bottom edge
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
