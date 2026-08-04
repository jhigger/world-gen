import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainAlgorithm, TerrainParams } from './algorithms';

/**
 * Color palettes supported by the viewer.
 */
export type ColorPalette = 'topo' | 'water' | 'magma' | 'monochrome';

/**
 * Metrics collected during a single terrain render pass.
 */
export interface RenderStats {
  renderTime: number;
  mathTime: number;
  ruggedness: number;
  minElevation: number;
  maxElevation: number;
}

function areParamsEqual(p1: TerrainParams | null, p2: TerrainParams): boolean {
  if (!p1) return false;
  return (
    p1.scale === p2.scale &&
    p1.octaves === p2.octaves &&
    p1.persistence === p2.persistence &&
    p1.heightScale === p2.heightScale &&
    p1.widthScale === p2.widthScale &&
    p1.seed === p2.seed &&
    p1.offsetX === p2.offsetX &&
    p1.offsetY === p2.offsetY
  );
}

/**
 * Three.js WebGL Terrain Renderer.
 * 
 * Migrates our custom 3D projection engine to WebGL, running entirely on the GPU.
 * It sets up a PerspectiveCamera, OrbitControls, and custom lights to render the
 * generated terrain heightmaps as low-poly standard meshes with vertex colors.
 */
export class TerrainRenderer {
  private canvas: HTMLCanvasElement;
  private algorithm: TerrainAlgorithm;
  
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  
  private mesh: THREE.Mesh | null = null;
  // Use LineSegments to render clean, native 1D line primitives directly in WebGL.
  private wireframe: THREE.Mesh | THREE.LineSegments | null = null;
  private geometry: THREE.PlaneGeometry | null = null;
  private solidMaterial: THREE.MeshStandardMaterial;
  private wireframeBaseMaterial: THREE.MeshStandardMaterial;
  // Use LineBasicMaterial as the standard native material for line rendering.
  private wireframeMaterial: THREE.MeshBasicMaterial;

  private resizeObserver?: ResizeObserver;

  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;

  // Render caching to prevent expensive buffer updates on static frames
  private lastParams: any = null;
  private lastRenderCache = {
    resolution: -1,
    heightScale: -1,
    palette: '' as ColorPalette,
    heightmapRef: null as number[][] | null,
    widthScale: -1,
    ruggedness: 0,
    minElevation: 0,
    maxElevation: 0,
    startTime: 0
  };

  public onStatsUpdate?: (stats: RenderStats) => void;

  async init(): Promise<void> {}

  constructor(canvas: HTMLCanvasElement, algorithm: TerrainAlgorithm) {
    this.canvas = canvas;
    this.algorithm = algorithm;

    // 1. Create WebGL Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080e);

    // 2. Setup Camera
    const parentRect = this.canvas.parentElement?.getBoundingClientRect() || { width: 400, height: 300 };
    this.camera = new THREE.PerspectiveCamera(
      45,
      parentRect.width / parentRect.height,
      0.1,
      100
    );
    // Position camera looking down at the origin
    this.camera.position.set(1.2, 1.4, 1.8);

    // 3. Setup WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(parentRect.width, parentRect.height, false);

    // 4. Setup Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.15;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10.0;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // 5. Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.dirLight.position.set(5, 10, 3);
    this.scene.add(this.dirLight);

    // 6. Setup Materials
    // Solid textured material
    this.solidMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.15,
      flatShading: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    // Dark solid base for the wireframe overlay
    this.wireframeBaseMaterial = new THREE.MeshStandardMaterial({
      color: 0x161b26,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    // Initialize with MeshBasicMaterial and wireframe = true to cleanly overlay the grid in WebGPU.
    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true
      // WebGPU STRICTLY FORBIDS polygonOffset (depthBias) on LineList topologies!
      // We rely entirely on the solid base material's positive polygon offset to push the base backwards.
    });

    // 7. Setup ResizeObserver for robust layout syncing during CSS transitions
    const parent = this.canvas.parentElement;
    if (parent) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(parent);
    }
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getControls(): OrbitControls {
    return this.controls;
  }

