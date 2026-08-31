import type { Bounds, Size } from '@/types';
import { normalizeSides, type SidesConfig } from './CComponent';

/**
 * Flex container configuration
 */
export interface FlexConfig {
  direction: 'row' | 'column';
  justifyContent: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems: 'start' | 'center' | 'end' | 'stretch';
  gap: number;
  padding: number | SidesConfig;
}

/**
 * Input data for each flex child
 */
export interface FlexChild {
  /** Intrinsic (preferred) size from measure() */
  measure: Size;
  /** Minimum size the child can shrink to */
  minSize: Size;
  flexGrow: number;
  flexShrink: number;
  flexBasis: number | 'auto';
  alignSelf: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  margin: Required<SidesConfig>;
}

/**
 * Layout result
 */
export interface LayoutResult {
  /** Assigned bounds for each child, relative to container origin (0, 0) */
  childBounds: Bounds[];
  /** Total content size (for auto-sizing the container) */
  contentSize: Size;
}

/**
 * Pure flex layout algorithm (single-axis, no wrap).
 *
 * Implements a subset of CSS flexbox sufficient for diagram notation layouts:
 * - direction (row/column)
 * - justifyContent (start/center/end/space-between/space-around)
 * - alignItems + alignSelf (start/center/end/stretch)
 * - flexGrow / flexShrink
 * - gap between children
 * - padding around container
 * - per-child margin
 */
