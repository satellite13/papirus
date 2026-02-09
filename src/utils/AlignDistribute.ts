import type { Node } from '@/elements/Node';

export type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeType = 'horizontal' | 'vertical';

/**
 * Align nodes by edge or center
 */
export function alignNodes(nodes: Node[], type: AlignType): void {
  if (nodes.length === 0) return;

  switch (type) {
    case 'left': {
      const minX = Math.min(...nodes.map((n) => n.x));
      for (const node of nodes) node.x = minX;
      break;
    }
    case 'center': {
      const centerX = Math.min(...nodes.map((n) => n.x + n.width / 2));
      for (const node of nodes) node.x = centerX - node.width / 2;
      break;
    }
    case 'right': {
      const maxX = Math.max(...nodes.map((n) => n.x + n.width));
      for (const node of nodes) node.x = maxX - node.width;
      break;
    }
    case 'top': {
      const minY = Math.min(...nodes.map((n) => n.y));
      for (const node of nodes) node.y = minY;
      break;
    }
    case 'middle': {
      const centerY = Math.min(...nodes.map((n) => n.y + n.height / 2));
      for (const node of nodes) node.y = centerY - node.height / 2;
      break;
    }
    case 'bottom': {
      const maxY = Math.max(...nodes.map((n) => n.y + n.height));
      for (const node of nodes) node.y = maxY - node.height;
      break;
    }
  }
}

/**
 * Distribute nodes evenly along axis
 */
export function distributeNodes(nodes: Node[], type: DistributeType): void {
  if (nodes.length < 3) return;

  if (type === 'horizontal') {
    const sorted = [...nodes].sort((a, b) => a.x - b.x);
    const minX = sorted[0]!.x;
    const maxX = sorted[sorted.length - 1]!.x + sorted[sorted.length - 1]!.width;
    const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
    const gap = (maxX - minX - totalWidth) / (sorted.length - 1);

    let currentX = minX;
    for (const node of sorted) {
      node.x = currentX;
      currentX += node.width + gap;
    }
  } else {
    const sorted = [...nodes].sort((a, b) => a.y - b.y);
    const minY = sorted[0]!.y;
    const maxY = sorted[sorted.length - 1]!.y + sorted[sorted.length - 1]!.height;
    const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
    const gap = (maxY - minY - totalHeight) / (sorted.length - 1);

    let currentY = minY;
    for (const node of sorted) {
      node.y = currentY;
      currentY += node.height + gap;
    }
  }
}
