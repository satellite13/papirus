import type { Node } from '@/elements/Node';

export interface GridLayoutOptions {
  columns?: number;
  rowGap?: number;
  columnGap?: number;
  startX?: number;
  startY?: number;
}

/**
 * Basic auto-layout utilities
 */
export class AutoLayout {
  applyGridLayout(nodes: Node[], options: GridLayoutOptions = {}): void {
    if (nodes.length === 0) return;

    const columns = options.columns ?? Math.ceil(Math.sqrt(nodes.length));
    const rowGap = options.rowGap ?? 40;
    const columnGap = options.columnGap ?? 40;
    const startX = options.startX ?? 0;
    const startY = options.startY ?? 0;

    let col = 0;
    let cursorX = startX;
    let cursorY = startY;
    let currentRowHeight = 0;

    for (const node of nodes) {
      node.x = cursorX;
      node.y = cursorY;
      currentRowHeight = Math.max(currentRowHeight, node.height);

      col += 1;
      if (col >= columns) {
        col = 0;
        cursorX = startX;
        cursorY += currentRowHeight + rowGap;
        currentRowHeight = 0;
      } else {
        cursorX += node.width + columnGap;
      }
    }
  }
}
