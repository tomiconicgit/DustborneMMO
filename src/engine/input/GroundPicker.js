// file: src/engine/input/GroundPicker.js
import * as THREE from 'three';
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';
import Scene from '../core/Scene.js';

export default class GroundPicker {
  static instance = null;
  static create() { if (!GroundPicker.instance) GroundPicker.instance = new GroundPicker(); }

  constructor() {
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.ground = null;
    // Plane fallback at y=0; our world is XZ 0..30 with the plane at y=0.
    this.planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _canvas() { return Viewport.instance?.renderer?.domElement || null; }

  _ensureGround() {
    if (this.ground && this.ground.parent) return this.ground;
    this.ground = Scene.main?.getObjectByName('ProceduralGround') || null;
    return this.ground;
  }

  pick(clientX, clientY) {
    const camObj = Camera.main;
    const cam = camObj?.threeCamera || camObj;
    const canvas = this._canvas();
    if (!cam || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.ray.setFromCamera(this.ndc, cam);

    // Prefer exact mesh hit (covers entire 30x30 with segments)
    const ground = this._ensureGround();
    if (ground) {
      const hits = this.ray.intersectObject(ground, true);
      if (hits && hits.length) return hits[0].point.clone();
    }

    // Fallback plane
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.planeY0, p) ? p.clone() : null;
  }
}