# 0002: Offscreen Worker Benchmark Engine Architecture

We decided to implement the procedural terrain generation benchmark engine in a dedicated Web Worker using a Dual-Mode execution architecture (`Offscreen WebGL` and `Headless Math Benchmark`), driven by an `Unthrottled Compute Loop` using `MessageChannel` (`port.postMessage()`) and forced WebGL synchronization (`gl.finish()`). To maintain accurate, high-throughput metrics without locks or main-thread lag, performance telemetry is aggregated in worker-side rolling accumulators and transmitted to the main thread via `Batched Performance Telemetry` every 100ms. Geometry updates mutate static `Float32Array` buffers in-place (`Zero-GC In-Place Mutation`), and re-configurations or resize events execute an unmeasured `Pipeline Warmup Phase` before metric logging resumes. Users select the target mode via a Benchmark Mode selector UI dropdown.

## Considered Options

- **Main Thread `requestAnimationFrame` Loop**: Capped by display refresh rates (60Hz/144Hz) and subject to UI thread event blocking.
- **Worker `setTimeout(..., 0)` Loop**: Browser specifications clamp minimum timeout delays to 1–4ms, limiting benchmarks to ~250 FPS.
- **Per-Frame Main Thread `postMessage` Telemetry**: Saturates the browser IPC queue at high FPS, causing UI freezes and V8 GC spikes.

