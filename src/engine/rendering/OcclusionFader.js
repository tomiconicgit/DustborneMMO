// file: src/engine/rendering/OcclusionFader.js
// Makes any meshes between the camera and the player fade semi-transparent.
// Restores them when they no longer block the view.

import * as THREE from 'three';
import UpdateBus from '../core/UpdateBus.js';
import Scene from '../core/Scene.js';
import Camera from './Camera.js';
import Character from '../../game/character/Character.js';

export default class OcclusionFader {
  static create() { if (!OcclusionFader.main) OcclusionFader.main = new OcclusionFader(); }
  static main = null;

  constructor() {
    this.ray = new THREE.Raycaster();
    this.nowFaded = new Set();   // meshes faded this frame
    this.wasFaded = new Set();   // meshes faded last frame (to restore)
    this.maxHits  = 6;           // limit for performance
    this.targetOpacity = 0.25;

    this.unsub = UpdateBus.on((dt) => this.update(dt));
  }

  _fadeMesh(mesh) {
    if (!mesh || !mesh.material) return;
    if (mesh.userData._faded) return;

    const apply = (m) => {
      if (!m) return;
      if (!m.userData) m.userData = {};
      m.userData._origTransparent = m.transparent;
      m.userData._origOpacity     = m.opacity;
      m.userData._origDepthWrite  = m.depthWrite;
      m.transparent = true;
      m.opacity = this.targetOpacity;
      m.depthWrite = false;
    };

    if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
    else apply(mesh.material);

    mesh.userData._faded = true;
  }

  _restoreMesh(mesh) {
    if (!mesh || !mesh.material) return;
    if (!mesh.userData._faded) return;

    const restore = (m) => {
      if (!m) return;
      const ut = m.userData || {};
      m.transparent = ut._origTransparent ?? m.transparent;
      m.opacity     = ut._origOpacity     ?? 1.0;
      m.depthWrite  = ut._origDepthWrite  ?? true;
    };

    if (Array.isArray(mesh.material)) mesh.material.forEach(restore);
    else restore(mesh.material);

    mesh.userData._faded = false;
  }

  update() {
    const scene  = Scene.main;
    const cam    = Camera.main?.threeCamera || Camera.main;
    const player = Character.instance?.object3D;

    if (!scene || !cam || !player) return;

    // We raycast against the static environment + ores (NOT the player)
    const terrainRoot = scene.getObjectByName('TerrainRoot'); // mining area model + floor
    const statics     = scene.getObjectByName('StaticObjects');

    const candidates = [];
    if (terrainRoot) candidates.push(terrainRoot);
    if (statics)     candidates.push(statics);
    if (candidates.length === 0) return;

    // Build a ray from camera to player torso area
    const from = cam.getWorldPosition(new THREE.Vector3());
    const to   = player.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0));
    const dir  = new THREE.Vector3().subVectors(to, from).normalize();

    this.ray.set(from, dir);
    this.ray.far = from.distanceTo(to) * 1.05;

    const hits = this.ray.intersectObjects(candidates, true, []);
    let taken = 0;

    // swap sets
    const tmp = this.wasFaded; this.wasFaded = this.nowFaded; this.nowFaded = tmp;
    this.nowFaded.clear();

    for (let i = 0; i < hits.length && taken < this.maxHits; i++) {
      const hit = hits[i];
      const obj = hit.object;
      if (!obj || obj.name === 'ProceduralGround') continue;
      // don't fade the player (in case the ray grazes tools)
      if (player && (obj === player || player.children.includes(obj))) continue;

      // climb to the actual mesh (already is), fade it
      const mesh = obj;
      this._fadeMesh(mesh);
      this.nowFaded.add(mesh);
      taken++;
    }

    // restore anything that was faded but isn't blocking now
    this.wasFaded.forEach(m => {
      if (!this.nowFaded.has(m)) this._restoreMesh(m);
    });
  }
}