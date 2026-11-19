import type { Point } from '@/types';
import { PolylinePathStrategy } from '@/elements/paths/PolylinePathStrategy';
import type { PathObstacle } from '@/elements/paths/PathStrategy';
import { segmentIntersectsOpenInterior } from '@/elements/paths/routeOrthogonalAround';

export type Rect = { id: string; x: number; y: number; width: number; height: number };

const PAD = 4;
const pad = (n: Rect, role: 'source' | 'target' | 'other' = 'other'): PathObstacle => ({
  id: n.id,
  x: n.x - PAD,
  y: n.y - PAD,
  width: n.width + PAD * 2,
  height: n.height + PAD * 2,
  role,
});

export function crosses(path: Point[], r: Rect): boolean {
  for (let i = 1; i < path.length; i++) {
    if (segmentIntersectsOpenInterior(path[i - 1]!, path[i]!, r)) return true;
  }
  return false;
}

export const scenarios = {
  rightToTopBelow: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 320, y: 260, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 370, y: 260 },
    fromDir: 'right',
    toDir: 'top',
    others: [] as Rect[],
    bends: 1,
  },
  rightToLeftOffset: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 360, y: 220, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 360, y: 250 },
    fromDir: 'right',
    toDir: 'left',
    others: [] as Rect[],
    bends: 2,
  },
  rightToLeftBlocked: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 500, y: 100, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 500, y: 130 },
    fromDir: 'right',
    toDir: 'left',
    others: [{ id: 'c', x: 300, y: 90, width: 100, height: 80 }],
    bends: 4,
  },
  staircase: {
    a: { id: 'a', x: 100, y: 100, width: 80, height: 60 },
    b: { id: 'b', x: 420, y: 260, width: 80, height: 60 },
    from: { x: 180, y: 130 },
    to: { x: 460, y: 260 },
    fromDir: 'right',
    toDir: 'top',
    others: [{ id: 'm', x: 260, y: 180, width: 80, height: 60 }],
    bends: 1,
  },
  hugLongNode: {
    a: { id: 'a', x: 100, y: 100, width: 100, height: 60 },
    b: { id: 'b', x: 600, y: 200, width: 100, height: 60 },
    from: { x: 200, y: 130 },
    to: { x: 650, y: 200 },
    fromDir: 'right',
    toDir: 'top',
    others: [{ id: 'n', x: 240, y: 140, width: 300, height: 30 }],
    bends: 1,
  },
  exactStub: {
    a: { id: 'a', x: 100, y: 150, width: 100, height: 60 },
    b: { id: 'b', x: 320, y: 110, width: 100, height: 60 },
    from: { x: 200, y: 180 },
    to: { x: 370, y: 110 },
    fromDir: 'right',
    toDir: 'top',
    others: [] as Rect[],
    bends: 3,
  },
} as const;

export type Scenario = (typeof scenarios)[keyof typeof scenarios];

export function routeScenario(sc: Scenario, endStubLength?: number): Point[] {
  const s = new PolylinePathStrategy();
  return s.calculatePath(sc.from, sc.to, sc.fromDir, sc.toDir, {
    obstacles: [pad(sc.a, 'source'), pad(sc.b, 'target'), ...sc.others.map((o) => pad(o))],
    ...(endStubLength !== undefined ? { endStubLength } : {}),
  });
}
