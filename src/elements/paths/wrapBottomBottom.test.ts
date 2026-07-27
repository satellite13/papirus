import { describe, expect, it } from 'vitest';
import { routeOrthogonalAround, segmentIntersectsOpenInterior } from './routeOrthogonalAround';

describe('wrap around (bottom→bottom)', () => {
  const os = { id: 'os', x: 80, y: 150, width: 200, height: 60 };
  const device = { id: 'device', x: 80, y: 240, width: 200, height: 60 };
  const from = { x: 180, y: device.y + device.height };
  const to = { x: 180, y: os.y + os.height };

  it('does not pierce either endpoint', () => {
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'bottom',
      toDir: 'bottom',
      source: device,
      target: os,
      margin: 4,
      exitDistance: 20,
    });
    for (let i = 1; i < path.length; i++) {
      expect(segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, os)).toBe(false);
      expect(segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, device)).toBe(false);
    }
  });
});
