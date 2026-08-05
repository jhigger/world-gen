import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * Terrain generator using 2D Simplex Noise.
 * 
 * Simplex Noise divides space into a grid of equilateral triangles
 * (simplexes in 2D) instead of squares. This reduces the number of corners
 * to evaluate from 4 to 3, minimizes coordinate alignment grid artifacts,
 * and yields better computational scaling behavior.
 */
export class SimplexNoise implements TerrainAlgorithm {
  name = 'Simplex Noise (2001)';
  badge = 'Optimal';
  description = 'Divides space into a simplex grid (triangles in 2D), reducing directional artifacts and lowering coordinate computation scaling cost to O(N²).';
  complexity = 'O(octaves)';

  private p: number[] = new Array(512);
  private currentSeed: number = -1;

  // Math constants for skewing and unskewing coordinates in 2D space
  private readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  constructor() {
    this.initPermutation(8888);
  }

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
   * Calculates 2D gradient dot product.
   * Selects one of 8 cardinal and diagonal directions.
   */
  private grad2d(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /**
   * Evaluates 2D Simplex Noise at continuous coordinates.
   */
  private noise2d(xin: number, yin: number): number {
    let n0 = 0, n1 = 0, n2 = 0; // Contributions from the three corners of the triangle

    // 1. Skew the input space to find which cell of the skewed triangular grid we are in
    const s = (xin + yin) * this.F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    // 2. Unskew the cell origin back to regular 2D coordinate space
    const t = (i + j) * this.G2;
    const X0 = i - t;
    const Y0 = j - t;

    // Relative vector of input point from the triangle origin (vertex 0)
    const x0 = xin - X0;
    const y0 = yin - Y0;

    // 3. Determine which of the two triangles of the cell we are in
    let i1 = 0, j1 = 0; // Offsets for the second vertex in skewed space
    if (x0 > y0) {
      i1 = 1; j1 = 0; // Lower right triangle
    } else {
      i1 = 0; j1 = 1; // Upper left triangle
    }

    // Relative vectors for the other two vertices
    const x1 = x0 - i1 + this.G2;
    const y1 = y0 - j1 + this.G2;
    const x2 = x0 - 1.0 + 2.0 * this.G2;
    const y2 = y0 - 1.0 + 2.0 * this.G2;

    // Get permutation indexes
    const ii = i & 255;
    const jj = j & 255;

    // 4. Calculate contribution of each corner using radial attenuation (0.5 - d²)^4
    // Corner 0:
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = this.p[ii + this.p[jj]];
      n0 = t0 * t0 * this.grad2d(gi0, x0, y0);
    }

    // Corner 1:
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = this.p[ii + i1 + this.p[jj + j1]];
      n1 = t1 * t1 * this.grad2d(gi1, x1, y1);
    }

    // Corner 2:
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = this.p[ii + 1 + this.p[jj + 1]];
      n2 = t2 * t2 * this.grad2d(gi2, x2, y2);
    }

    // 5. Scale the sum to fit within [-1.0, 1.0]
    // The multiplier 70 is analytically derived to normalize the maximum output amplitude.
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Generates fractal fBm heightmap.
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
          
          const noiseValue = (this.noise2d(nx, ny) + 1.0) * 0.5;
          
          total += noiseValue * amplitude;
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
