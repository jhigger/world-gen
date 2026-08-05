/**
 * AnimationLoop — deep module that encapsulates the requestAnimationFrame
 * render loop, math tick throttling, Canvas Visual Cap, DOM Metric Throttling,
 * camera keyboard movement, auto-orbit driving, and erosion driving.
 *
 * Pure timing functions are re-exported for testing and direct consumption
 * by other modules (decoupled-capping.test.ts).
 *
 * @see ADR-0003 Decoupled Canvas Visual Capping and Metric Throttling
 */

import type { ViewportManager } from './viewport-manager';
import type { BenchmarkOrchestrator } from './benchmark-orchestrator';
import type { UIManager } from './ui-manager';
import type { TerrainPipeline } from './pipeline';
import { availableAlgorithms as defaultAlgorithms } from './algorithms';
import { getResolvedBenchmarkDuration, getResolvedErosionDuration } from './state';

// ---------------------------------------------------------------------------
// Pure timing functions (originally exported from main.ts)
// ---------------------------------------------------------------------------

export function isIntervalElapsed(intervalMs: number, now: number, lastTime: number): boolean {
  return (now - lastTime) >= intervalMs;
}

export function getResolvedFps(fpsLimit: string, customFps: number): number {
  if (fpsLimit === 'uncapped') return 0;
  const parsedFps = fpsLimit === 'custom' ? customFps : parseInt(fpsLimit, 10);
  return isNaN(parsedFps) || parsedFps <= 0 ? 60 : parsedFps;
}

export function shouldExecuteMathTick(fpsLimit: string, customFps: number, now: number, lastMathTime: number): boolean {
  const fps = getResolvedFps(fpsLimit, customFps);
  if (fps === 0) return true;
  return isIntervalElapsed(1000 / fps, now, lastMathTime);
}

