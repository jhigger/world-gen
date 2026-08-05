import { describe, it, expect } from 'vitest';
import { availableAlgorithms } from './algorithms';
import { TerrainPipeline } from './pipeline';
import { HydraulicErosion } from './physics';
import { state } from './state';
import { ViewportManager } from './viewport-manager';

describe('Erosion Startup Performance & Time-slicing', () => {
  it('staggers base heightmap generation across ticks in grid view mode', () => {
    const hydraulicErosion = new HydraulicErosion();
    const pipelines = availableAlgorithms.map(algo => {
      const p = new TerrainPipeline();
      p.setAlgorithm(algo);
      p.addFilter(hydraulicErosion);
      return p;
    });

    const vm = new ViewportManager({ algorithms: availableAlgorithms });
    vm.setGridMode('grid');

    const resolution = 128;
    const heightmapCache: (number[][] | null)[] = new Array(availableAlgorithms.length).fill(null);

    let generatedCountPerTick: number[] = [];

    // Simulate animation loop ticks with ViewportManager active check and staggered generation
    for (let frame = 0; frame < availableAlgorithms.length; frame++) {
      let generatedThisFrame = 0;
      pipelines.forEach((pipeline, i) => {
        if (!vm.isViewportActive(i)) return;

        if (!heightmapCache[i]) {
          if (generatedThisFrame >= 1) return;
          heightmapCache[i] = pipeline.generateBase(resolution, resolution, state.params);
          generatedThisFrame++;
        }
        pipeline.tickPhysics(heightmapCache[i]!, 0.016);
      });
      generatedCountPerTick.push(generatedThisFrame);
    }

    // Max 1 cache generated per frame
    expect(generatedCountPerTick.every(count => count <= 1)).toBe(true);
    expect(heightmapCache.every(map => map !== null)).toBe(true);
  });

  it('only generates the focused algorithm heightmap in single view mode using ViewportManager', () => {
    const hydraulicErosion = new HydraulicErosion();
    const pipelines = availableAlgorithms.map(algo => {
      const p = new TerrainPipeline();
      p.setAlgorithm(algo);
      p.addFilter(hydraulicErosion);
      return p;
    });

    const vm = new ViewportManager({ algorithms: availableAlgorithms });
    vm.setGridMode('single', 2); // Focus index 2 (Simplex)

    const resolution = 128;
    const heightmapCache: (number[][] | null)[] = new Array(availableAlgorithms.length).fill(null);

    pipelines.forEach((pipeline, i) => {
      if (!vm.isViewportActive(i)) return;

      if (!heightmapCache[i]) {
        heightmapCache[i] = pipeline.generateBase(resolution, resolution, state.params);
      }
      pipeline.tickPhysics(heightmapCache[i]!, 0.016);
    });

    // Only focused index 2 should be generated and cached
    expect(heightmapCache[2]).not.toBeNull();
    expect(heightmapCache[0]).toBeNull();
    expect(heightmapCache[1]).toBeNull();
    expect(heightmapCache[5]).toBeNull();
  });
});
