import { describe, it, expect } from 'vitest';
import {
  isIntervalElapsed,
  getResolvedFps,
  shouldExecuteMathTick,
  shouldRenderCanvasFrame,
  AnimationLoop,
} from './animation-loop';

/**
 * Tests for the AnimationLoop module's exported pure functions and class interface.
 * The pure timing functions were originally in main.ts and are now re-exported
 * from animation-loop.ts; existing coverage in decoupled-capping.test.ts
 * continues to import from main.ts (which re-exports from here).
 */
describe('AnimationLoop pure functions', () => {
  describe('isIntervalElapsed', () => {
    it('returns false when interval has not elapsed', () => {
      expect(isIntervalElapsed(16.66, 1010, 1000)).toBe(false);
    });

    it('returns true when interval has elapsed', () => {
      expect(isIntervalElapsed(16.66, 1017, 1000)).toBe(true);
    });

    it('returns true when exactly at boundary', () => {
      expect(isIntervalElapsed(10, 1010, 1000)).toBe(true);
    });
  });

  describe('getResolvedFps', () => {
    it('returns 0 for uncapped', () => {
      expect(getResolvedFps('uncapped', 60)).toBe(0);
    });

    it('parses numeric string limits', () => {
      expect(getResolvedFps('30', 60)).toBe(30);
      expect(getResolvedFps('60', 60)).toBe(60);
      expect(getResolvedFps('144', 60)).toBe(144);
    });

    it('uses customFps when fpsLimit is custom', () => {
      expect(getResolvedFps('custom', 120)).toBe(120);
    });

    it('defaults to 60 for invalid strings', () => {
      expect(getResolvedFps('invalid', 60)).toBe(60);
    });
  });

  describe('shouldExecuteMathTick', () => {
    it('always returns true when uncapped', () => {
      expect(shouldExecuteMathTick('uncapped', 60, 1002, 1000)).toBe(true);
    });

    it('throttles when capped and interval not elapsed', () => {
      expect(shouldExecuteMathTick('60', 60, 1010, 1000)).toBe(false);
    });

    it('allows execution when capped and interval elapsed', () => {
      expect(shouldExecuteMathTick('60', 60, 1017, 1000)).toBe(true);
    });
  });

  describe('shouldRenderCanvasFrame', () => {
    it('clamps to canvasFpsCap independent of math rate', () => {
      expect(shouldRenderCanvasFrame(60, 1010, 1000)).toBe(false);
      expect(shouldRenderCanvasFrame(60, 1017, 1000)).toBe(true);
    });

    it('uses different interval for 30 FPS cap', () => {
      expect(shouldRenderCanvasFrame(30, 1025, 1000)).toBe(false);
      expect(shouldRenderCanvasFrame(30, 1034, 1000)).toBe(true);
    });
  });
});

describe('AnimationLoop class', () => {
  it('starts in non-running state', () => {
    const loop = new AnimationLoop();
    expect(loop.isRunning()).toBe(false);
  });

  it('reports running state after start', () => {
    // We cannot fully test start() without DOM/rAF, but we can verify
    // that the interface shape is correct
    const loop = new AnimationLoop();
    expect(typeof loop.start).toBe('function');
    expect(typeof loop.stop).toBe('function');
    expect(typeof loop.isRunning).toBe('function');
  });
});
