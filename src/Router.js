// file: src/Router.js
const mod = (p) => new URL(p, import.meta.url).href;

const paths = {
  // Engine
  scene:              mod('engine/core/Scene.js'),
  viewport:           mod('engine/core/Viewport.js'),
  soundManager:       mod('engine/audio/SoundManager.js'),
  camera:             mod('engine/rendering/Camera.js'),
  lighting:           mod('engine/rendering/Lighting.js'),
  sky:                mod('engine/rendering/Sky.js'),
  updateBus:          mod('engine/core/UpdateBus.js'),
  groundPicker:       mod('engine/input/GroundPicker.js'),
  cameraControls:     mod('engine/input/CameraTouchControls.js'),

  // Navigation / AI
  pathfinding:        mod('engine/lib/Pathfinding.js'),

  // Game
  engineSetup:        mod('game/EngineSetup.js'),
  worldMap:           mod('game/world/WorldMap.js'),
  terrainGenerator:   mod('game/world/TerrainGenerator.js'),
  staticObjectMap:    mod('game/world/StaticObjectMap.js'),
  chunkManager:       mod('game/world/ChunkManager.js'),

  // Character
  character:          mod('game/character/Character.js'),
  characterAnimator:  mod('game/character/CharacterAnimator.js'), // <-- NEW
  movement:           mod('game/character/Movement.js'),

  // Dev
  devGrid:            mod('game/dev/GridToggle.js'),
};

export default paths;