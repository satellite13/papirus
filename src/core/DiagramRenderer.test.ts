import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagramRenderer, type DiagramPlugin } from './DiagramRenderer';
import { NavigationManager } from './NavigationManager';
import { Edge } from '../elements/Edge';
import { Group } from '../elements/Group';
import { RectangleNode } from '../elements/nodes/RectangleNode';
import { mockCanvasContext, stubCanvasContext, stubAnimationFrame } from '../test/testUtils';

type DirtyRenderer = { _dirty: boolean; renderFrame: (now: number) => void };

function trackCanvasWidthWrites(canvas: HTMLCanvasElement): number[] {
  const writes: number[] = [];
  let value = canvas.width;
  Object.defineProperty(canvas, 'width', {
    configurable: true,
    get: () => value,
    set: (next: number) => {
      writes.push(next);
      value = next;
    },
  });
  return writes;
}

function stubFlushableAnimationFrame(): { flush: () => void } {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  return {
    flush(): void {
      const callback = frames.shift();
      callback?.(0);
    },
  };
}

describe('DiagramRenderer', () => {
  beforeEach(() => {
    stubCanvasContext();
    stubAnimationFrame();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers nodes and listens to element dirty state', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });

    renderer.addNode(node);
    (renderer as unknown as { _dirty: boolean })._dirty = false;
    (renderer as unknown as { _contentDirty: boolean })._contentDirty = false;

    node.x = 20;

    expect((renderer as unknown as { _dirty: boolean })._dirty).toBe(true);
    expect((renderer as unknown as { _contentDirty: boolean })._contentDirty).toBe(true);
  });

  it('does not mark content dirty on viewport-only pan/zoom', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const updateAll = vi.fn();
    (renderer as unknown as { edgeEndpointUpdater: { updateAll: () => void } }).edgeEndpointUpdater =
      { updateAll };
    (renderer as unknown as { _contentDirty: boolean })._contentDirty = false;
    (renderer as unknown as { _dirty: boolean })._dirty = true;

    renderer.offsetX += 12;
    renderer.zoom = 1.2;
    (renderer as unknown as { renderFrame: (now: number) => void }).renderFrame(0);

    expect(updateAll).not.toHaveBeenCalled();
    expect((renderer as unknown as { _contentDirty: boolean })._contentDirty).toBe(false);
  });

  it('resyncs edge endpoints after layout changes', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const updateAll = vi.fn();
    (renderer as unknown as { edgeEndpointUpdater: { updateAll: () => void } }).edgeEndpointUpdater =
      { updateAll };
    const node = new RectangleNode({ x: 0, y: 0, width: 10, height: 10 });
    renderer.addNode(node);
    (renderer as unknown as { renderFrame: (now: number) => void }).renderFrame(0);

    expect(updateAll).toHaveBeenCalledTimes(1);
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

  it('resets the canvas backing store only when resize changes the size', () => {
    const canvas = document.createElement('canvas');
    const widthWrites = trackCanvasWidthWrites(canvas);
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const writesAfterSetup = widthWrites.length;

    renderer.resize(200, 100);

    expect(widthWrites.length).toBe(writesAfterSetup);

    renderer.resize(240, 120);

    expect(widthWrites.length).toBe(writesAfterSetup + 1);
  });

  it('creates a default 2D context without willReadFrequently', () => {
    const calls: unknown[][] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((...args) => {
      calls.push(args);
      return mockCanvasContext();
    });

    new DiagramRenderer(document.createElement('canvas'), { width: 200, height: 100, retina: false });

    expect(calls[0]).toEqual(['2d']);
  });

  it('keeps the retina backing store when NavigationManager starts a pan', () => {
    const previousRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    try {
      const canvas = document.createElement('canvas');
      const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: true });
      const navigation = new NavigationManager({ renderer });
      const event = {
        screenX: 10,
        screenY: 10,
        worldX: 0,
        worldY: 0,
        button: 1,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        originalEvent: new MouseEvent('mousedown'),
      };

      expect(canvas.width).toBe(400);
      expect(renderer.pixelRatio).toBe(2);

      navigation.startPan(event);
      expect(canvas.width).toBe(400);
      expect(renderer.pixelRatio).toBe(2);

      navigation.handleMouseUp(event);
      expect(canvas.width).toBe(400);
      expect(renderer.pixelRatio).toBe(2);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: previousRatio,
      });
    }
  });

  it('does not paint while the 2D context is lost and keeps the frame dirty', () => {
    const frames = stubFlushableAnimationFrame();
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const dirtyRenderer = renderer as unknown as DirtyRenderer;
    const renderSpy = vi.spyOn(dirtyRenderer, 'renderFrame');

    canvas.dispatchEvent(new Event('contextlost'));
    dirtyRenderer._dirty = true;
    frames.flush();

    expect(renderSpy).not.toHaveBeenCalled();
    expect(dirtyRenderer._dirty).toBe(true);
  });

  it('paints after the 2D context is restored without resetting the backing store', () => {
    const frames = stubFlushableAnimationFrame();
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const dirtyRenderer = renderer as unknown as DirtyRenderer & {
      setupCanvas: () => void;
    };
    const setupSpy = vi.spyOn(dirtyRenderer, 'setupCanvas');
    const renderSpy = vi.spyOn(dirtyRenderer, 'renderFrame');

    canvas.dispatchEvent(new Event('contextlost'));
    dirtyRenderer._dirty = true;
    frames.flush();
    renderSpy.mockClear();
    setupSpy.mockClear();

    canvas.dispatchEvent(new Event('contextrestored'));

    expect(setupSpy).not.toHaveBeenCalled();
    expect(dirtyRenderer._dirty).toBe(true);

    frames.flush();

    expect(renderSpy).toHaveBeenCalled();
  });

  it('does not reset the canvas backing store when the 2D context is restored', () => {
    const canvas = document.createElement('canvas');
    const widthWrites = trackCanvasWidthWrites(canvas);
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const writesAfterSetup = widthWrites.length;

    canvas.dispatchEvent(new Event('contextlost'));
    canvas.dispatchEvent(new Event('contextrestored'));

    expect(widthWrites.length).toBe(writesAfterSetup);
    expect((renderer as unknown as DirtyRenderer)._dirty).toBe(true);
  });

  it('does not preventDefault on 2D contextlost so Chrome can restore the context', () => {
    const canvas = document.createElement('canvas');
    new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const event = new Event('contextlost', { cancelable: true });

    canvas.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('unsubscribes from context lost events on destroy', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');

    renderer.destroy();

    expect(removeSpy).toHaveBeenCalledWith('contextlost', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('contextrestored', expect.any(Function));
  });

  it('does not paint a node that is fully outside the viewport', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 200,
      height: 100,
      retina: false,
      scrollbar: false,
    });
    const inside = new RectangleNode({ id: 'in', x: 20, y: 20, width: 40, height: 20 });
    const outside = new RectangleNode({ id: 'out', x: 800, y: 20, width: 40, height: 20 });
    const insideSpy = vi.spyOn(inside, 'render');
    const outsideSpy = vi.spyOn(outside, 'render');
    renderer.addNode(inside);
    renderer.addNode(outside);

    renderer.render();

    expect(insideSpy).toHaveBeenCalled();
    expect(outsideSpy).not.toHaveBeenCalled();
  });

  it('paints a node that only overlaps the viewport padding', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 200,
      height: 100,
      retina: false,
      scrollbar: false,
    });
    const nearEdge = new RectangleNode({ id: 'near', x: 220, y: 20, width: 20, height: 20 });
    const renderSpy = vi.spyOn(nearEdge, 'render');
    renderer.addNode(nearEdge);

    renderer.render();

    expect(renderSpy).toHaveBeenCalled();
  });

  it('does not paint an edge whose path is fully outside the viewport', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 200,
      height: 100,
      retina: false,
      scrollbar: false,
    });
    const a = new RectangleNode({ id: 'a', x: 800, y: 20, width: 20, height: 20 });
    const b = new RectangleNode({ id: 'b', x: 900, y: 20, width: 20, height: 20 });
    const edge = new Edge({ id: 'e', from: { nodeId: 'a' }, to: { nodeId: 'b' } });
    const renderSpy = vi.spyOn(edge, 'render');
    const handleSpy = vi.spyOn(edge, 'renderHandles');
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addEdge(edge);

    renderer.render();

    expect(renderSpy).not.toHaveBeenCalled();
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it('paints an edge that crosses into the viewport', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 200,
      height: 100,
      retina: false,
      scrollbar: false,
    });
    const a = new RectangleNode({ id: 'a', x: 40, y: 40, width: 20, height: 20 });
    const b = new RectangleNode({ id: 'b', x: 800, y: 40, width: 20, height: 20 });
    const edge = new Edge({ id: 'e', from: { nodeId: 'a' }, to: { nodeId: 'b' } });
    const renderSpy = vi.spyOn(edge, 'render');
    renderer.addNode(a);
    renderer.addNode(b);
    renderer.addEdge(edge);

    renderer.render();

    expect(renderSpy).toHaveBeenCalled();
  });

  it('paints a previously culled node after the viewport pans over it', () => {
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, {
      width: 200,
      height: 100,
      retina: false,
      scrollbar: false,
    });
    const node = new RectangleNode({ id: 'far', x: 400, y: 20, width: 40, height: 20 });
    const renderSpy = vi.spyOn(node, 'render');
    renderer.addNode(node);

    renderer.render();
    expect(renderSpy).not.toHaveBeenCalled();

    renderer.offsetX = -360;
    renderer.render();
    expect(renderSpy).toHaveBeenCalled();
  });

  it('keeps the next frame dirty when a redraw is requested during paint', () => {
    const frames = stubFlushableAnimationFrame();
    const canvas = document.createElement('canvas');
    const renderer = new DiagramRenderer(canvas, { width: 200, height: 100, retina: false });
    const dirtyRenderer = renderer as unknown as DirtyRenderer;
    renderer.on('render', () => {
      renderer.markDirty();
    });

    frames.flush();

    expect(dirtyRenderer._dirty).toBe(true);
  });
});
