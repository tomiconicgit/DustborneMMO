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

    // animation clips/actions
    this.walkClip = null;
    this.walkAction = null;
    this.idleClip = null;
    this.idleAction = null;

    // mining (optional)
    this.miningClip = null;
    this.miningAction = null;

    this.active = null; // "walk" | "idle" | "mining" | null
  }

  async _init() {
    const root = Character.instance?.object3D;
    if (!root) throw new Error('CharacterAnimator requires Character.instance');

    // The model root (skinned mesh group) is the first child under Character.object3D
    this.modelRoot = root.children[0];
    if (!this.modelRoot) throw new Error('Character model not found for animator.');

    this.mixer = new THREE.AnimationMixer(this.modelRoot);
    const loader = new GLTFLoader();

    // Load walking animation
    {
      const url = new URL('../../assets/models/character/anim-walking.glb', import.meta.url).href;
      const gltf = await loader.loadAsync(url);
      this.walkClip = gltf.animations?.[0] || null;
      if (this.walkClip) {
        this.walkAction = this.mixer.clipAction(this.walkClip);
        this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
        this.walkAction.clampWhenFinished = false;
        this.walkAction.enabled = true;
        this.walkAction.weight = 1.0;
      }
    }

    // Load idle animation
    {
      const url = new URL('../../assets/models/character/anim-idle.glb', import.meta.url).href;
      const gltf = await loader.loadAsync(url);
      this.idleClip = gltf.animations?.[0] || null;
      if (this.idleClip) {
        this.idleAction = this.mixer.clipAction(this.idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        this.idleAction.clampWhenFinished = false;
        this.idleAction.enabled = true;
        this.idleAction.weight = 1.0;
      }
    }

    // Load mining animation (OPTIONAL – won’t break if missing)
    try {
      const url = new URL('../../assets/models/character/anim-mining.glb', import.meta.url).href;
      const gltf = await loader.loadAsync(url);
      this.miningClip = gltf.animations?.[0] || null;
      if (this.miningClip) {
        this.miningAction = this.mixer.clipAction(this.miningClip);
        this.miningAction.setLoop(THREE.LoopRepeat, Infinity);
        this.miningAction.clampWhenFinished = false;
        this.miningAction.enabled = true;
        this.miningAction.weight = 1.0;
      }
    } catch (err) {
      console.warn('[Animator] Mining animation missing/failed to load (continuing):', err?.message || err);
      this.miningClip = null;
      this.miningAction = null;
    }

    // Start with idle by default
    this.playIdle();
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
  }

  playWalk() {
    if (!this.walkAction) return;
    if (this.active === 'walk') return;
    this._fadeTo(this.walkAction, 0.15);
    this.active = 'walk';
  }

  playIdle() {
    if (!this.idleAction) return;
    if (this.active === 'idle') return;
    this._fadeTo(this.idleAction, 0.2);
    this.active = 'idle';
  }

  playMining() {
    if (!this.miningAction) return; // gracefully do nothing if optional anim missing
    if (this.active === 'mining') return;
    this._fadeTo(this.miningAction, 0.15);
    this.active = 'mining';
  }

  stopAll() {
    [this.walkAction, this.idleAction, this.miningAction].forEach(a => a && a.stop());
    this.active = null;
  }

  _fadeTo(action, duration = 0.2) {
    if (!action) return;
    [this.walkAction, this.idleAction, this.miningAction].forEach((a) => {
      if (a && a.isRunning()) a.fadeOut(duration);
    });
    action.reset().fadeIn(duration).play();
  }
}