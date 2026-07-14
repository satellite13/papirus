import type { Bounds, Size } from '@/types';
import type { NodeImageFit, NodeImageOptions, NodeImagePlacement } from '@/elements/NodeImage';

/**
 * Icon zone size including inset padding around the image.
 */
export function getIconBoxSize(
  imageSize: { width: number; height: number },
  inset: number
): Size {
  return {
    width: imageSize.width + inset * 2,
    height: imageSize.height + inset * 2,
  };
}

/**
 * Bounds of the icon zone within a node, based on placement.
 */
export function getIconBounds(
  bounds: Bounds,
  iconBoxSize: Size,
  placement: NodeImagePlacement,
  inset: number
): Bounds {
  switch (placement) {
    case 'top':
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: iconBoxSize.height,
      };
    case 'bottom':
      return {
        x: bounds.x,
        y: bounds.y + bounds.height - iconBoxSize.height,
        width: bounds.width,
        height: iconBoxSize.height,
      };
    case 'left':
      return {
        x: bounds.x,
        y: bounds.y,
        width: iconBoxSize.width,
        height: bounds.height,
      };
    case 'right':
      return {
        x: bounds.x + bounds.width - iconBoxSize.width,
        y: bounds.y,
        width: iconBoxSize.width,
        height: bounds.height,
      };
    case 'top-left':
      return {
        x: bounds.x + inset,
        y: bounds.y + inset,
        width: iconBoxSize.width,
        height: iconBoxSize.height,
      };
    case 'top-right':
      return {
        x: bounds.x + bounds.width - iconBoxSize.width - inset,
        y: bounds.y + inset,
        width: iconBoxSize.width,
        height: iconBoxSize.height,
      };
    case 'bottom-left':
      return {
        x: bounds.x + inset,
        y: bounds.y + bounds.height - iconBoxSize.height - inset,
        width: iconBoxSize.width,
        height: iconBoxSize.height,
      };
    case 'bottom-right':
      return {
        x: bounds.x + bounds.width - iconBoxSize.width - inset,
        y: bounds.y + bounds.height - iconBoxSize.height - inset,
        width: iconBoxSize.width,
        height: iconBoxSize.height,
      };
    case 'center':
    default:
      return bounds;
  }
}

export interface ComputeIconDrawRectOptions {
  fit?: NodeImageFit;
  scaleWithBounds?: boolean;
  width?: number;
  height?: number;
}

/**
 * Compute the draw rectangle for an icon image inside its zone bounds.
 */
export function computeIconDrawRect(
  bounds: Bounds,
  opts: ComputeIconDrawRectOptions,
  imageSize: { width: number; height: number },
  inset: number
): Bounds {
  const fit = opts.fit ?? 'none';
  const scaleWithBounds = opts.scaleWithBounds ?? false;

  const innerBounds: Bounds = {
    x: bounds.x + inset,
    y: bounds.y + inset,
    width: Math.max(0, bounds.width - inset * 2),
    height: Math.max(0, bounds.height - inset * 2),
  };
  const availableWidth = Math.max(0, innerBounds.width);
  const availableHeight = Math.max(0, innerBounds.height);

  let drawWidth = opts.width ?? imageSize.width;
  let drawHeight = opts.height ?? imageSize.height;

  if (scaleWithBounds) {
    if ((fit === 'contain' || fit === 'cover') && imageSize.width > 0 && imageSize.height > 0) {
      const scaleX = availableWidth / imageSize.width;
      const scaleY = availableHeight / imageSize.height;
      const scale = fit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
      drawWidth = imageSize.width * scale;
      drawHeight = imageSize.height * scale;
    } else if (fit === 'stretch') {
      drawWidth = availableWidth;
      drawHeight = availableHeight;
    }
  }

  drawWidth = Math.min(Math.max(0, drawWidth), Math.max(0, availableWidth));
  drawHeight = Math.min(Math.max(0, drawHeight), Math.max(0, availableHeight));

  return {
    x: innerBounds.x + (innerBounds.width - drawWidth) / 2,
    y: innerBounds.y + (innerBounds.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

/**
 * Convenience: compute draw rect from NodeImageOptions.
 */
export function computeIconDrawRectFromOptions(
  bounds: Bounds,
  opts: NodeImageOptions,
  imageSize: { width: number; height: number },
  inset: number
): Bounds {
  return computeIconDrawRect(bounds, opts, imageSize, inset);
}
