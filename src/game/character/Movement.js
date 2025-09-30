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
    this.speed        = 2.5;  // world units per second
    this.turnLerp     = 10.0; // higher = snappier character facing
    this.characterYaw = 0;

    // World bounds (same as terrain)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Update animations
    animator.update(dt);

    // Joystick vector: x = right+, y = up+ (already normalized to -1..1)
    const v = this.joy?.getVector() || { x: 0, y: 0 };
    const mag = Math.hypot(v.x, v.y);
    const moving = mag > 0.08; // deadzone

    if (moving) {
      // --- Camera-relative movement (stick UP = move away from camera) ---
      const cam = Camera.main?.threeCamera || Camera.main;

      // Camera forward in world (points toward what the camera looks at)
      const camForward = new THREE.Vector3();
      cam?.getWorldDirection?.(camForward);
      camForward.y = 0;
      if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1); // fallback
      camForward.normalize();

      // Camera right on XZ plane
      const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      // Compose desired direction on ground:
      //  - Use camRight for stick X
      //  - Use **-camForward** for stick Y so pushing UP moves away from the camera
      const desiredDir = new THREE.Vector3()
        .addScaledVector(camRight, v.x)
        .addScaledVector(camForward, -v.y);

      if (desiredDir.lengthSq() > 1e-6) {
        desiredDir.normalize();

        // Always rotate toward desired direction (forward and back behave the same).
        const targetYaw = Math.atan2(desiredDir.x, desiredDir.z);
        this.characterYaw = this._lerpAngle(this.characterYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, this.characterYaw, 0);

        // Move in desired direction scaled by stick magnitude
        ch.position.addScaledVector(desiredDir, this.speed * mag * dt);

        // Clamp inside terrain bounds
        ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
        ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

        // Ensure walking loops while moving
        animator.playWalk();
      }
    } else {
      // Idle
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