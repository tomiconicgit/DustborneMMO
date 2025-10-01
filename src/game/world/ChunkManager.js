// file: src/game/world/ChunkManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
import { STATIC_OBJECTS, NON_WALKABLE_TILES } from './StaticObjectMap.js';
import { TILE_SIZE } from './WorldMap.js';
import Pathfinding from '../../engine/lib/Pathfinding.js';
import CopperOre from '../objects/CopperOre.js';
import Debugger from '../../debugger.js';

export default class ChunkManager {
  static instance = null;

  static create() {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
  }

  constructor() {
    if (ChunkManager.instance) throw new Error('ChunkManager is a singleton.');

    const scene = Scene.main;
    if (!scene) {
      Debugger.error('ChunkManager created before Scene was initialized.');
      return;
    }

    (async () => {
      try {
        Debugger.log('Building world...');

        // 1) Procedural desert floor first (receives shadows + used by GroundPicker)
        const ground = TerrainGenerator.create();
        scene.add(ground);

        // 2) Ensure shared pathfinding grid exists
        Pathfinding.create?.();

        // 3) Load authored mining-area and fit it to the 30×30 footprint (no floor inside file)
        try {
          await TerrainGenerator.loadMiningArea(scene);
        } catch (err) {
          Debugger.warn('Mining area failed to load; continuing with procedural floor only.', err);
        }

        // 4) Spawn static objects (copper ore, etc.)
        await this._spawnStaticObjects();

        Debugger.log('World build complete.');
      } catch (e) {
        Debugger.error('Failed to build world.', e);
      }
    })();
  }

  async _spawnStaticObjects() {
    const scene = Scene.main;
    if (!scene) return;

    const loader = new GLTFLoader();
    const protoCache = new Map();

    const getPrototype = async (type) => {
      if (protoCache.has(type)) return protoCache.get(type);
      let url = null;

      switch (type) {
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

      root.traverse((o) => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            if (Array.isArray(o.material)) {
              o.material.forEach((m) => m && (m.side = THREE.FrontSide));
            } else {
              o.material.side = THREE.FrontSide;
            }
          }
        }
      });

      protoCache.set(type, root);
      return root;
    };

    // Holds all static objects; also used by GroundPicker for ore picking
    const rootGroup = new THREE.Group();
    rootGroup.name = 'StaticObjects';
    scene.add(rootGroup);

    const pf = Pathfinding.main || null;

    // Apply non-walkable tiles (from your dev-marker export)
    if (pf?.grid && Array.isArray(NON_WALKABLE_TILES)) {
      for (let i = 0; i < NON_WALKABLE_TILES.length; i++) {
        const pair = NON_WALKABLE_TILES[i];
        const x = Number(pair[0]), z = Number(pair[1]);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          pf.grid.setWalkable(x, z, false);
        }
      }
    }

    // Place STATIC_OBJECTS (e.g., copper ores)
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
        const type = spec.type;
        if (!type) continue;

        const proto = await getPrototype(type);
        if (!proto) continue;

        const inst = proto.clone(true);
        inst.name = `${type}-${tx}-${tz}-${i}`;

        // Tile center in world units; keep authored Y
        const worldX = (tx + 0.5) * TILE_SIZE;
        const worldZ = (tz + 0.5) * TILE_SIZE;
        inst.position.set(worldX, inst.position.y, worldZ);

        if (typeof spec.yaw === 'number') inst.rotation.y += spec.yaw;

        rootGroup.add(inst);

        // Block the tile in the pathfinder
        if (pf?.grid) pf.grid.setWalkable(tx, tz, false);

        // Attach mining behavior
        if (type === 'copper-ore') {
          const ore = CopperOre.createFromMesh(inst, tx, tz);
          // mark all children so GroundPicker can resolve ore from any hit mesh
          inst.traverse((o) => { o.userData = o.userData || {}; o.userData.ore = ore; });
        }
      }
    }

    Debugger.log('Static objects spawned:', rootGroup);
  }
}