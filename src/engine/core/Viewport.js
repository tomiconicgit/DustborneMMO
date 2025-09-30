// file: src/engine/core/Viewport.js
import * as THREE from 'three';
import Scene from './Scene.js';
import Camera from '../rendering/Camera.js';
import UpdateBus from './UpdateBus.js';
import Debugger from '../../debugger.js';

export default class Viewport {
  static instance = null;

  static create() {
    if (!Viewport.instance) Viewport.instance = new Viewport();
  }

  constructor() {
    if (Viewport.instance) throw new Error("Viewport is a singleton. Use Viewport.instance.");

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // ✅ Soft shadows enabled
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', this.onWindowResize.bind(this), false);

    this.clock = new THREE.Clock();
    this.isRunning = false;
  }

  beginRenderLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderer.setAnimationLoop(this.render.bind(this));
    Debugger.log('Render loop started.');
  }

  stopRenderLoop() {
    this.isRunning = false;
    this.renderer.setAnimationLoop(null);
  }

  render() {
    const scene  = Scene.main;
    const camera = Camera.main?.threeCamera || Camera.main;
    if (!scene || !camera) return;

    const dt = this.clock.getDelta();
    UpdateBus.tick(dt);

    this.renderer.render(scene, camera);
  }

  onWindowResize() {
    const cam = Camera.main?.threeCamera || Camera.main;
    if (cam) {
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}