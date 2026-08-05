import { describe, it, expect } from 'vitest';
// UIManager is a DOM-heavy module; we test its interface shape here
// and verify it exports the expected symbols.

describe('UIManager interface', () => {
  it('exports UIManager class with expected methods', async () => {
    const mod = await import('./ui-manager');
    expect(mod.UIManager).toBeDefined();
    expect(typeof mod.UIManager).toBe('function');

    const instance = new mod.UIManager();
    expect(typeof instance.init).toBe('function');
    expect(typeof instance.syncDOMToState).toBe('function');
    expect(typeof instance.getErosionElapsedTime).toBe('function');
    expect(typeof instance.setErosionElapsedTime).toBe('function');
  });
});
