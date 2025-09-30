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

    // Sun (directional) + hemisphere that matches sky tint
    const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.0);
    const sun  = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.castShadow = false;

    scene.add(hemi);
    scene.add(sun);

    Lighting.hemi = hemi;
    Lighting.sun  = sun;

    // Initial sync from sky (if SkySystem already set up)
    Lighting.syncToSky();

    // Keep lights in sync whenever the sky updates
    window.addEventListener('sky:updated', Lighting.syncToSky);
  }

  static syncToSky = () => {
    const sky = SkySystem.main;
    if (!sky || !Lighting.sun || !Lighting.hemi) return;

    // Direction from sky
    const dir = sky.getSunDirection();
    Lighting.sun.position.copy(dir.clone().multiplyScalar(1000)); // position along dir
    Lighting.sun.target.position.set(0, 0, 0);
    Lighting.sun.target.updateMatrixWorld?.();

    // Color & intensity based on elevation (midday = brighter, whiter)
    const elev = sky.params.elevation; // degrees
    const sunColor = sky.colorForElevation();

    // Scale sun intensity smoothly with elevation (0..90)
    const eNorm = THREE.MathUtils.clamp(elev, 0, 90) / 90;
    const sunIntensity = THREE.MathUtils.lerp(0.9, 2.0, eNorm); // brighter near midday
    Lighting.sun.color.copy(sunColor);
    Lighting.sun.intensity = sunIntensity;

    // Hemisphere sky/ground tints
    // Slightly cool sky dome, neutral ground bounce for midday clarity
    const skyTint    = new THREE.Color(0xDDEBFF).lerp(sunColor, 0.25); // mix in a bit of sun color
    const groundTint = new THREE.Color(0xA9A39A);

    Lighting.hemi.color.copy(skyTint);
    Lighting.hemi.groundColor.copy(groundTint);
    Lighting.hemi.intensity = THREE.MathUtils.lerp(0.8, 1.15, eNorm); // stronger ambient at midday
  };
}