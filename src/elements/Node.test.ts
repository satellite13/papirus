import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RectangleNode } from './nodes/RectangleNode';
import { CircleNode } from './nodes/CircleNode';
import { DiamondNode } from './nodes/DiamondNode';
import { mockCanvasContext } from '../test/testUtils';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 40;
  naturalHeight = 20;
  complete = false;
  decoding = 'async';

  set src(_value: string) {
    this.complete = true;
    this.naturalWidth = 40;
    this.naturalHeight = 20;
    this.onload?.();
  }
}

describe('Node', () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    globalThis.Image = FakeImage as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('renders label and icon when provided', () => {
    const ctx = mockCanvasContext();
    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      label: 'Node',
      icon: {
        source: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        placement: 'top',
      },
    });

    node.render(ctx);

    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('wraps label by words before expanding node width', () => {
    const ctx = mockCanvasContext();
    ctx.measureText = ((text: string) => ({ width: text.length * 8 })) as CanvasRenderingContext2D['measureText'];

    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      label: 'one two three four five six',
    });

    node.render(ctx);

    expect(node.width).toBe(80);
    expect(node.height).toBeGreaterThan(40);
  });

  it('expands node width when a single word cannot wrap', () => {
    const ctx = mockCanvasContext();
    ctx.measureText = ((text: string) => ({ width: text.length * 8 })) as CanvasRenderingContext2D['measureText'];

    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      label: 'supercalifragilisticexpialidocious',
    });

    node.render(ctx);

    expect(node.width).toBeGreaterThan(80);
  });

  it('wraps label with left icon before expanding width', () => {
    const ctx = mockCanvasContext();
    ctx.measureText = ((text: string) => ({ width: text.length * 8 })) as CanvasRenderingContext2D['measureText'];

    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 180,
      height: 60,
      label: 'one two three four five six seven',
      icon: {
        source: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        placement: 'left',
      },
    });

    node.render(ctx);

    expect(node.width).toBe(180);
  });

  it('does not render centered label over left icon', () => {
    const ctx = mockCanvasContext();
    ctx.measureText = ((text: string) => ({ width: text.length * 8 })) as CanvasRenderingContext2D['measureText'];

    const node = new RectangleNode({
      x: 0,
      y: 0,
      width: 180,
      height: 70,
      label: { text: 'alpha beta gamma', margin: 0, padding: 4 },
      labelPlacement: 'center',
      icon: {
        source: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        placement: 'left',
        padding: 8,
        margin: 2,
        gap: 10,
      },
    });

    node.render(ctx);

    const drawCall = ctx.drawImage.mock.calls[0];
    const textCall = ctx.fillText.mock.calls[0];
    expect(drawCall).toBeDefined();
    expect(textCall).toBeDefined();
    if (!drawCall || !textCall) {
      return;
    }
    const iconX = Number(drawCall[1]);
    const iconW = Number(drawCall[3]);
    const textX = Number(textCall[1]);

    expect(textX).toBeGreaterThan(iconX + iconW + 8);
  });

  it('uses inscribed text area for circle and diamond labels', () => {
    const ctx = mockCanvasContext();
    ctx.measureText = ((text: string) => ({ width: text.length * 8 })) as CanvasRenderingContext2D['measureText'];
    const text = 'alpha beta gamma delta epsilon';

    const circle = new CircleNode({ x: 0, y: 0, width: 120, height: 120, label: text });
    circle.render(ctx);

    const diamond = new DiamondNode({ x: 0, y: 0, width: 120, height: 120, label: text });
    diamond.render(ctx);

    expect(circle.width).toBe(120);
    expect(circle.height).toBeGreaterThan(120);
    expect(diamond.width).toBeGreaterThan(circle.width);
    expect(diamond.height).toBeGreaterThan(120);
  });

  it('getConnectionPointAtOutlineParam and getClosestPointOnOutline work for rectangle', () => {
    const node = new RectangleNode({ x: 10, y: 20, width: 100, height: 60 });
    const P = 2 * (100 + 60);

    // param 0 = top-left corner
    const p0 = node.getConnectionPointAtOutlineParam(0);
    expect(p0.x).toBeCloseTo(10);
    expect(p0.y).toBeCloseTo(20);

    // param 0.25 = roughly right of top edge (top is w/P of perimeter)
    const p025 = node.getConnectionPointAtOutlineParam(0.25);
    expect(p025.y).toBeCloseTo(20);

    const { point, param } = node.getClosestPointOnOutline({ x: 60, y: 15 });
    expect(point.y).toBeCloseTo(20);
    expect(param).toBeGreaterThanOrEqual(0);
    expect(param).toBeLessThanOrEqual(1);

    // round-trip: param -> point -> closest -> param should be close
    const testParam = 0.37;
    const pt = node.getConnectionPointAtOutlineParam(testParam);
    const { param: backParam } = node.getClosestPointOnOutline(pt);
    expect(Math.abs((backParam % 1) - (testParam % 1))).toBeLessThan(0.01);
  });

  it('getConnectionPointAtOutlineParam and getClosestPointOnOutline work for circle', () => {
    const node = new CircleNode({ x: 0, y: 0, width: 100, height: 60 });
    const center = { x: 50, y: 30 };
    const rx = 50;
    const ry = 30;

    const p0 = node.getConnectionPointAtOutlineParam(0);
    expect(p0.x).toBeCloseTo(center.x);
    expect(p0.y).toBeCloseTo(center.y - ry);

    const { point, param } = node.getClosestPointOnOutline({ x: 80, y: 30 });
    expect(point.x).toBeGreaterThan(center.x);
    expect(point.y).toBeCloseTo(center.y);
    expect(param).toBeGreaterThanOrEqual(0);
    expect(param).toBeLessThanOrEqual(1);

    const testParam = 0.5;
    const pt = node.getConnectionPointAtOutlineParam(testParam);
    const { param: backParam } = node.getClosestPointOnOutline(pt);
    expect(Math.abs((backParam % 1) - (testParam % 1))).toBeLessThan(0.01);
  });

  it('getConnectionPointAtOutlineParam and getClosestPointOnOutline work for diamond', () => {
    const node = new DiamondNode({ x: 0, y: 0, width: 100, height: 60 });
    const center = { x: 50, y: 30 };
    const hw = 50;
    const hh = 30;

    const p0 = node.getConnectionPointAtOutlineParam(0);
    expect(p0.x).toBeCloseTo(center.x);
    expect(p0.y).toBeCloseTo(center.y - hh);

    const { point, param } = node.getClosestPointOnOutline({ x: 80, y: 30 });
    expect(point.x).toBeGreaterThan(center.x);
    expect(param).toBeGreaterThanOrEqual(0);
    expect(param).toBeLessThanOrEqual(1);

    const testParam = 0.25;
    const pt = node.getConnectionPointAtOutlineParam(testParam);
    const { param: backParam } = node.getClosestPointOnOutline(pt);
    expect(Math.abs((backParam % 1) - (testParam % 1))).toBeLessThan(0.01);
  });
});
