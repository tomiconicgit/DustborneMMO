// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

export default class TerrainGenerator {
  /**
   * Creates a placeholder group named 'ProceduralGround' immediately,
   * then loads and fits the GLB terrain into it so that:
   *  - X/Z bounds map exactly to [0..WORLD_WIDTH*TILE_SIZE] × [0..WORLD_DEPTH*TILE_SIZE]
   *  - the lowest point of the mesh sits at y = 0
   */
  static create() {
    const targetW = WORLD_WIDTH * TILE_SIZE;   // 30
    const targetD = WORLD_DEPTH * TILE_SIZE;   // 30

    // Placeholder group returned synchronously (so the rest of the engine is unchanged)
    const groundGroup = new THREE.Group();
    groundGroup.name = 'ProceduralGround';
    groundGroup.matrixAutoUpdate = true;

    // Async load + fit
    (async () => {
      try {
        const url = new URL('../../assets/models/terrain/mining-area.glb', import.meta.url).href;
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(url);

        // Grab the loaded root (clone so we can safely modify transforms)
        const root = (gltf.scene || gltf.scenes?.[0])?.clone(true);
        if (!root) throw new Error('mining-area.glb has no scene');

        // Enable shadows
        root.traverse(o => {
          if (o.isMesh) {
            o.castShadow = false;     // static terrain usually doesn’t cast (sun does), but flip to true if you want
            o.receiveShadow = true;
          }
        });

        // Compute original bounds
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const min  = new THREE.Vector3();
        box.getSize(size);
        box.getMin(min);

        // Protect against degenerate bounds
        const eps = 1e-6;
        const srcW = Math.max(size.x, eps);
        const srcD = Math.max(size.z, eps);
        const srcH = Math.max(size.y, eps);

        // Scale X/Z so outer edges touch 30×30 exactly (non-uniform to preserve authored aspect)
        const sx = targetW / srcW;
        const sz = targetD / srcD;

        // Optional: gentle vertical scale if you want cliffs a touch taller/shorter
        const verticalScale = 1.0; // tweak to taste
        const sy = verticalScale;

        root.scale.set(sx, sy, sz);

        // After scaling, recompute bounds to position properly
        const box2 = new THREE.Box3().setFromObject(root);
        const min2 = new THREE.Vector3();
        const size2 = new THREE.Vector3();
        box2.getMin(min2);
        box2.getSize(size2);

        // We want:
        //   minX -> 0, minZ -> 0 (touch world origin in X/Z)
        //   minY -> 0 (lowest point at y=0)
        // Compute the offset needed to move min2 to (0,0,0) in X/Z and Y
        const offset = new THREE.Vector3(-min2.x, -min2.y, -min2.z);

        // Apply translation
        root.position.add(offset);

        // (Sanity) The model should now span [0..targetW] × [0..targetD] in X/Z.
        // If the authoring coordinate system is rotated, uncomment a Y rotation here,
        // then re-run the fit steps. Most glTFs are Y-up and won’t need this.

        // Add to the placeholder group
        groundGroup.add(root);

        // Tiny nudge so raycasts don’t Z-fight with perfectly-flat areas
        groundGroup.position.y += 0.0;

      } catch (err) {
        console.error('[TerrainGenerator] Failed to load mining-area.glb:', err);
        // If loading fails, fall back to a simple invisible plane so picking still works
        const fallback = new THREE.Mesh(
          new THREE.PlaneGeometry(targetW, targetD, 1, 1),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        fallback.rotateX(-Math.PI / 2);
        fallback.position.set(targetW / 2, 0, targetD / 2);
        groundGroup.add(fallback);
      }
    })();

    return groundGroup;
  }
}