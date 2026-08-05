/**
 * UIManager — deep module that handles all DOM element retrieval, UI event binding,
 * DOM ↔ State Observable synchronization, tooltips, mobile sheet/modals, and benchmark modal rendering.
 *
 * @see CONTEXT.md "UIManager: A thin adapter that binds DOM inputs to the State Observable without knowing about 3D rendering or physics"
 * @see ADR-0001 Mobile UI/UX Architecture
 */

import { state, resetStateToDefaults, getResolvedBenchmarkDuration, getResolvedErosionDuration } from './state';
import { ObservableState } from './observable-state';
import { saveConfig } from './storage';
import { availableAlgorithms } from './algorithms';
import type { ViewportManager } from './viewport-manager';
import type { BenchmarkMode } from './worker';

const getDomElement = <T extends HTMLElement>(id: string): T | null =>
  typeof document !== 'undefined' ? (document.getElementById(id) as T) : null;

function clampAndRound(val: number, min: number, max: number, dec: number): number {
  const mult = Math.pow(10, dec);
  return Math.round(Math.max(min, Math.min(max, val)) * mult) / mult;
}

export interface UIManagerCallbacks {
  onToggleBenchmark?: () => void;
  onStartBenchmarkForCurrentMode?: () => void;
  onCloseBenchmarkResultsModal?: () => void;
  onBenchmarkModeChange?: (mode: BenchmarkMode) => void;
  onClearCaches?: () => void;
  onResetMetrics?: () => void;
  getSphericalCameraSnapshot?: () => { zoom: number; pitch: number; yaw: number; offsetX: number; offsetY: number; offsetZ: number } | undefined;
}

export interface MetricCardElements {
  fps: HTMLSpanElement | null;
  frametime: HTMLSpanElement | null;
  time: HTMLSpanElement | null;
  math: HTMLSpanElement | null;
  ruggedness: HTMLSpanElement | null;
  fpsAvg: HTMLSpanElement | null;
  frametimeAvg: HTMLSpanElement | null;
  timeAvg: HTMLSpanElement | null;
  mathAvg: HTMLSpanElement | null;
  ruggednessAvg: HTMLSpanElement | null;
}

export class UIManager {
  private erosionElapsedTime = 0;
  private callbacks: UIManagerCallbacks | null = null;
  private viewportManager: ViewportManager | null = null;
  private cachedMetricElements: Record<number, MetricCardElements> = {};
  private debouncedStorageTimer: ReturnType<typeof setTimeout> | null = null;

  // Cached DOM elements
  public gridContainer = getDomElement<HTMLDivElement>('terrain-grid');
  public btnGridView = getDomElement<HTMLButtonElement>('btn-grid-view');
  public selectSingleAlgo = getDomElement<HTMLSelectElement>('select-single-algo');

  public paramSeed = getDomElement<HTMLInputElement>('param-seed');
  public paramResolution = getDomElement<HTMLInputElement>('param-resolution');
  public paramZoom = getDomElement<HTMLInputElement>('param-zoom');
  public paramPitch = getDomElement<HTMLInputElement>('param-pitch');
  public paramTargetX = getDomElement<HTMLInputElement>('param-target-x');
  public paramTargetY = getDomElement<HTMLInputElement>('param-target-y');
  public paramTargetZ = getDomElement<HTMLInputElement>('param-target-z');
  public paramHeight = getDomElement<HTMLInputElement>('param-height');
  public paramWidth = getDomElement<HTMLInputElement>('param-width');
  public paramScale = getDomElement<HTMLInputElement>('param-scale');
  public paramOctaves = getDomElement<HTMLInputElement>('param-octaves');
  public paramPersistence = getDomElement<HTMLInputElement>('param-persistence');
  public paramColor = getDomElement<HTMLSelectElement>('param-color');

  public paramRotateSpeed = getDomElement<HTMLInputElement>('param-rotate-speed');
  public paramNoiseSpeed = getDomElement<HTMLInputElement>('param-noise-speed');
  public paramFpsLimit = getDomElement<HTMLSelectElement>('param-fps-limit');
  public customFpsContainer = getDomElement<HTMLDivElement>('custom-fps-container');
  public paramCustomFps = getDomElement<HTMLInputElement>('param-custom-fps');
  public paramUiScale = getDomElement<HTMLInputElement>('param-ui-scale');

  public valSeed = getDomElement<HTMLSpanElement>('val-seed');
  public valResolution = getDomElement<HTMLInputElement>('val-resolution');
  public valZoom = getDomElement<HTMLInputElement>('val-zoom');
  public valPitch = getDomElement<HTMLInputElement>('val-pitch');
  public valTargetX = getDomElement<HTMLInputElement>('val-target-x');
  public valTargetY = getDomElement<HTMLInputElement>('val-target-y');
  public valTargetZ = getDomElement<HTMLInputElement>('val-target-z');
  public valHeight = getDomElement<HTMLInputElement>('val-height');
  public valWidth = getDomElement<HTMLInputElement>('val-width');
  public valScale = getDomElement<HTMLInputElement>('val-scale');
  public valOctaves = getDomElement<HTMLInputElement>('val-octaves');
  public valPersistence = getDomElement<HTMLInputElement>('val-persistence');

  public valRotateSpeed = getDomElement<HTMLInputElement>('val-rotate-speed');
  public valNoiseSpeed = getDomElement<HTMLInputElement>('val-noise-speed');
  public valFpsLimit = getDomElement<HTMLSpanElement>('val-fps-limit');
  public valCustomFps = getDomElement<HTMLInputElement>('val-custom-fps');
  public valUiScale = getDomElement<HTMLInputElement>('val-ui-scale');

