import { describe, expect, it } from 'vitest';
import { routeOrthogonalAround } from './routeOrthogonalAround';

describe('same-side exit order (no side-lick at source)', () => {
  const platform = { id: 'platform', x: 80, y: 60, width: 200, height: 60 };
  const os = { id: 'os', x: 80, y: 150, width: 200, height: 60 };
  const device = { id: 'device', x: 80, y: 240, width: 200, height: 60 };

  function assertNoFaceLickAtSource(
    path: { x: number; y: number }[],
    from: { x: number; y: number },
    fromDir: 'left' | 'right'
  ): void {
    expect(path[0]).toEqual(from);
    const a = path[0]!;
    const b = path[1]!;
    if (fromDir === 'left') {
      expect(b.x).toBeLessThan(a.x - 3);
    } else {
      expect(b.x).toBeGreaterThan(a.x + 3);
    }
    expect(Math.abs(b.y - a.y)).toBeLessThan(1);

    // No long vertical glued to the source side face
    for (let i = 1; i < path.length; i++) {
      const p = path[i - 1]!;
      const q = path[i]!;
      if (Math.abs(p.x - q.x) < 0.5 && Math.abs(p.x - from.x) < 0.5) {
        expect(Math.abs(p.y - q.y), `vertical lick ${p.y}→${q.y} at x=${p.x}`).toBeLessThan(
          platform.height
        );
      }
    }
  }

  it('left→left: first bend exits left of source, not along its left face', () => {
    const from = { x: platform.x, y: platform.y + 30 };
    const to = { x: device.x, y: device.y + 30 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'left',
      toDir: 'left',
      source: platform,
      target: device,
      others: [os],
      margin: 4,
      exitDistance: 20,
    });
    assertNoFaceLickAtSource(path, from, 'left');
  });

  it('right→right: first bend exits right of source, not along its right face', () => {
    const from = { x: platform.x + platform.width, y: platform.y + 30 };
    const to = { x: device.x + device.width, y: device.y + 30 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'right',
      toDir: 'right',
      source: platform,
      target: device,
      others: [os],
      margin: 4,
      exitDistance: 20,
    });
    assertNoFaceLickAtSource(path, from, 'right');
  });
});
