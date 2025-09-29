// file: src/game/character/Movement.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from './Character.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import CharacterAnimator from './CharacterAnimator.js';
import { TILE_SIZE } from '../world/WorldMap.js';

export default class Movement {
  static main = null;

  static create() {
    if (Movement.main) return;
    Movement.main = new Movement();
  }

  constructor() {
    this.pathfinder = new Pathfinding(/* if your impl needs world, pass it here */);
    this.currentPath = null;  // array<Vector3>
    this.currentIndex = 0;
    this.speed = 2.5;         // world units / second
    this.epsilon = 0.02;

    this._unsub = UpdateBus.on((dt) => this.update(dt));

    // Tap-to-move
    window.addEventListener('ground:tap', (ev) => {
      const point = ev.detail?.point;
      if (!point) return;
      this.moveTo(point);
    });
  }

  moveTo(worldPoint) {
    const ch = Character.instance?.object3D;
    if (!ch) return;

    // Build a path from current pos to target pos (on y=0 plane)
    const start = ch.position.clone();
    const end = new THREE.Vector3(worldPoint.x, 0, worldPoint.z);
    const path = this.pathfinder.findPath(start, end);

    if (!path || path.length < 2) {
      // No path; stop animation if any
      CharacterAnimator.main?.stopAll();
      this.currentPath = null;
      return;
    }

    // Slightly reduce jitter: snap nodes to tile centers with +0.5 offset if you want
    // (assumes TILE_SIZE = 1 and centers mode)
    for (let i = 0; i < path.length; i++) {
      path[i].y = 0;
    }

    this.currentPath = path;
    this.currentIndex = 0;

    // Start walking animation
    CharacterAnimator.main?.playWalk();
  }

  update(dt) {
    const ch = Character.instance?.object3D;
    if (!ch) return;

    // Drive animation mixer as well
    const mixer = Character.instance?.mixer;
    if (mixer) mixer.update(dt);

    if (!this.currentPath || this.currentIndex >= this.currentPath.length) return;

    const target = this.currentPath[this.currentIndex];
    const dir = new THREE.Vector3().subVectors(target, ch.position);
    const dist = dir.length();

    if (dist <= this.epsilon) {
      // Arrived at this node
      this.currentIndex++;
      if (this.currentIndex >= this.currentPath.length) {
        // Reached final destination
        this.currentPath = null;
        this.currentIndex = 0;
        CharacterAnimator.main?.stopAll();
      }
      return;
    }

    dir.normalize();
    ch.position.addScaledVector(dir, this.speed * dt);

    // Face direction of movement (optional)
    if (dist > 1e-4) {
      const face = new THREE.Vector3().copy(dir);
      const yaw = Math.atan2(face.x, face.z);
      // Rotate model root (not the whole group offset)
      if (Character.instance.root) {
        Character.instance.root.rotation.set(0, yaw, 0);
      }
    }
  }
}