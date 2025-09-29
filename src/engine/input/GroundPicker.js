// file: src/engine/input/GroundPicker.js
import * as THREE from 'three';
import Camera from '../rendering/Camera.js';

export default class GroundPicker {
  static instance = null;

  static create() {
    if (!GroundPicker.instance) GroundPicker.instance = new GroundPicker();
  }

  constructor() {
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
  }

  /**
   * Returns world point on y=0 plane from a clientX/Y, or null if none.
   */
  pick(clientX, clientY) {
    const cam = Camera.main?.threeCamera || Camera.main;
    if (!cam) return null;

    const rect = document.body.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );

    this.ray.setFromCamera(this.ndc, cam);
    const hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.planeY0, hit) ? hit : null;
  }
}