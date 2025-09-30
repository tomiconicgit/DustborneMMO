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
    // Create the Sky object (from three/examples)
    const sky = new Sky();
    sky.scale.setScalar(450000); // huge dome, like the example
    scene.add(sky);

    // Params from your screenshot
    const params = {
      turbidity: 7.0,
      rayleigh: 1.672,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.584,
      elevation: 1.4,  // degrees above horizon
      azimuth: 180.0,  // degrees
      exposure: 0.5
    };

    // Apply uniforms
    const u = sky.material.uniforms;
    u['turbidity'].value = params.turbidity;
    u['rayleigh'].value = params.rayleigh;
    u['mieCoefficient'].value = params.mieCoefficient;
    u['mieDirectionalG'].value = params.mieDirectionalG;

    // Position the sun exactly like the example controls do
    const phi   = THREE.MathUtils.degToRad(90 - params.elevation);
    const theta = THREE.MathUtils.degToRad(params.azimuth);
    const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u['sunPosition'].value.copy(sun);

    // Match the example’s exposure (tone mapping exposure on the renderer)
    const renderer = Viewport.instance?.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping; // same as demo
      renderer.toneMappingExposure = params.exposure;
    }

    // Store refs if we want to tweak later
    this.sky = sky;
    this.params = params;

    // No fog or horizon ring here — per your request “remove fog from sky”.
    // (If you had a previous HorizonFog/Haze, make sure it’s not in the manifest.)
  }
}