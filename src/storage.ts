import { state, TerrainConfig } from './state';
import { ColorPalette } from './renderer';

export function saveConfig(cameraSnapshot?: { zoom: number; yaw: number; pitch: number; offsetX: number; offsetY: number; offsetZ: number }) {
  const config: TerrainConfig = {
    resolution: state.resolution,
    heightScale: state.params.heightScale,
    widthScale: state.params.widthScale,
    scale: state.params.scale,
    octaves: state.params.octaves,
    persistence: state.params.persistence,
    palette: state.activePalette,
    isErosionActive: state.isErosionActive,
    erosionDuration: state.erosionDuration,
    benchmarkDuration: state.benchmarkDuration,
    showWireframe: state.showWireframe,
    showMetrics: state.showMetrics,
    viewMode: state.viewMode,

    focusedIndex: state.focusedIndex,
    seed: state.params.seed,
    rotateSpeed: state.rotateSpeed,
    noiseSpeed: state.noiseSpeed,
    fpsLimit: state.fpsLimit,
    customFps: state.customFps,
    canvasFpsCap: state.canvasFpsCap,
    uiScale: state.uiScale
  };

  if (cameraSnapshot) {
    config.zoom = cameraSnapshot.zoom;
    config.yaw = cameraSnapshot.yaw;
    config.pitch = cameraSnapshot.pitch;
    config.cameraOffsetX = cameraSnapshot.offsetX;
    config.cameraOffsetY = cameraSnapshot.offsetY;
    config.cameraOffsetZ = cameraSnapshot.offsetZ;
  } else {
    // preserve old config if we don't have camera snapshot (e.g. benchmarking)
    try {
      const raw = localStorage.getItem('terrainforge_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.zoom === 'number') config.zoom = parsed.zoom;
        if (typeof parsed.yaw === 'number') config.yaw = parsed.yaw;
        if (typeof parsed.pitch === 'number') config.pitch = parsed.pitch;
        if (typeof parsed.cameraOffsetY === 'number') config.cameraOffsetY = parsed.cameraOffsetY;
        if (typeof parsed.cameraOffsetX === 'number') config.cameraOffsetX = parsed.cameraOffsetX;
        if (typeof parsed.cameraOffsetZ === 'number') config.cameraOffsetZ = parsed.cameraOffsetZ;
      }
    } catch (e) {
      console.warn('Failed to read existing camera state from localStorage:', e);
    }
  }

  try {
    localStorage.setItem('terrainforge_config', JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save config to localStorage:', e);
  }
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem('terrainforge_config');
    if (raw) {
      const config = JSON.parse(raw);
      
      if (typeof config.resolution === 'number') state.resolution = config.resolution;
      if (typeof config.heightScale === 'number') state.params.heightScale = config.heightScale;
      if (typeof config.widthScale === 'number') state.params.widthScale = config.widthScale;
      if (typeof config.scale === 'number') state.params.scale = config.scale;
      if (typeof config.octaves === 'number') state.params.octaves = config.octaves;
      if (typeof config.persistence === 'number') state.params.persistence = config.persistence;
      if (config.palette) state.activePalette = config.palette as ColorPalette;
      if (typeof config.isErosionActive === 'boolean') state.isErosionActive = config.isErosionActive;
      if (typeof config.erosionDuration === 'string') state.erosionDuration = config.erosionDuration;
      if (typeof config.benchmarkDuration === 'number') state.benchmarkDuration = config.benchmarkDuration;
      if (typeof config.showWireframe === 'boolean') state.showWireframe = config.showWireframe;
      if (typeof config.showMetrics === 'boolean') state.showMetrics = config.showMetrics;
      if (config.viewMode) state.viewMode = config.viewMode as 'grid' | 'single';

      if (typeof config.focusedIndex === 'number') state.focusedIndex = config.focusedIndex;
      
      if (typeof config.seed === 'number') state.params.seed = config.seed;
      if (typeof config.rotateSpeed === 'number') state.rotateSpeed = config.rotateSpeed;
      if (typeof config.noiseSpeed === 'number') state.noiseSpeed = config.noiseSpeed;
      if (typeof config.fpsLimit === 'string') state.fpsLimit = config.fpsLimit;
      if (typeof config.customFps === 'number') state.customFps = config.customFps;
      if (typeof config.canvasFpsCap === 'number') state.canvasFpsCap = config.canvasFpsCap;
      if (typeof config.uiScale === 'number') state.uiScale = config.uiScale;

      if (typeof config.zoom === 'number') state.savedZoom = config.zoom;
      if (typeof config.yaw === 'number') state.savedYaw = config.yaw;
      if (typeof config.pitch === 'number') state.savedPitch = config.pitch;
      if (typeof config.cameraOffsetY === 'number') state.cameraOffsetY = config.cameraOffsetY;
      if (typeof config.cameraOffsetX === 'number') state.cameraOffsetX = config.cameraOffsetX;
      if (typeof config.cameraOffsetZ === 'number') state.cameraOffsetZ = config.cameraOffsetZ;
    }
  } catch (e) {
    console.error('Failed to load terrain configuration from localStorage:', e);
  }
}
