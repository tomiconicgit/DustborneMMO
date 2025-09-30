// file: src/engine/rendering/Sky.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import Camera from './Camera.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Sky {
  static main = null;

  static create() {
    if (Sky.main) return;
    if (!Scene.main) throw new Error('Sky requires Scene.main');
    Sky.main = new Sky(Scene.main);
  }

  constructor(scene) {
    // Simple gradient sky dome — NO horizon fog, NO scene.fog.
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        vec3 col = mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        gl_FragColor = vec4(col, 1.0);
      }`;

    const uniforms = {
      topColor:    { value: new THREE.Color(0x87ceeb) }, // sky blue
      bottomColor: { value: new THREE.Color(0xc8d8ff) }, // very light blue
      offset:      { value: 0.0 },
      exponent:    { value: 0.6 }
    };

    const cam = Camera.main?.threeCamera || Camera.main;
    const worldMax = Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE;
    const radius = (cam?.far ? cam.far * 0.9 : worldMax * 20);

    const skyGeo = new THREE.SphereGeometry(radius, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = 'SkyDome';
    sky.onBeforeRender = (_r, _s, camera) => sky.position.copy(camera.position);
    scene.add(sky);

    this.sky = sky;
  }
}