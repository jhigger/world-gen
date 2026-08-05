import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainAlgorithm, TerrainParams } from './algorithms';
import { TerrainRenderer, ColorPalette, RenderStats } from './renderer';
import { TerrainPipeline } from './pipeline';

export interface CameraState {
  zoom: number;
  pitch: number;
  yaw: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

function clampAndRound(val: number, min: number, max: number, dec: number): number {
  const mult = dec < 1 && dec > 0 ? 1 / dec : Math.pow(10, dec);
  return Math.round(Math.max(min, Math.min(max, val)) * mult) / mult;
}

export interface ViewportManagerOptions {
  algorithms?: TerrainAlgorithm[];
  pipelines?: TerrainPipeline[];
  onStatsUpdate?: (index: number, stats: RenderStats) => void;
  onFrameTick?: (dt: number) => void;
  onGridModeChange?: (mode: 'grid' | 'single', focusedIndex: number) => void;
  isSyncBlocked?: () => boolean;
}

/**
 * ViewportManager
 * 
 * Deep module encapsulating 6 WebGL viewports, canvas resize observers,
 * camera orbit sync, camera navigation translation, and animation render loop ticks.
 */
export class ViewportManager {
  private containerElement: HTMLElement | null = null;
  private renderers: (TerrainRenderer | null)[] = [];
  private algorithms: TerrainAlgorithm[] = [];
  private pipelines: (TerrainPipeline | null)[] = [];
  private viewMode: 'grid' | 'single' = 'grid';
  private focusedIndex: number = 0;
  private isSyncing: boolean = false;
  private resizeObserver?: ResizeObserver;

  // Encapsulated camera spatial state
  public cameraState: CameraState = {
    zoom: 180,
    pitch: 0.8,
    yaw: 0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  };

  private options: ViewportManagerOptions;

  constructor(options: ViewportManagerOptions = {}) {
    this.options = options;
    if (options.algorithms) {
      this.algorithms = options.algorithms;
    }
    if (options.pipelines) {
      this.pipelines = options.pipelines;
    }
  }

  /**
   * Initializes WebGL viewports strictly within the provided container element.
   */
  async init(
    containerElement: HTMLElement,
    algorithms: TerrainAlgorithm[],
    pipelines?: TerrainPipeline[]
  ): Promise<void> {
    this.containerElement = containerElement;
    this.algorithms = algorithms;
    if (pipelines) {
      this.pipelines = pipelines;
    }
    this.renderers = new Array(algorithms.length).fill(null);

    for (let index = 0; index < algorithms.length; index++) {
      const algo = algorithms[index];
      const canvas = containerElement.querySelector(`#canvas-${index}`) as HTMLCanvasElement | null;

      if (!canvas) {
        console.warn(`Canvas element '#canvas-${index}' not found in containerElement, skipping viewport ${index}`);
        continue;
      }

      const renderer = new TerrainRenderer(canvas, algo);
      await renderer.init();

      const ctrl = renderer.getControls();
      ctrl.addEventListener('change', () => {
        if (this.isSyncing || (this.options.isSyncBlocked && this.options.isSyncBlocked())) return;
        this.syncCamerasFrom(index);
      });

      renderer.onStatsUpdate = (stats: RenderStats) => {
        if (this.options.onStatsUpdate) {
          this.options.onStatsUpdate(index, stats);
        }
      };

      this.renderers[index] = renderer;
    }

    if (containerElement && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(containerElement);
    }
  }

  /**
   * Sets terrain pipelines for simulation delegation.
   */
  public setPipelines(pipelines: TerrainPipeline[]): void {
    this.pipelines = pipelines;
  }

  /**
   * Returns registered terrain pipelines.
   */
  public getPipelines(): (TerrainPipeline | null)[] {
    return this.pipelines;
  }

