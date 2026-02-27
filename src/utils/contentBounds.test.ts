import { describe, it, expect } from 'vitest';
import { getContentBounds } from './contentBounds';

describe('contentBounds', () => {
  it('returns null for empty input', () => {
    expect(getContentBounds({})).toBeNull();
    expect(getContentBounds({ nodes: [] })).toBeNull();
  });

  it('returns bounds for single node', () => {
    const node = {
      visible: true,
      getBounds: () => ({ x: 10, y: 20, width: 50, height: 40 }),
    };
    expect(getContentBounds({ nodes: [node] })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 40,
    });
  });

  it('merges bounds of multiple nodes', () => {
    const nodes = [
      { visible: true, getBounds: () => ({ x: 0, y: 0, width: 30, height: 30 }) },
      { visible: true, getBounds: () => ({ x: 50, y: 50, width: 40, height: 40 }) },
    ];
    expect(getContentBounds({ nodes })).toEqual({
      x: 0,
      y: 0,
      width: 90,
      height: 90,
    });
  });

  it('excludes invisible nodes by default', () => {
    const nodes = [
      { visible: true, getBounds: () => ({ x: 0, y: 0, width: 20, height: 20 }) },
      { visible: false, getBounds: () => ({ x: 100, y: 100, width: 50, height: 50 }) },
    ];
    expect(getContentBounds({ nodes })).toEqual({
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });
  });

  it('includes invisible nodes when includeInvisible is true', () => {
    const nodes = [
      { visible: true, getBounds: () => ({ x: 0, y: 0, width: 20, height: 20 }) },
      { visible: false, getBounds: () => ({ x: 100, y: 100, width: 50, height: 50 }) },
    ];
    expect(getContentBounds({ nodes, includeInvisible: true })).toEqual({
      x: 0,
      y: 0,
      width: 150,
      height: 150,
    });
  });

  it('merges nodes and edges', () => {
    const nodes = [{ visible: true, getBounds: () => ({ x: 0, y: 0, width: 20, height: 20 }) }];
    const edges = [{ visible: true, getBounds: () => ({ x: 50, y: 10, width: 100, height: 5 }) }];
    expect(getContentBounds({ nodes, edges })).toEqual({
      x: 0,
      y: 0,
      width: 150,
      height: 20,
    });
  });
});
