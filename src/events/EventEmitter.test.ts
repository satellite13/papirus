import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './EventEmitter';

interface TestEvents {
  test: [value: string];
  multi: [a: number, b: string];
  empty: [];
}

describe('EventEmitter', () => {
  it('should call listener when event is emitted', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).toHaveBeenCalledWith('hello');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should support multiple listeners for same event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on('test', listener1);
    emitter.on('test', listener2);
    emitter.emit('test', 'hello');

    expect(listener1).toHaveBeenCalledWith('hello');
    expect(listener2).toHaveBeenCalledWith('hello');
  });

  it('should pass multiple arguments to listener', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('multi', listener);
    emitter.emit('multi', 42, 'test');

    expect(listener).toHaveBeenCalledWith(42, 'test');
  });

  it('should handle events with no arguments', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('empty', listener);
    emitter.emit('empty');

    expect(listener).toHaveBeenCalledWith();
  });

  it('should remove listener with off()', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.off('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should return unsubscribe function from on()', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    const unsubscribe = emitter.on('test', listener);
    unsubscribe();
    emitter.emit('test', 'hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should call once() listener only once', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.once('test', listener);
    emitter.emit('test', 'first');
    emitter.emit('test', 'second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('should return unsubscribe function from once()', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    const unsubscribe = emitter.once('test', listener);
    unsubscribe();
    emitter.emit('test', 'hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should remove all listeners for specific event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    emitter.on('test', listener1);
    emitter.on('test', listener2);
    emitter.on('multi', listener3);

    emitter.removeAllListeners('test');
    emitter.emit('test', 'hello');
    emitter.emit('multi', 1, 'a');

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
    expect(listener3).toHaveBeenCalled();
  });

  it('should remove all listeners when no event specified', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on('test', listener1);
    emitter.on('multi', listener2);

    emitter.removeAllListeners();
    emitter.emit('test', 'hello');
    emitter.emit('multi', 1, 'a');

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should return correct listener count', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    expect(emitter.listenerCount('test')).toBe(0);

    emitter.on('test', listener1);
    expect(emitter.listenerCount('test')).toBe(1);

    emitter.on('test', listener2);
    expect(emitter.listenerCount('test')).toBe(2);

    emitter.off('test', listener1);
    expect(emitter.listenerCount('test')).toBe(1);
  });

  it('should not throw when emitting event with no listeners', () => {
    const emitter = new EventEmitter<TestEvents>();

    expect(() => {
      emitter.emit('test', 'hello');
    }).not.toThrow();
  });

  it('should not throw when removing non-existent listener', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    expect(() => {
      emitter.off('test', listener);
    }).not.toThrow();
  });
});