  /**
   * Synchronizes cameras across all viewports from a source viewport index.
   */
  public syncCamerasFrom(sourceIndex: number): void {
    const sourceRenderer = this.renderers[sourceIndex];
    if (!sourceRenderer) return;

    this.isSyncing = true;
    try {
      const sourceCam = sourceRenderer.getCamera();
      const sourceTarget = sourceRenderer.getControls().target;

      this.renderers.forEach((r, idx) => {
        if (idx === sourceIndex || !r) return;
        r.getCamera().position.copy(sourceCam.position);
        r.getControls().target.copy(sourceTarget);
        r.getControls().update();
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Applies camera state across all viewports.
   */
  public applySavedCameraState(state: Partial<CameraState>): void {
    this.cameraState = { ...this.cameraState, ...state };

    if (this.cameraState.zoom === 0 || !this.renderers.some((r) => r !== null)) return;

    const { zoom, pitch, yaw, offsetX, offsetY, offsetZ } = this.cameraState;
    const distance = 500 / zoom;
    const x = distance * Math.sin(pitch) * Math.sin(yaw);
    const y = distance * Math.cos(pitch);
    const z = distance * Math.sin(pitch) * Math.cos(yaw);

    this.isSyncing = true;
    try {
      this.renderers.forEach((r) => {
        if (!r) return;
        const cam = r.getCamera();
        const ctrl = r.getControls();
        cam.position.set(x + offsetX, y + offsetY, z + offsetZ);
        ctrl.target.set(offsetX, offsetY, offsetZ);
        ctrl.update();
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Translates camera height (Y axis offset) across all synchronized viewports.
   */
  public translateCameraHeight(diffY: number): void {
    if (Math.abs(diffY) <= 0.0001) return;

    this.isSyncing = true;
    try {
      this.renderers.forEach((r) => {
        if (!r) return;
        const cam = r.getCamera();
        const ctrl = r.getControls();
        cam.position.y += diffY;
        ctrl.target.y += diffY;
        ctrl.update();
      });
      this.cameraState.offsetY += diffY;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pans camera horizontally (X/Z axes) across all synchronized viewports.
   */
  public panCamera(transX: number, transZ: number): void {
    if (Math.abs(transX) <= 0.0001 && Math.abs(transZ) <= 0.0001) return;

    this.isSyncing = true;
    try {
      this.renderers.forEach((r) => {
        if (!r) return;
        const cam = r.getCamera();
        const ctrl = r.getControls();
        cam.position.x += transX;
        cam.position.z += transZ;
        ctrl.target.x += transX;
        ctrl.target.z += transZ;
        ctrl.update();
      });
      this.cameraState.offsetX += transX;
      this.cameraState.offsetZ += transZ;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Navigates camera horizontally (X/Z plane) based on directional keys relative to camera orientation.
   */
  public navigateCamera(
    keys: { arrowUp?: boolean; arrowDown?: boolean; arrowLeft?: boolean; arrowRight?: boolean },
    dt: number
  ): void {
    const activeRenderer = this.getActiveRenderer();
    if (!activeRenderer) return;

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

    if (keys.arrowUp) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (keys.arrowDown) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (keys.arrowLeft) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (keys.arrowRight) {
      moveX += rightX;
      moveZ += rightZ;
    }

    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 0) {
      const step = 1.5 * dt;
      const transX = (moveX / moveLen) * step;
      const transZ = (moveZ / moveLen) * step;

      const newOffsetX = clampAndRound(this.cameraState.offsetX + transX, -5.0, 5.0, 2);
      const newOffsetZ = clampAndRound(this.cameraState.offsetZ + transZ, -5.0, 5.0, 2);

      const actualTransX = newOffsetX - this.cameraState.offsetX;
      const actualTransZ = newOffsetZ - this.cameraState.offsetZ;

      if (Math.abs(actualTransX) > 0.0001 || Math.abs(actualTransZ) > 0.0001) {
        this.panCamera(actualTransX, actualTransZ);
      }
    }
  }

  /**
   * Navigates camera vertically (Y axis) based on space/shift keys.
   */
  public navigateVerticalCamera(
    keys: { space?: boolean; shift?: boolean },
    dt: number
  ): void {
    if (!keys.space && !keys.shift) return;
    const shiftStep = 1.5 * dt;
    let diffY = 0;
    if (keys.space) {
      diffY = shiftStep;
    } else if (keys.shift) {
      diffY = -shiftStep;
    }
    const newOffsetY = clampAndRound(this.cameraState.offsetY + diffY, -5.0, 5.0, 2);
    const actualDiffY = newOffsetY - this.cameraState.offsetY;
    if (Math.abs(actualDiffY) > 0.0001) {
      this.translateCameraHeight(actualDiffY);
    }
  }

  /**
   * Applies auto-rotation around target Y axis for synchronized viewports.
   */
  public autoRotate(dt: number, rotateSpeed: number): void {
    const activeRenderer = this.getActiveRenderer();
    if (!activeRenderer || rotateSpeed <= 0) return;

    const orbitAngle = dt * 0.12 * rotateSpeed;
    const cos = Math.cos(orbitAngle);
    const sin = Math.sin(orbitAngle);

    this.isSyncing = true;
    try {
      const baseCam = activeRenderer.getCamera();
      const baseCtrl = activeRenderer.getControls();

      const dx = baseCam.position.x - baseCtrl.target.x;
      const dz = baseCam.position.z - baseCtrl.target.z;

      const newX = dx * cos - dz * sin + baseCtrl.target.x;
      const newZ = dx * sin + dz * cos + baseCtrl.target.z;

      baseCam.position.x = newX;
      baseCam.position.z = newZ;
      baseCam.lookAt(baseCtrl.target);
      baseCtrl.update();

      const activeIdx = this.viewMode === 'single' ? this.focusedIndex : 0;
      this.renderers.forEach((r, idx) => {
        if (!r || idx === activeIdx) return;
        r.getCamera().position.copy(baseCam.position);
        r.getControls().target.copy(baseCtrl.target);
        r.getControls().update();
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Switches view mode between grid layout and single focused view cleanly.
   */
  public setGridMode(mode: 'grid' | 'single', singleAlgorithmNameOrIndex?: string | number): void {
    this.viewMode = mode;

    if (singleAlgorithmNameOrIndex !== undefined) {
      if (typeof singleAlgorithmNameOrIndex === 'number') {
        this.focusedIndex = singleAlgorithmNameOrIndex;
      } else {
        const foundIdx = this.algorithms.findIndex((a) => a.name === singleAlgorithmNameOrIndex);
        if (foundIdx >= 0) {
          this.focusedIndex = foundIdx;
        }
      }
    }

    if (this.containerElement) {
      if (mode === 'single') {
        this.containerElement.classList.add('single-view');
        this.renderers.forEach((_, i) => {
          const card = this.containerElement?.querySelector(`#card-${i}`) || (typeof document !== 'undefined' ? document.getElementById(`card-${i}`) : null);
          if (card) {
            if (i === this.focusedIndex) {
              card.classList.add('focused');
            } else {
              card.classList.remove('focused');
            }
          }
        });
      } else {
        this.containerElement.classList.remove('single-view');
        this.renderers.forEach((_, i) => {
          const card = this.containerElement?.querySelector(`#card-${i}`) || (typeof document !== 'undefined' ? document.getElementById(`card-${i}`) : null);
          if (card) {
            card.classList.remove('focused');
          }
        });
      }
    }

    if (this.options.onGridModeChange) {
      this.options.onGridModeChange(this.viewMode, this.focusedIndex);
    }

    // Request reflow resize
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.resize();
        });
      });
    } else {
      this.resize();
    }
  }

  /**
   * Checks whether a specific algorithm viewport is active and visible given override focused index.
   */
  public isViewportActive(index: number, overrideFocusedIndex?: number): boolean {
    if (this.renderers.length > 0 && !this.renderers[index]) return false;
    const activeFocused = overrideFocusedIndex !== undefined ? overrideFocusedIndex : this.focusedIndex;
    return this.viewMode === 'grid' || (this.viewMode === 'single' && index === activeFocused);
  }

  /**
   * Executes render pass for active viewports.
   */
  public update(
    params: TerrainParams,
    resolution: number,
    palette: ColorPalette,
    showWireframe: boolean,
    customHeightmaps?: (number[][] | null | undefined)[],
    forceDirty: boolean = false
  ): Record<number, RenderStats | void> {
    const statsResult: Record<number, RenderStats | void> = {};

    for (let i = 0; i < this.algorithms.length; i++) {
      if (!this.isViewportActive(i)) continue;

      const customMap = customHeightmaps && customHeightmaps[i] ? customHeightmaps[i]! : undefined;
      const stats = this.renderers[i]!.render(
        params,
        resolution,
        palette,
        showWireframe,
        customMap,
        forceDirty
      );
      statsResult[i] = stats;
    }

    return statsResult;
  }

  /**
   * Resizes all initialized WebGL viewports.
   */
  public resize(): void {
    this.renderers.forEach((r) => {
      if (r) r.resize();
    });
  }

  /**
   * Gets active camera instances for benchmarking.
   */
  public getCameras(): THREE.PerspectiveCamera[] {
    return this.renderers
      .filter((r): r is TerrainRenderer => r !== null)
      .map((r) => r.getCamera());
  }

  /**
   * Gets active controls instances for benchmarking.
   */
  public getControls(): OrbitControls[] {
    return this.renderers
      .filter((r): r is TerrainRenderer => r !== null)
      .map((r) => r.getControls());
  }

  /**
   * Returns array of renderers.
   */
  public getRenderers(): (TerrainRenderer | null)[] {
    return this.renderers;
  }

  /**
   * Returns renderer for a specific index.
   */
  public getRenderer(index: number): TerrainRenderer | null {
    return this.renderers[index] || null;
  }

  /**
   * Returns active renderer based on current view mode and focused index.
   */
  public getActiveRenderer(): TerrainRenderer | null {
    if (this.viewMode === 'single' && this.renderers[this.focusedIndex]) {
      return this.renderers[this.focusedIndex];
    }
    return this.renderers[0] || this.renderers.find((r) => r !== null) || null;
  }

  /**
   * Computes current active camera spherical coordinates snapshot for persistence.
   */
  public getSphericalCameraSnapshot(): { zoom: number; pitch: number; yaw: number; offsetX: number; offsetY: number; offsetZ: number } | undefined {
    const activeRenderer = this.getActiveRenderer();
    if (!activeRenderer || (this.options.isSyncBlocked && this.options.isSyncBlocked())) return undefined;
    const cam = activeRenderer.getCamera();
    const ctrl = activeRenderer.getControls();

    const dx = cam.position.x - ctrl.target.x;
    const dy = cam.position.y - ctrl.target.y;
    const dz = cam.position.z - ctrl.target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      zoom: Math.round(500 / distance),
      pitch: Math.acos(Math.max(-1, Math.min(1, dy / distance))),
      yaw: Math.atan2(dx, dz) >= 0 ? Math.atan2(dx, dz) : Math.atan2(dx, dz) + 2 * Math.PI,
      offsetX: ctrl.target.x,
      offsetY: ctrl.target.y,
      offsetZ: ctrl.target.z
    };
  }

  public getViewMode(): 'grid' | 'single' {
    return this.viewMode;
  }

  public getFocusedIndex(): number {
    return this.focusedIndex;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public setIsSyncing(val: boolean): void {
    this.isSyncing = val;
  }

  /**
   * Disposes of all viewports and observers.
   */
  public dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.renderers.forEach((r) => {
      if (r) r.dispose();
    });
    this.renderers = [];
  }
}
