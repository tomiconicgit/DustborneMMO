// file: bootstrap.js
import LoadingManager from './src/ui/LoadingManager.js';
import EngineSetup from './src/game/EngineSetup.js';
import Debugger from './src/debugger.js';

document.addEventListener('DOMContentLoaded', () => {
    Debugger.init();
    const loadingManager = new LoadingManager();
    const gameEngine = new EngineSetup();
    
    try {
        loadingManager.start(gameEngine);
        Debugger.log('Bootstrap complete. Handing over to LoadingManager.');
    } catch (err) {
        loadingManager.fail(err, { module: 'bootstrap' });
        Debugger.error('A critical error occurred during bootstrap.', err);
    }
});
