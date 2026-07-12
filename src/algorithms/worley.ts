import { TerrainAlgorithm, TerrainParams } from './terrain-algorithm';

/**
 * Terrain generator using Worley Noise (Cellular / Voronoi).
 * 
 * Divides the coordinate space into unit cells. Each unit cell contains a
 * pseudo-random seed position ("feature point"). For any pixel coordinate,
 * we evaluate distances to the nearest feature points (F1 distance).
 * This creates concave depressions and sharp ridges at cell boundaries,
 * modeling cratered lava beds, cellular organic patterns, or dry sand dunes.
 */
export class WorleyNoise implements TerrainAlgorithm {
  name = 'Worley Noise (Cellular) (1996)';
  badge = 'Voronoi';
  description = 'Calculates distances to nearest seed points. Produces cellular geometric patterns suited for stone, scales, or dry valley structures.';

  /**
   * Sin-based 2D pseudo-random hash function.
   * 
   * Returns two float values in [0, 1] representing the coordinate offset
   * of the feature point inside the unit grid cell (cx, cy). Uses high frequency
   * fractional trigonometric products to avoid visible repetitive tiling.
   */
  private hash2d(cx: number, cy: number, seed: number): [number, number] {
    const x = Math.sin(cx * 127.1 + cy * 311.7 + seed * 42.1) * 43758.5453123;
    const y = Math.sin(cx * 269.5 + cy * 183.3 + seed * 85.3) * 43758.5453123;
    return [x - Math.floor(x), y - Math.floor(y)];
  }

  /**
   * Evaluates 2D Worley Noise at coordinates.
   * 
   * Searches the active grid cell and its 8 adjacent neighbors (3x3 check)
   * to find the minimum Euclidean distance (F1) of the feature points.
   */
  private noise2d(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    let minDistance = 999.0;

    // Search the 3x3 neighborhood unit cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborX = ix + dx;
        const neighborY = iy + dy;

        // Get seed point location inside the neighbor cell
        const [px, py] = this.hash2d(neighborX, neighborY, seed);

        // Vector from pixel position to neighbor seed point
        const diffX = dx + px - fx;
        const diffY = dy + py - fy;

        // Squared distance calculation (faster than doing Math.sqrt in the search loop)
        const dist = diffX * diffX + diffY * diffY;

        if (dist < minDistance) {
          minDistance = dist;
        }
      }
    }

    // Return final Euclidean distance
    return Math.sqrt(minDistance);
  }

  /**
   * Generates the terrain heightmap.
   * 
   * For Worley, we invert the distance (1.0 - dist) so that cells form
   * rounded hills/domes and cell boundaries form dry, steep valleys.
   */
  evaluate(x: number, y: number, params: TerrainParams): number {
    const baseFreq = 1 / params.scale;
    let total = 0;
        let frequency = baseFreq;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < params.octaves; i++) {
          const nx = x * frequency + params.offsetX * frequency;
          const ny = y * frequency + params.offsetY * frequency;
          
          // Invert the distance so cells act as peaks rather than depressions.
          // Clamp distances to [0, 1] range.
          const rawNoise = this.noise2d(nx, ny, params.seed + i);
          const noiseValue = Math.max(0, Math.min(1, 1.0 - rawNoise));
          
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
