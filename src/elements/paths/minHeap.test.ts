import { describe, expect, it } from 'vitest';
import { MinHeap } from './minHeap';

describe('MinHeap', () => {
  it('pops in ascending order', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    const input = [5, 3, 9, 1, 7, 3, 8, 2, 6, 0, 4];
    for (const v of input) heap.push(v);
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop()!);
    expect(out).toEqual([...input].sort((a, b) => a - b));
  });

  it('returns undefined when empty', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    expect(heap.pop()).toBeUndefined();
    heap.push(1);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBeUndefined();
  });

  it('interleaves pushes and pops', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    heap.push(4);
    heap.push(2);
    expect(heap.pop()).toBe(2);
    heap.push(1);
    heap.push(3);
    expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([1, 3, 4]);
  });
});
