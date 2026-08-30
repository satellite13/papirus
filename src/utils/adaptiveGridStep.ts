/** Screen cell smaller than this is hard to use as an orientation cue. */
export const MIN_GRID_SCREEN_PX = 16;
/** Screen cell larger than this is a huge empty square — drop to the next finer step. */
export const MAX_GRID_SCREEN_PX = 32;

/**
 * World step that keeps the visible grid cell in a Miro-like range.
 * The base `gridSize` is doubled or halved so the screen size stays ~16–32 px.
 */
export function adaptiveGridStep(gridSize: number, zoom: number): number {
  if (!Number.isFinite(gridSize) || !Number.isFinite(zoom) || gridSize <= 0 || zoom <= 0) {
    return gridSize;
  }

  let step = gridSize;
  let screen = step * zoom;
  while (screen < MIN_GRID_SCREEN_PX) {
    step *= 2;
    screen *= 2;
  }
  while (screen > MAX_GRID_SCREEN_PX) {
    step /= 2;
    screen /= 2;
  }
  return step;
}