  public selectErosionDuration = getDomElement<HTMLSelectElement>('select-erosion-duration');
  public valErosionDuration = getDomElement<HTMLSpanElement>('val-erosion-duration');
  public customErosionDurationContainer = getDomElement<HTMLDivElement>('custom-erosion-duration-container');
  public paramCustomErosionDuration = getDomElement<HTMLInputElement>('param-custom-erosion-duration');
  public valCustomErosionDuration = getDomElement<HTMLInputElement>('val-custom-erosion-duration');
  public erosionStatusBadge = getDomElement<HTMLDivElement>('erosion-status-badge');
  public lblErosionProgress = getDomElement<HTMLSpanElement>('lbl-erosion-progress');

  public toggleErosion = getDomElement<HTMLButtonElement>('toggle-erosion');
  public lblErosion = getDomElement<HTMLElement>('lbl-erosion');
  public iconErosionPlay = getDomElement<HTMLElement>('icon-erosion-play');
  public iconErosionPause = getDomElement<HTMLElement>('icon-erosion-pause');
  public toggleWireframe = getDomElement<HTMLInputElement>('toggle-wireframe');
  public toggleMetrics = getDomElement<HTMLInputElement>('toggle-metrics');
  public btnResetErosion = getDomElement<HTMLButtonElement>('btn-reset-erosion');

  public selectBenchmarkDuration = getDomElement<HTMLSelectElement>('select-benchmark-duration');
  public valBenchmarkDuration = getDomElement<HTMLSpanElement>('val-benchmark-duration');
  public customBenchmarkDurationContainer = getDomElement<HTMLDivElement>('custom-benchmark-duration-container');
  public paramCustomBenchmarkDuration = getDomElement<HTMLInputElement>('param-custom-benchmark-duration');
  public valCustomBenchmarkDuration = getDomElement<HTMLInputElement>('val-custom-benchmark-duration');
  public selectBenchmarkMode = getDomElement<HTMLSelectElement>('select-benchmark-mode');
  public valBenchmarkMode = getDomElement<HTMLSpanElement>('val-benchmark-mode');

  public btnBenchmark = getDomElement<HTMLButtonElement>('btn-benchmark');
  public btnResetDefaults = getDomElement<HTMLButtonElement>('btn-reset-defaults');
  public panelBenchStatus = getDomElement<HTMLDivElement>('benchmark-status');
  public valBenchState = getDomElement<HTMLSpanElement>('bench-state');
  public valBenchFps = getDomElement<HTMLSpanElement>('bench-fps');
  public valBenchFrametime = getDomElement<HTMLSpanElement>('bench-frametime');
  public valBenchMathTime = getDomElement<HTMLSpanElement>('bench-math-time');
  public valBenchGpuTime = getDomElement<HTMLSpanElement>('bench-gpu-time');
  public valBenchTotalFrames = getDomElement<HTMLSpanElement>('bench-total-frames');

  getErosionElapsedTime(): number {
    return state._erosionElapsedTime || 0;
  }

  setErosionElapsedTime(time: number): void {
    state._erosionElapsedTime = time;
    this.erosionElapsedTime = time;
  }

  init(
    stateObs: ObservableState<typeof state>,
    viewportManager?: ViewportManager,
    callbacks?: UIManagerCallbacks
  ): void {
    this.viewportManager = viewportManager || null;
    this.callbacks = callbacks || null;

    stateObs.subscribe((path) => {
      this.updateUIStrings();
      this.updateStorage();

      if (path === 'viewMode' || path === 'focusedIndex') {
        const { viewMode, focusedIndex } = stateObs.data;
        this.viewportManager?.setGridMode(viewMode, focusedIndex);
        this.handleGridModeChange(viewMode, focusedIndex);
      }

      if (path === 'showMetrics') {
        this.applyShowMetricsState();
      }

      if (['savedZoom', 'savedYaw', 'savedPitch', 'cameraOffsetX', 'cameraOffsetY', 'cameraOffsetZ'].includes(path)) {
        this.viewportManager?.applySavedCameraState({
          zoom: stateObs.data.savedZoom,
          yaw: stateObs.data.savedYaw,
          pitch: stateObs.data.savedPitch,
          offsetX: stateObs.data.cameraOffsetX,
          offsetY: stateObs.data.cameraOffsetY,
          offsetZ: stateObs.data.cameraOffsetZ,
        });
      }

      const configPaths = [
        'resolution',
        'activePalette',
        'params.seed',
        'params.scale',
        'params.octaves',
        'params.persistence',
        'params.heightScale',
        'params.widthScale',
      ];
      if (configPaths.includes(path)) {
        this.callbacks?.onClearCaches?.();
        this.callbacks?.onResetMetrics?.();
      }
    });

    this.setupUIEvents();
    this.setupHotkeys();
    this.setupTooltips();
    this.setupMobileUI();
    this.setupMathAnalysisToggle();
  }

  public getCachedMetricElements(index: number): MetricCardElements | null {
    if (!this.cachedMetricElements[index] && typeof document !== 'undefined') {
      this.cachedMetricElements[index] = {
        fps: document.getElementById(`fps-${index}`),
        frametime: document.getElementById(`frametime-${index}`),
        time: document.getElementById(`time-${index}`),
        math: document.getElementById(`math-${index}`),
        ruggedness: document.getElementById(`ruggedness-${index}`),
        fpsAvg: document.getElementById(`fps-avg-${index}`),
        frametimeAvg: document.getElementById(`frametime-avg-${index}`),
        timeAvg: document.getElementById(`time-avg-${index}`),
        mathAvg: document.getElementById(`math-avg-${index}`),
        ruggednessAvg: document.getElementById(`ruggedness-avg-${index}`)
      };
    }
    return this.cachedMetricElements[index] || null;
  }

