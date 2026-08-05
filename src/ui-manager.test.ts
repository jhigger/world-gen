import { describe, it, expect, vi } from 'vitest';
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
  it('syncs viewMode and focusedIndex changes to ViewportManager', async () => {
    const { UIManager } = await import('./ui-manager');
    const { ObservableState } = await import('./observable-state');

    const ui = new UIManager();
    const fakeState = { viewMode: 'grid' as 'grid' | 'single', focusedIndex: 0, params: {} };
    const obs = new ObservableState(fakeState);
    const mockViewportManager = {
      setGridMode: vi.fn(),
      getSphericalCameraSnapshot: vi.fn(),
    } as any;

    ui.init(obs, mockViewportManager);

    obs.data.focusedIndex = 3;
    obs.data.viewMode = 'single';

    expect(mockViewportManager.setGridMode).toHaveBeenLastCalledWith('single', 3);
  });

  it('syncs selectSingleAlgo dropdown when switching to grid view', async () => {
    const { UIManager } = await import('./ui-manager');
    const { ObservableState } = await import('./observable-state');

    const ui = new UIManager();
    ui.selectSingleAlgo = { value: '2', addEventListener: vi.fn() } as unknown as HTMLSelectElement;
    const fakeState = { viewMode: 'single' as 'grid' | 'single', focusedIndex: 2, params: {} };
    const obs = new ObservableState(fakeState);

    ui.init(obs);

    obs.data.viewMode = 'grid';

    expect(ui.selectSingleAlgo!.value).toBe('-1');
  });

  it('triggers onResetMetrics and onClearCaches when config parameters change', async () => {
    const { UIManager } = await import('./ui-manager');
    const { ObservableState } = await import('./observable-state');

    const ui = new UIManager();
    const fakeState = { resolution: 120, params: { scale: 50 } };
    const obs = new ObservableState(fakeState as any);

    const onClearCaches = vi.fn();
    const onResetMetrics = vi.fn();

    ui.init(obs, undefined, { onClearCaches, onResetMetrics });

    obs.data.resolution = 200;

    expect(onClearCaches).toHaveBeenCalled();
    expect(onResetMetrics).toHaveBeenCalled();
  });
});