export function flexLayout(
  container: Size,
  config: FlexConfig,
  children: FlexChild[]
): LayoutResult {
  const pad = normalizeSides(config.padding);
  const isRow = config.direction === 'row';

  const innerWidth = Math.max(0, container.width - pad.left - pad.right);
  const innerHeight = Math.max(0, container.height - pad.top - pad.bottom);
  const availableMain = isRow ? innerWidth : innerHeight;
  const availableCross = isRow ? innerHeight : innerWidth;

  if (children.length === 0) {
    return {
      childBounds: [],
      contentSize: { width: pad.left + pad.right, height: pad.top + pad.bottom },
    };
  }

  // 1. Determine base sizes along main axis
  const baseSizes: number[] = [];
  const mainMargins: { before: number; after: number }[] = [];
  const crossMargins: { before: number; after: number }[] = [];

  for (const child of children) {
    const m = child.margin;
    if (isRow) {
      mainMargins.push({ before: m.left, after: m.right });
      crossMargins.push({ before: m.top, after: m.bottom });
    } else {
      mainMargins.push({ before: m.top, after: m.bottom });
      crossMargins.push({ before: m.left, after: m.right });
    }

    const measured = isRow ? child.measure.width : child.measure.height;
    const minMain = isRow ? child.minSize.width : child.minSize.height;
    const basis = child.flexBasis === 'auto' ? measured : child.flexBasis;
    baseSizes.push(Math.max(basis, minMain));
  }

  // 2. Calculate total base + gaps + margins
  const totalGaps = config.gap * Math.max(0, children.length - 1);
  let totalMargins = 0;
  for (const mm of mainMargins) {
    totalMargins += mm.before + mm.after;
  }

  let totalBase = 0;
  for (const s of baseSizes) {
    totalBase += s;
  }
  const totalUsed = totalBase + totalGaps + totalMargins;

  // 3. Grow or shrink
  const finalSizes = [...baseSizes];
  const remaining = availableMain - totalUsed;

  if (remaining > 0) {
    // Distribute extra space by flexGrow
    let totalGrow = 0;
    for (const child of children) {
      totalGrow += child.flexGrow;
    }
    if (totalGrow > 0) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i]!;
        finalSizes[i] = finalSizes[i]! + (remaining * child.flexGrow) / totalGrow;
      }
    }
  } else if (remaining < 0) {
    // Shrink by flexShrink. Items that reach minSize are frozen and their
    // unfulfilled share is redistributed among the remaining shrinkable items.
    const active = new Set<number>();
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const minMain = isRow ? child.minSize.width : child.minSize.height;
      if (child.flexShrink > 0 && finalSizes[i]! > minMain) {
        active.add(i);
      }
    }
    let deficit = -remaining;
    const epsilon = 1e-9;

    while (deficit > epsilon && active.size > 0) {
      let totalShrink = 0;
      for (const i of active) {
        totalShrink += children[i]!.flexShrink * baseSizes[i]!;
      }
      if (totalShrink <= 0) {
        break;
      }

      let distributed = 0;
      for (const i of active) {
        const child = children[i]!;
        const shrinkRatio = (child.flexShrink * baseSizes[i]!) / totalShrink;
        const minMain = isRow ? child.minSize.width : child.minSize.height;
        const shrink = Math.min(deficit * shrinkRatio, finalSizes[i]! - minMain);
        finalSizes[i] = finalSizes[i]! - shrink;
        distributed += shrink;
        if (finalSizes[i] - minMain <= epsilon) {
          finalSizes[i] = minMain;
          active.delete(i);
        }
      }

      if (distributed <= epsilon) {
        break;
      }
      deficit -= distributed;
    }
  }

  // 4. Calculate actual total after grow/shrink (for justifyContent)
  let actualTotal = totalGaps + totalMargins;
  for (const s of finalSizes) {
    actualTotal += s;
  }
  const freeSpace = Math.max(0, availableMain - actualTotal);

  // 5. Position along main axis
  let mainOffset: number;
  let betweenExtra: number;

  switch (config.justifyContent) {
    case 'center':
      mainOffset = freeSpace / 2;
      betweenExtra = 0;
      break;
    case 'end':
      mainOffset = freeSpace;
      betweenExtra = 0;
      break;
    case 'space-between':
      mainOffset = 0;
      betweenExtra = children.length > 1 ? freeSpace / (children.length - 1) : 0;
      break;
    case 'space-around':
      betweenExtra = freeSpace / children.length;
      mainOffset = betweenExtra / 2;
      break;
    default: // 'start'
      mainOffset = 0;
      betweenExtra = 0;
      break;
  }

  // 6. Build child bounds
  const childBounds: Bounds[] = [];
  let cursor = mainOffset;

  // Track max content extent for contentSize
  let maxCrossContent = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const mainSize = finalSizes[i]!;
    const mm = mainMargins[i]!;
    const cm = crossMargins[i]!;

    cursor += mm.before;

    // Cross axis sizing and alignment
    const crossAvailable = availableCross - cm.before - cm.after;
    const measuredCross = isRow ? child.measure.height : child.measure.width;
    const align = child.alignSelf === 'auto' ? config.alignItems : child.alignSelf;

    let crossSize: number;
    let crossOffset: number;

    if (align === 'stretch') {
      crossSize = crossAvailable;
      crossOffset = cm.before;
    } else {
      crossSize = Math.min(measuredCross, crossAvailable);
      switch (align) {
        case 'center':
          crossOffset = cm.before + (crossAvailable - crossSize) / 2;
          break;
        case 'end':
          crossOffset = cm.before + crossAvailable - crossSize;
          break;
        default: // 'start'
          crossOffset = cm.before;
          break;
      }
    }

    maxCrossContent = Math.max(maxCrossContent, crossOffset + crossSize + cm.after);

    if (isRow) {
      childBounds.push({
        x: pad.left + cursor,
        y: pad.top + crossOffset,
        width: mainSize,
        height: crossSize,
      });
    } else {
      childBounds.push({
        x: pad.left + crossOffset,
        y: pad.top + cursor,
        width: crossSize,
        height: mainSize,
      });
    }

    cursor += mainSize + mm.after;

    if (i < children.length - 1) {
      cursor += config.gap + betweenExtra;
    }
  }

  // 7. Content size (for auto-sizing)
  const mainContent = cursor;
  const contentWidth = isRow
    ? pad.left + mainContent + pad.right
    : pad.left + maxCrossContent + pad.right;
  const contentHeight = isRow
    ? pad.top + maxCrossContent + pad.bottom
    : pad.top + mainContent + pad.bottom;

  return {
    childBounds,
    contentSize: { width: contentWidth, height: contentHeight },
  };
}
