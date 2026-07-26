import type { ContentInsetSides, Size } from '@/types';

/**
 * Per-side flags: true = inset scales with node size relative to base size.
 */
export interface ContentInsetScaleSides {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
}

function axisFactor(node: number, base: number | undefined): number {
  if (base === undefined || !(base > 0) || !Number.isFinite(base)) {
    return 1;
  }
  if (!Number.isFinite(node)) {
    return 1;
  }
  return node / base;
}

/**
 * Resolve stored (reference) content inset to absolute px for the current node size.
 * Vertical sides (top/bottom) scale with height; horizontal (left/right) with width.
 */
export function resolveContentInset(
  inset: Required<ContentInsetSides>,
  scale: ContentInsetScaleSides | undefined,
  nodeSize: Size,
  baseSize: Size | undefined
): Required<ContentInsetSides> {
  const sx = axisFactor(nodeSize.width, baseSize?.width);
  const sy = axisFactor(nodeSize.height, baseSize?.height);
  const s = scale ?? {};

  const clamp = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0);

  return {
    top: clamp(s.top ? inset.top * sy : inset.top),
    bottom: clamp(s.bottom ? inset.bottom * sy : inset.bottom),
    left: clamp(s.left ? inset.left * sx : inset.left),
    right: clamp(s.right ? inset.right * sx : inset.right),
  };
}
