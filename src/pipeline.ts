import { TerrainAlgorithm, TerrainParams } from './algorithms/terrain-algorithm';

export interface PhysicsFilter {
  /**
   * Applies a physics simulation step to the heightmap in-place.
   * @param heightmap 2D array of heights
   * @param dt Delta time or intensity step
   */
  apply(heightmap: number[][], dt: number): void;
}

export class TerrainPipeline {
  private baseAlgorithm: TerrainAlgorithm | null = null;
  private filters: PhysicsFilter[] = [];

  constructor() {}

  /**
   * Sets the base noise generation algorithm.
   */
  setAlgorithm(algorithm: TerrainAlgorithm) {
    this.baseAlgorithm = algorithm;
  }

  /**
   * Adds a physics filter to the post-processing chain.
   */
  addFilter(filter: PhysicsFilter) {
    this.filters.push(filter);
  }

  /**
   * Clears all post-processing filters.
   */
  clearFilters() {
    this.filters = [];
  }

  /**
   * Generates the initial heightmap using the base algorithm.
   */
  generateBase(width: number, height: number, params: TerrainParams): number[][] {
    if (!this.baseAlgorithm) {
      throw new Error('TerrainPipeline: No base algorithm set.');
    }
    return this.baseAlgorithm.generate(width, height, params);
  }

  /**
   * Ticks the simulation forward by applying all filters sequentially to the given heightmap.
   * Mutates the heightmap in-place.
   */
  tickPhysics(heightmap: number[][], dt: number): void {
    if (this.filters.length === 0) return;
    
    for (const filter of this.filters) {
      filter.apply(heightmap, dt);
    }
  }
}
