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
  }

  async _load() {
    const scene = Scene.main;
    if (!scene) throw new Error('Scene must be created before Character.');

    // Robust URL to your model: src/assets/models/character/character.glb
    const modelURL = new URL('../../assets/models/character/character.glb', import.meta.url).href;

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelURL);

    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error('GLB has no scene.');

    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Place at world center
    model.position.set(0, 0.01, 0);

    this.object3D.add(model);
    scene.add(this.object3D);

    // Bounds (30x30 world)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    // Set camera target
    if (Camera.main?.setTarget) {
      Camera.main.setTarget(this.object3D);
    }
  }
}