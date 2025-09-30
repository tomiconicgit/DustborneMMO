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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x555555, 0.8);
    const sun  = new THREE.DirectionalLight(0xffffff, 1.3);
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

    // Direction
    const dir = sky.getSunDirection();
    Lighting.sun.position.copy(dir.clone().multiplyScalar(1000)); // position along dir
    Lighting.sun.target.position.set(0, 0, 0);
    Lighting.sun.target.updateMatrixWorld?.();

    // Color & intensity based on elevation
    const elev = sky.params.elevation;
    const sunColor = sky.colorForElevation();

    // Sun brighter when higher, warmer when lower.
    const sunIntensity = THREE.MathUtils.lerp(0.75, 1.6, Math.min(1, elev / 12));
    Lighting.sun.color.copy(sunColor);
    Lighting.sun.intensity = sunIntensity;

    // Hemisphere: sky tint above, ground slightly desaturated below
    const skyTint = sunColor.clone().lerp(new THREE.Color(0xBFD7FF), 0.4); // mix with cool blue for dome
    const groundTint = new THREE.Color(0x7a6a55); // muted ground bounce that fits gravel
    Lighting.hemi.color.copy(skyTint);
    Lighting.hemi.groundColor.copy(groundTint);
    Lighting.hemi.intensity = 0.85;
  };
}