export type StateListener = (path: string, newValue: any) => void;

export class ObservableState<T extends object> {
  private listeners: Set<StateListener> = new Set();
  public data: T;

  constructor(initialData: T) {
    this.data = this.createDeepProxy(initialData, "");
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(path: string, newValue: any) {
    for (const listener of this.listeners) {
      listener(path, newValue);
    }
  }

  private createDeepProxy(target: any, path: string): any {
    if (typeof target !== 'object' || target === null) return target;
    
    // Arrays might get noisy with length and index mutations, 
    // but we can proxy them as well for fine-grained reactivity if needed.

    const handler: ProxyHandler<any> = {
      get: (obj, prop, receiver) => {
        return Reflect.get(obj, prop, receiver);
      },
      set: (obj, prop, value, receiver) => {
        const oldValue = Reflect.get(obj, prop, receiver);
        if (oldValue === value) return true; // Prevent infinite event loops and redundant triggers

        const fullPath = path ? `${path}.${String(prop)}` : String(prop);
        
        // Recursively proxy the new value if it's an object, BUT explicitly ignore huge geometry buffers like heightmapCache
        if (typeof value === 'object' && value !== null && !fullPath.includes('heightmapCache')) {
          value = this.createDeepProxy(value, fullPath);
        }

        const success = Reflect.set(obj, prop, value, receiver);
        if (success) {
          this.notify(fullPath, value);
        }
        return success;
      }
    };

    // Recursively proxy existing nested objects
    for (const key of Object.keys(target)) {
      const childPath = path ? `${path}.${key}` : key;
      if (typeof target[key] === 'object' && target[key] !== null && !childPath.includes('heightmapCache')) {
        target[key] = this.createDeepProxy(target[key], childPath);
      }
    }

    return new Proxy(target, handler);
  }
}
