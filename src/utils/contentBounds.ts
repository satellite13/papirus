import type { Bounds } from '@/types';

export interface BoundsSource {
  visible: boolean;
  getBounds(): Bounds;
  getVisualBounds?(): Bounds;
}

export interface ContentBoundsInput {
  nodes?: Iterable<BoundsSource>;
  edges?: Iterable<BoundsSource>;
  groups?: Iterable<BoundsSource>;
  includeInvisible?: boolean;
}

export function getContentBounds({
  nodes,
  edges,
  groups,
  includeInvisible = false,
}: ContentBoundsInput): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasContent = false;

  const consider = (source: BoundsSource): void => {
    if (!includeInvisible && !source.visible) {
      return;
    }
    const bounds = source.getVisualBounds?.() ?? source.getBounds();
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
    hasContent = true;
  };

  if (nodes) {
    for (const node of nodes) {
      consider(node);
    }
  }

  if (edges) {
    for (const edge of edges) {
      consider(edge);
    }
  }

  if (groups) {
    for (const group of groups) {
      consider(group);
    }
  }

  if (!hasContent) {
    return null;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
