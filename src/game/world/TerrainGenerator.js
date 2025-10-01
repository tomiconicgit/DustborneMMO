// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/**
 * TerrainGenerator
 * - create(): returns a low-poly beige desert ground that fills the 30×30 area.
 * - loadMiningArea(scene): loads src/assets/models/terrain/mining-area.glb, fits it to the same 30×30 XZ footprint,
 *   and snaps its base to y=0. Meshes cast/receive shadows.
 */
export default class TerrainGenerator {
  /** Plain, low-poly desert floor with slight bumps, sized to WorldMap. */
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;   // 30
    const depth = WORLD_DEPTH * TILE_SIZE;   // 30

    // Low-poly look: 30×30 segments gives nice faceting without looking noisy.
    const segX = WORLD_WIDTH;  // 30
    const segZ = WORLD_DEPTH;  // 30
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // Subtle sculpting: very small, smooth bumps so it feels like packed desert sand.
    const pos = geometry.attributes.position;
    const amp = 0.08; // height variation in meters (small)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + width * 0.5;   // 0..width
      const z = pos.getZ(i) + depth * 0.5;   // 0..depth
      const u = x / width;
      const v = z / depth;

      // Mixed sines = soft, tile-friendly variation (no harsh noise).
      const h =
        amp * Math.sin(u * Math.PI * 1.25) * 0.4 +
        amp * Math.cos(v * Math.PI * 1.8)  * 0.35 +
        amp * Math.sin((u + v) * Math.PI * 0.9) * 0.25;

      pos.setY(i, h);
    }
    geometry.computeVertexNormals();

    // Low-poly desert: flatShading, warm beige albedo. No normal/roughness maps.
    const material = new THREE.MeshStandardMaterial({
      color: 0xD8C6A3,       // warm beige
      metalness: 0.0,
      roughness: 0.95,
      flatShading: true,
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // Align so tile (0,0) originates at (0,0) and the plane spans 0..width / 0..depth
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
  }

  /**
   * Load and fit the authored "mining-area.glb" so it exactly covers the same 30×30 footprint in XZ.
   * Adjusts Y so the model rests on y=0 (uses its bounding box min).
   * Leaves the procedural floor underneath.
   */
  static async loadMiningArea(scene) {
    const width = WORLD_WIDTH * TILE_SIZE;   // 30
    const depth = WORLD_DEPTH * TILE_SIZE;   // 30

    const loader = new GLTFLoader();
    const url = new URL('../../assets/models/terrain/mining-area.glb', import.meta.url).href;

    const gltf = await loader.loadAsync(url);
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) {
      console.warn('[TerrainGenerator] mining-area.glb had no scene; skipping.');
      return null;
    }

    // Ensure all meshes participate in lighting/shadows
    root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;

        // Keep materials solid (FrontSide) so cliffs look correct.
        if (o.material && !Array.isArray(o.material)) {
          o.material.side = THREE.FrontSide;
        } else if (Array.isArray(o.material)) {
          o.material.forEach((m) => m && (m.side = THREE.FrontSide));
        }
      }
    });

    // Compute authored bounds (pre-transform)
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const min  = new THREE.Vector3();
    box.getSize(size);
    box.getMin(min);

    if (size.x <= 0 || size.z <= 0) {
      console.warn('[TerrainGenerator] mining-area.glb bounds look degenerate; adding as-is.');
      scene.add(root);
      return root;
    }

    // Fit uniformly to our world footprint (keeps proportions)
    const scaleX = width / size.x;
    const scaleZ = depth / size.z;
    const scale  = Math.min(scaleX, scaleZ);
    root.scale.setScalar(scale);

    // Anchor minX→0 and minZ→0 (front-left corner at world origin), and rest base on y=0
    const offsetX = -min.x * scale;
    const offsetZ = -min.z * scale;
    const offsetY = -min.y * scale; // bring base to y=0

    root.position.set(offsetX, offsetY, offsetZ);
    root.name = 'MiningArea';

    // Render above ground (just in case some coplanar faces exist)
    root.renderOrder = 1;

    scene.add(root);
    return root;
  }
}