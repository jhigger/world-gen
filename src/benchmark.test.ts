import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMetrics } from './benchmark';

describe('PerformanceMetrics', () => {
  let metrics: PerformanceMetrics;

  beforeEach(() => {
    metrics = new PerformanceMetrics();
    vi.restoreAllMocks();
  });

  it('resets and clears metrics correctly', () => {
    metrics.addRenderTime(10);
    metrics.addMathTime(5);
    metrics.addRuggedness(1.2);
    expect(metrics.getAverageRenderTime()).toBeGreaterThan(0);

    metrics.clear();
    expect(metrics.getAverageRenderTime()).toBe(0);
    expect(metrics.getGlobalAverageFPS()).toBe(0);
    expect(metrics.getGlobalOnePercentLowFPS()).toBe(0);
  });

  it('calculates global average FPS correctly', () => {
    // Mock performance.now to simulate consistent 16.67ms frame intervals (60 FPS)
    let time = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      const current = time;
      time += 16.6667;
      return current;
    });

    metrics.tick(); // first frame sets lastFrameTime
    for (let i = 0; i < 60; i++) {
      metrics.tick();
    }

    expect(metrics.getGlobalAverageFPS()).toBe(60);
  });

  it('calculates 1% Low FPS (99th percentile frame time) correctly', () => {
    // Simulate 99 fast frames (10ms -> 100 FPS) and 1 slow stutter frame (100ms -> 10 FPS)
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => time);

    metrics.tick(); // frame 0 init

    // 99 normal frames at 10ms delta
    for (let i = 0; i < 99; i++) {
      time += 10;
      metrics.tick();
    }

    // 1 stutter frame at 100ms delta
    time += 100;
    metrics.tick();

    // Total 100 recorded frame samples
    // 99th percentile frame time index for 100 samples is index 99 (the max sample = 100ms)
    // 1% Low FPS = 1000 / 100ms = 10 FPS
    expect(metrics.getGlobalOnePercentLowFPS()).toBe(10);
    expect(metrics.getGlobalOnePercentLowFrameTime()).toBe(100);

    // Global Average FPS = 1000 / ((99*10 + 100)/100) = 1000 / 10.9ms = 92 FPS
    expect(metrics.getGlobalAverageFPS()).toBe(92);
  });
});
