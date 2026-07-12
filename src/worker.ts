import { availableAlgorithms } from './algorithms';
type ColorPalette = 'topo' | 'water' | 'magma' | 'monochrome';

// Simple palette mapping copied from renderer
const palettes: Record<ColorPalette, { offset: number; color: {r: number, g: number, b: number} }[]> = {
  topo: [
    { offset: 0.0, color: {r: 0, g: 0.2, b: 0.6} },     // Deep water
    { offset: 0.3, color: {r: 0.1, g: 0.6, b: 0.8} },   // Shallow water
    { offset: 0.35, color: {r: 0.9, g: 0.8, b: 0.6} },  // Sand
    { offset: 0.45, color: {r: 0.2, g: 0.6, b: 0.2} },  // Forest
    { offset: 0.7, color: {r: 0.4, g: 0.3, b: 0.2} },   // Dirt/Rock
    { offset: 0.9, color: {r: 0.9, g: 0.9, b: 0.9} },   // Snow
    { offset: 1.0, color: {r: 1.0, g: 1.0, b: 1.0} }    // Ice
  ],
  magma: [
    { offset: 0.0, color: {r: 0, g: 0, b: 0} },         // Obsidian
    { offset: 0.4, color: {r: 0.4, g: 0, b: 0} },       // Dark Red
    { offset: 0.7, color: {r: 1.0, g: 0.3, b: 0} },     // Orange
    { offset: 0.9, color: {r: 1.0, g: 0.8, b: 0} },     // Yellow
    { offset: 1.0, color: {r: 1.0, g: 1.0, b: 1.0} }    // White hot
  ],
  monochrome: [
    { offset: 0.0, color: {r: 0.1, g: 0.1, b: 0.1} },
    { offset: 1.0, color: {r: 0.9, g: 0.9, b: 0.9} }
  ],
  water: [] // Handled custom
};

function setColorForHeight(h: number, maxH: number, palette: ColorPalette, colors: Float32Array, idx3: number): void {
  const safeMax = maxH === 0 ? 1 : maxH;
  const ratio = Math.max(0, Math.min(1.0, h / safeMax));

  if (palette === 'water') {
    if (ratio < 0.3) {
      const t = ratio / 0.3;
      colors[idx3] = (10 + t * 10) / 255;
      colors[idx3 + 1] = (25 + t * 45) / 255;
      colors[idx3 + 2] = (80 + t * 40) / 255;
    } else if (ratio < 0.7) {
      const t = (ratio - 0.3) / 0.4;
      colors[idx3] = (20 + t * 20) / 255;
      colors[idx3 + 1] = (70 + t * 130) / 255;
      colors[idx3 + 2] = (120 + t * 105) / 255;
    } else {
      const t = (ratio - 0.7) / 0.3;
      colors[idx3] = (40 + t * 215) / 255;
      colors[idx3 + 1] = (200 + t * 55) / 255;
      colors[idx3 + 2] = (225 + t * 30) / 255;
    }
    return;
  }

  const stops = palettes[palette];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].offset && ratio <= stops[i+1].offset) {
      const range = stops[i+1].offset - stops[i].offset;
      const factor = (ratio - stops[i].offset) / range;
      const c1 = stops[i].color;
      const c2 = stops[i+1].color;
      
      colors[idx3] = c1.r + (c2.r - c1.r) * factor;
      colors[idx3 + 1] = c1.g + (c2.g - c1.g) * factor;
      colors[idx3 + 2] = c1.b + (c2.b - c1.b) * factor;
      return;
    }
  }
  
  const lastC = stops[stops.length - 1].color;
  colors[idx3] = lastC.r;
  colors[idx3 + 1] = lastC.g;
  colors[idx3 + 2] = lastC.b;
}

self.onmessage = (e) => {
  const { algorithmName, params, resolution, palette, heightScale } = e.data;
  
  const algoEntry = availableAlgorithms.find(a => a.name === algorithmName);
  if (!algoEntry) return;
  const algo = algoEntry;
  
  const startMath = performance.now();
  
  // Initialize permutation table
  algo.generate(0, 0, params);
  
  const heights = new Float32Array(resolution * resolution);
  const colors = new Float32Array(resolution * resolution * 3);
  
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const h = algo.evaluate(x, y, params);
      
      if (h < minElevation) minElevation = h;
      if (h > maxElevation) maxElevation = h;
      sum += h;
      sumSq += h * h;
      count++;
      
      const idx = y * resolution + x;
      heights[idx] = h;
      
      setColorForHeight(h, heightScale, palette, colors, idx * 3);
    }
  }
  
  const mean = sum / count;
  const ruggedness = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
  const mathTime = performance.now() - startMath;
  
  const ctx: Worker = self as any;
  ctx.postMessage({
    heights,
    colors,
    minElevation,
    maxElevation,
    ruggedness,
    mathTime
  }, [heights.buffer, colors.buffer] as unknown as any);
};