  public handleGridModeChange(mode: 'grid' | 'single', index: number): void {
    if (this.selectSingleAlgo) {
      this.selectSingleAlgo.value = mode === 'single' ? index.toString() : '-1';
    }
    const mainContent = typeof document !== 'undefined' ? document.querySelector('.main-content') : null;
    if (mainContent) {
      if (mode === 'single') {
        mainContent.classList.add('single-view-active');
      } else {
        mainContent.classList.remove('single-view-active');
      }
    }
    const mobileAlgoTabs = typeof document !== 'undefined' ? document.querySelectorAll('.mobile-tab-btn') : [];
    mobileAlgoTabs.forEach((btn) => {
      const idxAttr = btn.getAttribute('data-index');
      if (idxAttr !== null) {
        const i = parseInt(idxAttr, 10);
        if (mode === 'single' && i === index) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  public updateStorage(immediate: boolean = false): void {
    if (immediate) {
      if (this.debouncedStorageTimer) {
        clearTimeout(this.debouncedStorageTimer);
        this.debouncedStorageTimer = null;
      }
      const snap = this.viewportManager?.getSphericalCameraSnapshot() || this.callbacks?.getSphericalCameraSnapshot?.();
      saveConfig(snap);
      return;
    }

    if (this.debouncedStorageTimer) {
      clearTimeout(this.debouncedStorageTimer);
    }
    this.debouncedStorageTimer = setTimeout(() => {
      this.debouncedStorageTimer = null;
      const snap = this.viewportManager?.getSphericalCameraSnapshot() || this.callbacks?.getSphericalCameraSnapshot?.();
      saveConfig(snap);
    }, 300);
  }

  public updateUIStrings(): void {
    if (this.valSeed) this.valSeed.textContent = state.params.seed.toString();
    if (this.valResolution) this.valResolution.value = state.resolution.toString();
    if (this.valZoom) this.valZoom.value = state.savedZoom.toString();
    if (this.valPitch) this.valPitch.value = state.savedPitch.toString();
    if (this.valTargetX) this.valTargetX.value = state.cameraOffsetX.toString();
    if (this.valTargetY) this.valTargetY.value = state.cameraOffsetY.toString();
    if (this.valTargetZ) this.valTargetZ.value = state.cameraOffsetZ.toString();
    if (this.valHeight) this.valHeight.value = state.params.heightScale.toString();
    if (this.valWidth) this.valWidth.value = state.params.widthScale.toString();
    if (this.valScale) this.valScale.value = state.params.scale.toString();
    if (this.valOctaves) this.valOctaves.value = state.params.octaves.toString();
    if (this.valPersistence) this.valPersistence.value = state.params.persistence.toString();
    if (this.valRotateSpeed) this.valRotateSpeed.value = state.rotateSpeed.toString();
    if (this.valNoiseSpeed) this.valNoiseSpeed.value = state.noiseSpeed.toString();
    if (this.valFpsLimit) this.valFpsLimit.textContent = state.fpsLimit;
    if (this.valCustomFps) this.valCustomFps.value = state.customFps.toString();
    if (this.valUiScale) this.valUiScale.value = state.uiScale.toString();

    this.syncErosionButtonUI();
  }

  public applyUiScale(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--ui-scale', (state.uiScale / 100).toString());
    }
  }

  public applyShowMetricsState(): void {
    if (this.toggleMetrics) {
      this.toggleMetrics.checked = state.showMetrics;
    }

    const mobileToggle = document.getElementById('mobile-toggle-metrics');
    if (mobileToggle) {
      if (state.showMetrics) {
        mobileToggle.classList.remove('metrics-off');
        mobileToggle.textContent = '📊 Stats';
      } else {
        mobileToggle.classList.add('metrics-off');
        mobileToggle.textContent = '📊 Hidden';
      }
    }

    if (this.gridContainer) {
      if (state.showMetrics) {
        this.gridContainer.classList.remove('metrics-hidden');
      } else {
        this.gridContainer.classList.add('metrics-hidden');
      }
    }
  }

  public syncErosionButtonUI(): void {
    if (!this.toggleErosion) return;
    if (state.isErosionActive) {
      if (this.lblErosion) this.lblErosion.textContent = 'Pause Erosion';
      if (this.iconErosionPlay) this.iconErosionPlay.style.display = 'none';
      if (this.iconErosionPause) this.iconErosionPause.style.display = 'block';
    } else {
      const targetSec = getResolvedErosionDuration();
      const isFinished = targetSec !== 'infinite' && this.getErosionElapsedTime() >= targetSec;
      const isPaused = this.getErosionElapsedTime() > 0 && !isFinished;
      if (this.lblErosion) this.lblErosion.textContent = isPaused ? 'Resume Erosion' : 'Start Erosion';
      if (this.iconErosionPlay) this.iconErosionPlay.style.display = 'block';
      if (this.iconErosionPause) this.iconErosionPause.style.display = 'none';
    }
  }

  public syncDOMToState(): void {
    if (this.paramSeed) this.paramSeed.value = state.params.seed.toString();
    if (this.paramResolution) this.paramResolution.value = state.resolution.toString();
    if (this.paramZoom) this.paramZoom.value = state.savedZoom.toString();
    if (this.paramPitch) this.paramPitch.value = state.savedPitch.toString();
    if (this.paramTargetX) this.paramTargetX.value = state.cameraOffsetX.toString();
    if (this.paramTargetY) this.paramTargetY.value = state.cameraOffsetY.toString();
    if (this.paramTargetZ) this.paramTargetZ.value = state.cameraOffsetZ.toString();
    if (this.paramHeight) this.paramHeight.value = state.params.heightScale.toString();
    if (this.paramWidth) this.paramWidth.value = state.params.widthScale.toString();
    if (this.paramScale) this.paramScale.value = state.params.scale.toString();
    if (this.paramOctaves) this.paramOctaves.value = state.params.octaves.toString();
    if (this.paramPersistence) this.paramPersistence.value = state.params.persistence.toString();
    if (this.paramColor) this.paramColor.value = state.activePalette;

    this.syncErosionButtonUI();

    if (this.toggleWireframe) this.toggleWireframe.checked = state.showWireframe;
    this.applyShowMetricsState();

    if (this.paramRotateSpeed) this.paramRotateSpeed.value = state.rotateSpeed.toString();
    if (this.paramNoiseSpeed) this.paramNoiseSpeed.value = state.noiseSpeed.toString();
    if (this.paramFpsLimit) this.paramFpsLimit.value = state.fpsLimit;
    if (this.paramCustomFps) this.paramCustomFps.value = state.customFps.toString();
    if (this.valCustomFps) this.valCustomFps.value = state.customFps.toString();
    if (this.paramUiScale) this.paramUiScale.value = state.uiScale.toString();

    if (this.selectErosionDuration) {
      this.selectErosionDuration.value = state.erosionDuration || 'infinite';
      if (this.valErosionDuration) {
        if (state.erosionDuration === 'custom') {
          this.valErosionDuration.textContent = `${state.customErosionDuration || 20}s`;
        } else {
          const selectedOpt = this.selectErosionDuration.options[this.selectErosionDuration.selectedIndex];
          this.valErosionDuration.textContent = selectedOpt ? selectedOpt.text : state.erosionDuration;
        }
      }
      if (this.customErosionDurationContainer) {
        if (state.erosionDuration === 'custom') {
          this.customErosionDurationContainer.classList.remove('hidden');
        } else {
          this.customErosionDurationContainer.classList.add('hidden');
        }
      }
    }
    if (this.paramCustomErosionDuration) this.paramCustomErosionDuration.value = (state.customErosionDuration || 20).toString();
    if (this.valCustomErosionDuration) this.valCustomErosionDuration.value = (state.customErosionDuration || 20).toString();

    if (this.selectBenchmarkDuration) {
      this.selectBenchmarkDuration.value = state.benchmarkDuration.toString();
      if (this.valBenchmarkDuration) {
        if (state.benchmarkDuration === 'custom') {
          this.valBenchmarkDuration.textContent = `${state.customBenchmarkDuration || 10}s`;
        } else {
          const selectedOpt = this.selectBenchmarkDuration.options[this.selectBenchmarkDuration.selectedIndex];
          this.valBenchmarkDuration.textContent = selectedOpt ? selectedOpt.text : `${getResolvedBenchmarkDuration()}s`;
        }
      }
      if (this.customBenchmarkDurationContainer) {
        if (state.benchmarkDuration === 'custom') {
          this.customBenchmarkDurationContainer.classList.remove('hidden');
        } else {
          this.customBenchmarkDurationContainer.classList.add('hidden');
        }
      }
    }
    if (this.paramCustomBenchmarkDuration) this.paramCustomBenchmarkDuration.value = (state.customBenchmarkDuration || 10).toString();
    if (this.valCustomBenchmarkDuration) this.valCustomBenchmarkDuration.value = (state.customBenchmarkDuration || 10).toString();

    this.applyUiScale();

    if (this.customFpsContainer) {
      if (state.fpsLimit === 'custom') {
        this.customFpsContainer.classList.remove('hidden');
      } else {
        this.customFpsContainer.classList.add('hidden');
      }
    }
  }

  public resetToDefaults(): void {
    resetStateToDefaults();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('terrainforge_config');
    }
    this.viewportManager?.applySavedCameraState({
      zoom: state.savedZoom,
      yaw: state.savedYaw,
      pitch: state.savedPitch,
      offsetX: state.cameraOffsetX,
      offsetY: state.cameraOffsetY,
      offsetZ: state.cameraOffsetZ,
    });
    this.callbacks?.onResetMetrics?.();
    this.syncDOMToState();
  }

  private bindDualControlInputPair(
    sliderEl: HTMLInputElement | null,
    numInputEl: HTMLInputElement | null,
    minVal: number,
    maxVal: number,
    stepVal: number,
    onUpdate: (clampedVal: number) => void
  ) {
    if (!sliderEl || !numInputEl) return;
    const update = (raw: number) => {
      const clamped = clampAndRound(raw, minVal, maxVal, stepVal);
      onUpdate(clamped);
      sliderEl.value = clamped.toString();
      numInputEl.value = clamped.toString();
    };

    sliderEl.addEventListener('input', () => update(parseInt(sliderEl.value, 10)));
    numInputEl.addEventListener('change', () => update(parseInt(numInputEl.value, 10)));
  }

  private setupUIEvents(): void {
    this.btnGridView?.addEventListener('click', () => {
      state.viewMode = 'grid';
    });

    this.selectSingleAlgo?.addEventListener('change', () => {
      const val = parseInt(this.selectSingleAlgo!.value);
      if (val >= 0) {
        state.focusedIndex = val;
        state.viewMode = 'single';
      } else {
        state.viewMode = 'grid';
      }
    });

    this.paramResolution?.addEventListener('input', () => {
      state.resolution = parseInt(this.paramResolution!.value);
    });

    this.paramZoom?.addEventListener('input', () => {
      state.savedZoom = parseInt(this.paramZoom!.value);
    });

    this.paramPitch?.addEventListener('input', () => {
      state.savedPitch = parseFloat(this.paramPitch!.value);
    });

    const handleTargetChange = () => {
      if (this.paramTargetX && this.paramTargetY && this.paramTargetZ) {
        state.cameraOffsetX = parseFloat(this.paramTargetX.value);
        state.cameraOffsetY = parseFloat(this.paramTargetY.value);
        state.cameraOffsetZ = parseFloat(this.paramTargetZ.value);
      }
    };

    this.paramTargetX?.addEventListener('input', handleTargetChange);
    this.paramTargetY?.addEventListener('input', handleTargetChange);
    this.paramTargetZ?.addEventListener('input', handleTargetChange);

    this.paramHeight?.addEventListener('input', () => {
      state.params.heightScale = parseFloat(this.paramHeight!.value);
    });

    this.paramWidth?.addEventListener('input', () => {
      state.params.widthScale = parseFloat(this.paramWidth!.value);
    });

    this.paramScale?.addEventListener('input', () => {
      state.params.scale = parseInt(this.paramScale!.value);
    });

    this.paramOctaves?.addEventListener('input', () => {
      state.params.octaves = parseInt(this.paramOctaves!.value);
    });

    this.paramPersistence?.addEventListener('input', () => {
      state.params.persistence = parseFloat(this.paramPersistence!.value);
    });

    this.paramColor?.addEventListener('change', () => {
      state.activePalette = this.paramColor!.value as any;
    });

    this.paramSeed?.addEventListener('change', () => {
      let seedVal = parseInt(this.paramSeed!.value);
      if (isNaN(seedVal) || seedVal < 1) seedVal = 42;
      if (seedVal > 999999) seedVal = 999999;
      state.params.seed = seedVal;
      this.paramSeed!.value = seedVal.toString();
    });

    this.paramRotateSpeed?.addEventListener('input', () => {
      state.rotateSpeed = parseFloat(this.paramRotateSpeed!.value);
    });

    this.paramNoiseSpeed?.addEventListener('input', () => {
      state.noiseSpeed = parseFloat(this.paramNoiseSpeed!.value);
    });

    this.paramFpsLimit?.addEventListener('change', () => {
      state.fpsLimit = this.paramFpsLimit!.value;
      if (this.customFpsContainer) {
        if (state.fpsLimit === 'custom') {
          this.customFpsContainer.classList.remove('hidden');
        } else {
          this.customFpsContainer.classList.add('hidden');
        }
      }
    });

    const syncCustomFps = (valStr: string) => {
      const parsed = parseInt(valStr);
      const clamped = isNaN(parsed) || parsed < 1 ? 60 : Math.min(parsed, 240);
      state.customFps = clamped;
      if (this.paramCustomFps) this.paramCustomFps.value = clamped.toString();
      if (this.valCustomFps) this.valCustomFps.value = clamped.toString();
    };

    if (this.paramCustomFps) {
      this.paramCustomFps.addEventListener('input', () => syncCustomFps(this.paramCustomFps!.value));
    }
    if (this.valCustomFps) {
      this.valCustomFps.addEventListener('input', () => syncCustomFps(this.valCustomFps!.value));
      this.valCustomFps.addEventListener('change', () => syncCustomFps(this.valCustomFps!.value));
    }

    this.valResolution?.addEventListener('change', () => {
      const rawVal = parseInt(this.valResolution!.value);
      state.resolution = clampAndRound(rawVal, 20, 320, 10);
      this.paramResolution!.value = state.resolution.toString();
    });

    this.valZoom?.addEventListener('change', () => {
      const rawVal = parseInt(this.valZoom!.value);
      state.savedZoom = clampAndRound(rawVal, 50, 800, 10);
    });

    this.valPitch?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valPitch!.value);
      state.savedPitch = clampAndRound(rawVal, 0.1, 3.0, 0.05);
    });

