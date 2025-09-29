// file: src/engine/input/GroundPicker.js
import * as THREE from 'three';
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';

export default class GroundPicker {
  static instance = null;

  static create() {
    if (!GroundPicker.instance) GroundPicker.instance = new GroundPicker();
  }

  constructor() {
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
  }

  /** Returns the current renderer canvas, or null if not ready. */
  _canvas() {
    return Viewport.instance?.renderer?.domElement || null;
  }

  /**
   * Compute world point on y=0 plane from client coordinates,
   * using the canvas element's bounding rect (NOT document/body).
   */
  pick(clientX, clientY) {
    const cam = Camera.main?.threeCamera || Camera.main;
    const canvas = this._canvas();
    if (!cam || !canvas) return null;

    const rect = canvas.getBoundingClientRect();

    // If the tap is outside the canvas rect, ignore.
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top  || clientY > rect.bottom
    ) return null;

    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top)  / rect.height) * 2 - 1)
    );

    this.ray.setFromCamera(this.ndc, cam);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.planeY0, hit) ? hit : null;
  }

  /** Convenience: pick directly from a Pointer/Mouse/Touch event. */
  pickFromEvent(ev) {
    const t = (ev.touches && ev.touches[0]) || ev.changedTouches?.[0] || ev;
    if (!t) return null;
    return this.pick(t.clientX, t.clientY);
  }
}