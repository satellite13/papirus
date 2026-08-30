import { describe, expect, it } from 'vitest';
import { isScreenFontReadable } from './screenText';

function transform(a: number, d: number): CanvasRenderingContext2D {
  return {
    canvas: { width: 200, height: 100 },
    getTransform: () => ({ a, b: 0, c: 0, d, e: 0, f: 0 }),
  } as unknown as CanvasRenderingContext2D;
}

describe('isScreenFontReadable', () => {
  it('rejects a world font that collapses below 7 device pixels', () => {
    expect(isScreenFontReadable(transform(0.2, 0.2), 14)).toBe(false);
  });

  it('keeps a readable world font', () => {
    expect(isScreenFontReadable(transform(1, 1), 14)).toBe(true);
  });
});
