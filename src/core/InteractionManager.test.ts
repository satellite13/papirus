import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { InteractionManager } from './InteractionManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { MiniMap } from './overlays/MiniMap';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('InteractionManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('deletes selected nodes on Delete key', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const interaction = new InteractionManager({ renderer });

    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    interaction.selection.select(node.id);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(renderer.getNode(node.id)).toBeUndefined();
  });

  it('does not delete selected nodes in navigationOnly mode', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const interaction = new InteractionManager({ renderer, navigationOnly: true });

    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    interaction.selection.select(node.id);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));

    expect(renderer.getNode(node.id)).toBeDefined();
  });

  it('drags selected node and updates position', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 200,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const interaction = new InteractionManager({ renderer });

    const node = new RectangleNode({ x: 50, y: 50, width: 60, height: 40 });
    renderer.addNode(node);
    interaction.selection.select(node.id);

    const centerX = 50 + 60 / 2;
    const centerY = 50 + 40 / 2;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: centerX, clientY: centerY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: centerX + 40,
        clientY: centerY + 50,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: centerX + 40,
        clientY: centerY + 50,
        button: 0,
        bubbles: true,
      })
    );

    expect(node.x).toBe(90);
    expect(node.y).toBe(100);
  });

  it('does not drag selected node in navigationOnly mode', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 200,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const interaction = new InteractionManager({ renderer, navigationOnly: true });

    const node = new RectangleNode({ x: 50, y: 50, width: 60, height: 40 });
    renderer.addNode(node);
    interaction.selection.select(node.id);

    const centerX = 50 + 60 / 2;
    const centerY = 50 + 40 / 2;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: centerX, clientY: centerY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: centerX + 40,
        clientY: centerY + 50,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: centerX + 40,
        clientY: centerY + 50,
        button: 0,
        bubbles: true,
      })
    );

    expect(node.x).toBe(50);
    expect(node.y).toBe(50);
  });

  it('drags two nodes with editable-polyline: control points follow delta', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({ alignToNodes: false });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
      controlPoints: [{ x: 150, y: 50 }, { x: 200, y: 120 }],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 110, y: 100 }, { x: 250, y: 100 });

    interaction.selection.select(nodeA.id);
    interaction.selection.addToSelection(nodeB.id);

    const startX = 80;
    const startY = 100;
    const deltaX = 30;
    const deltaY = -20;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: startX, clientY: startY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: startX + deltaX,
        clientY: startY + deltaY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: startX + deltaX,
        clientY: startY + deltaY,
        button: 0,
        bubbles: true,
      })
    );

    expect(edge.controlPoints).toHaveLength(2);
    expect(edge.controlPoints![0]).toEqual({ x: 180, y: 30 });
    expect(edge.controlPoints![1]).toEqual({ x: 230, y: 100 });
  });

  it('undo restores nodes and editable-polyline control points after drag', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 200, retina: false });
    const interaction = renderer.enableInteractions({ alignToNodes: false });

    const nodeA = new RectangleNode({ x: 50, y: 80, width: 60, height: 40 });
    const nodeB = new RectangleNode({ x: 250, y: 80, width: 60, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'editable-polyline',
      controlPoints: [{ x: 150, y: 50 }, { x: 200, y: 120 }],
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 110, y: 100 }, { x: 250, y: 100 });

    const cpBefore = [
      { x: edge.controlPoints![0]!.x, y: edge.controlPoints![0]!.y },
      { x: edge.controlPoints![1]!.x, y: edge.controlPoints![1]!.y },
    ];
    const posBeforeA = { x: nodeA.x, y: nodeA.y };

    interaction.selection.select(nodeA.id);
    interaction.selection.addToSelection(nodeB.id);

    const startX = 80;
    const startY = 100;
    const deltaX = 30;
    const deltaY = -20;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: startX, clientY: startY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: startX + deltaX,
        clientY: startY + deltaY,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: startX + deltaX,
        clientY: startY + deltaY,
        button: 0,
        bubbles: true,
      })
    );

    expect(nodeA.x).not.toBe(posBeforeA.x);
    expect(edge.controlPoints![0]!.x).not.toBe(cpBefore[0]!.x);

    interaction.history.undo();

    expect(nodeA.x).toBe(posBeforeA.x);
    expect(nodeA.y).toBe(posBeforeA.y);
    expect(edge.controlPoints![0]).toEqual(cpBefore[0]);
    expect(edge.controlPoints![1]).toEqual(cpBefore[1]);
  });

  it('edits node label on double click', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 200,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    new InteractionManager({ renderer });

    const node = new RectangleNode({ x: 20, y: 20, width: 80, height: 40, label: 'Old node label' });
    renderer.addNode(node);

    canvas.dispatchEvent(
      new MouseEvent('dblclick', { clientX: 40, clientY: 40, bubbles: true })
    );

    const editor = document.body.querySelector('textarea[aria-label="Edit label"]');
    expect(editor).toBeInstanceOf(HTMLTextAreaElement);
    if (!(editor instanceof HTMLTextAreaElement)) {
      return;
    }

    editor.value = 'New node label';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(node.label?.text).toBe('New node label');
  });

  it('edits edge label on double click', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    new InteractionManager({ renderer });

    const source = new RectangleNode({ x: 20, y: 40, width: 60, height: 40, label: 'A' });
    const target = new RectangleNode({ x: 220, y: 40, width: 60, height: 40, label: 'B' });
    renderer.addNode(source);
    renderer.addNode(target);

    const edge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'straight',
      label: 'Old edge label',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 80, y: 60 }, { x: 220, y: 60 });

    canvas.dispatchEvent(
      new MouseEvent('dblclick', { clientX: 150, clientY: 60, bubbles: true })
    );

    const editor = document.body.querySelector('textarea[aria-label="Edit label"]');
    expect(editor).toBeInstanceOf(HTMLTextAreaElement);
    if (!(editor instanceof HTMLTextAreaElement)) {
      return;
    }

    editor.value = 'New edge label';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(edge.label?.text).toBe('New edge label');
  });

  it('prefers nearest edge label on double click', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 300,
      right: 500,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const renderer = new DiagramRenderer(canvas, { width: 500, height: 300, retina: false });
    new InteractionManager({ renderer });

    const source = new RectangleNode({ x: 40, y: 100, width: 80, height: 40, label: 'A' });
    const target = new RectangleNode({ x: 320, y: 100, width: 80, height: 40, label: 'B' });
    renderer.addNode(source);
    renderer.addNode(target);

    const yesEdge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'polyline',
      label: 'Yes',
      labelOffset: -10,
    });
    const retryEdge = new Edge({
      from: { nodeId: source.id },
      to: { nodeId: target.id },
      type: 'bezier',
      label: 'Retry',
      labelOffset: 14,
    });

    renderer.addEdge(yesEdge);
    renderer.addEdge(retryEdge);
    yesEdge.updateEndpoints({ x: 120, y: 120 }, { x: 320, y: 120 });
    retryEdge.updateEndpoints({ x: 120, y: 120 }, { x: 320, y: 120 });

    const retryLabelPos = retryEdge.getLabelPosition();
    expect(retryLabelPos).not.toBeNull();
    if (!retryLabelPos) {
      return;
    }

    canvas.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: Math.round(retryLabelPos.x),
        clientY: Math.round(retryLabelPos.y),
        bubbles: true,
      })
    );

    const editor = document.body.querySelector('textarea[aria-label="Edit label"]');
    expect(editor).toBeInstanceOf(HTMLTextAreaElement);
    if (!(editor instanceof HTMLTextAreaElement)) {
      return;
    }

    expect(editor.value).toBe('Retry');
  });

  it('drags horizontal scrollbar thumb to pan viewport', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 120,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 120, retina: false });
    new InteractionManager({ renderer });

    const distantNode = new RectangleNode({ x: 420, y: 20, width: 80, height: 40 });
    renderer.addNode(distantNode);

    expect(renderer.offsetX).toBe(0);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 10, clientY: 112, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 170, clientY: 112, button: 0, buttons: 1, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 170, clientY: 112, button: 0, bubbles: true })
    );

    expect(renderer.offsetX).toBeLessThan(0);
  });

  it('stops scrollbar drag when mouse button is released outside canvas', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 120,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 120, retina: false });
    new InteractionManager({ renderer });

    renderer.addNode(new RectangleNode({ x: 420, y: 20, width: 80, height: 40 }));
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 10, clientY: 112, button: 0, buttons: 1, bubbles: true })
    );

    const offsetBeforeReenter = renderer.offsetX;
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 170, clientY: 112, button: 0, buttons: 0, bubbles: true })
    );

    expect(renderer.offsetX).toBe(offsetBeforeReenter);
  });

  it('stops canvas pan when mouse button is released outside canvas', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 180,
      right: 300,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 180, retina: false });
    new InteractionManager({ renderer });

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 40, clientY: 40, button: 0, buttons: 1, bubbles: true })
    );

    const offsetBeforeReenterX = renderer.offsetX;
    const offsetBeforeReenterY = renderer.offsetY;
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 120, clientY: 120, button: 0, buttons: 0, bubbles: true })
    );

    expect(renderer.offsetX).toBe(offsetBeforeReenterX);
    expect(renderer.offsetY).toBe(offsetBeforeReenterY);
  });

  it('handles PageDown viewport scrolling', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 240,
      height: 140,
      right: 240,
      bottom: 140,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 240, height: 140, retina: false });
    new InteractionManager({ renderer });
    renderer.addNode(new RectangleNode({ x: 20, y: 600, width: 120, height: 80 }));
    canvas.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    expect(renderer.offsetY).toBeLessThan(0);
  });

  it('keeps zoom behavior when wheel has minor horizontal noise', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 240,
      height: 140,
      right: 240,
      bottom: 140,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 240, height: 140, retina: false });
    new InteractionManager({ renderer });

    expect(renderer.zoom).toBe(1);
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: 120,
        clientY: 70,
        deltaX: 0.3,
        deltaY: -80,
        bubbles: true,
      })
    );

    expect(renderer.zoom).not.toBe(1);
  });

  it('ignores pure horizontal wheel scroll for viewport pan', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 240,
      height: 140,
      right: 240,
      bottom: 140,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 240, height: 140, retina: false });
    new InteractionManager({ renderer });

    const initialOffsetX = renderer.offsetX;
    const initialZoom = renderer.zoom;
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        clientX: 120,
        clientY: 70,
        deltaX: 80,
        deltaY: 0,
        bubbles: true,
      })
    );

    expect(renderer.offsetX).toBe(initialOffsetX);
    expect(renderer.zoom).toBe(initialZoom);
  });

  it('drags minimap viewport to pan diagram', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.use(new MiniMap({ width: 160, height: 96, padding: 10 }));
    new InteractionManager({ renderer });
    renderer.addNode(new RectangleNode({ x: 900, y: 40, width: 120, height: 80 }));

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 250, clientY: 156, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 330, clientY: 156, button: 0, buttons: 1, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 330, clientY: 156, button: 0, bubbles: true })
    );

    expect(renderer.offsetX).toBeLessThan(0);
  });

  it('does not select node when clicking minimap over its thumbnail', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.use(new MiniMap({ width: 160, height: 96, padding: 10 }));
    const interaction = new InteractionManager({ renderer });
    const node = new RectangleNode({ x: 280, y: 140, width: 120, height: 80 });
    renderer.addNode(node);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 300, clientY: 160, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 300, clientY: 160, button: 0, bubbles: true })
    );

    expect(interaction.selection.selectedIds.has(node.id)).toBe(false);
  });

  it('does not select edge when clicking minimap over its path', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.use(new MiniMap({ width: 160, height: 96, padding: 10 }));
    const interaction = new InteractionManager({ renderer });

    const nodeA = new RectangleNode({ x: 260, y: 130, width: 20, height: 20 });
    const nodeB = new RectangleNode({ x: 400, y: 150, width: 20, height: 20 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);
    const edge = new Edge({
      from: { nodeId: nodeA.id },
      to: { nodeId: nodeB.id },
      type: 'straight',
    });
    renderer.addEdge(edge);
    edge.updateEndpoints({ x: 275, y: 155 }, { x: 355, y: 165 });

    expect(renderer.getElementAtPoint({ x: 300, y: 160 })).toBe(edge);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 300, clientY: 160, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 300, clientY: 160, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 300, clientY: 160, button: 0, bubbles: true })
    );

    expect(interaction.selection.selectedIds.has(edge.id)).toBe(false);
  });

  it('undo restores deleted node', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const interaction = new InteractionManager({ renderer });

    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);
    interaction.selection.select(node.id);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    expect(renderer.getNode(node.id)).toBeUndefined();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(renderer.getNode(node.id)).toBeDefined();
  });

  it('resizes node via corner handle', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 200,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const interaction = renderer.enableInteractions();

    const node = new RectangleNode({ x: 50, y: 50, width: 60, height: 40 });
    renderer.addNode(node);
    interaction.selection.select(node.id);

    const seHandleX = 50 + 60 + 6;
    const seHandleY = 50 + 40 + 6;

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        clientX: seHandleX,
        clientY: seHandleY,
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: seHandleX + 20,
        clientY: seHandleY + 10,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: seHandleX + 20,
        clientY: seHandleY + 10,
        button: 0,
        bubbles: true,
      })
    );

    expect(node.width).toBe(80);
    expect(node.height).toBe(50);
  });

  it('selection rect selects nodes within bounds', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 300,
      height: 200,
      right: 300,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 300, height: 200, retina: false });
    const interaction = renderer.enableInteractions();

    const nodeA = new RectangleNode({ x: 50, y: 50, width: 40, height: 40 });
    const nodeB = new RectangleNode({ x: 150, y: 50, width: 40, height: 40 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 10, clientY: 10, button: 0, ctrlKey: true, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
        button: 0,
        buttons: 1,
        ctrlKey: true,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 100, clientY: 100, button: 0, bubbles: true })
    );

    expect(interaction.selection.selectedIds.has(nodeA.id)).toBe(true);
  });

  it('ends active minimap drag session on destroy', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 220,
      right: 400,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const renderer = new DiagramRenderer(canvas, { width: 400, height: 220, retina: false });
    renderer.use(new MiniMap({ width: 160, height: 96, padding: 10 }));
    const interaction = new InteractionManager({ renderer });
    renderer.addNode(new RectangleNode({ x: 900, y: 40, width: 120, height: 80 }));

    const endOverlayDragSpy = vi.spyOn(renderer, 'endOverlayDrag');
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 250, clientY: 156, button: 0, bubbles: true })
    );

    interaction.destroy();
    expect(endOverlayDragSpy).toHaveBeenCalledTimes(1);
  });

  it('undo restores host-moved follower nodes when recordAdditionalDragStartPositions is used', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const renderer = new DiagramRenderer(canvas, { width: 400, height: 300, retina: false });
    const interaction = new InteractionManager({ renderer });

    const leader = new RectangleNode({ x: 0, y: 0, width: 200, height: 200 });
    const follower = new RectangleNode({ x: 50, y: 50, width: 40, height: 40 });
    renderer.addNode(leader);
    renderer.addNode(follower);
    interaction.selection.select(leader.id);

    let leaderInitial = { x: leader.x, y: leader.y };
    let followerInitial = { x: follower.x, y: follower.y };

    interaction.drag.on('dragstart', (ids: string[]) => {
      if (ids.length === 1 && ids[0] === leader.id) {
        leaderInitial = { x: leader.x, y: leader.y };
        followerInitial = { x: follower.x, y: follower.y };
        interaction.recordAdditionalDragStartPositions([follower.id]);
      }
    });
    interaction.drag.on('drag', () => {
      follower.x = followerInitial.x + (leader.x - leaderInitial.x);
      follower.y = followerInitial.y + (leader.y - leaderInitial.y);
    });

    // Hit leader only (follower sits on top at 50,50 — avoid stacking order picking the inner node)
    const startX = 20;
    const startY = 20;
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: startX, clientY: startY, button: 0, bubbles: true })
    );
    canvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: startX + 25,
        clientY: startY + 15,
        button: 0,
        buttons: 1,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', {
        clientX: startX + 25,
        clientY: startY + 15,
        button: 0,
        bubbles: true,
      })
    );

    expect(leader.x).not.toBe(leaderInitial.x);
    expect(follower.x).toBe(followerInitial.x + (leader.x - leaderInitial.x));

    interaction.history.undo();

    expect(leader.x).toBe(leaderInitial.x);
    expect(leader.y).toBe(leaderInitial.y);
    expect(follower.x).toBe(followerInitial.x);
    expect(follower.y).toBe(followerInitial.y);
  });
});
