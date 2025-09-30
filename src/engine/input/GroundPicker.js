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
    this.staticGroup = null; // cache for 'StaticObjects' group

    // Plane fallback at y=0; our world is XZ 0..30 with the plane at y=0.
    this.planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  _canvas() { return Viewport.instance?.renderer?.domElement || null; }

  _ensureGroundAndStatics() {
    const scene = Scene.main;
    if (!scene) return;

    if (!this.ground || !this.ground.parent) {
      this.ground = scene.getObjectByName('ProceduralGround') || null;
    }
    if (!this.staticGroup || !this.staticGroup.parent) {
      this.staticGroup = scene.getObjectByName('StaticObjects') || null;
    }
  }

  _findOreOnHitObject(obj) {
    // Walk up to a parent that carries userData.ore
    let p = obj;
    while (p) {
      if (p.userData?.ore) return p.userData.ore;
      p = p.parent;
    }
    return null;
  }

  /**
   * Returns:
   *  - If an ore is tapped: triggers ore.onTapped() internally and returns null (so no ground:tap is dispatched).
   *  - Otherwise: returns a THREE.Vector3 ground point (mesh hit preferred, else y=0 plane).
   */
  pick(clientX, clientY) {
    const camObj = Camera.main;
    const cam = camObj?.threeCamera || camObj;
    const canvas = this._canvas();
    if (!cam || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    this.ray.setFromCamera(this.ndc, cam);

    this._ensureGroundAndStatics();

    // 1) Prefer ore hits (so tapping an ore doesn't emit a ground tap)
    if (this.staticGroup) {
      const oreHits = this.ray.intersectObject(this.staticGroup, true);
      if (oreHits && oreHits.length) {
        for (let i = 0; i < oreHits.length; i++) {
          const ore = this._findOreOnHitObject(oreHits[i].object);
          if (ore?.onTapped) {
            ore.onTapped();
            return null; // stop here; don't move by ground tap
          }
        }
      }
    }

    // 2) Otherwise, prefer exact ground mesh hit
    if (this.ground) {
      const hits = this.ray.intersectObject(this.ground, true);
      if (hits && hits.length) return hits[0].point.clone();
    }

    // 3) Fallback: intersect plane y=0
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.planeY0, p) ? p.clone() : null;
  }
}