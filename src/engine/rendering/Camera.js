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
    this.worldMinX = 0;
    this.worldMinZ = 0;
    this.worldMaxX = WORLD_WIDTH * TILE_SIZE;   // now 60
    this.worldMaxZ = WORLD_DEPTH * TILE_SIZE;   // 30

    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 50
    );

    this.target        = { position: new THREE.Vector3(0, 0, 0) };
    this.orbitAngle    = Math.PI / 3;
    this.orbitDistance = 6;

    this.minDistance = 3;
    this.maxDistance = 18;
    this.minHeight   = 3;
    this.maxHeight   = 8;

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();
    this.update();
  }

  notifyUserRotated() {}
  setTarget(target) { this.target = target; this.update(); }

  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance);
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  update() {
    const tp = this.target?.position || new THREE.Vector3();

    // Clamp ONLY the look-at (keeps camera stable and avoids “fighting”)
    const lookX = THREE.MathUtils.clamp(tp.x, this.worldMinX, this.worldMaxX);
    const lookZ = THREE.MathUtils.clamp(tp.z, this.worldMinZ, this.worldMaxZ);

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const h = this._heightFromDistance();

    const camPos = new THREE.Vector3(
      lookX + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + h,
      lookZ + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    this.threeCamera.position.copy(camPos);
    this.threeCamera.lookAt(lookX, tp.y + 1, lookZ);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight;
    this.threeCamera.updateProjectionMatrix();
  };
}