// file: src/engine/rendering/Lighting.js
import * as THREE from 'three';
import Scene from '../core/Scene.js';
import SkySystem from './Sky.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

export default class Lighting {
  static hemi = null;
  static sun  = null;

  static create() {
    const scene = Scene.main;
    if (!scene) {
      console.error("Scene not initialized before Lighting.");
      return;
    }

    // Hemisphere light for ambient skylight
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6f6256, 0.95);
    scene.add(hemi);

    // Directional sun
    const sun  = new THREE.DirectionalLight(0xffffff, 1.85);
    sun.castShadow = true;                // ✅ enable sun shadows
    sun.shadow.mapSize.set(2048, 2048);   // quality

    // Shadow camera sized to the playable area (orthographic for dir light)
    const W = WORLD_WIDTH * TILE_SIZE;
    const D = WORLD_DEPTH * TILE_SIZE;
    const half = Math.max(W, D) * 0.6;    // generous bounds covering the board

    const cam = sun.shadow.camera;
    cam.left   = -half;
    cam.right  =  half;
    cam.top    =  half;
    cam.bottom = -half;
    cam.near   = 0.5;
    cam.far    = 120;

    // Reduce acne/ peter-panning
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.5;

    scene.add(sun);

    Lighting.hemi = hemi;
    Lighting.sun  = sun;

    // Initial sync from sky & keep in sync thereafter
    Lighting.syncToSky();
    window.addEventListener('sky:updated', Lighting.syncToSky);
  }

  static syncToSky = () => {
    const sky = SkySystem.main;
    if (!sky || !Lighting.sun || !Lighting.hemi) return;

    // Direction from procedural sky
    const dir = sky.getSunDirection();
    // Place the sun far along that direction
    Lighting.sun.position.copy(dir.clone().multiplyScalar(1000));
    Lighting.sun.target.position.set(0, 0, 0);
    Lighting.sun.target.updateMatrixWorld?.();

    // Brighter midday style regardless of elevation; keep some variation
    const elev = sky.params.elevation;
    // Warmer when low, neutral when higher
    const sunColor = sky.colorForElevation();
    Lighting.sun.color.copy(sunColor);

    // Raise the floor and ceiling on intensity so it reads brighter
    const t = Math.min(1, elev / 12);
    const intensity = THREE.MathUtils.lerp(1.6, 2.2, t);
    Lighting.sun.intensity = intensity;

    // Hemisphere tint: blue-ish sky, warmer ground
    const skyTint    = new THREE.Color(0x9fc8ff); // light sky blue
    const groundTint = new THREE.Color(0x7f6f5d); // muted warm bounce
    Lighting.hemi.color.copy(skyTint);
    Lighting.hemi.groundColor.copy(groundTint);
    Lighting.hemi.intensity = 1.0;
  };
}