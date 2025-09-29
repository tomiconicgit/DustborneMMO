// file: src/engine/rendering/HorizonFog.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class HorizonFog {
  static main = null;

  static create() {
    if (HorizonFog.main) return;
    if (!Scene.main) throw new Error('HorizonFog requires Scene.main');
    HorizonFog.main = new HorizonFog(Scene.main);
  }

  constructor(scene) {
    const width  = WORLD_WIDTH * TILE_SIZE;
    const depth  = WORLD_DEPTH * TILE_SIZE;
    const height = 6; // fog height you asked for
    const inset  = 0.001; // tiny offset to avoid z-fighting with terrain edge

    // Vertical gradient shader: opaque at y=0, fades to 0 at y=height
    const vertexShader = `
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    const fragmentShader = `
      precision mediump float;
      varying float vY;
      uniform float uHeight;
      uniform vec3  uColor;
      uniform float uOpacity;

      void main() {
        float t = clamp(vY / uHeight, 0.0, 1.0);
        float alpha = (1.0 - t) * uOpacity; // strongest at ground, fades up
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHeight:  { value: height },
        uColor:   { value: new THREE.Color(0xb7c6e0) }, // soft bluish haze
        uOpacity: { value: 0.55 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const group = new THREE.Group();
    group.name = 'HorizonFogRing';

    // Helper to make a vertical wall (PlaneGeometry is X by Y by default)
    const makeWall = (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), material);

    // NORTH wall (+Z), faces inward
    {
      const wall = makeWall(width, height);
      wall.position.set(0, height * 0.5, (depth * 0.5) + inset);
      wall.rotateY(Math.PI);
      group.add(wall);
    }

    // SOUTH wall (-Z), faces inward
    {
      const wall = makeWall(width, height);
      wall.position.set(0, height * 0.5, -(depth * 0.5) - inset);
      // default plane faces +Z, which is inward here; no rotation needed
      group.add(wall);
    }

    // EAST wall (+X), faces inward
    {
      const wall = makeWall(depth, height);
      wall.position.set((width * 0.5) + inset, height * 0.5, 0);
      wall.rotateY(-Math.PI * 0.5);
      group.add(wall);
    }

    // WEST wall (-X), faces inward
    {
      const wall = makeWall(depth, height);
      wall.position.set(-(width * 0.5) - inset, height * 0.5, 0);
      wall.rotateY(Math.PI * 0.5);
      group.add(wall);
    }

    scene.add(group);
    this.group = group;
  }
}