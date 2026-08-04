# Handoff: Deep ViewportManager Module Refactor (Candidate 1)

## Target Focus for Next Session
Extract and implement **Candidate 1: Deep ViewportManager Module** to collapse ~350 lines of shallow 3D WebGL canvas orchestration out of [`src/main.ts`](file:///D:/CODE/DEMO/world-gen/src/main.ts), creating a deep, testable seam behind a unified `ViewportManager` interface.

---

## Context & Completed Prerequisites

1. **Performance Bottlenecks Resolved & Verified (Commit `757fb6f`)**:
   - **Fast Grid Normals**: Replaced Three.js default `computeVertexNormals()` with [`computeFastGridNormals()`](file:///D:/CODE/DEMO/world-gen/src/renderer.ts#L365), delivering a **19.5× speedup** (2.10ms ➔ 0.10ms per frame).
   - **Gabor Distance Pruning**: Added early distance pruning (`distSq > maxDistSq`) and precomputed invariants in [`src/algorithms/gabor.ts`](file:///D:/CODE/DEMO/world-gen/src/algorithms/gabor.ts#L44).
   - **Test Suite**: 15 tests passing across 4 test files ([`src/profiler.test.ts`](file:///D:/CODE/DEMO/world-gen/src/profiler.test.ts)).
   - **Strict Type Safety**: Fixed `any` type in `TerrainRenderer.lastParams`.

2. **Domain Architecture Survey**:
   - Generated report saved at [`docs/architecture-review.html`](file:///D:/CODE/DEMO/world-gen/docs/architecture-review.html).
   - Domain vocabulary alignment specified in [`CONTEXT.md`](file:///D:/CODE/DEMO/world-gen/CONTEXT.md).

---

## Architectural Goals for Candidate 1 (`ViewportManager`)

- **Files Involved**: [`src/main.ts`](file:///D:/CODE/DEMO/world-gen/src/main.ts), [`src/renderer.ts`](file:///D:/CODE/DEMO/world-gen/src/renderer.ts), new `src/viewport-manager.ts`.
- **Current Friction**: `main.ts` (1,867 lines) manually creates 6 `TerrainRenderer` viewports, manages canvas container DOM events, hooks up `ResizeObserver`, syncs OrbitControls cameras, and runs `requestAnimationFrame` loop logic inline.
- **Deep Seam Design**:
  - Create `src/viewport-manager.ts` exposing class `ViewportManager`.
  - Interface methods:
    - `init(containerElement: HTMLElement, algorithms: TerrainAlgorithm[]): void`
    - `update(params: TerrainParams, resolution: number, palette: ColorPalette, showWireframe: boolean): void`
    - `setGridMode(mode: 'grid' | 'single', singleAlgorithmName?: string): void`
    - `dispose(): void`
  - Internally encapsulates:
    - Creation, resize, and destruction of all 3D canvas viewports.
    - Synchronized camera orbit controls across grid viewports.
    - Animation frame render loop ticks.

---

## Suggested Skills for Next Agent

1. **`/implement`**: To implement `ViewportManager` step-by-step and refactor `src/main.ts`.
2. **`/tdd`**: To write unit/integration tests for `ViewportManager` lifecycle, camera synchronization, and grid mode switches in `src/viewport-manager.test.ts`.
3. **`/code-review`**: To review the refactored diff against [`AGENTS.md`](file:///D:/CODE/DEMO/world-gen/AGENTS.md) and [`CONTEXT.md`](file:///D:/CODE/DEMO/world-gen/CONTEXT.md) before final commit.
