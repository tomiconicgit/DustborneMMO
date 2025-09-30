// file: src/game/world/ChunkManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
import { STATIC_OBJECTS } from './StaticObjectMap.js';
import { TILE_SIZE, WORLD_WIDTH, WORLD_DEPTH } from './WorldMap.js';
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
      // normalize any legacy spellings
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

      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

      protoCache.set(t, root);
      return root;
    };

    const rootGroup = new THREE.Group();
    rootGroup.name = 'StaticObjects';
    scene.add(rootGroup);

    const pf = Pathfinding.main || null;
    const grid = pf?.grid || null;

    // Track blocked tiles locally while spawning to enforce a 1-tile moat.
    // We treat a tile as "blocked" if a rock sits on it.
    const blocked = new Set();
    const key = (x,z) => `${x},${z}`;

    // Helper: is inside world
    const inBounds = (x, z) => (
      x >= 0 && z >= 0 && x < WORLD_WIDTH && z < WORLD_DEPTH
    );

    // Helper: is there any blocked tile within Chebyshev radius 1?
    const neighborhoodClear = (x, z) => {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, nz = z + dz;
          if (!inBounds(nx, nz)) continue;
          if (blocked.has(key(nx, nz))) return false; // neighbor (or self) is occupied
        }
      }
      return true;
    };

    // Find a valid tile near (tx, tz) that keeps a 1-tile gap to all others.
    // Simple outward search; prefers the requested tile.
    const findGappedTile = (tx, tz, maxRadius = 6) => {
      if (inBounds(tx, tz) && neighborhoodClear(tx, tz)) return { x: tx, z: tz };
      for (let r = 1; r <= maxRadius; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            // Only test the ring (Chebyshev distance == r) to spiral out
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const nx = tx + dx, nz = tz + dz;
            if (!inBounds(nx, nz)) continue;
            if (!neighborhoodClear(nx, nz)) continue;
            return { x: nx, z: nz };
          }
        }
      }
      return null;
    };

    let spawnCount = 0;

    for (const tileKey in STATIC_OBJECTS) {
      if (!Object.prototype.hasOwnProperty.call(STATIC_OBJECTS, tileKey)) continue;

      const [txStr, tzStr] = tileKey.split(',');
      const tx = Number(txStr);
      const tz = Number(tzStr);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) continue;

      const list = STATIC_OBJECTS[tileKey];
      if (!Array.isArray(list) || list.length === 0) continue;

      for (let i = 0; i < list.length; i++) {
        const spec = list[i] || {};
        const proto = await getPrototype(spec.type);
        if (!proto) continue;

        // Enforce 1-tile gap around each rock
        const spot = findGappedTile(tx, tz);
        if (!spot) {
          Debugger.warn(`No gapped spot found near ${tx},${tz} for ${spec.type}; skipping.`);
          continue;
        }

        const inst = proto.clone(true);
        inst.name = `${spec.type}-${spot.x}-${spot.z}-${i}`;

        // Place at tile center; preserve baked Y from the model
        const worldX = (spot.x + 0.5) * TILE_SIZE;
        const worldZ = (spot.z + 0.5) * TILE_SIZE;
        inst.position.set(worldX, inst.position.y, worldZ);

        if (typeof spec.yaw === 'number') inst.rotation.y += spec.yaw;

        rootGroup.add(inst);
        spawnCount++;

        // Mark only the rock tile as non-walkable; neighbors remain walkable
        if (grid) grid.setWalkable(spot.x, spot.z, false);

        // Remember this tile as blocked so subsequent placements respect the moat
        blocked.add(key(spot.x, spot.z));
      }
    }

    Debugger.log(`Static objects spawned with spacing: ${spawnCount}`, rootGroup);
  }
}