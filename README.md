# Comparison of common random terrain generation and noise algorithms to support informed decisions in game world generation

> **Research & Interactive Benchmark Suite**  
> An empirical evaluation and real-time comparison framework designed to support game developers, technical directors, and graphics engineers in making informed algorithmic choices for procedural world generation.

---

## 📜 Abstract & Research Overview

Procedural terrain generation is a foundational component of modern open-world video games, technical simulations, and virtual environments. However, selecting the appropriate procedural generation algorithm requires balancing visual realism, mathematical rugosity, CPU compute overhead, memory allocation patterns, and GPU rendering throughput.

This repository provides an **interactive, multi-threaded 3D benchmarking engine** and comparison framework that evaluates **six fundamental terrain generation algorithms**:

1. **Perlin Noise** (*Gradient Grid Noise*) — Classic 2D smooth terrain generation.
2. **Simplex Noise** (*Simplex Grid Noise*) — Reduced directional artifacting and lower computational complexity.
3. **Worley Noise** (*Cellular / Voronoi Noise*) — Distance-to-point metrics ideal for cratered, rocky, or biomorphic landscapes.
4. **Diamond-Square** (*Fractal Midpoint Displacement*) — High-frequency elevation variance for mountain ranges and islands.
5. **Fault Formation** (*Geological Uplift Displacement*) — Iterative step-displacement modeling tectonic activity and cliff profiles.
6. **Gabor Noise** (*Anisotropic Harmonic Frequency Noise, 2009*) — Directional and bandpass-limited spectral control for specialized terrain textures.

---

## 🚀 Key Features

### 🌋 1. 6-Viewport Comparative Grid & Focus Suite
- **Side-by-Side Real-Time Evaluation**: Renders all 6 procedural algorithms in a synchronized grid layout to analyze visual features, elevation profiles, and ruggedness metrics simultaneously.
- **Single-Algorithm Focus Mode**: Isolate any individual algorithm for deep parameter tweaking, camera orbits, and vertex wireframe inspection.

---

### ⚡ 2. Multi-Threaded Worker Architecture
- **Dedicated Web Worker per Viewport**: Every canvas viewport spawns its own dedicated Web Worker (`src/worker.ts`), offloading mathematical heightmap evaluations and vertex color calculations off the main UI thread.
- **Zero-GC TypedArray Mutations**: Uses in-place mutation of flat `Float32Array` buffers to prevent V8 garbage collection stuttering during continuous high-frequency parameter adjustments.

---

### 📊 3. Dual-Mode Unthrottled Benchmark Engine
Bypass standard main-thread `requestAnimationFrame` VSync refresh rate limits (e.g., 60Hz / 144Hz / 180Hz) to measure absolute hardware compute limits:
- **Offscreen WebGL Mode**: Offloads Three.js 3D rendering and mesh updating to a Web Worker via `OffscreenCanvas`, forcing GPU execution queue completion via `gl.finish()` and transferring 60Hz visual previews via zero-copy `ImageBitmap`.
- **Headless CPU Math Mode**: Bypasses graphics rasterization entirely to measure pure CPU heightmap evaluation throughput (iterations/sec and math ms) over a zero-delay `MessageChannel` microtask loop.
- **VSync rAF Mode**: Evaluates real-world UI experience locked to the browser display refresh rate.

---

### 📱 4. Mobile & Responsive Layout Architecture
- **Adaptive UI Scale**: Dynamic scaling across desktop, tablet, and mobile displays.
- **Mobile Bottom Sheet Drawer**: Touch-friendly collapsible drawer controls with gesture handles and modal dialogs.
- **Hydraulic Erosion Simulation**: Interactive water drop erosion filter modeling terrain weathering over time.

---

## ⚡ Unthrottled Benchmark Launch Command

To unlock main-thread rendering throughput past your display's physical refresh rate (e.g. past 60Hz/180Hz VSync caps), launch Google Chrome with GPU VSync disabled:

### Windows (PowerShell):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-gpu-vsync --disable-frame-rate-limit --user-data-dir="$env:TEMP\chrome-bench"
```

Then navigate to `http://localhost:3000`.

---

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Commands
```bash
# Clone the repository
git clone https://github.com/jhigger/world-gen.git
cd world-gen

# Install dependencies
npm install

# Run Vite local development server
npm run dev

# Build production bundle
npm run build

# Run Vitest test suite
npm test
```

---

## 📐 Project Structure

```
world-gen/
├── index.html                  # Application layout, control panels & title metadata
├── CONTEXT.md                  # Single-context domain glossary & sitemap
├── docs/
│   ├── adr/
│   │   ├── 0001-hydraulic-erosion-simulation.md
│   │   └── 0002-offscreen-worker-benchmark-engine.md
│   └── agents/                 # Issue tracking and triage guidelines
├── src/
│   ├── algorithms.ts           # 6 procedural noise & terrain generators
│   ├── benchmark.ts            # Performance metrics tracking & camera flight controller
│   ├── main.ts                 # Main-thread state management, UI events & animation loop
│   ├── observable-state.ts     # Deep Proxy reactive state store
│   ├── offscreen-benchmark.ts   # Main-thread controller for offscreen worker benchmark engine
│   ├── pipeline.ts             # Modular terrain pipeline and erosion filter framework
│   ├── renderer.ts             # Three.js WebGL viewport renderer
│   ├── state.ts                # Application state configuration & persistence
│   └── worker.ts               # Web Worker dual-mode compute & offscreen render loop
└── vitest.config.ts            # Vitest unit test configuration
```

---

## 📄 Citation & License
Developed to support game development research and procedural world generation analysis. Distributed under the MIT License.
