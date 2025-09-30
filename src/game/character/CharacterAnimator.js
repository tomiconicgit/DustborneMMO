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
    this.walkClip = null;
    this.walkAction = null;
    this.active = null; // 'walk' | null
  }

  async _init() {
    // Grab the loaded character model root
    const root = Character.instance?.object3D;
    if (!root) throw new Error('CharacterAnimator requires Character.instance');

    // The skinned model is the first child under the Character group.
    const modelRoot = root.children[0];
    if (!modelRoot) throw new Error('Character model not found for animator.');

    // Mixer on the model
    this.mixer = new THREE.AnimationMixer(modelRoot);

    // Expose to other systems (Movement already reads these)
    Character.instance.mixer = this.mixer;
    Character.instance.root  = modelRoot;

    // Load walk animation
    const url = new URL('../../assets/models/character/anim-walking.glb', import.meta.url).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    this.walkClip = gltf.animations?.[0] || null;

    if (this.walkClip) {
      this.walkAction = this.mixer.clipAction(this.walkClip);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);   // <-- LOOP
      this.walkAction.clampWhenFinished = false;
      this.walkAction.enabled = true;
      this.walkAction.weight = 1.0;
      this.walkAction.timeScale = 1.0;                       // tweak for speed feel
    }
  }

  playWalk() {
    if (!this.walkAction) return;
    if (this.active === 'walk' && this.walkAction.isRunning() && !this.walkAction.paused) {
      // already looping
      return;
    }
    // (Re)start loop cleanly
    this.walkAction.reset();
    this.walkAction.paused = false;
    this.walkAction.play();
    this.active = 'walk';
  }

  stopAll() {
    if (this.walkAction) {
      // quick blend out
      this.walkAction.fadeOut(0.15);
      // ensure fully stopped after fade
      setTimeout(() => {
        this.walkAction.stop();
        this.walkAction.reset();
      }, 180);
    }
    this.active = null;
  }
}