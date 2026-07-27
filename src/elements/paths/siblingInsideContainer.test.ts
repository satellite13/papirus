import { describe, expect, it } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { routeOrthogonalAround, segmentIntersectsOpenInterior } from './routeOrthogonalAround';

/**
 * ArchiMate stack inside a Technology container:
 * Platform sw ↔ Device with Operating System between them.
 * Left→left elbow must not pierce the middle sibling.
 *
 * Connection points are often slightly inset from the outer box (composite
 * outline / port). A fixed 20px exit then still lands inside a left-aligned
 * sibling — the router must push past those `other` obstacles.
 */
describe('sibling obstacles inside container', () => {
  const parent = { id: 'tech', x: 40, y: 40, width: 280, height: 320 };
  const platform = { id: 'platform', x: 80, y: 60, width: 200, height: 60 };
  const os = { id: 'os', x: 80, y: 150, width: 200, height: 60 };
  const device = { id: 'device', x: 80, y: 240, width: 200, height: 60 };

  function pathHitsOs(path: { x: number; y: number }[]): boolean {
    for (let i = 1; i < path.length; i++) {
      if (segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, os)) return true;
    }
    return false;
  }

  // Attachment deep enough that exitDistance 20 still sits inside OS x-range.
  const fromInset = { x: platform.x + 40, y: platform.y + platform.height / 2 };
  const toInset = { x: device.x + 40, y: device.y + device.height / 2 };

  it('with others, inset left→left clears middle sibling even without source', () => {
    const path = routeOrthogonalAround({
      from: fromInset,
      to: toInset,
      fromDir: 'left',
      toDir: 'left',
      target: { ...device, id: 'device' },
      others: [{ ...os, id: 'os' }],
      margin: 4,
      exitDistance: 20,
    });
    expect(pathHitsOs(path)).toBe(false);
  });

  it('PolylinePathStrategy: siblings as other + internal parent still miss OS', () => {
    const strategy = new PolylinePathStrategy();
    const from = fromInset;
    const to = toInset;
    const path = strategy.calculatePath(from, to, 'left', 'left', {
      obstacles: [
        { ...parent, id: 'tech', role: 'other' as const },
        { ...platform, id: 'platform', role: 'source' as const },
        { ...os, id: 'os', role: 'other' as const },
        { ...device, id: 'device', role: 'target' as const },
      ],
    });
    expect(pathHitsOs(path)).toBe(false);
    // Internal edge: prefer corridor inside container, not a full outer wrap.
    const minX = Math.min(...path.map((p) => p.x));
    expect(minX).toBeGreaterThan(parent.x - 30);
  });

  it('PolylinePathStrategy: wider middle sibling forces corridor past source left', () => {
    // OS sticks out further left — source-only exit is not enough.
    const wideOs = { id: 'os', x: 50, y: 150, width: 230, height: 60 };
    const strategy = new PolylinePathStrategy();
    const path = strategy.calculatePath(fromInset, toInset, 'left', 'left', {
      obstacles: [
        { ...parent, id: 'tech', role: 'other' as const },
        { ...platform, id: 'platform', role: 'source' as const },
        { ...wideOs, role: 'other' as const },
        { ...device, id: 'device', role: 'target' as const },
      ],
    });
    for (let i = 1; i < path.length; i++) {
      expect(
        segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, wideOs),
        `segment ${i - 1}→${i} hits wide OS`
      ).toBe(false);
    }
    const minX = Math.min(...path.map((p) => p.x));
    expect(minX).toBeLessThan(wideOs.x);
    expect(minX).toBeGreaterThan(parent.x - 30);
  });

  it('nested parents: right→right serving stays inside outer, does not wrap canvas', () => {
    // Outer listed first (Map insertion order) — old find() picked it and
    // computeStartExit pushed past both containers onto the canvas.
    const outer = { id: 'outer', x: 0, y: 0, width: 520, height: 420 };
    const inner = { id: 'inner', x: 40, y: 40, width: 280, height: 320 };
    const osNode = { id: 'os', x: 80, y: 150, width: 200, height: 60 };
    const platformNode = { id: 'platform', x: 80, y: 60, width: 200, height: 60 };
    const from = { x: osNode.x + osNode.width - 8, y: osNode.y + osNode.height / 2 };
    const to = {
      x: platformNode.x + platformNode.width - 8,
      y: platformNode.y + platformNode.height / 2,
    };
    const strategy = new PolylinePathStrategy();
    const path = strategy.calculatePath(from, to, 'right', 'right', {
      obstacles: [
        { ...outer, role: 'other' as const },
        { ...inner, role: 'other' as const },
        { ...osNode, role: 'source' as const },
        { ...platformNode, role: 'target' as const },
        { ...device, role: 'other' as const },
      ],
    });
    const maxX = Math.max(...path.map((p) => p.x));
    expect(maxX).toBeLessThan(outer.x + outer.width);
    // Prefer a short elbow near the stack, not a wrap around the inner box.
    expect(maxX).toBeLessThan(inner.x + inner.width + 40);
  });
});
