import { describe, expect, it } from 'vitest';
import { resolveContentInset } from './resolveContentInset';

const inset = { top: 40, right: 8, bottom: 8, left: 10 };
const base = { width: 100, height: 120 };

describe('resolveContentInset', () => {
  it('keeps all sides fixed when scale is omitted', () => {
    const resolved = resolveContentInset(inset, undefined, { width: 200, height: 240 }, base);
    expect(resolved).toEqual(inset);
  });

  it('scales only top with height', () => {
    const resolved = resolveContentInset(
      inset,
      { top: true },
      { width: 200, height: 240 },
      base
    );
    expect(resolved.top).toBe(80);
    expect(resolved.right).toBe(8);
    expect(resolved.bottom).toBe(8);
    expect(resolved.left).toBe(10);
  });

  it('scales top with height and left with width', () => {
    const resolved = resolveContentInset(
      inset,
      { top: true, left: true },
      { width: 200, height: 240 },
      base
    );
    expect(resolved.top).toBe(80);
    expect(resolved.left).toBe(20);
    expect(resolved.right).toBe(8);
    expect(resolved.bottom).toBe(8);
  });

  it('uses factor 1 when base is missing or non-positive', () => {
    expect(
      resolveContentInset(inset, { top: true }, { width: 200, height: 240 }, undefined).top
    ).toBe(40);
    expect(
      resolveContentInset(inset, { top: true }, { width: 200, height: 240 }, {
        width: 0,
        height: 0,
      }).top
    ).toBe(40);
  });

  it('supports non-uniform resize independently per axis', () => {
    const resolved = resolveContentInset(
      inset,
      { top: true, left: true },
      { width: 150, height: 60 },
      base
    );
    expect(resolved.top).toBe(20); // 40 * (60/120)
    expect(resolved.left).toBe(15); // 10 * (150/100)
  });
});
