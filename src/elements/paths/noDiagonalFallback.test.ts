import { describe, it, expect } from 'vitest';
import {
  ensureOrthogonalPath,
  routeOrthogonalAround,
} from './routeOrthogonalAround';
import { PolylinePathStrategy } from './PolylinePathStrategy';

function assertOrtho(path: { x: number; y: number }[], label: string): void {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const ok = Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01;
    expect(ok, `${label}: diagonal ${a.x},${a.y}→${b.x},${b.y}`).toBe(true);
  }
}

describe('no diagonal polyline segments', () => {
  it('ensureOrthogonalPath inserts elbow', () => {
    const path = ensureOrthogonalPath([
      { x: 1243, y: 544 },
      { x: 973, y: 199 },
    ]);
    expect(path.length).toBe(3);
    assertOrtho(path, 'elbow');
  });

  it('reproduces warchi log: top→left must stay orthogonal', () => {
    // Geometry from [papirus:route] log: path had DIAG 1243,544 → 973,199
    const from = { x: 1243, y: 564 };
    const to = { x: 993, y: 199 };
    const source = { id: 'src', x: 1180, y: 564, width: 140, height: 80 };
    const target = { id: 'tgt', x: 993, y: 160, width: 200, height: 80 };
    const path = routeOrthogonalAround({
      from,
      to,
      fromDir: 'top',
      toDir: 'left',
      source,
      target,
      margin: 4,
      exitDistance: 20,
    });
    assertOrtho(path, 'around');
    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('PolylinePathStrategy top→left with many obstacles stays orthogonal', () => {
    const s = new PolylinePathStrategy();
    const pad = (
      n: { id: string; x: number; y: number; width: number; height: number },
      role?: 'source' | 'target' | 'other'
    ) => ({
      id: n.id,
      x: n.x - 4,
      y: n.y - 4,
      width: n.width + 8,
      height: n.height + 8,
      role: role ?? ('other' as const),
    });
    const source = { id: 'src', x: 1180, y: 564, width: 140, height: 80 };
    const target = { id: 'tgt', x: 993, y: 160, width: 200, height: 80 };
    const clutter = [
      { id: 'c1', x: 900, y: 300, width: 120, height: 60 },
      { id: 'c2', x: 1100, y: 350, width: 100, height: 50 },
      { id: 'c3', x: 1050, y: 450, width: 80, height: 40 },
    ];
    const path = s.calculatePath({ x: 1243, y: 564 }, { x: 993, y: 199 }, 'top', 'left', {
      obstacles: [
        pad(target, 'target'),
        pad(source, 'source'),
        ...clutter.map((c) => pad(c)),
      ],
    });
    assertOrtho(path, 'strategy');
  });
});
