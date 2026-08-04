import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Tracks and averages rendering performance in a time window.
 * 
 * Uses a rolling window of samples to smooth out isolated CPU/GPU spikes,
 * presenting clean and stable FPS reads to the user.
 */
export class PerformanceMetrics {
  private renderTimes: number[] = [];
  private frameTimes: number[] = [];
  private allFrameTimes: number[] = [];
  private mathTimes: number[] = [];
  private lastFrameTime = 0;
  private readonly maxSamples = 30; // Sample window rolling size
  private readonly maxAllSamples = 500; // Max sample window for 1% low calculations
  private frameIndex = 0;
  private allFrameIndex = 0;
  private renderIndex = 0;
  private mathIndex = 0;

  // Cumulative tracking variables for global averages
  private totalFrameTimeSum = 0;
  private totalFrameTimeCount = 0;
  private totalRenderTimeSum = 0;
  private totalRenderTimeCount = 0;
  private totalMathTimeSum = 0;
  private totalMathTimeCount = 0;
  private totalRuggednessSum = 0;
  private totalRuggednessCount = 0;

  /**
   * Resets all tracked performance metrics and cumulative averages for a new configuration run.
   */
  reset(): void {
    this.renderTimes = [];
    this.frameTimes = [];
    this.allFrameTimes = [];
    this.mathTimes = [];
    this.lastFrameTime = 0;
    this.frameIndex = 0;
    this.allFrameIndex = 0;
    this.renderIndex = 0;
    this.mathIndex = 0;
    this.totalFrameTimeSum = 0;
    this.totalFrameTimeCount = 0;
    this.totalRenderTimeSum = 0;
    this.totalRenderTimeCount = 0;
    this.totalMathTimeSum = 0;
    this.totalMathTimeCount = 0;
    this.totalRuggednessSum = 0;
    this.totalRuggednessCount = 0;
  }

