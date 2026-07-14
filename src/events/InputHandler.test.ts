import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler } from './InputHandler';

function dispatchTouchEvent(
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Array<{ clientX: number; clientY: number }>
): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: touches },
  });
  target.dispatchEvent(event);
}

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

  it('emits normalized double-click events', () => {
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x: x + 100, y: y + 200 }),
    });
    const dblclick = vi.fn();
    handler.on('dblclick', dblclick);

    canvas.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 15,
        clientY: 25,
        bubbles: true,
        button: 2,
        ctrlKey: true,
      })
    );

    expect(dblclick).toHaveBeenCalledOnce();
    expect(dblclick).toHaveBeenCalledWith(
      expect.objectContaining({
        screenX: 15,
        screenY: 25,
        worldX: 115,
        worldY: 225,
        button: 2,
        ctrlKey: true,
      })
    );
    handler.destroy();
  });

  it('emits touch pan and pinch gestures from consecutive two-finger moves', () => {
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x: x * 2, y: y * 2 }),
    });
    const pan = vi.fn();
    const pinch = vi.fn();
    handler.on('pan', pan);
    handler.on('pinch', pinch);

    dispatchTouchEvent(canvas, 'touchstart', [
      { clientX: 10, clientY: 20 },
      { clientX: 30, clientY: 20 },
    ]);
    dispatchTouchEvent(canvas, 'touchmove', [
      { clientX: 20, clientY: 30 },
      { clientX: 60, clientY: 30 },
    ]);

    expect(pan).toHaveBeenCalledWith(
      expect.objectContaining({
        screenX: 40,
        screenY: 30,
        worldX: 80,
        worldY: 60,
        deltaX: 20,
        deltaY: 10,
      })
    );
    expect(pinch).toHaveBeenCalledWith(expect.objectContaining({ scale: 2 }));
    handler.destroy();
  });

  it('emits keyboard events while the canvas is focused', () => {
    canvas.tabIndex = 0;
    canvas.focus();
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x, y }),
    });
    const keydown = vi.fn();
    handler.on('keydown', keydown);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    expect(keydown).toHaveBeenCalledOnce();
    expect(keydown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Delete' }));
    handler.destroy();
  });

  it('stops emitting canvas and window events after destroy', () => {
    const handler = new InputHandler({
      canvas,
      screenToWorld: (x, y) => ({ x, y }),
    });
    const click = vi.fn();
    const keydown = vi.fn();
    handler.on('click', click);
    handler.on('keydown', keydown);

    handler.destroy();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 20, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(click).not.toHaveBeenCalled();
    expect(keydown).not.toHaveBeenCalled();
  });
});
