// file: src/game/world/TerrainGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';

/** Small helpers for the old procedural gravel (kept as a fallback + shadow catcher) */
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
  grad(g,x,y,z){ return g[0]*x + g[1]*y + g[2]*z; }
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

function createGravelNormalMap(noiseA, noiseB, repeat = 10) {
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  const strength = 38;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      const h1 = noiseA.noise(nx * 14, ny * 14) * 0.8;
      const h2 = noiseA.noise(nx * 28, ny * 28) * 0.4;
      const h3 = noiseB.noise(nx * 95, ny * 95) * 0.15;
      const nxL = ((x>0?x-1:x))/size, nxR = ((x<size-1?x+1:x))/size;
      const nyU = ((y>0?y-1:y))/size, nyD = ((y<size-1?y+1:y))/size;
      const hL = noiseA.noise(nxL*14, ny*14)*0.8 + noiseA.noise(nxL*28, ny*28)*0.4 + noiseB.noise(nxL*95, ny*95)*0.15;
      const hR = noiseA.noise(nxR*14, ny*14)*0.8 + noiseA.noise(nxR*28, ny*28)*0.4 + noiseB.noise(nxR*95, ny*95)*0.15;
      const hU = noiseA.noise(nx*14, nyU*14)*0.8 + noiseA.noise(nx*28, nyU*28)*0.4 + noiseB.noise(nx*95, nyU*95)*0.15;
      const hD = noiseA.noise(nx*14, nyD*14)*0.8 + noiseA.noise(nx*28, nyD*28)*0.4 + noiseB.noise(nx*95, nyD*95)*0.15;
      const dx = (hR - hL);
      const dy = (hD - hU);
      const i = (y * size + x) * 4;
      data[i + 0] = 128 + Math.max(-127, Math.min(127, strength * dx));
      data[i + 1] = 128 + Math.max(-127, Math.min(127, strength * dy));
      data[i + 2] = 255;
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
      const r = 0.88 + 0.12 * noise.noise(nx * 40, ny * 40);
      const v = Math.max(0, Math.min(255, Math.floor(r * 255)));
      const i = (y * size + x) * 4;
      data[i+0]=v; data[i+1]=v; data[i+2]=v; data[i+3]=255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return tex;
}

/** Loads and fits the mining-area GLB into the 30×30 world extents. */
async function loadAndFitMiningArea(intoGroup) {
  const url = new URL('../../assets/models/terrain/mining-area.glb', import.meta.url).href;
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) return;

  // Shadows/material flags
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && 'metalness' in o.material) {
        o.material.metalness = Math.min(0.2, o.material.metalness ?? 0);
        o.material.roughness = Math.max(0.6, o.material.roughness ?? 0.6);
    }}});

  // Compute bounds BEFORE transform
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3(); box.getSize(size);
  const min  = box.min.clone();
  const max  = box.max.clone();

  // Target world size in meters
  const targetW = WORLD_WIDTH  * TILE_SIZE;
  const targetD = WORLD_DEPTH  * TILE_SIZE;

  // Fit scale (keep aspect, fit inside 30x30)
  const s = Math.min(targetW / size.x, targetD / size.z);
  model.scale.setScalar(s);

  // Recompute bounds AFTER scale
  const boxScaled = new THREE.Box3().setFromObject(model);
  const sizeScaled = new THREE.Vector3(); boxScaled.getSize(sizeScaled);
  const minScaled  = boxScaled.min.clone();
  const maxScaled  = boxScaled.max.clone();

  // Place so the base sits on y=0 (slightly above to avoid z-fight) and the model is centered in the 30x30
  const targetCenterX = targetW * 0.5;
  const targetCenterZ = targetD * 0.5;

  const currentCenter = new THREE.Vector3();
  boxScaled.getCenter(currentCenter);

  const offsetX = targetCenterX - currentCenter.x;
  const offsetZ = targetCenterZ - currentCenter.z;
  const offsetY = -minScaled.y + 0.01; // lift so lowest point sits just above y=0

  model.position.add(new THREE.Vector3(offsetX, offsetY, offsetZ));

  intoGroup.add(model);
}

export default class TerrainGenerator {
  /**
   * Returns a group that contains:
   *  - an invisible “ProceduralGround” (flat 30×30) used for taps/pathfinding/shadow catching
   *  - the loaded mining-area.glb, fitted to the same bounds (added asynchronously)
   */
  static create() {
    const width = WORLD_WIDTH * TILE_SIZE;
    const depth = WORLD_DEPTH * TILE_SIZE;

    // A root group we can return synchronously
    const root = new THREE.Group();
    root.name = 'TerrainRoot';

    // --- Flat ground used for raycasts & movement (kept invisible but shadow-casting-friendly) ---
    const segX = WORLD_WIDTH * 2;
    const segZ = WORLD_DEPTH * 2;
    const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    // subtle normal/roughness so it can be a shadow catcher if you make it visible later
    const normalMap    = createGravelNormalMap(new PerlinNoise(42.123), new PerlinNoise(77.456), 9);
    const roughnessMap = createGravelRoughnessMap(new PerlinNoise(99.789), 11);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x7a6d66,
      metalness: 0.0,
      roughness: 0.9,
      roughnessMap,
      normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      transparent: true,
      opacity: 0.0,            // fully invisible – still receives/casts shadows if you want
      depthWrite: false,       // avoid z-fighting with the model’s floor
    });

    const groundMesh = new THREE.Mesh(geometry, groundMat);
    groundMesh.name = 'ProceduralGround';
    groundMesh.receiveShadow = true;
    groundMesh.castShadow = false;
    groundMesh.position.set(width / 2, 0, depth / 2);
    root.add(groundMesh);

    // --- Load & fit the authored environment model (async, added into the same root) ---
    loadAndFitMiningArea(root).catch(err => {
      console.warn('[Terrain] Failed to load mining-area.glb:', err);
    });

    return root;
  }
}