// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/** Tiny value-noise (Perlin-ish) for gentle gravel undulation */
class ValueNoise2D {
  constructor(seed = 1337) {
    this.perm = new Uint16Array(512);
    let s = seed >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
    for (let i = 0; i < 256; i++) this.perm[i] = i;
    // shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = this.perm[i];
      this.perm[i] = this.perm[j];
      this.perm[j] = t;
    }
    for (let i = 0; i < 256; i++) this.perm[i + 256] = this.perm[i];
  }
  _hash(x, y) { return this.perm[(x + this.perm[y & 255]) & 255]; }
  _fade(t) { return t * t * (3 - 2 * t); } // smoothstep
  _lerp(a, b, t) { return a + (b - a) * t; }
  noise(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this._fade(xf);
    const v = this._fade(yf);
    const n00 = this._hash(xi,     yi);
    const n10 = this._hash(xi + 1, yi);
    const n01 = this._hash(xi,     yi + 1);
    const n11 = this._hash(xi + 1, yi + 1);
    // map hashed ints to [0,1]
    const f00 = n00 / 255; const f10 = n10 / 255; const f01 = n01 / 255; const f11 = n11 / 255;
    const nx0 = this._lerp(f00, f10, u);
    const nx1 = this._lerp(f01, f11, u);
    return this._lerp(nx0, nx1, v) * 2 - 1; // [-1,1]
  }
}

export default class TerrainGenerator {
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;
    const depth = WORLD_DEPTH * TILE_SIZE;

    // Give enough vertices so raycasting is precise on every tile
    const segX = WORLD_WIDTH;    // matches tile count
    const segZ = WORLD_DEPTH;    // matches tile count
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);

    // Rotate to XZ and place so (0,0) is bottom-left corner of the world.
    geometry.rotateX(-Math.PI / 2);

    // Subtle height variation for a “smooth-but-not-perfectly-flat” gravel
    const pos = geometry.attributes.position;
    const noise = new ValueNoise2D(9473);
    const scale1 = 0.6;   // low frequency
    const scale2 = 3.5;   // higher frequency
    const amp1   = 0.035; // ~3.5 cm
    const amp2   = 0.015; // ~1.5 cm

    // Vertex colors for gentle gravel tone variation (no checkerboard)
    const colors = new Float32Array(pos.count * 3);
    const baseA = new THREE.Color(0x6a6a6a); // mid grey
    const baseB = new THREE.Color(0x7a7570); // warm grey
    const baseC = new THREE.Color(0x585858); // darker pits

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Map to [0, depth] & [0, width] in world space centered plane -> shift by half
      const wx = x + width * 0.5;
      const wz = z + depth * 0.5;

      const n1 = noise.noise(wx * scale1 / width,  wz * scale1 / depth);
      const n2 = noise.noise(wx * scale2 / width,  wz * scale2 / depth);
      const height = n1 * amp1 + n2 * amp2;

      pos.setY(i, height);

      // Color blend based on local noise (subtle mottling)
      const t = THREE.MathUtils.clamp(0.5 + 0.5 * n1, 0, 1);
      const u = THREE.MathUtils.clamp(0.5 + 0.5 * n2, 0, 1);

      const c = baseA.clone().lerp(baseB, t).lerp(baseC, u * 0.35);
      const ci = i * 3;
      colors[ci + 0] = c.r;
      colors[ci + 1] = c.g;
      colors[ci + 2] = c.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Matte, slightly rough gravel look; uses vertex colors only
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.95,
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // Shift so the plane’s bottom-left corner is at world (0,0),
    // i.e. (0..width, 0..depth) aligns with tile indices.
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
  }
}