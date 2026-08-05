import { availableAlgorithms } from './algorithms';
import { ColorPalette } from './renderer';
import { ViewportManager } from './viewport-manager';
import { PerformanceMetrics, BenchmarkSuite } from './benchmark';
import { HydraulicErosion } from './physics';
import { TerrainPipeline } from './pipeline';
import { state, clearHeightmapCaches, resetStateToDefaults, getResolvedBenchmarkDuration, getResolvedErosionDuration } from './state';
import { saveConfig, loadConfig } from './storage';
import { OffscreenBenchmarkManager } from './offscreen-benchmark';
import type { BenchmarkMode, TelemetryPayload } from './worker';

// ============================================================================
// TYPED CONFIGURATION INTERFACE
// ============================================================================


// ============================================================================
// GLOBAL APPLICATION STATE
// ============================================================================


// ============================================================================
// DOM ELEMENT RETRIEVAL
// ============================================================================
const getDomElement = <T extends HTMLElement>(id: string): T | null =>
  typeof document !== 'undefined' ? (document.getElementById(id) as T) : null;

const gridContainer = getDomElement<HTMLDivElement>('terrain-grid')!;
const btnGridView = getDomElement<HTMLButtonElement>('btn-grid-view')!;
const selectSingleAlgo = getDomElement<HTMLSelectElement>('select-single-algo')!;

// Numeric input for the terrain seed
const paramSeed = getDomElement<HTMLInputElement>('param-seed')!;

const paramResolution = getDomElement<HTMLInputElement>('param-resolution')!;
const paramZoom = getDomElement<HTMLInputElement>('param-zoom')!;
const paramPitch = getDomElement<HTMLInputElement>('param-pitch')!;
const paramTargetX = getDomElement<HTMLInputElement>('param-target-x')!;
const paramTargetY = getDomElement<HTMLInputElement>('param-target-y')!;
const paramTargetZ = getDomElement<HTMLInputElement>('param-target-z')!;
const paramHeight = getDomElement<HTMLInputElement>('param-height')!;
const paramWidth = getDomElement<HTMLInputElement>('param-width')!;
const paramScale = getDomElement<HTMLInputElement>('param-scale')!;
const paramOctaves = getDomElement<HTMLInputElement>('param-octaves')!;
const paramPersistence = getDomElement<HTMLInputElement>('param-persistence')!;
const paramColor = getDomElement<HTMLSelectElement>('param-color')!;

// Control inputs for rotation and the FPS limit
const paramRotateSpeed = getDomElement<HTMLInputElement>('param-rotate-speed')!;
const paramNoiseSpeed = getDomElement<HTMLInputElement>('param-noise-speed')!;
const paramFpsLimit = getDomElement<HTMLSelectElement>('param-fps-limit')!;
const customFpsContainer = getDomElement<HTMLDivElement>('custom-fps-container')!;
const paramCustomFps = getDomElement<HTMLInputElement>('param-custom-fps')!;
const paramUiScale = getDomElement<HTMLInputElement>('param-ui-scale')!;

// UI value labels
const valSeed = getDomElement<HTMLSpanElement>('val-seed')!;
const valResolution = getDomElement<HTMLInputElement>('val-resolution')!;
const valZoom = getDomElement<HTMLInputElement>('val-zoom')!;
const valPitch = getDomElement<HTMLInputElement>('val-pitch')!;
const valTargetX = getDomElement<HTMLInputElement>('val-target-x')!;
const valTargetY = getDomElement<HTMLInputElement>('val-target-y')!;
const valTargetZ = getDomElement<HTMLInputElement>('val-target-z')!;
const valHeight = getDomElement<HTMLInputElement>('val-height')!;
const valWidth = getDomElement<HTMLInputElement>('val-width')!;
const valScale = getDomElement<HTMLInputElement>('val-scale')!;
const valOctaves = getDomElement<HTMLInputElement>('val-octaves')!;
const valPersistence = getDomElement<HTMLInputElement>('val-persistence')!;

const valRotateSpeed = getDomElement<HTMLInputElement>('val-rotate-speed')!;
const valNoiseSpeed = getDomElement<HTMLInputElement>('val-noise-speed')!;
const valFpsLimit = getDomElement<HTMLSpanElement>('val-fps-limit')!;
const valCustomFps = getDomElement<HTMLInputElement>('val-custom-fps')!;
const valUiScale = getDomElement<HTMLInputElement>('val-ui-scale')!;

const selectErosionDuration = getDomElement<HTMLSelectElement>('select-erosion-duration');
const valErosionDuration = getDomElement<HTMLSpanElement>('val-erosion-duration');
const customErosionDurationContainer = getDomElement<HTMLDivElement>('custom-erosion-duration-container');
const paramCustomErosionDuration = getDomElement<HTMLInputElement>('param-custom-erosion-duration');
const valCustomErosionDuration = getDomElement<HTMLInputElement>('val-custom-erosion-duration');
const erosionStatusBadge = getDomElement<HTMLDivElement>('erosion-status-badge');
const lblErosionProgress = getDomElement<HTMLSpanElement>('lbl-erosion-progress');

const toggleErosion = getDomElement<HTMLButtonElement>('toggle-erosion')!;
const lblErosion = getDomElement<HTMLElement>('lbl-erosion')!;
const iconErosionPlay = getDomElement<HTMLElement>('icon-erosion-play')!;
const iconErosionPause = getDomElement<HTMLElement>('icon-erosion-pause')!;
const toggleWireframe = getDomElement<HTMLInputElement>('toggle-wireframe')!;
const toggleMetrics = getDomElement<HTMLInputElement>('toggle-metrics');
const btnResetErosion = getDomElement<HTMLButtonElement>('btn-reset-erosion')!;

const selectBenchmarkDuration = getDomElement<HTMLSelectElement>('select-benchmark-duration');
const valBenchmarkDuration = getDomElement<HTMLSpanElement>('val-benchmark-duration');
const customBenchmarkDurationContainer = getDomElement<HTMLDivElement>('custom-benchmark-duration-container');
const paramCustomBenchmarkDuration = getDomElement<HTMLInputElement>('param-custom-benchmark-duration');
const valCustomBenchmarkDuration = getDomElement<HTMLInputElement>('val-custom-benchmark-duration');
const selectBenchmarkMode = getDomElement<HTMLSelectElement>('select-benchmark-mode');
const valBenchmarkMode = getDomElement<HTMLSpanElement>('val-benchmark-mode');

const btnBenchmark = getDomElement<HTMLButtonElement>('btn-benchmark')!;
const btnResetDefaults = getDomElement<HTMLButtonElement>('btn-reset-defaults')!;
const panelBenchStatus = getDomElement<HTMLDivElement>('benchmark-status')!;
const valBenchState = getDomElement<HTMLSpanElement>('bench-state')!;
const valBenchFps = getDomElement<HTMLSpanElement>('bench-fps')!;
const valBenchFrametime = getDomElement<HTMLSpanElement>('bench-frametime')!;
const valBenchMathTime = getDomElement<HTMLSpanElement>('bench-math-time')!;
const valBenchGpuTime = getDomElement<HTMLSpanElement>('bench-gpu-time')!;
const valBenchTotalFrames = getDomElement<HTMLSpanElement>('bench-total-frames')!;

const benchmarkResultsModal = getDomElement<HTMLDivElement>('benchmark-results-modal');
const benchmarkModalBackdrop = getDomElement<HTMLDivElement>('benchmark-modal-backdrop');
const benchmarkModalClose = getDomElement<HTMLButtonElement>('benchmark-modal-close');
const btnCloseBenchmarkModal = getDomElement<HTMLButtonElement>('btn-close-benchmark-modal');
const btnReBenchmark = getDomElement<HTMLButtonElement>('btn-re-benchmark');
const benchmarkChartContainer = getDomElement<HTMLDivElement>('benchmark-chart-container');


let erosionElapsedTime = 0;
let benchmarkElapsedTime = 0;

