// file: src/game/character/CharacterAnimator.js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import Character from './Character.js';

export default class CharacterAnimator {
  static main = null;

  static async create() {
    if (CharacterAnimator.main) return;
    CharacterAnimator.main = new CharacterAnimator();
    await CharacterAnimator.main._load();
  }

  constructor() {
    this.mixer = null;
    this.actions = {};
    this.clock = new THREE.Clock(); // movement system can tick mixer too; clock is backup
    this.autoUpdate = false;        // mixer update is driven by Movement/UpdateBus
  }

  async _load() {
    if (!Character.instance?.root) throw new Error('Character must be loaded before CharacterAnimator.');
    const target = Character.instance.root;

    // Create AnimationMixer targeting the character model root
    this.mixer = new THREE.AnimationMixer(target);
    Character.instance.setMixer(this.mixer);

    // Load walk animation
    const animURL = new URL('../../assets/models/character/anim-walking.glb', import.meta.url).href;
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(animURL);

    const clip = gltf.animations?.[0];
    if (!clip) {
      console.warn('anim-walking.glb contains no animations. Skipping.');
      return;
    }

    const action = this.mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    action.clampWhenFinished = false;
    action.enabled = true;
    action.weight = 1.0;
    this.actions.walk = action;
  }

  playWalk() { this._play('walk'); }
  stopAll() {
    Object.values(this.actions).forEach(a => {
      a.stop();
      a.paused = true;
    });
  }
  _play(name) {
    const a = this.actions[name];
    if (!a) return;
    // Fade in the requested action and stop others
    Object.entries(this.actions).forEach(([k, act]) => {
      if (k === name) {
        act.reset();
        act.paused = false;
        act.play();
      } else {
        act.stop();
        act.paused = true;
      }
    });
  }
}