// file: src/game/EngineSetup.js
import paths from '../Router.js';

export default class EngineSetup {
  getManifest() {
    return [
      // Core Engine - Order matters
      { name: 'Scene',            path: paths.scene },
      { name: 'Camera',           path: paths.camera },
      { name: 'Viewport',         path: paths.viewport },
      { name: 'Lighting',         path: paths.lighting },
      { name: 'Sky',              path: paths.sky },
      { name: 'SoundManager',     path: paths.soundManager },

      // World
      { name: 'WorldMap',         path: paths.worldMap },
      { name: 'TerrainGenerator', path: paths.terrainGenerator },
      { name: 'StaticObjectMap',  path: paths.staticObjectMap },
      { name: 'ChunkManager',     path: paths.chunkManager },

      // Player
      { name: 'Character',        path: paths.character },

      // Dev tools (optional overlay)
      { name: 'GridToggle',       path: paths.devGrid },
    ];
  }
}