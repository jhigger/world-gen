import * as THREE from 'three';
import { availableAlgorithms } from './algorithms';
import type { TerrainParams } from './algorithms/terrain-algorithm';

type ColorPalette = 'topo' | 'water' | 'magma' | 'monochrome';

// Simple palette mapping copied from renderer for async preview rendering
const palettes: Record<ColorPalette, { offset: number; color: { r: number; g: number; b: number } }[]> = {
  topo: [
    { offset: 0.0, color: { r: 0, g: 0.2, b: 0.6 } },     // Deep water
    { offset: 0.3, color: { r: 0.1, g: 0.6, b: 0.8 } },   // Shallow water
    { offset: 0.35, color: { r: 0.9, g: 0.8, b: 0.6 } },  // Sand
    { offset: 0.45, color: { r: 0.2, g: 0.6, b: 0.2 } },  // Forest
    { offset: 0.7, color: { r: 0.4, g: 0.3, b: 0.2 } },   // Dirt/Rock
    { offset: 0.9, color: { r: 0.9, g: 0.9, b: 0.9 } },   // Snow
    { offset: 1.0, color: { r: 1.0, g: 1.0, b: 1.0 } },    // Ice
  ],
  magma: [
    { offset: 0.0, color: { r: 0, g: 0, b: 0 } },         // Obsidian
    { offset: 0.4, color: { r: 0.4, g: 0, b: 0 } },       // Dark Red
    { offset: 0.7, color: { r: 1.0, g: 0.3, b: 0 } },     // Orange
    { offset: 0.9, color: { r: 1.0, g: 0.8, b: 0 } },     // Yellow
    { offset: 1.0, color: { r: 1.0, g: 1.0, b: 1.0 } },    // White hot
  ],
  monochrome: [
    { offset: 0.0, color: { r: 0.1, g: 0.1, b: 0.1 } },
    { offset: 1.0, color: { r: 0.9, g: 0.9, b: 0.9 } },
  ],
  water: [],
};

function setColorForHeight(h: number, maxH: number, palette: ColorPalette, colors: Float32Array, idx3: number): void {
  const safeMax = maxH === 0 ? 1 : maxH;
  const ratio = Math.max(0, Math.min(1.0, h / safeMax));

  if (palette === 'water') {
    if (ratio < 0.3) {
      const t = ratio / 0.3;
      colors[idx3] = (10 + t * 10) / 255;
      colors[idx3 + 1] = (25 + t * 45) / 255;
      colors[idx3 + 2] = (80 + t * 40) / 255;
    } else if (ratio < 0.7) {
      const t = (ratio - 0.3) / 0.4;
      colors[idx3] = (20 + t * 20) / 255;
      colors[idx3 + 1] = (70 + t * 130) / 255;
      colors[idx3 + 2] = (120 + t * 105) / 255;
    } else {
      const t = (ratio - 0.7) / 0.3;
      colors[idx3] = (40 + t * 215) / 255;
      colors[idx3 + 1] = (200 + t * 55) / 255;
      colors[idx3 + 2] = (225 + t * 30) / 255;
    }
    return;
  }

  const stops = palettes[palette] || palettes.topo;
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].offset && ratio <= stops[i + 1].offset) {
      const range = stops[i + 1].offset - stops[i].offset;
      const factor = (ratio - stops[i].offset) / range;
      const c1 = stops[i].color;
      const c2 = stops[i + 1].color;

      colors[idx3] = c1.r + (c2.r - c1.r) * factor;
      colors[idx3 + 1] = c1.g + (c2.g - c1.g) * factor;
      colors[idx3 + 2] = c1.b + (c2.b - c1.b) * factor;
      return;
    }
  }

  const lastC = stops[stops.length - 1].color;
  colors[idx3] = lastC.r;
  colors[idx3 + 1] = lastC.g;
  colors[idx3 + 2] = lastC.b;
}

// ============================================================================
// TYPES & MESSAGES FOR OFFSCREEN ENGINE
// ============================================================================

export type BenchmarkMode = 'offscreen' | 'headless' | 'vsync';

export type WorkerInitMessage = {
  type: 'init';
  canvas?: OffscreenCanvas;
  width: number;
  height: number;
  pixelRatio: number;
  resolution: number;
  algorithmName: string;
  params: TerrainParams;
  mode?: BenchmarkMode;
  canvasFpsCap?: number;
};

