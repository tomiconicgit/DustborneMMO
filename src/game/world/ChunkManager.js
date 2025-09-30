// file: src/game/world/ChunkManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from './WorldMap.js';
import { STATIC_OBJECTS } from './StaticObjectMap.js';
import Debugger from '../../debugger.js';

export default class ChunkManager {
  static instance = null;

  static create() {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
  }

  constructor() {
    if (ChunkManager.instance) throw new Error("ChunkManager is a singleton.");

    const scene = Scene.main;
    if (!scene) {
      Debugger.error("ChunkManager created before Scene was initialized.");
      return;
    }

    Debugger.log("Building world...");
    const ground = TerrainGenerator.create();
    scene.add(ground);
    Debugger.log("World build complete.");

    // Spawn static objects (async)
    this._spawnStaticObjects().catch((e) => {
      Debugger.warn('Failed to spawn static objects:', e);
    });
  }

  async _spawnStaticObjects() {
    const scene = Scene.main;
    if (!scene) return;

    // Preload assets we might need
    const loader = new GLTFLoader();

    // Cache of prototypes by type
    const prototypes = {};

    const getPrototype = async (type) => {
      if (prototypes[type]) return prototypes[type];

      let url = null;
      switch (type) {
        case 'ore-copper':
          url = new URL('../../assets/models/rocks/copper-ore.glb', import.meta.url).href;
          break;
        default:
          Debugger.warn(`Unknown static object type: ${type}`);
          return null;
      }

      const gltf = await loader.loadAsync(url);
      const proto = gltf.scene || gltf.scenes?.[0];
      if (!proto) {
        Debugger.warn(`[Static] No scene in GLB for type ${type}`);
        return null;
      }

      proto.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      prototypes[type] = proto;
      return proto;
    };

    // Group for all statics (easy to find/debug)
    const root = new THREE.Group();
    root.name = 'StaticObjects';
    scene.add(root);

    // Iterate the tile map
    for (const key in STATIC_OBJECTS) {
      if (!Object.prototype.hasOwnProperty.call(STATIC_OBJECTS, key)) continue;

      const [txStr, tzStr] = key.split(',');
      let tx = Number(txStr), tz = Number(tzStr);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) continue;

      // clamp inside world
      tx = THREE.MathUtils.clamp(tx, 0, WORLD_WIDTH - 1);
      tz = THREE.MathUtils.clamp(tz, 0, WORLD_DEPTH - 1);

      const list = STATIC_OBJECTS[key];
      if (!Array.isArray(list)) continue;

      for (let i = 0; i < list.length; i++) {
        const spec = list[i] || {};
        const type = spec.type;
        if (!type) continue;

        const proto = await getPrototype(type);
        if (!proto) continue;

        const inst = proto.clone(true);
        inst.name = `${type}-${tx}-${tz}-${i}`;

        // Snap to tile center in XZ; keep authored Y (baked in the GLB)
        const worldX = (tx + 0.5) * TILE_SIZE;
        const worldZ = (tz + 0.5) * TILE_SIZE;
        inst.position.set(worldX, inst.position.y, worldZ);

        // Optional rotation (yaw in radians); small variety per spec
        const yaw = typeof spec.yaw === 'number' ? spec.yaw : 0;
        inst.rotation.y += yaw;

        root.add(inst);
      }
    }

    Debugger.log('Static objects spawned:', root);
  }
}