// file: src/engine/rendering/Sky.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import Viewport from '../core/Viewport.js';
import { Sky } from 'three/addons/objects/Sky.js';

export default class SkySystem {
  static main = null;

  static create() {
    if (SkySystem.main) return;
    if (!Scene.main) throw new Error('Sky requires Scene.main');
    SkySystem.main = new SkySystem(Scene.main);
  }

  constructor(scene) {
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    // ⬇️ Back to the earlier “low horizon” look
    this.params = {
      turbidity: 7.0,
      rayleigh: 1.672,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.584,
      elevation: 0.8,   // low sun near horizon again
      azimuth: 180.0,
      exposure: 0.5     // darker / moodier background dome
    };

    this.sky = sky;
    this.sun = new THREE.Vector3();

    this.applyParams();
  }

  applyParams() {
    const { turbidity, rayleigh, mieCoefficient, mieDirectionalG, elevation, azimuth, exposure } = this.params;

    const u = this.sky.material.uniforms;
    u.turbidity.value       = turbidity;
    u.rayleigh.value        = rayleigh;
    u.mieCoefficient.value  = mieCoefficient;
    u.mieDirectionalG.value = mieDirectionalG;

    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sun);

    const renderer = Viewport.instance?.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = exposure;
    }

    window.dispatchEvent(new CustomEvent('sky:updated', {
      detail: { sunDir: this.getSunDirection().clone(), elevation, azimuth }
    }));
  }

  getSunDirection() {
    return this.sun.clone().normalize();
  }

  // Warm near horizon -> neutral by ~15°
  colorForElevation() {
    const elev = Math.max(0, Math.min(15, this.params.elevation));
    const t = elev / 15;
    const warm = new THREE.Color(0xFFD2A6);
    const neutral = new THREE.Color(0xFFFFFF);
    return warm.lerp(neutral, t);
  }
}