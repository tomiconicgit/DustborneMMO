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
      rayleigh: 1.672,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.584,
      elevation: 0.8,
      azimuth: 180.0,
      exposure: 0.55
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

    // ✅ Blue top gradient overlay
    const TOP  = new THREE.Color(0x73b7ff); // blue zenith
    const BOT  = new THREE.Color(0xffd1a3); // warm horizon
    this.sky.material.onBeforeCompile = (shader) => {
      shader.uniforms.topColor    = { value: TOP };
      shader.uniforms.bottomColor = { value: BOT };
      shader.uniforms.mixStrength = { value: 0.75 };

      shader.fragmentShader = shader.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `
          float h = clamp(normalize(vWorldPosition).y, 0.0, 1.0);
          vec3 grad = mix(bottomColor, topColor, smoothstep(0.0, 1.0, h));
          vec3 blended = mix(outgoingLight, grad, mixStrength);
          gl_FragColor = vec4(blended, diffuseColor.a);
        `
      );
    };
    this.sky.material.needsUpdate = true;

    window.dispatchEvent(new CustomEvent('sky:updated', {
      detail: { sunDir: this.getSunDirection().clone(), elevation, azimuth }
    }));
  }

  getSunDirection() { return this.sun.clone().normalize(); }
}