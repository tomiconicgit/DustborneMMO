// file: src/game/character/Movement.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from './Character.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import CharacterAnimator from './CharacterAnimator.js';
import VirtualJoystick from '../../engine/input/VirtualJoystick.js';
import Camera from '../../engine/rendering/Camera.js';

export default class Movement {
  static main = null;
  static create() { if (!Movement.main) Movement.main = new Movement(); }

  constructor() {
    this.pathfinder = new Pathfinding();
    this.currentPath = null;
    this.currentIndex = 0;

    VirtualJoystick.create();
    this.joy = VirtualJoystick.instance;

    this.speed = 2.5;
    this.turnLerp = 10.0;
    this.epsilon = 0.02;
    this.characterYaw = 0;

    this._unsub = UpdateBus.on((dt) => this.update(dt));

    window.addEventListener('ground:tap', (ev) => {
      const point = ev.detail?.point;
      if (!point) return;
      const v = this.joy?.getVector() || { x:0, y:0 };
      if (Math.hypot(v.x, v.y) > 0.05) return; // ignore if joystick active
      this.moveTo(point);
    });
  }

  moveTo(worldPoint) {
    const ch = Character.instance?.object3D; if (!ch) return;
    const start = ch.position.clone();
    const end = new THREE.Vector3(worldPoint.x, 0, worldPoint.z);

    const path = this.pathfinder.findPath(start, end);
    if (!path || path.length < 2) {
      CharacterAnimator.main?.stopAll();
      this.currentPath = null; return;
    }

    path.forEach(p => p.y = 0);
    this.currentPath = path;
    this.currentIndex = 0;
    CharacterAnimator.main?.playWalk(); // ensure loop at path start
  }

  update(dt) {
    const ch = Character.instance?.object3D;
    const modelRoot = Character.instance?.root;
    const mixer = Character.instance?.mixer;
    if (!ch || !modelRoot) return;

    if (mixer) mixer.update(dt);

    // 1) Joystick movement
    const j = this.joy?.getVector() || { x: 0, y: 0 };
    const jLen = Math.hypot(j.x, j.y);
    let movingByJoy = false;

    if (jLen > 0.08) {
      const dir = new THREE.Vector3(j.x, 0, -j.y).normalize();
      ch.position.addScaledVector(dir, this.speed * dt);
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
      modelRoot.rotation.set(0, this.characterYaw, 0);
      this.currentPath = null;
      movingByJoy = true;
      CharacterAnimator.main?.playWalk(); // keep loop alive while stick held
    }

    // 2) Path following
    if (!movingByJoy && this.currentPath && this.currentIndex < this.currentPath.length) {
      const target = this.currentPath[this.currentIndex];
      const dir = new THREE.Vector3().subVectors(target, ch.position);
      const dist = dir.length();
      if (dist <= this.epsilon) {
        this.currentIndex++;
        if (this.currentIndex >= this.currentPath.length) {
          this.currentPath = null; this.currentIndex = 0;
          CharacterAnimator.main?.stopAll();
        }
      } else {
        dir.normalize();
        ch.position.addScaledVector(dir, this.speed * dt);
        const targetYaw = Math.atan2(dir.x, dir.z);
        this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, this.characterYaw, 0);
        CharacterAnimator.main?.playWalk(); // ensure looping during path move
      }
    }

    // 3) If neither joystick nor path is moving, ensure idle (stop loop)
    const isMoving = movingByJoy || (!!this.currentPath && this.currentIndex < (this.currentPath?.length || 0));
    if (!isMoving) CharacterAnimator.main?.stopAll();

    // 4) Camera lazy follow + update
    Camera.main?.followUpdate?.(dt, this.characterYaw, isMoving);
    Camera.main?.update?.();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}