/**
 * BenchmarkOrchestrator — deep module that encapsulates the sequential
 * benchmark state machine, OffscreenBenchmarkManager, BenchmarkSuite,
 * PerformanceMetrics trackers, and WorkerBenchmarkAccumulator.
 *
 * @see ADR-0002 Offscreen Worker Benchmark Engine
 */

import { availableAlgorithms } from './algorithms';
import { PerformanceMetrics, BenchmarkSuite } from './benchmark';
import { OffscreenBenchmarkManager } from './offscreen-benchmark';
import { state, getResolvedBenchmarkDuration } from './state';
import type { BenchmarkMode, TelemetryPayload } from './worker';

export interface CompiledAlgoResult {
  avgFps: number;
  lowFps: number;
  avgFrameMs: number;
  lowFrameMs: number;
}

export interface BenchmarkOrchestratorUI {
  panelBenchStatus: HTMLDivElement | null;
  valBenchState: HTMLSpanElement | null;
  btnBenchmark: HTMLButtonElement | null;
  selectBenchmarkMode: HTMLSelectElement | null;
  openBenchmarkResultsModal?: () => void;
  closeBenchmarkResultsModal?: () => void;
  setViewMode: (mode: 'grid' | 'single', index: number) => void;
}

/**
 * Aggregates worker telemetry samples into compiled FPS statistics
 * using Zero-GC In-Place Mutation on pre-allocated Float32Array ring buffers.
 */
export class WorkerBenchmarkAccumulator {
  private fpsBuffer = new Float32Array(500);
  private frameMsBuffer = new Float32Array(500);
  private scratchBuffer = new Float32Array(500);
  private sampleCount = 0;

  reset(): void {
    this.sampleCount = 0;
  }

  recordSample(fps: number, maxMathTimeMs: number, maxRenderTimeMs: number): void {
    if (fps <= 0) return;
    const totalFrameMs = maxMathTimeMs + maxRenderTimeMs > 0
      ? maxMathTimeMs + maxRenderTimeMs
      : 1000 / fps;

    const idx = this.sampleCount % this.fpsBuffer.length;
    this.fpsBuffer[idx] = fps;
    this.frameMsBuffer[idx] = totalFrameMs;
    if (this.sampleCount < 50000) {
      this.sampleCount++;
    }
  }

  getCompiledResult(): CompiledAlgoResult {
    if (this.sampleCount === 0) {
      return { avgFps: 0, lowFps: 0, avgFrameMs: 0, lowFrameMs: 0 };
    }

    const n = Math.min(this.sampleCount, this.fpsBuffer.length);
    let fpsSum = 0;
    for (let i = 0; i < n; i++) {
      fpsSum += this.fpsBuffer[i];
      this.scratchBuffer[i] = this.frameMsBuffer[i];
    }
    const avgFps = Math.round(fpsSum / n);
    const avgFrameMs = avgFps > 0 ? parseFloat((1000 / avgFps).toFixed(2)) : 0;

    const validSamples = this.scratchBuffer.subarray(0, n);
    validSamples.sort();

    const p99Index = Math.max(0, Math.min(Math.ceil(n * 0.99) - 1, n - 1));
    const p99FrameMs = validSamples[p99Index] || (avgFps > 0 ? 1000 / avgFps : 0);

    const lowFps = p99FrameMs > 0 ? Math.round(1000 / p99FrameMs) : avgFps;
    const lowFrameMs = parseFloat(p99FrameMs.toFixed(2));

    return { avgFps, lowFps, avgFrameMs, lowFrameMs };
  }
}

export class BenchmarkOrchestrator {
  public benchmarkSuite = new BenchmarkSuite();
  public offscreenBenchmark = new OffscreenBenchmarkManager();
  public metricsTrackers: PerformanceMetrics[] = [
    new PerformanceMetrics(), new PerformanceMetrics(), new PerformanceMetrics(),
    new PerformanceMetrics(), new PerformanceMetrics(), new PerformanceMetrics()
  ];
  public accumulator = new WorkerBenchmarkAccumulator();

  private config: any = null;
  private algorithmCount: number = availableAlgorithms.length;
  private _isRunning = false;
  private currentAlgoIndex = 0;
  private elapsedTime = 0;
  private compiledAlgoResults: (CompiledAlgoResult | null)[] = [];
  private latestWorkerTelemetry: TelemetryPayload | null = null;

  private savedViewMode: 'grid' | 'single' = 'grid';
  private savedFocusedIndex = 0;

  private offscreenCanvasEl: HTMLCanvasElement | null = null;
  private isOffscreenInitialized = false;
  private ui: BenchmarkOrchestratorUI | null = null;

