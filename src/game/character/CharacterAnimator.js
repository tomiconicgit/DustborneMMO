// file: src/game/character/CharacterAnimator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Character from './Character.js';

export default class CharacterAnimator {
  static main = null;
  static async create() {
    if (CharacterAnimator.main) return;
    CharacterAnimator.main = new CharacterAnimator();
    await CharacterAnimator.main._init();
  }

  constructor() {
    this.mixer = null;
    this.modelRoot = null;
    this.walkClip = null;
    this.walkAction = null;
    this.active = null;
  }

  async _init() {
    const root = Character.instance?.object3D;
    if (!root) throw new Error('CharacterAnimator requires Character.instance');

    // The model root (skinned mesh group) is the first child under Character.object3D
    this.modelRoot = root.children[0];
    if (!this.modelRoot) throw new Error('Character model not found for animator.');

    // Create the mixer for the model
    this.mixer = new THREE.AnimationMixer(this.modelRoot);

    // Load walking animation GLB
    const url = new URL('../../assets/models/character/anim-walking.glb', import.meta.url).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    this.walkClip = gltf.animations?.[0] || null;

    if (this.walkClip) {
      this.walkAction = this.mixer.clipAction(this.walkClip);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
      this.walkAction.clampWhenFinished = false;
      this.walkAction.enabled = true;
      this.walkAction.weight = 1.0;
      this.walkAction.timeScale = 1.0;
    }
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
  }

  playWalk() {
    if (!this.walkAction) return;
    if (this.active === 'walk') return;

    this.walkAction.reset();
    this.walkAction.paused = false;
    this.walkAction.play();
    this.active = 'walk';
  }

  stopAll() {
    if (this.walkAction) {
      this.walkAction.fadeOut(0.15);
      setTimeout(() => {
        this.walkAction.stop();
        this.walkAction.reset();
      }, 180);
    }
    this.active = null;
  }
}