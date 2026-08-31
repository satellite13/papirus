import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramRenderer } from '@/core/DiagramRenderer';
import { Edge } from '@/elements/Edge';
import { Group } from '@/elements/Group';
import { RectangleNode } from '@/elements/nodes/RectangleNode';
import { stubAnimationFrame, stubCanvasContext } from '@/test/testUtils';
import { ImageExporter } from './ImageExporter';

describe('ImageExporter', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('includes edge and group extents in export bounds', async () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 300,
      height: 200,
      retina: false,
    });
    const nodeA = new RectangleNode({
      id: 'node-a',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const nodeB = new RectangleNode({
      id: 'node-b',
      x: 20,
      y: 0,
      width: 10,
      height: 10,
    });
    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
      controlPoints: [{ x: 100, y: 50 }],
    });
    edge.updateEndpoints({ x: 10, y: 5 }, { x: 20, y: 5 });
    const group = new Group({ padding: 10 });
    group.addChild(nodeA);
    group.addChild(nodeB);
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    renderer.addEdge(edge);
    renderer.addGroup(group);

    let exportedWidth = 0;
    let exportedHeight = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback): void {
      exportedWidth = this.width;
      exportedHeight = this.height;
      callback(new Blob());
    });

    await new ImageExporter(renderer).exportPNG({ scale: 1, padding: 0 });

    expect(exportedWidth).toBe(110);
    expect(exportedHeight).toBe(60);

    renderer.destroy();
  });
});
