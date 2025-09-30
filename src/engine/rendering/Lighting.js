// file: src/engine/rendering/Lighting.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import SkySystem from './Sky.js';

export default class Lighting {
  static hemi = null;
  static sun  = null;

  static create() {
    const scene = Scene.main;
    if (!scene) return;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.05);
    const sun  = new THREE.DirectionalLight(0xffffff, 1.9); // midday punch
    sun.castShadow = false;

    scene.add(hemi);
    scene.add(sun);

    Lighting.hemi = hemi;
    Lighting.sun  = sun;

    Lighting.syncToSky(); // position from sky
    window.addEventListener('sky:updated', Lighting.syncToSky);
  }

  static syncToSky = () => {
    const sky = SkySystem.main;
    if (!sky || !Lighting.sun || !Lighting.hemi) return;

    // Position still follows the sky (so the dome looks the same as before)
    const dir = sky.getSunDirection();
    Lighting.sun.position.copy(dir.clone().multiplyScalar(1000));
    Lighting.sun.target.position.set(0, 0, 0);
    Lighting.sun.target.updateMatrixWorld?.();

    // ⬇️ Force a neutral midday lighting palette (ignoring the low sky elevation)
    const sunColor    = new THREE.Color(0xffffff);   // crisp white sunlight
    const hemiSky     = new THREE.Color(0xDDEBFF);   // subtle cool ambient from sky
    const hemiGround  = new THREE.Color(0xA9A39A);   // neutral ground bounce

    Lighting.sun.color.copy(sunColor);
    Lighting.sun.intensity = 1.9;

    Lighting.hemi.color.copy(hemiSky);
    Lighting.hemi.groundColor.copy(hemiGround);
    Lighting.hemi.intensity = 1.05;
  };
}