export type WorkerSetModeMessage = {
  type: 'setMode';
  mode: BenchmarkMode;
};

export type WorkerResizeMessage = {
  type: 'resize';
  width: number;
  height: number;
};

export type WorkerUpdateParamsMessage = {
  type: 'updateParams';
  algorithmName?: string;
  resolution?: number;
  params?: Partial<TerrainParams>;
  mode?: BenchmarkMode;
  canvasFpsCap?: number;
};

export type WorkerStartMessage = {
  type: 'start';
};

export type WorkerStopMessage = {
  type: 'stop';
};

export type WorkerIncomingMessage =
  | WorkerInitMessage
  | WorkerSetModeMessage
  | WorkerResizeMessage
  | WorkerUpdateParamsMessage
  | WorkerStartMessage
  | WorkerStopMessage;

export type TelemetryPayload = {
  type: 'telemetry';
  fps: number;
  avgMathTimeMs: number;
  avgRenderTimeMs: number;
  totalFrames: number;
  minMathTimeMs: number;
  maxMathTimeMs: number;
  minRenderTimeMs: number;
  maxRenderTimeMs: number;
  mode: BenchmarkMode;
};

// ============================================================================
// WORKER ENGINE STATE
// ============================================================================

let renderer: THREE.WebGLRenderer | null = null;
let standaloneCanvas: OffscreenCanvas | null = null;
let presentationBitmapCtx: ImageBitmapRenderingContext | null = null;

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let mesh: THREE.Mesh | null = null;
let geometry: THREE.BufferGeometry | null = null;
let currentPixelRatio = 1;

// Benchmark Execution Mode
let currentMode: BenchmarkMode = 'offscreen';
let canvasFpsCap = 60;

// Static pre-allocated TypedArrays for Zero-GC in-place mutation
let currentResolution = 64;
let heightMap: Float32Array = new Float32Array(0);
let positions: Float32Array = new Float32Array(0);
let colors: Float32Array = new Float32Array(0);

// Active noise algorithm configuration
let activeAlgoName = 'Perlin Noise';
let activeParams: TerrainParams = {
  scale: 20,
  octaves: 4,
  persistence: 0.5,
  heightScale: 10,
  widthScale: 1,
  seed: 42,
  offsetX: 0,
  offsetY: 0,
};

// Execution state
let isRunning = false;
let isWarmupPending = true;
let lastVisualPresentTime = 0;

// Zero-delay Unthrottled Compute Loop driven by MessageChannel
let messageChannel: MessageChannel | null = null;

// Telemetry accumulation (Batched Performance Telemetry every 100ms)
export type TelemetryAccumulator = {
  frameCount: number;
  mathSumMs: number;
  renderSumMs: number;
  minMathMs: number;
  maxMathMs: number;
  minRenderMs: number;
  maxRenderMs: number;
  lastTimeMs: number;
  totalEvaluated: number;
};

const telemetryAcc: TelemetryAccumulator = {
  frameCount: 0,
  mathSumMs: 0,
  renderSumMs: 0,
  minMathMs: Infinity,
  maxMathMs: -Infinity,
  minRenderMs: Infinity,
  maxRenderMs: -Infinity,
  lastTimeMs: 0,
  totalEvaluated: 0,
};

// ============================================================================
// PROCEDURAL HEIGHTMAP GENERATION (FLAT ZERO-GC EVALUATION)
// ============================================================================

function evaluateHeightmap(): void {
  const algoEntry = availableAlgorithms.find((a) => a.name === activeAlgoName) || availableAlgorithms[0];

  // Evaluate heightmap into static flat array directly (Zero GC, no redundant 2D array allocation)
  for (let y = 0; y < currentResolution; y++) {
    const rowOffset = y * currentResolution;
    for (let x = 0; x < currentResolution; x++) {
      const h = algoEntry.evaluate(x, y, activeParams);
      heightMap[rowOffset + x] = h;
    }
  }
}

// ============================================================================
// THREE.JS MESH & BUFFER INITIALIZATION FOR OFFSCREEN ENGINE
// ============================================================================

