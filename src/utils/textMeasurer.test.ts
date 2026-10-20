import { describe, it, expect, vi } from 'vitest';
import { wrapMeasuredText } from './textMeasurer';

function widthByLengthCtx(): CanvasRenderingContext2D {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  } as unknown as CanvasRenderingContext2D;
}

describe('wrapMeasuredText', () => {
  it('wraps text by words within maxWidth', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'one two three', 80);
    expect(lines).toEqual(['one two', 'three']);
  });

  it('preserves explicit newlines', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'a\nb', 100);
    expect(lines).toEqual(['a', 'b']);
  });

  it('keeps an oversized word on one line without breakLongWords', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'extraordinary', 50);
    expect(lines).toEqual(['extraordinary']);
  });

  it('breaks long words when breakLongWords is set', () => {
    const ctx = widthByLengthCtx();
    // 13-char word at 10px/char = 130px wide; maxWidth 50px → chunks of 5 chars
    const lines = wrapMeasuredText(ctx, 'extraordinary', 50, { breakLongWords: true });
    expect(lines).toEqual(['extra', 'ordin', 'ary']);
  });

  it('breaks the long word and keeps the rest of the paragraph intact', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'ab extraordinary cd', 50, { breakLongWords: true });
    expect(lines).toEqual(['ab', 'extra', 'ordin', 'ary', 'cd']);
  });

  it('keeps a single char wider than maxWidth on its own line', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'abcdef', 5, { breakLongWords: true });
    expect(lines).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('respects maxLines with ellipsis', () => {
    const ctx = widthByLengthCtx();
    const lines = wrapMeasuredText(ctx, 'one two three', 50, {
      maxLines: 2,
      appendEllipsis: true,
    });
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('…');
  });
});
