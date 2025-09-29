// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import UpdateBus from '../core/UpdateBus.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Camera {
  static main = null;

  static create() {
    if (Camera.main) return;
    Camera.main = new Camera();
  }

  constructor() {
    // World bounds for 30x30 tiles
    this.worldHalfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.worldHalfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    // Perspective camera
    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 2
    );

    // Orbit-style props
    this.target        = null;            // { position: Vector3 }
    this.orbitAngle    = Math.PI / 4;
    this.orbitDistance = 6;               // mid-zoom

    // Zoom limits (requested)
    this.minDistance = 3;                 // zoomed in
    this.maxDistance = 9;                 // zoomed out

    // Auto-height bounds (requested)
    this.minHeight = 3;                   // at minDistance
    this.maxHeight = 6;                   // at maxDistance

    // Per-frame follow
    this._unsub = UpdateBus.on(() => this.update());

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();
  }

  setTarget(target) {
    this.target = target;
    // immediate snap this frame; ongoing follow happens via UpdateBus tick
    this.update();
  }

  // Map orbitDistance -> camera height (linear)
  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance); // 0..1
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  update() {
    if (!this.target) return;

    // Clamp target within world bounds
    const tp = this.target.position.clone();
    tp.x = THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX);
    tp.z = THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ);

    // Clamp zoom and derive height
    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const cameraHeight = this._heightFromDistance();

    // Compute orbit offset
    const ideal = new THREE.Vector3(
      tp.x + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + cameraHeight,
      tp.z + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    // Keep camera inside terrain too
    ideal.x = THREE.MathUtils.clamp(ideal.x, -this.worldHalfX, this.worldHalfX);
    ideal.z = THREE.MathUtils.clamp(ideal.z, -this.worldHalfZ, this.worldHalfZ);

    this.threeCamera.position.copy(ideal);
    this.threeCamera.lookAt(tp.x, tp.y + 1, tp.z);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight;
    this.threeCamera.updateProjectionMatrix();
  };
}

// Simple touch + wheel control remains in Movement/GroundPicker land.
// If you still want manual orbit + pinch/scroll, keep your existing controller
// and just mutate `Camera.main.orbitAngle` / `.orbitDistance` — the per-frame
// UpdateBus tick above will handle the rest.