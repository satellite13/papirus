import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('ConnectionManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubCanvasContext();
    stubAnimationFrame();
  });

  function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    return canvas;
  }

  it('creates edge when connection completed with attachToOutline', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const startX = 80;
    const startY = 100;
    const endX = 280;
    const endY = 100;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: startX,
        clientY: startY,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: endX,
        clientY: endY,
        button: 0,
        bubbles: true,
      })
    );

    expect(renderer.edges.size).toBe(1);
    const edge = Array.from(renderer.edges.values())[0]!;
    expect(edge.from.nodeId).toBe(nodeA.id);
    expect(edge.to.nodeId).toBe(nodeB.id);
  });

  it('reconnects edge endpoint when dragging handle to new node', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: false });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 110, y: 100 }, { x: 250, y: 100 });

    interaction.selection.select(edge.id);

    const handleX = 110;
    const handleY = 100;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handleX,
        clientY: handleY,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.reconnecting).toBe(true);
  });

  it('supports configurable connection preview path type', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const ctx = renderer.getContext() as unknown as {
      bezierCurveTo: ReturnType<typeof vi.fn>;
      lineTo: ReturnType<typeof vi.fn>;
    };

    const startX = 110;
    const startY = 100;
    const endX = 250;
    const endY = 100;

    renderer.enableInteractions({ previewPathType: 'straight' });
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: startX, clientY: startY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    renderer.render();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();

    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: endX, clientY: endY, button: 0, bubbles: true })
    );
    ctx.lineTo.mockClear();
    ctx.bezierCurveTo.mockClear();

    renderer.disableInteractions();
    renderer.enableInteractions({ previewPathType: 'bezier' });
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: startX, clientY: startY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    renderer.render();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
  });
});
