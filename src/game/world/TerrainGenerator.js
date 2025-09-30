// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/* ---------- Perlin-style noise (from your desert example, trimmed) ---------- */
class PerlinNoise {
  constructor(seed = Math.random()) {
    this.seed = seed;
    this.perm = new Array(512);
    this.gradP = new Array(512);
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = (Math.floor(seed * 10000 + i) % 256);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gradP[i] = this.gradients[this.perm[i] % 12];
    }
  }
  gradients = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];
  fade(t){ return t*t*t*(t*(t*6-15)+10); }
  lerp(a,b,t){ return a + (b-a)*t; }
  grad(g, x,y,z){ return g[0]*x + g[1]*y + g[2]*z; }
  noise(x,y,z=0){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
    x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
    const u=this.fade(x), v=this.fade(y), w=this.fade(z);
    const A=this.perm[X]+Y, AA=this.perm[A]+Z, AB=this.perm[A+1]+Z;
    const B=this.perm[X+1]+Y, BA=this.perm[B]+Z, BB=this.perm[B+1]+Z;
    return this.lerp(
      this.lerp(
        this.lerp(this.grad(this.gradP[AA], x,   y,   z), this.grad(this.gradP[BA], x-1, y,   z), u),
        this.lerp(this.grad(this.gradP[AB], x,   y-1, z), this.grad(this.gradP[BB], x-1, y-1, z), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad(this.gradP[AA+1], x,   y,   z-1), this.grad(this.gradP[BA+1], x-1, y,   z-1), u),
        this.lerp(this.grad(this.gradP[AB+1], x,   y-1, z-1), this.grad(this.gradP[BB+1], x-1, y-1, z-1), u),
        v
      ),
      w
    );
  }
}

/* ----------------------- Procedural map generators ------------------------ */
function createGravelNormalMap(noiseA, noiseB, repeat = 10) {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  // strength tuned for visible “gravel grooves”
  const strength = 38;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;

      // multi-scale noise: soft ripples + micro grit
      const h1 = noiseA.noise(nx * 14, ny * 14) * 0.8;
      const h2 = noiseA.noise(nx * 28, ny * 28) * 0.4;
      const h3 = noiseB.noise(nx * 95, ny * 95) * 0.15;
      const h  = h1 + h2 + h3;

      // sample neighbors for gradient
      const nxL = ((x>0?x-1:x)   ) / size, nxR = ((x<size-1?x+1:x))/size;
      const nyU = ((y>0?y-1:y)   ) / size, nyD = ((y<size-1?y+1:y))/size;
      const hL = noiseA.noise(nxL*14, ny*14)*0.8 + noiseA.noise(nxL*28, ny*28)*0.4 + noiseB.noise(nxL*95, ny*95)*0.15;
      const hR = noiseA.noise(nxR*14, ny*14)*0.8 + noiseA.noise(nxR*28, ny*28)*0.4 + noiseB.noise(nxR*95, ny*95)*0.15;
      const hU = noiseA.noise(nx*14, nyU*14)*0.8 + noiseA.noise(nx*28, nyU*28)*0.4 + noiseB.noise(nx*95, nyU*95)*0.15;
      const hD = noiseA.noise(nx*14, nyD*14)*0.8 + noiseA.noise(nx*28, nyD*28)*0.4 + noiseB.noise(nx*95, nyD*95)*0.15;

      const dx = (hR - hL);
      const dy = (hD - hU);

      const i = (y * size + x) * 4;
      data[i + 0] = 128 + Math.max(-127, Math.min(127, strength * dx)); // X
      data[i + 1] = 128 + Math.max(-127, Math.min(127, strength * dy)); // Y
      data[i + 2] = 255;                                                // Z
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return tex;
}

function createGravelRoughnessMap(noise, repeat = 12) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      // higher where pits exist (rougher), slightly lower on crests
      const r = 0.88 + 0.12 * noise.noise(nx * 40, ny * 40);
      const v = Math.max(0, Math.min(255, Math.floor(r * 255)));
      const i = (y * size + x) * 4;
      data[i+0] = v; data[i+1] = v; data[i+2] = v; data[i+3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return tex;
}

/* --------------------------------- Terrain -------------------------------- */
export default class TerrainGenerator {
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;
    const depth = WORLD_DEPTH * TILE_SIZE;

    // More vertices so bumps look good & raycasting is precise on each tile
    const segX = WORLD_WIDTH * 2;
    const segZ = WORLD_DEPTH * 2;
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // multi-octave displacement (more pronounced than before, still walkable)
    const pos = geometry.attributes.position;
    const n1 = new PerlinNoise(Math.random());
    const n2 = new PerlinNoise(Math.random() + 1234);

    // amplitude in meters (keep modest so the flat-movement avatar doesn’t clip hard)
    const A1 = 0.12;   // base undulation
    const A2 = 0.07;   // mid bumps
    const A3 = 0.03;   // micro grit
    // frequency in cycles across the whole map
    const F1 = 1.2;
    const F2 = 4.0;
    const F3 = 14.0;

    // vertex colours (gravel palette)
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0x5b5b5b); // deep pit grey
    const cB = new THREE.Color(0x6f6a64); // warm taupe
    const cC = new THREE.Color(0x7b7b7b); // mid granite
    const cD = new THREE.Color(0x8a8078); // dusty brown tint
    const cE = new THREE.Color(0x949494); // light speckle

    // do displacement & colour
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + width * 0.5;  // map to [0..width]
      const z = pos.getZ(i) + depth * 0.5;  // map to [0..depth]

      const u = x / width, v = z / depth;

      const h =
        A1 * n1.noise(u * F1, v * F1) +
        A2 * n1.noise(u * F2, v * F2) +
        A3 * n2.noise(u * F3, v * F3);

      pos.setY(i, h);

      // colour blend: base by low freq, detail by high freq
      const tLo = THREE.MathUtils.clamp(0.5 + 0.5 * n1.noise(u * F1, v * F1), 0, 1);
      const tHi = THREE.MathUtils.clamp(0.5 + 0.5 * n2.noise(u * F3, v * F3), 0, 1);

      const col = cA.clone()
        .lerp(cB, tLo * 0.55)
        .lerp(cC, 0.25 + tHi * 0.25)
        .lerp(cD, (1.0 - tLo) * 0.2)
        .lerp(cE, 0.10 * tHi);

      const ci = i * 3;
      colors[ci+0] = col.r;
      colors[ci+1] = col.g;
      colors[ci+2] = col.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // procedural texture maps
    const normalMap    = createGravelNormalMap(new PerlinNoise(Math.random()+42), new PerlinNoise(Math.random()+77), 9);
    const roughnessMap = createGravelRoughnessMap(new PerlinNoise(Math.random()+99), 11);

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.92,      // base; roughnessMap modulates this
      roughnessMap,
      normalMap,
      normalScale: new THREE.Vector2(1.0, 1.0)
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.name = 'ProceduralGround';
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;

    // align world so tile (0,0) starts at (0,0)
    groundMesh.position.set(width / 2, 0, depth / 2);

    return groundMesh;
  }
}