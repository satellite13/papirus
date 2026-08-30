import { describe, expect, it } from 'vitest';
import { edgePathIntersectsViewport } from './pathViewport';

const viewport = { x: 100, y: 100, width: 200, height: 120 };

describe('edgePathIntersectsViewport', () => {
  it('rejects when the path AABB misses the viewport', () => {
    expect(
      edgePathIntersectsViewport(
        {
          type: 'straight',
          path: [
            { x: 0, y: 0 },
            { x: 20, y: 20 },
          ],
        },
        viewport
      )
    ).toBe(false);
  });

  it('keeps an empty path so the first layout can paint', () => {
    expect(edgePathIntersectsViewport({ type: 'straight', path: [] }, viewport)).toBe(true);
  });

  it('hits a segment that lies entirely inside the viewport', () => {
    expect(
      edgePathIntersectsViewport(
        {
          type: 'polyline',
          path: [
            { x: 140, y: 140 },
            { x: 180, y: 160 },
          ],
        },
        viewport
      )
    ).toBe(true);
  });

  it('hits a segment that crosses a viewport edge', () => {
    expect(
      edgePathIntersectsViewport(
        {
          type: 'straight',
          path: [
            { x: 0, y: 160 },
            { x: 400, y: 160 },
          ],
        },
        viewport
      )
    ).toBe(true);
  });

  it('drops a bezier whose fat AABB covers the viewport but the arc misses it', () => {
    expect(
      edgePathIntersectsViewport(
        {
          type: 'bezier',
          path: [
            { x: 0, y: 0 },
            { x: 50, y: 200 },
            { x: 50, y: 200 },
            { x: 100, y: 0 },
          ],
        },
        { x: 0, y: 160, width: 10, height: 10 }
      )
    ).toBe(false);
  });

  it('keeps a bezier when the sampled curve enters the viewport', () => {
    expect(
      edgePathIntersectsViewport(
        {
          type: 'bezier',
          path: [
            { x: 0, y: 0 },
            { x: 50, y: 200 },
            { x: 50, y: 200 },
            { x: 100, y: 0 },
          ],
        },
        { x: 40, y: 140, width: 20, height: 20 }
      )
    ).toBe(true);
  });
});
