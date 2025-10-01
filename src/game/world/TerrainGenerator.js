// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/**
 * TerrainGenerator
 * - create(): returns a low-poly beige desert ground that fills the WHOLE world (now 60×30).
 * - loadMiningArea(scene, opts): loads mining-area.glb and fits it to a target footprint
 *   (defaults to 30×30 anchored at the world origin), then rests it on y=0.
 */
export default class TerrainGenerator {
  /** Plain, low-poly desert floor with slight bumps, sized to the whole WorldMap. */
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;   // now 60
    const depth = WORLD_DEPTH * TILE_SIZE;   // 30

    // Modest resolution for low-poly look with gentle bumps.
    const segX = WORLD_WIDTH;   // 60
    const segZ = WORLD_DEPTH;   // 30
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // Subtle sculpting (kept tiny so it’s walkable everywhere)
    const pos = geometry.attributes.position;
    const amp = 0.08;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + width * 0.5;
      const z = pos.getZ(i) + depth * 0.5;
      const u = x / width;
      const v = z / depth;

      const h =
        amp * Math.sin(u * Math.PI * 1.25) * 0.4 +
        amp * Math.cos(v * Math.PI * 1.8)  * 0.35 +
        amp * Math.sin((u + v) * Math.PI * 0.9) * 0.25;

      pos.setY(i, h);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xD8C6A3,     // warm beige
      metalness: 0.0,
      roughness: 0.95,
      flatShading: true,
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // Align so tile (0,0) is at world origin and the plane spans [0..width]×[0..depth]
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
  }

  /**
   * Load and fit the authored "mining-area.glb" so it covers a specific XZ footprint.
   * Defaults to 30×30 anchored at (0,0) so it stays on the left half of the world.
   *
   * @param {THREE.Scene} scene
   * @param {Object} opts
   * @param {number} [opts.targetWidth=30*TILE_SIZE]
   * @param {number} [opts.targetDepth=30*TILE_SIZE]
   * @param {number} [opts.anchorOffsetX=0]  // world-space offset for placement
   * @param {number} [opts.anchorOffsetZ=0]
   * @param {boolean} [opts.restOnGround=true] // place minY at y=0
   * @param {boolean} [opts.log=false]
   */
  static async loadMiningArea(
    scene,
    {
      targetWidth = 30 * TILE_SIZE,
      targetDepth = 30 * TILE_SIZE,
      anchorOffsetX = 0,
      anchorOffsetZ = 0,
      restOnGround = true,
      log = false,
    } = {}
  ) {
    const loader = new GLTFLoader();
    const url = new URL('../../assets/models/terrain/mining-area.glb', import.meta.url).href;

    const gltf = await loader.loadAsync(url);
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) {
      console.warn('[TerrainGenerator] mining-area.glb had no scene; skipping.');
      return null;
    }

    // Prepare materials for correct rendering & shadows
    root.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m && (m.side = THREE.FrontSide));
          else o.material.side = THREE.FrontSide;
        }
      }
    });

    // Compute bounds (pre-transform)
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const min = new THREE.Vector3();
    box.getSize(size);
    box.getMin(min);

    if (size.x <= 0 || size.z <= 0) {
      console.warn('[TerrainGenerator] mining-area.glb degenerate bounds; adding raw.');
      scene.add(root);
      return root;
    }

    // Uniformly scale to fit the requested footprint
    const scaleX = targetWidth / size.x;
    const scaleZ = targetDepth / size.z;
    const scale = Math.min(scaleX, scaleZ);
    root.scale.setScalar(scale);

    // Place so the model’s minX/minZ align at (anchorOffsetX, anchorOffsetZ)
    const offsetX = -min.x * scale + anchorOffsetX;
    const offsetZ = -min.z * scale + anchorOffsetZ;

    // Rest on ground (y=0) by lifting -minY*scale
    let offsetY = 0;
    if (restOnGround) {
      // recompute minY using the same pre-scale min
      offsetY = -min.y * scale;
    }

    root.position.set(offsetX, offsetY, offsetZ);
    root.name = 'MiningArea';

    scene.add(root);

    if (log) {
      console.log('[TerrainGenerator] Mining area loaded:',
        { targetWidth, targetDepth, offsetX, offsetZ, offsetY, scale });
    }

    return root;
  }
}