  private benchmarkResultsModal: HTMLDivElement | null = null;
  private benchmarkModalBackdrop: HTMLDivElement | null = null;
  private benchmarkModalClose: HTMLButtonElement | null = null;
  private btnCloseBenchmarkModal: HTMLButtonElement | null = null;
  private btnReBenchmark: HTMLButtonElement | null = null;
  private benchmarkChartContainer: HTMLDivElement | null = null;

  public setUI(ui: BenchmarkOrchestratorUI): void {
    this.ui = ui;
    this.initModalDOM();
  }

  public isRunning(): boolean {
    return this._isRunning;
  }

  public getCurrentAlgoIndex(): number {
    return this.currentAlgoIndex;
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public getResults(): (CompiledAlgoResult | null)[] {
    return this.compiledAlgoResults;
  }

  public getLatestWorkerTelemetry(): TelemetryPayload | null {
    return this.latestWorkerTelemetry;
  }

  public recordTelemetrySample(fps: number, maxMathTimeMs: number, maxRenderTimeMs: number): void {
    this.accumulator.recordSample(fps, maxMathTimeMs, maxRenderTimeMs);
  }

  public recordStats(index: number, stats: { renderTime: number; mathTime: number; ruggedness: number }): void {
    const tracker = this.metricsTrackers[index];
    if (tracker) {
      tracker.addRenderTime(stats.renderTime);
      tracker.addMathTime(stats.mathTime);
      tracker.addRuggedness(stats.ruggedness);
    }
  }

  public setBenchmarkMode(mode: BenchmarkMode): void {
    this.offscreenBenchmark.setMode(mode);
  }

  public initModalDOM(): void {
    if (typeof document === 'undefined') return;
    this.benchmarkResultsModal = document.getElementById('benchmark-results-modal') as HTMLDivElement | null;
    this.benchmarkModalBackdrop = document.getElementById('benchmark-modal-backdrop') as HTMLDivElement | null;
    this.benchmarkModalClose = document.getElementById('benchmark-modal-close') as HTMLButtonElement | null;
    this.btnCloseBenchmarkModal = document.getElementById('btn-close-benchmark-modal') as HTMLButtonElement | null;
    this.btnReBenchmark = document.getElementById('btn-re-benchmark') as HTMLButtonElement | null;
    this.benchmarkChartContainer = document.getElementById('benchmark-chart-container') as HTMLDivElement | null;

    this.benchmarkModalClose?.addEventListener('click', () => this.closeBenchmarkResultsModal());
    this.btnCloseBenchmarkModal?.addEventListener('click', () => this.closeBenchmarkResultsModal());
    this.benchmarkModalBackdrop?.addEventListener('click', () => this.closeBenchmarkResultsModal());
    this.btnReBenchmark?.addEventListener('click', () => {
      this.closeBenchmarkResultsModal();
      this.startBenchmarkForCurrentMode();
    });
  }

  public openBenchmarkResultsModal(): void {
    if (!this.benchmarkChartContainer || !this.benchmarkResultsModal) return;

    const algoCategories = ['Lattice', 'Standard', 'Optimal', 'Voronoi', 'Anisotropic', 'Anisotropic'];

    let maxFps = 60;
    const metricsData = availableAlgorithms.map((algo, i) => {
      const m = this.extractAlgorithmMetrics(i);

      if (m.avgFps > maxFps) maxFps = m.avgFps;
      if (m.lowFps > maxFps) maxFps = m.lowFps;

      return {
        name: algo.name,
        badge: algoCategories[i % algoCategories.length] || 'Noise',
        avgFps: m.avgFps,
        lowFps: m.lowFps,
        avgFrameMs: m.avgFrameMs,
        lowFrameMs: m.lowFrameMs,
      };
    });

    const chartRowsHtml = metricsData.map((metricItem) => {
      const avgPct = Math.max(2, Math.min(100, (metricItem.avgFps / maxFps) * 100));
      const lowPct = Math.max(2, Math.min(100, (metricItem.lowFps / maxFps) * 100));

      return `
        <div class="chart-row">
          <div class="chart-algo-header">
            <span class="chart-algo-name">${metricItem.name}</span>
            <span class="chart-algo-badge">${metricItem.badge}</span>
          </div>
          <div class="bar-pair">
            <div class="bar-wrapper">
              <span class="bar-value-label">${metricItem.avgFps} FPS (${metricItem.avgFrameMs}ms)</span>
              <div class="bar-track">
                <div class="bar bar-avg" style="width: ${avgPct}%;"></div>
              </div>
            </div>
            <div class="bar-wrapper">
              <span class="bar-value-label">${metricItem.lowFps} FPS (${metricItem.lowFrameMs}ms)</span>
              <div class="bar-track">
                <div class="bar bar-low" style="width: ${lowPct}%;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.benchmarkChartContainer.innerHTML = chartRowsHtml;
    this.benchmarkResultsModal.classList.remove('hidden');
  }

  public closeBenchmarkResultsModal(): void {
    if (this.benchmarkResultsModal) {
      this.benchmarkResultsModal.classList.add('hidden');
    }
  }

  public ensureOffscreenBenchmarkInitialized(): boolean {
    if (this.isOffscreenInitialized) return true;
    if (!OffscreenBenchmarkManager.isSupported() || !this.ui?.panelBenchStatus) return false;

    this.offscreenCanvasEl = document.createElement('canvas');
    this.offscreenCanvasEl.id = 'offscreen-benchmark-canvas';
    this.offscreenCanvasEl.style.width = '100%';
    this.offscreenCanvasEl.style.height = '140px';
    this.offscreenCanvasEl.style.borderRadius = '6px';
    this.offscreenCanvasEl.style.marginTop = '8px';
    this.ui.panelBenchStatus.appendChild(this.offscreenCanvasEl);

    const activeIdx = this._isRunning
      ? this.currentAlgoIndex
      : (state.focusedIndex >= 0 && state.focusedIndex < availableAlgorithms.length ? state.focusedIndex : 0);
    const algoName = availableAlgorithms[activeIdx].name;
    const selectedMode = (this.ui.selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';

    const success = this.offscreenBenchmark.initialize(
      this.offscreenCanvasEl,
      this.ui.panelBenchStatus,
      algoName,
      state.params,
      state.resolution,
      (telemetry) => {
        this.latestWorkerTelemetry = telemetry;
        if (this._isRunning) {
          this.accumulator.recordSample(telemetry.fps, telemetry.maxMathTimeMs, telemetry.maxRenderTimeMs);
        }
      },
      selectedMode,
      state.canvasFpsCap
    );

    this.isOffscreenInitialized = success;
    return success;
  }

  public extractAlgorithmMetrics(i: number): CompiledAlgoResult {
    const compiled = this.compiledAlgoResults[i];
    if (compiled && compiled.avgFps > 0) {
      return compiled;
    }

    const tracker = this.metricsTrackers[i];
    let avgFps = tracker ? (tracker.getGlobalAverageFPS() || tracker.getFPS()) : 0;
    let lowFps = tracker ? (tracker.getGlobalOnePercentLowFPS() || avgFps) : 0;
    let avgFrameMs = tracker ? (tracker.getGlobalAverageFrameTime() || tracker.getAverageFrameTime()) : 0;
    let lowFrameMs = tracker ? (tracker.getGlobalOnePercentLowFrameTime() || avgFrameMs) : 0;

    const activeFocusedIdx = this._isRunning ? this.currentAlgoIndex : state.focusedIndex;
    if (avgFps === 0 && this.latestWorkerTelemetry && i === activeFocusedIdx) {
      const t = this.latestWorkerTelemetry;
      avgFps = Math.round(t.fps);
      const maxFrameMs = t.maxMathTimeMs + t.maxRenderTimeMs;
      lowFps = maxFrameMs > 0 ? Math.round(1000 / maxFrameMs) : avgFps;
      avgFrameMs = avgFps > 0 ? parseFloat((1000 / avgFps).toFixed(2)) : 0;
      lowFrameMs = maxFrameMs > 0 ? parseFloat(maxFrameMs.toFixed(2)) : avgFrameMs;
    }

    return { avgFps, lowFps, avgFrameMs, lowFrameMs };
  }

  public recordResultsForAlgo(idx: number): void {
    const selectedMode = (this.ui?.selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';
    if (selectedMode === 'vsync') {
      this.compiledAlgoResults[idx] = this.extractAlgorithmMetrics(idx);
    } else {
      const compiled = this.accumulator.getCompiledResult();
      if (compiled.avgFps > 0) {
        this.compiledAlgoResults[idx] = compiled;
      } else {
        this.compiledAlgoResults[idx] = this.extractAlgorithmMetrics(idx);
      }
    }
  }

  public startBenchmarkForAlgo(idx: number): void {
    this.elapsedTime = 0;
    this.latestWorkerTelemetry = null;
    this.accumulator.reset();
    this.metricsTrackers[idx].clear();
    const selectedMode = (this.ui?.selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';

    if (selectedMode === 'vsync') {
      this.ui?.setViewMode('single', idx);
      this.offscreenBenchmark.stop();
      if (this.offscreenCanvasEl) {
        this.offscreenCanvasEl.style.display = 'none';
      }
    } else {
      this.ui?.setViewMode('single', idx);
      const initialized = this.ensureOffscreenBenchmarkInitialized();
      if (initialized) {
        const algoName = availableAlgorithms[idx].name;
        this.offscreenBenchmark.updateParams(algoName, state.resolution, state.params, selectedMode, state.canvasFpsCap);
        this.offscreenBenchmark.setMode(selectedMode);
        this.offscreenBenchmark.start();

        if (this.offscreenCanvasEl) {
          this.offscreenCanvasEl.style.display = selectedMode === 'offscreen' ? 'block' : 'none';
        }
      }
    }

    this.benchmarkSuite.start();

    if (this.ui?.btnBenchmark) {
      this.ui.btnBenchmark.textContent = 'Stop Benchmark';
      this.ui.btnBenchmark.classList.remove('btn-primary');
      this.ui.btnBenchmark.classList.add('btn-secondary');
    }
    this.ui?.panelBenchStatus?.classList.remove('hidden');
  }

  public stopBenchmarkAndShowModal(): void {
    if (this._isRunning && this.currentAlgoIndex < this.algorithmCount) {
      this.recordResultsForAlgo(this.currentAlgoIndex);
      this.config?.onAlgoComplete?.(this.currentAlgoIndex, this.compiledAlgoResults[this.currentAlgoIndex]!);
    }
    this._isRunning = false;
    this.benchmarkSuite.stop();
    this.offscreenBenchmark.stop();
    if (this.offscreenCanvasEl) {
      this.offscreenCanvasEl.style.display = 'none';
    }
    if (this.ui?.btnBenchmark) {
      this.ui.btnBenchmark.textContent = 'Start Auto-Benchmark';
      this.ui.btnBenchmark.classList.remove('btn-secondary');
      this.ui.btnBenchmark.classList.add('btn-primary');
    }
    this.ui?.panelBenchStatus?.classList.add('hidden');
    if (this.ui?.valBenchState) this.ui.valBenchState.textContent = 'Inactive';

    state.viewMode = this.savedViewMode;
    state.focusedIndex = this.savedFocusedIndex;
    this.ui?.setViewMode(this.savedViewMode, this.savedFocusedIndex);
    this.openBenchmarkResultsModal();
    this.config?.onComplete?.();
  }

  public startBenchmarkForCurrentMode(): void {
    if (this._isRunning) {
      this.stopBenchmarkAndShowModal();
      return;
    }
    this.savedViewMode = state.viewMode;
    this.savedFocusedIndex = state.focusedIndex;
    this.compiledAlgoResults = new Array(availableAlgorithms.length).fill(null);
    this.currentAlgoIndex = 0;
    this._isRunning = true;
    this.startBenchmarkForAlgo(0);
  }

  public toggleBenchmarkMode(): void {
    if (this._isRunning || this.benchmarkSuite.isActive() || this.offscreenBenchmark.getIsRunning()) {
      this.stopBenchmarkAndShowModal();
    } else {
      this.closeBenchmarkResultsModal();
      this.startBenchmarkForCurrentMode();
    }
  }

  public tick(dt: number): void {
    if (!this._isRunning) return;

    this.elapsedTime += dt;
    const targetBenchSec = this.config?.getResolvedDuration ? this.config.getResolvedDuration() : getResolvedBenchmarkDuration();
    const currentAlgoName = availableAlgorithms[this.currentAlgoIndex]?.name || 'Algorithm';

    if (this.ui?.valBenchState) {
      this.ui.valBenchState.textContent = `Benchmarking (${this.currentAlgoIndex + 1}/${this.algorithmCount}): ${currentAlgoName}... ${this.elapsedTime.toFixed(1)}s / ${targetBenchSec.toFixed(1)}s`;
    }

    if (this.elapsedTime >= targetBenchSec) {
      this.recordResultsForAlgo(this.currentAlgoIndex);
      this.config?.onAlgoComplete?.(this.currentAlgoIndex, this.compiledAlgoResults[this.currentAlgoIndex]!);

      this.currentAlgoIndex++;
      if (this.currentAlgoIndex < this.algorithmCount) {
        this.config?.onAlgoAdvance?.(this.currentAlgoIndex);
        this.startBenchmarkForAlgo(this.currentAlgoIndex);
      } else {
        this.stopBenchmarkAndShowModal();
      }
    }
  }

  // Backwards compatibility methods for unit tests
  public start(config?: any): void {
    this.config = config || null;
    this.algorithmCount = config?.algorithmCount || availableAlgorithms.length;
    this.compiledAlgoResults = new Array(this.algorithmCount).fill(null);
    this.currentAlgoIndex = 0;
    this.elapsedTime = 0;
    this._isRunning = true;
    this.accumulator.reset();
  }

  public stop(): void {
    this.stopBenchmarkAndShowModal();
  }
}
