// file: src/game/world/ChunkManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
import { STATIC_OBJECTS } from './StaticObjectMap.js';
import { TILE_SIZE } from './WorldMap.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import Debugger from '../../debugger.js';

export default class ChunkManager {
  static instance = null;

  static create() {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
  }

  constructor() {
    if (ChunkManager.instance) {
      throw new Error('ChunkManager is a singleton.');
    }

    const scene = Scene.main;
    if (!scene) {
      Debugger.error('ChunkManager created before Scene was initialized.');
      return;
    }

    Debugger.log('Building world...');
    const ground = TerrainGenerator.create();
    scene.add(ground);

    // Ensure we have a shared pathfinding grid early
    Pathfinding.create?.();

    // Spawn statics (ores etc.) asynchronously
    this._spawnStaticObjects().catch(err => {
      Debugger.error('Failed to spawn static objects', err);
    });

    Debugger.log('World build complete.');
  }

  async _spawnStaticObjects() {
    const scene = Scene.main;
    if (!scene) return;

    const loader = new GLTFLoader();
    const protoCache = new Map();

    const getPrototype = async (type) => {
      // accept both spellings just in case
      const t = (type === 'ore-copper') ? 'copper-ore' : type;

      if (protoCache.has(t)) return protoCache.get(t);

      let url = null;
      switch (t) {
        case 'copper-ore':
          url = new URL('../../assets/models/rocks/copper-ore.glb', import.meta.url).href;
          break;
        default:
          Debugger.warn(`Unknown static object type: ${type}`);
          return null;
      }

      const gltf = await loader.loadAsync(url);
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) return null;

      // Make meshes cast/receive shadows; keep Y as baked-in (important)
      root.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      protoCache.set(t, root);
      return root;
    };

    const rootGroup = new THREE.Group();
    rootGroup.name = 'StaticObjects';
    scene.add(rootGroup);

    const pf = Pathfinding.main || null;
    let spawnCount = 0;

    for (const key in STATIC_OBJECTS) {
      if (!Object.prototype.hasOwnProperty.call(STATIC_OBJECTS, key)) continue;

      const [txStr, tzStr] = key.split(',');
      const tx = Number(txStr);
      const tz = Number(tzStr);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) continue;

      const list = STATIC_OBJECTS[key];
      if (!Array.isArray(list) || list.length === 0) continue;

      for (let i = 0; i < list.length; i++) {
        const spec = list[i] || {};
        const proto = await getPrototype(spec.type);
        if (!proto) continue;

        const inst = proto.clone(true);
        inst.name = `${spec.type}-${tx}-${tz}-${i}`;

        // Place at the tile center; keep the model's baked Y (inst.position.y)
        const worldX = (tx + 0.5) * TILE_SIZE;
        const worldZ = (tz + 0.5) * TILE_SIZE;
        inst.position.set(worldX, inst.position.y, worldZ);

        // Optional yaw per instance (radians)
        if (typeof spec.yaw === 'number') {
          inst.rotation.y += spec.yaw;
        }

        rootGroup.add(inst);
        spawnCount++;

        // Mark the tile as non-walkable in the shared pathfinding grid
        if (pf?.grid) {
          pf.grid.setWalkable(tx, tz, false);
        }
      }
    }

    Debugger.log(`Static objects spawned: ${spawnCount}`, rootGroup);
  }
}