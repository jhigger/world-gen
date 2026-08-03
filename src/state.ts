import { ObservableState } from './observable-state';
import { ColorPalette } from './renderer';
import { TerrainParams, availableAlgorithms } from './algorithms';

export interface TerrainConfig {
  resolution: number;
  heightScale: number;
  widthScale: number;
  scale: number;
  octaves: number;
  persistence: number;
  palette: ColorPalette;
  isErosionActive: boolean;
  showWireframe: boolean;
  showMetrics: boolean;
  viewMode: 'grid' | 'single';

  focusedIndex: number;
  seed: number;
  rotateSpeed: number;
  noiseSpeed: number;
  fpsLimit: string;
  customFps: number;
  uiScale: number;
  zoom?: number;
  yaw?: number;
  pitch?: number;
  cameraOffsetY?: number;
  cameraOffsetX?: number;
  cameraOffsetZ?: number;
}

const initialState = {
  params: {
    scale: 50,
    octaves: 3,
    persistence: 0.5,
    heightScale: 0.8,
    widthScale: 2.0,
    seed: 67,
    offsetX: 0,
    offsetY: 0
  } as TerrainParams,
  resolution: 120,
  activePalette: 'topo' as ColorPalette,
  isErosionActive: false,
  showWireframe: false,
  showMetrics: true,
  autoOrbit: true,

  viewMode: 'grid' as 'grid' | 'single',
  focusedIndex: 0,
  rotateSpeed: 1.0,
  noiseSpeed: 0.0,
  fpsLimit: 'uncapped',
  customFps: 60,
  uiScale: 100,
  savedZoom: 180,
  savedYaw: 0.8,
  savedPitch: 0.8,
  cameraOffsetY: 0.5,
  cameraOffsetX: 0.0,
  cameraOffsetZ: 0.0,
  keysPressed: {
    space: false,
    shift: false,
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false
  },
  isSyncing: false,
  animationTime: 0,
  heightmapCache: new Array(availableAlgorithms.length).fill(null) as (number[][] | null)[]
};


export const stateObservable = new ObservableState(initialState);
export const state = stateObservable.data;

export function clearHeightmapCaches() {
  for (let i = 0; i < state.heightmapCache.length; i++) {
    state.heightmapCache[i] = null;
  }
}

export function resetStateToDefaults() {
  state.params.scale = 50;
  state.params.octaves = 3;
  state.params.persistence = 0.5;
  state.params.heightScale = 0.8;
  state.params.widthScale = 2.0;
  state.params.seed = 67;
  state.params.offsetX = 0;
  state.params.offsetY = 0;

  state.resolution = 120;
  state.activePalette = 'topo';
  state.isErosionActive = false;
  state.showWireframe = false;
  state.autoOrbit = true;
  state.viewMode = 'grid';
  state.focusedIndex = 0;

  state.rotateSpeed = 1.0;
  state.noiseSpeed = 0.0;
  state.fpsLimit = 'uncapped';
  state.customFps = 60;
  state.uiScale = 100;

  state.savedZoom = 180;
  state.savedYaw = 0.8;
  state.savedPitch = 0.8;
  state.cameraOffsetY = 0.5;
  state.cameraOffsetX = 0.0;
  state.cameraOffsetZ = 0.0;

  state.animationTime = 0;
  clearHeightmapCaches();
}
