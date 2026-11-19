import { describe, it, expect } from 'vitest';
import { DEFAULT_END_STUB } from '@/constants';
import { countBends } from './routeCost';
import { clampFacingExitEntry, endStubMeet } from './routeOrthogonalAround';
import { PolylinePathStrategy } from './PolylinePathStrategy';
import { crosses, routeScenario, scenarios } from '@/test/routingScenarios';

type P = { x: number; y: number };

/** Straight run into the last point; collinear vertices left by simplify are skipped. */
function lastSegment(path: P[]): { len: number; axis: 'h' | 'v' | 'diag' } {
  const b = path[path.length - 1]!;
  let i = path.length - 2;
  const first = path[i]!;
  const dx0 = Math.abs(first.x - b.x);
  const dy0 = Math.abs(first.y - b.y);
  const axis = dy0 < 0.001 ? 'h' : dx0 < 0.001 ? 'v' : 'diag';
  if (axis !== 'diag') {
    while (i > 0) {
      const prev = path[i - 1]!;
      const onAxis = axis === 'h' ? Math.abs(prev.y - b.y) < 0.001 : Math.abs(prev.x - b.x) < 0.001;
      if (!onAxis) break;
      i--;
    }
  }
  const a = path[i]!;
  return { len: Math.abs(a.x - b.x) + Math.abs(a.y - b.y), axis };
}

function hasUTurn(path: P[]): boolean {
  for (let i = 0; i + 2 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const c = path[i + 2]!;
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 > 0.5 && len2 > 0.5 && v1x * v2x + v1y * v2y < -0.01 * len1 * len2) return true;
  }
  return false;
}

type R = { id: string; x: number; y: number; width: number; height: number };

function routeNodes(a: R, b: R, from: P, to: P, fromDir: string, toDir: string): P[] {
  const pad = (n: R, role: 'source' | 'target') => ({
    id: n.id,
    x: n.x - 4,
    y: n.y - 4,
    width: n.width + 8,
    height: n.height + 8,
    role,
  });
  return new PolylinePathStrategy().calculatePath(from, to, fromDir, toDir, {
    obstacles: [pad(a, 'source'), pad(b, 'target')],
  });
}

const axisOfSide = (side: string): 'h' | 'v' => (side === 'left' || side === 'right' ? 'h' : 'v');

