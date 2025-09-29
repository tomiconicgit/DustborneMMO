// file: src/Router.js
const mod = (pathFromSrc) => new URL(pathFromSrc, import.meta.url).href;

const paths = {
  // Engine
  scene:            mod('engine/core/Scene.js'),
  viewport:         mod('engine/core/Viewport.js'),
  soundManager:     mod('engine/audio/SoundManager.js'),
  camera:           mod('engine/rendering/Camera.js'),
  lighting:         mod('engine/rendering/Lighting.js'),
  sky:              mod('engine/rendering/Sky.js'),

  // Game
  engineSetup:      mod('game/EngineSetup.js'),
  worldMap:         mod('game/world/WorldMap.js'),
  terrainGenerator: mod('game/world/TerrainGenerator.js'),
  staticObjectMap:  mod('game/world/StaticObjectMap.js'),
  chunkManager:     mod('game/world/ChunkManager.js'),

  // Character
  character:        mod('game/character/Character.js'),
};

export default paths;