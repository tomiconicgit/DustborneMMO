// file: src/engine/rendering/Sky.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import Lighting from './Lighting.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Sky {
  static main = null;

  static create() {
    if (Sky.main) return;
    if (!Lighting) throw new Error('Sky requires the Lighting system.');
    if (!Scene.main) throw new Error('Sky requires Scene.main');
    Sky.main = new Sky(Scene.main);
  }

  constructor(scene) {
    // Shader-based gradient sky dome
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
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
        float mixStrength = max(pow(max(h, 0.0), exponent), 0.0);
        vec3 col = mix(bottomColor, topColor, mixStrength);
        gl_FragColor = vec4(col, 1.0);
      }`;

    const uniforms = {
      topColor:    { value: new THREE.Color(0x87ceeb) }, // light blue
      bottomColor: { value: new THREE.Color(0xe0e0e0) }, // near white/ground haze
      offset:      { value: 0 },
      exponent:    { value: 0.6 }
    };

    // Fog tuned to your 30x30 terrain
    const maxDistance = Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE;
    scene.fog = new THREE.Fog(uniforms.bottomColor.value, maxDistance * 0.5, maxDistance * 2);

    // Big sphere that follows the camera
    const skyGeo = new THREE.SphereGeometry(maxDistance * 4, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
    });

    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.name = 'SkyDome';

    // Always follow camera so dome appears infinite
    skyMesh.onBeforeRender = (_renderer, _scene, camera) => {
      skyMesh.position.copy(camera.position);
    };

    scene.add(skyMesh);
  }
}