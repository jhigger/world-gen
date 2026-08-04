import { describe, it } from 'vitest';
import { availableAlgorithms } from './algorithms';
import { HydraulicErosion } from './physics';
import * as THREE from 'three';

describe('Profiling Feedback Loop (Bottleneck Isolation)', () => {
  const defaultParams = {
    scale: 20,
    octaves: 4,
    persistence: 0.5,
    heightScale: 10,
    widthScale: 1,
    seed: 42,
    offsetX: 0,
    offsetY: 0,
  };

  it('1. Measure CPU Math Execution Time Across Resolutions & Algorithms', () => {
    console.log('\n--- BENCHMARK 1: CPU MATH TIME (ms) ---');
    const resolutions = [64, 128, 256];

    for (const algo of availableAlgorithms) {
      for (const res of resolutions) {
        const start = performance.now();
        const iterations = 20;
        for (let i = 0; i < iterations; i++) {
          for (let y = 0; y < res; y++) {
            for (let x = 0; x < res; x++) {
              algo.evaluate(x, y, defaultParams);
            }
          }
        }
        const elapsed = (performance.now() - start) / iterations;
        console.log(`[Math] ${algo.name} (${res}x${res} = ${res * res} pts): ${elapsed.toFixed(3)} ms/frame`);
      }
    }
  });

  it('2. Measure Hydraulic Erosion Physics Simulation Step Time', () => {
    console.log('\n--- BENCHMARK 2: HYDRAULIC EROSION STEP TIME (ms) ---');
    const resolutions = [64, 128];
    const erosion = new HydraulicErosion();

    for (const res of resolutions) {
      const heightmap: number[][] = Array.from({ length: res }, () => new Array(res).fill(5));
      const start = performance.now();
      const steps = 50;
      for (let i = 0; i < steps; i++) {
        erosion.erode(heightmap, 120);
      }
      const elapsed = (performance.now() - start) / steps;
      console.log(`[Erosion] (${res}x${res}): ${elapsed.toFixed(3)} ms/step`);
    }
  });

  it('3. Measure Memory & GC Allocations (2D Array vs Flat Float32Array)', () => {
    console.log('\n--- BENCHMARK 3: MEMORY & GC ALLOCATION TIMING ---');
    const res = 128;
    const count = 100;

    // 2D Array allocation per frame
    const start2D = performance.now();
    for (let i = 0; i < count; i++) {
      const map: number[][] = [];
      for (let y = 0; y < res; y++) {
        const row: number[] = [];
        for (let x = 0; x < res; x++) {
          row.push(Math.random());
        }
        map.push(row);
      }
    }
    const elapsed2D = (performance.now() - start2D) / count;

    // Zero-GC Flat Float32Array in-place mutation
    const flatBuf = new Float32Array(res * res);
    const startFlat = performance.now();
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < res * res; j++) {
        flatBuf[j] = Math.random();
      }
    }
    const elapsedFlat = (performance.now() - startFlat) / count;

    console.log(`[GC Overhead] 2D Array Allocation (128x128): ${elapsed2D.toFixed(3)} ms/frame`);
    console.log(`[GC Overhead] Zero-GC Flat Float32Array (128x128): ${elapsedFlat.toFixed(3)} ms/frame`);
    console.log(`[GC Speedup] Flat array is ${(elapsed2D / elapsedFlat).toFixed(1)}x faster`);
  });

  it('4. Measure Three.js Geometry Normal & Attribute Update Time', () => {
    console.log('\n--- BENCHMARK 4: THREE.JS COMPUTE VERTEX NORMALS TIME ---');
    const resolutions = [64, 128, 256];

    for (const res of resolutions) {
      const geom = new THREE.PlaneGeometry(1, 1, res - 1, res - 1);
      const start = performance.now();
      const count = 50;
      for (let i = 0; i < count; i++) {
        geom.computeVertexNormals();
      }
      const elapsed = (performance.now() - start) / count;
      console.log(`[Geometry] computeVertexNormals (${res}x${res}): ${elapsed.toFixed(3)} ms/call`);
      geom.dispose();
    }
  });

  it('5. Measure Fast Heightmap Grid Normal Calculation Speedup', () => {
    console.log('\n--- BENCHMARK 5: FAST GRID NORMALS VS THREE.JS NORMALS ---');
    const resolutions = [64, 128, 256];

    for (const res of resolutions) {
      const geom = new THREE.PlaneGeometry(1, 1, res - 1, res - 1);
      const positions = geom.attributes.position.array as Float32Array;
      const normals = geom.attributes.normal.array as Float32Array;
      const count = 50;

      // Seed random heights
      for (let i = 0; i < res * res; i++) {
        positions[i * 3 + 2] = Math.random() * 10;
      }

      // Benchmark Three.js computeVertexNormals
      const startThree = performance.now();
      for (let i = 0; i < count; i++) {
        geom.computeVertexNormals();
      }
      const elapsedThree = (performance.now() - startThree) / count;

      // Benchmark Fast Grid Normals
      const dxScale = (res - 1);
      const startFast = performance.now();
      for (let iter = 0; iter < count; iter++) {
        for (let y = 0; y < res; y++) {
          const yM1 = Math.max(0, y - 1) * res;
          const yP1 = Math.min(res - 1, y + 1) * res;
          const yCurr = y * res;
          for (let x = 0; x < res; x++) {
            const xM1 = Math.max(0, x - 1);
            const xP1 = Math.min(res - 1, x + 1);

            const hL = positions[(yCurr + xM1) * 3 + 2];
            const hR = positions[(yCurr + xP1) * 3 + 2];
            const hD = positions[(yM1 + x) * 3 + 2];
            const hU = positions[(yP1 + x) * 3 + 2];

            const dzdx = (hR - hL) * 0.5 * dxScale;
            const dzdy = (hU - hD) * 0.5 * dxScale;

            const nx = -dzdx;
            const ny = -dzdy;
            const nz = 1.0;
            const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);

            const idx = (yCurr + x) * 3;
            normals[idx] = nx * invLen;
            normals[idx + 1] = ny * invLen;
            normals[idx + 2] = nz * invLen;
          }
        }
      }
      const elapsedFast = (performance.now() - startFast) / count;

      console.log(`[Normals] ${res}x${res} - Three.js: ${elapsedThree.toFixed(3)} ms | Fast Grid: ${elapsedFast.toFixed(3)} ms | Speedup: ${(elapsedThree / elapsedFast).toFixed(1)}x`);
      geom.dispose();
    }
  });
});

