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
    /* ------------------------------
       1) Gradient Sky Dome (shader)
    ------------------------------ */
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
      bottomColor: { value: new THREE.Color(0xb7c6e0) }, // soft blue haze (not white)
      offset:      { value: 0.0 },
      exponent:    { value: 0.6 }
    };

    // Keep scene fog OFF here to avoid washing the frame.
    // (We render the horizon haze via quads below.)

    // Size sky dome safely within camera far
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

    /* -------------------------------------------
       2) Horizon Fog Ring (Y=0 to Y=H around map)
    ------------------------------------------- */
    const width   = WORLD_WIDTH * TILE_SIZE;
    const depth   = WORLD_DEPTH * TILE_SIZE;
    const H       = 6;       // fog height you asked for
    const inset   = 0.001;   // tiny offset to avoid edge z-fighting
    const ringCol = new THREE.Color(0xb7c6e0); // same tone as bottomColor
    const ringOpacity = 0.55;                  // overall strength

    // Vertical gradient shader: alpha 1 at ground, fades to 0 at H
    const ringVS = `
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`;

    const ringFS = `
      precision mediump float;
      varying float vY;
      uniform float uHeight;
      uniform vec3  uColor;
      uniform float uOpacity;
      void main() {
        float t = clamp(vY / uHeight, 0.0, 1.0);
        float alpha = (1.0 - t) * uOpacity; // strong at ground, fades up to H
        gl_FragColor = vec4(uColor, alpha);
      }`;

    const ringMat = new THREE.ShaderMaterial({
      uniforms: {
        uHeight:  { value: H },
        uColor:   { value: ringCol },
        uOpacity: { value: ringOpacity },
      },
      vertexShader: ringVS,
      fragmentShader: ringFS,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    });

    const group = new THREE.Group();
    group.name = 'HorizonFogRing';

    // Helper to create a vertical wall (PlaneGeometry: X by Y)
    const makeWall = (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), ringMat);

    // NORTH (+Z) – face inward
    {
      const wall = makeWall(width, H);
      wall.position.set(0, H * 0.5, (depth * 0.5) + inset);
      wall.rotateY(Math.PI);
      group.add(wall);
    }
    // SOUTH (-Z) – default normal faces +Z (inward), no rotation needed
    {
      const wall = makeWall(width, H);
      wall.position.set(0, H * 0.5, -(depth * 0.5) - inset);
      group.add(wall);
    }
    // EAST (+X) – rotate to face inward
    {
      const wall = makeWall(depth, H);
      wall.position.set((width * 0.5) + inset, H * 0.5, 0);
      wall.rotateY(-Math.PI * 0.5);
      group.add(wall);
    }
    // WEST (-X) – rotate to face inward
    {
      const wall = makeWall(depth, H);
      wall.position.set(-(width * 0.5) - inset, H * 0.5, 0);
      wall.rotateY(Math.PI * 0.5);
      group.add(wall);
    }

    scene.add(group);

    // keep refs if you want to tweak later at runtime
    this.sky = sky;
    this.horizonRing = group;
  }
}