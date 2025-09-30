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
    this.epsilon    = 0.001;
    this.characterYaw = 0;

    // World bounds (same as terrain)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    // Per-frame update
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Animate (walk loop, etc.)
    animator.update(dt);

    // Joystick vector (screen x→world +x, screen y→world -z)
    const v = this.joy?.getVector() || { x:0, y:0 };
    const mag = Math.hypot(v.x, v.y);

    let isMoving = false;

    if (mag > 0.08) {
      // Normalized world direction
      const dir = new THREE.Vector3(v.x, 0, -v.y).normalize();

      // Move
      ch.position.addScaledVector(dir, this.speed * dt);

      // Clamp inside terrain bounds
      ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
      ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

      // Smoothly face movement direction
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
      modelRoot.rotation.set(0, this.characterYaw, 0);

      // Ensure walking loops while moving
      animator.playWalk();
      isMoving = true;
    } else {
      // Idle (stop looping)
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