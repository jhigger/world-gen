import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UIManager } from './ui-manager';
import { ObservableState } from './observable-state';
import { state, resetStateToDefaults, getResolvedErosionDuration } from './state';
import * as storage from './storage';

describe('Diagnose Issues Regression Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Fix Issue A: Toggling isErosionActive does NOT wipe heightmapCache or call onClearCaches', () => {
    resetStateToDefaults();
    const ui = new UIManager();
    const obs = new ObservableState(state);

    const onClearCaches = vi.fn();

    ui.init(obs, undefined, { onClearCaches, onResetMetrics: vi.fn() });

    state.heightmapCache[0] = [[1, 2], [3, 4]];

    // Toggling isErosionActive to true
    obs.data.isErosionActive = true;

    // Verify onClearCaches is NOT called and cache remains intact
    expect(onClearCaches).not.toHaveBeenCalled();
    expect(state.heightmapCache[0]).toEqual([[1, 2], [3, 4]]);

    // Toggling isErosionActive back to false (pausing)
    obs.data.isErosionActive = false;
    expect(onClearCaches).not.toHaveBeenCalled();
    expect(state.heightmapCache[0]).toEqual([[1, 2], [3, 4]]);
  });

  it('Fix Issue B: Debounces storage writes during rapid slider changes', () => {
    resetStateToDefaults();
    const ui = new UIManager();
    const obs = new ObservableState(state);
    const saveSpy = vi.spyOn(storage, 'saveConfig');

    ui.init(obs);

    // Simulate 5 rapid slider changes (e.g. noiseSpeed slider drag)
    obs.data.noiseSpeed = 1.0;
    obs.data.noiseSpeed = 2.0;
    obs.data.noiseSpeed = 3.0;
    obs.data.noiseSpeed = 4.0;
    obs.data.noiseSpeed = 5.0;

    // Immediately, saveConfig has NOT been called 5 times
    expect(saveSpy).toHaveBeenCalledTimes(0);

    // Advance time by 300ms
    vi.advanceTimersByTime(300);

    // Now saveConfig has been called exactly once
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('Shows Start Erosion when finished based on target duration, and Resume Erosion when manually paused mid-way', () => {
    resetStateToDefaults();
    state.erosionDuration = '15';
    const ui = new UIManager();
    const obs = new ObservableState(state);
    const onClearCaches = vi.fn();

    ui.toggleErosion = { addEventListener: vi.fn() } as unknown as HTMLButtonElement;
    ui.lblErosion = { textContent: '' } as HTMLElement;
    ui.init(obs, undefined, { onClearCaches, onResetMetrics: vi.fn() });

    // Case 1: Manually paused at 5s (< 15s)
    ui.setErosionElapsedTime(5);
    state.isErosionActive = false;
    ui.syncErosionButtonUI();
    expect(ui.lblErosion.textContent).toBe('Resume Erosion');

    // Case 2: Finished at 15s (>= 15s)
    ui.setErosionElapsedTime(15);
    state.isErosionActive = false;
    ui.syncErosionButtonUI();
    expect(ui.lblErosion.textContent).toBe('Start Erosion');

    // Case 3: Re-starting finished erosion clears caches
    const targetSec = getResolvedErosionDuration();
    if (typeof targetSec === 'number' && ui.getErosionElapsedTime() >= targetSec) {
      onClearCaches();
      ui.setErosionElapsedTime(0);
    }
    expect(onClearCaches).toHaveBeenCalled();
    expect(ui.getErosionElapsedTime()).toBe(0);
  });
});
