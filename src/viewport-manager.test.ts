import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewportManager } from './viewport-manager';
import { availableAlgorithms } from './algorithms';

describe('ViewportManager', () => {
  let viewportManager: ViewportManager;

  beforeEach(() => {
    viewportManager = new ViewportManager({ algorithms: availableAlgorithms });
  });

  it('initializes with default grid view mode and focus index 0', () => {
    expect(viewportManager.getViewMode()).toBe('grid');
    expect(viewportManager.getFocusedIndex()).toBe(0);
    expect(viewportManager.getRenderers()).toHaveLength(0);
  });

  it('updates view mode and focused algorithm by index', () => {
    viewportManager.setGridMode('single', 2);
    expect(viewportManager.getViewMode()).toBe('single');
    expect(viewportManager.getFocusedIndex()).toBe(2);

    viewportManager.setGridMode('grid');
    expect(viewportManager.getViewMode()).toBe('grid');
  });

  it('updates view mode and focused algorithm by algorithm name', () => {
    const algoName = availableAlgorithms[3].name; // Worley Noise
    viewportManager.setGridMode('single', algoName);
    expect(viewportManager.getViewMode()).toBe('single');
    expect(viewportManager.getFocusedIndex()).toBe(3);
  });

  it('triggers onGridModeChange callback on mode switch', () => {
    const callback = vi.fn();
    const manager = new ViewportManager({
      algorithms: availableAlgorithms,
      onGridModeChange: callback,
    });

    manager.setGridMode('single', 1);
    expect(callback).toHaveBeenCalledWith('single', 1);
  });

  it('tracks syncing state correctly', () => {
    expect(viewportManager.getIsSyncing()).toBe(false);
    viewportManager.setIsSyncing(true);
    expect(viewportManager.getIsSyncing()).toBe(true);
    viewportManager.setIsSyncing(false);
    expect(viewportManager.getIsSyncing()).toBe(false);
  });

  it('stores and updates camera spherical parameters via object state', () => {
    viewportManager.applySavedCameraState({
      zoom: 200,
      pitch: 1.2,
      yaw: 0.5,
      offsetX: 1.0,
      offsetY: 2.0,
      offsetZ: 3.0,
    });
    expect(viewportManager.cameraState.zoom).toBe(200);
    expect(viewportManager.cameraState.pitch).toBe(1.2);
    expect(viewportManager.cameraState.yaw).toBe(0.5);
    expect(viewportManager.cameraState.offsetX).toBe(1.0);
    expect(viewportManager.cameraState.offsetY).toBe(2.0);
    expect(viewportManager.cameraState.offsetZ).toBe(3.0);
  });

  it('handles camera translation helper methods without throwing', () => {
    expect(() => viewportManager.translateCameraHeight(0.5)).not.toThrow();
    expect(viewportManager.cameraState.offsetY).toBe(0.5);

    expect(() => viewportManager.panCamera(1.0, -0.5)).not.toThrow();
    expect(viewportManager.cameraState.offsetX).toBe(1.0);
    expect(viewportManager.cameraState.offsetZ).toBe(-0.5);
  });

  it('handles start and stop render loop cleanly', () => {
    const tickSpy = vi.fn();
    viewportManager.startRenderLoop(tickSpy);
    viewportManager.stopRenderLoop();
    expect(viewportManager['isLoopRunning']).toBe(false);
  });

  it('disposes cleanly without throwing errors', () => {
    expect(() => viewportManager.dispose()).not.toThrow();
  });
});
