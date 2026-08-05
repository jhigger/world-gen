# 0003: Decoupled Canvas Visual Capping and Metric Throttling

We decided to decouple visual canvas rendering and DOM metric UI updates from procedural terrain calculation throughput. High-throughput benchmarks (`Unthrottled Compute Loop` and `Headless Math Benchmark`) run at maximum hardware capability, while canvas rendering is clamped to an independent `Canvas Visual Cap` (e.g., 30 FPS, 60 FPS, or VSync). Additionally, DOM metric updates in `main.ts` are constrained by `DOM Metric Throttling` to a 100ms (10 Hz) maximum refresh rate. Within the `OffscreenBenchmarkEngine`, image bitmap transfers via `transferFromImageBitmap()` dynamically respect the active `canvasFpsCap` interval and are skipped entirely during headless mode.

## Considered Options

- **Unified Frame Capping**: Applying a single FPS cap to both math calculations and canvas rendering, which artificially throttles benchmark compute throughput.
- **Unthrottled Canvas Rendering & Per-Iteration DOM Updates**: Rendering WebGL and mutating DOM `textContent` on every compute iteration, causing severe GPU congestion, IPC queue saturation, V8 GC pressure, and UI freeze.
- **Decoupled Visual Capping & 100ms DOM Throttling (Selected)**: Running math unthrottled while rate-limiting canvas bitmap transfers and DOM updates to fixed interval caps.
