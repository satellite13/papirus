import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer } from './DiagramRenderer';
import { SelectionManager } from './SelectionManager';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('SelectionManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('starts with empty selection', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const selection = new SelectionManager(renderer);

    expect(selection.selectedIds.size).toBe(0);
    expect(selection.isSelected('node1')).toBe(false);
  });

  it('selects single element', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    const selection = new SelectionManager(renderer);
    selection.select(node.id);

    expect(selection.selectedIds.size).toBe(1);
    expect(selection.isSelected(node.id)).toBe(true);
    expect(node.state).toBe('selected');
  });

  it('clears previous selection when selecting new element', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    const nodeB = new RectangleNode({ x: 50, y: 10, width: 20, height: 20 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const selection = new SelectionManager(renderer);
    selection.select(nodeA.id);
    selection.select(nodeB.id);

    expect(selection.isSelected(nodeA.id)).toBe(false);
    expect(selection.isSelected(nodeB.id)).toBe(true);
  });

  it('addToSelection adds without clearing', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    const nodeB = new RectangleNode({ x: 50, y: 10, width: 20, height: 20 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const selection = new SelectionManager(renderer);
    selection.select(nodeA.id);
    selection.addToSelection(nodeB.id);

    expect(selection.selectedIds.size).toBe(2);
    expect(selection.isSelected(nodeA.id)).toBe(true);
    expect(selection.isSelected(nodeB.id)).toBe(true);
  });

  it('clearSelection removes all', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    const selection = new SelectionManager(renderer);
    selection.select(node.id);
    selection.clearSelection();

    expect(selection.selectedIds.size).toBe(0);
    expect(node.state).toBe('normal');
  });

  it('toggleSelection adds or removes', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    renderer.addNode(node);

    const selection = new SelectionManager(renderer);
    selection.toggleSelection(node.id);
    expect(selection.isSelected(node.id)).toBe(true);

    selection.toggleSelection(node.id);
    expect(selection.isSelected(node.id)).toBe(false);
  });

  it('selectMultiple selects all given ids', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({ x: 10, y: 10, width: 20, height: 20 });
    const nodeB = new RectangleNode({ x: 50, y: 10, width: 20, height: 20 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const selection = new SelectionManager(renderer);
    selection.selectMultiple([nodeA.id, nodeB.id]);

    expect(selection.selectedIds.size).toBe(2);
  });

  it('startSelectionRect sets selection rectangle', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const selection = new SelectionManager(renderer);

    selection.startSelectionRect({ x: 10, y: 20 });

    expect(selection.selectionRectangle).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });

  it('updateSelectionRect updates rectangle', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const selection = new SelectionManager(renderer);

    selection.startSelectionRect({ x: 50, y: 50 });
    selection.updateSelectionRect({ x: 100, y: 80 });

    expect(selection.selectionRectangle).toEqual({ x: 50, y: 50, width: 50, height: 30 });
  });

  it('endSelectionRect selects nodes within rect', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const nodeA = new RectangleNode({ x: 20, y: 20, width: 30, height: 30 });
    const nodeB = new RectangleNode({ x: 80, y: 20, width: 30, height: 30 });
    renderer.addNode(nodeA);
    renderer.addNode(nodeB);

    const selection = new SelectionManager(renderer);
    selection.startSelectionRect({ x: 0, y: 0 });
    selection.updateSelectionRect({ x: 60, y: 60 });
    selection.endSelectionRect();

    expect(selection.selectedIds.size).toBe(1);
    expect(selection.isSelected(nodeA.id)).toBe(true);
    expect(selection.selectionRectangle).toBeNull();
  });
});
