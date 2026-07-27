import { describe, it, expect } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';

describe('Start stacked under Process (no entry spur)', () => {
  const s = new PolylinePathStrategy();
  const process = { id: 'process', x: 100, y: 80, width: 140, height: 64 };
  const start = { id: 'start', x: 100, y: 220, width: 120, height: 60 };
  const pad = (n: typeof start, role?: 'source' | 'target') => ({
    id: n.id,
    x: n.x - 8,
    y: n.y - 8,
    width: n.width + 16,
    height: n.height + 16,
    ...(role ? { role } : {}),
  });

  function hasSpur(path: { x: number; y: number }[]): boolean {
    for (let i = 0; i + 2 < path.length; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const c = path[i + 2]!;
      const colinearV = Math.abs(a.x - b.x) < 0.001 && Math.abs(b.x - c.x) < 0.001;
      const colinearH = Math.abs(a.y - b.y) < 0.001 && Math.abs(b.y - c.y) < 0.001;
      if (
        (colinearV && ((b.y < a.y && a.y < c.y) || (c.y < a.y && a.y < b.y))) ||
        (colinearH && ((b.x < a.x && a.x < c.x) || (c.x < a.x && a.x < b.x)))
      ) {
        return true;
      }
    }
    return false;
  }

  it('right→top into Process has no overshoot spur above the top port', () => {
    const from = { x: 220, y: 250 };
    const to = { x: 170, y: 80 };
    const path = s.calculatePath(from, to, 'right', 'top', {
      obstacles: [pad(start, 'source'), pad(process, 'target')],
    });
    expect(hasSpur(path), `path=${path.map((p) => `${p.x},${p.y}`).join(' → ')}`).toBe(false);
    const pre = path[path.length - 2]!;
    expect(Math.abs(pre.x - to.x)).toBeLessThan(0.5);
    expect(pre.y).toBeLessThan(to.y);
  });
});
