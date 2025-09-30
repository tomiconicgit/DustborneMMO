// file: src/game/EngineSetup.js
import paths from '../Router.js';

export default class EngineSetup {
  getManifest() {
    return [
      // Engine base
      { name: 'Scene',                path: paths.scene },
      { name: 'Camera',               path: paths.camera },
      { name: 'Viewport',             path: paths.viewport },
      { name: 'Lighting',             path: paths.lighting },
      { name: 'Sky',                  path: paths.sky },

      // Input/core utils
      { name: 'UpdateBus',            path: paths.updateBus },
      { name: 'GroundPicker',         path: paths.groundPicker },
      { name: 'CameraTouchControls',  path: paths.cameraControls },
      { name: 'VirtualJoystick',      path: paths.virtualJoystick },

      // World
      { name: 'WorldMap',             path: paths.worldMap },
      { name: 'TerrainGenerator',     path: paths.terrainGenerator },
      { name: 'StaticObjectMap',      path: paths.staticObjectMap },
      { name: 'ChunkManager',         path: paths.chunkManager },

      // Player + anim
      { name: 'Character',            path: paths.character },
      { name: 'CharacterAnimator',    path: paths.characterAnimator },

      // Navigation + movement
      { name: 'Pathfinding',          path: paths.pathfinding },
      { name: 'Movement',             path: paths.movement },

      // Dev tools / audio
      { name: 'GridToggle',           path: paths.devGrid },
      { name: 'SoundManager',         path: paths.soundManager },
    ];
  }
}