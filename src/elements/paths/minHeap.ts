/** Binary min-heap; `less(a, b)` is true when `a` must pop before `b`. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    const items = this.items;
    let i = items.length;
    items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(item, items[parent]!)) break;
      items[i] = items[parent]!;
      i = parent;
    }
    items[i] = item;
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || last === undefined) return top;
    const n = items.length;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= n) break;
      const right = left + 1;
      const child = right < n && this.less(items[right]!, items[left]!) ? right : left;
      if (!this.less(items[child]!, last)) break;
      items[i] = items[child]!;
      i = child;
    }
    items[i] = last;
    return top;
  }
}
