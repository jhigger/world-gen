# Domain Vocabulary

- **Terrain Algorithm**: The mathematical noise generator (e.g., Perlin, Simplex) that produces a base heightmap.
- **Terrain Pipeline**: A deep module that encapsulates a `TerrainAlgorithm` and a series of post-processing simulation filters (like `HydraulicErosion`). It manages the execution and timing of these phases and emits a final heightmap.
- **State Observable**: A reactive data store holding user parameters (seed, resolution, camera position, etc.). Serves as the primary seam between the UI and application logic.
- **ViewportManager**: The deep module responsible for orchestrating 3D canvases, synchronizing cameras, and running the `requestAnimationFrame` render loop. It delegates mesh and simulation updates strictly to the `TerrainPipeline`.
- **UIManager**: A thin adapter that binds DOM inputs (sliders, buttons) to the State Observable without knowing about 3D rendering or physics.