    this.valTargetX?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valTargetX!.value);
      state.cameraOffsetX = clampAndRound(rawVal, -5.0, 5.0, 0.1);
      this.paramTargetX!.value = state.cameraOffsetX.toString();
      handleTargetChange();
    });

    this.valTargetY?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valTargetY!.value);
      state.cameraOffsetY = clampAndRound(rawVal, -5.0, 5.0, 0.1);
      this.paramTargetY!.value = state.cameraOffsetY.toString();
      handleTargetChange();
    });

    this.valTargetZ?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valTargetZ!.value);
      state.cameraOffsetZ = clampAndRound(rawVal, -5.0, 5.0, 0.1);
      this.paramTargetZ!.value = state.cameraOffsetZ.toString();
      handleTargetChange();
    });

    this.valHeight?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valHeight!.value);
      state.params.heightScale = clampAndRound(rawVal, 0.2, 4.0, 0.1);
      this.paramHeight!.value = state.params.heightScale.toString();
    });

    this.valWidth?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valWidth!.value);
      state.params.widthScale = clampAndRound(rawVal, 0.2, 4.0, 0.1);
      this.paramWidth!.value = state.params.widthScale.toString();
    });

    this.valScale?.addEventListener('change', () => {
      const rawVal = parseInt(this.valScale!.value);
      state.params.scale = clampAndRound(rawVal, 5, 100, 5);
      this.paramScale!.value = state.params.scale.toString();
    });

    this.valOctaves?.addEventListener('change', () => {
      const rawVal = parseInt(this.valOctaves!.value);
      state.params.octaves = clampAndRound(rawVal, 1, 6, 1);
      this.paramOctaves!.value = state.params.octaves.toString();
    });

    this.valPersistence?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valPersistence!.value);
      state.params.persistence = clampAndRound(rawVal, 0.1, 1.0, 0.05);
      this.paramPersistence!.value = state.params.persistence.toString();
    });

    this.valRotateSpeed?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valRotateSpeed!.value);
      state.rotateSpeed = clampAndRound(rawVal, 0, 3, 0.1);
      this.paramRotateSpeed!.value = state.rotateSpeed.toString();
    });

    this.valNoiseSpeed?.addEventListener('change', () => {
      const rawVal = parseFloat(this.valNoiseSpeed!.value);
      state.noiseSpeed = clampAndRound(rawVal, 0, 10, 0.1);
      this.paramNoiseSpeed!.value = state.noiseSpeed.toString();
    });

    this.valCustomFps?.addEventListener('change', () => {
      const rawVal = parseInt(this.valCustomFps!.value);
      state.customFps = clampAndRound(rawVal, 15, 240, 5);
      this.paramCustomFps!.value = state.customFps.toString();
    });

    this.paramUiScale?.addEventListener('input', () => {
      state.uiScale = parseInt(this.paramUiScale!.value);
      this.applyUiScale();
    });

    this.valUiScale?.addEventListener('change', () => {
      const rawVal = parseInt(this.valUiScale!.value);
      state.uiScale = clampAndRound(rawVal, 80, 150, 5);
      this.paramUiScale!.value = state.uiScale.toString();
      this.applyUiScale();
    });

    if (this.selectErosionDuration) {
      this.selectErosionDuration.addEventListener('change', () => {
        state.erosionDuration = this.selectErosionDuration!.value;
        if (this.valErosionDuration) {
          if (state.erosionDuration === 'custom') {
            this.valErosionDuration.textContent = `${state.customErosionDuration || 20}s`;
          } else {
            const selectedOpt = this.selectErosionDuration!.options[this.selectErosionDuration!.selectedIndex];
            this.valErosionDuration.textContent = selectedOpt ? selectedOpt.text : state.erosionDuration;
          }
        }
        if (this.customErosionDurationContainer) {
          if (state.erosionDuration === 'custom') {
            this.customErosionDurationContainer.classList.remove('hidden');
          } else {
            this.customErosionDurationContainer.classList.add('hidden');
          }
        }
      });
    }

    this.bindDualControlInputPair(
      this.paramCustomErosionDuration,
      this.valCustomErosionDuration,
      1, 3600, 1,
      (clamped) => {
        state.customErosionDuration = clamped;
        if (this.valErosionDuration && state.erosionDuration === 'custom') {
          this.valErosionDuration.textContent = `${clamped}s`;
        }
      }
    );

    this.toggleErosion?.addEventListener('click', () => {
      state.isErosionActive = !state.isErosionActive;
      if (state.isErosionActive) {
        const targetSec = getResolvedErosionDuration();
        if (targetSec !== 'infinite') {
          if (this.getErosionElapsedTime() >= targetSec) {
            this.callbacks?.onClearCaches?.();
            this.setErosionElapsedTime(0);
          }
        }
        if (this.erosionStatusBadge) this.erosionStatusBadge.classList.remove('hidden');
      }
      this.syncErosionButtonUI();
    });

    if (this.btnResetErosion) {
      this.btnResetErosion.addEventListener('click', () => {
        this.callbacks?.onClearCaches?.();
        this.setErosionElapsedTime(0);
        if (this.erosionStatusBadge) this.erosionStatusBadge.classList.add('hidden');
        this.syncErosionButtonUI();
      });
    }

    if (this.selectBenchmarkDuration) {
      this.selectBenchmarkDuration.addEventListener('change', () => {
        const val = this.selectBenchmarkDuration!.value;
        state.benchmarkDuration = val === 'custom' ? 'custom' : (parseInt(val, 10) || 10);
        if (this.valBenchmarkDuration) {
          if (state.benchmarkDuration === 'custom') {
            this.valBenchmarkDuration.textContent = `${state.customBenchmarkDuration || 10}s`;
          } else {
            const selectedOpt = this.selectBenchmarkDuration!.options[this.selectBenchmarkDuration!.selectedIndex];
            this.valBenchmarkDuration.textContent = selectedOpt ? selectedOpt.text : `${getResolvedBenchmarkDuration()}s`;
          }
        }
        if (this.customBenchmarkDurationContainer) {
          if (state.benchmarkDuration === 'custom') {
            this.customBenchmarkDurationContainer.classList.remove('hidden');
          } else {
            this.customBenchmarkDurationContainer.classList.add('hidden');
          }
        }
      });
    }

    this.bindDualControlInputPair(
      this.paramCustomBenchmarkDuration,
      this.valCustomBenchmarkDuration,
      1, 3600, 1,
      (clamped) => {
        state.customBenchmarkDuration = clamped;
        if (this.valBenchmarkDuration && state.benchmarkDuration === 'custom') {
          this.valBenchmarkDuration.textContent = `${clamped}s`;
        }
      }
    );

    this.toggleWireframe?.addEventListener('change', () => {
      state.showWireframe = this.toggleWireframe!.checked;
    });

    if (this.toggleMetrics) {
      this.toggleMetrics.addEventListener('change', () => {
        state.showMetrics = this.toggleMetrics!.checked;
      });
    }

    this.btnResetDefaults?.addEventListener('click', () => {
      this.resetToDefaults();
    });

    this.btnBenchmark?.addEventListener('click', () => {
      this.callbacks?.onToggleBenchmark?.();
    });

    if (this.selectBenchmarkMode) {
      this.selectBenchmarkMode.addEventListener('change', () => {
        const mode = this.selectBenchmarkMode!.value as BenchmarkMode;
        if (this.valBenchmarkMode) {
          const modeLabels: Record<string, string> = {
            offscreen: 'Offscreen WebGL',
            headless: 'Headless Math',
            vsync: 'VSync rAF',
          };
          this.valBenchmarkMode.textContent = modeLabels[mode] || mode;
        }
        this.callbacks?.onBenchmarkModeChange?.(mode);
      });
    }
  }

  private setupHotkeys(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.callbacks?.onCloseBenchmarkResultsModal?.();
      }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key) - 1;
        if (idx < availableAlgorithms.length) {
          state.focusedIndex = idx;
          state.viewMode = 'single';
        }
      }

      if (e.key === '0' || e.key === '`') {
        state.viewMode = 'grid';
      }

      if (e.key.toLowerCase() === 'b') {
        this.callbacks?.onToggleBenchmark?.();
      }

      if (e.key.toLowerCase() === 'e') {
        state.isErosionActive = !state.isErosionActive;
      }

      if (e.key.toLowerCase() === 'w') {
        if (this.toggleWireframe) {
          this.toggleWireframe.checked = !this.toggleWireframe.checked;
          state.showWireframe = this.toggleWireframe.checked;
        }
      }

      if (e.key.toLowerCase() === 'm') {
        state.showMetrics = !state.showMetrics;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.key === 'ArrowUp') state.keysPressed.arrowUp = true;
        else if (e.key === 'ArrowDown') state.keysPressed.arrowDown = true;
        else if (e.key === 'ArrowLeft') state.keysPressed.arrowLeft = true;
        else if (e.key === 'ArrowRight') state.keysPressed.arrowRight = true;
      }

      if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        if (e.key === ' ') state.keysPressed.space = true;
        else if (e.key === 'Shift') state.keysPressed.shift = true;
      }

      if (e.key.toLowerCase() === 'r') {
        state.autoOrbit = !state.autoOrbit;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') state.keysPressed.space = false;
      else if (e.key === 'Shift') state.keysPressed.shift = false;
      else if (e.key === 'ArrowUp') state.keysPressed.arrowUp = false;
      else if (e.key === 'ArrowDown') state.keysPressed.arrowDown = false;
      else if (e.key === 'ArrowLeft') state.keysPressed.arrowLeft = false;
      else if (e.key === 'ArrowRight') state.keysPressed.arrowRight = false;
    });

    window.addEventListener('blur', () => {
      state.keysPressed.space = false;
      state.keysPressed.shift = false;
      state.keysPressed.arrowUp = false;
      state.keysPressed.arrowDown = false;
      state.keysPressed.arrowLeft = false;
      state.keysPressed.arrowRight = false;
    });
  }

  private setupTooltips(): void {
    if (typeof document === 'undefined') return;

    const metricItems = document.querySelectorAll('.metric-item, .has-tooltip');
    let activeTooltip: HTMLDivElement | null = null;

    metricItems.forEach((item) => {
      const template = item.querySelector('.tooltip-box') as HTMLDivElement | null;
      if (!template) return;

      let showTimeout: number | null = null;

      item.addEventListener('mouseenter', () => {
        if (window.innerWidth <= 768) return;
        const modal = document.getElementById('mobile-info-modal');
        if (modal && !modal.classList.contains('hidden')) return;

        if (showTimeout) {
          window.clearTimeout(showTimeout);
          showTimeout = null;
        }

        showTimeout = window.setTimeout(() => {
          if (activeTooltip) {
            activeTooltip.remove();
            activeTooltip = null;
          }

          activeTooltip = document.createElement('div');
          activeTooltip.className = 'global-tooltip-box';
          activeTooltip.innerHTML = template.innerHTML;
          document.body.appendChild(activeTooltip);

          activeTooltip.style.display = 'flex';

          const itemRect = item.getBoundingClientRect();
          const tooltipRect = activeTooltip.getBoundingClientRect();

          let left = itemRect.left + (itemRect.width / 2) - (tooltipRect.width / 2);
          let top = itemRect.top - tooltipRect.height - 12;

          if (left < 10) {
            left = 10;
          } else if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
          }

          if (top < 10) {
            top = itemRect.bottom + 12;
          }

          activeTooltip.style.left = `${left}px`;
          activeTooltip.style.top = `${top}px`;
        }, 400);
      });

      item.addEventListener('mouseleave', () => {
        if (showTimeout) {
          window.clearTimeout(showTimeout);
          showTimeout = null;
        }

        if (activeTooltip) {
          activeTooltip.remove();
          activeTooltip = null;
        }
      });
    });
  }

  private setupMobileUI(): void {
    if (typeof document === 'undefined') return;

    const sidebar = document.getElementById('mobile-sidebar');
    const sheetHandle = document.getElementById('mobile-sheet-handle');
    const toggleBtn = document.getElementById('btn-toggle-sheet') as HTMLButtonElement | null;
    const mobileAlgoTabs = document.querySelectorAll('.mobile-tab-btn');
    const infoModal = document.getElementById('mobile-info-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalBackdrop = document.getElementById('modal-backdrop');

    const isMobile = () => window.innerWidth <= 768;

    if (isMobile() && state.viewMode === 'grid') {
      state.viewMode = 'single';
      state.focusedIndex = 0;
    }

    const toggleSheet = (e?: Event) => {
      if (e) e.stopPropagation();
      if (!sidebar) return;
      const isCollapsed = sidebar.classList.contains('collapsed');
      if (isCollapsed) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        sidebar.style.transform = '';
        if (toggleBtn) toggleBtn.textContent = '▼ Hide Controls';
      } else {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        sidebar.style.transform = '';
        if (toggleBtn) toggleBtn.textContent = '▲ Open Controls';
        sidebar.scrollTop = 0;
      }
    };

    const collapseSheet = () => {
      if (!sidebar) return;
      if (sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        sidebar.style.transform = '';
        if (toggleBtn) toggleBtn.textContent = '▲ Open Controls';
        sidebar.scrollTop = 0;
      }
    };

    const gridContainer = document.getElementById('terrain-grid');
    if (gridContainer) {
      let canvasTouchStartX = 0;
      let canvasTouchStartY = 0;

      gridContainer.addEventListener('touchstart', (e: TouchEvent) => {
        if (!isMobile()) return;
        canvasTouchStartX = e.touches[0].clientX;
        canvasTouchStartY = e.touches[0].clientY;
      }, { passive: true });

      gridContainer.addEventListener('touchend', (e: TouchEvent) => {
        if (!isMobile() || !sidebar || !sidebar.classList.contains('expanded')) return;
        if (e.changedTouches.length > 0) {
          const endX = e.changedTouches[0].clientX;
          const endY = e.changedTouches[0].clientY;
          const dist = Math.hypot(endX - canvasTouchStartX, endY - canvasTouchStartY);
          if (dist < 12) {
            collapseSheet();
          }
        }
      }, { passive: true });

      gridContainer.addEventListener('click', () => {
        if (!isMobile() || !sidebar || !sidebar.classList.contains('expanded')) return;
        collapseSheet();
      });
    }

    if (sheetHandle && sidebar) {
      let sheetStartY = 0;
      let currentDeltaY = 0;
      let isDraggingSheet = false;

      sheetHandle.addEventListener('click', (e) => {
        if (Math.abs(currentDeltaY) < 10) {
          toggleSheet(e);
        }
      });

      sheetHandle.addEventListener('touchstart', (e: TouchEvent) => {
        if (!isMobile()) return;
        isDraggingSheet = true;
        sheetStartY = e.touches[0].clientY;
        currentDeltaY = 0;
        sidebar.style.transition = 'none';
      }, { passive: false });

      window.addEventListener('touchmove', (e: TouchEvent) => {
        if (!isDraggingSheet || !sidebar || !isMobile()) return;

        const currentY = e.touches[0].clientY;
        currentDeltaY = currentY - sheetStartY;
        const isCollapsed = sidebar.classList.contains('collapsed');

        if ((isCollapsed && currentDeltaY < 0) || (!isCollapsed && currentDeltaY > 0)) {
          if (e.cancelable) e.preventDefault();
        }

        if (isCollapsed) {
          if (currentDeltaY < 0) {
            const collapsedOffset = window.innerHeight * 0.75 - 96;
            const translateY = Math.max(0, collapsedOffset + currentDeltaY);
            sidebar.style.transform = `translateY(${translateY}px)`;
          }
        } else {
          if (currentDeltaY > 0) {
            sidebar.style.transform = `translateY(${currentDeltaY}px)`;
          }
        }
      }, { passive: false });

      const handleDragEnd = () => {
        if (!isDraggingSheet || !sidebar) return;
        isDraggingSheet = false;
        sidebar.style.transition = '';

        const isCollapsed = sidebar.classList.contains('collapsed');

        if (isCollapsed && currentDeltaY < -30) {
          sidebar.style.transform = '';
          sidebar.classList.remove('collapsed');
          sidebar.classList.add('expanded');
          if (toggleBtn) toggleBtn.textContent = '▼ Hide Controls';
        } else if (!isCollapsed && currentDeltaY > 30) {
          sidebar.style.transform = '';
          sidebar.classList.remove('expanded');
          sidebar.classList.add('collapsed');
          if (toggleBtn) toggleBtn.textContent = '▲ Open Controls';
        } else {
          sidebar.style.transform = '';
        }
      };

      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('touchcancel', handleDragEnd);
    }

    mobileAlgoTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLButtonElement;
        const idxAttr = target.getAttribute('data-index');
        if (idxAttr !== null) {
          const idx = parseInt(idxAttr, 10);
          state.focusedIndex = idx;
          state.viewMode = 'single';

          mobileAlgoTabs.forEach(b => {
            if (b.hasAttribute('data-index')) b.classList.remove('active');
          });
          target.classList.add('active');
        }
      });
    });

    const mobileToggleMetrics = document.getElementById('mobile-toggle-metrics');
    if (mobileToggleMetrics) {
      mobileToggleMetrics.addEventListener('click', (e) => {
        e.stopPropagation();
        state.showMetrics = !state.showMetrics;
      });
    }

    const tooltipGroups = document.querySelectorAll('.has-tooltip');
    const lucideInfoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

    tooltipGroups.forEach((group) => {
      const tooltipBox = group.querySelector('.tooltip-box');
      if (!tooltipBox) return;

      if (!group.querySelector('.info-btn')) {
        const label = group.querySelector('.toggle-label, h2, h3, label:not(.switch)');
        if (label) {
          const infoBtn = document.createElement('button');
          infoBtn.className = 'info-btn';
          infoBtn.setAttribute('aria-label', 'Parameter info');
          infoBtn.setAttribute('type', 'button');
          infoBtn.innerHTML = lucideInfoSvg;

          infoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.global-tooltip-box').forEach(el => el.remove());
            openInfoModal(tooltipBox);
          });

          label.appendChild(infoBtn);
        }
      }
    });

    function openInfoModal(tooltipBox: Element) {
      if (!infoModal || !modalTitle || !modalBody) return;
      const titleEl = tooltipBox.querySelector('h5');
      modalTitle.textContent = titleEl ? titleEl.textContent || 'Parameter Information' : 'Parameter Information';

      const clone = tooltipBox.cloneNode(true) as HTMLElement;
      const h5 = clone.querySelector('h5');
      if (h5) h5.remove();

      modalBody.innerHTML = clone.innerHTML;
      infoModal.classList.remove('hidden');
    }

    const closeModal = () => {
      if (infoModal) infoModal.classList.add('hidden');
    };

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  }

  private setupMathAnalysisToggle(): void {
    if (typeof document === 'undefined') return;

    const cards = document.querySelectorAll('.viewport-card');

    cards.forEach(card => {
      const metricsBar = card.querySelector('.metrics');
      if (metricsBar) {
        metricsBar.addEventListener('click', (e) => {
          e.stopPropagation();
          const isShown = card.classList.contains('show-analysis');
          document.querySelectorAll('.viewport-card').forEach(c => c.classList.remove('show-analysis'));
          if (!isShown) {
            card.classList.add('show-analysis');
          }
        });
      }

      const mathPanel = card.querySelector('.math-analysis');
      if (mathPanel) {
        mathPanel.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    });

    window.addEventListener('click', () => {
      document.querySelectorAll('.viewport-card').forEach(c => c.classList.remove('show-analysis'));
    });
  }
}
