// file: src/engine/input/GroundPicker.js
import * as THREE from 'three';
import Camera from '../rendering/Camera.js';
import Scene from '../core/Scene.js';

export default class GroundPicker {
  static create() { new GroundPicker(); }

  constructor() {
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); // y=0

    // Pointer events
    window.addEventListener('pointerdown', this.onPointer, { passive: true });
  }

  onPointer = (e) => {
    const cam = Camera.main?.threeCamera || Camera.main;
    if (!cam) return;

    const rect = document.body.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top)  / rect.height) * 2 - 1)
    );

    this.ray.setFromCamera(this.ndc, cam);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, hit)) {
      // Optional: clamp to terrain bounds if you like
      window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point: hit } }));
    }
  };
}