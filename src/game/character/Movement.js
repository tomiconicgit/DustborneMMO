// file: src/game/character/Movement.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from './Character.js';
import CharacterAnimator from './CharacterAnimator.js';
import Camera from '../../engine/rendering/Camera.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class Movement {
  static main = null;
  static create() { if (!Movement.main) Movement.main = new Movement(); }

  constructor() {
    this.pf = new Pathfinding();
    this.path = [];
    this.pathIndex = 0;

    this.speed = 2.5;        // units/sec
    this.arriveEps = 0.03;
    this.turnLerp = 12.0;

    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    window.addEventListener('ground:tap', this.onGroundTap);

    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  onGroundTap = (ev) => {
    const hit = ev?.detail?.point;
    const ch = Character.instance?.object3D;
    if (!hit || !ch) return;

    const path = this.pf.findPath(ch.position, hit);
    if (path && path.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      // animator will start looping on the next update() by setMoving(true)
    }
  };

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    let isMoving = false;

    // Follow the path if any
    if (this.path && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const to = new THREE.Vector3().subVectors(target, ch.position);
      to.y = 0;

      const dist = to.length();

      if (dist < this.arriveEps) {
        this.pathIndex++;
        if (this.pathIndex >= this.path.length) {
          // reached final
          this.path = [];
          this.pathIndex = 0;
        }
      } else if (dist > 0) {
        to.normalize();
        const targetYaw = Math.atan2(to.x, to.z);
        const currentYaw = modelRoot.rotation.y || 0;
        const nextYaw = this._lerpAngle(currentYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, nextYaw, 0);

        const step = Math.min(dist, this.speed * dt);
        ch.position.addScaledVector(to, step);

        // clamp inside world
        ch.position.x = THREE.MathUtils.clamp(ch.position.x, -this.halfX, this.halfX);
        ch.position.z = THREE.MathUtils.clamp(ch.position.z, -this.halfZ, this.halfZ);

        isMoving = true;
      }
    }

    // Tell animator once per frame (handles fade in/out internally)
    animator.setMoving(isMoving);
    animator.update(dt);

    // Free orbit camera (no auto-follow), just update transform
    Camera.main?.update?.();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}