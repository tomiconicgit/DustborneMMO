// file: src/game/character/Movement.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from './Character.js';
import CharacterAnimator from './CharacterAnimator.js';
import VirtualJoystick from '../../engine/input/VirtualJoystick.js';
import Camera from '../../engine/rendering/Camera.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class Movement {
  static main = null;
  static create() { if (!Movement.main) Movement.main = new Movement(); }

  constructor() {
    VirtualJoystick.create();
    this.joy = VirtualJoystick.instance;

    // Movement & turning
    this.speed      = 2.5;    // world units per second
    this.turnLerp   = 10.0;   // higher = snappier character facing
    this.characterYaw = 0;

    // World bounds
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    // Scratch vectors
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    // --- NEW: lock camera-relative basis for the duration of a drag ---
    this._lockedFwd = null;
    this._lockedRight = null;

    window.addEventListener('joystick:start', this._lockBasis);
    window.addEventListener('joystick:end',   this._unlockBasis);

    // Per-frame update
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  _computeCameraBasisXZ(outFwd, outRight) {
    const camObj = Camera.main?.threeCamera || Camera.main;
    if (!camObj) { outFwd.set(0,0,-1); outRight.set(1,0,0); return; }

    // Screen "forward" = camera -Z projected to XZ plane
    outFwd.set(0,0,-1).applyQuaternion(camObj.quaternion);
    outFwd.y = 0;
    if (outFwd.lengthSq() > 0) outFwd.normalize(); else outFwd.set(0,0,-1);

    // Screen "right" = perpendicular on XZ
    outRight.set(outFwd.z, 0, -outFwd.x);
  }

  _lockBasis = () => {
    if (!this._lockedFwd)  this._lockedFwd  = new THREE.Vector3();
    if (!this._lockedRight) this._lockedRight = new THREE.Vector3();
    this._computeCameraBasisXZ(this._lockedFwd, this._lockedRight);
  };

  _unlockBasis = () => {
    this._lockedFwd = null;
    this._lockedRight = null;
  };

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Animate mixer
    animator.update(dt);

    // Joystick vector (x:right, y:forward on screen)
    const v = this.joy?.getVector() || { x:0, y:0 };
    const mag = Math.hypot(v.x, v.y);

    let isMoving = false;

    if (mag > 0.08) {
      // Use locked basis if dragging; else compute fresh (so taps between gestures follow current camera)
      if (this._lockedFwd && this._lockedRight) {
        this._fwd.copy(this._lockedFwd);
        this._right.copy(this._lockedRight);
      } else {
        this._computeCameraBasisXZ(this._fwd, this._right);
      }

      // Combine joystick axes: dir = right*x + forward*y
      this._dir.copy(this._right).multiplyScalar(v.x).addScaledVector(this._fwd, v.y);
      if (this._dir.lengthSq() > 0) this._dir.normalize(); else this._dir.set(0,0,0);

      // Move character
      ch.position.addScaledVector(this._dir, this.speed * dt);

      // Clamp inside terrain bounds
      ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
      ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

      // Face movement direction smoothly
      const targetYaw = Math.atan2(this._dir.x, this._dir.z);
      this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
      modelRoot.rotation.set(0, this.characterYaw, 0);

      // Ensure walking loops while moving
      animator.playWalk();
      isMoving = true;
    } else {
      // Idle
      animator.stopAll();
    }

    // Camera lazy follow + update
    Camera.main?.followUpdate?.(dt, this.characterYaw, isMoving);
    Camera.main?.update?.();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}