import { describe, expect, it } from 'vitest';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { alignNodes, distributeNodes } from './AlignDistribute';

describe('alignNodes', () => {
  it('aligns nodes to the left', () => {
    const nodes = [
      new RectangleNode({ x: 10, y: 10, width: 50, height: 30 }),
      new RectangleNode({ x: 80, y: 10, width: 50, height: 30 }),
      new RectangleNode({ x: 30, y: 10, width: 50, height: 30 }),
    ];

    alignNodes(nodes, 'left');

    const left = nodes[0]!.x;
    expect(nodes.every((n) => n.x === left)).toBe(true);
  });
});

describe('distributeNodes', () => {
  it('distributes nodes horizontally', () => {
    const nodes = [
      new RectangleNode({ x: 0, y: 0, width: 20, height: 20 }),
      new RectangleNode({ x: 50, y: 0, width: 20, height: 20 }),
      new RectangleNode({ x: 100, y: 0, width: 20, height: 20 }),
    ];

    distributeNodes(nodes, 'horizontal');

    expect(nodes[0]!.x).toBe(0);
    expect(nodes[2]!.x + nodes[2]!.width).toBe(120);
  });
});
