import { describe, it, expect, vi } from 'vitest';
import { ObservableState } from './observable-state';

describe('ObservableState', () => {
  it('notifies on shallow property changes', () => {
    const observable = new ObservableState({ count: 0, text: 'hello' });
    const listener = vi.fn();
    observable.subscribe(listener);

    observable.data.count = 1;
    expect(listener).toHaveBeenCalledWith('count', 1);

    observable.data.text = 'world';
    expect(listener).toHaveBeenCalledWith('text', 'world');
  });

  it('notifies on deep property changes', () => {
    const observable = new ObservableState({ nested: { foo: 'bar', age: 10 } });
    const listener = vi.fn();
    observable.subscribe(listener);

    observable.data.nested.foo = 'baz';
    expect(listener).toHaveBeenCalledWith('nested.foo', 'baz');
    expect(observable.data.nested.foo).toBe('baz');
  });

  it('handles array mutations', () => {
    const observable = new ObservableState({ items: [1, 2] });
    const listener = vi.fn();
    observable.subscribe(listener);

    observable.data.items.push(3);
    // push sets index '2' to 3 (notifying 'items.2').
    // Duplicate length notification is suppressed because array length already matches new length.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('items.2', 3);
  });

  it('can unsubscribe from events', () => {
    const observable = new ObservableState({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = observable.subscribe(listener);

    observable.data.a = 2;
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    observable.data.a = 3;
    expect(listener).toHaveBeenCalledTimes(1); // Should not increase
  });
});
