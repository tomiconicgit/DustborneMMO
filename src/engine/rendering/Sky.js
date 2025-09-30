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

    // Adjusted params
    const params = {
      turbidity: 7.0,
      rayleigh: 1.672,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.584,
      elevation: 0.8,   // lower than before (was 1.4)
      azimuth: 180.0,
      exposure: 0.5
    };

    const u = sky.material.uniforms;
    u['turbidity'].value = params.turbidity;
    u['rayleigh'].value = params.rayleigh;
    u['mieCoefficient'].value = params.mieCoefficient;
    u['mieDirectionalG'].value = params.mieDirectionalG;

    const phi   = THREE.MathUtils.degToRad(90 - params.elevation);
    const theta = THREE.MathUtils.degToRad(params.azimuth);
    const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u['sunPosition'].value.copy(sun);

    const renderer = Viewport.instance?.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = params.exposure;
    }

    this.sky = sky;
    this.params = params;
  }
}