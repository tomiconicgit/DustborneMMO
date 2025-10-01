// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';
import Debugger from '../../debugger.js';

/**
 * TerrainGenerator
 * - create(): low-poly beige desert ground that fills the 30×30 area.
 * - loadMiningArea(scene, opts): loads src/assets/models/terrain/mining-area.glb,
 *   centers it on the 30×30 footprint, rests it on y=0, and only auto-scales if needed.
 */
export default class TerrainGenerator {
  /** Plain, low-poly desert floor with slight bumps, sized to WorldMap. */
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;   // 30
    const depth = WORLD_DEPTH * TILE_SIZE;   // 30

    // Low-poly look: 30×30 segments gives nice faceting.
    const segX = WORLD_WIDTH;  // 30
    const segZ = WORLD_DEPTH;  // 30
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // Subtle sculpting: small, smooth bumps for packed desert sand.
    const pos = geometry.attributes.position;
    const amp = 0.08; // height variation in meters (small)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + width * 0.5;   // 0..width
      const z = pos.getZ(i) + depth * 0.5;   // 0..depth
      const u = x / width;
      const v = z / depth;

      const h =
        amp * Math.sin(u * Math.PI * 1.25) * 0.4 +
        amp * Math.cos(v * Math.PI * 1.8)  * 0.35 +
        amp * Math.sin((u + v) * Math.PI * 0.9) * 0.25;

      pos.setY(i, h);
    }
    geometry.computeVertexNormals();

    // Low-poly desert material: flatShading, warm beige.
    const material = new THREE.MeshStandardMaterial({
      color: 0xD8C6A3,
      metalness: 0.0,
      roughness: 0.95,
      flatShading: true,
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // Align so tile (0,0) is at (0,0) and plane spans 0..width / 0..depth
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
  }

  /**
   * Load and place the authored "mining-area.glb".
   * Strategy:
   *  - Keep authored transforms (scale/rotation) whenever possible.
   *  - Compute bounding box, then:
   *    * Center its XZ to world center (width/2, depth/2).
   *    * Rest minY on y=0 (offset Y by -minY).
   *    * If authored size differs a lot from the 30×30 footprint, apply uniform auto-scale.
   */
  static async loadMiningArea(scene, opts = {}) {
    const width = WORLD_WIDTH * TILE_SIZE;   // 30
    const depth = WORLD_DEPTH * TILE_SIZE;   // 30
    const worldCenter = new THREE.Vector3(width / 2, 0, depth / 2);

    const {
      autoScale = true,        // only scale if size mismatch is significant
      sizeTolerance = 0.12,    // 12% mismatch allowed before scaling
      restOnGround = true,     // snap base to y=0
      log = true,              // verbose debug logs
    } = opts;

    const loader = new GLTFLoader();
    const url = new URL('../../assets/models/terrain/mining-area.glb', import.meta.url).href;

    const gltf = await loader.loadAsync(url);
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) {
      Debugger.warn('[TerrainGenerator] mining-area.glb had no scene; skipping.');
      return null;
    }

    // lighting/shadows + robust rendering
    root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m && (m.side = THREE.FrontSide));
          else o.material.side = THREE.FrontSide;
        }
      }
    });
    root.frustumCulled = false;
    root.renderOrder = 1;
    root.name = 'MiningArea';

    // Compute authored bounds (with authored transforms)
    const authoredBox = new THREE.Box3().setFromObject(root);
    const authoredSize = authoredBox.getSize(new THREE.Vector3());
    const authoredMin = authoredBox.min.clone();
    const authoredMax = authoredBox.max.clone();

    if (log) {
      Debugger.log('[MiningArea] Authored size (x,z):', authoredSize.x.toFixed(3), authoredSize.z.toFixed(3));
      Debugger.log('[MiningArea] Authored min:', authoredMin);
      Debugger.log('[MiningArea] Authored max:', authoredMax);
    }

    if (authoredSize.x <= 0 || authoredSize.z <= 0) {
      Debugger.warn('[TerrainGenerator] mining-area.glb bounds look degenerate; adding as-is.');
      scene.add(root);
      return root;
    }

    // Decide whether to scale
    let scaleApplied = 1.0;
    if (autoScale) {
      const sx = width / authoredSize.x;
      const sz = depth / authoredSize.z;
      const withinTolX = Math.abs(1 - authoredSize.x / width) <= sizeTolerance;
      const withinTolZ = Math.abs(1 - authoredSize.z / depth) <= sizeTolerance;

      if (!withinTolX || !withinTolZ) {
        // use uniform scale to preserve proportions (choose min so it definitely fits)
        scaleApplied = Math.min(sx, sz);
        root.scale.multiplyScalar(scaleApplied);
        if (log) Debugger.log('[MiningArea] Auto-scale applied:', scaleApplied.toFixed(4));
      } else if (log) {
        Debugger.log('[MiningArea] Kept authored scale (within tolerance).');
      }
    } else if (log) {
      Debugger.log('[MiningArea] Auto-scale disabled; keeping authored scale.');
    }

    // Recompute bounds after possible scaling
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const min  = box.min.clone();
    const max  = box.max.clone();
    const center = box.getCenter(new THREE.Vector3());

    // Compute offsets:
    //  - Center in XZ
    //  - Rest on ground (minY -> 0)
    const offsetToCenter = new THREE.Vector3().subVectors(worldCenter, new THREE.Vector3(center.x, 0, center.z));
    const offsetY = restOnGround ? -min.y : 0;

    root.position.x += offsetToCenter.x;
    root.position.z += offsetToCenter.z;
    root.position.y += offsetY;

    if (log) {
      Debugger.log('[MiningArea] Final size (x,z):', size.x.toFixed(3), size.z.toFixed(3));
      Debugger.log('[MiningArea] Placed at:', root.position);
    }

    scene.add(root);
    return root;
  }
}