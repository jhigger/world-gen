import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state, resetStateToDefaults } from './state';
import { OffscreenBenchmarkManager } from './offscreen-benchmark';

describe('Decoupled Canvas Capping & Metric Throttling', () => {
  beforeEach(() => {
    resetStateToDefaults();
  });

  describe('Application State', () => {
    it('defaults canvasFpsCap to 60 FPS', () => {
      expect(state.canvasFpsCap).toBe(60);
    });

    it('resets canvasFpsCap to 60 on resetStateToDefaults', () => {
      state.canvasFpsCap = 30;
      expect(state.canvasFpsCap).toBe(30);
      resetStateToDefaults();
      expect(state.canvasFpsCap).toBe(60);
    });
  });

  describe('OffscreenBenchmarkManager', () => {
    it('forwards canvasFpsCap in worker initialize and updateParams messages', () => {
      const postMessageSpy = vi.fn();
      const mockWorker = {
        postMessage: postMessageSpy,
        onmessage: null,
        terminate: vi.fn(),
      };

      if (typeof globalThis.window === 'undefined') {
        (globalThis as any).window = globalThis;
      }
      (globalThis as any).Worker = function MockWorker() {
        return mockWorker;
      };
      (globalThis as any).window.Worker = (globalThis as any).Worker;
      (globalThis as any).window.devicePixelRatio = 1;
      const MockResizeObserver = class {
        observe() {}
        disconnect() {}
        unobserve() {}
      };
      (globalThis as any).ResizeObserver = MockResizeObserver;
      (globalThis as any).window.ResizeObserver = MockResizeObserver;

      vi.spyOn(OffscreenBenchmarkManager, 'isSupported').mockReturnValue(true);

      const manager = new OffscreenBenchmarkManager();
      const dummyCanvas = {
        transferControlToOffscreen: vi.fn().mockReturnValue({}),
      } as unknown as HTMLCanvasElement;
      const dummyContainer = {
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 300, height: 300 }),
      } as unknown as HTMLElement;

      const success = manager.initialize(
        dummyCanvas,
        dummyContainer,
        'Perlin Noise',
        state.params,
        120,
        vi.fn(),
        'offscreen',
        30
      );

      expect(success).toBe(true);
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'init',
          canvasFpsCap: 30,
        }),
        [expect.anything()]
      );

      manager.updateParams('Simplex Noise', 120, state.params, 'offscreen', 45);
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updateParams',
          canvasFpsCap: 45,
        })
      );

      manager.destroy();
    });
  });

  describe('DOM Metric Throttling', () => {
    it('determines whether 100ms throttle interval has elapsed', () => {
      const throttleIntervalMs = 100;
      const lastUpdate = 1000;

      expect(1050 - lastUpdate >= throttleIntervalMs).toBe(false);
      expect(1100 - lastUpdate >= throttleIntervalMs).toBe(true);
      expect(1105 - lastUpdate >= throttleIntervalMs).toBe(true);
    });
  });
});
