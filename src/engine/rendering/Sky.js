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
    // Sky dome
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    // Default params (matching your screenshot, with lower elevation to bring horizon down)
    this.params = {
      turbidity: 7.0,
      rayleigh: 1.672,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.584,
      elevation: 0.8,    // degrees
      azimuth: 180.0,    // degrees
      exposure: 0.5
    };

    this.sky = sky;
    this.sun = new THREE.Vector3();

    // Apply once
    this.applyParams();

    // Keep a tiny helper sphere OFF (no visible sun mesh)
    this.sunHelper = null;
  }

  /** Call whenever params change */
  applyParams() {
    const { turbidity, rayleigh, mieCoefficient, mieDirectionalG, elevation, azimuth, exposure } = this.params;

    const u = this.sky.material.uniforms;
    u['turbidity'].value = turbidity;
    u['rayleigh'].value = rayleigh;
    u['mieCoefficient'].value = mieCoefficient;
    u['mieDirectionalG'].value = mieDirectionalG;

    // Convert sun angles -> direction vector expected by Sky shader
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u['sunPosition'].value.copy(this.sun);

    // Match renderer exposure
    const renderer = Viewport.instance?.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = exposure;
    }

    // Notify listeners (e.g., Lighting) that sky changed
    window.dispatchEvent(new CustomEvent('sky:updated', {
      detail: {
        sunDir: this.getSunDirection().clone(),
        elevation,
        azimuth,
        params: { turbidity, rayleigh, mieCoefficient, mieDirectionalG, exposure }
      }
    }));
  }

  /** Normalized sun direction (world space) */
  getSunDirection() {
    return this.sun.clone().normalize();
  }

  /** Rough “color temperature” based on sun elevation. Returns THREE.Color. */
  colorForElevation() {
    // Warm at horizon -> neutral higher up
    // Map 0°..15° to 2400K..6500K-ish via simple lerp in RGB space
    const elev = Math.max(0, Math.min(15, this.params.elevation));
    const t = elev / 15; // 0 near horizon, 1 when higher
    const warm = new THREE.Color(0xFFD2A6);  // peachy warm
    const neutral = new THREE.Color(0xFFFFFF);
    return warm.lerp(neutral, t);
  }
}