function setupGeometry(resolution: number): void {
  currentResolution = resolution;
  const vertCount = resolution * resolution;

  // Re-allocate static typed buffers strictly when resolution reconfigures
  heightMap = new Float32Array(vertCount);
  positions = new Float32Array(vertCount * 3);
  colors = new Float32Array(vertCount * 3);

  const halfRes = (resolution - 1) / 2;
  const step = 20 / resolution;

  // Initialize initial X and Z grid coordinates once
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const idx = y * resolution + x;
      const idx3 = idx * 3;
      positions[idx3] = (x - halfRes) * step;     // X position
      positions[idx3 + 1] = 0;                   // Y height (updated per frame)
      positions[idx3 + 2] = (y - halfRes) * step; // Z position

      // Default baseline vertex color (emerald green gradient)
      colors[idx3] = 0.1 + (x / resolution) * 0.3;
      colors[idx3 + 1] = 0.5 + (y / resolution) * 0.4;
      colors[idx3 + 2] = 0.3;
    }
  }

  // Generate index array for plane triangles using Zero-GC typed array allocation
  const numQuads = (resolution - 1) * (resolution - 1);
  const indices = new Uint32Array(numQuads * 6);
  let ptr = 0;
  for (let y = 0; y < resolution - 1; y++) {
    for (let x = 0; x < resolution - 1; x++) {
      const a = y * resolution + x;
      const b = y * resolution + (x + 1);
      const c = (y + 1) * resolution + x;
      const d = (y + 1) * resolution + (x + 1);

      indices[ptr++] = a;
      indices[ptr++] = c;
      indices[ptr++] = b;
      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = d;
    }
  }

  if (geometry) {
    geometry.dispose();
  }

  geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  if (!mesh && scene) {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.1,
      wireframe: false,
      side: THREE.DoubleSide,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  } else if (mesh) {
    mesh.geometry = geometry;
  }

  isWarmupPending = true;
}

