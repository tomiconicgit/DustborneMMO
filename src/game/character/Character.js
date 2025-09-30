// file: src/game/character/Character.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import Camera from '../../engine/rendering/Camera.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class Character {
  static instance = null;

  static async create() {
    if (Character.instance) return;
    Character.instance = new Character();
    await Character.instance._load();
  }

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.name = 'PlayerCharacter';

    // Spawn within a tile near world origin (tile center)
    const HALF_TILE = 0.5 * TILE_SIZE;
    this.object3D.position.set(HALF_TILE, 0, HALF_TILE);

    this.modelRoot = null;   // loaded mesh root
    this.mixer = null;       // set by CharacterAnimator if needed
    this.pickaxe = null;     // tool instance once loaded
  }

  setMixer(mixer) {
    this.mixer = mixer;
  }

  get root() {
    return this.modelRoot || this.object3D;
  }

  async _load() {
    const scene = Scene.main;
    if (!scene) throw new Error('Scene must be created before Character.');

    // Load character mesh
    const modelURL = new URL('../../assets/models/character/character.glb', import.meta.url).href;
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelURL);

    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error('GLB has no scene.');

    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    model.position.set(0, 0.01, 0);
    this.modelRoot = model;
    this.object3D.add(model);
    scene.add(this.object3D);

    // Cache world extents (if needed later)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    // Attach pickaxe to RightHand bone
    await this._attachPickaxe();

    // Let camera orbit this character
    Camera.main?.setTarget?.(this.object3D);
  }

  async _attachPickaxe() {
    try {
      // ✅ correct asset path (you said the file is here)
      const toolURL = new URL('../../assets/models/tools/wooden-pickaxe.glb', import.meta.url).href;
      const gltf = await new GLTFLoader().loadAsync(toolURL);
      const pickaxe = gltf.scene;
      pickaxe.name = 'WoodenPickaxe';

      // Strictly use the RightHand bone name you provided
      // Search inside the loaded character model root
      const searchRoot = this.modelRoot || this.object3D;
      const rightHand = searchRoot.getObjectByName('RightHand');

      if (!rightHand) {
        console.warn(
          '[Character] RightHand bone not found on model — cannot attach pickaxe.'
        );
        return;
      }

      // Make sure the tool renders nicely
      pickaxe.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

      // Pose offsets (from your old PWA numbers; tweak as needed)
      pickaxe.position.set(0.20, 0.40, 0.00);
      pickaxe.scale.set(0.161, 0.161, 0.176);
      pickaxe.rotation.set(
        THREE.MathUtils.degToRad(-75.5),
        THREE.MathUtils.degToRad(-79.0),
        THREE.MathUtils.degToRad(0.0)
      );

      // Parent to the bone so it follows all animations
      rightHand.add(pickaxe);

      // Safety: ensure transforms keep updating with the bone’s animation
      pickaxe.matrixAutoUpdate = true;

      this.pickaxe = pickaxe;
      // Force one world-matrix update pass so initial transform is correct
      rightHand.updateWorldMatrix(true, true);
      pickaxe.updateMatrixWorld(true);
    } catch (err) {
      console.warn('[Character] Failed to load/attach pickaxe:', err);
    }
  }
}