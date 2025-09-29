// file: src/game/world/ChunkManager.js
import Scene from '../../engine/core/Scene.js';
import TerrainGenerator from './TerrainGenerator.js';
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
            throw new Error("ChunkManager is a singleton.");
        }
        
        const scene = Scene.main;
        if (!scene) {
            Debugger.error("ChunkManager created before Scene was initialized.");
            return;
        }

        Debugger.log("Building world...");
        const ground = TerrainGenerator.create();
        scene.add(ground);
        Debugger.log("World build complete.");
    }
}
