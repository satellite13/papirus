import { ARROW_ANGLE, ARROW_SIZE, MARKER_SIZES } from '@/constants';
import type { ArrowMarkerConfig, ArrowType, EdgePathType, Point } from '@/types';
import {
  calculateArrowMarkerPoints,
  calculateCircleMarkerCenter,
  calculateDiamondMarkerPoints,
  calculateMarkerPoints,
  calculateStealthMarkerPoints,
} from '@/utils/markers';

export interface EdgeMarkerRenderOptions {
  path: readonly Point[];
  type: EdgePathType;
  arrowType: ArrowType;
  startMarker?: ArrowMarkerConfig;
  endMarker?: ArrowMarkerConfig;
}

export function getCanvasMarkerLength(config: ArrowMarkerConfig): number {
  const size = config.size ?? MARKER_SIZES[config.type] ?? ARROW_SIZE;
  switch (config.type) {
    case 'arrow':
    case 'stealth':
      return size * Math.cos(ARROW_ANGLE);
    case 'open':
      return 0;
    case 'diamond':
      return size;
    case 'circle':
    case 'square':
      return size * 2;
    default:
      return 0;
  }
}

export function renderEdgeMarkers(
  ctx: CanvasRenderingContext2D,
  options: EdgeMarkerRenderOptions
): void {
  const { path, type, arrowType, startMarker, endMarker } = options;
  if (path.length < 2) {
    return;
  }

  const hasConfiguredMarkers = startMarker !== undefined || endMarker !== undefined;
  if (hasConfiguredMarkers) {
    renderConfiguredMarker(ctx, path, type, 'end', endMarker);
    renderConfiguredMarker(ctx, path, type, 'start', startMarker);
    return;
  }

  if (arrowType === 'none') {
    return;
  }

  const endPoints = calculateMarkerPoints(path, 'end', type);
  if (endPoints) {
    drawLegacyArrowHead(ctx, endPoints.from, endPoints.to);
  }

  if (arrowType === 'double') {
    const startPoints = calculateMarkerPoints(path, 'start', type);
    if (startPoints) {
      drawLegacyArrowHead(ctx, startPoints.from, startPoints.to);
    }
  }
}

function renderConfiguredMarker(
  ctx: CanvasRenderingContext2D,
  path: readonly Point[],
  type: EdgePathType,
  position: 'start' | 'end',
  config: ArrowMarkerConfig | undefined
): void {
  if (!config || config.type === 'none') {
    return;
  }

  const points = calculateMarkerPoints(path, position, type);
  if (points) {
    drawMarker(ctx, points.from, points.to, config);
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  config: ArrowMarkerConfig
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = config.size ?? MARKER_SIZES[config.type] ?? ARROW_SIZE;
  const strokeColor = config.strokeColor ?? (ctx.strokeStyle as string);
  const fillColor = config.fillColor ?? strokeColor;
  const fillOpacity = config.fillOpacity ?? 1;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.strokeStyle = strokeColor;

  switch (config.type) {
    case 'arrow':
      drawArrowMarker(ctx, to, angle, size, fillColor, fillOpacity);
      break;
    case 'stealth':
      drawStealthMarker(ctx, to, angle, size, fillColor, fillOpacity);
      break;
    case 'open':
      drawOpenArrowMarker(ctx, to, angle, size);
      break;
    case 'diamond':
      drawDiamondMarker(ctx, to, angle, size, fillColor, fillOpacity);
      break;
    case 'circle':
      drawCircleMarker(ctx, to, angle, size, fillColor, fillOpacity);
      break;
    case 'square':
      drawSquareMarker(ctx, to, angle, size, fillColor, fillOpacity);
      break;
  }

  ctx.restore();
}

function drawArrowMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const { left, right } = calculateArrowMarkerPoints(to, angle, size);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  fillAndStroke(ctx, fillColor, fillOpacity);
}

function drawStealthMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const { tip, leftOuter, leftInner, rightInner, rightOuter } = calculateStealthMarkerPoints(
    to,
    angle,
    size
  );
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(leftOuter.x, leftOuter.y);
  ctx.lineTo(leftInner.x, leftInner.y);
  ctx.lineTo(rightInner.x, rightInner.y);
  ctx.lineTo(rightOuter.x, rightOuter.y);
  ctx.closePath();
  fillAndStroke(ctx, fillColor, fillOpacity);
}

function drawOpenArrowMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number
): void {
  const { left, right } = calculateArrowMarkerPoints(to, angle, size);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(left.x, left.y);
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
}

function drawDiamondMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const points = calculateDiamondMarkerPoints(to, angle, size);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.closePath();
  fillAndStroke(ctx, fillColor, fillOpacity);
}

function drawCircleMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const center = calculateCircleMarkerCenter(to, angle, size);
  ctx.beginPath();
  ctx.arc(center.x, center.y, size, 0, Math.PI * 2);
  fillAndStroke(ctx, fillColor, fillOpacity);
}

function drawSquareMarker(
  ctx: CanvasRenderingContext2D,
  to: Point,
  angle: number,
  size: number,
  fillColor: string,
  fillOpacity: number
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const perpendicularX = -sin;
  const perpendicularY = cos;
  const frontLeft = {
    x: to.x + size * perpendicularX,
    y: to.y + size * perpendicularY,
  };
  const frontRight = {
    x: to.x - size * perpendicularX,
    y: to.y - size * perpendicularY,
  };
  const depthX = 2 * size * cos;
  const depthY = 2 * size * sin;
  const backRight = { x: frontRight.x - depthX, y: frontRight.y - depthY };
  const backLeft = { x: frontLeft.x - depthX, y: frontLeft.y - depthY };

  ctx.beginPath();
  ctx.moveTo(frontLeft.x, frontLeft.y);
  ctx.lineTo(frontRight.x, frontRight.y);
  ctx.lineTo(backRight.x, backRight.y);
  ctx.lineTo(backLeft.x, backLeft.y);
  ctx.closePath();
  fillAndStroke(ctx, fillColor, fillOpacity);
}

function fillAndStroke(
  ctx: CanvasRenderingContext2D,
  fillColor: string,
  fillOpacity: number
): void {
  ctx.globalAlpha = fillOpacity;
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
}

function drawLegacyArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const { left, right } = calculateArrowMarkerPoints(to, angle, ARROW_SIZE);

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(left.x, left.y);
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.restore();
}
