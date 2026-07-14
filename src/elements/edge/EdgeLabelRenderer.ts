import { EDGE_LABEL_BACKGROUND_RADIUS } from '@/constants';
import type { EdgeLabelBackground, EdgePathType, Point } from '@/types';
import { bezierPoint, drawRoundedRectPath } from '@/utils/geometry';
import type { TextLabel } from '../TextLabel';

export interface EdgeLabelLayoutOptions {
  path: readonly Point[];
  type: EdgePathType;
  position: number;
  offset: number;
  followPath: boolean;
}

export interface EdgeLabelRenderOptions extends EdgeLabelLayoutOptions {
  label?: TextLabel;
  background?: EdgeLabelBackground;
}

export function renderEdgeLabel(
  ctx: CanvasRenderingContext2D,
  options: EdgeLabelRenderOptions
): void {
  const { label, path, background } = options;
  if (!label || path.length < 2) {
    return;
  }

  const labelCenter = getEdgeLabelPosition(options);
  if (!labelCenter) {
    return;
  }

  const rotation = getEdgeLabelRotation(options);
  const labelOpacity = label.style.opacity ?? 1;
  label.measure(ctx);

  const labelWidth = label.measuredWidth;
  const labelHeight = label.measuredHeight;
  const backgroundColor = background?.color ?? '#ffffff';
  const backgroundOpacity = background?.opacity ?? 1;
  const backgroundRadius = background?.borderRadius ?? EDGE_LABEL_BACKGROUND_RADIUS;

  ctx.save();
  if (rotation !== 0) {
    ctx.translate(labelCenter.x, labelCenter.y);
    ctx.rotate(rotation);
    ctx.translate(-labelCenter.x, -labelCenter.y);
  }

  const backgroundX = labelCenter.x - labelWidth / 2;
  const backgroundY = labelCenter.y - labelHeight / 2;
  ctx.fillStyle = backgroundColor;
  ctx.globalAlpha = backgroundOpacity;

  if (backgroundRadius > 0) {
    drawRoundedRectPath(ctx, backgroundX, backgroundY, labelWidth, labelHeight, backgroundRadius);
    ctx.fill();
  } else {
    ctx.fillRect(backgroundX, backgroundY, labelWidth, labelHeight);
  }

  ctx.globalAlpha = labelOpacity;
  label.renderAt(ctx, labelCenter);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function getEdgeLabelPosition(options: EdgeLabelLayoutOptions): Point | null {
  if (options.path.length < 2) {
    return null;
  }

  const { point, angle } = getPathPointAt(options.path, options.type, options.position);
  const perpendicularAngle = options.followPath ? angle + Math.PI / 2 : Math.PI / 2;
  return {
    x: point.x + options.offset * Math.cos(perpendicularAngle),
    y: point.y + options.offset * Math.sin(perpendicularAngle),
  };
}

export function getEdgeLabelRotation(options: EdgeLabelLayoutOptions): number {
  if (!options.followPath || options.path.length < 2) {
    return 0;
  }

  let angle = getPathPointAt(options.path, options.type, options.position).angle;
  if (angle > Math.PI / 2) {
    angle -= Math.PI;
  }
  if (angle < -Math.PI / 2) {
    angle += Math.PI;
  }
  return angle;
}

function getPathPointAt(
  path: readonly Point[],
  type: EdgePathType,
  position: number
): { point: Point; angle: number } {
  if (type !== 'bezier' || path.length < 4) {
    return getPointAlongPolyline(path, position);
  }

  const samples: Point[] = [];
  const steps = 20;
  for (let i = 1; i + 2 < path.length; i += 3) {
    const start = path[i - 1]!;
    const control1 = path[i]!;
    const control2 = path[i + 1]!;
    const end = path[i + 2]!;
    for (let sample = 0; sample <= steps; sample++) {
      const t = sample / steps;
      if (samples.length > 0 && t === 0) {
        continue;
      }
      samples.push(bezierPoint(start, control1, control2, end, t));
    }
  }
  return getPointAlongPolyline(samples, position);
}

function getPointAlongPolyline(
  path: readonly Point[],
  position: number
): { point: Point; angle: number } {
  if (path.length === 0) {
    return { point: { x: 0, y: 0 }, angle: 0 };
  }
  if (path.length === 1) {
    return { point: path[0]!, angle: 0 };
  }

  let totalLength = 0;
  const segments: { start: Point; end: Point; length: number }[] = [];
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1]!;
    const end = path[i]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  const targetLength = totalLength * Math.max(0, Math.min(1, position));
  let accumulated = 0;
  for (const segment of segments) {
    if (accumulated + segment.length >= targetLength) {
      const segmentPosition =
        segment.length > 0 ? (targetLength - accumulated) / segment.length : 0;
      return {
        point: {
          x: segment.start.x + segmentPosition * (segment.end.x - segment.start.x),
          y: segment.start.y + segmentPosition * (segment.end.y - segment.start.y),
        },
        angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x),
      };
    }
    accumulated += segment.length;
  }

  const lastSegment = segments[segments.length - 1]!;
  return {
    point: lastSegment.end,
    angle: Math.atan2(
      lastSegment.end.y - lastSegment.start.y,
      lastSegment.end.x - lastSegment.start.x
    ),
  };
}
