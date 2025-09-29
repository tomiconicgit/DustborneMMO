// file: src/game/character/Movement.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import Character from './Character.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class Movement {
  static instance = null;

  static create() {
    if (!Movement.instance) Movement.instance = new Movement();
  }

  constructor() {
    this.pf = new Pathfinding();      // grid auto-reads 30x30, TILE_SIZE=1
    this.path = [];
    this.speed = 3.0;                 // units / second across tiles
    this.eps = 0.01;

    // listen for taps from GroundPicker
    window.addEventListener('ground:tap', (e) => {
      const target = e.detail?.point;
      this.onTap(target);
    });

    // tick each frame
    UpdateBus.on((dt) => this.update(dt));
  }

  onTap(target) {
    const ch = Character.instance?.object3D;
    if (!ch || !target) return;

    // Clamp target within world
    const minX = 0, minZ = 0;
    const maxX = WORLD_WIDTH * TILE_SIZE, maxZ = WORLD_DEPTH * TILE_SIZE;
    const clamped = new THREE.Vector3(
      THREE.MathUtils.clamp(target.x, minX, maxX - 1e-3),
      0,
      THREE.MathUtils.clamp(target.z, minZ, maxZ - 1e-3)
    );

    const path = this.pf.findPath(ch.position, clamped);
    if (path && path.length > 1) {
      // Drop the first node if it's essentially current tile center
      const first = path[0];
      if (first.distanceToSquared(ch.position) < 0.25) path.shift();
      this.path = path;
    }
  }

  update(dt) {
    if (!this.path.length) return;
    const ch = Character.instance?.object3D;
    if (!ch) return;

    const target = this.path[0];
    const to = new THREE.Vector3().subVectors(target, ch.position);
    const dist = to.length();
    if (dist < this.eps) {
      this.path.shift();
      return;
    }

    const step = this.speed * dt;
    if (step >= dist) {
      ch.position.copy(target);
      this.path.shift();
    } else {
      to.normalize().multiplyScalar(step);
      ch.position.add(to);
    }

    // face movement direction softly (optional)
    if (to.lengthSq() > 1e-6) {
      const look = new THREE.Vector3(ch.position.x + to.x, ch.position.y, ch.position.z + to.z);
      // if your character has its own mesh child, rotate that instead
      ch.lookAt(look);
    }
  }
}