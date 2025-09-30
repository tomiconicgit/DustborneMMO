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
    // A* pathfinder (30x30 grid, world-aligned)
    this.pf = new Pathfinding();

    // Path state
    this.path = [];
    this.pathIndex = 0;

    // Optional arrival callback (used by mining)
    this._onArrive = null;

    // Movement tuning
    this.speed = 2.6;          // units / sec
    this.arriveEps = 0.04;     // how close is "reached"
    this.turnLerp = 12.0;      // yaw smoothing
    this.minMoveEps = 1e-4;    // tiny epsilon to detect real movement

    // World bounds (match terrain plane)
    this.halfX = (WORLD_WIDTH * TILE_SIZE) * 0.5;
    this.halfZ = (WORLD_DEPTH * TILE_SIZE) * 0.5;

    // Stuck detection (prevents rare freezes on tiny waypoint jitter)
    this._stuckClock = 0;
    this._movedAcc = 0;
    this._lastPos = new THREE.Vector3();

    // Seed the internal lastPos with the character's current (spawn) position
    const chAtStart = Character.instance?.object3D;
    if (chAtStart) this._lastPos.copy(chAtStart.position);

    // Listen for ground taps fired by CameraTouchControls → GroundPicker
    window.addEventListener('ground:tap', this.onGroundTap);

    // Per-frame update
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  // -----------------------
  // External helper: walk to a world position (center of tile, etc.) then callback
  // -----------------------
  walkTo(pos, onArrive) {
    const ch = Character.instance?.object3D;
    if (!ch || !pos) return;

    const newPath = this.pf.findPath(ch.position, pos);
    if (newPath && newPath.length) {
      this._setPath(newPath, ch.position);
      this._onArrive = typeof onArrive === 'function' ? onArrive : null;
      CharacterAnimator.main?.playWalk?.();
    }
  }

  // -----------------------
  // Input → plan a new path from tap
  // -----------------------
  onGroundTap = (ev) => {
    const hit = ev?.detail?.point;
    const ch = Character.instance?.object3D;
    if (!hit || !ch) return;

    const newPath = this.pf.findPath(ch.position, hit);
    if (newPath && newPath.length > 0) {
      this._setPath(newPath, ch.position);
      this._onArrive = null; // no special callback for generic move
      CharacterAnimator.main?.playWalk?.();
    }
  };

  _setPath(points, curPos) {
    // If the first point is essentially where we stand, skip it
    let startIdx = 0;
    if (points.length > 0 && points[0].distanceToSquared(curPos) < (this.arriveEps * this.arriveEps)) {
      startIdx = 1;
    }
    this.path = startIdx > 0 ? points.slice(startIdx) : points;
    this.pathIndex = 0;

    // Reset stuck detector & sync to current character position
    this._stuckClock = 0;
    this._movedAcc = 0;
    this._lastPos.copy(curPos);
  }

  // -----------------------
  // Per-frame update
  // -----------------------
  update(dt) {
    const ch        = Character.instance?.object3D;
    const animator  = CharacterAnimator.main;
    const modelRoot = animator?.modelRoot;
    if (!ch || !animator || !modelRoot) return;

    // Active path? Move toward current waypoint.
    if (this.path && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];

      // Vector to current waypoint (XZ only)
      const to = new THREE.Vector3().subVectors(target, ch.position); 
      to.y = 0;
      const dist = to.length();

      if (dist <= this.arriveEps) {
        // Waypoint reached → advance
        this.pathIndex++;
        if (this.pathIndex >= this.path.length) {
          // Final destination reached → idle and fire callback
          this._finish(animator);
          if (this._onArrive) { const cb = this._onArrive; this._onArrive = null; try { cb(); } catch {} }
          return;
        }
      } else if (dist > 0) {
        // Rotate toward target smoothly
        const targetYaw = Math.atan2(to.x, to.z);
        const currentYaw = modelRoot.rotation.y || 0;
        const nextYaw = this._lerpAngle(currentYaw, targetYaw, Math.min(1, this.turnLerp * dt));
        modelRoot.rotation.set(0, nextYaw, 0);

        // Step toward waypoint
        to.normalize();
        const step = Math.min(dist, this.speed * dt);
        ch.position.addScaledVector(to, step);

        // Clamp inside world (prevents leaving the 30x30 board)
        ch.position.x = THREE.MathUtils.clamp(ch.position.x, 0, WORLD_WIDTH * TILE_SIZE);
        ch.position.z = THREE.MathUtils.clamp(ch.position.z, 0, WORLD_DEPTH * TILE_SIZE);

        // Ensure we are walking while moving
        animator.playWalk();

        // Stuck detection
        const movedThisFrame = ch.position.distanceTo(this._lastPos);
        this._movedAcc += movedThisFrame;
        this._lastPos.copy(ch.position);
        this._stuckClock += dt;

        if (this._stuckClock > 1.2) {
          if (this._movedAcc < 0.02) {
            // Skip stuck waypoint
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
              this._finish(animator);
              if (this._onArrive) { const cb = this._onArrive; this._onArrive = null; try { cb(); } catch {} }
              return;
            }
          }
          this._stuckClock = 0;
          this._movedAcc = 0;
        }
      }
    } else {
      // No path → keep current (mining) or idle
      if (animator.active !== 'mining') {
        animator.playIdle();
      }
    }

    // Update camera (free orbit—no auto follow)
    Camera.main?.update?.();

    // Advance animation mixer
    animator.update(dt);
  }

  _finish(animator) {
    this.path = [];
    this.pathIndex = 0;
    this._stuckClock = 0;
    this._movedAcc = 0;
    // Only switch to idle if not mining; mining start will take over when needed
    if (animator.active !== 'mining') animator.playIdle();
  }

  _lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }
}