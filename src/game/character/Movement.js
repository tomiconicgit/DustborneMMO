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

    // --- Joystick vector (screen space): x = right+, y = up+ ---
    const v = this.joy?.getVector() || { x: 0, y: 0 };
    const mag = Math.hypot(v.x, v.y);
    const moving = mag > 0.08; // deadzone

    // Build character basis vectors from current yaw
    const fwd = new THREE.Vector3(Math.sin(this.characterYaw), 0, Math.cos(this.characterYaw)); // facing direction
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x); // 90° right of fwd

    if (moving) {
      // --- Camera-relative desired direction ---
      // Stick up should be "forward" relative to the camera.
      // Start with stick -> world (x, -y) then rotate by camera yaw around Y.
      const cam = Camera.main?.threeCamera || Camera.main;
      const camPos = cam?.position || new THREE.Vector3(0, 0, 1);
      const toCam = new THREE.Vector3().subVectors(camPos, ch.position).setY(0).normalize();
      const camYaw = Math.atan2(toCam.x, toCam.z) + Math.PI; // camera looking direction yaw

      // Raw from stick: (x, y) => world XY as (x, 0, -y) then rotate by camYaw
      const raw = new THREE.Vector3(v.x, 0, -v.y);
      const rotY = new THREE.Matrix4().makeRotationY(camYaw);
      const desiredDir = raw.applyMatrix4(rotY).normalize();

      // Decompose desiredDir in the character's local basis
      const f = desiredDir.dot(fwd);   // forward component (positive = forward, negative = backward)
      const s = desiredDir.dot(right); // side component (positive = right, negative = left)

      let moveVec = new THREE.Vector3();

      if (f >= 0) {
        // FORWARD hemisphere: rotate toward desired and move in that direction
        const targetYaw = Math.atan2(desiredDir.x, desiredDir.z);
        this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, this.characterYaw, 0);

        moveVec.copy(desiredDir).multiplyScalar(this.speed * mag);
      } else {
        // BACKWARD hemisphere:
        // Do NOT rotate character. Move backwards along current facing plus lateral slide.
        // move = (-|f|)*fwd + (s)*right
        moveVec
          .copy(fwd).multiplyScalar(this.speed * mag * f) // f is negative -> backward
          .addScaledVector(right, this.speed * mag * s);
      }

      // Apply movement
      ch.position.addScaledVector(moveVec.normalize(), this.speed * mag * dt);

      // Clamp inside terrain bounds
      ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
      ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

      // Ensure walking loops while moving
      animator.playWalk();
    } else {
      // Idle (stop looping)
      animator.stopAll();
    }

    // Camera lazy follow + update
    Camera.main?.followUpdate?.(dt, this.characterYaw, moving);
    Camera.main?.update?.();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}