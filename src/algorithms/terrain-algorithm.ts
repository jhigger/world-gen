/**
 * Common input parameters for all terrain algorithms.
 * 
 * We define this structure to ensure that the sidebar control panel
 * can send noise configuration parameter objects to all generators homogeneously.
 */
export interface TerrainParams {
  scale: number;       // Noise zoom factor to determine the base frequency.
  octaves: number;     // Number of detail levels accumulated (fractal octaves).
  persistence: number; // Amplitude multiplier for successive octaves.
  heightScale: number; // Vertical amplification factor for the final height.
  widthScale: number;  // Allows stretching the mesh on the horizontal plane to control the width and length scale of the terrain.
  seed: number;        // Seed to guarantee terrain reproducibility.
  offsetY: number;     // Vertical offset to simulate continuous terrain motion.
  offsetX: number;     // Horizontal offset to simulate continuous terrain motion.
}

/**
 * Unified interface for all terrain generators.
 * 
 * We design this interface following the Dependency Inversion Principle (SOLID),
 * allowing future addition of new terrain algorithms without modifying
 * the main rendering engine or controller flows.
 */
export interface TerrainAlgorithm {
  name: string;        // Scientific or descriptive name of the algorithm.
  badge: string;       // Classification badge (e.g. "Fractal", "Voronoi").
  description: string; // Short summary of the underlying mathematical concept.

  /**
   * Generates a 2D grid of normalized heights (typically between 0 and 1).
   * 
   * @param width Width of the output mesh grid (X resolution).
   * @param height Height of the output mesh grid (Y resolution).
   * @param params Noise configuration options.
   * @returns 2D array representing vertex heights.
   */
  generate(width: number, height: number, params: TerrainParams): number[][];
  evaluate(x: number, y: number, params: TerrainParams): number;

  /**
   * Performs a physical update step on the terrain heightmap.
   * 
   * We decouple this step to allow dynamic simulations like hydraulic erosion
   * to run frame-by-frame on the heightmap without recalculating the base noise.
   * 
   * @param heightmap The active heightmap array to modify in-place.
   * @param dt Delta time (time difference in seconds).
   */
  applyPhysics?(heightmap: number[][], dt: number): void;
}
