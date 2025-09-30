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
    this.speed        = 2.5;   // world units / sec
    this.turnLerp     = 10.0;  // higher = snappier character facing
    this.characterYaw = 0;     // radians

    // World bounds
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    // Scratch vectors
    this._fwd   = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._dir   = new THREE.Vector3();

    // Per-frame update
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Drive the animation mixer regardless
    animator.update(dt);

    // Joystick vector: x (right +), y (forward +)
    const v = this.joy?.getVector() || { x:0, y:0 };
    const mag = Math.hypot(v.x, v.y);

    let isMoving = false;

    if (mag > 0.08) {
      // --- Character-relative basis (world XZ) from current yaw ---
      // forward (looking direction) on XZ
      this._fwd.set(Math.sin(this.characterYaw), 0, Math.cos(this.characterYaw));
      // right is perpendicular on XZ
      this._right.set(this._fwd.z, 0, -this._fwd.x);

      // Compose desired ground direction:
      //  dir = forward * (forward/back input) + right * (strafing)
      this._dir.set(0, 0, 0)
        .addScaledVector(this._fwd,   v.y)
        .addScaledVector(this._right, v.x);

      // Normalize so diagonals aren't faster
      if (this._dir.lengthSq() > 0) this._dir.normalize();

      // Move
      ch.position.addScaledVector(this._dir, this.speed * dt);

      // Clamp inside terrain bounds
      ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
      ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

      // --- Turning rules ---
      // Only turn when moving FORWARD (v.y > 0). This makes back/strafe not rotate.
      if (v.y > 0.05) {
        // Desired facing = direction we are walking (includes forward+left/right)
        const targetYaw = Math.atan2(this._dir.x, this._dir.z);
        this.characterYaw = this._lerpAngle(
          this.characterYaw,
          targetYaw,
          Math.min(1, this.turnLerp * dt)
        );
        modelRoot.rotation.set(0, this.characterYaw, 0);
      }
      // If moving backwards/sideways, keep current yaw (no turning).

      // Animation: loop walk whenever we have movement
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

  _ler