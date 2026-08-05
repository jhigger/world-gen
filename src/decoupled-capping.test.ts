import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state, resetStateToDefaults } from './state';
import { OffscreenBenchmarkManager } from './offscreen-benchmark';
import { shouldExecuteMathTick, shouldRenderCanvasFrame, isIntervalElapsed, getResolvedFps } from './main';

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

  describe('Main-Thread Decoupled Math Throughput & Canvas Capping', () => {
    it('resolves fpsLimit strings into numeric target FPS values', () => {
      expect(getResolvedFps('uncapped', 60)).toBe(0);
      expect(getResolvedFps('60', 60)).toBe(60);
      expect(getResolvedFps('30', 60)).toBe(30);
      expect(getResolvedFps('custom', 120)).toBe(120);
      expect(getResolvedFps('invalid', 60)).toBe(60);
    });

    it('checks interval elapsed status accurately without fuzzy offset', () => {
      expect(isIntervalElapsed(16.66, 1010, 1000)).toBe(false);
      expect(isIntervalElapsed(16.66, 1017, 1000)).toBe(true);
    });

    it('allows unthrottled math execution when fpsLimit is uncapped regardless of interval', () => {
      const lastMathTime = 1000;
      // 2ms elapsed, far below 60fps frame interval (16.6ms)
      expect(shouldExecuteMathTick('uncapped', 60, 1002, lastMathTime)).toBe(true);
    });

    it('throttles math execution when fpsLimit is capped', () => {
      const lastMathTime = 1000;
      // Target 60 FPS -> interval ~16.67ms
      expect(shouldExecuteMathTick('60', 60, 1010, lastMathTime)).toBe(false);
      expect(shouldExecuteMathTick('60', 60, 1017, lastMathTime)).toBe(true);
    });

    it('clamps visual canvas rendering to canvasFpsCap independent of math throughput', () => {
      const lastRenderTime = 1000;
      // Target 60 FPS -> interval ~16.67ms
      expect(shouldRenderCanvasFrame(60, 1010, lastRenderTime)).toBe(false);
      expect(shouldRenderCanvasFrame(60, 1017, lastRenderTime)).toBe(true);

      // Target 30 FPS -> interval ~33.33ms
      expect(shouldRenderCanvasFrame(30, 1025, lastRenderTime)).toBe(false);
      expect(shouldRenderCanvasFrame(30, 1034, lastRenderTime)).toBe(true);
    });
  });
});


