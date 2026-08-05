import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * Terrain generator using 2D Perlin Noise.
 * 
 * Implements a coherent gradient noise generator. It is the classic standard
 * for organic terrain simulations due to its smooth transition curves
 * and fractal multi-octave sum structures.
 */
export class PerlinNoise implements TerrainAlgorithm {
  name = 'Perlin Noise (1983)';
  badge = 'Standard';
  description = 'Generates hermitically interpolated pseudo-random gradients. Offers smooth continuous transitions with first-order spatial coherence.';
  complexity = 'O(octaves)';
  complexityDescription = 'Evaluates 4 grid corner gradient dot products per octave per sample point.';

  // Permutation table duplicated to 512 to avoid index out-of-bounds checks in the hot loop
  private p: number[] = new Array(512);
  private currentSeed: number = -1;

  constructor() {
    this.initPermutation(42); // Initialize with a default seed
  }

  /**
   * Initializes the permutation table deterministically using a seed.
   * 
   * Uses a simple Linear Congruential Generator (LCG) to shuffle the
   * 0 to 255 indices reproducibly. This ensures that the same seed
   * always generates the exact same terrain mesh.
   */
  private initPermutation(seed: number): void {
    const src = Array.from({ length: 256 }, (_, i) => i);
    
    // Quick LCG pseudo-random generator
    let s = seed;
    const nextRandom = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };

    // Deterministic Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      const temp = src[i];
      src[i] = src[j];
      src[j] = temp;
    }

    // Duplicate the table to avoid using modulo % 256 arithmetic operations in the loop
    for (let i = 0; i < 512; i++) {
      this.p[i] = src[i & 255];
    }
  }

  /**
   * Quintic smoothing curve (Ken Perlin's S-curve).
   * 
   * f(t) = 6t^5 - 15t^4 + 10t^3
   * 
   * We use the quintic curve instead of the original cubic (3t^2 - 2t^3) because
   * it has zero first and second derivatives at t=0 and t=1. This eliminates
   * sharp visual seams at grid cell borders.
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  /**
   * Calculates the dot product between grid vertex gradients and relative vectors.
   * 
   * Selects one of 8 directions based on the hashed coordinates.
   * The dot product projects distance relative to the grid node smoothly.
   */
  private grad2d(hash: number, x: number, y: number): number {
    const h = hash & 7; // Use 3 lower bits to select one of 8 vectors
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /**
   * Evaluates classical 2D Perlin noise at continuous coordinates.
   */
  private noise2d(x: number, y: number): number {
    // Find unit grid cell coordinates
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative coordinates within the unit grid cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Compute fade curve weights
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Get hashes for the 4 corners of the cell
    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    // Interpolate the dot products of the 4 corners
    const x1 = this.lerp(u, this.grad2d(aa, xf, yf), this.grad2d(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad2d(ab, xf, yf - 1), this.grad2d(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  /**
   * Generates the heightmap by accumulating fractal octaves (fBm).
   * 
   * Accumulates noise with increasing frequency (f * lacunarity) and
   * decreasing amplitude (a * persistence) to mimic natural terrains where
   * large hills (low frequency) contain fine rock details (high frequency).
   */
  evaluate(x: number, y: number, params: TerrainParams): number {
    if (this.currentSeed !== params.seed) {
      this.initPermutation(params.seed);
      this.currentSeed = params.seed;
    }

    let total = 0;
    let frequency = 1 / params.scale;
    let amplitude = 1;
    let maxValue = 0; // Used to normalize values back to [0, 1]

    // Sum components (fractal octaves)
    for (let i = 0; i < params.octaves; i++) {
      // Accumulate offsets to simulate continuous panning motion
      const nx = x * frequency + params.offsetX * frequency;
      const ny = y * frequency + params.offsetY * frequency;
      
      // Map default noise2d range [-1, 1] to [0, 1]
      const noiseValue = (this.noise2d(nx, ny) + 1.0) * 0.5;
      
      total += noiseValue * amplitude;
      maxValue += amplitude;
      
      amplitude *= params.persistence;
      frequency *= 2.0; // Standard lacunarity of 2.0
    }

    // Store the final normalized and scaled height value
    return (total / maxValue) * params.heightScale;
  }

  generate(width: number, height: number, params: TerrainParams): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(this.evaluate(x, y, params));
      }
      grid.push(row);
    }
    return grid;
  }
}
