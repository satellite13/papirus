export interface WrappedTextOptions {
  maxLines?: number;
  appendEllipsis?: boolean;
}

/**
 * Wrap text by words while preserving explicit newline boundaries.
 */
export function wrapMeasuredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  options: WrappedTextOptions = {}
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    lines.push(currentLine);
  }

  const maxLines = options.maxLines;
  if (maxLines !== undefined && lines.length > maxLines) {
    const truncated = lines.slice(0, Math.max(0, maxLines));
    if (options.appendEllipsis && truncated.length > 0) {
      const lastIndex = truncated.length - 1;
      truncated[lastIndex] = `${truncated[lastIndex]}…`;
    }
    return truncated;
  }

  return lines;
}

/**
 * Return the widest measured line.
 */
export function measureTextLines(ctx: CanvasRenderingContext2D, lines: readonly string[]): number {
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }
  return maxWidth;
}
