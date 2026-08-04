# Domain Vocabulary

- **Terrain Algorithm**: The mathematical noise generator (e.g., Perlin, Simplex) that produces a base heightmap.
- **Terrain Pipeline**: A deep module that encapsulates a `TerrainAlgorithm` and a series of post-processing simulation filters (like `HydraulicErosion`). It manages the execution and timing of these phases and emits a final heightmap.
- **State Observable**: A reactive data store holding user parameters (seed, resolution, camera position, etc.). Serves as the primary seam between the UI and application logic.
- **ViewportManager**: The deep module responsible for orchestrating 3D canvases, synchronizing cameras, and running the `requestAnimationFrame` render loop. It delegates mesh and simulation updates strictly to the `TerrainPipeline`.
- **UIManager**: A thin adapter that binds DOM inputs (sliders, buttons) to the State Observable without knowing about 3D rendering or physics.
- **Mobile Control Sheet**: A collapsible, touch-friendly panel within `UIManager` that overlays the bottom of the viewport on small screens (<768px), exposing parameters while maximizing canvas visibility.
- **Mobile Viewport Switcher**: A touch-first viewport navigation mode in `ViewportManager` for mobile screens, defaulting to a single focused 3D canvas with horizontal swipe gestures and quick tab pills to switch active `TerrainAlgorithm` instances.
- **Touch Gesture Isolation**: Canvas interaction scoping using `touch-action: none` to isolate 3D orbit and pinch-zoom gestures on the WebGL canvas from page and sheet scrolling.
- **Mobile Parameter Modal**: A touch-friendly modal or popover triggered by tapping info targets (`ⓘ`) on control labels, replacing hover tooltips on touch devices.
- **OffscreenBenchmarkEngine**: A worker-side execution engine that accepts transferred `OffscreenCanvas` instances to run procedural algorithm generation and WebGL rendering off the main thread.
- **Unthrottled Compute Loop**: A non-blocking, zero-delay event iteration mechanism using `MessageChannel` ports within a Web Worker to drive benchmark execution at maximum hardware throughput without vsync capping.
- **Batched Performance Telemetry**: The aggregated accumulation and periodic transmission of per-frame timing metrics (CPU math, GPU render) from the worker to the main thread to prevent IPC queue congestion.
- **Pipeline Warmup Phase**: An initial unmeasured benchmark iteration executed immediately after WebGL or geometry initialization to compile shaders and allocate GPU buffers without corrupting telemetry averages.
- **Zero-GC In-Place Mutation**: The strategy of mutating pre-allocated typed arrays in place during active compute iterations, reserving memory allocations strictly for out-of-band resolution reconfiguration.
- **Viewport Resize Synchronization**: The worker-side updating of WebGL viewport dimensions (`renderer.setSize(w, h, false)`) and camera projection matrices driven by main-thread `ResizeObserver` events.
- **Flat Heightmap Evaluation**: The direct population of a contiguous 1D `Float32Array` heightmap buffer via point-wise evaluation functions, avoiding 2D nested array heap allocations.
- **Headless Math Benchmark**: A non-rendering compute execution mode within a Web Worker that repeatedly evaluates a `TerrainAlgorithm` or `TerrainPipeline` on pre-allocated buffers using microtasks (`MessageChannel` / `queueMicrotask`), measuring raw throughput in heightmap evaluations per second without GPU context overhead.




