import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramRenderer } from '../DiagramRenderer';
import { stubCanvasContext } from '../../test/testUtils';
import { MiniMap } from './MiniMap';

type OverlayRenderer = (ctx: CanvasRenderingContext2D) => void;

function createRenderer(withContent = true): {
  renderer: DiagramRenderer;
  getCallback: () => OverlayRenderer;
  remove: ReturnType<typeof vi.fn>;
} {
  let callback: OverlayRenderer | undefined;
  const remove = vi.fn();
  const nodes = withContent
    ? new Map([
        [
          'node',
          {
            visible: true,
            getBounds: () => ({ x: 100, y: 100, width: 100, height: 100 }),
          },
        ],
      ])
    : new Map();
  const edges = withContent
    ? new Map([
        [
          'edge',
          {
            visible: true,
            path: [
              { x: 100, y: 140 },
              { x: 200, y: 160 },
            ],
            getBounds: () => ({ x: 100, y: 140, width: 100, height: 20 }),
          },
        ],
      ])
    : new Map();
  const renderer = {
    width: 400,
    height: 300,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    pixelRatio: 1,
    nodes,
    edges,
    groups: new Map(),
    getContentRevision: () => 1,
    screenToCanvas: (x: number, y: number) => ({ x, y }),
    addTopOverlayRenderer: vi.fn((next: OverlayRenderer) => {
      callback = next;
      return remove;
    }),
  } as unknown as DiagramRenderer;

  return {
    renderer,
    getCallback: () => callback!,
    remove,
  };
}

describe('MiniMap', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    stubCanvasContext();
  });

  it('renders a top-right layout from content and viewport bounds, then cleans up', () => {
    const { renderer, getCallback, remove } = createRenderer();
    const miniMap = new MiniMap({ width: 100, height: 80, padding: 10 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    miniMap.install(renderer);
    getCallback()(ctx);

    expect((renderer.addTopOverlayRenderer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(ctx.fillRect).toHaveBeenCalledWith(290, 210, 100, 80);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalledWith(290, 210, 100, 80);

    miniMap.destroy();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while disabled and respects a top-left layout after re-enabling', () => {
    const { renderer, getCallback } = createRenderer();
    const miniMap = new MiniMap({ width: 100, height: 80, padding: 10, anchor: 'top-left' });
    const ctx = document.createElement('canvas').getContext('2d')!;

    miniMap.install(renderer);
    miniMap.setEnabled(false);
    getCallback()(ctx);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    miniMap.setEnabled(true);
    getCallback()(ctx);
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 10, 100, 80);
  });

  it('blocks diagram pointers only within an enabled minimap with content', () => {
    const { renderer } = createRenderer();
    const miniMap = new MiniMap({ width: 100, height: 80, padding: 10 });

    expect(miniMap.blocksDiagramPointerAtScreen(renderer, 300, 220)).toBe(true);
    expect(miniMap.blocksDiagramPointerAtScreen(renderer, 280, 220)).toBe(false);

    miniMap.setEnabled(false);
    expect(miniMap.blocksDiagramPointerAtScreen(renderer, 300, 220)).toBe(false);

    const { renderer: emptyRenderer } = createRenderer(false);
    miniMap.setEnabled(true);
    expect(miniMap.blocksDiagramPointerAtScreen(emptyRenderer, 300, 220)).toBe(false);
  });

  it('bakes only node boxes and skips edges', () => {
    const { renderer, getCallback } = createRenderer();
    const miniMap = new MiniMap({ width: 100, height: 80, padding: 10 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    miniMap.install(renderer);
    getCallback()(ctx);

    expect(ctx.fillRect).toHaveBeenCalledWith(100, 100, 100, 100);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('reuses the content bake on pan and only redraws the live viewport rect', () => {
    const { renderer, getCallback } = createRenderer();
    const miniMap = new MiniMap({ width: 100, height: 80, padding: 10 });
    const ctx = document.createElement('canvas').getContext('2d')!;

    miniMap.install(renderer);
    getCallback()(ctx);
    const bakeKey = miniMap.getContentBakeProjectionKey();
    expect(bakeKey).not.toBeNull();

    renderer.offsetX = 40;
    vi.mocked(ctx.beginPath).mockClear();
    vi.mocked(ctx.lineTo).mockClear();
    vi.mocked(ctx.drawImage).mockClear();
    vi.mocked(ctx.strokeRect).mockClear();

    getCallback()(ctx);

    expect(miniMap.getContentBakeProjectionKey()).toBe(bakeKey);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});
