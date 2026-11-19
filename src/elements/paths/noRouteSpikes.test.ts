import { describe, expect, it } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import type { PathObstacle } from './PathStrategy';

type P = { x: number; y: number };
type Rect = { id: string; x: number; y: number; width: number; height: number };
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function anchor(r: Rect, side: string): P {
  switch (side) {
    case 'top':
      return { x: r.x + r.width / 2, y: r.y };
    case 'bottom':
      return { x: r.x + r.width / 2, y: r.y + r.height };
    case 'left':
      return { x: r.x, y: r.y + r.height / 2 };
    default:
      return { x: r.x + r.width, y: r.y + r.height / 2 };
  }
}

function pad(r: Rect, role: PathObstacle['role']): PathObstacle {
  return { id: r.id, x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8, role };
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

/** 180° turns: consecutive non-zero segments pointing in opposite directions. */
function reversals(path: P[]): number {
  let n = 0;
  let px = 0;
  let py = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i]!.x - path[i - 1]!.x;
    const dy = path[i]!.y - path[i - 1]!.y;
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) continue;
    if (px * dx + py * dy < 0) n++;
    px = dx;
    py = dy;
  }
  return n;
}

/** Source at a fixed spot; target and an optional blocker swept around it. */
function* layouts(): Generator<{ a: Rect; b: Rect; others: Rect[] }> {
  const a: Rect = { id: 'a', x: 100, y: 100, width: 100, height: 60 };
  for (const bx of [-220, -60, 40, 140, 320]) {
    for (const by of [-160, -40, 100, 200, 300]) {
      const b: Rect = { id: 'b', x: bx, y: by, width: 120, height: 70 };
      if (overlaps(a, b, 8)) continue;
      yield { a, b, others: [] };
      const mid: Rect = {
        id: 'o',
        x: (a.x + b.x + b.width / 2) / 2,
        y: (a.y + b.y + b.height / 2) / 2,
        width: 50,
        height: 30,
      };
      if (!overlaps(mid, a, 8) && !overlaps(mid, b, 8)) yield { a, b, others: [mid] };
    }
  }
}

function spikes(mode: 'fromOnly' | 'toOnly'): string[] {
  const strategy = new PolylinePathStrategy();
  const bad: string[] = [];
  for (const { a, b, others } of layouts()) {
    const obstacles = [pad(a, 'source'), pad(b, 'target'), ...others.map((o) => pad(o, 'other'))];
    for (const fs of SIDES) {
      for (const ts of SIDES) {
        const from = anchor(a, fs);
        const to = anchor(b, ts);
        const path = strategy.calculatePath(
          from,
          to,
          mode === 'fromOnly' ? fs : undefined,
          mode === 'toOnly' ? ts : undefined,
          { obstacles }
        );
        if (reversals(path) > 0) {
          bad.push(`${fs}->${ts} b=(${b.x},${b.y}) others=${others.length}: ${JSON.stringify(path)}`);
        }
      }
    }
  }
  return bad;
}

describe('auto polyline routes never turn back 180°', () => {
  it('leaves a top port without dipping back towards the source', () => {
    const a: Rect = { id: 'a', x: 100, y: 100, width: 99, height: 57 };
    const b: Rect = { id: 'b', x: 376, y: 163, width: 152, height: 79 };
    const others: Rect[] = [
      { id: 'o0', x: -113, y: 187, width: 126, height: 44 },
      { id: 'o1', x: 127, y: -113, width: 141, height: 44 },
      { id: 'o2', x: -153, y: -108, width: 140, height: 38 },
    ];
    const path = new PolylinePathStrategy().calculatePath(
      { x: 149.5, y: 100 },
      { x: 376, y: 202.5 },
      'top',
      undefined,
      { obstacles: [pad(a, 'source'), pad(b, 'target'), ...others.map((o) => pad(o, 'other'))] }
    );
    expect(reversals(path), JSON.stringify(path)).toBe(0);
    expect(path[1]!.y).toBeLessThan(100);
  });

  it('with only fromDir', () => {
    const bad = spikes('fromOnly');
    expect(bad, bad.slice(0, 3).join('\n')).toEqual([]);
  });

  it('with only toDir', () => {
    const bad = spikes('toOnly');
    expect(bad, bad.slice(0, 3).join('\n')).toEqual([]);
  });
});