function initThreeScene(canvas: OffscreenCanvas, width: number, height: number, pixelRatio: number): void {
  currentPixelRatio = pixelRatio;
  try {
    presentationBitmapCtx = canvas.getContext('bitmaprenderer') as ImageBitmapRenderingContext;
  } catch (err) {
    presentationBitmapCtx = null;
  }

  // Create standalone OffscreenCanvas in worker memory with ZERO VSYNC compositor attachment
  const renderWidth = Math.max(1, Math.floor(width * pixelRatio));
  const renderHeight = Math.max(1, Math.floor(height * pixelRatio));
  standaloneCanvas = new OffscreenCanvas(renderWidth, renderHeight);

  renderer = new THREE.WebGLRenderer({
    canvas: standaloneCanvas as unknown as HTMLCanvasElement,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // Dark slate dark mode background

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(18, 14, 18);
  camera.lookAt(0, 0, 0);

  // Lighting setup
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(20, 40, 20);
  scene.add(dirLight);

  const ambLight = new THREE.AmbientLight(0x404060, 0.8);
  scene.add(ambLight);

  setupGeometry(currentResolution);
}

// ============================================================================
// UNTHROTTLED ITERATION LOOP
// ============================================================================

function updateMeshPositionsAndColors(): void {
  if (!geometry) return;

  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const colAttr = geometry.attributes.color as THREE.BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  const colArr = colAttr.array as Float32Array;

  const count = currentResolution * currentResolution;
  for (let i = 0; i < count; i++) {
    const h = heightMap[i];
    const idx3 = i * 3;
    posArr[idx3 + 1] = h; // Set Y elevation

    // Color height mapping
    const normH = Math.max(0, Math.min(1, (h + 5) / 20));
    colArr[idx3] = 0.1 + normH * 0.8;
    colArr[idx3 + 1] = 0.3 + (1 - normH) * 0.5;
    colArr[idx3 + 2] = 0.6 * normH;
  }

  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

function runBenchmarkIteration(): void {
  let mathTimeMs = 0;
  let renderTimeMs = 0;

  if (currentMode === 'headless') {
    // 1. Measure CPU Math Execution Time in Headless Mode (no WebGL render or mesh update)
    const tMathStart = performance.now();
    evaluateHeightmap();
    mathTimeMs = performance.now() - tMathStart;
  } else {
    // Offscreen WebGL mode
    if (!renderer || !scene || !camera) return;

    // 1. Measure CPU Math Execution Time
    const tMathStart = performance.now();
    evaluateHeightmap();
    updateMeshPositionsAndColors();
    mathTimeMs = performance.now() - tMathStart;

    // Slowly rotate mesh to provide visual feedback
    if (mesh) {
      mesh.rotation.y += 0.005;
    }

    // 2. Measure Unthrottled GPU Render Execution Time
    const tRenderStart = performance.now();
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    gl.flush();
    renderTimeMs = performance.now() - tRenderStart;

    // 3. Present visual preview to presentation canvas dynamically capped by canvasFpsCap using zero-copy transferFromImageBitmap
    const now = performance.now();
    const visualPresentIntervalMs = 1000 / (canvasFpsCap > 0 ? canvasFpsCap : 60);
    if (now - lastVisualPresentTime >= visualPresentIntervalMs - 0.5 && presentationBitmapCtx && standaloneCanvas) {
      lastVisualPresentTime = now;
      try {
        const bitmap = standaloneCanvas.transferToImageBitmap();
        presentationBitmapCtx.transferFromImageBitmap(bitmap);
      } catch (err) {
        // Fallback if bitmap transfer is unsupported
      }
    }
  }

  // Handle Pipeline Warmup Frame (discard initial cold-start compilation metrics)
  if (isWarmupPending) {
    isWarmupPending = false;
    telemetryAcc.lastTimeMs = performance.now();
    return;
  }

  // Accumulate timing metrics
  telemetryAcc.frameCount++;
  telemetryAcc.totalEvaluated++;
  telemetryAcc.mathSumMs += mathTimeMs;
  telemetryAcc.renderSumMs += renderTimeMs;

  if (mathTimeMs < telemetryAcc.minMathMs) telemetryAcc.minMathMs = mathTimeMs;
  if (mathTimeMs > telemetryAcc.maxMathMs) telemetryAcc.maxMathMs = mathTimeMs;
  if (renderTimeMs < telemetryAcc.minRenderMs) telemetryAcc.minRenderMs = renderTimeMs;
  if (renderTimeMs > telemetryAcc.maxRenderMs) telemetryAcc.maxRenderMs = renderTimeMs;

  // 4. Batched Performance Telemetry Dispatch (Every 100ms interval)
  const now = performance.now();
  const elapsedMs = now - telemetryAcc.lastTimeMs;
  if (elapsedMs >= 100 && telemetryAcc.frameCount > 0) {
    const fps = (telemetryAcc.frameCount / elapsedMs) * 1000;
    const avgMathTimeMs = telemetryAcc.mathSumMs / telemetryAcc.frameCount;
    const avgRenderTimeMs = telemetryAcc.renderSumMs / telemetryAcc.frameCount;

    const payload: TelemetryPayload = {
      type: 'telemetry',
      fps: parseFloat(fps.toFixed(1)),
      avgMathTimeMs: parseFloat(avgMathTimeMs.toFixed(3)),
      avgRenderTimeMs: currentMode === 'headless' ? 0 : parseFloat(avgRenderTimeMs.toFixed(3)),
      totalFrames: telemetryAcc.totalEvaluated,
      minMathTimeMs: parseFloat(telemetryAcc.minMathMs.toFixed(3)),
      maxMathTimeMs: parseFloat(telemetryAcc.maxMathMs.toFixed(3)),
      minRenderTimeMs: currentMode === 'headless' ? 0 : parseFloat(telemetryAcc.minRenderMs.toFixed(3)),
      maxRenderTimeMs: currentMode === 'headless' ? 0 : parseFloat(telemetryAcc.maxRenderMs.toFixed(3)),
      mode: currentMode,
    };

    self.postMessage(payload);

    // Reset accumulator state
    telemetryAcc.frameCount = 0;
    telemetryAcc.mathSumMs = 0;
    telemetryAcc.renderSumMs = 0;
    telemetryAcc.minMathMs = Infinity;
    telemetryAcc.maxMathMs = -Infinity;
    telemetryAcc.minRenderMs = Infinity;
    telemetryAcc.maxRenderMs = -Infinity;
    telemetryAcc.lastTimeMs = now;
  }
}

function runBenchmarkBatch(): void {
  const batchStart = performance.now();
  // Time-sliced micro-batch: execute multiple unthrottled iterations per event tick
  // to completely bypass browser event loop VSYNC tick caps (180Hz)
  do {
    runBenchmarkIteration();
  } while (isRunning && (performance.now() - batchStart) < 2.5);
}

// Initialize time-sliced compute loop via MessageChannel with event-loop yield
function setupUnthrottledChannel(): void {
  messageChannel = new MessageChannel();
  messageChannel.port2.onmessage = () => {
    if (isRunning) {
      runBenchmarkBatch();
      if (isRunning) {
        messageChannel?.port1.postMessage(null);
      }
    }
  };
}

function startEngine(): void {
  if (isRunning) return;
  isRunning = true;
  isWarmupPending = true;
  telemetryAcc.frameCount = 0;
  telemetryAcc.mathSumMs = 0;
  telemetryAcc.renderSumMs = 0;
  telemetryAcc.lastTimeMs = performance.now();

  if (!messageChannel) {
    setupUnthrottledChannel();
  }
  // Kick off zero-delay unthrottled compute loop
  messageChannel?.port1.postMessage(null);
}

function resetWorkerAccumulators(): void {
  telemetryAcc.frameCount = 0;
  telemetryAcc.mathSumMs = 0;
  telemetryAcc.renderSumMs = 0;
  telemetryAcc.minMathMs = Infinity;
  telemetryAcc.maxMathMs = -Infinity;
  telemetryAcc.minRenderMs = Infinity;
  telemetryAcc.maxRenderMs = -Infinity;
  telemetryAcc.totalEvaluated = 0;
  telemetryAcc.lastTimeMs = performance.now();
  isWarmupPending = true;
}

function stopEngine(): void {
  isRunning = false;
}

// ============================================================================
// WORKER MESSAGE EVENT LISTENER
// Supports both single-request RPC for preview canvases AND offscreen engine commands.
// ============================================================================

self.onmessage = (e: MessageEvent<any>) => {
  const data = e.data;

  // Single-request RPC query from TerrainRenderer preview viewports
  if (!data.type && data.algorithmName) {
    const { algorithmName, params, resolution, palette, heightScale } = data;
    const algoEntry = availableAlgorithms.find((a) => a.name === algorithmName);
    if (!algoEntry) return;

    const startMath = performance.now();

    const heights = new Float32Array(resolution * resolution);
    const colors = new Float32Array(resolution * resolution * 3);

    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const h = algoEntry.evaluate(x, y, params);

        if (h < minElevation) minElevation = h;
        if (h > maxElevation) maxElevation = h;
        sum += h;
        sumSq += h * h;
        count++;

        const idx = y * resolution + x;
        heights[idx] = h;

        setColorForHeight(h, heightScale, palette, colors, idx * 3);
      }
    }

    const mean = sum / count;
    const ruggedness = Math.sqrt(Math.max(0, (sumSq / count) - mean * mean));
    const mathTime = performance.now() - startMath;

    const ctx: Worker = self as any;
    ctx.postMessage(
      {
        heights,
        colors,
        minElevation,
        maxElevation,
        ruggedness,
        mathTime,
      },
      [heights.buffer, colors.buffer] as unknown as any
    );
    return;
  }

  // Offscreen Benchmark Engine commands
  switch (data.type) {
    case 'init': {
      activeAlgoName = data.algorithmName;
      activeParams = { ...activeParams, ...data.params };
      currentResolution = data.resolution;
      if (data.mode) currentMode = data.mode;
      if (typeof data.canvasFpsCap === 'number') canvasFpsCap = data.canvasFpsCap;
      resetWorkerAccumulators();
      if (data.canvas) {
        initThreeScene(data.canvas, data.width, data.height, data.pixelRatio);
      }
      break;
    }
    case 'setMode': {
      currentMode = data.mode;
      resetWorkerAccumulators();
      break;
    }
    case 'start': {
      startEngine();
      break;
    }
    case 'stop': {
      stopEngine();
      break;
    }
    case 'resize': {
      if (renderer && camera) {
        renderer.setSize(data.width, data.height, false);
        if (standaloneCanvas) {
          standaloneCanvas.width = Math.max(1, Math.floor(data.width * currentPixelRatio));
          standaloneCanvas.height = Math.max(1, Math.floor(data.height * currentPixelRatio));
        }
        camera.aspect = data.width / data.height;
        camera.updateProjectionMatrix();
        resetWorkerAccumulators();
      }
      break;
    }
    case 'updateParams': {
      if (data.algorithmName) activeAlgoName = data.algorithmName;
      if (data.params) activeParams = { ...activeParams, ...data.params };
      if (data.resolution && data.resolution !== currentResolution) {
        setupGeometry(data.resolution);
      }
      if (data.mode) currentMode = data.mode;
      if (typeof data.canvasFpsCap === 'number') canvasFpsCap = data.canvasFpsCap;
      resetWorkerAccumulators();
      break;
    }
  }
};
