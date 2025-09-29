// file: src/engine/rendering/Camera.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Camera {
  static main = null;

  static create() {
    if (Camera.main) return;
    Camera.main = new Camera(); // exposes .threeCamera, .setTarget(), .update()
  }

  constructor() {
    // --- World / view constraints for 30x30 terrain ---
    this.worldHalfX = (WORLD_WIDTH * TILE_SIZE) / 2;   // e.g., 15
    this.worldHalfZ = (WORLD_DEPTH * TILE_SIZE) / 2;   // e.g., 15

    // --- Core camera ---
    this.threeCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / (window.innerHeight * 0.6),
      0.1,
      Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE * 2 // render distance ~ covers whole 30x30
    );

    // --- Old-PWA feel: fixed orbit around a target ---
    this.target        = null;            // THREE.Object3D or { position: Vector3 }
    this.orbitAngle    = Math.PI / 4;     // 45°
    this.orbitDistance = 6;               // zoom
    this.cameraHeight  = 3;               // vertical offset

    // Limits (keep user within the 30x30 world visuals)
    this.minDistance = 4;
    this.maxDistance = 12;

    // Touch controller on window (so we don’t depend on Viewport ordering)
    new CameraController(window, this);

    // Keep aspect reasonable on mobile
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.handleResize();

    // Start pointed at origin by default
    this.setTarget({ position: new THREE.Vector3(0, 0, 0) });
  }

  setTarget(target) {
    this.target = target;
    this.update();
  }

  update() {
    // If no target yet, nothing to do.
    if (!this.target) return;

    // Clamp the look target inside world bounds (-half..+half)
    const tp = this.target.position.clone();
    tp.x = THREE.MathUtils.clamp(tp.x, -this.worldHalfX, this.worldHalfX);
    tp.z = THREE.MathUtils.clamp(tp.z, -this.worldHalfZ, this.worldHalfZ);

    // Enforce zoom limits and compute orbit offset
    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance, this.minDistance, this.maxDistance);
    const ideal = new THREE.Vector3(
      tp.x + this.orbitDistance * Math.sin(this.orbitAngle),
      tp.y + this.cameraHeight,
      tp.z + this.orbitDistance * Math.cos(this.orbitAngle)
    );

    // Also clamp camera position so we never look beyond terrain edges
    ideal.x = THREE.MathUtils.clamp(ideal.x, -this.worldHalfX, this.worldHalfX);
    ideal.z = THREE.MathUtils.clamp(ideal.z, -this.worldHalfZ, this.worldHalfZ);

    this.threeCamera.position.copy(ideal);
    this.threeCamera.lookAt(tp.x, tp.y + 1, tp.z);
  }

  handleResize = () => {
    this.threeCamera.aspect = window.innerWidth / (window.innerHeight * 0.6);
    this.threeCamera.updateProjectionMatrix();
  };
}

/**
 * Minimal touch drag controller (old PWA style):
 * - One-finger horizontal drag: rotate orbit angle
 * - Two-finger pinch: zoom in/out (adjust orbitDistance)
 */
class CameraController {
  constructor(dom, camera) {
    this.camera = camera;
    this.touchState = { dragging: false, lastX: 0, lastPinch: null };

    dom.addEventListener('touchstart', this.onStart, { passive: false });
    dom.addEventListener('touchmove',  this.onMove,  { passive: false });
    dom.addEventListener('touchend',   this.onEnd,   { passive: false });
    dom.addEventListener('wheel',      this.onWheel, { passive: true  }); // optional desktop zoom
  }

  onStart = (e) => {
    if (e.touches.length === 1) {
      this.touchState.dragging = true;
      this.touchState.lastX = e.touches[0].clientX;
      this.touchState.lastPinch = null;
    } else if (e.touches.length === 2) {
      this.touchState.dragging = false;
      this.touchState.lastPinch = this._pinchDistance(e.touches);
    }
  };

  onMove = (e) => {
    if (e.touches.length === 1 && this.touchState.dragging) {
      e.preventDefault();
      const x = e.touches[0].clientX;
      const dx = x - this.touchState.lastX;
      this.touchState.lastX = x;

      this.camera.orbitAngle -= dx * 0.01; // rotate
      this.camera.update();
    } else if (e.touches.length === 2 && this.touchState.lastPinch !== null) {
      e.preventDefault();
      const dist = this._pinchDistance(e.touches);
      const delta = dist - this.touchState.lastPinch;
      this.touchState.lastPinch = dist;

      // pinch to zoom
      this.camera.orbitDistance -= delta * 0.01;
      this.camera.update();
    }
  };

  onEnd = () => {
    this.touchState.dragging = false;
    this.touchState.lastPinch = null;
  };

  onWheel = (e) => {
    this.camera.orbitDistance += e.deltaY * 0.001; // scroll to zoom
    this.camera.update();
  };

  _pinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
    }
}