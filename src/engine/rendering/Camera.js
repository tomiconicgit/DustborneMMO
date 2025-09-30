// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Camera {
  static main = null;

  static create() {
    if (Camera.main) return;
    Camera.main = new Camera();
  }

  constructor() {
    this.worldHalfX = (WORLD_WIDTH * TILE_SIZE) / 2;
    this.worldHalfZ = (WORLD_DEPTH * TILE_SIZE) / 2;

    // Make near a bit smaller and far larger for comfort; not related to the jump,
    // but helps when users really zoom.
    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 50
    );

    // Free orbit camera (no auto-follow)
    this.target        = { position: new THREE.Vector3(0, 0, 0) };
    this.orbitAngle    = Math.PI / 3;
    this.orbitDistance = 6;

    this.minDistance = 3;
    this.maxDistance = 18; // give a bit more range; adjust to taste
    this.minHeight   = 3;
    this.maxHeight   = 8;

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();

    this.update();
  }

  notifyUserRotated() {} // kept for compatibility

  setTarget(target) { this.target = target; this.update(); }

  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance);
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  update() {
    const tp = this.target?.position || new THREE.Vector3();

    // Optionally clamp ONLY the look-at target so we don't stare off-map.
    const lookX = THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX);
    const lookZ = THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ);

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const h = this._heightFromDistance();

    // Compute orbit position around the (possibly clamped) look-at point.
    const camPos = new THREE.Vector3(
      lookX + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + h,
      lookZ + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    // 🔑 DO NOT CLAMP camera position — clamping here causes “fighting/jumping”
    // when the orbit path would like to be outside the terrain box.

    this.threeCamera.position.copy(camPos);
    this.threeCamera.lookAt(lookX, tp.y + 1, lookZ);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight;
    this.threeCamera.updateProjectionMatrix();
  };
}