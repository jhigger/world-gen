# 3D World Generation Algorithm Comparison & Benchmark Engine

A real-time, interactive 3D procedural terrain comparison engine built with **TypeScript**, **Three.js**, **HTML5 WebGL**, and **Web Workers**. 

This application renders and compares **6 major procedural noise and terrain generation algorithms** side-by-side in real-time, featuring multi-threaded Web Worker compute execution, hydraulic erosion simulation, mobile-responsive UI drawers, and a **Dual-Mode Unthrottled Benchmark Engine** capable of measuring hardware throughput past display refresh rate VSync caps.

---

## 🚀 Key Features

### 🌋 1. 6 Procedural Terrain Algorithms
Compare six distinct mathematical algorithms side-by-side in real-time:
1. **Perlin Noise**: Classic 2D grid gradient noise for smooth rolling hills.
2. **Simplex Noise**: Low-artifact simplex grid noise for natural terrain contours.
3. **Worley Noise**: Cellular (Voronoi) distance-based noise creating rocky, cratered landscapes.
4. **Diamond-Square**: Midpoint displacement fractal algorithm ideal for mountain ranges.
5. **Fault Formation**: Tectonic fault line displacement simulating geological uplift.
6. **Gabor Noise**: Anisotropic harmonic noise algorithm (2009) providing directional frequency control.

---

### ⚡ 2. Multi-Threaded Architecture
- **Dedicated Worker per Viewport**: Every canvas viewport spawns its own dedicated Web Worker (`src/worker.ts`), executing heightmap math and color mapping off the main UI thread.
- **Zero-GC TypedArray Mutations**: In-place mutation of pre-allocated flat `Float32Array` buffers prevents V8 garbage collection pauses during high-frequency updates.

---

### 📊 3. Dual-Mode Unthrottled Benchmark Engine
Bypass standard main-thread `requestAnimationFrame` VSync refresh rate limits (e.g. 60Hz/144Hz/180Hz) to test maximum hardware compute throughput:
- **Offscreen WebGL Mode**: Executes terrain generation and Three.js 3D WebGL rendering inside a Web Worker on an `OffscreenCanvas`. Uses `gl.finish()` for forced GPU queue synchronization and transfers 60Hz visual previews via zero-copy `ImageBitmap`.
- **Headless CPU Math Mode**: Bypasses GPU rendering entirely to measure raw CPU procedural noise algorithm throughput (evaluations/sec) directly into TypedArrays over a zero-delay `MessageChannel` microtask loop.
- **VSync rAF Mode**: Main-thread animation loop tied to browser VSync for evaluating real-world UI experience.

---

### 📱 4. Responsive UI & Mobile UX
- **Comparative Grid & Focus View**: Seamlessly switch between a 6-viewport grid layout and single-algorithm focus mode.
- **Mobile Bottom Sheet Drawer**: Responsive bottom sheet drawer, touch controls, parameter modal dialogs, and dynamic UI scale adaptation for mobile & tablet screens.
- **Color Palettes**: Topographical (Natural), Water (Hydro), Magma (Thermal), and Monochrome (Metallic).
- **Hydraulic Erosion**: Interactive real-time water drop erosion filter simulating terrain weathering.

---

## ⚡ Unthrottled Browser Benchmark Setup

To unlock rendering throughput past your monitor's physical refresh rate (e.g., past 60Hz/180Hz VSync limits), launch Chrome with hardware VSync disabled:

### Windows (PowerShell):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-gpu-vsync --disable-frame-rate-limit --user-data-dir="$env:TEMP\chrome-bench"
```

Then navigate to `http://localhost:5173`.

---

## 🛠️ Project Setup & Commands

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/jhigger/world-gen.git
cd world-gen

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```

### Production Build
```bash
# Compile TypeScript and build production bundle
npm run build
```

### Running Tests
```bash
# Execute Vitest unit test suite
npm test
```

---

## 📐 Architecture & Project Structure

```
world-gen/
├── index.html                  # Main application UI layout & controls
├── CONTEXT.md                  # Domain sitemap and architectural vocabulary
├── docs/
│   ├── adr/
│   │   ├── 0001-hydraulic-erosion-simulation.md
│   │   └── 0002-offscreen-worker-benchmark-engine.md
│   └── agents/                 # Agent skills & issue tracker documentation
├── src/
│   ├── algorithms.ts           # Procedural noise & terrain generator implementations
│   ├── benchmark.ts            # Performance metrics tracker & camera flight controller
│   ├── main.ts                 # Application entry point, state binding & DOM listeners
│   ├── observable-state.ts     # Deep Proxy reactive state store
│   ├── offscreen-benchmark.ts   # Main-thread controller for offscreen worker benchmark engine
│   ├── pipeline.ts             # Modular terrain pipeline and erosion filter framework
│   ├── renderer.ts             # Three.js WebGL viewport renderer
│   ├── state.ts                # Application configuration & persistence
│   └── worker.ts               # Web Worker dual-mode compute & offscreen render loop
└── vitest.config.ts            # Test runner configuration
```

---

## 📄 License
MIT License. Created for procedural terrain exploration and high-performance WebGL benchmarking.
