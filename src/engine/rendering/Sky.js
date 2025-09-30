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

    this.params = {
      turbidity: 7.0,
      rayleigh: 1.8,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.58,
      elevation: 0.8,     // low sun
      azimuth: 180.0,
      exposure: 0.5
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

    // Sun still near horizon
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sun);

    const renderer = Viewport.instance?.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = exposure;
    }

    // 🔵 Force zenith tint blue
    this.setZenithTint(new THREE.Color(0x4da6ff));

    window.dispatchEvent(new CustomEvent('sky:updated', {
      detail: { sunDir: this.getSunDirection().clone(), elevation, azimuth }
    }));
  }

  setZenithTint(color) {
    // Hack: the Sky shader takes uniforms for "up" scattering
    // We fake it by biasing the vertex colors at high altitudes.
    const u = this.sky.material.uniforms;
    if (u && u.rayleigh) {
      // blend stronger blue scattering
      u.rayleigh.value = this.params.rayleigh * 1.2;
      // direct color override at top (approximation)
      this.sky.material.uniforms.topColor = { value: color };
    }
  }

  getSunDirection() {
    return this.sun.clone().normalize();
  }

  colorForElevation() {
    const elev = Math.max(0, Math.min(15, this.params.elevation));
    const t = elev / 15;
    const warm = new THREE.Color(0xFFD2A6); // horizon warm
    const neutral = new THREE.Color(0xffffff);
    return warm.lerp(neutral, t);
  }
}