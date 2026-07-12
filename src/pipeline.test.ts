import { describe, it, expect, vi } from 'vitest';
import { TerrainPipeline, PhysicsFilter } from './pipeline';
import { TerrainAlgorithm, TerrainParams } from './algorithms/terrain-algorithm';

describe('TerrainPipeline', () => {
  const mockParams: TerrainParams = {
    scale: 1, octaves: 1, persistence: 0.5, heightScale: 1, widthScale: 1, seed: 1, offsetX: 0, offsetY: 0
  };

  const mockAlgorithm: TerrainAlgorithm = {
    name: 'Mock',
    badge: 'M',
    description: 'Mock Algo',
    generate: vi.fn(), evaluate: vi.fn().mockReturnValue([[0.5, 0.5], [0.5, 0.5]])
  };

  it('throws if generating without an algorithm', () => {
    const pipeline = new TerrainPipeline();
    expect(() => pipeline.generateBase(2, 2, mockParams)).toThrowError(/No base algorithm set/);
  });

  it('generates base heightmap using the set algorithm', () => {
    const pipeline = new TerrainPipeline();
    pipeline.setAlgorithm(mockAlgorithm);
    
    const result = pipeline.generateBase(2, 2, mockParams);
    
    expect(mockAlgorithm.generate).toHaveBeenCalledWith(2, 2, mockParams);
    expect(result).toEqual([[0.5, 0.5], [0.5, 0.5]]);
  });

  it('applies physics filters sequentially', () => {
    const pipeline = new TerrainPipeline();
    
    const filterA: PhysicsFilter = {
      apply: vi.fn((heightmap: number[][]) => { heightmap[0][0] += 0.1; })
    };
    const filterB: PhysicsFilter = {
      apply: vi.fn((heightmap: number[][]) => { heightmap[0][0] *= 2; })
    };

    pipeline.addFilter(filterA);
    pipeline.addFilter(filterB);

    const map = [[0, 0]];
    pipeline.tickPhysics(map, 16);

    expect(filterA.apply).toHaveBeenCalledWith(map, 16);
    expect(filterB.apply).toHaveBeenCalledWith(map, 16);
    
    // (0 + 0.1) * 2 = 0.2
    expect(map[0][0]).toBeCloseTo(0.2);
  });
});
