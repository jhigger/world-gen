import { PhysicsFilter } from './pipeline';

/**
 * Hydraulic Erosion Physics Simulator.
 * 
 * Implements a simplified particle-based droplet erosion simulation.
 * Each droplet possesses mass (water volume), velocity, carried sediment, and position.
 * As a droplet descends downhill (evaluating local gradients using bilinear heights),
 * it scrapes soil from peaks and deposits it in depressions or valleys,
 * forming rivers, riverbeds, and canyons dynamically over time.
 */
export class HydraulicErosion implements PhysicsFilter {
  // Physical parameters for the erosion model
  private inertia = 0.15;       // Velocity inertia ratio carried from the previous step.
  private capacityFactor = 4.0;  // Multiplier for sediment carrying capacity based on slope.
  private depositionSpeed = 0.1; // Rate at which sediment settles onto the terrain floor.
  private erosionSpeed = 0.1;    // Speed at which water dislodges and scrapes soil.
  private evaporationSpeed = 0.02;// Water volume evaporation rate per particle step.
  private gravity = 4.0;         // Downward acceleration factor.
  private friction = 0.1;        // Friction coefficient to avoid infinite droplet acceleration.

  // Fast LCG random number generator
  private randomState = 12345;
  private random(): number {
    this.randomState = (Math.imul(this.randomState, 1103515245) + 12345) & 0x7fffffff;
    return this.randomState / 0x7fffffff;
  }

  apply(heightmap: number[][], _dt: number): void {
    // In our pipeline, dt can map to droplets or intensity.
    // For now, we simulate 120 droplets per tick as per original code.
    this.erode(heightmap, 120);
  }

  /**
   * Evaluates multiple droplet cycles on a 2D heightmap in-place.
   * 
   * @param heightmap 2D height grid array.
   * @param numDroplets Count of water droplets to simulate.
   */
  erode(heightmap: number[][], numDroplets: number): void {
    const sizeY = heightmap.length;
    if (sizeY === 0) return;
    const sizeX = heightmap[0].length;

    // Simulate droplet physics path one-by-one
    for (let d = 0; d < numDroplets; d++) {
      // 1. Spawn droplet at a random sub-grid position
      let posX = this.random() * (sizeX - 2) + 0.5;
      let posY = this.random() * (sizeY - 2) + 0.5;
      let dirX = 0;
      let dirY = 0;
      let vel = 0;
      let water = 1.0;
      let sediment = 0.0;

      const maxLifetime = 30; // Prevent droplets from getting stuck in loops
      for (let step = 0; step < maxLifetime; step++) {
        const ix = Math.floor(posX);
        const iy = Math.floor(posY);
        
        // Fractional offsets within the active 2x2 grid cell
        const u = posX - ix;
        const v = posY - iy;

        // Retrieve corner heights for slope computation
        const h00 = heightmap[iy][ix];
        const h10 = heightmap[iy][ix + 1];
        const h01 = heightmap[iy + 1][ix];
        const h11 = heightmap[iy + 1][ix + 1];

        // 2. Compute 3D gradient vector representing downhill slope
        // Bilinearly interpolates height slope values
        const gradX = (h10 - h00) * (1 - v) + (h11 - h01) * v;
        const gradY = (h01 - h00) * (1 - u) + (h11 - h10) * u;

        // 3. Update droplet direction incorporating inertia and slope
        dirX = dirX * this.inertia - gradX * (1 - this.inertia);
        dirY = dirY * this.inertia - gradY * (1 - this.inertia);

        // Normalize direction vector
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len > 0.0001) {
          dirX /= len;
          dirY /= len;
        }

        // 4. Move droplet
        posX += dirX;
        posY += dirY;

        // Terminate simulation if droplet moves out of terrain grid boundaries
        if (posX < 0 || posX >= sizeX - 1 || posY < 0 || posY >= sizeY - 1) {
          break;
        }

        // To calculate current height precisely after movement, perform bilinear interpolation.
        // Prevents sudden jumps at grid boundaries that cause infinite acceleration and vertex explosions.
        const nextIx = Math.floor(posX);
        const nextIy = Math.floor(posY);
        const nextU = posX - nextIx;
        const nextV = posY - nextIy;
        const nh00 = heightmap[nextIy][nextIx];
        const nh10 = heightmap[nextIy][nextIx + 1];
        const nh01 = heightmap[nextIy + 1][nextIx];
        const nh11 = heightmap[nextIy + 1][nextIx + 1];

        const currHeight = nh00 * (1 - nextU) * (1 - nextV) + nh10 * nextU * (1 - nextV) + nh01 * (1 - nextU) * nextV + nh11 * nextU * nextV;
        const prevHeight = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
        const deltaHeight = currHeight - prevHeight;

        // 5. Calculate sediment carrying capacity based on velocity and slope steepness (-deltaHeight)
        const slopeCapacity = Math.max(0, -deltaHeight);
        const sedimentCapacity = slopeCapacity * vel * water * this.capacityFactor;

        // Calculate velocity using gravity and height change.
        // Going downhill (deltaHeight < 0) accelerates the droplet, so we subtract deltaHeight.
        // Going uphill slows it down. We use Math.max to avoid negative numbers and prevent NaN values.
        // Apply constant friction to stabilize velocity.
        vel = Math.sqrt(Math.max(0, vel * vel - deltaHeight * this.gravity)) * (1 - this.friction);

        // 6. Deposit or erode soil
        if (sediment > sedimentCapacity || deltaHeight > 0) {
          // Deposit excess sediment
          const deposit = deltaHeight > 0 
            ? Math.min(deltaHeight, sediment) 
            : (sediment - sedimentCapacity) * this.depositionSpeed;
          
          sediment -= deposit;

          // Distribute deposited sediment bilinearly among the 4 corners
          heightmap[iy][ix] += deposit * (1 - u) * (1 - v);
          heightmap[iy][ix + 1] += deposit * u * (1 - v);
          heightmap[iy + 1][ix] += deposit * (1 - u) * v;
          heightmap[iy + 1][ix + 1] += deposit * u * v;
        } else {
          // Erode soil and load it into the droplet
          const erode = Math.min((sedimentCapacity - sediment) * this.erosionSpeed, -deltaHeight);
          
          sediment += erode;

          // Subtract eroded height values bilinearly from the corners
          heightmap[iy][ix] -= erode * (1 - u) * (1 - v);
          heightmap[iy][ix + 1] -= erode * u * (1 - v);
          heightmap[iy + 1][ix] -= erode * (1 - u) * v;
          heightmap[iy + 1][ix + 1] -= erode * u * v;
        }

        // 7. Evaporate a fraction of the droplet's water volume
        water *= (1 - this.evaporationSpeed);
      }
    }
  }
}
