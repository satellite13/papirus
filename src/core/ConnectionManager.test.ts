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

  it('starts outline connection from hover handle without Shift', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 110,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.connecting).toBe(true);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 280,
        clientY: 100,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 280,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(renderer.edges.size).toBe(1);
    const edge = Array.from(renderer.edges.values())[0]!;
    expect(edge.from.nodeId).toBe(nodeA.id);
    expect(edge.to.nodeId).toBe(nodeB.id);
  });

  it('starts outline connection from the closest visible edge, not the side midpoint', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    renderer.addNode(new RectangleNode({ x: 0, y: 0, width: 360, height: 180 }));

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 40,
        clientY: 0,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.connecting).toBe(true);
  });

  it('does not start outline connection from node body without Shift', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    renderer.addNode(new RectangleNode({ x: 50, y: 80, width: 60, height: 40 }));

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 80,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.connecting).toBe(false);
  });

  it('does not show outline handle or start connection 8px inside the edge', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    renderer.addNode(new RectangleNode({ x: 50, y: 80, width: 60, height: 40 }));

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 102,
        clientY: 100,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('crosshair');

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 102,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.connecting).toBe(false);
  });

  it('shows outline handle and starts connection 2px from the edge', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    renderer.addNode(new RectangleNode({ x: 50, y: 80, width: 60, height: 40 }));

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 108,
        clientY: 100,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).toBe('crosshair');

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 108,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.connecting).toBe(true);
  });

  it('does not show outline handle on a selected node resize corner', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const node = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    renderer.addNode(node);
    interaction.selection.select(node.id);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 112,
        clientY: 122,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('crosshair');
  });

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

  it('creates edge when connection completed onto another edge', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const nodeA = new RectangleNode({ x: 40, y: 80, width: 50, height: 40 });
    const nodeB = new RectangleNode({ x: 300, y: 80, width: 50, height: 40 });
    const note = new RectangleNode({ x: 160, y: 20, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    renderer.addNode(note);

    const host = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 90, y: 100 }, { x: 300, y: 100 });

    const startX = 190;
    const startY = 40;
    const endX = 195;
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

    expect(renderer.edges.size).toBe(2);
    const created = Array.from(renderer.edges.values()).find(edge => edge.id !== host.id)!;
    expect(created.from.nodeId).toBe(note.id);
    expect(created.to.edgeId).toBe(host.id);
    expect(created.to.pathParam).toBeGreaterThan(0.2);
    expect(created.to.pathParam).toBeLessThan(0.8);
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