let offscreenCanvasEl: HTMLCanvasElement | null = null;
let isOffscreenInitialized = false;
let latestWorkerTelemetry: TelemetryPayload | null = null;

function ensureOffscreenBenchmarkInitialized(): boolean {
  if (isOffscreenInitialized) return true;
  if (!OffscreenBenchmarkManager.isSupported()) return false;

  // Create dedicated offscreen canvas container element if not already present
  offscreenCanvasEl = document.createElement('canvas');
  offscreenCanvasEl.id = 'offscreen-benchmark-canvas';
  offscreenCanvasEl.style.width = '100%';
  offscreenCanvasEl.style.height = '140px';
  offscreenCanvasEl.style.borderRadius = '6px';
  offscreenCanvasEl.style.marginTop = '8px';
  panelBenchStatus.appendChild(offscreenCanvasEl);

  const activeIdx = isSequentialBenchmarkRunning 
    ? currentBenchmarkAlgoIndex 
    : (state.focusedIndex >= 0 && state.focusedIndex < availableAlgorithms.length ? state.focusedIndex : 0);
  const algoName = availableAlgorithms[activeIdx].name;
  const selectedMode = (selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';

  const success = offscreenBenchmark.initialize(
    offscreenCanvasEl,
    panelBenchStatus,
    algoName,
    state.params,
    state.resolution,
    (telemetry) => {
      latestWorkerTelemetry = telemetry;
      if (isSequentialBenchmarkRunning) {
        workerAccumulator.recordSample(telemetry.fps, telemetry.maxMathTimeMs, telemetry.maxRenderTimeMs);
      }
    },
    selectedMode,
    state.canvasFpsCap
  );

  isOffscreenInitialized = success;
  return success;
}

// ============================================================================
// VIEWPORT INITIALIZATION
// ============================================================================





const benchmarkSuite = new BenchmarkSuite();
const offscreenBenchmark = new OffscreenBenchmarkManager();
const metricsTrackers: PerformanceMetrics[] = [
  new PerformanceMetrics(), new PerformanceMetrics(), new PerformanceMetrics(),
  new PerformanceMetrics(), new PerformanceMetrics(), new PerformanceMetrics()
];
const cachedMetricElements: Record<string, any> = {};
const hydraulicErosion = new HydraulicErosion();

export const viewportManager = new ViewportManager({
  algorithms: availableAlgorithms,
  onStatsUpdate: (index, stats) => {
    metricsTrackers[index].addRenderTime(stats.renderTime);
    metricsTrackers[index].addMathTime(stats.mathTime);
    metricsTrackers[index].addRuggedness(stats.ruggedness);
  },
  onGridModeChange: (mode, index) => {
    if (selectSingleAlgo) {
      selectSingleAlgo.value = mode === 'single' ? index.toString() : '-1';
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (mode === 'single') {
        mainContent.classList.add('single-view-active');
      } else {
        mainContent.classList.remove('single-view-active');
      }
    }
    const mobileAlgoTabs = document.querySelectorAll('.mobile-tab-btn');
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
  },
  isSyncBlocked: () => benchmarkSuite.isActive(),
});

const pipelines: TerrainPipeline[] = availableAlgorithms.map(algo => {
  const p = new TerrainPipeline();
  p.setAlgorithm(algo);
  p.addFilter(hydraulicErosion);
  return p;
});



import { stateObservable } from './state';
stateObservable.subscribe((path) => {
  updateUIStrings();
  updateStorage();
  
  if (
    path.startsWith('params.') ||
    path === 'resolution' ||
    path === 'focusedIndex' ||
    path === 'viewMode' ||
    path === 'fpsLimit' ||
    path === 'customFps' ||
    path === 'noiseSpeed' ||
    path === 'rotateSpeed' ||
    path === 'isErosionActive' ||
    path === 'activePalette'
  ) {
    if (!isSequentialBenchmarkRunning) {
      metricsTrackers.forEach((m) => m.reset());
      latestWorkerTelemetry = null;
    }
  }

  if (path.startsWith('params.') || path === 'resolution') {
    clearHeightmapCaches();
  }

  if (offscreenBenchmark.getIsRunning() && (path.startsWith('params') || path === 'resolution' || path === 'focusedIndex' || path === 'canvasFpsCap')) {
    const activeIdx = isSequentialBenchmarkRunning 
      ? currentBenchmarkAlgoIndex 
      : (state.focusedIndex >= 0 && state.focusedIndex < availableAlgorithms.length ? state.focusedIndex : 0);
    const algoName = availableAlgorithms[activeIdx].name;
    offscreenBenchmark.updateParams(algoName, state.resolution, state.params, undefined, state.canvasFpsCap);
  }

  // Viewport/Camera subscriptions
  if (path === 'savedZoom' || path === 'savedPitch' || path === 'savedYaw' || path === 'cameraOffsetX' || path === 'cameraOffsetY' || path === 'cameraOffsetZ') {
    applySavedCameraState();
  }

  if (path === 'viewMode' || path === 'focusedIndex') {
    setViewMode(state.viewMode, state.focusedIndex);
  }

  if (path === 'showMetrics') {
    applyShowMetricsState();
  }
});


async function initViewports() {
  await viewportManager.init(gridContainer, availableAlgorithms);
  for (let index = 0; index < availableAlgorithms.length; index++) {
    cachedMetricElements[index] = {
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
}

function clampAndRound(val: number, min: number, max: number, dec: number): number {
  const mult = Math.pow(10, dec);
  return Math.round(Math.max(min, Math.min(max, val)) * mult) / mult;
}

function updateUIStrings() {
  if (valSeed) valSeed.textContent = state.params.seed.toString();
  if (valResolution) valResolution.value = state.resolution.toString();
  if (valZoom) valZoom.value = state.savedZoom.toString();
  if (valPitch) valPitch.value = state.savedPitch.toString();
  if (valTargetX) valTargetX.value = state.cameraOffsetX.toString();
  if (valTargetY) valTargetY.value = state.cameraOffsetY.toString();
  if (valTargetZ) valTargetZ.value = state.cameraOffsetZ.toString();
  if (valHeight) valHeight.value = state.params.heightScale.toString();
  if (valWidth) valWidth.value = state.params.widthScale.toString();
  if (valScale) valScale.value = state.params.scale.toString();
  if (valOctaves) valOctaves.value = state.params.octaves.toString();
  if (valPersistence) valPersistence.value = state.params.persistence.toString();
  if (valRotateSpeed) valRotateSpeed.value = state.rotateSpeed.toString();
  if (valNoiseSpeed) valNoiseSpeed.value = state.noiseSpeed.toString();
  if (valFpsLimit) valFpsLimit.textContent = state.fpsLimit;
  if (valCustomFps) valCustomFps.value = state.customFps.toString();
  if (valUiScale) valUiScale.value = state.uiScale.toString();

  if (toggleErosion) {
    if (state.isErosionActive) {
      if (lblErosion) lblErosion.textContent = 'Pause Erosion';
      if (iconErosionPlay) iconErosionPlay.style.display = 'none';
      if (iconErosionPause) iconErosionPause.style.display = 'block';
    } else {
      if (lblErosion) lblErosion.textContent = 'Play Erosion';
      if (iconErosionPlay) iconErosionPlay.style.display = 'block';
      if (iconErosionPause) iconErosionPause.style.display = 'none';
    }
  }
}

function applyUiScale() {
  document.documentElement.style.setProperty('--ui-scale', (state.uiScale / 100).toString());
}

function setViewMode(mode: 'grid' | 'single', index: number = 0) {
  viewportManager.setGridMode(mode, index);
}


function applyShowMetricsState() {
  if (toggleMetrics) {
    toggleMetrics.checked = state.showMetrics;
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

  if (gridContainer) {
    if (state.showMetrics) {
      gridContainer.classList.remove('metrics-hidden');
    } else {
      gridContainer.classList.add('metrics-hidden');
    }
  }
}






function resetToDefaults() {
  resetStateToDefaults();
  localStorage.removeItem('terrainforge_config');
  syncDOMToState();
}


/**
 * Synchronizes DOM input elements (sliders, selects, checkboxes) with active state variables.
 */
function updateStorage() {
  let snap = undefined;
  const activeRenderer = viewportManager.getActiveRenderer();
  if (!benchmarkSuite.isActive() && activeRenderer) {
    const cam = activeRenderer.getCamera();
    const ctrl = activeRenderer.getControls();

    const dx = cam.position.x - ctrl.target.x;
    const dy = cam.position.y - ctrl.target.y;
    const dz = cam.position.z - ctrl.target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    snap = {
      zoom: Math.round(500 / distance),
      pitch: Math.acos(Math.max(-1, Math.min(1, dy / distance))),
      yaw: Math.atan2(dx, dz) >= 0 ? Math.atan2(dx, dz) : Math.atan2(dx, dz) + 2 * Math.PI,
      offsetX: ctrl.target.x,
      offsetY: ctrl.target.y,
      offsetZ: ctrl.target.z
    };
  }
  saveConfig(snap);
}

function syncDOMToState(): void {
  if (paramSeed) paramSeed.value = state.params.seed.toString();
  if (paramResolution) paramResolution.value = state.resolution.toString();
  if (paramZoom) paramZoom.value = state.savedZoom.toString();
  if (paramPitch) paramPitch.value = state.savedPitch.toString();
  if (paramTargetX) paramTargetX.value = state.cameraOffsetX.toString();
  if (paramTargetY) paramTargetY.value = state.cameraOffsetY.toString();
  if (paramTargetZ) paramTargetZ.value = state.cameraOffsetZ.toString();
  if (paramHeight) paramHeight.value = state.params.heightScale.toString();
  if (paramWidth) paramWidth.value = state.params.widthScale.toString();
  if (paramScale) paramScale.value = state.params.scale.toString();
  if (paramOctaves) paramOctaves.value = state.params.octaves.toString();
  if (paramPersistence) paramPersistence.value = state.params.persistence.toString();
  if (paramColor) paramColor.value = state.activePalette;
  if (toggleErosion) {
    if (state.isErosionActive) {
      if (lblErosion) lblErosion.textContent = 'Pause Erosion';
      if (iconErosionPlay) iconErosionPlay.style.display = 'none';
      if (iconErosionPause) iconErosionPause.style.display = 'block';
    } else {
      if (lblErosion) lblErosion.textContent = 'Play Erosion';
      if (iconErosionPlay) iconErosionPlay.style.display = 'block';
      if (iconErosionPause) iconErosionPause.style.display = 'none';
    }
  }
  if (toggleWireframe) toggleWireframe.checked = state.showWireframe;
  applyShowMetricsState();
  
  if (paramRotateSpeed) paramRotateSpeed.value = state.rotateSpeed.toString();
  if (paramNoiseSpeed) paramNoiseSpeed.value = state.noiseSpeed.toString();
  if (paramFpsLimit) paramFpsLimit.value = state.fpsLimit;
  if (paramCustomFps) paramCustomFps.value = state.customFps.toString();
  if (valCustomFps) valCustomFps.value = state.customFps.toString();
  if (paramUiScale) paramUiScale.value = state.uiScale.toString();
  if (selectErosionDuration) {
    selectErosionDuration.value = state.erosionDuration || 'infinite';
    if (valErosionDuration) {
      if (state.erosionDuration === 'custom') {
        valErosionDuration.textContent = `${state.customErosionDuration || 20}s`;
      } else {
        const selectedOpt = selectErosionDuration.options[selectErosionDuration.selectedIndex];
        valErosionDuration.textContent = selectedOpt ? selectedOpt.text : state.erosionDuration;
      }
    }
    if (customErosionDurationContainer) {
      if (state.erosionDuration === 'custom') {
        customErosionDurationContainer.classList.remove('hidden');
      } else {
        customErosionDurationContainer.classList.add('hidden');
      }
    }
  }
  if (paramCustomErosionDuration) paramCustomErosionDuration.value = (state.customErosionDuration || 20).toString();
  if (valCustomErosionDuration) valCustomErosionDuration.value = (state.customErosionDuration || 20).toString();

  if (selectBenchmarkDuration) {
    selectBenchmarkDuration.value = state.benchmarkDuration.toString();
    if (valBenchmarkDuration) {
      if (state.benchmarkDuration === 'custom') {
        valBenchmarkDuration.textContent = `${state.customBenchmarkDuration || 10}s`;
      } else {
        const selectedOpt = selectBenchmarkDuration.options[selectBenchmarkDuration.selectedIndex];
        valBenchmarkDuration.textContent = selectedOpt ? selectedOpt.text : `${getResolvedBenchmarkDuration()}s`;
      }
    }
    if (customBenchmarkDurationContainer) {
      if (state.benchmarkDuration === 'custom') {
        customBenchmarkDurationContainer.classList.remove('hidden');
      } else {
        customBenchmarkDurationContainer.classList.add('hidden');
      }
    }
  }
  if (paramCustomBenchmarkDuration) paramCustomBenchmarkDuration.value = (state.customBenchmarkDuration || 10).toString();
  if (valCustomBenchmarkDuration) valCustomBenchmarkDuration.value = (state.customBenchmarkDuration || 10).toString();

  applyUiScale();

  // Show or hide the custom FPS limit container based on selection
  if (customFpsContainer) {
    if (state.fpsLimit === 'custom') {
      customFpsContainer.classList.remove('hidden');
    } else {
      customFpsContainer.classList.add('hidden');
    }
  }

  // Apply saved spherical coordinates to camera positions
  applySavedCameraState();

  // Re-apply view and layout modes
  setViewMode(state.viewMode, state.focusedIndex);
}

/**
 * Applies saved spherical camera state onto Three.js Cartesian positions.
 */
function applySavedCameraState(): void {
  viewportManager.applySavedCameraState({
    zoom: state.savedZoom,
    pitch: state.savedPitch,
    yaw: state.savedYaw,
    offsetX: state.cameraOffsetX,
    offsetY: state.cameraOffsetY,
    offsetZ: state.cameraOffsetZ,
  });
}

// ============================================================================
// SIDEBAR CONTROL HANDLERS
// ============================================================================
function setupUIEvents() {
  // Switch to comparative Grid view
  btnGridView.addEventListener('click', () => {
    state.viewMode = 'grid';
  });

  // Select focus viewport algorithm
  selectSingleAlgo.addEventListener('change', () => {
    const val = parseInt(selectSingleAlgo.value);
    if (val >= 0) {
      state.focusedIndex = val;
      state.viewMode = 'single';
    } else {
      state.viewMode = 'grid';
    }
  });

  // Range Slider Inputs
  paramResolution.addEventListener('input', () => {
    // Updates the terrain state.resolution and clears cache to force mesh regeneration with the selected detail level.
    state.resolution = parseInt(paramResolution.value);
  });

  paramZoom.addEventListener('input', () => {
    state.savedZoom = parseInt(paramZoom.value);
  });

  // Slider handler to change the camera's vertical orientation (Pitch)
  paramPitch.addEventListener('input', () => {
    state.savedPitch = parseFloat(paramPitch.value);
  });

  const handleTargetChange = () => {
            
    state.cameraOffsetX = parseFloat(paramTargetX.value);
    state.cameraOffsetY = parseFloat(paramTargetY.value);
    state.cameraOffsetZ = parseFloat(paramTargetZ.value);

  };

  paramTargetX.addEventListener('input', handleTargetChange);
  paramTargetY.addEventListener('input', handleTargetChange);
  paramTargetZ.addEventListener('input', handleTargetChange);

  paramHeight.addEventListener('input', () => {
    state.params.heightScale = parseFloat(paramHeight.value);
  });

  paramWidth.addEventListener('input', () => {
    // Updates the horizontal scale parameter based on the slider value and triggers rendering.
    state.params.widthScale = parseFloat(paramWidth.value);
  });

  paramScale.addEventListener('input', () => {
    state.params.scale = parseInt(paramScale.value);
  });

  paramOctaves.addEventListener('input', () => {
    state.params.octaves = parseInt(paramOctaves.value);
  });

  paramPersistence.addEventListener('input', () => {
    state.params.persistence = parseFloat(paramPersistence.value);
  });

  paramColor.addEventListener('change', () => {
    state.activePalette = paramColor.value as ColorPalette;
  });

  // Handle terrain generation seed changes
  paramSeed.addEventListener('change', () => {
    let seedVal = parseInt(paramSeed.value);
    if (isNaN(seedVal) || seedVal < 1) seedVal = 42;
    if (seedVal > 999999) seedVal = 999999;
    state.params.seed = seedVal;
    paramSeed.value = seedVal.toString();
  });

  // Auto-rotation speed control
  paramRotateSpeed.addEventListener('input', () => {
    state.rotateSpeed = parseFloat(paramRotateSpeed.value);
  });

  // Noise animation speed control
  paramNoiseSpeed.addEventListener('input', () => {
    state.noiseSpeed = parseFloat(paramNoiseSpeed.value);
  });

  // FPS limit and custom interface control
  paramFpsLimit.addEventListener('change', () => {
    state.fpsLimit = paramFpsLimit.value;
    if (customFpsContainer) {
      if (state.fpsLimit === 'custom') {
        customFpsContainer.classList.remove('hidden');
      } else {
        customFpsContainer.classList.add('hidden');
      }
    }
  });

  // Custom FPS value control (Bidirectional synchronization between range slider and number input)
  const syncCustomFps = (valStr: string) => {
    const parsed = parseInt(valStr);
    const clamped = isNaN(parsed) || parsed < 1 ? 60 : Math.min(parsed, 240);
    state.customFps = clamped;
    if (paramCustomFps) paramCustomFps.value = clamped.toString();
    if (valCustomFps) valCustomFps.value = clamped.toString();
  };

  if (paramCustomFps) {
    paramCustomFps.addEventListener('input', () => syncCustomFps(paramCustomFps.value));
  }
  if (valCustomFps) {
    valCustomFps.addEventListener('input', () => syncCustomFps(valCustomFps.value));
    valCustomFps.addEventListener('change', () => syncCustomFps(valCustomFps.value));
  }

  // Bidirectional synchronization from numeric inputs to range sliders
  valResolution.addEventListener('change', () => {
    const rawVal = parseInt(valResolution.value);
    // Clamps inputs between 20 and 320 with step of 10 to match UI range and prevent GPU rendering overload.
    state.resolution = clampAndRound(rawVal, 20, 320, 10);
    paramResolution.value = state.resolution.toString();
  });

  valZoom.addEventListener('change', () => {
    const rawVal = parseInt(valZoom.value);
    const zoomVal = clampAndRound(rawVal, 50, 800, 10);
    state.savedZoom = zoomVal;
  });

  valPitch.addEventListener('change', () => {
    const rawVal = parseFloat(valPitch.value);
    const pitchVal = clampAndRound(rawVal, 0.1, 3.0, 0.05);
        state.savedPitch = pitchVal;
  });

  valTargetX.addEventListener('change', () => {
    const rawVal = parseFloat(valTargetX.value);
    state.cameraOffsetX = clampAndRound(rawVal, -5.0, 5.0, 0.1);
    paramTargetX.value = state.cameraOffsetX.toString();
    handleTargetChange();
  });

  valTargetY.addEventListener('change', () => {
    const rawVal = parseFloat(valTargetY.value);
    state.cameraOffsetY = clampAndRound(rawVal, -5.0, 5.0, 0.1);
    paramTargetY.value = state.cameraOffsetY.toString();
    handleTargetChange();
  });

  valTargetZ.addEventListener('change', () => {
    const rawVal = parseFloat(valTargetZ.value);
    state.cameraOffsetZ = clampAndRound(rawVal, -5.0, 5.0, 0.1);
    paramTargetZ.value = state.cameraOffsetZ.toString();
    handleTargetChange();
  });

  valHeight.addEventListener('change', () => {
    const rawVal = parseFloat(valHeight.value);
    state.params.heightScale = clampAndRound(rawVal, 0.2, 4.0, 0.1);
    paramHeight.value = state.params.heightScale.toString();
  });

  valWidth.addEventListener('change', () => {
    const rawVal = parseFloat(valWidth.value);
    // Clamps manual inputs between 0.2 and 4.0 with step of 0.1 to avoid extreme scale distortions.
    state.params.widthScale = clampAndRound(rawVal, 0.2, 4.0, 0.1);
    paramWidth.value = state.params.widthScale.toString();
  });

  valScale.addEventListener('change', () => {
    const rawVal = parseInt(valScale.value);
    state.params.scale = clampAndRound(rawVal, 5, 100, 5);
    paramScale.value = state.params.scale.toString();
  });

  valOctaves.addEventListener('change', () => {
    const rawVal = parseInt(valOctaves.value);
    state.params.octaves = clampAndRound(rawVal, 1, 6, 1);
    paramOctaves.value = state.params.octaves.toString();
  });

  valPersistence.addEventListener('change', () => {
    const rawVal = parseFloat(valPersistence.value);
    state.params.persistence = clampAndRound(rawVal, 0.1, 1.0, 0.05);
    paramPersistence.value = state.params.persistence.toString();
  });

  valRotateSpeed.addEventListener('change', () => {
    const rawVal = parseFloat(valRotateSpeed.value);
    state.rotateSpeed = clampAndRound(rawVal, 0, 3, 0.1);
    paramRotateSpeed.value = state.rotateSpeed.toString();
  });

  valNoiseSpeed.addEventListener('change', () => {
    const rawVal = parseFloat(valNoiseSpeed.value);
    state.noiseSpeed = clampAndRound(rawVal, 0, 10, 0.1);
    paramNoiseSpeed.value = state.noiseSpeed.toString();
  });

  valCustomFps.addEventListener('change', () => {
    const rawVal = parseInt(valCustomFps.value);
    state.customFps = clampAndRound(rawVal, 15, 240, 5);
    paramCustomFps.value = state.customFps.toString();
  });

  // Manual UI Scale slider controls
  paramUiScale.addEventListener('input', () => {
    state.uiScale = parseInt(paramUiScale.value);
    applyUiScale();
  });

  valUiScale.addEventListener('change', () => {
    const rawVal = parseInt(valUiScale.value);
    state.uiScale = clampAndRound(rawVal, 80, 150, 5);
    paramUiScale.value = state.uiScale.toString();
    applyUiScale();
  });

  // Hydraulic Erosion Duration & Controls
  if (selectErosionDuration) {
    selectErosionDuration.addEventListener('change', () => {
      state.erosionDuration = selectErosionDuration.value;
      if (valErosionDuration) {
        if (state.erosionDuration === 'custom') {
          valErosionDuration.textContent = `${state.customErosionDuration || 20}s`;
        } else {
          const selectedOpt = selectErosionDuration.options[selectErosionDuration.selectedIndex];
          valErosionDuration.textContent = selectedOpt ? selectedOpt.text : state.erosionDuration;
        }
      }
      if (customErosionDurationContainer) {
        if (state.erosionDuration === 'custom') {
          customErosionDurationContainer.classList.remove('hidden');
        } else {
          customErosionDurationContainer.classList.add('hidden');
        }
      }
    });
  }

function bindDualControlInputPair(
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

  bindDualControlInputPair(
    paramCustomErosionDuration,
    valCustomErosionDuration,
    1, 3600, 1,
    (clamped) => {
      state.customErosionDuration = clamped;
      if (valErosionDuration && state.erosionDuration === 'custom') {
        valErosionDuration.textContent = `${clamped}s`;
      }
    }
  );

  toggleErosion.addEventListener('click', () => {
    state.isErosionActive = !state.isErosionActive;
    if (state.isErosionActive) {
      const targetSec = getResolvedErosionDuration();
      if (targetSec !== 'infinite') {
        if (erosionElapsedTime >= targetSec) {
          erosionElapsedTime = 0;
        }
      }
      if (erosionStatusBadge) erosionStatusBadge.classList.remove('hidden');
    }
    syncErosionButtonUI();
  });

  if (btnResetErosion) {
    btnResetErosion.addEventListener('click', () => {
      clearHeightmapCaches();
      erosionElapsedTime = 0;
      if (erosionStatusBadge) erosionStatusBadge.classList.add('hidden');
      syncErosionButtonUI();
    });
  }

  // Benchmark Duration Selection
  if (selectBenchmarkDuration) {
    selectBenchmarkDuration.addEventListener('change', () => {
      const val = selectBenchmarkDuration.value;
      state.benchmarkDuration = val === 'custom' ? 'custom' : (parseInt(val, 10) || 10);
      if (valBenchmarkDuration) {
        if (state.benchmarkDuration === 'custom') {
          valBenchmarkDuration.textContent = `${state.customBenchmarkDuration || 10}s`;
        } else {
          const selectedOpt = selectBenchmarkDuration.options[selectBenchmarkDuration.selectedIndex];
          valBenchmarkDuration.textContent = selectedOpt ? selectedOpt.text : `${getResolvedBenchmarkDuration()}s`;
        }
      }
      if (customBenchmarkDurationContainer) {
        if (state.benchmarkDuration === 'custom') {
          customBenchmarkDurationContainer.classList.remove('hidden');
        } else {
          customBenchmarkDurationContainer.classList.add('hidden');
        }
      }
    });
  }

  bindDualControlInputPair(
    paramCustomBenchmarkDuration,
    valCustomBenchmarkDuration,
    1, 3600, 1,
    (clamped) => {
      state.customBenchmarkDuration = clamped;
      if (valBenchmarkDuration && state.benchmarkDuration === 'custom') {
        valBenchmarkDuration.textContent = `${clamped}s`;
      }
    }
  );

  // Wireframe Toggle
  toggleWireframe.addEventListener('change', () => {
    // Toggles the visibility of the wireframe overlay.
    state.showWireframe = toggleWireframe.checked;
  });

  // Metrics Overlay Toggle
  if (toggleMetrics) {
    toggleMetrics.addEventListener('change', () => {
      state.showMetrics = toggleMetrics.checked;
    });
  }

  btnResetDefaults.addEventListener('click', () => {
    resetToDefaults();
  });

  // Benchmark Execution Action Button
  btnBenchmark.addEventListener('click', () => {
    toggleBenchmarkMode();
  });

  if (selectBenchmarkMode) {
    selectBenchmarkMode.addEventListener('change', () => {
      const mode = selectBenchmarkMode.value as BenchmarkMode;
      if (valBenchmarkMode) {
        const modeLabels: Record<string, string> = {
          offscreen: 'Offscreen WebGL',
          headless: 'Headless Math',
          vsync: 'VSync rAF',
        };
        valBenchmarkMode.textContent = modeLabels[mode] || mode;
      }
      metricsTrackers.forEach((m) => m.reset());
      latestWorkerTelemetry = null;
      if (benchmarkSuite.isActive() || offscreenBenchmark.getIsRunning()) {
        offscreenBenchmark.stop();
        startBenchmarkForCurrentMode();
      }
    });
  }

  // Benchmark Results Modal Controls
  if (benchmarkModalClose) {
    benchmarkModalClose.addEventListener('click', () => closeBenchmarkResultsModal());
  }
  if (btnCloseBenchmarkModal) {
    btnCloseBenchmarkModal.addEventListener('click', () => closeBenchmarkResultsModal());
  }
  if (benchmarkModalBackdrop) {
    benchmarkModalBackdrop.addEventListener('click', () => closeBenchmarkResultsModal());
  }
  if (btnReBenchmark) {
    btnReBenchmark.addEventListener('click', () => {
      closeBenchmarkResultsModal();
      startBenchmarkForCurrentMode();
    });
  }
}

function syncErosionButtonUI(): void {
  if (!toggleErosion) return;
  if (state.isErosionActive) {
    if (lblErosion) lblErosion.textContent = 'Pause Erosion';
    if (iconErosionPlay) iconErosionPlay.style.display = 'none';
    if (iconErosionPause) iconErosionPause.style.display = 'block';
  } else {
    if (lblErosion) lblErosion.textContent = erosionElapsedTime > 0 ? 'Resume Erosion' : 'Play Erosion';
    if (iconErosionPlay) iconErosionPlay.style.display = 'block';
    if (iconErosionPause) iconErosionPause.style.display = 'none';
  }
}

interface CompiledAlgoResult {
  avgFps: number;
  lowFps: number;
  avgFrameMs: number;
  lowFrameMs: number;
}

class WorkerBenchmarkAccumulator {
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

    // Zero-GC in-place typed array sort
    const validSamples = this.scratchBuffer.subarray(0, n);
    validSamples.sort();

    const p99Index = Math.max(0, Math.min(Math.ceil(n * 0.99) - 1, n - 1));
    const p99FrameMs = validSamples[p99Index] || (avgFps > 0 ? 1000 / avgFps : 0);

    const lowFps = p99FrameMs > 0 ? Math.round(1000 / p99FrameMs) : avgFps;
    const lowFrameMs = parseFloat(p99FrameMs.toFixed(2));

    return { avgFps, lowFps, avgFrameMs, lowFrameMs };
  }
}

const workerAccumulator = new WorkerBenchmarkAccumulator();
let compiledAlgoResults: (CompiledAlgoResult | null)[] = [];
let currentBenchmarkAlgoIndex = 0;
let isSequentialBenchmarkRunning = false;
let savedViewMode: 'grid' | 'single' = 'grid';
let savedFocusedIndex = 0;

function extractAlgorithmMetrics(i: number): CompiledAlgoResult {
  const compiled = compiledAlgoResults[i];
  if (compiled && compiled.avgFps > 0) {
    return compiled;
  }

  const tracker = metricsTrackers[i];
  let avgFps = tracker ? (tracker.getGlobalAverageFPS() || tracker.getFPS()) : 0;
  let lowFps = tracker ? (tracker.getGlobalOnePercentLowFPS() || avgFps) : 0;
  let avgFrameMs = tracker ? (tracker.getGlobalAverageFrameTime() || tracker.getAverageFrameTime()) : 0;
  let lowFrameMs = tracker ? (tracker.getGlobalOnePercentLowFrameTime() || avgFrameMs) : 0;

  const activeFocusedIdx = isSequentialBenchmarkRunning ? currentBenchmarkAlgoIndex : state.focusedIndex;
  if (avgFps === 0 && latestWorkerTelemetry && i === activeFocusedIdx) {
    const t = latestWorkerTelemetry;
    avgFps = Math.round(t.fps);
    const maxFrameMs = t.maxMathTimeMs + t.maxRenderTimeMs;
    lowFps = maxFrameMs > 0 ? Math.round(1000 / maxFrameMs) : avgFps;
    avgFrameMs = avgFps > 0 ? parseFloat((1000 / avgFps).toFixed(2)) : 0;
    lowFrameMs = maxFrameMs > 0 ? parseFloat(maxFrameMs.toFixed(2)) : avgFrameMs;
  }

  return { avgFps, lowFps, avgFrameMs, lowFrameMs };
}

function openBenchmarkResultsModal(): void {
  if (!benchmarkChartContainer || !benchmarkResultsModal) return;

  const algoCategories = ['Lattice', 'Standard', 'Optimal', 'Voronoi', 'Anisotropic', 'Anisotropic'];

  let maxFps = 60;
  const metricsData = availableAlgorithms.map((algo, i) => {
    const m = extractAlgorithmMetrics(i);

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

  benchmarkChartContainer.innerHTML = chartRowsHtml;
  benchmarkResultsModal.classList.remove('hidden');
}

function closeBenchmarkResultsModal(): void {
  if (benchmarkResultsModal) {
    benchmarkResultsModal.classList.add('hidden');
  }
}

function recordResultsForAlgo(idx: number): void {
  const selectedMode = (selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';
  if (selectedMode === 'vsync') {
    compiledAlgoResults[idx] = extractAlgorithmMetrics(idx);
  } else {
    const compiled = workerAccumulator.getCompiledResult();
    if (compiled.avgFps > 0) {
      compiledAlgoResults[idx] = compiled;
    } else {
      compiledAlgoResults[idx] = extractAlgorithmMetrics(idx);
    }
  }
}

function startBenchmarkForAlgo(idx: number): void {
  benchmarkElapsedTime = 0;
  latestWorkerTelemetry = null;
  workerAccumulator.reset();
  metricsTrackers[idx].clear();
  const selectedMode = (selectBenchmarkMode?.value as BenchmarkMode) || 'offscreen';

  if (selectedMode === 'vsync') {
    setViewMode('single', idx);
    offscreenBenchmark.stop();
    if (offscreenCanvasEl) {
      offscreenCanvasEl.style.display = 'none';
    }
  } else {
    setViewMode('single', idx);
    const initialized = ensureOffscreenBenchmarkInitialized();
    if (initialized) {
      const algoName = availableAlgorithms[idx].name;
      offscreenBenchmark.updateParams(algoName, state.resolution, state.params, selectedMode, state.canvasFpsCap);
      offscreenBenchmark.setMode(selectedMode);
      offscreenBenchmark.start();

      if (offscreenCanvasEl) {
        offscreenCanvasEl.style.display = selectedMode === 'offscreen' ? 'block' : 'none';
      }
    }
  }

  benchmarkSuite.start();

  btnBenchmark.textContent = 'Stop Benchmark';
  btnBenchmark.classList.remove('btn-primary');
  btnBenchmark.classList.add('btn-secondary');
  panelBenchStatus.classList.remove('hidden');
}

function stopBenchmarkAndShowModal(): void {
  if (isSequentialBenchmarkRunning && currentBenchmarkAlgoIndex < availableAlgorithms.length) {
    recordResultsForAlgo(currentBenchmarkAlgoIndex);
  }
  isSequentialBenchmarkRunning = false;
  benchmarkSuite.stop();
  offscreenBenchmark.stop();
  if (offscreenCanvasEl) {
    offscreenCanvasEl.style.display = 'none';
  }
  btnBenchmark.textContent = 'Start Auto-Benchmark';
  btnBenchmark.classList.remove('btn-secondary');
  btnBenchmark.classList.add('btn-primary');
  panelBenchStatus.classList.add('hidden');
  valBenchState.textContent = 'Inactive';

  state.viewMode = savedViewMode;
  state.focusedIndex = savedFocusedIndex;
  setViewMode(savedViewMode, savedFocusedIndex);
  openBenchmarkResultsModal();
}

function startBenchmarkForCurrentMode(): void {
  if (isSequentialBenchmarkRunning) {
    stopBenchmarkAndShowModal();
    return;
  }
  savedViewMode = state.viewMode;
  savedFocusedIndex = state.focusedIndex;
  compiledAlgoResults = new Array(availableAlgorithms.length).fill(null);
  currentBenchmarkAlgoIndex = 0;
  isSequentialBenchmarkRunning = true;
  startBenchmarkForAlgo(0);
}

/**
 * Initiates or aborts the automated camera benchmark sequence.
 */
function toggleBenchmarkMode(): void {
  if (isSequentialBenchmarkRunning || benchmarkSuite.isActive() || offscreenBenchmark.getIsRunning()) {
    stopBenchmarkAndShowModal();
  } else {
    closeBenchmarkResultsModal();
    startBenchmarkForCurrentMode();
  }
}

// ============================================================================
// KEYBOARD ATTACHMENTS (Hotkeys)
// ============================================================================
function setupHotkeys() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBenchmarkResultsModal();
    }

    // Ignore hotkeys if the user is interacting with an input, select, or textarea element.
    // This prevents typing numbers (such as in seed or state.resolution) from accidentally triggering layout switches.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    // Keys 1 to 6 switch layout to focus isolated algorithm
    if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key) - 1;
      if (idx < availableAlgorithms.length) {
        setViewMode('single', idx);
      }
    }

    // Key 0 or backtick (`) returns back to grid layout comparison
    if (e.key === '0' || e.key === '`') {
      setViewMode('grid');
    }

    // Key B toggles automated Camera Benchmark sequence
    if (e.key.toLowerCase() === 'b') {
      toggleBenchmarkMode();
    }

    // Key E toggles active Hydraulic Erosion (Play/Pause)
    if (e.key.toLowerCase() === 'e') {
      // Toggle the running state without clearing cache to allow resuming from the current state.
      state.isErosionActive = !state.isErosionActive;
    }

    // Key W toggles the wireframe overlay
    if (e.key.toLowerCase() === 'w') {
      // Toggles the wireframe visibility without clearing cache since it is a pure render property.
      toggleWireframe.checked = !toggleWireframe.checked;
      state.showWireframe = toggleWireframe.checked;
    }

    // Key M toggles active Metrics & Math Analysis overlays
    if (e.key.toLowerCase() === 'm') {
      state.showMetrics = !state.showMetrics;
    }


    // Arrow keys translate the camera and target horizontally (travel/pan)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // Prevent page scroll jump
      if (e.key === 'ArrowUp') {
        state.keysPressed.arrowUp = true;
      } else if (e.key === 'ArrowDown') {
        state.keysPressed.arrowDown = true;
      } else if (e.key === 'ArrowLeft') {
        state.keysPressed.arrowLeft = true;
      } else if (e.key === 'ArrowRight') {
        state.keysPressed.arrowRight = true;
      }
    }

    // Space and Shift keys translate the camera and target vertically along the global Y-axis
    if (e.key === ' ' || e.key === 'Shift') {
      e.preventDefault(); // Prevent page scroll jump
      if (e.key === ' ') {
        state.keysPressed.space = true;
      } else if (e.key === 'Shift') {
        state.keysPressed.shift = true;
      }
    }

    // Key R toggles automated Camera Yaw rotation
    if (e.key.toLowerCase() === 'r') {
      state.autoOrbit = !state.autoOrbit;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      state.keysPressed.space = false;
    } else if (e.key === 'Shift') {
      state.keysPressed.shift = false;
    } else if (e.key === 'ArrowUp') {
      state.keysPressed.arrowUp = false;
    } else if (e.key === 'ArrowDown') {
      state.keysPressed.arrowDown = false;
    } else if (e.key === 'ArrowLeft') {
      state.keysPressed.arrowLeft = false;
    } else if (e.key === 'ArrowRight') {
      state.keysPressed.arrowRight = false;
    }
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

// ============================================================================
// MAIN RENDERING LOOP (Frame ticker)
// ============================================================================
let lastTime = performance.now();
let lastRenderTime = performance.now();

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

const DOM_METRIC_THROTTLE_MS = 100;
let lastDomMetricUpdate = 0;
let lastMathTime = performance.now();

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

function animationLoop() {
  const now = performance.now();

  // 1. Math Calculation Throttling (Unthrottled when state.fpsLimit === 'uncapped')
  if (!shouldExecuteMathTick(state.fpsLimit, state.customFps, now, lastMathTime)) {
    requestAnimationFrame(animationLoop);
    return;
  }
  const mathFps = getResolvedFps(state.fpsLimit, state.customFps);
  const mathInterval = mathFps > 0 ? 1000 / mathFps : 0;
  lastMathTime = mathFps === 0 ? now : now - ((now - lastMathTime) % mathInterval);

  // 2. WebGL Canvas Visual Presentation Capping (Rate-limited to state.canvasFpsCap)
  const isCanvasRenderDue = shouldRenderCanvasFrame(state.canvasFpsCap, now, lastRenderTime);
  const targetCanvasFps = state.canvasFpsCap || 60;
  const canvasInterval = 1000 / targetCanvasFps;
  if (isCanvasRenderDue) {
    lastRenderTime = now - ((now - lastRenderTime) % canvasInterval);
  }

  const shouldUpdateDomMetrics = now - lastDomMetricUpdate >= DOM_METRIC_THROTTLE_MS;

  let dt = (now - lastTime) / 1000;
  lastTime = now;

  if (dt > 0.1) dt = 0.1;

  // Apply camera vertical height translation from held keys (Space / Shift)
  if ((state.keysPressed.space || state.keysPressed.shift) && !benchmarkSuite.isActive()) {
    const shiftStep = 1.5 * dt; // Translate at 1.5 units per second
    const oldOffsetY = state.cameraOffsetY;

    if (state.keysPressed.space) {
      state.cameraOffsetY = clampAndRound(state.cameraOffsetY + shiftStep, -5.0, 5.0, 0.01);
    } else if (state.keysPressed.shift) {
      state.cameraOffsetY = clampAndRound(state.cameraOffsetY - shiftStep, -5.0, 5.0, 0.01);
    }

    const diffY = state.cameraOffsetY - oldOffsetY;
    viewportManager.translateCameraHeight(diffY);
  }

  // Apply camera horizontal translation (travel) from held arrow keys
  const activeRenderer = viewportManager.getActiveRenderer();
  if ((state.keysPressed.arrowUp || state.keysPressed.arrowDown || state.keysPressed.arrowLeft || state.keysPressed.arrowRight) && !benchmarkSuite.isActive() && activeRenderer) {
    const cam = activeRenderer.getCamera();
    const ctrl = activeRenderer.getControls();

    const dx = ctrl.target.x - cam.position.x;
    const dz = ctrl.target.z - cam.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    
    let forwardX = 0;
    let forwardZ = -1;
    if (len > 0.0001) {
      forwardX = dx / len;
      forwardZ = dz / len;
    }
    const rightX = -forwardZ;
    const rightZ = forwardX;

    let moveX = 0;
    let moveZ = 0;

    if (state.keysPressed.arrowUp) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (state.keysPressed.arrowDown) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (state.keysPressed.arrowLeft) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (state.keysPressed.arrowRight) {
      moveX += rightX;
      moveZ += rightZ;
    }

    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 0) {
      const step = 1.5 * dt;
      const transX = (moveX / moveLen) * step;
      const transZ = (moveZ / moveLen) * step;

      // Restrict horizontal offset to a safe range (e.g. [-5.0, 5.0])
      const newOffsetX = clampAndRound(state.cameraOffsetX + transX, -5.0, 5.0, 0.01);
      const newOffsetZ = clampAndRound(state.cameraOffsetZ + transZ, -5.0, 5.0, 0.01);

      const actualTransX = newOffsetX - state.cameraOffsetX;
      const actualTransZ = newOffsetZ - state.cameraOffsetZ;

      if (Math.abs(actualTransX) > 0.0001 || Math.abs(actualTransZ) > 0.0001) {
        state.cameraOffsetX = newOffsetX;
        state.cameraOffsetZ = newOffsetZ;

        viewportManager.panCamera(actualTransX, actualTransZ);
      }
    }
  }

  // 1. Apply camera orbit rotation
  if (state.autoOrbit && !benchmarkSuite.isActive()) {
    viewportManager.autoRotate(dt, state.rotateSpeed);
  }


  // 2. Drive benchmark automated path
  if (isSequentialBenchmarkRunning || benchmarkSuite.isActive() || offscreenBenchmark.getIsRunning()) {
    if (benchmarkSuite.isActive()) {
      const cameras = viewportManager.getCameras();
      const controls = viewportManager.getControls();
      benchmarkSuite.update(dt, cameras, controls);
    }
    benchmarkElapsedTime += dt;
    const targetBenchSec = getResolvedBenchmarkDuration();
    const currentAlgoName = availableAlgorithms[currentBenchmarkAlgoIndex]?.name || 'Algorithm';
    valBenchState.textContent = `Benchmarking (${currentBenchmarkAlgoIndex + 1}/${availableAlgorithms.length}): ${currentAlgoName}... ${benchmarkElapsedTime.toFixed(1)}s / ${targetBenchSec.toFixed(1)}s`;

    if (benchmarkElapsedTime >= targetBenchSec) {
      recordResultsForAlgo(currentBenchmarkAlgoIndex);
      currentBenchmarkAlgoIndex++;
      if (currentBenchmarkAlgoIndex < availableAlgorithms.length) {
        startBenchmarkForAlgo(currentBenchmarkAlgoIndex);
      } else {
        stopBenchmarkAndShowModal();
      }
    }
  }

  // 3. Drive continuous wave motion when erosion is inactive AND there is no paused eroded state
  const hasCachedHeightmap = state.heightmapCache.some(cache => cache !== null);
  if (!state.isErosionActive && !hasCachedHeightmap && !benchmarkSuite.isActive()) {
    state.animationTime += dt * 0.55 * state.noiseSpeed;
    state.params.offsetX = state.animationTime * 1.8;
    state.params.offsetY = state.animationTime * 1.2;
  } else {
    // Lock coordinates to allow erosion droplets to wear away the same grid nodes, or to freeze the viewport on the paused eroded state
    state.params.offsetX = 0;
    state.params.offsetY = 0;
  }

  // 4. Evaluate physical erosion
  // Uses base state.resolution directly since the tessellation multiplier is now fully integrated.
  const activeRes = state.resolution;
  if (state.isErosionActive) {
    erosionElapsedTime += dt;
    if (erosionStatusBadge) erosionStatusBadge.classList.remove('hidden');

    const targetSec = getResolvedErosionDuration();
    if (targetSec === 'infinite') {
      if (lblErosionProgress) lblErosionProgress.textContent = `Eroding... ${erosionElapsedTime.toFixed(1)}s (Infinite)`;
    } else {
      if (lblErosionProgress) lblErosionProgress.textContent = `Eroding... ${erosionElapsedTime.toFixed(1)}s / ${targetSec.toFixed(1)}s`;
      if (erosionElapsedTime >= targetSec) {
        state.isErosionActive = false;
        syncErosionButtonUI();
        if (lblErosionProgress) lblErosionProgress.textContent = `Paused at ${targetSec.toFixed(1)}s`;
      }
    }

    pipelines.forEach((p, i) => {
      if (!viewportManager.getRenderer(i)) return;
      if (!state.heightmapCache[i]) {
        state.heightmapCache[i] = p.generateBase(activeRes, activeRes, state.params);
      }
      // Delegate frame ticking to the pipeline
      p.tickPhysics(state.heightmapCache[i]!, dt);
    });
  }

  // 5. Draw active viewports (pause main-thread WebGL rendering when OffscreenCanvas worker mode is active or when canvas render is not due)
  let totalBenchmarkFps = 0;
  let totalBenchmarkFrametime = 0;
  let totalBenchmarkTime = 0;
  let totalBenchmarkMathTime = 0;
  let activeCount = 0;

  const isOffscreenCanvasActive = offscreenBenchmark.getIsRunning() && offscreenBenchmark.getCurrentMode() === 'offscreen';
  const statsMap = (!isCanvasRenderDue || isOffscreenCanvasActive)
    ? {}
    : viewportManager.update(state.params, activeRes, state.activePalette, state.showWireframe, state.heightmapCache, state.isErosionActive);


  for (let i = 0; i < availableAlgorithms.length; i++) {
    const r = viewportManager.getRenderer(i);
    if (!r || !metricsTrackers[i]) continue;
    const activeFocusedIdx = isSequentialBenchmarkRunning ? currentBenchmarkAlgoIndex : state.focusedIndex;
    const shouldRender = (state.viewMode === 'grid') || (state.viewMode === 'single' && i === activeFocusedIdx);

    if (shouldRender) {
      metricsTrackers[i].tick();
      const stats = statsMap[i] || undefined;

      if (stats) {
        metricsTrackers[i].addRenderTime(stats.renderTime);
        metricsTrackers[i].addMathTime(stats.mathTime);
        metricsTrackers[i].addRuggedness(stats.ruggedness);
      }


      
      // Use cached DOM elements instead of querying by ID on every frame
      const els = cachedMetricElements[i];
      
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
        if (offscreenBenchmark.getIsRunning() && i === focusedIdx && latestWorkerTelemetry) {
          const t = latestWorkerTelemetry;
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
  if (shouldUpdateDomMetrics && (benchmarkSuite.isActive() || isSequentialBenchmarkRunning)) {
    if (offscreenBenchmark.getIsRunning() && latestWorkerTelemetry) {
      const t = latestWorkerTelemetry;
      const fpsStr = `${t.fps} FPS`;
      if (valBenchFps && valBenchFps.textContent !== fpsStr) valBenchFps.textContent = fpsStr;

      const ftStr = `${t.fps > 0 ? (1000 / t.fps).toFixed(2) : '0.00'} ms`;
      if (valBenchFrametime && valBenchFrametime.textContent !== ftStr) valBenchFrametime.textContent = ftStr;

      const mathStr = `${t.avgMathTimeMs} ms (min: ${t.minMathTimeMs}ms, max: ${t.maxMathTimeMs}ms)`;
      if (valBenchMathTime && valBenchMathTime.textContent !== mathStr) valBenchMathTime.textContent = mathStr;

      const gpuStr = t.mode === 'headless' ? 'N/A (Headless Math)' : `${t.avgRenderTimeMs} ms (min: ${t.minRenderTimeMs}ms, max: ${t.maxRenderTimeMs}ms)`;
      if (valBenchGpuTime && valBenchGpuTime.textContent !== gpuStr) valBenchGpuTime.textContent = gpuStr;

      const framesStr = `${t.totalFrames.toLocaleString()} iterations`;
      if (valBenchTotalFrames && valBenchTotalFrames.textContent !== framesStr) valBenchTotalFrames.textContent = framesStr;
    } else if (activeCount > 0) {
      const avgFps = Math.round(totalBenchmarkFps / activeCount);
      const avgFrametime = (totalBenchmarkFrametime / activeCount).toFixed(2);
      const avgTime = (totalBenchmarkTime / activeCount).toFixed(2);
      const avgMath = (totalBenchmarkMathTime / activeCount).toFixed(2);

      if (valBenchFps) valBenchFps.textContent = `${avgFps} FPS`;
      if (valBenchFrametime) valBenchFrametime.textContent = `${avgFrametime} ms`;
      if (valBenchGpuTime) valBenchGpuTime.textContent = `${avgTime} ms`;
      if (valBenchMathTime) valBenchMathTime.textContent = `${avgMath} ms`;
      if (valBenchTotalFrames) valBenchTotalFrames.textContent = `VSync Loop`;
    }
  }

  if (shouldUpdateDomMetrics) {
    lastDomMetricUpdate = now;
  }

  requestAnimationFrame(animationLoop);
}


/**
 * Configures dynamic tooltip positioning at the document body level.
 * This is necessary because the viewport cards use overflow: hidden to clip
 * canvas dimensions, which would otherwise cut off absolute-positioned elements.
 */
function setupTooltips(): void {
  const metricItems = document.querySelectorAll('.metric-item, .has-tooltip');
  let activeTooltip: HTMLDivElement | null = null;

  metricItems.forEach((item) => {
    const template = item.querySelector('.tooltip-box') as HTMLDivElement | null;
    if (!template) return;

    let showTimeout: number | null = null;

    item.addEventListener('mouseenter', () => {
      // Do not display desktop hover tooltips on mobile viewports (<768px) or when mobile parameter modal is open
      if (window.innerWidth <= 768) return;
      const modal = document.getElementById('mobile-info-modal');
      if (modal && !modal.classList.contains('hidden')) return;

      // Clear any pending show timeout to avoid duplicate scheduling
      if (showTimeout) {
        window.clearTimeout(showTimeout);
        showTimeout = null;
      }


      // Schedule tooltip presentation with a delay to prevent intrusive popups during quick swipes
      showTimeout = window.setTimeout(() => {
        if (activeTooltip) {
          activeTooltip.remove();
          activeTooltip = null;
        }

        // Append a fresh tooltip instance directly to the body to escape parent clipping context
        activeTooltip = document.createElement('div');
        activeTooltip.className = 'global-tooltip-box';
        activeTooltip.innerHTML = template.innerHTML;
        document.body.appendChild(activeTooltip);

        // Force layout calculation by displaying it first
        activeTooltip.style.display = 'flex';

        const itemRect = item.getBoundingClientRect();
        const tooltipRect = activeTooltip.getBoundingClientRect();

        // Align horizontally centered with a 12px top spacing offset
        let left = itemRect.left + (itemRect.width / 2) - (tooltipRect.width / 2);
        let top = itemRect.top - tooltipRect.height - 12;

        // Ensure the tooltip does not run off the screen bounds
        if (left < 10) {
          left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
          left = window.innerWidth - tooltipRect.width - 10;
        }

        // Flip tooltip to render below the metric item if there is no vertical clearance above
        if (top < 10) {
          top = itemRect.bottom + 12;
        }

        activeTooltip.style.left = `${left}px`;
        activeTooltip.style.top = `${top}px`;
      }, 400); // 400ms delay for smoother user experience on quick sweeps
    });

    item.addEventListener('mouseleave', () => {
      // Clear the scheduled presentation if mouse leaves early
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

// ============================================================================
// MOBILE UI/UX HANDLERS
// ============================================================================
function setupMobileUI() {
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

  // Default to single focused view on mobile screens
  if (isMobile() && state.viewMode === 'grid') {
    state.viewMode = 'single';
    state.focusedIndex = 0;
    setViewMode('single', 0);
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
      // Only toggle via click if not coming from a significant touch drag
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
        // Dragging upward (negative deltaY): slide sheet up
        if (currentDeltaY < 0) {
          const collapsedOffset = window.innerHeight * 0.75 - 96;
          const translateY = Math.max(0, collapsedOffset + currentDeltaY);
          sidebar.style.transform = `translateY(${translateY}px)`;
        }
      } else {
        // Dragging downward (positive deltaY): slide sheet down
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


  // Mobile Tab Pill Switcher
  mobileAlgoTabs.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLButtonElement;
      const idxAttr = target.getAttribute('data-index');
      if (idxAttr !== null) {
        const idx = parseInt(idxAttr, 10);
        state.focusedIndex = idx;
        state.viewMode = 'single';
        setViewMode('single', idx);
        
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




  // Inject info targets with Lucide info icon into control groups for mobile parameter modals
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

          // Instantly dismiss any desktop hover tooltip overlays on screen
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

function setupMathAnalysisToggle() {
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

// Window resizing handler
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    viewportManager.resize();
  });

  // ============================================================================
  // APPLICATION INITIALIZATION
  // ============================================================================
  window.addEventListener('DOMContentLoaded', async () => {
    await initViewports();
    loadConfig();
    setupUIEvents();
    setupHotkeys();
    setupTooltips();
    setupMobileUI();
    setupMathAnalysisToggle();

    // Initial layout sizing pass
    requestAnimationFrame(() => {
      viewportManager.resize();
      
      // Start the animation loop
      requestAnimationFrame(animationLoop);

      // Fade out the loading screen once the first render cycle completes
      requestAnimationFrame(() => {
        const appContainer = document.querySelector('.app-container');
        appContainer?.classList.remove('loading');
      });
    });
  });
}




