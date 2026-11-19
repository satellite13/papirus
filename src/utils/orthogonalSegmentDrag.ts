import type { Point } from '@/types';
import { EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE } from '@/constants';

export type SegmentAxis = 'horizontal' | 'vertical';

export type OrthogonalRun = {
  /** Vertex index where the run starts. */
  startIndex: number;
  /** Vertex index where the run ends (exclusive segment end = this vertex). */
  endIndex: number;
  axis: SegmentAxis;
};

export function segmentAxis(
  a: Point,
  b: Point,
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): SegmentAxis | null {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dy <= tol && dx > tol) {
    return 'horizontal';
  }
  if (dx <= tol && dy > tol) {
    return 'vertical';
  }
  return null;
}

/**
 * Merge consecutive colinear H/V segments into runs so one mid-handle covers
 * what the user sees as a single straight section.
 */
export function listOrthogonalRuns(
  vertices: readonly Point[],
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): OrthogonalRun[] {
  const runs: OrthogonalRun[] = [];
  let i = 0;
  while (i < vertices.length - 1) {
    const axis = segmentAxis(vertices[i]!, vertices[i + 1]!, tol);
    if (!axis) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < vertices.length - 1) {
      const nextAxis = segmentAxis(vertices[j]!, vertices[j + 1]!, tol);
      if (nextAxis !== axis) {
        break;
      }
      j += 1;
    }
    runs.push({ startIndex: i, endIndex: j, axis });
    i = j;
  }
  return runs;
}

/** Midpoint of an orthogonal run (for handle hit/render). */
export function orthogonalRunMidpoint(
  vertices: readonly Point[],
  run: OrthogonalRun
): Point {
  const a = vertices[run.startIndex]!;
  const b = vertices[run.endIndex]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Drop intermediate vertices that lie on a straight H/V run between their
 * neighbours (e.g. router exit stubs that become visible editable bends).
 */
export function collapseColinearPoints(
  vertices: readonly Point[],
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): Point[] {
  if (vertices.length <= 2) {
    return vertices.map((p) => ({ x: p.x, y: p.y }));
  }
  const result: Point[] = [{ x: vertices[0]!.x, y: vertices[0]!.y }];
  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = result[result.length - 1]!;
    const cur = vertices[i]!;
    const next = vertices[i + 1]!;
    const axisIn = segmentAxis(prev, cur, tol);
    const axisOut = segmentAxis(cur, next, tol);
    if (axisIn && axisIn === axisOut) {
      continue;
    }
    result.push({ x: cur.x, y: cur.y });
  }
  const last = vertices[vertices.length - 1]!;
  result.push({ x: last.x, y: last.y });
  return result;
}

function controlPointsFromVertices(vertices: readonly Point[]): Point[] {
  const collapsed = collapseColinearPoints(vertices);
  return collapsed.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));
}

function controlPointsEqual(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.x !== b[i]!.x || a[i]!.y !== b[i]!.y) {
      return false;
    }
  }
  return true;
}

/**
 * Drop colinear interior bends on a path `[from, ...controlPoints, to]`.
 * Returns new control points when anything changed, otherwise `null`.
 */
export function cleanupColinearControlPoints(
  from: Point,
  to: Point,
  controlPoints: readonly Point[],
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): Point[] | null {
  if (controlPoints.length === 0) {
    return null;
  }
  const collapsed = collapseColinearPoints(
    [{ x: from.x, y: from.y }, ...controlPoints, { x: to.x, y: to.y }],
    tol
  );
  const next = collapsed.slice(1, -1).map((p) => ({ x: p.x, y: p.y }));
  return controlPointsEqual(controlPoints, next) ? null : next;
}

/**
 * After geometry changes (stub insert, collapse), pick the same-axis run whose
 * midpoint stays closest to the previous run midpoint — avoids stale indices
 * that would re-apply first-segment stub logic on the wrong section.
 */
export function resolveOrthogonalRun(
  vertices: readonly Point[],
  previous: OrthogonalRun,
  previousMidpoint: Point,
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): OrthogonalRun | null {
  const runs = listOrthogonalRuns(vertices, tol).filter((r) => r.axis === previous.axis);
  if (runs.length === 0) {
    return null;
  }
  let best = runs[0]!;
  let bestDist = Infinity;
  for (const run of runs) {
    const mid = orthogonalRunMidpoint(vertices, run);
    const dist = Math.hypot(mid.x - previousMidpoint.x, mid.y - previousMidpoint.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = run;
    }
  }
  return best;
}

