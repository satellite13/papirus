import { describe, expect, it } from 'vitest';
import {
  cleanupColinearControlPoints,
  collapseColinearPoints,
  listOrthogonalRuns,
  moveOrthogonalRun,
  moveOrthogonalSegment,
  resolveOrthogonalRun,
  segmentAxis,
} from './orthogonalSegmentDrag';

describe('segmentAxis', () => {
  it('detects horizontal and vertical segments', () => {
    expect(segmentAxis({ x: 0, y: 10 }, { x: 40, y: 10 })).toBe('horizontal');
    expect(segmentAxis({ x: 5, y: 0 }, { x: 5, y: 40 })).toBe('vertical');
    expect(segmentAxis({ x: 0, y: 0 }, { x: 30, y: 30 })).toBeNull();
  });
});

describe('moveOrthogonalSegment', () => {
  it('moves a middle horizontal segment vertically', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 40 },
    ];
    // segment 1 is vertical 50,0 → 50,40; move segment 0 (horizontal top)
    const next = moveOrthogonalSegment(vertices, 0, { x: 20, y: 15 });
    expect(next).toEqual([
      { x: 0, y: 15 },
      { x: 50, y: 15 },
      { x: 50, y: 40 },
    ]);
  });

  it('moves a middle vertical segment horizontally', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 40 },
    ];
    const next = moveOrthogonalSegment(vertices, 1, { x: 70, y: 20 });
    expect(next).toEqual([
      { x: 70, y: 0 },
      { x: 70, y: 40 },
    ]);
  });

  it('inserts bends when moving the only segment', () => {
    const vertices = [
      { x: 0, y: 10 },
      { x: 100, y: 10 },
    ];
    const next = moveOrthogonalSegment(vertices, 0, { x: 50, y: 40 });
    expect(next).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
  });

  it('inserts a stub when moving the last segment away from the end node', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 50 },
    ];
    // last segment is vertical 80,0 → 80,50; move horizontally
    const next = moveOrthogonalSegment(vertices, 1, { x: 60, y: 25 });
    expect(next).toEqual([
      { x: 60, y: 0 },
      { x: 60, y: 50 },
    ]);
  });

  it('returns null for diagonal segments', () => {
    expect(
      moveOrthogonalSegment(
        [
          { x: 0, y: 0 },
          { x: 40, y: 40 },
        ],
        0,
        { x: 10, y: 10 }
      )
    ).toBeNull();
  });
});

describe('listOrthogonalRuns', () => {
  it('merges consecutive colinear horizontal segments into one run', () => {
    const vertices = [
      { x: 0, y: 10 },
      { x: 40, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 50 },
      { x: 160, y: 50 },
    ];
    expect(listOrthogonalRuns(vertices)).toEqual([
      { startIndex: 0, endIndex: 2, axis: 'horizontal' },
      { startIndex: 2, endIndex: 3, axis: 'vertical' },
      { startIndex: 3, endIndex: 4, axis: 'horizontal' },
    ]);
  });
});

describe('moveOrthogonalRun', () => {
  it('collapses colinear waypoints while moving the run', () => {
    const vertices = [
      { x: 0, y: 10 },
      { x: 40, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 50 },
    ];
    const next = moveOrthogonalRun(
      vertices,
      { startIndex: 0, endIndex: 2, axis: 'horizontal' },
      { x: 50, y: 30 }
    );
    expect(next).toEqual([
      { x: 0, y: 30 },
      { x: 100, y: 30 },
    ]);
  });
});

describe('middle vertical drag', () => {
  it('does not add bends on the upper horizontal across multiple moves', () => {
    let vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 160, y: 50 },
    ];
    let run = { startIndex: 1, endIndex: 2, axis: 'vertical' as const };
    let track = { x: 100, y: 25 };

    for (const x of [90, 80, 70]) {
      const next = moveOrthogonalRun(vertices, run, { x, y: 25 });
      expect(next).not.toBeNull();
      expect(next!).toHaveLength(2);
      expect(next!.every((p) => Math.abs(p.x - x) < 1)).toBe(true);
      vertices = [{ x: 0, y: 0 }, ...next!, { x: 160, y: 50 }];
      const resolved = resolveOrthogonalRun(vertices, run, track);
      expect(resolved?.axis).toBe('vertical');
      run = resolved!;
      track = { x, y: 25 };
    }
  });

  it('drops a colinear exit-stub on the upper horizontal when the vertical moves past it', () => {
    const vertices = [
      { x: 120, y: 60 },
      { x: 152, y: 60 }, // router exit stub
      { x: 180, y: 60 },
      { x: 180, y: 220 },
      { x: 280, y: 220 },
    ];
    const next = moveOrthogonalRun(
      vertices,
      { startIndex: 2, endIndex: 3, axis: 'vertical' },
      { x: 100, y: 140 }
    );
    expect(next).toEqual([
      { x: 100, y: 60 },
      { x: 100, y: 220 },
    ]);
  });
});

describe('collapseColinearPoints', () => {
  it('removes intermediate points on a straight orthogonal run', () => {
    expect(
      collapseColinearPoints([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
  });
});

describe('cleanupColinearControlPoints', () => {
  it('drops a colinear bend on the upper horizontal and keeps real corners', () => {
    const next = cleanupColinearControlPoints(
      { x: 120, y: 60 },
      { x: 280, y: 220 },
      [
        { x: 152, y: 60 },
        { x: 180, y: 60 },
        { x: 180, y: 220 },
      ]
    );
    expect(next).toEqual([
      { x: 180, y: 60 },
      { x: 180, y: 220 },
    ]);
  });

  it('returns null when there is nothing to remove', () => {
    expect(
      cleanupColinearControlPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, [
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ])
    ).toBeNull();
  });
});
