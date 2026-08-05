import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkerBenchmarkAccumulator,
  BenchmarkOrchestrator,
  enrichAlgoMetrics,
} from './benchmark-orchestrator';
import { resetStateToDefaults } from './state';

// ---------------------------------------------------------------------------
// enrichAlgoMetrics
// ---------------------------------------------------------------------------
describe('enrichAlgoMetrics', () => {
  it('calculates unrounded microsecond precision and memory footprint', () => {
    const raw = { avgFps: 120, lowFps: 100, avgFrameMs: 8.33, lowFrameMs: 10.0 };
    const enriched = enrichAlgoMetrics(raw, 0, 120);

    // 120 FPS -> exact 8.333333ms. totalSamples = 14400.
    // 8.333333ms * 1000 / 14400 = 0.578703... -> 0.579 us
    expect(enriched.perSampleUs).toBe(0.579);
    // 14400 * 4 / 1024 = 56.25 -> 56.3 KB
    expect(enriched.memoryKB).toBe(56.3);
    expect(enriched.complexity).toBe('O(octaves)');
  });
});

// ---------------------------------------------------------------------------
// WorkerBenchmarkAccumulator
// ---------------------------------------------------------------------------
describe('WorkerBenchmarkAccumulator', () => {
  let acc: WorkerBenchmarkAccumulator;

  beforeEach(() => {
    acc = new WorkerBenchmarkAccumulator();
  });

  it('returns zeroed result when no samples recorded', () => {
    const r = acc.getCompiledResult();
    expect(r).toEqual({ avgFps: 0, lowFps: 0, avgFrameMs: 0, lowFrameMs: 0 });
  });

  it('ignores fps <= 0 samples', () => {
    acc.recordSample(0, 10, 5);
    acc.recordSample(-1, 10, 5);
    expect(acc.getCompiledResult().avgFps).toBe(0);
  });

  it('computes average FPS from recorded samples', () => {
    // Record 10 samples at 120 FPS
    for (let i = 0; i < 10; i++) {
      acc.recordSample(120, 4, 4);
    }
    const r = acc.getCompiledResult();
    expect(r.avgFps).toBe(120);
  });

  it('computes 99th percentile low FPS (1% low)', () => {
    // 99 fast frames at 100 FPS (10ms frame time) and 1 slow at 10 FPS (100ms)
    // p99Index = ceil(100*0.99)-1 = 98 (0-based), which is the 99th element in sorted order.
    // Sorted frameMsBuffer: [10ms x99, 100ms x1]. Index 98 = 10ms.
    for (let i = 0; i < 99; i++) {
      acc.recordSample(100, 5, 5); // totalFrameMs = 10
    }
    acc.recordSample(10, 50, 50); // totalFrameMs = 100
    const r = acc.getCompiledResult();
    expect(r.lowFps).toBe(100); // 1000 / 10ms = 100 (p99 frame time is 10ms)
    expect(r.lowFrameMs).toBe(10);
  });

  it('reports slow p99 when enough slow frames push above the threshold', () => {
    // 90 fast frames (10ms) and 10 slow frames (100ms)
    // p99Index = ceil(100*0.99)-1 = 98, sorted: [10ms x90, 100ms x10], index 98 = 100ms
    for (let i = 0; i < 90; i++) {
      acc.recordSample(100, 5, 5); // totalFrameMs = 10
    }
    for (let i = 0; i < 10; i++) {
      acc.recordSample(10, 50, 50); // totalFrameMs = 100
    }
    const r = acc.getCompiledResult();
    expect(r.lowFps).toBe(10); // 1000 / 100ms = 10
    expect(r.lowFrameMs).toBe(100);
  });

  it('resets to empty state', () => {
    acc.recordSample(60, 8, 8);
    acc.reset();
    expect(acc.getCompiledResult().avgFps).toBe(0);
  });

  it('wraps around ring buffer without crashing', () => {
    // Fill more than 500 samples (buffer size)
    for (let i = 0; i < 600; i++) {
      acc.recordSample(60, 8, 8);
    }
    const r = acc.getCompiledResult();
    expect(r.avgFps).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// BenchmarkOrchestrator
// ---------------------------------------------------------------------------
describe('BenchmarkOrchestrator', () => {
  let orchestrator: BenchmarkOrchestrator;

  beforeEach(() => {
    resetStateToDefaults();
    orchestrator = new BenchmarkOrchestrator();
  });

  it('starts in inactive state', () => {
    expect(orchestrator.isRunning()).toBe(false);
  });

  it('exposes algorithm count and current index after start', () => {
    orchestrator.start({
      algorithmCount: 5,
      getResolvedDuration: () => 10,
    });
    expect(orchestrator.isRunning()).toBe(true);
    expect(orchestrator.getCurrentAlgoIndex()).toBe(0);
  });

  it('advances to next algorithm when tick duration expires', () => {
    let advancedTo = -1;
    orchestrator.start({
      algorithmCount: 3,
      getResolvedDuration: () => 5,
      onAlgoAdvance: (idx: number) => { advancedTo = idx; },
    });

    // Tick 5 seconds — should complete algo 0 and advance to algo 1
    orchestrator.tick(5.0);
    expect(advancedTo).toBe(1);
    expect(orchestrator.getCurrentAlgoIndex()).toBe(1);
  });

  it('fires onComplete when all algorithms finish', () => {
    let completed = false;
    orchestrator.start({
      algorithmCount: 2,
      getResolvedDuration: () => 1,
      onComplete: () => { completed = true; },
    });

    orchestrator.tick(1.0); // finishes algo 0 → starts algo 1
    orchestrator.tick(1.0); // finishes algo 1 → completes
    expect(completed).toBe(true);
    expect(orchestrator.isRunning()).toBe(false);
  });

  it('stop() halts the run and records current algo result', () => {
    let completedAlgos: number[] = [];
    orchestrator.start({
      algorithmCount: 5,
      getResolvedDuration: () => 10,
      onAlgoComplete: (idx: number) => { completedAlgos.push(idx); },
    });

    orchestrator.tick(3.0); // partway through algo 0
    orchestrator.stop();

    expect(orchestrator.isRunning()).toBe(false);
    expect(completedAlgos).toContain(0); // current algo should be recorded on stop
  });

  it('tracks elapsed time per algorithm', () => {
    orchestrator.start({
      algorithmCount: 3,
      getResolvedDuration: () => 10,
    });

    orchestrator.tick(3.5);
    expect(orchestrator.getElapsedTime()).toBeCloseTo(3.5, 1);
  });

  it('getResults returns compiled results for all completed algorithms', () => {
    orchestrator.start({
      algorithmCount: 2,
      getResolvedDuration: () => 1,
    });

    orchestrator.tick(1.0);
    orchestrator.tick(1.0);

    const results = orchestrator.getResults();
    expect(results).toHaveLength(2);
  });

  it('accumulator records telemetry samples during a run', () => {
    orchestrator.start({
      algorithmCount: 1,
      getResolvedDuration: () => 10,
    });

    // Feed in some worker telemetry
    orchestrator.recordTelemetrySample(120, 4, 4);
    orchestrator.recordTelemetrySample(120, 4, 4);

    orchestrator.tick(10.0);
    const results = orchestrator.getResults();
    expect(results[0]?.avgFps).toBe(120);
  });
});
