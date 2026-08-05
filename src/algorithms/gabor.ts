import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * 2D Gabor Noise generator using sparse convolution of Gabor kernels.
 * 
 * Introduced by Lagae et al. (2009), Gabor noise computes procedural noise
 * by convolving a sparse Poisson impulse process with a Gabor kernel —
 * a Gaussian envelope multiplied by a sinusoidal wave:
 * 
 * G(x, y) = sum_i a_i * exp(-pi * K^2 * ((x-x_i)^2 + (y-y_i)^2))
 *           * cos(2*pi * f_0 * ((x-x_i)*cos(theta_i) + (y-y_i)*sin(theta_i)) + phi_i)
 * 
 * Provides explicit spectral control and anisotropic orientation,
 * creating directionally-aligned terrain ridges, dune fields, and linear mountain chains.
 */
export class GaborNoiseAlgorithm implements TerrainAlgorithm {
  name = 'Gabor Noise (2009)';
  badge = 'Anisotropic';
  description = 'Sparse convolution of Gabor kernels combining Gaussian envelopes with sinusoidal oscillations to generate anisotropic, directionally-aligned terrain structures.';
  complexity = 'O(392 × octaves)';

  // Gabor-specific properties
  impulseDensity: number = 0.75;          // K parameter (width/bandwidth of Gaussian envelope)
  orientationAngle: number = Math.PI / 4;   // theta_0 (45 degrees preferred anisotropic angle)
  frequency: number = 1.5;                // f_0 (harmonic frequency of cosine wave)
  impulsesPerCell: number = 8;           // Number of Poisson impulses per grid cell

  /**
   * Deterministic 32-bit unsigned cell seed.
   */
  private cellSeed(x: number, y: number, seed: number): number {
    let h = (seed ^ (x * 1619) ^ (y * 31337)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /**
   * Evaluates single-pass 2D Gabor noise at coordinate (x, y).
   */
  private gabor2D(x: number, y: number, seed: number): number {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    const K = this.impulseDensity;
    const K2 = K * K;
    const negPiK2 = -Math.PI * K2;
    // Envelope threshold < 0.0001 corresponds to negPiK2 * distSq < -9.21034 => distSq > 9.21034 / (Math.PI * K2)
    const maxDistSq = 9.21034 / (Math.PI * K2);
    // Match search window to Gaussian support — 3x3 is too small when sqrt(maxDistSq) > 1
    const cellRadius = Math.ceil(Math.sqrt(maxDistSq));
    const f0 = this.frequency;
    const twoPiF0 = 2.0 * Math.PI * f0;
    const cosTheta = Math.cos(this.orientationAngle);
    const sinTheta = Math.sin(this.orientationAngle);
    const norm = 2.3283064365386963e-10; // 1 / 4294967296.0

    let sum = 0;

    // Convolve over neighboring cells within the Gaussian support radius
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cx = cellX + dx;
        const cy = cellY + dy;

        let s = this.cellSeed(cx, cy, seed);

        // Generate impulses for cell (cx, cy) using fast LCG
        for (let i = 0; i < this.impulsesPerCell; i++) {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          const r1 = s * norm;
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          const r2 = s * norm;
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          const r3 = s * norm;
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          const r4 = s * norm;

          const xi = cx + r1;
          const yi = cy + r2;

          const rx = x - xi;
          const ry = y - yi;
          const distSq = rx * rx + ry * ry;

          // Early distance pruning BEFORE expensive exponential and trigonometric calculations
          if (distSq > maxDistSq) continue;

          const ai = r3 * 2.0 - 1.0; // Random amplitude in [-1, 1]
          const phi = r4 * 2.0 * Math.PI; // Random phase in [0, 2pi)

          // Gaussian envelope: exp(-pi * K^2 * (rx^2 + ry^2))
          const envelope = Math.exp(negPiK2 * distSq);

          // Sinusoidal wave: cos(2*pi * f_0 * (rx*cos(theta) + ry*sin(theta)) + phi)
          const proj = rx * cosTheta + ry * sinTheta;
          const harmonic = Math.cos(twoPiF0 * proj + phi);

          sum += ai * envelope * harmonic;
        }
      }
    }

    return sum;
  }

  /**
   * Evaluates height at point (x, y) using fractal multi-octave summation.
   */
  evaluate(x: number, y: number, params: TerrainParams): number {
    let total = 0;
    let frequency = 1 / params.scale;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let o = 0; o < params.octaves; o++) {
      const nx = (x + params.offsetX) * frequency;
      const ny = (y + params.offsetY) * frequency;

      const noiseVal = this.gabor2D(nx, ny, params.seed + o * 1013);
      total += noiseVal * amplitude;
      maxValue += amplitude;

      amplitude *= params.persistence;
      frequency *= 2.0;
    }

    // Normalize raw sum to [0, 1] height range
    const normalized = (total / maxValue) * 0.5 + 0.5;
    const clamped = Math.max(0, Math.min(1, normalized));

    return clamped * params.heightScale;
  }

  /**
   * Generates a 2D heightmap grid.
   */
  generate(width: number, height: number, params: TerrainParams): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = new Array(width);
      for (let x = 0; x < width; x++) {
        row[x] = this.evaluate(x, y, params);
      }
      grid.push(row);
    }
    return grid;
  }
}

// Export aliases and default instance for flexibility
export { GaborNoiseAlgorithm as GaborNoise };
export const gaborAlgorithm = new GaborNoiseAlgorithm();
