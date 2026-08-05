import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * Terrain generator using 2D Value Noise.
 * 
 * Unlike Perlin Noise (which interpolates gradients/vectors), Value Noise
 * assigns direct random height values to each grid coordinate intersection
 * and performs bilinear interpolation between them. This results in blockier
 * and grid-aligned features, providing a great visual mathematical contrast.
 */
export class ValueNoise implements TerrainAlgorithm {
  name = 'Value Noise (c. 1980)';
  badge = 'Lattice';
  description = 'Assigns random values to grid intersections and interpolates between them. Produces blockier, more angular grid-aligned shapes.';
  complexity = 'O(octaves)';
  complexityDescription = 'Evaluates 4 grid corner bilinear values per octave per sample point.';

  private p: number[] = new Array(512);
  private currentSeed: number = -1;

  constructor() {
    this.initPermutation(1337); // Use a different default seed to vary the starting look
  }

  /**
   * Shuffles the permutation table based on the seed for reproducibility.
   */
  private initPermutation(seed: number): void {
    const src = Array.from({ length: 256 }, (_, i) => i);
    let s = seed;
    const nextRandom = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      const temp = src[i];
      src[i] = src[j];
      src[j] = temp;
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = src[i & 255];
    }
  }

  /**
   * Quintic interpolation weight curve.
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  /**
   * Gets a pseudo-random value [0, 1] for an integer grid coordinate (ix, iy).
   * 
   * Uses the permutation table to associate integer coordinates
   * to a fixed constant determined solely by the seed.
   */
  private getValueAt(ix: number, iy: number): number {
    const hash = this.p[this.p[ix & 255] + (iy & 255)];
    return hash / 255.0;
  }

  /**
   * Evaluates 2D Value Noise at continuous space coordinates.
   * 
   * Pinpoints the grid cell, gets corner heights, and applies
   * bilinear interpolation weighted by the quintic S-curve.
   */
  private noise2d(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    const xf = x - ix;
    const yf = y - iy;

    const u = this.fade(xf);
    const v = this.fade(yf);

    // Get values at grid corners
    const v00 = this.getValueAt(ix, iy);
    const v10 = this.getValueAt(ix + 1, iy);
    const v01 = this.getValueAt(ix, iy + 1);
    const v11 = this.getValueAt(ix + 1, iy + 1);

    // Bilinear interpolation
    const x1 = this.lerp(u, v00, v10);
    const x2 = this.lerp(u, v01, v11);

    return this.lerp(v, x1, x2);
  }

  /**
   * Generates heights using multi-octave fBm fractal accumulation.
   */
  evaluate(x: number, y: number, params: TerrainParams): number {
    if (this.currentSeed !== params.seed) {
      this.initPermutation(params.seed);
      this.currentSeed = params.seed;
    }

    let total = 0;
        let frequency = 1 / params.scale;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < params.octaves; i++) {
          const nx = x * frequency + params.offsetX * frequency;
          const ny = y * frequency + params.offsetY * frequency;
          
          total += this.noise2d(nx, ny) * amplitude;
          maxValue += amplitude;
          
          amplitude *= params.persistence;
          frequency *= 2.0;
        }

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