  /**
   * Resizes the WebGL viewport and camera aspect ratios on DOM bounds changes.
   */
  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
    this.controls.update();
  }


  /**
   * Disposes of all WebGL and Three.js resources associated with this viewport.
   */
  dispose(): void {
    this.controls.dispose();
    this.geometry?.dispose();
    if (this.wireframe) {
      // Dispose of the line geometry GPU resources when the component is destroyed to prevent memory leaks.
      this.wireframe.geometry.dispose();
    }
    this.solidMaterial.dispose();
    this.wireframeBaseMaterial.dispose();
    this.wireframeMaterial.dispose();
    this.renderer.dispose();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }



  /**
   * Generates or retrieves the heightmap mesh and returns render statistics.
   * If a customHeightmap is provided (like from the erosion simulation), it renders that instead.
   * @returns Collected render metrics (RenderStats) or void if dispatched to worker.
   */
  render(params: TerrainParams, resolution: number, palette: ColorPalette, showWireframe: boolean, customHeightmap?: number[][], forceDirty: boolean = false): RenderStats | void {
    const startTime = performance.now();
    this.lastRenderCache.startTime = startTime;

    const hasCustomMap = customHeightmap !== undefined;

    // 2. Check if we need to recalculate geometry and metrics
    const cache = this.lastRenderCache;
    const paramsChanged = !areParamsEqual(this.lastParams, params);
    
    const isDirty = forceDirty ||
                    paramsChanged ||
                    cache.resolution !== resolution ||
                    cache.heightScale !== params.heightScale ||
                    cache.palette !== palette ||
                    cache.heightmapRef !== (customHeightmap || null) ||
                    cache.widthScale !== params.widthScale;

    let ruggedness = cache.ruggedness;
    let minElevation = cache.minElevation;
    let maxElevation = cache.maxElevation;

    // 3. Re-create geometry if the resolution changes
    if (!this.geometry || this.geometry.parameters.widthSegments !== resolution - 1) {
      if (this.mesh) this.scene.remove(this.mesh);
      if (this.wireframe) this.scene.remove(this.wireframe);

      this.geometry = new THREE.PlaneGeometry(
        1,
        1,
        resolution - 1,
        resolution - 1
      );
      
      this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(resolution * resolution * 3), 3));

      this.mesh = new THREE.Mesh(this.geometry, this.solidMaterial);
      this.mesh.rotation.x = -Math.PI / 2;
      this.scene.add(this.mesh);

      this.wireframe = new THREE.Mesh(this.geometry, this.wireframeMaterial);
      this.wireframe.rotation.x = -Math.PI / 2;
      
      this.scene.add(this.wireframe);

      // Force recalculation when geometry changes
      Object.assign(cache, { resolution: -1 }); 
    }

    // Handle wireframe visibility
    if (this.mesh) this.mesh.visible = !showWireframe;
    if (this.wireframe) this.wireframe.visible = showWireframe;
    
    this.mesh!.scale.set(params.widthScale, params.widthScale, 1);
    if (this.wireframe) {
      this.wireframe.scale.set(params.widthScale, params.widthScale, 1);
    }

    // 4. Update height map vertices and colors ONLY if properties changed
    if (isDirty) {
      const positions = this.geometry.attributes.position.array as Float32Array;
      const colors = this.geometry.attributes.color.array as Float32Array;
      
      const positionAttr = this.geometry.attributes.position;
      const colorAttr = this.geometry.attributes.color;

      let sum = 0;
      let sumSq = 0;
      let count = 0;
      const mathStart = performance.now();

      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          let h = 0;
          if (hasCustomMap) {
            h = customHeightmap[y][x];
          } else {
            h = this.algorithm.evaluate(x, y, params);
          }
          
          if (h < minElevation) minElevation = h;
          if (h > maxElevation) maxElevation = h;
          sum += h;
          sumSq += h * h;
          count++;

          const idx = y * resolution + x;
          positions[idx * 3 + 2] = h;
          this.setColorForHeight(h, params.heightScale, palette, colors, idx * 3);
        }
      }

      const mathTime = performance.now() - mathStart;
      const mean = sum / count;
      ruggedness = Math.sqrt(Math.max(0, (sumSq / count) - (mean * mean)));
      
      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();

      this.lastRenderCache = {
        resolution,
        heightScale: params.heightScale,
        palette,
        heightmapRef: customHeightmap || null,
        widthScale: params.widthScale,
        ruggedness,
        minElevation,
        maxElevation,
        startTime
      };
      this.lastParams = { ...params };

      if (this.onStatsUpdate) {
        this.onStatsUpdate({
          renderTime: performance.now() - startTime,
          mathTime,
          ruggedness,
          minElevation,
          maxElevation
        });
      }
    }

    // Render the scene to the WebGL canvas
    this.renderer.render(this.scene, this.camera);

    const totalTime = performance.now() - startTime;

    return {
      minElevation,
      maxElevation,
      ruggedness,
      renderTime: totalTime,
      mathTime: totalTime // For sync, it's roughly the same
    };
  }

  /**
   * Evaluates terrain height and returns RGB colors [r, g, b] in range [0, 255].
   */
  private setColorForHeight(h: number, maxH: number, palette: ColorPalette, colors: Float32Array, idx3: number): void {
    // Prevent division by zero when heightScale is 0
    const safeMax = maxH === 0 ? 1 : maxH;
    const ratio = Math.max(0, Math.min(1.0, h / safeMax));

    if (palette === 'water') {
      // Water style: Deep Blue -> Teal -> Aqua -> White Foam
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

    if (palette === 'magma') {
      // Thermal profile: Black -> Red -> Orange -> Yellow -> White
      if (ratio < 0.2) {
        colors[idx3] = (ratio * 5 * 120) / 255;
        colors[idx3 + 1] = 0;
        colors[idx3 + 2] = 0;
      } else if (ratio < 0.5) {
        colors[idx3] = Math.min(255, 120 + (ratio - 0.2) * 3.33 * 135) / 255;
        colors[idx3 + 1] = Math.min(255, (ratio - 0.2) * 3.33 * 80) / 255;
        colors[idx3 + 2] = 0;
      } else if (ratio < 0.8) {
        colors[idx3] = 1.0;
        colors[idx3 + 1] = Math.min(255, 80 + (ratio - 0.5) * 3.33 * 150) / 255;
        colors[idx3 + 2] = ((ratio - 0.5) * 3.33 * 50) / 255;
      } else {
        colors[idx3] = 1.0;
        colors[idx3 + 1] = (230 + (ratio - 0.8) * 5 * 25) / 255;
        colors[idx3 + 2] = (50 + (ratio - 0.8) * 5 * 205) / 255;
      }
      return;
    }

    if (palette === 'monochrome') {
      // Silver metallic tones
      const val = (40 + ratio * 180) / 255;
      colors[idx3] = val;
      colors[idx3 + 1] = (40 + ratio * 180 + 5) / 255;
      colors[idx3 + 2] = (40 + ratio * 180 + 12) / 255;
      return;
    }

    // Default: Natural Topographical (Water, Sand, Grass, Rock, Snow)
    if (ratio < 0.15) {
      colors[idx3] = 15 / 255;
      colors[idx3 + 1] = 32 / 255;
      colors[idx3 + 2] = 70 / 255;
    } else if (ratio < 0.25) {
      const t = (ratio - 0.15) / 0.10;
      colors[idx3] = (15 + t * 195) / 255;
      colors[idx3 + 1] = (32 + t * 158) / 255;
      colors[idx3 + 2] = (70 + t * 50) / 255;
    } else if (ratio < 0.55) {
      const t = (ratio - 0.25) / 0.30;
      colors[idx3] = (210 - t * 176) / 255;
      colors[idx3 + 1] = (190 - t * 62) / 255;
      colors[idx3 + 2] = (120 - t * 64) / 255;
    } else if (ratio < 0.80) {
      const t = (ratio - 0.55) / 0.25;
      colors[idx3] = (34 + t * 76) / 255;
      colors[idx3 + 1] = (128 - t * 18) / 255;
      colors[idx3 + 2] = (56 + t * 54) / 255;
    } else {
      const t = (ratio - 0.80) / 0.20;
      colors[idx3] = (110 + t * 135) / 255;
      colors[idx3 + 1] = (110 + t * 138) / 255;
      colors[idx3 + 2] = (110 + t * 145) / 255;
    }
  }
}
