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

  private animFrameId: number | null = null;
  private isLoopRunning: boolean = false;
  private lastTime: number = performance.now();

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
      if (!this.renderers[i]) continue;
      const shouldRender = this.viewMode === 'grid' || (this.viewMode === 'single' && i === this.focusedIndex);

      if (shouldRender) {
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
   * Disposes of all viewports, observers, and render loops.
   */
  public dispose(): void {
    this.stopRenderLoop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.renderers.forEach((r) => {
      if (r) r.dispose();
    });
    this.renderers = [];
  }

  /**
   * Starts the animation render loop ticker.
   */
  public startRenderLoop(onTick?: (dt: number) => void): void {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    this.lastTime = performance.now();

    const loop = () => {
      if (!this.isLoopRunning) return;
      const now = performance.now();

      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.1) dt = 0.1;

      if (onTick) {
        onTick(dt);
      } else if (this.options.onFrameTick) {
        this.options.onFrameTick(dt);
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(loop);
    }
  }

  /**
   * Stops the animation render loop ticker.
   */
  public stopRenderLoop(): void {
    this.isLoopRunning = false;
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
