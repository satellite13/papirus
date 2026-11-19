import { describe, expect, it } from 'vitest';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import type { PathObstacle } from './PathStrategy';

type Rect = { id: string; x: number; y: number; width: number; height: number };

function anchor(r: Rect, side: string): { x: number; y: number } {
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

/** Grid of nodes with edges between near neighbours, sides facing each other (drag frame). */
function dragFrame(cols: number, rows: number, edgeCount: number): () => void {
  let seed = 777;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const nodes: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({
        id: `n${r}_${c}`,
        x: c * 200 + Math.floor(rnd() * 40),
        y: r * 140 + Math.floor(rnd() * 30),
        width: 120,
        height: 60,
      });
    }
  }
  const padded: PathObstacle[] = nodes.map((n) => ({
    id: n.id,
    x: n.x - 4,
    y: n.y - 4,
    width: n.width + 8,
    height: n.height + 8,
    role: 'other',
  }));
  const jobs: Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    fs: string;
    ts: string;
    obstacles: PathObstacle[];
  }> = [];
  while (jobs.length < edgeCount) {
    const i = Math.floor(rnd() * nodes.length);
    const j = i + (Math.floor(rnd() * 5) - 2) * cols + (Math.floor(rnd() * 5) - 2);
    if (j < 0 || j >= nodes.length || j === i) continue;
    const a = nodes[i]!;
    const b = nodes[j]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const [fs, ts] =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? ['right', 'left']
          : ['left', 'right']
        : dy > 0
          ? ['bottom', 'top']
          : ['top', 'bottom'];
    const obstacles = padded.map((o) =>
      o.id === a.id
        ? { ...o, role: 'source' as const }
        : o.id === b.id
          ? { ...o, role: 'target' as const }
          : o
    );
    jobs.push({ from: anchor(a, fs!), to: anchor(b, ts!), fs: fs!, ts: ts!, obstacles });
  }
  const strategy = new PolylinePathStrategy();
  return () => {
    for (const job of jobs) {
      strategy.calculatePath(job.from, job.to, job.fs, job.ts, { obstacles: job.obstacles });
    }
  };
}

describe('auto polyline routing performance', () => {
  it('re-routes 100 edges among 60 nodes well within a drag frame budget', () => {
    const frame = dragFrame(10, 6, 100);
    frame();
    const times: number[] = [];
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      frame();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    // ~45 ms locally; the unbounded search took > 1 s. Generous for slow CI runners.
    expect(times[1]).toBeLessThan(400);
  });
});
