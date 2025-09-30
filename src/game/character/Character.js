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
    this.modelRoot = null;
    this.mixer = null;
  }

  setMixer(mixer) { this.mixer = mixer; }
  get root() { return this.modelRoot || this.object3D; }

  async _load() {
    const scene = Scene.main;
    if (!scene) throw new Error('Scene must be created before Character.');

    const modelURL = new URL('../../assets/models/character/character.glb', import.meta.url).href;
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelURL);

    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) throw new Error('GLB has no scene.');
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.position.set(0, 0.01, 0);

    // ✅ Start at exact world center tile
    const cx = Math.floor(WORLD_WIDTH * 0.5);
    const cz = Math.floor(WORLD_DEPTH * 0.5);
    const startX = (cx + 0.5) * TILE_SIZE;      // 15.5
    const startZ = (cz + 0.5) * TILE_SIZE;      // 15.5
    this.object3D.position.set(startX, 0, startZ);

    this.modelRoot = model;
    this.object3D.add(model);
    scene.add(this.object3D);

    Camera.main?.setTarget?.(this.object3D);
  }
}