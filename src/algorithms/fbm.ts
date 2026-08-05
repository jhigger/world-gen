import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * Terrain generator using Fractional Brownian Motion (fBm).
 * 
 * fBm is a stochastic process first described by Mandelbrot and Van Ness (1968).
 * It layers multiple octaves of a coherent noise function with exponentially
 * increasing frequency and decreasing amplitude, producing self-similar
 * fractal terrain with tunable roughness.
 * 
 * This implementation uses a Perlin-style gradient noise as its base function,
 * but applies domain warping by feeding the output of one fBm pass as the
 * coordinate offset of a second pass. This creates more organic, swirling
 * terrain features that are visually distinct from plain octave summation.
 */
export class FBMNoise implements TerrainAlgorithm {
  name = 'Fractional Brownian Motion (1968)';
  badge = 'fBm';
  description = 'Layers octaves of gradient noise with domain warping to produce self-similar fractal terrain with organic, swirling continental features.';
  complexity = 'O(3 × octaves)';
  complexityDescription = 'Evaluates 3 directional 1D simplex noise components per octave per sample point.';

  private p: number[] = new Array(512);
  private currentSeed: number = -1;

  constructor() {
    this.initPermutation(31415);
  }

  /**
   * Initializes the permutation table deterministically using a seed.
   */
  private initPermutation(seed: number): void {
    const src = Array.from({ length: 256 }, (_, i) => i);
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

    for (let i = 0; i < 512; i++) {
      this.p[i] = src[i & 255];
    }
  }

  /**
   * Quintic smoothing curve (Ken Perlin's improved S-curve).
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  /**
   * Gradient dot product using 8-direction selection.
   */
  private grad2d(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /**
   * Evaluates classical 2D Perlin noise at continuous coordinates.
   */
  private noise2d(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad2d(aa, xf, yf), this.grad2d(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad2d(ab, xf, yf - 1), this.grad2d(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  /**
   * Single-pass fBm: accumulates octaves with standard lacunarity and persistence.
   */
  private fbm(x: number, y: number, octaves: number, persistence: number): number {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const noiseValue = (this.noise2d(x * frequency, y * frequency) + 1.0) * 0.5;
      total += noiseValue * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2.0;
    }

    return total / maxValue;
  }

  /**
   * Evaluates terrain height using domain-warped fBm for a single point.
   */
  evaluate(x: number, y: number, params: TerrainParams): number {
    if (this.currentSeed !== params.seed) {
      this.initPermutation(params.seed);
      this.currentSeed = params.seed;
    }

    const baseFreq = 1 / params.scale;
    const warpStrength = 4.0;
    
    const nx = x * baseFreq + params.offsetX * baseFreq;
    const ny = y * baseFreq + params.offsetY * baseFreq;

    const warpX = this.fbm(nx + 0.0, ny + 0.0, params.octaves, params.persistence);
    const warpY = this.fbm(nx + 5.2, ny + 1.3, params.octaves, params.persistence);

    const heightVal = this.fbm(
      nx + warpX * warpStrength,
      ny + warpY * warpStrength,
      params.octaves,
      params.persistence
    );

    return heightVal * params.heightScale;
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