  /**
   * Registers a frame render call event.
   */
  tick(): void {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      if (this.frameTimes.length < this.maxSamples) {
        this.frameTimes.push(delta);
      } else {
        this.frameTimes[this.frameIndex] = delta;
        this.frameIndex = (this.frameIndex + 1) % this.maxSamples;
      }
      if (this.allFrameTimes.length < this.maxAllSamples) {
        this.allFrameTimes.push(delta);
      } else {
        this.allFrameTimes[this.allFrameIndex] = delta;
        this.allFrameIndex = (this.allFrameIndex + 1) % this.maxAllSamples;
      }
      this.totalFrameTimeSum += delta;
      this.totalFrameTimeCount++;
    }
    this.lastFrameTime = now;
  }

  /**
   * Registers execution elapsed time for terrain calculation.
   * @param ms Execution duration in milliseconds.
   */
  addRenderTime(ms: number): void {
    if (this.renderTimes.length < this.maxSamples) {
      this.renderTimes.push(ms);
    } else {
      this.renderTimes[this.renderIndex] = ms;
      this.renderIndex = (this.renderIndex + 1) % this.maxSamples;
    }
    this.totalRenderTimeSum += ms;
    this.totalRenderTimeCount++;
  }

  /**
   * Registers execution elapsed time for math calculation.
   * @param ms Math duration in milliseconds.
   */
  addMathTime(ms: number): void {
    if (this.mathTimes.length < this.maxSamples) {
      this.mathTimes.push(ms);
    } else {
      this.mathTimes[this.mathIndex] = ms;
      this.mathIndex = (this.mathIndex + 1) % this.maxSamples;
    }
    this.totalMathTimeSum += ms;
    this.totalMathTimeCount++;
  }

  /**
   * Registers terrain ruggedness value.
   * @param val Ruggedness coefficient.
   */
  addRuggedness(val: number): void {
    this.totalRuggednessSum += val;
    this.totalRuggednessCount++;
  }

  /**
   * Calculates rolling average Frames Per Second (FPS).
   */
  getFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.round(1000 / avgFrameTime);
  }

  /**
   * Retrieves rolling average frame duration in milliseconds.
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Retrieves rolling average math calculation duration in milliseconds.
   */
  getAverageMathTime(): number {
    if (this.mathTimes.length === 0) return 0;
    const avg = this.mathTimes.reduce((a, b) => a + b, 0) / this.mathTimes.length;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Retrieves rolling average rendering duration in milliseconds.
   */
  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    const avg = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Calculates global average Frames Per Second (FPS) since start/reset.
   */
  getGlobalAverageFPS(): number {
    if (this.totalFrameTimeCount === 0) return 0;
    const avgFrameTime = this.totalFrameTimeSum / this.totalFrameTimeCount;
    return Math.round(1000 / avgFrameTime);
  }

  /**
   * Helper function to compute 99th percentile frame duration in milliseconds.
   */
  private getP99FrameTime(): number {
    const samples = this.allFrameTimes.length > 0 ? this.allFrameTimes : this.frameTimes;
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const rank = Math.ceil(sorted.length * 0.99) - 1;
    const idx = Math.max(0, Math.min(rank, sorted.length - 1));
    return sorted[idx];
  }

  /**
   * Calculates 1% Low FPS based on the 99th percentile frame time (worst 1% frame pacing).
   */
  getGlobalOnePercentLowFPS(): number {
    const p99FrameTime = this.getP99FrameTime();
    return p99FrameTime > 0 ? Math.round(1000 / p99FrameTime) : 0;
  }

  /**
   * Retrieves the 99th percentile frame time duration in milliseconds.
   */
  getGlobalOnePercentLowFrameTime(): number {
    const p99FrameTime = this.getP99FrameTime();
    return parseFloat(p99FrameTime.toFixed(2));
  }

  /**
   * Retrieves global average frame duration in milliseconds since start/reset.
   */
  getGlobalAverageFrameTime(): number {
    if (this.totalFrameTimeCount === 0) return 0;
    const avg = this.totalFrameTimeSum / this.totalFrameTimeCount;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Retrieves global average math calculation duration in milliseconds since start/reset.
   */
  getGlobalAverageMathTime(): number {
    if (this.totalMathTimeCount === 0) return 0;
    const avg = this.totalMathTimeSum / this.totalMathTimeCount;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Retrieves global average rendering duration in milliseconds since start/reset.
   */
  getGlobalAverageRenderTime(): number {
    if (this.totalRenderTimeCount === 0) return 0;
    const avg = this.totalRenderTimeSum / this.totalRenderTimeCount;
    // Calculate average to two decimal places for higher tracking precision.
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Retrieves global average ruggedness coefficient since start/reset.
   */
  getGlobalAverageRuggedness(): number {
    if (this.totalRuggednessCount === 0) return 0;
    const avg = this.totalRuggednessSum / this.totalRuggednessCount;
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Clears rolling arrays and cumulative counters for a fresh test run.
   */
  clear(): void {
    this.reset();
  }
}

/**
 * Manages automated camera orbits during benchmark tests.
 * 
 * Drives Three.js cameras along spherical coordinate paths, rotating them
 * around the target (0,0,0) and updating their controls uniformly.
 */
export class BenchmarkSuite {
  private active = false;
  private timeElapsed = 0;



  isActive(): boolean {
    return this.active;
  }

  /**
   * Commences the benchmark sequence.
   */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.timeElapsed = 0;
  }

  /**
   * Terminates tests. Cameras remain at their final position.
   */
  stop(): void {
    this.active = false;
  }

  /**
   * Modulates camera positions dynamically around the origin target.
   * 
   * @param dt Elapsed delta time in seconds.
   * @param cameras Active PerspectiveCamera array to move.
   * @param controls Active OrbitControls array to update.
   */
  update(dt: number, cameras: PerspectiveCamera[], controls: OrbitControls[]): void {
    if (!this.active) return;
    this.timeElapsed += dt;

    // Spherical trajectory formulation:
    // - Orbit rotation (theta) increases linearly.
    // - Elevation polar angle (phi) modulates slowly via a sine wave.
    // - Distance radius (zoom) expands and shrinks using a cosine wave.
    const radius = 1.7 + Math.cos(this.timeElapsed * 1.0) * 0.5;
    const theta = this.timeElapsed * 0.45;
    const phi = 0.9 + Math.sin(this.timeElapsed * 0.7) * 0.25;

    // Convert spherical coordinates to cartesian coords
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    // Synchronize all cameras and update their controls
    cameras.forEach((cam, idx) => {
      cam.position.set(x, y, z);
      controls[idx].target.set(0, 0, 0);
      controls[idx].update();
    });
  }
}
