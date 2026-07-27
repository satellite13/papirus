import { describe, expect, it } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { routeOrthogonalAround, segmentIntersectsOpenInterior } from './routeOrthogonalAround';

/**
 * Device below OS, both ends on the TOP side — path must wrap around OS,
 * not drop a vertical through its body.
 */
describe('wrap around target (top→top)', () => {
  const parent = { id: 'tech', x: 40, y: 40, width: 280, height: 320 };
  const platform = { id: 'platform', x: 80, y: 60, width: 200, height: 60 };
  const os = { id: 'os', x: 80, y: 150, width: 200, height: 60 };
  const device = { id: 'device', x: 80, y: 240, width: 200, height: 60 };
  const from = { x: 180, y: device.y };
  const to = { x: 180, y: os.y };

  function hitsOs(path: { x: number; y: number }[]): boolean {
    for (let i = 1; i < path.length; i++) {
      if (segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, os)) return true;
    }
    return false;
  }

  it('routeOrthogonalAround alone wraps', () => {
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'top',
      toDir: 'top',
      parent,
      source: device,
      target: os,
      margin: 4,
      exitDistance: 20,
    });
    expect(hitsOs(path)).toBe(false);
  });

  it('with sibling others, same-side align must not pierce OS', () => {
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'top',
      toDir: 'top',
      parent,
      source: device,
      target: os,
      others: [platform],
      margin: 4,
      exitDistance: 20,
    });
    expect(hitsOs(path), path.map((p) => `${p.x},${p.y}`).join('→')).toBe(false);
  });

  it('PolylinePathStrategy with full stack obstacles wraps', () => {
    const strategy = new PolylinePathStrategy();
    const path = strategy.calculatePath(from, to, 'top', 'top', {
      obstacles: [
        { ...parent, role: 'other' as const },
        { ...platform, role: 'other' as const },
        { ...device, role: 'source' as const },
        { ...os, role: 'target' as const },
      ],
    });
    expect(hitsOs(path), path.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join('→')).toBe(
      false
    );
  });
});
