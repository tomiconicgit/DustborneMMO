// file: src/game/character/Character.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import Camera from '../../engine/rendering/Camera.js';
import { TILE_SIZE } from '../world/WorldMap.js';
import Debugger from '../../debugger.js';

export default class Character {
  static instance = null;

  static async create() {
    if (Character.instance) return Character.instance;
    Character.instance = new Character();
    await Character.instance._init();
    return Character.instance;
  }

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PlayerCharacter';
    Scene.main.add(this.group);

    this.mixer = null;
    this.model = null;
  }

  async _init() {
    try {
      const loader = new GLTFLoader();
      const url = new URL('../../assets/models/character/character.glb', import.meta.url).href;
      const gltf = await loader.loadAsync(url);

      this.model = gltf.scene;
      this.model.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      this.group.add(this.model);

      // === FIXED SPAWN POINT ===
      const spawnTile = [2, 12]; // x,z tile coordinates
      const worldX = (spawnTile[0] + 0.5) * TILE_SIZE;
      const worldZ = (spawnTile[1] + 0.5) * TILE_SIZE;
      this.group.position.set(worldX, 0, worldZ);

      // === Camera follows player ===
      Camera.main?.setTarget(this.group);

      Debugger.log(`Character spawned at tile [${spawnTile[0]}, ${spawnTile[1]}] → world (${worldX},${worldZ})`);
    } catch (err) {
      Debugger.error('Failed to load character model', err);
    }
  }

  update(delta) {
    if (this.mixer) this.mixer.update(delta);
  }
}