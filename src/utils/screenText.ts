/** Skip fillText when the glyph would be smaller than this many device pixels. */
export const MIN_SCREEN_FONT_PX = 7;

interface Affine {
  a: number;
  b: number;
}

function readScale(ctx: CanvasRenderingContext2D): Affine | null {
  if (typeof ctx.getTransform !== 'function') {
    return null;
  }
  const m = ctx.getTransform();
  if (m === null || typeof m.a !== 'number') {
    return null;
  }
  return { a: m.a, b: typeof m.b === 'number' ? m.b : 0 };
}

export function isScreenFontReadable(ctx: CanvasRenderingContext2D, fontSize: number): boolean {
  const m = readScale(ctx);
  if (m === null) {
    return true;
  }
  return fontSize * Math.hypot(m.a, m.b) >= MIN_SCREEN_FONT_PX;
}
