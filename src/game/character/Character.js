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

    // === FIXED SPAWN TILE ===
    // Tile [2,12] → world center:
    const spawnTileX = 2;
    const spawnTileZ = 12;
    const worldX = (spawnTileX + 0.5) * TILE_SIZE;
    const worldZ = (spawnTileZ + 0.5) * TILE_SIZE;
    this.object3D.position.set(worldX, 0, worldZ);

    this.modelRoot = null;
    this.mixer = null;
    this.pickaxe = null;
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

    this.modelRoot = model;
    this.object3D.add(model);
    scene.add(this.object3D);

    this.halfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    await this._attachPickaxe();

    Camera.main?.setTarget?.(this.object3D);
  }

  async _attachPickaxe() {
    try {
      const toolURL = new URL('../../assets/models/tools/wooden-pickaxe.glb', import.meta.url).href;
      const gltf = await new GLTFLoader().loadAsync(toolURL);
      const pickaxe = gltf.scene;
      pickaxe.name = 'WoodenPickaxe';

      const searchRoot = this.modelRoot || this.object3D;
      const rightHand = searchRoot.getObjectByName('RightHand');
      if (!rightHand) {
        console.warn('[Character] RightHand bone not found — cannot attach pickaxe.');
        return;
      }

      pickaxe.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

      // Attachment transform
      pickaxe.position.set(0.2, 0.2, 0.0);
      pickaxe.scale.set(0.1353, 0.1353, 0.1353);
      pickaxe.rotation.order = 'YXZ';
      pickaxe.rotation.set(
        THREE.MathUtils.degToRad(-60),
        THREE.MathUtils.degToRad(40),
        THREE.MathUtils.degToRad(-90)
      );

      rightHand.add(pickaxe);
      pickaxe.matrixAutoUpdate = true;

      this.pickaxe = pickaxe;

      // Ensure first-frame transform is correct
      rightHand.updateWorldMatrix(true, true);
      pickaxe.updateMatrixWorld(true);
    } catch (err) {
      console.warn('[Character] Failed to load/attach pickaxe:', err);
    }
  }
}