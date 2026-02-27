import type { NodeStyle, EdgeStyle } from '@/types';

/**
 * Apply node style to canvas context
 * Returns the base opacity for fill/stroke calculations
 */
export function applyNodeStyle(
  ctx: CanvasRenderingContext2D,
  style: NodeStyle,
  state: 'normal' | 'hover' | 'selected' | 'dragging'
): number {
  ctx.fillStyle = style.fillColor ?? '#ffffff';
  ctx.strokeStyle = style.strokeColor ?? '#333333';
  ctx.lineWidth = style.strokeWidth ?? 2;

  const baseOpacity = style.opacity ?? 1;
  ctx.globalAlpha = baseOpacity;

  if (style.lineDash !== undefined && style.lineDash.length > 0) {
    ctx.setLineDash(style.lineDash);
  } else {
    ctx.setLineDash([]);
  }

  if (style.lineDashOffset !== undefined) {
    ctx.lineDashOffset = style.lineDashOffset;
  }

  // Highlight for hover state
  if (state === 'hover') {
    ctx.strokeStyle = '#6366f1';
  }

  return baseOpacity;
}

/**
 * Apply fill and stroke with opacity
 */
export function renderFillAndStroke(
  ctx: CanvasRenderingContext2D,
  baseOpacity: number,
  fillOpacity = 1,
  strokeOpacity = 1
): void {
  ctx.globalAlpha = baseOpacity * fillOpacity;
  ctx.fill();
  ctx.globalAlpha = baseOpacity * strokeOpacity;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Apply edge style to canvas context
 */
export function applyEdgeStyle(
  ctx: CanvasRenderingContext2D,
  style: EdgeStyle
): number {
  ctx.strokeStyle = style.strokeColor ?? '#666666';
  ctx.lineWidth = style.strokeWidth ?? 2;

  const baseOpacity = style.opacity ?? 1;
  const strokeOpacity = style.strokeOpacity ?? 1;
  ctx.globalAlpha = baseOpacity * strokeOpacity;

  if (style.lineDash !== undefined && style.lineDash.length > 0) {
    ctx.setLineDash(style.lineDash);
  } else {
    ctx.setLineDash([]);
  }

  if (style.lineDashOffset !== undefined) {
    ctx.lineDashOffset = style.lineDashOffset;
  }

  if (style.lineCap !== undefined) {
    ctx.lineCap = style.lineCap;
  }

  if (style.lineJoin !== undefined) {
    ctx.lineJoin = style.lineJoin;
  }

  return baseOpacity * strokeOpacity;
}
