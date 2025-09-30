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

    this._isMoving = false;   // authoritative state
    this._fade = 0.18;        // quick cross-fade time
  }

  async _init() {
    const root = Character.instance?.object3D;
    if (!root) throw new Error('CharacterAnimator requires Character.instance');

    // The skinned mesh root is the first child we added to Character.object3D
    this.modelRoot = root.children[0];
    if (!this.modelRoot) throw new Error('Character model not found for animator.');

    this.mixer = new THREE.AnimationMixer(this.modelRoot);

    // Load walking animation GLB (no root motion expected)
    const url = new URL('../../assets/models/character/anim-walking.glb', import.meta.url).href;
    const gltf = await new GLTFLoader().loadAsync(url);
    this.walkClip = gltf.animations?.[0] || null;

    if (this.walkClip) {
      this.walkAction = this.mixer.clipAction(this.walkClip);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
      this.walkAction.clampWhenFinished = false;
      this.walkAction.enabled = true;
      this.walkAction.setEffectiveWeight(0);   // start silent
      this.walkAction.setEffectiveTimeScale(1);
      // do NOT play yet; we'll fade in when movement begins
    }
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
  }

  /** Call once per frame with the current movement state. */
  setMoving(moving) {
    if (moving === this._isMoving) return; // no change

    // Transition
    if (moving) {
      if (this.walkAction) {
        // fade in if not already playing
        if (!this.walkAction.isRunning()) this.walkAction.play();
        this.walkAction.fadeIn(this._fade);
        this.walkAction.setEffectiveWeight(1);
        this.walkAction.paused = false;
      }
    } else {
      if (this.walkAction) {
        // fade out but keep mixer updating so it can finish the blend
        this.walkAction.fadeOut(this._fade);
        // optional: after fade, stop to save CPU
        setTimeout(() => {
          if (!this._isMoving && this.walkAction) {
            this.walkAction.stop();
            this.walkAction.reset();
            this.walkAction.setEffectiveWeight(0);
          }
        }, Math.ceil(this._fade * 1000) + 30);
      }
    }

    this._isMoving = moving;
  }
}