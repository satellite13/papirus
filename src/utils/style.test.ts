import { describe, expect, it } from 'vitest';
import { shallowEqual } from './style';

describe('shallowEqual', () => {
  it('returns true for same reference', () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('compares arrays by value', () => {
    expect(shallowEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(shallowEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
  });

  it('detects different keys', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