describe('end stub (routeOrthogonalAround)', () => {
  for (const [name, sc] of Object.entries(scenarios)) {
    it(`${name}: last segment is normal to the entry side and ≥ endStubLength`, () => {
      const seg = lastSegment(routeScenario(sc));
      expect(seg.axis).toBe(axisOfSide(sc.toDir));
      expect(seg.len).toBeGreaterThanOrEqual(DEFAULT_END_STUB - 0.001);
    });
  }

  it('exactStub: turn before the target leaves exactly endStubLength', () => {
    expect(lastSegment(routeScenario(scenarios.exactStub)).len).toBeCloseTo(16, 3);
    expect(lastSegment(routeScenario(scenarios.exactStub, 18)).len).toBeCloseTo(18, 3);
  });

  it('rightToLeftBlocked: sibling in the mid-gap keeps a normal end stub, no crossings', () => {
    const sc = scenarios.rightToLeftBlocked;
    const path = routeScenario(sc);
    const seg = lastSegment(path);
    expect(seg.axis).toBe(axisOfSide(sc.toDir));
    expect(seg.len, JSON.stringify(path)).toBeGreaterThanOrEqual(DEFAULT_END_STUB - 0.001);
    for (const r of [sc.a, sc.b, ...sc.others]) {
      expect(crosses(path, r), `crosses ${r.id}: ${JSON.stringify(path)}`).toBe(false);
    }
  });

  it('right → top under the source: mid-gap entry never shortens the stub when it fits', () => {
    const a = { id: 'a', x: 100, y: 100, width: 100, height: 60 };
    for (const gap of [24, 28, 31]) {
      const b = { id: 'b', x: 120, y: 160 + gap, width: 160, height: 60 };
      const to = { x: 180, y: b.y };
      const path = routeNodes(a, b, { x: 200, y: 130 }, to, 'right', 'top');
      const seg = lastSegment(path);
      const msg = `gap ${gap}: ${JSON.stringify(path)}`;
      expect(seg.axis, msg).toBe('v');
      expect(seg.len, msg).toBeCloseTo(DEFAULT_END_STUB, 3);
      expect(crosses(path, a), msg).toBe(false);
      expect(crosses(path, b), msg).toBe(false);
      expect(path[path.length - 1]).toEqual(to);
    }
  });

  it('bottom → left beside the source: mid-gap entry never shortens the stub when it fits', () => {
    const a = { id: 'a', x: 100, y: 100, width: 100, height: 60 };
    for (const gap of [24, 28, 31]) {
      const b = { id: 'b', x: 200 + gap, y: 120, width: 100, height: 60 };
      const to = { x: b.x, y: 150 };
      const path = routeNodes(a, b, { x: 150, y: 160 }, to, 'bottom', 'left');
      const seg = lastSegment(path);
      const msg = `gap ${gap}: ${JSON.stringify(path)}`;
      expect(seg.axis, msg).toBe('h');
      expect(seg.len, msg).toBeCloseTo(DEFAULT_END_STUB, 3);
      expect(crosses(path, a), msg).toBe(false);
      expect(crosses(path, b), msg).toBe(false);
      expect(path[path.length - 1]).toEqual(to);
    }
  });

  it('very small gap keeps the mid-gap entry: no U-turn, no node crossing', () => {
    const a = { id: 'a', x: 100, y: 100, width: 100, height: 60 };
    const cases = [
      {
        b: { id: 'b', x: 120, y: 176, width: 160, height: 60 },
        from: { x: 200, y: 130 },
        to: { x: 180, y: 176 },
        fromDir: 'right',
        toDir: 'top',
      },
      {
        b: { id: 'b', x: 216, y: 120, width: 100, height: 60 },
        from: { x: 150, y: 160 },
        to: { x: 216, y: 150 },
        fromDir: 'bottom',
        toDir: 'left',
      },
    ];
    for (const c of cases) {
      const path = routeNodes(a, c.b, c.from, c.to, c.fromDir, c.toDir);
      const msg = `${c.fromDir}→${c.toDir}: ${JSON.stringify(path)}`;
      expect(lastSegment(path).axis, msg).toBe(axisOfSide(c.toDir));
      expect(hasUTurn(path), msg).toBe(false);
      expect(crosses(path, a), msg).toBe(false);
      expect(crosses(path, c.b), msg).toBe(false);
      expect(path[path.length - 1]).toEqual(c.to);
    }
  });

  it('sibling in the mid-gap up to the stub line: fallback entry leaves exactly endStubLength', () => {
    // c padded + margin ends at x = 484 = to.x − 16: only the end stub fits beside it.
    const sc = {
      ...scenarios.rightToLeftBlocked,
      others: [{ id: 'c', x: 300, y: 90, width: 176, height: 80 }],
    };
    const path = routeScenario(sc);
    const seg = lastSegment(path);
    expect(seg.axis).toBe(axisOfSide(sc.toDir));
    expect(seg.len, JSON.stringify(path)).toBeCloseTo(DEFAULT_END_STUB, 3);
    for (const r of [sc.a, sc.b, ...sc.others]) {
      expect(crosses(path, r), `crosses ${r.id}: ${JSON.stringify(path)}`).toBe(false);
    }
  });
});

