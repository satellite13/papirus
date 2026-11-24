import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { CustomShapeNode } from '../elements/nodes/CustomShapeNode';
import { DiamondNode } from '../elements/nodes/DiamondNode';
import { Edge } from '../elements/Edge';
import { EDGE_SEGMENT_INSERT_CLICK_DELAY_MS } from '../constants';
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

  it('shows outline handle on a diamond edge far from the bounding box', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    renderer.addNode(new DiamondNode({ x: 20, y: 20, width: 200, height: 160 }));

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 170,
        clientY: 60,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('crosshair');

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 170,
        clientY: 60,
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

    expect(canvas.style.cursor).not.toBe('crosshair');

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

  it('does not show the outline + over a selected edge endpoint handle', () => {
    const canvas = createCanvas(400, 200);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'polyline' }),
    });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'polyline',
    });
    renderer.addEdge(edge);
    renderer.render();
    interaction.selection.select(edge.id);

    const drawPlus = vi.spyOn(
      interaction.connection as unknown as { drawPlus: (...args: unknown[]) => void },
      'drawPlus'
    );

    const handle = { ...edge.startPoint };
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: handle.x,
        clientY: handle.y,
        bubbles: true,
      })
    );
    renderer.render();

    expect(drawPlus).not.toHaveBeenCalled();
  });

  it('shows resize cursor instead of outline handle on a selected node resize corner', () => {
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

    expect(canvas.style.cursor).toBe('nwse-resize');
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

  it('prefers endpoint reconnect over a nearby first-segment mid-handle', () => {
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 40, y: 40, width: 80, height: 40 });
    const nodeB = new RectangleNode({ x: 280, y: 200, width: 100, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    // Short first horizontal: mid-handle sits close to the start endpoint.
    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
      controlPoints: [
        { x: 140, y: 60 },
        { x: 140, y: 220 },
      ],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 60 }, { x: 280, y: 220 });
    interaction.selection.select(edge.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 120,
        clientY: 60,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.reconnecting).toBe(true);
    expect(interaction.connection.reconnectingEdgeId).toBe(edge.id);
  });

  it('reconnects a polyline endpoint even when a mid-handle is near the start', () => {
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 40, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 280, y: 80, width: 80, height: 60 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'polyline',
    });
    renderer.addEdge(edge);
    renderer.render();
    interaction.selection.select(edge.id);

    const handle = { ...edge.startPoint };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );

    expect(interaction.connection.reconnecting).toBe(true);

    const slideTo = nodeA.getClosestPointOnOutline({ x: 120, y: 82 });
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        bubbles: true,
      })
    );
    renderer.render();

    expect(edge.from.portId).toBeUndefined();
    expect(edge.from.outlineParam).toBeDefined();
  });

  it('projects an interior drop onto the node outline before history when anchors are locked', () => {
    const canvas = createCanvas(500, 240);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 20, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 220, y: 20, width: 220, height: 180 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'orthogonal',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();
    interaction.selection.select(edge.id);

    const handle = { ...edge.endPoint };
    const inside = { x: nodeB.x + nodeB.width / 2, y: nodeB.y + nodeB.height / 2 };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: inside.x,
        clientY: inside.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: inside.x, clientY: inside.y, button: 0, bubbles: true })
    );

    expect(edge.to.nodeId).toBe(nodeB.id);
    expect(edge.to.portId).toBeUndefined();
    expect(edge.to.outlineParam).toEqual(expect.any(Number));
    expect(interaction.history.canUndo).toBe(true);
    interaction.history.undo();
    expect(edge.to.portId).toBe('anchor:left:0');
    expect(edge.to.outlineParam).toBeUndefined();
  });

  it('keeps a locked port when outline attachment is off', () => {
    const canvas = createCanvas(500, 240);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: false });

    const nodeA = new RectangleNode({ x: 20, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 220, y: 20, width: 220, height: 180 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'orthogonal',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();
    interaction.selection.select(edge.id);

    const handle = { ...edge.endPoint };
    const inside = { x: nodeB.x + nodeB.width / 2, y: nodeB.y + nodeB.height / 2 };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: inside.x,
        clientY: inside.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: inside.x, clientY: inside.y, button: 0, bubbles: true })
    );

    expect(edge.to.nodeId).toBe(nodeB.id);
    expect(edge.to.outlineParam).toBeUndefined();
    expect(edge.to.portId).toEqual(expect.stringMatching(/^anchor:/));
  });

  it('projects an interior drop onto a beveled custom shape outline', () => {
    const canvas = createCanvas(500, 240);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    if (typeof globalThis.Path2D === 'undefined') {
      class Path2DPolyfill {
        moveTo(): void {}
        lineTo(): void {}
        closePath(): void {}
      }
      vi.stubGlobal('Path2D', Path2DPolyfill);
    }
    const nodeA = new RectangleNode({ x: 20, y: 80, width: 80, height: 60 });
    const nodeB = new CustomShapeNode({
      x: 220,
      y: 20,
      width: 220,
      height: 180,
      shapeType: 'beveled-rectangle',
      path: (width, height) => {
        const path = new Path2D();
        const cut = 12;
        path.moveTo(cut, 0);
        path.lineTo(width - cut, 0);
        path.lineTo(width, cut);
        path.lineTo(width, height - cut);
        path.lineTo(width - cut, height);
        path.lineTo(cut, height);
        path.lineTo(0, height - cut);
        path.lineTo(0, cut);
        path.closePath();
        return path;
      },
    });
    vi.spyOn(nodeB, 'hitTest').mockImplementation(
      (point) =>
        point.x >= nodeB.x &&
        point.x <= nodeB.x + nodeB.width &&
        point.y >= nodeB.y &&
        point.y <= nodeB.y + nodeB.height
    );
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'orthogonal',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();
    interaction.selection.select(edge.id);

    const handle = { ...edge.endPoint };
    const inside = { x: nodeB.x + nodeB.width / 2, y: nodeB.y + nodeB.height / 2 };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: inside.x,
        clientY: inside.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: inside.x, clientY: inside.y, button: 0, bubbles: true })
    );

    expect(edge.to.nodeId).toBe(nodeB.id);
    expect(edge.to.portId).toBeUndefined();
    expect(edge.to.outlineParam).toEqual(expect.any(Number));
  });

  it('keeps a start point slid along the outline when anchors are locked', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 40, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 240, y: 80, width: 80, height: 60 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const start = nodeA.getClosestPointOnOutline({ x: 120, y: 110 });
    const end = nodeB.getClosestPointOnOutline({ x: 240, y: 110 });
    const edge = new Edge({
      from: { nodeId: nodeA.id, outlineParam: start.param },
      to: { nodeId: nodeB.id, outlineParam: end.param },
      type: 'polyline',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();

    const beforeParam = edge.from.outlineParam ?? -1;
    const handle = { ...edge.startPoint };
    interaction.selection.select(edge.id);

    const slideTo = nodeA.getClosestPointOnOutline({ x: 80, y: 80 });
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        bubbles: true,
      })
    );
    renderer.render();

    expect(edge.from.outlineParam).toBeDefined();
    expect(edge.from.portId).toBeUndefined();
    expect(Math.abs((edge.from.outlineParam ?? 0) - beforeParam)).toBeGreaterThan(0.05);
    expect(edge.startPoint.y).toBeLessThan(handle.y - 15);
  });

  it('slides a locked side-port start along the outline instead of snapping back', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 40, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 240, y: 80, width: 80, height: 60 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id, portId: 'anchor:right:0' },
      to: { nodeId: nodeB.id, portId: 'anchor:left:0' },
      type: 'polyline',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();

    const handle = { ...edge.startPoint };
    interaction.selection.select(edge.id);
    const slideTo = nodeA.getClosestPointOnOutline({ x: 120, y: 82 });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: slideTo.point.x,
        clientY: slideTo.point.y,
        button: 0,
        bubbles: true,
      })
    );
    renderer.render();

    expect(edge.from.portId).toBeUndefined();
    expect(edge.from.outlineParam).toBeDefined();
    expect(edge.startPoint.y).toBeLessThan(handle.y - 15);
  });

  it('does not pull a same-node outline slide back onto the opposite endpoint axis', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 40, y: 80, width: 80, height: 60 });
    const nodeB = new RectangleNode({ x: 240, y: 80, width: 80, height: 60 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const start = nodeA.getClosestPointOnOutline({ x: 120, y: 110 });
    const end = nodeB.getClosestPointOnOutline({ x: 240, y: 110 });
    const edge = new Edge({
      from: { nodeId: nodeA.id, outlineParam: start.param },
      to: { nodeId: nodeB.id, outlineParam: end.param },
      type: 'polyline',
      lockAnchors: true,
    });
    renderer.addEdge(edge);
    renderer.render();

    const handle = { ...edge.startPoint };
    interaction.selection.select(edge.id);
    // 6px is inside the 10px axis magnet, which used to throw the point back.
    const slideY = handle.y - 6;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: handle.x,
        clientY: handle.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: handle.x,
        clientY: slideY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: handle.x,
        clientY: slideY,
        button: 0,
        bubbles: true,
      })
    );
    renderer.render();

    expect(edge.from.portId).toBeUndefined();
    expect(edge.startPoint.y).toBeLessThan(handle.y - 4);
  });

  it('keeps a new editable bend pulled slightly off its segment', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions({ attachToOutline: true });

    const nodeA = new RectangleNode({ x: 0, y: 80, width: 40, height: 40 });
    const nodeB = new RectangleNode({ x: 200, y: 80, width: 40, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 40, y: 100 }, { x: 200, y: 100 }, 'right', 'left');
    renderer.render();
    interaction.selection.select(edge.id);

    // Midpoint of start → virtual center. The + sits on the straight segment.
    const insert = { x: 80, y: 100 };
    const draggedY = 94;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: insert.x,
        clientY: insert.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: insert.x,
        clientY: draggedY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: insert.x,
        clientY: draggedY,
        button: 0,
        bubbles: true,
      })
    );

    const offSegment = (edge.controlPoints ?? []).some((point) => point.y < 96);
    expect(offSegment).toBe(true);
  });

  it('keeps a new bend when the pull is inside the screen magnet but the diagram is zoomed out', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions();
    renderer.zoom = 0.5;

    const nodeA = new RectangleNode({ x: 0, y: 80, width: 40, height: 40 });
    const nodeB = new RectangleNode({ x: 200, y: 80, width: 40, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 40, y: 100 }, { x: 200, y: 100 }, 'right', 'left');
    renderer.render();
    interaction.selection.select(edge.id);

    // 15 world px is 7.5 screen px at zoom 0.5, inside the 10px magnet.
    const insert = { x: 80, y: 100 };
    const dragged = { x: 80, y: 85 };
    const toClient = (point: { x: number; y: number }) => ({
      x: point.x * renderer.zoom,
      y: point.y * renderer.zoom,
    });
    const down = toClient(insert);
    const move = toClient(dragged);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: down.x, clientY: down.y, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: move.x,
        clientY: move.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: move.x, clientY: move.y, button: 0, bubbles: true })
    );

    expect((edge.controlPoints ?? []).some((point) => point.y < 90)).toBe(true);
  });

  it('still snaps a bend to a neighbor axis that is not its own segment', () => {
    const canvas = createCanvas(400, 240);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 240, retina: false });
    const interaction = renderer.enableInteractions();

    const nodeA = new RectangleNode({ x: 0, y: 80, width: 40, height: 40 });
    const nodeB = new RectangleNode({ x: 200, y: 80, width: 40, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
      controlPoints: [{ x: 120, y: 60 }],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 40, y: 100 }, { x: 200, y: 100 }, 'right', 'left');
    renderer.render();
    interaction.selection.select(edge.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 120, clientY: 60, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 46,
        clientY: 60,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 46, clientY: 60, button: 0, bubbles: true })
    );

    expect(edge.controlPoints?.[0]).toEqual({ x: 40, y: 60 });
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
    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id)!;
    expect(created.from.nodeId).toBe(note.id);
    expect(created.to.edgeId).toBe(host.id);
    expect(created.to.pathParam).toBeGreaterThan(0.2);
    expect(created.to.pathParam).toBeLessThan(0.8);
  });

  it('keeps attach-to-outline snap on a node when a nearby polyline crosses the outline', () => {
    const canvas = createCanvas(420, 280);
    const renderer = new DiagramRenderer(canvas, { width: 420, height: 280, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const source = new RectangleNode({ x: 20, y: 210, width: 40, height: 30 });
    const group = new RectangleNode({ x: 100, y: 20, width: 280, height: 160 });
    const innerA = new RectangleNode({ x: 140, y: 40, width: 40, height: 24 });
    const innerB = new RectangleNode({ x: 300, y: 40, width: 40, height: 24 });
    renderer.addNode(source);
    renderer.addNode(group);
    renderer.addNode(innerA);
    renderer.addNode(innerB);

    const host = new Edge({
      from: { nodeId: innerA.id },
      to: { nodeId: innerB.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 120, y: 30 }, { x: 120, y: 170 });

    const dropX = 100;
    const dropY = 100;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 60,
        clientY: 225,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(source.id);
    expect(created?.to.nodeId).toBe(group.id);
    expect(created?.to.edgeId).toBeUndefined();
    expect(created?.to.outlineParam).toBeDefined();
  });

  it('attaches a note to an edge that crosses a group node fill, not to the group', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const group = new RectangleNode({ x: 40, y: 40, width: 320, height: 140 });
    const nodeA = new RectangleNode({ x: 50, y: 90, width: 40, height: 30 });
    const nodeB = new RectangleNode({ x: 310, y: 90, width: 40, height: 30 });
    const note = new RectangleNode({ x: 160, y: 0, width: 60, height: 28 });
    renderer.addNode(group);
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    renderer.addNode(note);

    const host = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 90, y: 105 }, { x: 310, y: 105 });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 190,
        clientY: 14,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 105,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 105,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(note.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('attaches a note to an edge that starts on a group outline, not to the group', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const group = new RectangleNode({ x: 40, y: 40, width: 120, height: 80 });
    const other = new RectangleNode({ x: 280, y: 60, width: 50, height: 40 });
    const note = new RectangleNode({ x: 90, y: 0, width: 50, height: 24 });
    renderer.addNode(group);
    renderer.addNode(other);
    renderer.addNode(note);

    const host = new Edge({
      from: { nodeId: group.id },
      to: { nodeId: other.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 160, y: 80 }, { x: 280, y: 80 });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 115,
        clientY: 12,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 80,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 160,
        clientY: 80,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(note.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('attaches a note to a group-crossing edge when the drop is slightly off the stroke', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const group = new RectangleNode({ x: 40, y: 40, width: 320, height: 140 });
    const nodeA = new RectangleNode({ x: 50, y: 90, width: 40, height: 30 });
    const nodeB = new RectangleNode({ x: 310, y: 90, width: 40, height: 30 });
    const note = new RectangleNode({ x: 160, y: 0, width: 60, height: 28 });
    renderer.addNode(group);
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    renderer.addNode(note);

    const host = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 90, y: 105 }, { x: 310, y: 105 });

    // 12px above the stroke: on the fill, still on the line, not a 40px magnet.
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 190,
        clientY: 14,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 93,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 93,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(note.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('attaches a note to a group-exit edge when dropping on the visible stroke', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const group = new RectangleNode({ x: 40, y: 40, width: 200, height: 120 });
    const other = new RectangleNode({ x: 320, y: 80, width: 50, height: 40 });
    const note = new RectangleNode({ x: 90, y: 0, width: 50, height: 24 });
    interaction.connection.connectionValidator = (_from, to) => to !== group.id;
    renderer.addNode(group);
    renderer.addNode(other);
    renderer.addNode(note);

    const host = new Edge({
      from: { nodeId: group.id },
      to: { nodeId: other.id },
      type: 'straight',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 240, y: 100 }, { x: 320, y: 100 });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 115,
        clientY: 12,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 250,
        clientY: 100,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 250,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(note.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('attaches Confirm to a visible polyline that crosses a pool, not to the pool', () => {
    const canvas = createCanvas(600, 380);
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 380, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const pool = new RectangleNode({ x: 20, y: 20, width: 540, height: 330 });
    const validate = new RectangleNode({ x: 200, y: 70, width: 120, height: 50 });
    const endError = new RectangleNode({ x: 470, y: 40, width: 50, height: 50 });
    const confirm = new RectangleNode({ x: 390, y: 260, width: 80, height: 50 });
    interaction.connection.connectionValidator = (_from, to) => to !== pool.id;
    renderer.addNode(pool);
    renderer.addNode(validate);
    renderer.addNode(endError);
    renderer.addNode(confirm);

    const host = new Edge({
      from: { nodeId: validate.id },
      to: { nodeId: endError.id },
      type: 'polyline',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 320, y: 95 }, { x: 470, y: 65 }, 'right', 'left');

    const dropX = 400;
    const dropY = 80;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 430,
        clientY: 285,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(confirm.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('looks through a nested lane inside a pool to attach Confirm to the crossing polyline', () => {
    const canvas = createCanvas(600, 380);
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 380, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const pool = new RectangleNode({ x: 10, y: 10, width: 560, height: 350 });
    const lane = new RectangleNode({ x: 40, y: 30, width: 510, height: 310 });
    const validate = new RectangleNode({ x: 200, y: 70, width: 120, height: 50 });
    const endError = new RectangleNode({ x: 470, y: 40, width: 50, height: 50 });
    const confirm = new RectangleNode({ x: 390, y: 260, width: 80, height: 50 });
    interaction.connection.connectionValidator = (_from, to) => to !== pool.id && to !== lane.id;
    renderer.addNode(pool);
    renderer.addNode(lane);
    renderer.addNode(validate);
    renderer.addNode(endError);
    renderer.addNode(confirm);

    const host = new Edge({
      from: { nodeId: validate.id },
      to: { nodeId: endError.id },
      type: 'polyline',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 320, y: 95 }, { x: 470, y: 65 }, 'right', 'left');

    const dropX = 400;
    const dropY = 80;
    expect(renderer.getElementAtPoint({ x: dropX, y: dropY })?.id).toBe(host.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 430,
        clientY: 285,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(confirm.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('looks through three nested groups to attach to a crossing polyline', () => {
    const canvas = createCanvas(600, 380);
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 380, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const outer = new RectangleNode({ x: 8, y: 8, width: 570, height: 360 });
    const pool = new RectangleNode({ x: 20, y: 20, width: 540, height: 330 });
    const lane = new RectangleNode({ x: 50, y: 40, width: 490, height: 290 });
    const validate = new RectangleNode({ x: 200, y: 70, width: 120, height: 50 });
    const endError = new RectangleNode({ x: 470, y: 40, width: 50, height: 50 });
    const confirm = new RectangleNode({ x: 390, y: 260, width: 80, height: 50 });
    const forbidden = new Set([outer.id, pool.id, lane.id]);
    interaction.connection.connectionValidator = (_from, to) => !forbidden.has(to);
    renderer.addNode(outer);
    renderer.addNode(pool);
    renderer.addNode(lane);
    renderer.addNode(validate);
    renderer.addNode(endError);
    renderer.addNode(confirm);

    const host = new Edge({
      from: { nodeId: validate.id },
      to: { nodeId: endError.id },
      type: 'polyline',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 320, y: 95 }, { x: 470, y: 65 }, 'right', 'left');

    const dropX = 400;
    const dropY = 80;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 430,
        clientY: 285,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(confirm.id);
    expect(created?.to.edgeId).toBe(host.id);
  });

  it('still connects Confirm to a sibling node inside the lane, not to a distant crossing edge', () => {
    const canvas = createCanvas(600, 380);
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 380, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const pool = new RectangleNode({ x: 10, y: 10, width: 560, height: 350 });
    const lane = new RectangleNode({ x: 40, y: 30, width: 510, height: 310 });
    const validate = new RectangleNode({ x: 80, y: 60, width: 80, height: 40 });
    const endError = new RectangleNode({ x: 450, y: 250, width: 50, height: 50 });
    const confirm = new RectangleNode({ x: 80, y: 250, width: 80, height: 50 });
    interaction.connection.connectionValidator = (_from, to) => to !== pool.id && to !== lane.id;
    renderer.addNode(pool);
    renderer.addNode(lane);
    renderer.addNode(validate);
    renderer.addNode(endError);
    renderer.addNode(confirm);

    const host = new Edge({
      from: { nodeId: validate.id },
      to: { nodeId: endError.id },
      type: 'polyline',
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 160, y: 80 }, { x: 450, y: 250 }, 'right', 'left');

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 120,
        clientY: 275,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 475,
        clientY: 275,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 475,
        clientY: 275,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(confirm.id);
    expect(created?.to.nodeId).toBe(endError.id);
    expect(created?.to.edgeId).toBeUndefined();
  });

  it('attaches to a long orthogonal polyline over a pool between length samples', () => {
    const canvas = createCanvas(600, 380);
    const renderer = new DiagramRenderer(canvas, { width: 600, height: 380, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const pool = new RectangleNode({ x: 20, y: 20, width: 540, height: 330 });
    const validate = new RectangleNode({ x: 30, y: 50, width: 40, height: 40 });
    const endError = new RectangleNode({ x: 500, y: 280, width: 40, height: 40 });
    const confirm = new RectangleNode({ x: 390, y: 260, width: 80, height: 50 });
    interaction.connection.connectionValidator = (_from, to) => to !== pool.id;
    renderer.addNode(pool);
    renderer.addNode(validate);
    renderer.addNode(endError);
    renderer.addNode(confirm);

    const controlPoints: Array<{ x: number; y: number }> = [];
    let y = 80;
    for (let i = 0; i < 12; i++) {
      controlPoints.push({ x: i % 2 === 0 ? 480 : 80, y });
      y += 14;
    }
    const host = new Edge({
      from: { nodeId: validate.id },
      to: { nodeId: endError.id },
      type: 'editable-polyline',
      controlPoints,
    });
    renderer.addEdge(host);
    host.updateEndpoints({ x: 70, y: 70 }, { x: 520, y: 300 }, 'right', 'left');

    // On the first long almost-horizontal segment, away from both endpoints.
    const dropX = 275;
    const dropY = 75;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 430,
        clientY: 285,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== host.id);
    expect(created?.from.nodeId).toBe(confirm.id);
    expect(created?.to.edgeId).toBe(host.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('attaches E to the midpoint of C–D (link1) across nested A⊃B containers', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');

    const dropX = 290;
    const dropY = 90;
    expect(renderer.getElementAtPoint({ x: dropX, y: dropY })?.id).toBe(link1.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 120,
        clientY: 280,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== link1.id);
    expect(created?.from.nodeId).toBe(e.id);
    expect(created?.to.edgeId).toBe(link1.id);
    expect(created?.to.nodeId).toBeUndefined();
    expect(created?.to.pathParam).toBeGreaterThan(0.3);
    expect(created?.to.pathParam).toBeLessThan(0.7);
  });

  it('attaches E to link1 when the drop is on C’s body but closer to the C–D stroke', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');

    // On C’s fill, 5px left of the C–D start — on the stroke, not a magnet to C.
    const dropX = 155;
    const dropY = 90;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 120,
        clientY: 280,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== link1.id);
    expect(created?.from.nodeId).toBe(e.id);
    expect(created?.to.edgeId).toBe(link1.id);
    expect(created?.to.nodeId).toBeUndefined();
  });

  it('still attaches E to link1 when the cursor is slightly off the stroke over B', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');

    const dropX = 290;
    const dropY = 110;
    expect(renderer.getElementAtPoint({ x: dropX, y: dropY })?.id).not.toBe(link1.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 120,
        clientY: 280,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(canvas.style.cursor).not.toBe('not-allowed');
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: dropX,
        clientY: dropY,
        button: 0,
        bubbles: true,
      })
    );

    const created = Array.from(renderer.edges.values()).find((edge) => edge.id !== link1.id);
    expect(created?.from.nodeId).toBe(e.id);
    expect(created?.to.edgeId).toBe(link1.id);
  });

  it('keeps normal node-to-node reconnect scoped to nodes near another edge', () => {
    const canvas = createCanvas(520, 320);
    const renderer = new DiagramRenderer(canvas, { width: 520, height: 320, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const source = new RectangleNode({ x: 40, y: 220, width: 80, height: 40 });
    const oldTarget = new RectangleNode({ x: 400, y: 220, width: 80, height: 40 });
    const f = new RectangleNode({ x: 100, y: 100, width: 80, height: 40 });
    const g = new RectangleNode({ x: 400, y: 100, width: 80, height: 40 });
    renderer.addNode(source);
    renderer.addNode(oldTarget);
    renderer.addNode(f);
    renderer.addNode(g);

    const crossing = new Edge({
      from: { nodeId: f.id },
      to: { nodeId: g.id },
      type: 'straight',
    });
    renderer.addEdge(crossing);
    crossing.updateEndpoints({ x: 180, y: 120 }, { x: 400, y: 120 });

    const normal = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: oldTarget.id },
      type: 'straight',
    });
    renderer.addEdge(normal);
    normal.updateEndpoints({ x: 120, y: 240 }, { x: 400, y: 240 });
    interaction.selection.select(normal.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 240,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 190,
        clientY: 100,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 190,
        clientY: 100,
        button: 0,
        bubbles: true,
      })
    );

    expect(normal.to.nodeId).toBe(f.id);
    expect(normal.to.edgeId).toBeUndefined();
  });

  it('reconnects a normal node endpoint inside a large component body', () => {
    const canvas = createCanvas(560, 360);
    const renderer = new DiagramRenderer(canvas, { width: 560, height: 360, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const source = new RectangleNode({ x: 40, y: 280, width: 80, height: 40 });
    const oldTarget = new RectangleNode({ x: 440, y: 280, width: 80, height: 40 });
    const largeTarget = new RectangleNode({ x: 160, y: 60, width: 200, height: 160 });
    renderer.addNode(source);
    renderer.addNode(oldTarget);
    renderer.addNode(largeTarget);

    const normal = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: oldTarget.id },
      type: 'straight',
    });
    renderer.addEdge(normal);
    normal.updateEndpoints({ x: 120, y: 300 }, { x: 440, y: 300 });
    interaction.selection.select(normal.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 440,
        clientY: 300,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 260,
        clientY: 140,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 260,
        clientY: 140,
        button: 0,
        bubbles: true,
      })
    );

    expect(normal.to.nodeId).toBe(largeTarget.id);
    expect(normal.to.edgeId).toBeUndefined();
  });

  it('reconnects the junction end from link1 onto another crossing stroke', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    const f = new RectangleNode({ x: 80, y: 160, width: 80, height: 40 });
    const g = new RectangleNode({ x: 420, y: 160, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);
    renderer.addNode(f);
    renderer.addNode(g);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    const link2 = new Edge({
      from: { nodeId: f.id },
      to: { nodeId: g.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    renderer.addEdge(link2);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');
    link2.updateEndpoints({ x: 160, y: 180 }, { x: 420, y: 180 }, 'right', 'left');

    const junction = new Edge({
      from: { nodeId: e.id },
      to: { edgeId: link1.id, pathParam: 0.5 },
      type: 'straight',
    });
    renderer.addEdge(junction);
    const attach = link1.getPointAt(0.5)!.point;
    junction.updateEndpoints({ x: 120, y: 260 }, attach);

    interaction.selection.select(junction.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: attach.x,
        clientY: attach.y,
        button: 0,
        bubbles: true,
      })
    );
    expect(interaction.connection.reconnecting).toBe(true);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 290,
        clientY: 180,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 290,
        clientY: 180,
        button: 0,
        bubbles: true,
      })
    );

    expect(junction.to.edgeId).toBe(link2.id);
    expect(junction.to.nodeId).toBeUndefined();
    expect(junction.to.pathParam).toBeGreaterThan(0.3);
    expect(junction.to.pathParam).toBeLessThan(0.7);
  });

  it('reconnects onto link2 when the cursor is over F but closer to the F–G stroke', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    const f = new RectangleNode({ x: 80, y: 160, width: 80, height: 40 });
    const g = new RectangleNode({ x: 420, y: 160, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);
    renderer.addNode(f);
    renderer.addNode(g);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    const link2 = new Edge({
      from: { nodeId: f.id },
      to: { nodeId: g.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    renderer.addEdge(link2);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');
    link2.updateEndpoints({ x: 160, y: 180 }, { x: 420, y: 180 }, 'right', 'left');

    const junction = new Edge({
      from: { nodeId: e.id },
      to: { edgeId: link1.id, pathParam: 0.5 },
      type: 'straight',
    });
    renderer.addEdge(junction);
    const attach = link1.getPointAt(0.5)!.point;
    junction.updateEndpoints({ x: 120, y: 260 }, attach);

    interaction.selection.select(junction.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: attach.x,
        clientY: attach.y,
        button: 0,
        bubbles: true,
      })
    );
    expect(interaction.connection.reconnecting).toBe(true);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 140,
        clientY: 180,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 140,
        clientY: 180,
        button: 0,
        bubbles: true,
      })
    );

    expect(junction.to.edgeId).toBe(link2.id);
    expect(junction.to.nodeId).toBeUndefined();
  });

  it('reconnects onto link2 near the F outline, not onto F itself', () => {
    const canvas = createCanvas(640, 400);
    const renderer = new DiagramRenderer(canvas, { width: 640, height: 400, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const a = new RectangleNode({ x: 10, y: 10, width: 600, height: 370 });
    const b = new RectangleNode({ x: 40, y: 40, width: 540, height: 320 });
    const c = new RectangleNode({ x: 80, y: 70, width: 80, height: 40 });
    const d = new RectangleNode({ x: 420, y: 70, width: 80, height: 40 });
    const e = new RectangleNode({ x: 80, y: 260, width: 80, height: 40 });
    const f = new RectangleNode({ x: 80, y: 160, width: 80, height: 40 });
    const g = new RectangleNode({ x: 420, y: 160, width: 80, height: 40 });
    interaction.connection.connectionValidator = (_from, to) => to !== a.id && to !== b.id;
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addNode(c);
    renderer.addNode(d);
    renderer.addNode(e);
    renderer.addNode(f);
    renderer.addNode(g);

    const link1 = new Edge({
      from: { nodeId: c.id },
      to: { nodeId: d.id },
      type: 'polyline',
    });
    const link2 = new Edge({
      from: { nodeId: f.id },
      to: { nodeId: g.id },
      type: 'polyline',
    });
    renderer.addEdge(link1);
    renderer.addEdge(link2);
    link1.updateEndpoints({ x: 160, y: 90 }, { x: 420, y: 90 }, 'right', 'left');
    link2.updateEndpoints({ x: 160, y: 180 }, { x: 420, y: 180 }, 'right', 'left');

    const junction = new Edge({
      from: { nodeId: e.id },
      to: { edgeId: link1.id, pathParam: 0.5 },
      type: 'straight',
    });
    renderer.addEdge(junction);
    const attach = link1.getPointAt(0.5)!.point;
    junction.updateEndpoints({ x: 120, y: 260 }, attach);

    interaction.selection.select(junction.id);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: attach.x,
        clientY: attach.y,
        button: 0,
        bubbles: true,
      })
    );
    expect(interaction.connection.reconnecting).toBe(true);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 170,
        clientY: 160,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 170,
        clientY: 160,
        button: 0,
        bubbles: true,
      })
    );

    expect(junction.to.edgeId).toBe(link2.id);
    expect(junction.to.nodeId).toBeUndefined();
  });

  it('does not attach to a hidden grouping edge that only crosses a pool fill', () => {
    const canvas = createCanvas(400, 220);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    const interaction = renderer.enableInteractions({
      attachToOutline: true,
      createEdge: (from, to) => new Edge({ from, to, type: 'straight' }),
    });

    const pool = new RectangleNode({ x: 40, y: 40, width: 220, height: 140 });
    const child = new RectangleNode({ x: 160, y: 90, width: 50, height: 30 });
    const source = new RectangleNode({ x: 10, y: 0, width: 50, height: 24 });
    interaction.connection.connectionValidator = (_from, to) => to !== pool.id;
    renderer.addNode(pool);
    renderer.addNode(child);
    renderer.addNode(source);

    const host = new Edge({
      from: { nodeId: pool.id },
      to: { nodeId: child.id },
      type: 'straight',
    });
    host.visible = false;
    renderer.addEdge(host);
    host.updateEndpoints({ x: 160, y: 105 }, { x: 185, y: 105 });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 35,
        clientY: 12,
        button: 0,
        shiftKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 110,
        button: 0,
        buttons: 1,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(canvas.style.cursor).not.toBe('not-allowed');

    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 100,
        clientY: 110,
        button: 0,
        bubbles: true,
      })
    );

    expect(Array.from(renderer.edges.values()).some((edge) => edge.id !== host.id)).toBe(false);
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

  it('moves an orthogonal mid-segment of editable-polyline', () => {
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'editable-polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 100, width: 80, height: 40 });
    const target = new RectangleNode({ x: 320, y: 180, width: 80, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'editable-polyline',
      controlPoints: [
        { x: 200, y: 120 },
        { x: 200, y: 200 },
      ],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 120 }, { x: 320, y: 200 });
    edge.state = 'selected';

    const mid = { x: 200, y: 160 };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: mid.x,
        clientY: mid.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: mid.x + 40,
        clientY: mid.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: mid.x + 40,
        clientY: mid.y,
        button: 0,
        bubbles: true,
      })
    );

    expect(edge.controlPoints?.every((p) => Math.abs(p.x - 240) < 1)).toBe(true);
  });

  it('inserts a bend when clicking a diagonal segment', () => {
    vi.useFakeTimers();
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'editable-polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 40, width: 60, height: 40 });
    const target = new RectangleNode({ x: 300, y: 200, width: 60, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'editable-polyline',
      controlPoints: [{ x: 200, y: 80 }],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 100, y: 60 }, { x: 300, y: 220 });
    edge.controlPoints = [{ x: 180, y: 200 }];
    edge.updateEndpoints({ x: 100, y: 60 }, { x: 300, y: 60 });
    edge.state = 'selected';

    const beforeCount = edge.controlPoints?.length ?? 0;
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 140,
        clientY: 130,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 140,
        clientY: 130,
        button: 0,
        bubbles: true,
      })
    );
    expect(edge.controlPoints?.length ?? 0).toBe(beforeCount);
    vi.advanceTimersByTime(EDGE_SEGMENT_INSERT_CLICK_DELAY_MS + 1);
    expect(edge.controlPoints?.length ?? 0).toBe(beforeCount + 1);
    vi.useRealTimers();
  });

  it('inserts a bend when clicking the segment body away from the mid-handle', () => {
    vi.useFakeTimers();
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'editable-polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 100, width: 80, height: 40 });
    const target = new RectangleNode({ x: 320, y: 100, width: 80, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'editable-polyline',
      controlPoints: [
        { x: 200, y: 120 },
        { x: 200, y: 200 },
      ],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 120 }, { x: 320, y: 200 });
    edge.state = 'selected';

    const beforeCount = edge.controlPoints?.length ?? 0;
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 140,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 200,
        clientY: 140,
        button: 0,
        bubbles: true,
      })
    );
    expect(edge.controlPoints?.length ?? 0).toBe(beforeCount);
    vi.advanceTimersByTime(EDGE_SEGMENT_INSERT_CLICK_DELAY_MS + 1);
    expect(edge.controlPoints?.length ?? 0).toBe(beforeCount + 1);
    vi.useRealTimers();
  });

  it('inserts a bend on the vertical between corners, not past the bottom corner', () => {
    vi.useFakeTimers();
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 40, width: 80, height: 40 });
    const target = new RectangleNode({ x: 280, y: 200, width: 100, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    // Path with an exit stub so promote collapses indices vs the click segmentIndex.
    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'polyline',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 60 }, { x: 280, y: 220 });
    // Force a stubbed orthogonal path like the router (indices shift on promote).
    (edge as unknown as { _path: { x: number; y: number }[] })._path = [
      { x: 120, y: 60 },
      { x: 152, y: 60 },
      { x: 180, y: 60 },
      { x: 180, y: 220 },
      { x: 280, y: 220 },
    ];
    edge.state = 'selected';

    // Click on the vertical below its mid-handle (mid of 180,60→180,220 is y=140; click y=180).
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: 180,
        clientY: 180,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 180,
        clientY: 180,
        button: 0,
        bubbles: true,
      })
    );
    vi.advanceTimersByTime(EDGE_SEGMENT_INSERT_CLICK_DELAY_MS + 1);

    expect(edge.type).toBe('editable-polyline');
    const verts = edge.getPathVertices();
    // New bend must sit on the vertical between the two corners — not after the bottom corner.
    const onVertical = edge.controlPoints!.filter(
      (p) => Math.abs(p.x - 180) < 1 && p.y > 60 + 1 && p.y < 220 - 1
    );
    expect(onVertical.length).toBeGreaterThanOrEqual(1);
    expect(verts[verts.length - 2]!.y).not.toBeCloseTo(180, 0);
    // No backtrack spur: y should be monotonic along the vertical run.
    const verticalXs = verts.filter((p) => Math.abs(p.x - 180) < 1);
    const ys = verticalXs.map((p) => p.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    }
    vi.useRealTimers();
  });

  it('does not insert a bend when double-clicking a segment to edit the label', () => {
    vi.useFakeTimers();
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    const interaction = renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'editable-polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 100, width: 80, height: 40 });
    const target = new RectangleNode({ x: 320, y: 100, width: 80, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'editable-polyline',
      controlPoints: [
        { x: 200, y: 120 },
        { x: 200, y: 200 },
      ],
      label: 'Link',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 120 }, { x: 320, y: 200 });
    edge.state = 'selected';

    const beforeCount = edge.controlPoints?.length ?? 0;
    const x = 200;
    const y = 140;
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: x, clientY: y, button: 0, bubbles: true, detail: 1 })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: x, clientY: y, button: 0, bubbles: true, detail: 1 })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: x, clientY: y, button: 0, bubbles: true, detail: 2 })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: x, clientY: y, button: 0, bubbles: true, detail: 2 })
    );
    canvas.dispatchEvent(
      new MouseEvent('dblclick', { clientX: x, clientY: y, button: 0, bubbles: true, detail: 2 })
    );
    interaction.connection.cancelPendingSegmentInsert();
    vi.advanceTimersByTime(EDGE_SEGMENT_INSERT_CLICK_DELAY_MS + 1);
    expect(edge.controlPoints?.length ?? 0).toBe(beforeCount);
    vi.useRealTimers();
  });

  it('does not leave a bend on the upper horizontal when dragging past a router exit stub', () => {
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'editable-polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 40, width: 80, height: 40 });
    const target = new RectangleNode({ x: 280, y: 200, width: 100, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    // Upper H has a colinear router exit stub at x=152 — must disappear when V moves past it.
    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'editable-polyline',
      controlPoints: [
        { x: 152, y: 60 },
        { x: 180, y: 60 },
        { x: 180, y: 220 },
      ],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 120, y: 60 }, { x: 280, y: 220 });
    edge.state = 'selected';

    const vMid = { x: 180, y: 140 };
    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: vMid.x,
        clientY: vMid.y,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: vMid.y,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: 100,
        clientY: vMid.y,
        button: 0,
        bubbles: true,
      })
    );

    expect(edge.controlPoints).toEqual([
      { x: 100, y: 60 },
      { x: 100, y: 220 },
    ]);
    const verts = edge.getPathVertices();
    expect(verts.filter((p) => Math.abs(p.y - 60) < 1)).toHaveLength(2);
  });

  it('promotes auto-polyline on first segment-handle drag', () => {
    const canvas = createCanvas(500, 300);
    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    renderer.enableInteractions({
      createEdge: (from, to) => new Edge({ from, to, type: 'polyline' }),
    });

    const source = new RectangleNode({ x: 40, y: 40, width: 60, height: 40 });
    const target = new RectangleNode({ x: 300, y: 200, width: 60, height: 40 });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'polyline',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints(
      source.getConnectionPoint({ x: 300, y: 200 }),
      target.getConnectionPoint({ x: 40, y: 40 })
    );
    expect(edge.type).toBe('polyline');
    expect(edge.path.length).toBeGreaterThanOrEqual(3);
    edge.state = 'selected';

    // Midpoint of first orthogonal segment
    const a = edge.path[0]!;
    const b = edge.path[1]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: Math.round(mid.x),
        clientY: Math.round(mid.y),
        button: 0,
        bubbles: true,
      })
    );
    expect(edge.type).toBe('editable-polyline');
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: Math.round(mid.x),
        clientY: Math.round(mid.y),
        button: 0,
        bubbles: true,
      })
    );
  });
});
