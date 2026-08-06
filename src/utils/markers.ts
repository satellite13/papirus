import type { ArrowMarkerConfig, Point } from '@/types';
import { ARROW_ANGLE } from '@/constants';

export interface MarkerPoints {
  /** Start point of marker (attached to edge) */
  from: Point;
  /** End point of marker (tip) */
  to: Point;
}

/**
 * Calculate marker points based on edge path
 */
export function calculateMarkerPoints(
  path: readonly Point[],
  position: 'start' | 'end',
  type: 'bezier' | 'straight' | 'polyline' | 'editable-polyline'
): MarkerPoints | null {
  if (path.length < 2) {
    return null;
  }

  if (type === 'bezier' && path.length >= 4) {
    const epsilon = 0.001;
    const isSame = (a: Point, b: Point): boolean =>
      Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;

    if (position === 'end') {
      const endIndex = path.length - 1;
      const endPoint = path[endIndex]!;
      let from = path[endIndex - 1]!;
      if (isSame(from, endPoint)) {
        from = path[endIndex - 2]!;
        if (isSame(from, endPoint)) {
          from = path[0]!;
        }
      }
      return { from, to: endPoint };
    }

    const start = path[0]!;
    let next = path[1]!;
    if (isSame(next, start)) {
      next = path[2]!;
      if (isSame(next, start)) {
        next = path[path.length - 1]!;
      }
    }
    return { from: next, to: start };
  }

  if (position === 'end') {
    return { from: path[path.length - 2]!, to: path[path.length - 1]! };
  }

  return { from: path[1]!, to: path[0]! };
}

/**
 * Calculate arrow marker vertex points
 */
export function calculateArrowMarkerPoints(
  to: Point,
  angle: number,
  size: number
): { tip: Point; left: Point; right: Point } {
  const left = {
    x: to.x - size * Math.cos(angle - ARROW_ANGLE),
    y: to.y - size * Math.sin(angle - ARROW_ANGLE),
  };
  const right = {
    x: to.x - size * Math.cos(angle + ARROW_ANGLE),
    y: to.y - size * Math.sin(angle + ARROW_ANGLE),
  };
  return { tip: to, left, right };
}

/** Depth of stealth heel notch along the edge (fraction of arrow shaft length). */
const STEALTH_NOTCH_DEPTH = 0.55;
/** Lateral inset of heel vs outer barb half-width. */
const STEALTH_NOTCH_WIDTH = 0.35;

/**
 * Stealth (barbed) marker: tip + outer barbs + concave heel (two inner points).
 */
export function calculateStealthMarkerPoints(
  to: Point,
  angle: number,
  size: number
): {
  tip: Point;
  leftOuter: Point;
  leftInner: Point;
  rightInner: Point;
  rightOuter: Point;
} {
  const { left: leftOuter, right: rightOuter } = calculateArrowMarkerPoints(to, angle, size);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const depth = size * Math.cos(ARROW_ANGLE);
  const halfWidth = size * Math.sin(ARROW_ANGLE);
  const innerDepth = depth * STEALTH_NOTCH_DEPTH;
  const innerHalf = halfWidth * STEALTH_NOTCH_WIDTH;
  const leftInner = {
    x: to.x - innerDepth * cos + innerHalf * sin,
    y: to.y - innerDepth * sin - innerHalf * cos,
  };
  const rightInner = {
    x: to.x - innerDepth * cos - innerHalf * sin,
    y: to.y - innerDepth * sin + innerHalf * cos,
  };
  return { tip: to, leftOuter, leftInner, rightInner, rightOuter };
}

/**
 * Calculate diamond marker vertex points
 */
export function calculateDiamondMarkerPoints(
  to: Point,
  angle: number,
  size: number
): Point[] {
  const halfLength = size / 2;
  const halfWidth = size * 0.3;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    { x: to.x, y: to.y }, // tip
    {
      x: to.x - halfLength * cos + halfWidth * sin,
      y: to.y - halfLength * sin - halfWidth * cos,
    },
    { x: to.x - size * cos, y: to.y - size * sin }, // back
    {
      x: to.x - halfLength * cos - halfWidth * sin,
      y: to.y - halfLength * sin + halfWidth * cos,
    },
  ];
}

