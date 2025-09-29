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

    // Center the CHARACTER on the center of the center tile: (+0.5, +0.5)
    const HALF_TILE = 0.5 * TILE_SIZE;
    this.object3D.position.set(HALF_TILE, 0, HALF_TILE); // <-- key change
  }

  async _load() {
    const scene = Scene.main;
    if (!scene) throw new Error('Scene must be created before Character.');

    const modelURL = new URL('../../assets/models/character/character.glb', import.meta.url).href;
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelURL);

    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error('GLB has no scene.');

    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    // Keep the mesh local at (0, 0.01, 0); parent group already offset to tile center.
    model.position.set(0, 0.01, 0);

    this.object3D.add(model);
    scene.add(this.object3D);

    // For future clamps/movement
    this.halfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    // Camera follows the CHARACTER root (which is now centered in a tile)
    Camera.main?.setTarget?.(this.object3D);
  }
}