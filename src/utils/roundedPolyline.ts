import type { Point } from '@/types';
import { distance } from '@/utils/geometry';

export type RoundedPolylineSink = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
};

const MIN_FILLET_RADIUS = 0.5;

/**
 * Clamp fillet radius so the circular arc fits both legs.
 * Tangent offset from the vertex is `r / tan(φ/2)`; each corner may use at
 * most half of a shared leg so neighbouring fillets cannot overlap.
 *
 * @param anglePhi Angle at the corner between the two legs (radians), in (0, π).
 *                 Defaults to π/2 (orthogonal) when omitted.
 */
export function clampCornerRadius(
  radius: number,
  inLen: number,
  outLen: number,
  anglePhi: number = Math.PI / 2
): number {
  if (!(radius > 0) || !(inLen > 0) || !(outLen > 0)) {
    return 0;
  }
  if (!(anglePhi > 1e-3) || !(Math.PI - anglePhi > 1e-3)) {
    return 0;
  }
  let tanHalf = Math.tan(anglePhi / 2);
  // tan(π/4) is not exactly 1 in IEEE floats — snap orthogonal corners.
  if (Math.abs(tanHalf - 1) < 1e-10) {
    tanHalf = 1;
  }
  if (!(tanHalf > 1e-6)) {
    return 0;
  }
  // offset = r / tan(φ/2) ≤ leg/2  ⇒  r ≤ (leg/2) * tan(φ/2)
  const maxByLegs = Math.min(inLen, outLen) * 0.5 * tanHalf;
  const r = Math.min(radius, maxByLegs);
  return r >= MIN_FILLET_RADIUS ? r : 0;
}

/** Interior angle at `curr` between segments prev→curr and curr→next. */
export function cornerAngle(prev: Point, curr: Point, next: Point): number {
  const ax = prev.x - curr.x;
  const ay = prev.y - curr.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-9 || lb < 1e-9) {
    return Math.PI;
  }
  const cos = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)));
  return Math.acos(cos);
}

function isNearlyColinear(prev: Point, curr: Point, next: Point): boolean {
  const ax = curr.x - prev.x;
  const ay = curr.y - prev.y;
  const bx = next.x - curr.x;
  const by = next.y - curr.y;
  const cross = ax * by - ay * bx;
  const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
  return scale === 0 || Math.abs(cross) / scale < 1e-6;
}

/**
 * Trace a polyline with rounded corners into a canvas-like sink.
 * Geometry of `points` stays sharp for hit-testing; this is render-only.
 */
export function traceRoundedPolyline(
  points: readonly Point[],
  radius: number,
  sink: RoundedPolylineSink
): void {
  if (points.length === 0) {
    return;
  }
  if (points.length === 1) {
    sink.moveTo(points[0]!.x, points[0]!.y);
    return;
  }
  if (points.length === 2 || !(radius > 0)) {
    sink.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      sink.lineTo(points[i]!.x, points[i]!.y);
    }
    return;
  }

  sink.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    if (isNearlyColinear(prev, curr, next)) {
      sink.lineTo(curr.x, curr.y);
      continue;
    }
    const phi = cornerAngle(prev, curr, next);
    const r = clampCornerRadius(radius, distance(prev, curr), distance(curr, next), phi);
    if (r <= 0) {
      sink.lineTo(curr.x, curr.y);
    } else {
      sink.arcTo(curr.x, curr.y, next.x, next.y, r);
    }
  }
  const last = points[points.length - 1]!;
  sink.lineTo(last.x, last.y);
}

/**
 * SVG path `d` for a rounded polyline. Uses quadratic fillets (Q through the corner).
 */
export function roundedPolylineToSvgD(points: readonly Point[], radius: number): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  if (points.length === 2 || !(radius > 0)) {
    let d = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i]!.x} ${points[i]!.y}`;
    }
    return d;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const inLen = distance(prev, curr);
    const outLen = distance(curr, next);
    if (isNearlyColinear(prev, curr, next)) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const phi = cornerAngle(prev, curr, next);
    const r = clampCornerRadius(radius, inLen, outLen, phi);
    if (r <= 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    // Tangent offset along each leg for a circular fillet of radius r.
    const offset = r / Math.tan(phi / 2);
    const before = {
      x: curr.x + ((prev.x - curr.x) / inLen) * offset,
      y: curr.y + ((prev.y - curr.y) / inLen) * offset,
    };
    const after = {
      x: curr.x + ((next.x - curr.x) / outLen) * offset,
      y: curr.y + ((next.y - curr.y) / outLen) * offset,
    };
    d += ` L ${before.x} ${before.y} Q ${curr.x} ${curr.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}
