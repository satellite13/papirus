import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { InteractionManager } from './InteractionManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { Edge } from '../elements/Edge';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('InteractionManager', () => {
  beforeEach(() => {
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
});
