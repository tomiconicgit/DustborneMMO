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

    // Tuning
    this.speed = 2.5;          // units/sec
    this.arriveEps = 0.05;     // slightly looser -> fewer stalls
    this.skipEps = 0.02;       // skip waypoints closer than this
    this.turnLerp = 12.0;

    // Stall detection
    this._lastDist = Infinity;
    this._noProgressFrames = 0;
    this._maxNoProgress = 8;   // frames of no progress before skipping

    // Bounds (match terrain)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    window.addEventListener('ground:tap', this.onGroundTap);
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  // Remove duplicate/near-duplicate points and drop the first point if it equals current position
  _sanitizePath(raw, currentPos) {
    if (!raw || raw.length === 0) return [];
    const out = [];
    const minGap2 = this.skipEps * this.skipEps;

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      if (out.length === 0) {
        out.push(p.clone());
      } else {
        const last = out[out.length - 1];
        if (last.distanceToSquared(p) > minGap2) out.push(p.clone());
      }
    }

    // If first waypoint is basically where we are, drop it
    if (out.length && out[0].distanceToSquared(currentPos) <= minGap2) out.shift();

    return out;
  }

  onGroundTap = (ev) => {
    const hit = ev?.detail?.point;
    const ch = Character.instance?.object3D;
    if (!hit || !ch) return;

    const raw = this.pf.findPath(ch.position, hit);
    const path = this._sanitizePath(raw, ch.position);

    if (path && path.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      this._lastDist = Infinity;
      this._noProgressFrames = 0;
      // animator starts when we actually move this frame
    } else {
      // No valid path -> ensure we idle
      CharacterAnimator.main?.setMoving(false);
    }
  };

  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    let actuallyMoved = false;

    if (this.path && this.pathIndex < this.path.length) {
      let target = this.path[this.pathIndex];

      // Skip degenerate waypoint(s)
      while (target && target.distanceToSquared(ch.position) <= (this.skipEps * this.skipEps)) {
        this.pathIndex++;
        target = (this.pathIndex < this.path.length) ? this.path[this.pathIndex] : null;
        this._lastDist = Infinity;
        this._noProgressFrames = 0;
      }

      if (target) {
        const to = new THREE.Vector3().subVectors(target, ch.position); to.y = 0;
        const dist = to.length();

        // Anti-stall: check progress vs last frame
        if (dist >= this._lastDist - 1e-5) {
          this._noProgressFrames++;
          if (this._noProgressFrames >= this._maxNoProgress) {
            // Skip this waypoint; it's not getting any closer (precision/overshoot/etc.)
            this.pathIndex++;
            this._lastDist = Infinity;
            this._noProgressFrames = 0;
          }
        } else {
          this._noProgressFrames = 0;
          this._lastDist = dist;
        }

        if (dist < this.arriveEps) {
          this.pathIndex++;
          this._lastDist = Infinity;
          this._noProgressFrames = 0;
        } else if (dist > 0 && this.pathIndex < this.path.length) {
          // Rotate toward and move
          to.normalize();
          const targetYaw = Math.atan2(to.x, to.z);
          const currentYaw = modelRoot.rotation.y || 0;
          const nextYaw = this._lerpAngle(currentYaw, targetYaw, Math.min(1, this.turnLerp * dt));
          modelRoot.rotation.set(0, nextYaw, 0);

          const step = Math.min(dist, this.speed * dt);
          ch.position.addScaledVector(to, step);

          // Clamp inside world
          ch.position.x = THREE.MathUtils.clamp(ch.position.x, 0, WORLD_WIDTH * TILE_SIZE);
          ch.position.z = THREE.MathUtils.clamp(ch.position.z, 0, WORLD_DEPTH * TILE_SIZE);

          actuallyMoved = true;
        }
      }
    }

    // Drive animation only if we actually advanced position this frame
    animator.setMoving(actuallyMoved);
    animator.update(dt);

    // Free orbit camera
    Camera.main?.update?.();

    // If we reached the end, ensure we stop
    if (!actuallyMoved && (this.pathIndex >= this.path.length)) {
      this.path = [];
      this.pathIndex = 0;
      animator.setMoving(false);
    }
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}