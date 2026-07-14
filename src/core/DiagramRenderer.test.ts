import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer, type DiagramPlugin } from './DiagramRenderer';
import { Edge } from '../elements/Edge';
import { Group } from '../elements/Group';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

describe('DiagramRenderer', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  it('registers nodes and listens to element dirty state', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });

    renderer.addNode(node);
    (renderer as unknown as { _dirty: boolean })._dirty = false;

    node.x = 20;

    expect((renderer as unknown as { _dirty: boolean })._dirty).toBe(true);
  });

  it('adds and removes nodes', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ id: 'a', x: 10, y: 20, width: 30, height: 40 });

    renderer.addNode(node);
    expect(renderer.getNode('a')).toBe(node);
    expect(renderer.nodes.size).toBe(1);

    renderer.removeNode(node.id);
    expect(renderer.getNode('a')).toBeUndefined();
  });

  it('enables interactions', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const interaction = renderer.enableInteractions();
    expect(interaction).toBeDefined();
    expect(interaction.selection).toBeDefined();
  });

  it('converts between world and screen coordinates using viewport and canvas scale', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 50,
      y: 30,
      top: 30,
      left: 50,
      bottom: 230,
      right: 450,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    });
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    renderer.viewport = { zoom: 2, offsetX: 10, offsetY: -5 };

    expect(renderer.worldToScreen(20, 10)).toEqual({ x: 150, y: 60 });
    expect(renderer.screenToWorld(150, 60)).toEqual({ x: 20, y: 10 });
  });

  it('installs plugins immediately and destroys them with the renderer', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const plugin: DiagramPlugin = {
      install: vi.fn(),
      destroy: vi.fn(),
    };

    renderer.use(plugin);

    expect(plugin.install).toHaveBeenCalledOnce();
    expect(plugin.install).toHaveBeenCalledWith(renderer);
    renderer.destroy();
    expect(plugin.destroy).toHaveBeenCalledOnce();
    expect(plugin.destroy).toHaveBeenCalledWith(renderer);
  });

  it('clears registered elements', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ id: 'node', x: 10, y: 20, width: 30, height: 40 });
    const edge = new Edge({
      id: 'edge',
      from: { nodeId: node.id },
      to: { nodeId: node.id },
      type: 'straight',
    });
    const group = new Group({ id: 'group' });
    renderer.addNode(node);
    renderer.addEdge(edge);
    renderer.addGroup(group);

    renderer.clear();

    expect(renderer.nodes).toHaveLength(0);
    expect(renderer.edges).toHaveLength(0);
    expect(renderer.groups).toHaveLength(0);
    expect(renderer.getNode(node.id)).toBeUndefined();
    expect(renderer.getEdge(edge.id)).toBeUndefined();
    expect(renderer.getGroup(group.id)).toBeUndefined();
  });

  it('renders underlays, elements, overlays, and top overlays in layer order', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 10, y: 20, width: 30, height: 40 });
    const calls: string[] = [];
    vi.spyOn(node, 'render').mockImplementation(() => calls.push('node'));
    renderer.addNode(node);
    renderer.addUnderlayRenderer(() => calls.push('underlay'));
    renderer.addOverlayRenderer(() => calls.push('overlay'));
    renderer.addTopOverlayRenderer(() => calls.push('top-overlay'));

    renderer.render();

    expect(calls).toEqual(['underlay', 'node', 'overlay', 'top-overlay']);
  });
});
