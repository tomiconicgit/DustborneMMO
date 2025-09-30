import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import Camera from '../../engine/rendering/Camera.js';

export default class Character {
  static main = null;

  static async create() {
    if (Character.main) return Character.main;
    Character.main = new Character();
    await Character.main._init();
    return Character.main;
  }

  constructor() {
    this.object = null;       // The character root
    this.mixer = null;        // Animation mixer
    this.actions = {};        // Animation actions
    this.pickaxe = null;      // Reference to pickaxe mesh
  }

  async _init() {
    const loader = new GLTFLoader();

    // --- Load character model ---
    const gltf = await loader.loadAsync('./src/assets/models/character/character.glb');
    this.object = gltf.scene;
    this.object.name = 'PlayerCharacter';
    this.object.position.set(0, 0, 0);

    Scene.main.add(this.object);

    // Setup animations if present
    if (gltf.animations && gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.object);
      gltf.animations.forEach(clip => {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      });
    }

    // --- Attach pickaxe ---
    await this._attachPickaxe();

    // Camera follows this character
    Camera.main.setTarget(this.object);
  }

  async _attachPickaxe() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('./src/assets/models/tools/wooden-pickaxe.glb');
    this.pickaxe = gltf.scene;
    this.pickaxe.name = 'WoodenPickaxe';

    // ✅ Find right hand bone
    const rightHand = this.object.getObjectByName('RightHand');
    if (!rightHand) {
      console.warn('⚠️ RightHand bone not found in character skeleton.');
      return;
    }

    // Apply transform offsets (from your old PWA setup)
    this.pickaxe.position.set(0.2, 0.4, 0);      // adjust
    this.pickaxe.scale.set(0.161, 0.161, 0.176); // adjust
    this.pickaxe.rotation.set(
      THREE.MathUtils.degToRad(-75.5),
      THREE.MathUtils.degToRad(-79.0),
      THREE.MathUtils.degToRad(0.0)
    );

    // Parent to hand bone
    rightHand.add(this.pickaxe);
  }

  update(delta) {
    if (this.mixer) this.mixer.update(delta);
  }
}