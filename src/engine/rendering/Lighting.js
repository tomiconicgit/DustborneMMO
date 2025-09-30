// file: src/engine/rendering/Lighting.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import SkySystem from './Sky.js';

export default class Lighting {
  static hemi = null;
  static sun  = null;

  static create() {
    const scene = Scene.main;
    if (!scene) {
      console.error("Scene not initialized before Lighting.");
      return;
    }

    // Hemisphere fill + directional sun
    const hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 0.9);
    const sun  = new THREE.DirectionalLight(0xffffff, 2.0);

    // ✅ Enable nice soft shadows
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const RANGE = 40; // covers 30x30 world
    sun.shadow.camera.left   = -RANGE;
    sun.shadow.camera.right  =  RANGE;
    sun.shadow.camera.top    =  RANGE;
    sun.shadow.camera.bottom = -RANGE;
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = 120;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;

    scene.add(hemi);
    scene.add(sun);
    scene.add(sun.target);

    Lighting.hemi = hemi;
    Lighting.sun  = sun;

    // Sync with sky
    Lighting.syncToSky();
    window.addEventListener('sky:updated', Lighting.syncToSky);
  }

  static syncToSky = () => {
    const sky = SkySystem.main;
    if (!sky || !Lighting.sun || !Lighting.hemi) return;

    const dir = sky.getSunDirection();
    Lighting.sun.position.copy(dir.clone().multiplyScalar(80));
    Lighting.sun.target.position.set(15, 0, 15); // center of 30x30
    Lighting.sun.target.updateMatrixWorld?.();

    // 🎨 Brighter midday palette
    const sunColor = new THREE.Color(0xfff6e0);   // warm white
    const skyBlue  = new THREE.Color(0x9cc7ff);   // fill blue
    const ground   = new THREE.Color(0x7a6a55);   // earthy bounce

    Lighting.sun.color.copy(sunColor);
    Lighting.sun.intensity = 2.0;

    Lighting.hemi.color.copy(skyBlue);
    Lighting.hemi.groundColor.copy(ground);
    Lighting.hemi.intensity = 1.0;
  };
}