describe('endStubMeet / clampFacingExitEntry', () => {
  it('keeps the mid-gap when it leaves enough stub', () => {
    expect(endStubMeet(0, 40, 16)).toBe(20);
  });

  it('moves the meet toward the source to keep the end stub', () => {
    expect(endStubMeet(160, 185, 16)).toBe(169);
    expect(endStubMeet(185, 160, 16)).toBe(176);
  });

  it('falls back to the middle when the gap is too small', () => {
    expect(endStubMeet(160, 180, 16)).toBe(170);
  });

  it('clampFacingExitEntry uses endStubMeet', () => {
    const clamped = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 169 }
    );
    expect(clamped.startExit.y).toBe(169);
    expect(clamped.endEntry.y).toBe(169);
    const custom = clampFacingExitEntry(
      { x: 160, y: 160 },
      { x: 180, y: 185 },
      'bottom',
      'top',
      { x: 160, y: 180 },
      { x: 180, y: 175 },
      10
    );
    // gap 25: mid-gap already leaves 12.5 ≥ 10
    expect(custom.endEntry.y).toBe(172.5);
  });

  it('close facing nodes keep the end stub when the gap allows', () => {
    const s = new PolylinePathStrategy();
    const start = { x: 100, y: 100, width: 120, height: 60 };
    for (const gap of [24, 30, 40]) {
      const process = { x: 110, y: 160 + gap, width: 140, height: 64 };
      const pad = (r: typeof start, role: 'source' | 'target') => ({
        x: r.x - 4,
        y: r.y - 4,
        width: r.width + 8,
        height: r.height + 8,
        role,
      });
      const path = s.calculatePath({ x: 160, y: 160 }, { x: 180, y: process.y }, 'bottom', 'top', {
        obstacles: [pad(start, 'source'), pad(process, 'target')],
      });
      const seg = lastSegment(path);
      expect(seg.axis, `gap ${gap}`).toBe('v');
      expect(seg.len, `gap ${gap}: ${JSON.stringify(path)}`).toBeGreaterThanOrEqual(16 - 0.001);
    }
  });
});

describe('end stub (buildRoutedPolyline, no roles)', () => {
  it('exactStub geometry without roles and without fromDir', () => {
    const sc = scenarios.exactStub;
    const raw = (r: { x: number; y: number; width: number; height: number }) => ({
      x: r.x - 4,
      y: r.y - 4,
      width: r.width + 8,
      height: r.height + 8,
    });
    const path = new PolylinePathStrategy().calculatePath(sc.from, sc.to, undefined, 'top', {
      obstacles: [raw(sc.a), raw(sc.b)],
    });
    const seg = lastSegment(path);
    expect(seg.axis).toBe('v');
    expect(seg.len, JSON.stringify(path)).toBeCloseTo(16, 3);
  });
});

describe('end stub (calculateDirectedPath, no obstacles)', () => {
  const s = new PolylinePathStrategy();
  const route = (from: P, to: P, fromDir: string, toDir: string) =>
    s.calculatePath(from, to, fromDir, toDir);

  // Without obstacles the Task 6 post-pass may turn these into an L (longer stub) —
  // assert the lower bound and the approach side, not an exact length.
  it('vertical → horizontal: stub before a near target', () => {
    const path = route({ x: 0, y: 0 }, { x: 30, y: 50 }, 'bottom', 'left');
    const seg = lastSegment(path);
    expect(seg.axis).toBe('h');
    expect(seg.len).toBeGreaterThanOrEqual(16);
    expect(path[path.length - 2]!.x).toBeLessThan(30);
  });

  it('horizontal → vertical: jog keeps the stub', () => {
    const path = route({ x: 0, y: 0 }, { x: 100, y: 20 }, 'right', 'top');
    const seg = lastSegment(path);
    expect(seg.axis).toBe('v');
    expect(seg.len).toBeGreaterThanOrEqual(16);
    expect(path[path.length - 2]!.y).toBeLessThan(20);
  });

  it('facing vertical: meet keeps the stub, tight gap uses the middle', () => {
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 100, y: 30 }, 'bottom', 'top'))).toEqual({
      len: 16,
      axis: 'v',
    });
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 100, y: 20 }, 'bottom', 'top'))).toEqual({
      len: 10,
      axis: 'v',
    });
  });

  it('bottom → bottom approaches from below, not through the target', () => {
    const path = route({ x: 0, y: 0 }, { x: 100, y: 100 }, 'bottom', 'bottom');
    const pre = path[path.length - 2]!;
    expect(pre.y).toBeGreaterThan(100);
    expect(lastSegment(path)).toEqual({ len: 16, axis: 'v' });
  });

  it('facing horizontal mirrors the vertical rule', () => {
    expect(lastSegment(route({ x: 0, y: 0 }, { x: 30, y: 100 }, 'right', 'left'))).toEqual({
      len: 16,
      axis: 'h',
    });
  });
});

