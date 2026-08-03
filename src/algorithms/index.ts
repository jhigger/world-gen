import { TerrainAlgorithm } from './terrain-algorithm';
import { ValueNoise } from './value';
import { PerlinNoise } from './perlin';
import { SimplexNoise } from './simplex';
import { WorleyNoise } from './worley';
import { FBMNoise } from './fbm';
import { GaborNoiseAlgorithm, GaborNoise, gaborAlgorithm } from './gabor';

export * from './terrain-algorithm';
export { ValueNoise, PerlinNoise, SimplexNoise, WorleyNoise, FBMNoise, GaborNoiseAlgorithm, GaborNoise, gaborAlgorithm };

/**
 * Registry of algorithms available in the simulator.
 * 
 * Sorted by historical creation date (oldest to newest):
 * 1. Value Noise — basic lattice interpolation, predates formal CG noise
 * 2. Perlin Noise — Ken Perlin, 1983
 * 3. Simplex Noise — Ken Perlin, 2001
 * 4. Worley/Cellular Noise — Steven Worley, 1996
 * 5. Fractional Brownian Motion — Mandelbrot & Van Ness, 1968 (CG application post-Perlin)
 * 6. Gabor Noise — Lagae et al., 2009
 */
export const availableAlgorithms: TerrainAlgorithm[] = [
  new ValueNoise(),
  new PerlinNoise(),
  new SimplexNoise(),
  new WorleyNoise(),
  new FBMNoise(),
  new GaborNoiseAlgorithm()
];

