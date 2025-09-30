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

    // Midday vibe: higher sun elevation, slightly brighter exposure
    this.params = {
      turbidity: 7.0,
      rayleigh: 1.6,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.58,
      elevation: 60.0,   // ← high sun (midday)
      azimuth: 180.0,    // south-ish; tweak if you want different “time”
      exposure: 0.85     // brighter overall
    };

    this.sky = sky;
    this.sun = new THREE.Vector3();

    // Apply once
    this.applyParams();

    // No visible helper mesh
    this.sunHelper = null;
  }

  /** Call whenever params change */
  applyParams() {
    const { turbidity, rayleigh, mieCoefficient, mieDirectionalG, elevation, azimuth, exposure } = this.params;

    const u = this.sky.material.uniforms;
    u['turbidity'].value        = turbidity;
    u['rayleigh'].value         = rayleigh;
    u['mieCoefficient'].value   = mieCoefficient;
    u['mieDirectionalG'].value  = mieDirectionalG;

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

  /**
   * Daylight color: warm at horizon -> neutral/white by midday.
   * Map 0°..60° to warm..neutral; clamp beyond that.
   */
  colorForElevation() {
    const elev = THREE.MathUtils.clamp(this.params.elevation, 0, 60);
    const t = elev / 60; // 0 near horizon, 1 by midday
    const warm = new THREE.Color(0xFFD2A6);  // peachy warm
    const neutral = new THREE.Color(0xFFFFFF);
    return warm.lerp(neutral, t);
  }
}