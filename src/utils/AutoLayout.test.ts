import { describe, expect, it } from 'vitest';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { AutoLayout } from './AutoLayout';

describe('AutoLayout.applyGridLayout', () => {
  it('positions nodes in a grid', () => {
    const nodes = [
      new RectangleNode({ x: 0, y: 0, width: 40, height: 20 }),
      new RectangleNode({ x: 0, y: 0, width: 40, height: 20 }),
      new RectangleNode({ x: 0, y: 0, width: 40, height: 20 }),
    ];

    const layout = new AutoLayout();
    layout.applyGridLayout(nodes, { columns: 2, columnGap: 10, rowGap: 10, startX: 5, startY: 5 });

    expect(nodes[0]!.x).toBe(5);
    expect(nodes[0]!.y).toBe(5);
    expect(nodes[1]!.x).toBe(55);
    expect(nodes[1]!.y).toBe(5);
    expect(nodes[2]!.x).toBe(5);
    expect(nodes[2]!.y).toBe(35);
  });
});