export function shouldRenderCanvasFrame(canvasFpsCap: number, now: number, lastRenderTime: number): boolean {
  const fps = canvasFpsCap || 60;
  return isIntervalElapsed(1000 / fps, now, lastRenderTime);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnimationLoopDeps {
  state: any;
  viewportManager: ViewportManager;
  orchestrator: BenchmarkOrchestrator;
  uiManager: UIManager;
  pipelines: TerrainPipeline[];
  availableAlgorithms?: any[];
}

// ---------------------------------------------------------------------------
// AnimationLoop
// ---------------------------------------------------------------------------

const DOM_METRIC_THROTTLE_MS = 100;

function updateCardMetricPair(curEl: HTMLElement | null, avgEl: HTMLElement | null, curVal: number | string, avgVal?: number | string, decimals = 2): void {
  const formatVal = (v: number | string) => typeof v === 'number'
    ? (v > 0 ? (decimals === 0 ? Math.round(v).toString() : v.toFixed(decimals)) : '--')
    : v;
  if (curEl) {
    const s = formatVal(curVal);
    if (curEl.textContent !== s) curEl.textContent = s;
  }
  if (avgEl) {
    const s = formatVal(avgVal !== undefined ? avgVal : curVal);
    if (avgEl.textContent !== s) avgEl.textContent = s;
  }
}

export class AnimationLoop {
  private rafId: number | null = null;
  private deps: AnimationLoopDeps | null = null;
  private lastTime = 0;
  private lastRenderTime = 0;
  private lastMathTime = 0;
  private lastDomMetricUpdate = 0;
  private _isRunning = false;

  isRunning(): boolean {
    return this._isRunning;
  }

  start(deps: AnimationLoopDeps): void {
    if (this._isRunning) return;
    this.deps = deps;
    this.lastTime = performance.now();
    this.lastRenderTime = performance.now();
    this.lastMathTime = performance.now();
    this.lastDomMetricUpdate = 0;
    this._isRunning = true;
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this._isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.deps = null;
  }

  private loop(_timestamp: number): void {
    if (!this._isRunning || !this.deps) return;

    const { state, viewportManager, orchestrator, uiManager, pipelines } = this.deps;
    const availableAlgorithms = this.deps.availableAlgorithms || defaultAlgorithms;

    const benchmarkSuite = orchestrator.benchmarkSuite;
    const offscreenBenchmark = orchestrator.offscreenBenchmark;
    const metricsTrackers = orchestrator.metricsTrackers;

    const now = performance.now();

    // 1. Math Calculation Throttling (Unthrottled when state.fpsLimit === 'uncapped')
    if (!shouldExecuteMathTick(state.fpsLimit, state.customFps, now, this.lastMathTime)) {
      this.rafId = requestAnimationFrame((t) => this.loop(t));
      return;
    }
    const mathFps = getResolvedFps(state.fpsLimit, state.customFps);
    const mathInterval = mathFps > 0 ? 1000 / mathFps : 0;
    this.lastMathTime = mathFps === 0 ? now : now - ((now - this.lastMathTime) % mathInterval);

    // 2. WebGL Canvas Visual Presentation Capping (Rate-limited to state.canvasFpsCap)
    const isCanvasRenderDue = shouldRenderCanvasFrame(state.canvasFpsCap, now, this.lastRenderTime);
    const targetCanvasFps = state.canvasFpsCap || 60;
    const canvasInterval = 1000 / targetCanvasFps;
    if (isCanvasRenderDue) {
      this.lastRenderTime = now - ((now - this.lastRenderTime) % canvasInterval);
    }

    const shouldUpdateDomMetrics = now - this.lastDomMetricUpdate >= DOM_METRIC_THROTTLE_MS;

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (dt > 0.1) dt = 0.1;

    // Apply camera vertical height translation from held keys (Space / Shift)
    if ((state.keysPressed.space || state.keysPressed.shift) && !benchmarkSuite.isActive()) {
      viewportManager.navigateVerticalCamera(state.keysPressed, dt);
      state.cameraOffsetY = viewportManager.cameraState.offsetY;
    }

    // Apply camera horizontal translation (travel) from held arrow keys
    if ((state.keysPressed.arrowUp || state.keysPressed.arrowDown || state.keysPressed.arrowLeft || state.keysPressed.arrowRight) && !benchmarkSuite.isActive()) {
      viewportManager.navigateCamera(state.keysPressed, dt);
      state.cameraOffsetX = viewportManager.cameraState.offsetX;
      state.cameraOffsetZ = viewportManager.cameraState.offsetZ;
    }

    // 1. Apply camera orbit rotation
    if (state.autoOrbit && !benchmarkSuite.isActive()) {
      viewportManager.autoRotate(dt, state.rotateSpeed);
    }

    // 2. Drive benchmark automated path
    if (orchestrator.isRunning() || benchmarkSuite.isActive() || offscreenBenchmark.getIsRunning()) {
      if (benchmarkSuite.isActive()) {
        const cameras = viewportManager.getCameras();
        const controls = viewportManager.getControls();
        benchmarkSuite.update(dt, cameras, controls);
      }
      orchestrator.tick(dt);

      const currentAlgoName = availableAlgorithms[orchestrator.getCurrentAlgoIndex()]?.name || 'Algorithm';
      const targetBenchSec = getResolvedBenchmarkDuration();
      if (uiManager.valBenchState) {
        uiManager.valBenchState.textContent = `Benchmarking (${orchestrator.getCurrentAlgoIndex() + 1}/${availableAlgorithms.length}): ${currentAlgoName}... ${orchestrator.getElapsedTime().toFixed(1)}s / ${targetBenchSec.toFixed(1)}s`;
      }
    }

    // 3. Drive continuous wave motion when erosion is inactive AND there is no paused eroded state
    const hasCachedHeightmap = state.heightmapCache.some((cache: number[][] | null) => cache !== null);
    if (!state.isErosionActive && !hasCachedHeightmap && !benchmarkSuite.isActive() && state.noiseSpeed !== 0) {
      state.animationTime += dt * 0.55 * state.noiseSpeed;
      state.params.offsetX = state.animationTime * 1.8;
      state.params.offsetY = state.animationTime * 1.2;
    } else if (state.params.offsetX !== 0 || state.params.offsetY !== 0) {
      state.animationTime = 0;
      state.params.offsetX = 0;
      state.params.offsetY = 0;
    }

    // 4. Evaluate physical erosion
    const activeRes = state.resolution;
    if (state.isErosionActive) {
      state._erosionElapsedTime = (state._erosionElapsedTime || 0) + dt;
      if (uiManager.erosionStatusBadge) uiManager.erosionStatusBadge.classList.remove('hidden');

      const targetSec = getResolvedErosionDuration();
      if (targetSec === 'infinite') {
        if (uiManager.lblErosionProgress) uiManager.lblErosionProgress.textContent = `Eroding... ${state._erosionElapsedTime.toFixed(1)}s (Infinite)`;
      } else {
        if (uiManager.lblErosionProgress) uiManager.lblErosionProgress.textContent = `Eroding... ${state._erosionElapsedTime.toFixed(1)}s / ${targetSec.toFixed(1)}s`;
        if (state._erosionElapsedTime >= targetSec) {
          state.isErosionActive = false;
          uiManager.syncErosionButtonUI();
          if (uiManager.lblErosionProgress) uiManager.lblErosionProgress.textContent = `Finished at ${targetSec.toFixed(1)}s`;
        }
      }

      pipelines.forEach((p, i) => {
        if (!viewportManager.getRenderer(i)) return;
        if (!state.heightmapCache[i]) {
          state.heightmapCache[i] = p.generateBase(activeRes, activeRes, state.params);
        }
        p.tickPhysics(state.heightmapCache[i]!, dt);
      });
    }

    // 5. Draw active viewports
    let totalBenchmarkFps = 0;
    let totalBenchmarkFrametime = 0;
    let totalBenchmarkTime = 0;
    let totalBenchmarkMathTime = 0;
    let activeCount = 0;

    const isOffscreenCanvasActive = offscreenBenchmark.getIsRunning() && offscreenBenchmark.getCurrentMode() === 'offscreen';
    const statsMap = (!isCanvasRenderDue || isOffscreenCanvasActive)
      ? {}
      : viewportManager.update(state.params, activeRes, state.activePalette, state.showWireframe, state.heightmapCache, state.isErosionActive);

    const telemetry = orchestrator.getLatestWorkerTelemetry();

    for (let i = 0; i < availableAlgorithms.length; i++) {
      const r = viewportManager.getRenderer(i);
      if (!r || !metricsTrackers[i]) continue;
      const activeFocusedIdx = orchestrator.isRunning() ? orchestrator.getCurrentAlgoIndex() : state.focusedIndex;
      const shouldRender = (state.viewMode === 'grid') || (state.viewMode === 'single' && i === activeFocusedIdx);

      if (shouldRender) {
        metricsTrackers[i].tick();
        const stats = statsMap[i] || undefined;

        if (stats) {
          metricsTrackers[i].addRenderTime(stats.renderTime);
          metricsTrackers[i].addMathTime(stats.mathTime);
          metricsTrackers[i].addRuggedness(stats.ruggedness);
        }

        const els = uiManager.getCachedMetricElements(i);

        const currentFps = metricsTrackers[i].getFPS();
        const currentFrametime = metricsTrackers[i].getAverageFrameTime();
        const currentMathTime = metricsTrackers[i].getAverageMathTime();
        const currentRenderTime = metricsTrackers[i].getAverageRenderTime();

        const avgFps = metricsTrackers[i].getGlobalAverageFPS();
        const avgFrametime = metricsTrackers[i].getGlobalAverageFrameTime();
        const avgMathTime = metricsTrackers[i].getGlobalAverageMathTime();
        const avgRenderTime = metricsTrackers[i].getGlobalAverageRenderTime();
        const avgRuggedness = metricsTrackers[i].getGlobalAverageRuggedness();

        if (els && shouldUpdateDomMetrics) {
          const focusedIdx = activeFocusedIdx >= 0 && activeFocusedIdx < availableAlgorithms.length ? activeFocusedIdx : 0;
          if (offscreenBenchmark.getIsRunning() && i === focusedIdx && telemetry) {
            const t = telemetry;
            const frameMs = t.fps > 0 ? 1000 / t.fps : 0;
            const renderMs = t.mode === 'headless' ? '0.00' : t.avgRenderTimeMs;

            updateCardMetricPair(els.fps, els.fpsAvg, t.fps, t.fps, 0);
            updateCardMetricPair(els.frametime, els.frametimeAvg, frameMs, frameMs, 2);
            updateCardMetricPair(els.time, els.timeAvg, renderMs, renderMs, 2);
            updateCardMetricPair(els.math, els.mathAvg, t.avgMathTimeMs, t.avgMathTimeMs, 2);
            if (stats) updateCardMetricPair(els.ruggedness, els.ruggednessAvg, stats.ruggedness, stats.ruggedness, 2);
          } else {
            updateCardMetricPair(els.fps, els.fpsAvg, currentFps, avgFps, 0);
            updateCardMetricPair(els.frametime, els.frametimeAvg, currentFrametime, avgFrametime, 2);
            updateCardMetricPair(els.time, els.timeAvg, currentRenderTime, avgRenderTime, 2);
            updateCardMetricPair(els.math, els.mathAvg, currentMathTime, avgMathTime, 2);
            if (stats) updateCardMetricPair(els.ruggedness, els.ruggednessAvg, stats ? stats.ruggedness : '--', avgRuggedness, 2);
          }
        }

        totalBenchmarkFps += currentFps;
        totalBenchmarkFrametime += currentFrametime;
        totalBenchmarkTime += currentRenderTime;
        totalBenchmarkMathTime += currentMathTime;
        activeCount++;
      }
    }

    // 6. Display aggregated benchmark summaries (throttled to 100ms / 10 Hz)
    if (shouldUpdateDomMetrics && (benchmarkSuite.isActive() || orchestrator.isRunning())) {
      if (offscreenBenchmark.getIsRunning() && telemetry) {
        const t = telemetry;
        const fpsStr = `${t.fps} FPS`;
        if (uiManager.valBenchFps && uiManager.valBenchFps.textContent !== fpsStr) uiManager.valBenchFps.textContent = fpsStr;

        const ftStr = `${t.fps > 0 ? (1000 / t.fps).toFixed(2) : '0.00'} ms`;
        if (uiManager.valBenchFrametime && uiManager.valBenchFrametime.textContent !== ftStr) uiManager.valBenchFrametime.textContent = ftStr;

        const mathStr = `${t.avgMathTimeMs} ms (min: ${t.minMathTimeMs}ms, max: ${t.maxMathTimeMs}ms)`;
        if (uiManager.valBenchMathTime && uiManager.valBenchMathTime.textContent !== mathStr) uiManager.valBenchMathTime.textContent = mathStr;

        const gpuStr = t.mode === 'headless' ? 'N/A (Headless Math)' : `${t.avgRenderTimeMs} ms (min: ${t.minRenderTimeMs}ms, max: ${t.maxRenderTimeMs}ms)`;
        if (uiManager.valBenchGpuTime && uiManager.valBenchGpuTime.textContent !== gpuStr) uiManager.valBenchGpuTime.textContent = gpuStr;

        const framesStr = `${t.totalFrames.toLocaleString()} iterations`;
        if (uiManager.valBenchTotalFrames && uiManager.valBenchTotalFrames.textContent !== framesStr) uiManager.valBenchTotalFrames.textContent = framesStr;
      } else if (activeCount > 0) {
        const avgFps = Math.round(totalBenchmarkFps / activeCount);
        const avgFrametime = (totalBenchmarkFrametime / activeCount).toFixed(2);
        const avgTime = (totalBenchmarkTime / activeCount).toFixed(2);
        const avgMath = (totalBenchmarkMathTime / activeCount).toFixed(2);

        if (uiManager.valBenchFps) uiManager.valBenchFps.textContent = `${avgFps} FPS`;
        if (uiManager.valBenchFrametime) uiManager.valBenchFrametime.textContent = `${avgFrametime} ms`;
        if (uiManager.valBenchGpuTime) uiManager.valBenchGpuTime.textContent = `${avgTime} ms`;
        if (uiManager.valBenchMathTime) uiManager.valBenchMathTime.textContent = `${avgMath} ms`;
        if (uiManager.valBenchTotalFrames) uiManager.valBenchTotalFrames.textContent = `VSync Loop`;
      }
    }

    if (shouldUpdateDomMetrics) {
      this.lastDomMetricUpdate = now;
    }

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }
}
