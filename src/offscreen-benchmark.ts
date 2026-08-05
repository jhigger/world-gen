import type { BenchmarkMode, TelemetryPayload, WorkerIncomingMessage, WorkerSetModeMessage } from './worker';
import type { TerrainParams } from './algorithms/terrain-algorithm';

/**
 * Main-thread controller for the Offscreen Web Worker Benchmark Engine.
 * 
 * Orchestrates worker thread creation, OffscreenCanvas control transfer,
 * ResizeObserver canvas dimension synchronization, and telemetry UI updates.
 */
export class OffscreenBenchmarkManager {
  private worker: Worker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isRunning = false;
  private currentMode: BenchmarkMode = 'offscreen';
  private onTelemetryCallback?: (telemetry: TelemetryPayload) => void;

  /**
   * Checks browser feature support for OffscreenCanvas and Web Workers.
   */
  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Worker' in window &&
      'OffscreenCanvas' in window &&
      'transferControlToOffscreen' in HTMLCanvasElement.prototype
    );
  }

  /**
   * Initializes the benchmark worker engine with a target canvas.
   * 
   * @param canvas Target HTMLCanvasElement whose rendering control will be transferred.
   * @param container Parent container element observed by ResizeObserver.
   * @param algorithmName Active noise algorithm name.
   * @param params Noise parameters.
   * @param resolution Grid resolution.
   * @param onTelemetry Telemetry callback invoked on every 100ms batched report.
   * @param mode Benchmark engine execution mode ('offscreen' | 'headless' | 'vsync').
   * @param canvasFpsCap Visual FPS presentation cap for canvas updates.
   */
  public initialize(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    algorithmName: string,
    params: TerrainParams,
    resolution: number,
    onTelemetry: (telemetry: TelemetryPayload) => void,
    mode: BenchmarkMode = 'offscreen',
    canvasFpsCap: number = 60
  ): boolean {
    if (!OffscreenBenchmarkManager.isSupported()) {
      console.warn('OffscreenCanvas or Web Workers are not supported in this environment.');
      return false;
    }

    this.onTelemetryCallback = onTelemetry;
    this.currentMode = mode;

    try {
      // Create dedicated Web Worker using Vite module worker syntax
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      // Handle telemetry and control messages from worker
      this.worker.onmessage = (e: MessageEvent<TelemetryPayload>) => {
        if (e.data.type === 'telemetry' && this.onTelemetryCallback) {
          this.onTelemetryCallback(e.data);
        }
      };

      // Transfer canvas rendering control to worker thread
      const offscreen = canvas.transferControlToOffscreen();
      const rect = container.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;

      const initMessage: WorkerIncomingMessage = {
        type: 'init',
        canvas: offscreen,
        width: rect.width || 300,
        height: rect.height || 300,
        pixelRatio,
        resolution,
        algorithmName,
        params,
        mode,
        canvasFpsCap,
      };

      this.worker.postMessage(initMessage, [offscreen]);

      // Set up ResizeObserver to synchronize dimensions with worker
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && this.worker) {
            const resizeMsg: WorkerIncomingMessage = {
              type: 'resize',
              width,
              height,
            };
            this.worker.postMessage(resizeMsg);
          }
        }
      });
      this.resizeObserver.observe(container);

      return true;
    } catch (err) {
      console.error('Failed to initialize OffscreenBenchmarkManager:', err);
      return false;
    }
  }

  /**
   * Sets the active benchmark mode in the worker engine.
   */
  public setMode(mode: BenchmarkMode): void {
    this.currentMode = mode;
    if (!this.worker) return;
    const msg: WorkerSetModeMessage = { type: 'setMode', mode };
    this.worker.postMessage(msg);
  }

  /**
   * Starts the unthrottled compute & render loop inside the worker.
   */
  public start(mode?: BenchmarkMode): void {
    if (!this.worker) return;
    if (mode) {
      this.setMode(mode);
    }
    this.isRunning = true;
    const msg: WorkerIncomingMessage = { type: 'start' };
    this.worker.postMessage(msg);
  }

  /**
   * Stops the unthrottled benchmark loop.
   */
  public stop(): void {
    if (!this.worker) return;
    this.isRunning = false;
    const msg: WorkerIncomingMessage = { type: 'stop' };
    this.worker.postMessage(msg);
  }

  /**
   * Updates algorithm parameters or resolution on the worker engine.
   */
  public updateParams(
    algorithmName?: string,
    resolution?: number,
    params?: Partial<TerrainParams>,
    mode?: BenchmarkMode,
    canvasFpsCap?: number
  ): void {
    if (!this.worker) return;
    if (mode) {
      this.currentMode = mode;
    }
    const msg: WorkerIncomingMessage = {
      type: 'updateParams',
      algorithmName,
      resolution,
      params,
      mode,
      canvasFpsCap,
    };
    this.worker.postMessage(msg);
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentMode(): BenchmarkMode {
    return this.currentMode;
  }

  /**
   * Terminates worker and disconnects resize observer.
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isRunning = false;
  }
}
