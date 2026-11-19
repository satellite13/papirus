import { describe, it, expect } from 'vitest';
import { countBends, orthogonalRouteCost, ROUTE_BEND_COST } from './routeCost';
import {
  DEFAULT_END_STUB,
  END_STUB_EXTRA,
  END_STUB_FACING_START_MIN,
  END_STUB_MIN,
} from '@/constants';

describe('routeCost', () => {
  it('counts axis changes', () => {
    expect(countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
    expect(countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(1);
    expect(
      countBends([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }])
    ).toBe(2);
  });

  it('ignores zero-length segments and colinear vertices', () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe(1);
  });

  it('cost is manhattan length plus bends × ROUTE_BEND_COST', () => {
    expect(ROUTE_BEND_COST).toBe(160);
    expect(
      orthogonalRouteCost([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }])
    ).toBe(30 + 2 * 160);
  });

  it('end stub constants', () => {
    expect(END_STUB_EXTRA).toBe(4);
    expect(END_STUB_MIN).toBe(12);
    expect(END_STUB_FACING_START_MIN).toBe(8);
    expect(DEFAULT_END_STUB).toBe(16);
  });
});
