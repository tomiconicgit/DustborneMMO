// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/** Tiny, fast hash-noise for subtle undulations (deterministic). */
class TinyNoise {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
  }
  _hash(x, z) {
    // 32-bit integer hash
    let h = (x * 374761393) ^ (z * 668265263) ^ this.seed;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return h;
  }
  // Returns in [-1, 1]
  rand01(x, z) {
    const h = this._hash(x, z);
    return (h / 0xffffffff) * 2 - 1;
  }
  // Simple bilinear interpolation over integer grid
  noise(x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const x1 = x0 + 1,       z1 = z0 + 1;
    const tx = x - x0,       tz = z - z0;

    const n00 = this.rand01(x0, z0);
    const n10 = this.rand01(x1, z0);
    const n01 = this.rand01(x0, z1);
    const n11 = this.rand01(x1, z1);

    const nx0 = n00 * (1 - tx) + n10 * tx;
    const nx1 = n01 * (1 - tx) + n11 * tx;
    return nx0 * (1 - tz) + nx1 * tz;
  }
}

export default class TerrainGenerator {
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;
    const depth = WORLD_DEPTH * TILE_SIZE;

    // Low-poly desert look: fewer segments to keep faceting subtle.
    const segX = Math.max(10, Math.floor(WORLD_WIDTH * 0.8));
    const segZ = Math.max(10, Math.floor(WORLD_DEPTH * 0.8));
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // Subtle bumps (keep very gentle, desert-flat)
    const pos = geometry.attributes.position;
    const noise = new TinyNoise(20250101);
    const amp = 0.05; // meters; very slight
    const freq = 1.5; // low frequency over the board

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + width * 0.5;   // map to [0..width]
      const z = pos.getZ(i) + depth * 0.5;   // map to [0..depth]
      const u = x / width;
      const v = z / depth;

      const h =
        amp * (0.65 * noise.noise(u * freq, v * freq) +
               0.35 * noise.noise(u * (freq * 0.5), v * (freq * 0.5)));

      pos.setY(i, h);
    }

    geometry.computeVertexNormals();

    // Plain beige, no vertex colors or textures (clean desert look)
    const material = new THREE.MeshStandardMaterial({
      color: 0xD9C49C,   // beige desert
      metalness: 0.0,
      roughness: 0.85
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // Align world so tile (0,0) starts at (0,0)
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
    }
}