describe('end stub (calculateDirectedPath, toDir only)', () => {
  const s = new PolylinePathStrategy();
  const to = { x: 0, y: 0 };
  const normal: Record<string, P> = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
  };
  // `ahead` along the outward normal of toDir, `across` perpendicular to it.
  const offsets = [
    { name: 'front', ahead: 100, across: 50, bends: 1 },
    { name: 'front aligned', ahead: 100, across: 0, bends: 0 },
    { name: 'front close', ahead: 8, across: 60, bends: 2 },
    { name: 'side', ahead: 0, across: 100, bends: 2 },
    { name: 'behind', ahead: -100, across: -50, bends: 2 },
    { name: 'behind aligned', ahead: -100, across: 0, bends: 3 },
  ];

  for (const toDir of ['left', 'right', 'top', 'bottom']) {
    const n = normal[toDir]!;
    for (const o of offsets) {
      it(`${toDir}, from ${o.name}: arrives from outside along the normal`, () => {
        const from = { x: n.x * o.ahead + n.y * o.across, y: n.y * o.ahead + n.x * o.across };
        const path = s.calculatePath(from, to, undefined, toDir);
        const msg = JSON.stringify(path);
        expect(path[0], msg).toEqual(from);
        expect(path[path.length - 1], msg).toEqual(to);
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1]!;
          const b = path[i]!;
          expect(a.x === b.x || a.y === b.y, `diagonal: ${msg}`).toBe(true);
          expect(a.x === b.x && a.y === b.y, `duplicate: ${msg}`).toBe(false);
        }
        const pre = path[path.length - 2]!;
        expect((pre.x - to.x) * n.x + (pre.y - to.y) * n.y, msg).toBeGreaterThan(0);
        const seg = lastSegment(path);
        expect(seg.axis, msg).toBe(axisOfSide(toDir));
        expect(seg.len, msg).toBeGreaterThanOrEqual(DEFAULT_END_STUB);
        expect(countBends(path), msg).toBe(o.bends);
        if (o.bends >= 2) expect(seg.len, msg).toBeCloseTo(DEFAULT_END_STUB, 3);
        // Earlier segments never pass through the attachment point.
        for (let i = 1; i < path.length - 1; i++) {
          const a = path[i - 1]!;
          const b = path[i]!;
          const onSeg =
            Math.min(a.x, b.x) <= to.x &&
            to.x <= Math.max(a.x, b.x) &&
            Math.min(a.y, b.y) <= to.y &&
            to.y <= Math.max(a.y, b.y);
          expect(onSeg, `through target: ${msg}`).toBe(false);
        }
      });
    }
  }

  it('review probe: left attachment is approached from the left', () => {
    const path = s.calculatePath({ x: 200, y: 0 }, { x: 0, y: 100 }, undefined, 'left');
    expect(path[path.length - 2]!.x).toBeLessThan(0);
    expect(lastSegment(path)).toEqual({ len: 16, axis: 'h' });
  });
});

describe('calculateDirectedPath degenerate input', () => {
  it('from == to keeps at least two points', () => {
    const s = new PolylinePathStrategy();
    const p = { x: 10, y: 10 };
    for (const [fromDir, toDir] of [
      ['bottom', 'top'],
      ['right', 'left'],
      ['bottom', 'left'],
      [undefined, 'top'],
      ['left', undefined],
    ] as const) {
      const path = s.calculatePath(p, p, fromDir, toDir);
      expect(path.length, `${fromDir}→${toDir}: ${JSON.stringify(path)}`).toBeGreaterThanOrEqual(2);
    }
  });
});
