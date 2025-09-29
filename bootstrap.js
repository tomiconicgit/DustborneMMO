// file: bootstrap.js
import paths from './src/router.js';
import LoadingManager from './src/ui/LoadingManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Instantiate the LoadingManager AFTER the DOM is ready.
  const loadingManager = new LoadingManager();

  try {
    // --- Preflight check ---
    // Ensures Safari/iOS actually resolves the import map for 'three'.
    // If this fails, the error will show clearly in the loader.
    await import('three');

    // Now load the engine setup
    const { default: EngineSetup } = await import(paths.engineSetup);
    const gameEngine = new EngineSetup();
    loadingManager.start(gameEngine);
  } catch (err) {
    loadingManager.reportBootError(err, { module: 'bootstrap preflight' });
  }
});