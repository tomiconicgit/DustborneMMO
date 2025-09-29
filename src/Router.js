// file: src/Router.js
// CORRECTED: Removed the extra '/src' prefix from paths.
const mod = (path) => `./${path}`;

const paths = {
    // Engine
    scene: mod('engine/core/Scene.js'),
    viewport: mod('engine/core/Viewport.js'),
    soundManager: mod('engine/audio/SoundManager.js'),
    camera: mod('engine/rendering/Camera.js'),
    // CORRECTED: Changed 'lighting.js' to 'Lighting.js' to match filename
    lighting: mod('engine/rendering/Lighting.js'), 
    sky: mod('engine/rendering/Sky.js'),
    
    // Game
    engineSetup: mod('game/EngineSetup.js'),
    worldMap: mod('game/world/WorldMap.js'),
    terrainGenerator: mod('game/world/TerrainGenerator.js'),
    staticObjectMap: mod('game/world/StaticObjectMap.js'),
    chunkManager: mod('game/world/ChunkManager.js'),
};

export default paths;
