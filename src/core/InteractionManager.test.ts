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
});
