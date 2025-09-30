// file: src/Router.js
const mod = (pathFromSrc) => new URL(pathFromSrc, import.meta.url).href;

const paths = {
  // Engine core
  scene:            mod('engine/core/Scene.js'),
  viewport:         mod('engine/core/Viewport.js'),
  updateBus:        mod('engine/core/UpdateBus.js'),

  // Rendering
  camera:           mod('engine/rendering/Camera.js'),
  lighting:         mod('engine/rendering/Lighting.js'),
  sky:              mod('engine/rendering/Sky.js'),

  // Input (tap-to-move + orbit/pinch)
  groundPicker:     mod('engine/input/GroundPicker.js'),
  cameraControls:   mod('engine/input/CameraTouchControls.js'),

  // Game world
  worldMap:         mod('game/world/WorldMap.js'),
  terrainGenerator: mod('game/world/TerrainGenerator.js'),
  staticObjectMap:  mod('game/world/StaticObjectMap.js'),
  chunkManager:     mod('game/world/ChunkManager.js'),

  // Character + animation
  character:        mod('game/character/Character.js'),
  characterAnimator:mod('game/character/CharacterAnimator.js'),

  // Movement (tap-to-move) & pathfinding
  movement:         mod('game/character/Movement.js'),
  pathfinding:      mod('engine/lib/Pathfinding.js'),

  // Audio & Dev
  soundManager:     mod('engine/audio/SoundManager.js'),
  devGrid:          mod('game/dev/GridToggle.js'),

  // UI
  inventoryUI:      mod('ui/inventory.js'),

  // NEW: procedural inventory icons
  itemIcons:        mod('ui/ItemIcons.js'),
};

export default paths;