/**
 * Move a whole colinear run by collapsing it to one segment, then applying
 * {@link moveOrthogonalSegment}. Intermediate colinear waypoints are removed.
 */
export function moveOrthogonalRun(
  vertices: readonly Point[],
  run: OrthogonalRun,
  pointer: Point,
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): Point[] | null {
  if (run.endIndex <= run.startIndex) {
    return null;
  }
  if (run.endIndex === run.startIndex + 1) {
    return moveOrthogonalSegment(vertices, run.startIndex, pointer, tol);
  }
  const simplified: Point[] = [
    ...vertices.slice(0, run.startIndex + 1).map((p) => ({ x: p.x, y: p.y })),
    ...vertices.slice(run.endIndex).map((p) => ({ x: p.x, y: p.y })),
  ];
  return moveOrthogonalSegment(simplified, run.startIndex, pointer, tol);
}

/**
 * Move an orthogonal segment of a polyline (vertices include fixed endpoints).
 * Returns new interior control points, or null if the segment is not quasi-orthogonal.
 */
export function moveOrthogonalSegment(
  vertices: readonly Point[],
  segmentIndex: number,
  pointer: Point,
  tol: number = EDITABLE_POLYLINE_ORTHOGONAL_TOLERANCE
): Point[] | null {
  if (segmentIndex < 0 || segmentIndex >= vertices.length - 1) {
    return null;
  }
  const V = vertices.map((p) => ({ x: p.x, y: p.y }));
  const a = V[segmentIndex]!;
  const b = V[segmentIndex + 1]!;
  const axis = segmentAxis(a, b, tol);
  if (!axis) {
    return null;
  }

  const last = V.length - 1;

  if (axis === 'horizontal') {
    const newY = pointer.y;
    if (segmentIndex === 0 && segmentIndex + 1 === last) {
      return controlPointsFromVertices([
        { x: a.x, y: a.y },
        { x: a.x, y: newY },
        { x: b.x, y: newY },
        { x: b.x, y: b.y },
      ]);
    }
    if (segmentIndex === 0) {
      // Insert a vertical exit stub only when the first leg still leaves the fixed start
      // horizontally (no stub yet). Checking after moving Y always looked "needs stub".
      const needsExitStub = Math.abs(b.y - V[0]!.y) <= tol && Math.abs(b.x - V[0]!.x) > tol;
      V[1]!.y = newY;
      if (needsExitStub) {
        V.splice(1, 0, { x: V[0]!.x, y: newY });
      }
      return controlPointsFromVertices(V);
    }
    if (segmentIndex + 1 === last) {
      const needsEntryStub =
        Math.abs(a.y - V[last]!.y) <= tol && Math.abs(a.x - V[last]!.x) > tol;
      V[last - 1]!.y = newY;
      if (needsEntryStub) {
        V.splice(last, 0, { x: V[last]!.x, y: newY });
      }
      return controlPointsFromVertices(V);
    }
    V[segmentIndex]!.y = newY;
    V[segmentIndex + 1]!.y = newY;
    return controlPointsFromVertices(V);
  }

  const newX = pointer.x;
  if (segmentIndex === 0 && segmentIndex + 1 === last) {
    return controlPointsFromVertices([
      { x: a.x, y: a.y },
      { x: newX, y: a.y },
      { x: newX, y: b.y },
      { x: b.x, y: b.y },
    ]);
  }
  if (segmentIndex === 0) {
    const needsExitStub = Math.abs(b.x - V[0]!.x) <= tol && Math.abs(b.y - V[0]!.y) > tol;
    V[1]!.x = newX;
    if (needsExitStub) {
      V.splice(1, 0, { x: newX, y: V[0]!.y });
    }
    return controlPointsFromVertices(V);
  }
  if (segmentIndex + 1 === last) {
    const needsEntryStub =
      Math.abs(a.x - V[last]!.x) <= tol && Math.abs(a.y - V[last]!.y) > tol;
    V[last - 1]!.x = newX;
    if (needsEntryStub) {
      V.splice(last, 0, { x: newX, y: V[last]!.y });
    }
    return controlPointsFromVertices(V);
  }
  V[segmentIndex]!.x = newX;
  V[segmentIndex + 1]!.x = newX;
  return controlPointsFromVertices(V);
}
