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

    const maxDim = Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE;

    this.threeCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      maxDim * 20 // << increase far so sky/fog render (was *2)
    );

    this.target        = null;
    this.orbitAngle    = Math.PI / 4;
    this.orbitDistance = 6;

    this.minDistance = 3;
    this.maxDistance = 9;

    this.minHeight = 3;
    this.maxHeight = 6;

    new CameraController(window, this);

    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();

    this.setTarget({ position: new THREE.Vector3(0, 0, 0) });
  }

  setTarget(target) { this.target = target; this.update(); }

  _heightFromDistance() {
    const d = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const t = (d - this.minDistance) / (this.maxDistance - this.minDistance);
    return THREE.MathUtils.lerp(this.minHeight, this.maxHeight, t);
  }

  update() {
    if (!this.target) return;
    const tp = this.target.position.clone();
    tp.x = THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX);
    tp.z = THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ);

    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const cameraHeight = this._heightFromDistance();

    const ideal = new THREE.Vector3(
      tp.x + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + cameraHeight,
      tp.z + this.orbitDistance * Math.cos(this.orbitAngle)
    );
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

class CameraController {
  constructor(dom, camera) {
    this.camera = camera;
    this.touchState = { dragging: false, lastX: 0, lastPinch: null };
    dom.addEventListener('touchstart', this.onStart, { passive: false });
    dom.addEventListener('touchmove',  this.onMove,  { passive: false });
    dom.addEventListener('touchend',   this.onEnd,   { passive: false });
    dom.addEventListener('wheel',      this.onWheel, { passive: true  });
  }
  onStart = (e) => {
    if (e.touches.length === 1) { this.touchState.dragging = true; this.touchState.lastX = e.touches[0].clientX; this.touchState.lastPinch = null; }
    else if (e.touches.length === 2) { this.touchState.dragging = false; this.touchState.lastPinch = this._pinchDistance(e.touches); }
  };
  onMove = (e) => {
    if (e.touches.length === 1 && this.touchState.dragging) {
      e.preventDefault(); const x = e.touches[0].clientX; const dx = x - this.touchState.lastX; this.touchState.lastX = x;
      this.camera.orbitAngle -= dx * 0.01; this.camera.update();
    } else if (e.touches.length === 2 && this.touchState.lastPinch !== null) {
      e.preventDefault(); const dist = this._pinchDistance(e.touches); const delta = dist - this.touchState.lastPinch; this.touchState.lastPinch = dist;
      this.camera.orbitDistance -= delta * 0.01; this.camera.update();
    }
  };
  onEnd = () => { this.touchState.dragging = false; this.touchState.lastPinch = null; };
  onWheel = (e) => { this.camera.orbitDistance += e.deltaY * 0.001; this.camera.update(); };
  _pinchDistance(t) { const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.hypot(dx, dy); }
}