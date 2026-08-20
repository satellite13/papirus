import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LABEL_GAP,
  externalLabelWrapWidth,
  isExternalLabelPlacement,
  resolveExternalLabelBounds,
  unionBounds,
} from './labelPlacement';

const shape = { x: 10, y: 20, width: 40, height: 40 };
const measured = { width: 80, height: 16 };

describe('labelPlacement', () => {
  it('treats only side values as external', () => {
    expect(isExternalLabelPlacement('top')).toBe(true);
    expect(isExternalLabelPlacement('bottom')).toBe(true);
    expect(isExternalLabelPlacement('left')).toBe(true);
    expect(isExternalLabelPlacement('right')).toBe(true);
    expect(isExternalLabelPlacement('center')).toBe(false);
    expect(isExternalLabelPlacement('auto')).toBe(false);
    expect(isExternalLabelPlacement(undefined)).toBe(false);
  });

  it('places the label below the shape AABB', () => {
    expect(resolveExternalLabelBounds(shape, 'bottom', DEFAULT_LABEL_GAP, measured)).toEqual({
      x: -10,
      y: 64,
      width: 80,
      height: 16,
    });
  });

  it('places the label above the shape AABB', () => {
    expect(resolveExternalLabelBounds(shape, 'top', 4, measured)).toEqual({
      x: -10,
      y: 0,
      width: 80,
      height: 16,
    });
  });

  it('places the label to the left and right of the shape AABB', () => {
    expect(resolveExternalLabelBounds(shape, 'left', 4, measured)).toEqual({
      x: -74,
      y: 32,
      width: 80,
      height: 16,
    });
    expect(resolveExternalLabelBounds(shape, 'right', 4, measured)).toEqual({
      x: 54,
      y: 32,
      width: 80,
      height: 16,
    });
  });

  it('uses a minimum wrap width so small BPMN events can keep a readable name', () => {
    expect(externalLabelWrapWidth(36)).toBe(80);
    expect(externalLabelWrapWidth(120)).toBe(120);
  });

  it('unions shape and label bounds for export/fit', () => {
    const label = resolveExternalLabelBounds(shape, 'bottom', 4, measured);
    expect(unionBounds(shape, label)).toEqual({
      x: -10,
      y: 20,
      width: 80,
      height: 60,
    });
  });
});
