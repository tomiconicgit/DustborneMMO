// file: src/engine/input/GroundPicker.js
import * as THREE from 'three';
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';
import Scene from '../core/Scene.js';

export default class GroundPicker {
  static instance = null;

  static create() {
    if (!GroundPicker.instance) GroundPicker.instance = new GroundPicker();
  }

  constructor() {
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
    this.ground = null; // cached "ProceduralGround"
  }

  _canvas() {
    const vp = Viewport.instance;
    if (!vp || !vp.renderer) return null;
    return vp.renderer.domElement || null;
  }

  _ensureGround() {
    // cache the terrain mesh by name if present
    if (this.ground && this.ground.parent) return this.ground;
    const sc = Scene.main;
    if (!sc) return null;
    this.ground = sc.getObjectByName('ProceduralGround') || null;
    return this.ground;
  }

  pick(clientX, clientY) {
    const camObj = Camera.main;
    if (!camObj) return null;

    const cam = camObj.threeCamera ? camObj.threeCamera : camObj;
    const canvas = this._canvas();
    if (!cam || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top  || clientY > rect.bottom
    ) {
      return null;
    }

    // to NDC
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top)  / rect.height) * 2 - 1)
    );

    this.ray.setFromCamera(this.ndc, cam);

    // precise hit on ground mesh when available
    const ground = this._ensureGround();
    if (ground) {
      const hits = this.ray.intersectObject(ground, true);
      if (hits && hits.length > 0) {
        return hits[0].point.clone();
      }
    }

    // fallback: infinite y=0 plane
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.planeY0, p) ? p.clone() : null;
  }

  pickFromEvent(ev) {
    // be defensive: PointerEvent may be undefined on some browsers
    let x = 0, y = 0;

    if (typeof PointerEvent !== 'undefined' && ev instanceof PointerEvent) {
      x = ev.clientX;
      y = ev.clientY;
    } else if (ev && ev.touches && ev.touches.length > 0) {
      x = ev.touches[0].clientX;
      y = ev.touches[0].clientY;
    } else if (ev && ev.changedTouches && ev.changedTouches.length > 0) {
      x = ev.changedTouches[0].clientX;
      y = ev.changedTouches[0].clientY;
    } else if (typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
      x = ev.clientX;
      y = ev.clientY;
    } else {
      return null;
    }

    return this.pick(x, y);
  }
}