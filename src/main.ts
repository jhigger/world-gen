import { availableAlgorithms } from './algorithms';
import { ViewportManager } from './viewport-manager';
import { HydraulicErosion } from './physics';
import { TerrainPipeline } from './pipeline';
import { state, stateObservable, clearHeightmapCaches } from './state';
import { loadConfig } from './storage';
import { BenchmarkOrchestrator } from './benchmark-orchestrator';
import { AnimationLoop } from './animation-loop';
import { UIManager } from './ui-manager';

// Re-export pure functions for test backwards-compatibility
export { isIntervalElapsed, getResolvedFps, shouldExecuteMathTick, shouldRenderCanvasFrame } from './animation-loop';

// ---------------------------------------------------------------------------
// APPLICATION WIRING
// ---------------------------------------------------------------------------

const hydraulicErosion = new HydraulicErosion();
export const orchestrator = new BenchmarkOrchestrator();
export const animationLoop = new AnimationLoop();
export const uiManager = new UIManager();

export const viewportManager = new ViewportManager({
  algorithms: availableAlgorithms,
  onStatsUpdate: (index, stats) => orchestrator.recordStats(index, stats),
  onGridModeChange: (mode, index) => uiManager.handleGridModeChange(mode, index),
  isSyncBlocked: () => orchestrator.benchmarkSuite.isActive(),
});

const pipelines: TerrainPipeline[] = availableAlgorithms.map(algo => {
  const p = new TerrainPipeline();
  p.setAlgorithm(algo);
  p.addFilter(hydraulicErosion);
  return p;
});

import type { BenchmarkMode } from './worker';

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => viewportManager.resize());

  window.addEventListener('DOMContentLoaded', async () => {
    orchestrator.setUI({
      panelBenchStatus: uiManager.panelBenchStatus,
      valBenchState: uiManager.valBenchState,
      btnBenchmark: uiManager.btnBenchmark,
      selectBenchmarkMode: uiManager.selectBenchmarkMode,
      setViewMode: (mode, idx) => viewportManager.setGridMode(mode, idx),
    });

    uiManager.init(stateObservable, viewportManager, {
      onToggleBenchmark: () => orchestrator.toggleBenchmarkMode(),
      onStartBenchmarkForCurrentMode: () => orchestrator.startBenchmarkForCurrentMode(),
      onCloseBenchmarkResultsModal: () => orchestrator.closeBenchmarkResultsModal(),
      onClearCaches: clearHeightmapCaches,
      onResetMetrics: () => orchestrator.resetAllMetricsTrackers(),
      onBenchmarkModeChange: (mode: BenchmarkMode) => orchestrator.setBenchmarkMode(mode),
    });

    if (uiManager.gridContainer) {
      await viewportManager.init(uiManager.gridContainer, availableAlgorithms, pipelines);
    }

    loadConfig();
    viewportManager.applySavedCameraState({
      zoom: state.savedZoom,
      yaw: state.savedYaw,
      pitch: state.savedPitch,
      offsetX: state.cameraOffsetX,
      offsetY: state.cameraOffsetY,
      offsetZ: state.cameraOffsetZ,
    });
    uiManager.syncDOMToState();

    requestAnimationFrame(() => {
      viewportManager.resize();

      animationLoop.start({
        state,
        viewportManager,
        orchestrator,
        uiManager,
        pipelines,
      });

      requestAnimationFrame(() => {
        document.querySelector('.app-container')?.classList.remove('loading');
      });
    });
  });
}
