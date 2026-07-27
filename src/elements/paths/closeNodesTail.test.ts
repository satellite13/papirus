import { describe, it, expect } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { clampFacingExitEntry } from './routeOrthogonalAround';

describe('close stacked nodes (no exit stub / tail)', () => {
  const s = new PolylinePathStrategy();
  const pad = (
    n: { id: string; x: number; y: number; width: number; height: number },
    role?: 'source' | 'target'
  ) => ({
    id: n.id,
    x: n.x - 8,
    y: n.y - 8,
    width: n.width + 16,
    height: n.height + 16,
    ...(role ? { role } : {}),
  });

  function hasUTurn(path: { x: number; y: number }[]): boolean {
    for (let i = 0; i + 2 < path.length; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const c = path[i + 2]!;
      const v1x = b.x - a.x;
      const v1y = b.y - a.y;
      const v2x = c.x - b.x;
      const v2y = c.y - b.y;
      const dot = v1x * v2x + v1y * v2y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);
      if (len1 > 0.5 && len2 > 0.5 && dot < -0.01 * len1 * len2) {
        return true;
      }
    }
    return false;
  }

  it('clampFacingExitEntry meets stubs in the mid-gap when they would cross', () => {
    const clamped = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 165 }
    );
    expect(clamped.startExit.y).toBe(172.5);
    expect(clamped.endEntry.y).toBe(172.5);
    expect(clamped.startExit.y).toBeLessThanOrEqual(clamped.endEntry.y);
  });

  it('Start above Process with gap < 2×exitDistance has no U-turn stub', () => {
    const start = { id: 'start', x: 100, y: 100, width: 120, height: 60 };
    for (const gap of [40, 30, 25, 20, 15, 10, 5]) {
      const process = { id: 'process', x: 110, y: 160 + gap, width: 140, height: 64 };
      const from = { x: 160, y: 160 };
      const to = { x: 180, y: process.y };
      const obstacles = [pad(start, 'source'), pad(process, 'target')];
      const path = s.calculatePath(from, to, 'bottom', 'top', { obstacles });
      expect(hasUTurn(path), `gap ${gap}: ${JSON.stringify(path)}`).toBe(false);
      expect(path[0]).toEqual(from);
      expect(path[path.length - 1]).toEqual(to);
    }
  });
});
