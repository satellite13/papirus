import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler } from './InputHandler';

describe('InputHandler', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    document.body.appendChild(canvas);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });
  });

  it('emits mousedown and click with world coordinates', () => {
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x: x * 2, y: y * 2 }),
    });

    const mousedown = vi.fn();
    const click = vi.fn();
    handler.on('mousedown', mousedown);
    handler.on('click', click);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 10, clientY: 20, bubbles: true, button: 0 })
    );
    canvas.dispatchEvent(
      new MouseEvent('mouseup', { clientX: 10, clientY: 20, bubbles: true, button: 0 })
    );
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: 10, clientY: 20, bubbles: true, button: 0 })
    );

    expect(mousedown).toHaveBeenCalled();
    const downEvt = mousedown.mock.calls[0]![0];
    expect(downEvt.worldX).toBe(20);
    expect(downEvt.worldY).toBe(40);
    expect(click).toHaveBeenCalled();

    handler.destroy();
  });

  it('emits wheel events', () => {
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x, y }),
    });
    const wheel = vi.fn();
    handler.on('wheel', wheel);

    canvas.dispatchEvent(
      new WheelEvent('wheel', { clientX: 5, clientY: 5, deltaY: 100, bubbles: true })
    );

    expect(wheel).toHaveBeenCalled();
    expect(wheel.mock.calls[0]![0].deltaY).toBe(100);
    handler.destroy();
  });
});
