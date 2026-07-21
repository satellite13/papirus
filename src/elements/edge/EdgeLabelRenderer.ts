import { EDGE_LABEL_BACKGROUND_RADIUS } from '@/constants';
import type { EdgeLabelBackground, EdgePathType, Point } from '@/types';
import { getPathPointAt } from '@/utils/edgePath';
import { drawRoundedRectPath } from '@/utils/geometry';
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