/**
 * Calculate circle marker center
 */
export function calculateCircleMarkerCenter(
  to: Point,
  angle: number,
  size: number
): Point {
  return {
    x: to.x - size * Math.cos(angle),
    y: to.y - size * Math.sin(angle),
  };
}

/**
 * Get marker length (how much to shorten the edge line)
 */
export function getMarkerLength(config: ArrowMarkerConfig): number {
  const size = config.size ?? 12;
  switch (config.type) {
    case 'arrow':
    case 'stealth':
      return size * Math.cos(ARROW_ANGLE);
    case 'open':
      return 0;
    case 'diamond':
      return size;
    case 'circle':
      return size * 2;
    case 'square':
      return size * 2;
    default:
      return 0;
  }
}

/**
 * Generate SVG path for arrow marker
 */
export function generateSvgArrowMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const { left, right } = calculateArrowMarkerPoints(to, angle, size);
  return `<path d="M ${to.x} ${to.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}

export function generateSvgStealthMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const { tip, leftOuter, leftInner, rightInner, rightOuter } = calculateStealthMarkerPoints(
    to,
    angle,
    size
  );
  return `<path d="M ${tip.x} ${tip.y} L ${leftOuter.x} ${leftOuter.y} L ${leftInner.x} ${leftInner.y} L ${rightInner.x} ${rightInner.y} L ${rightOuter.x} ${rightOuter.y} Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}

/**
 * Generate SVG path for open arrow marker
 */
export function generateSvgOpenArrowMarker(
  to: Point,
  angle: number,
  size: number,
  stroke: string
): string {
  const { left, right } = calculateArrowMarkerPoints(to, angle, size);
  return `<path d="M ${to.x} ${to.y} L ${left.x} ${left.y} M ${to.x} ${to.y} L ${right.x} ${right.y}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/**
 * Generate SVG path for diamond marker
 */
export function generateSvgDiamondMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const points = calculateDiamondMarkerPoints(to, angle, size);
  return `<path d="M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y} L ${points[2]!.x} ${points[2]!.y} L ${points[3]!.x} ${points[3]!.y} Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}

/**
 * Generate SVG circle marker
 */
export function generateSvgCircleMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const { x: cx, y: cy } = calculateCircleMarkerCenter(to, angle, size);
  return `<circle cx="${cx}" cy="${cy}" r="${size}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}

/**
 * Square marker: front edge centered at `to`, depth 2×size along the edge toward `from`.
 */
export function generateSvgSquareMarker(
  to: Point,
  angle: number,
  size: number,
  fill: string,
  fillOpacity: number,
  stroke: string
): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = -sin;
  const py = cos;
  const p1 = { x: to.x + size * px, y: to.y + size * py };
  const p2 = { x: to.x - size * px, y: to.y - size * py };
  const bx = 2 * size * cos;
  const by = 2 * size * sin;
  const p3 = { x: p2.x - bx, y: p2.y - by };
  const p4 = { x: p1.x - bx, y: p1.y - by };
  return `<path d="M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1"/>`;
}

/**
 * Generate SVG path for any marker type
 */
export function generateSvgMarker(
  marker: ArrowMarkerConfig,
  from: Point,
  to: Point,
  edgeStroke: string
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = marker.size ?? 12;
  const stroke = marker.strokeColor ?? edgeStroke;
  const fill = marker.fillColor ?? stroke;
  const fillOpacity = marker.fillOpacity ?? 1;

  switch (marker.type) {
    case 'open':
      return generateSvgOpenArrowMarker(to, angle, size, stroke);
    case 'diamond':
      return generateSvgDiamondMarker(to, angle, size, fill, fillOpacity, stroke);
    case 'circle':
      return generateSvgCircleMarker(to, angle, size, fill, fillOpacity, stroke);
    case 'square':
      return generateSvgSquareMarker(to, angle, size, fill, fillOpacity, stroke);
    case 'stealth':
      return generateSvgStealthMarker(to, angle, size, fill, fillOpacity, stroke);
    case 'arrow':
    default:
      return generateSvgArrowMarker(to, angle, size, fill, fillOpacity, stroke);
  }
}
