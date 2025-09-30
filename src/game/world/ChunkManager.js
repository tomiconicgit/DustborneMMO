// file: src/game/world/ChunkManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
import { STATIC_OBJECTS, NON_WALKABLE_TILES } from './StaticObjectMap.js';
import { TILE_SIZE, WORLD_WIDTH, WORLD_DEPTH } from './WorldMap.js';
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

    Debugger.log('Building world...');
    const ground = TerrainGenerator.create();
    scene.add(ground);

    // make sure the shared pathfinding grid exists
    Pathfinding.create?.();

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

      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

      protoCache.set(type, root);
      return root;
    };

    const rootGroup = new THREE.Group();
    rootGroup.name = 'StaticObjects';
    scene.add(rootGroup);

    const pf = Pathfinding.main || null;

    // ----- place all configured static objects -----
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

        const worldX = (tx + 0.5) * TILE_SIZE;
        const worldZ = (tz + 0.5) * TILE_SIZE;
        inst.position.set(worldX, inst.position.y, worldZ);

        if (typeof spec.yaw === 'number') inst.rotation.y += spec.yaw;

        rootGroup.add(inst);

        // mark the tile as blocked for pathfinding
        if (pf?.grid) pf.grid.setWalkable(tx, tz, false);

        if (type === 'copper-ore') {
          const ore = CopperOre.createFromMesh(inst, tx, tz);
          inst.traverse((o) => { o.userData = o.userData || {}; o.userData.ore = ore; });
        }
      }
    }

    // ----- apply your NON_WALKABLE_TILES list -----
    if (pf?.grid && Array.isArray(NON_WALKABLE_TILES)) {
      for (let i = 0; i < NON_WALKABLE_TILES.length; i++) {
        const pair = NON_WALKABLE_TILES[i];
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const x = pair[0] | 0;
        const z = pair[1] | 0;
        if (x < 0 || z < 0 || x >= WORLD_WIDTH || z >= WORLD_DEPTH) continue;
        pf.grid.setWalkable(x, z, false);
      }
    }

    Debugger.log('Static objects & non-walkables applied.', rootGroup);
  }
}