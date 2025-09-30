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
    this.pathfinder   = new Pathfinding();
    this.currentPath  = null;
    this.currentIndex = 0;

    VirtualJoystick.create();
    this.joy = VirtualJoystick.instance;

    this.speed      = 2.5;   // walk speed (wu/s)
    this.turnLerp   = 10.0;  // higher = snappier turning
    this.epsilon    = 0.02;  // path waypoint snap
    this.characterYaw = 0;   // facing (radians)

    // Per-frame update
    this._unsub = UpdateBus.on((dt) => this.update(dt));

    // Tap-to-move (ignored while joystick is being used)
    window.addEventListener('ground:tap', (ev) => {
      const point = ev.detail?.point;
      if (!point) return;
      const v = this.joy?.getVector() || { x:0, y:0 };
      if (Math.hypot(v.x, v.y) > 0.05) return; // joystick active -> ignore tap
      this.moveTo(point);
    });
  }

  moveTo(worldPoint) {
    const ch = Character.instance?.object3D; 
    if (!ch) return;

    const start = ch.position.clone();
    const end   = new THREE.Vector3(worldPoint.x, 0, worldPoint.z);

    const path = this.pathfinder.findPath(start, end);
    if (!path || path.length < 2) {
      CharacterAnimator.main?.stopAll();
      this.currentPath = null;
      return;
    }

    path.forEach(p => p.y = 0);
    this.currentPath  = path;
    this.currentIndex = 0;
    CharacterAnimator.main?.playWalk();  // ensure walk starts looping
  }

  update(dt) {
    const ch = Character.instance?.object3D;
    const animator = CharacterAnimator.main;
    const mixer    = animator?.mixer;
    const modelRoot= animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Drive animation mixer
    animator.update(dt);

    // 1) Joystick movement
    const j = this.joy?.getVector() || { x: 0, y: 0 };
    const jLen = Math.hypot(j.x, j.y);
    let movingByJoy = false;

    if (jLen > 0.08) {
      // screen (x,right ; y,up) -> world (x,right ; z,forward)
      const dir = new THREE.Vector3(j.x, 0, -j.y).normalize();
      ch.position.addScaledVector(dir, this.speed * dt);

      const targetYaw = Math.atan2(dir.x, dir.z);
      this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
      modelRoot.rotation.set(0, this.characterYaw, 0);

      // Cancel any path when using stick
      this.currentPath  = null;
      this.currentIndex = 0;

      movingByJoy = true;
      animator.playWalk(); // keep loop alive while stick held
    }

    // 2) Path following (if not using joystick)
    if (!movingByJoy && this.currentPath && this.currentIndex < this.currentPath.length) {
      const target = this.currentPath[this.currentIndex];
      const dir = new THREE.Vector3().subVectors(target, ch.position);
      const dist = dir.length();

      if (dist <= this.epsilon) {
        this.currentIndex++;
        if (this.currentIndex >= this.currentPath.length) {
          this.currentPath = null;
          this.currentIndex = 0;
          animator.stopAll(); // reached destination
        }
      } else {
        dir.normalize();
        ch.position.addScaledVector(dir, this.speed * dt);
        const targetYaw = Math.atan2(dir.x, dir.z);
        this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, this.characterYaw, 0);
        animator.playWalk(); // ensure loop during path move
      }
    }

    // 3) Idle check (no joystick & no path)
    const isMoving = movingByJoy || (!!this.currentPath && this.currentIndex < (this.currentPath?.length || 0));
    if (!isMoving) animator.stopAll();

    // 4) Camera lazy follow + update
    Camera.main?.followUpdate?.(dt, this.characterYaw, isMoving);
    Camera.main?.update?.();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}