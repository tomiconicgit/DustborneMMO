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

    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 2
    );

    // Free orbit camera (no auto-follow)
    this.target        = { position: new THREE.Vector3(0, 0, 0) };
    this.orbitAngle    = Math.PI / 3;
    this.orbitDistance = 6;

    this.minDistance = 3;
    this.maxDistance = 9;
    this.minHeight   = 3;
    this.maxHeight   = 6;

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();

    this.update();
  }

  // kept for compatibility with CameraTouchControls; does nothing now
  notifyUserRotated() {}

  setTarget(target) { this.target = target; this.update(); }

  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance);
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  update() {
    const tp = this.target?.position || new THREE.Vector3();
    const clamped = new THREE.Vector3(
      THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX),
      tp.y,
      THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ)
    );

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const cameraHeight = this._heightFromDistance();

    const ideal = new THREE.Vector3(
      clamped.x + this.orbitDistance * Math.sin(this.orbitAngle),
      clamped.y + cameraHeight,
      clamped.z + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    ideal.x = THREE.MathUtils.clamp(ideal.x, -this.worldHalfX, this.worldHalfX);
    ideal.z = THREE.MathUtils.clamp(ideal.z, -this.worldHalfZ, this.worldHalfZ);

    this.threeCamera.position.copy(ideal);
    this.threeCamera.lookAt(clamped.x, clamped.y + 1, clamped.z);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight;
    this.threeCamera.updateProjectionMatrix();
  };
}