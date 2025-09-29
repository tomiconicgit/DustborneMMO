// file: src/ui/LoadingManager.js
import Viewport from '../engine/core/Viewport.js';
import Debugger from '../debugger.js';

export default class LoadingManager {
    constructor() {
        this.hasFailed = false;
        this.loadedModules = new Map();
        
        try {
            this._createDOM();
            this._cacheDOMElements();
            Debugger.log('Loading Manager initialized.');
        } catch (err) {
            this.hasFailed = true;
            Debugger.error('Failed to create or cache loading screen DOM.', err);
            document.body.innerHTML = `<div style="color: red; font-family: sans-serif; padding: 2em;">Critical Error: Loading UI failed to build. Check the console.</div>`;
        }
    }

    async start(engineInstance) {
        if (this.hasFailed) return;

        const manifest = engineInstance.getManifest();
        if (!manifest || manifest.length === 0) {
            return this.fail(new Error('Manifest is empty or invalid.'));
        }

        // Phase 1: Load all module files
        this._updateProgress('Loading assets...', 0);
        for (let i = 0; i < manifest.length; i++) {
            const task = manifest[i];
            const progress = ((i + 1) / manifest.length) * 50;
            this._updateProgress(`Loading: ${task.name}`, progress);
            try {
                const mod = await import(task.path);
                this.loadedModules.set(task.path, mod);
            } catch (err) {
                return this.fail(err, task);
            }
            await new Promise(resolve => setTimeout(resolve, 200)); // Slight delay for visibility
        }
        
        // Phase 2: Initialize modules in order
        this._updateProgress('Initializing systems...', 50);
        for (let i = 0; i < manifest.length; i++) {
            const task = manifest[i];
            const progress = 50 + ((i + 1) / manifest.length) * 50;
            this._updateProgress(`Initializing: ${task.name}`, progress);
            
            const module = this.loadedModules.get(task.path);
            if (!module) {
                return this.fail(new Error(`Module not found for ${task.name}`));
            }

            const ModuleClass = module.default;
            if (ModuleClass && typeof ModuleClass.create === 'function') {
                try {
                    await ModuleClass.create();
                } catch (err) {
                    return this.fail(err, task);
                }
            } else {
                Debugger.log(`Skipping initialization for ${task.name} (no create method)`);
            }
            await new Promise(resolve => setTimeout(resolve, 200)); // Slight delay for visibility
        }

        this._updateProgress('Ready', 100, true);
        this._showStartButton();
    }

    _showStartButton() {
        if (this.hasFailed) return;
        this.startButton.disabled = false;
        this.startButton.style.backgroundColor = '#d2a679'; // Active color
        this.startButton.style.color = '#fff';
    }

    fail(error, task = {}) {
        if (this.hasFailed) return;
        this.hasFailed = true;
        const taskName = task.name || 'Unnamed Task';
        const taskModule = task.module || task.path || 'Unknown';
        const errorMessage = `Failed during [${taskName}]: ${error.message}`;
        
        Debugger.error(errorMessage, error.stack);
        
        if (this.statusElement) {
            this.statusElement.textContent = 'Fatal Error';
            this.progressBar.style.width = '100%';
            this.progressBar.style.backgroundColor = '#c94a4a';
            this.percentEl.textContent = 'FAIL';
        }

        if (this.errorDetails) {
            this.errorDetails.style.display = 'block';
            this.errorDetails.innerHTML = `
                <h2>Error Details:</h2>
                <p><strong>Error Message:</strong> ${error.message}</p>
                <p><strong>Affected File/Module:</strong> ${taskModule} (${taskName})</p>
                <p><strong>Possible Cause:</strong> This could be due to a module import failure, missing export, network issue loading a file, or runtime error in initialization. Check if paths are correct, dependencies exist, and no syntax errors in the file.</p>
                <p><strong>Stack Trace:</strong><pre>${error.stack || 'No stack trace available'}</pre></p>
                <p><strong>Helpful Tips:</strong> Open browser console (F12) for full logs. Check Network tab for failed requests. Verify import paths in Router.js. Ensure Three.js CDN is accessible. Restart server or clear cache if needed.</p>
            `;
        }
    }

    _updateProgress(message, progress, isComplete = false) {
        if (this.hasFailed) return;
        this.statusElement.textContent = message;
        const pct = Math.floor(Math.min(100, progress));
        this.progressBar.style.width = `${pct}%`;
        this.percentEl.textContent = `${pct}%`;
        if (isComplete) {
            this.progressBar.style.backgroundColor = '#64b964';
        }
    }

    _cacheDOMElements() {
        this.loadingScreen = document.getElementById('game-loading-screen');
        this.progressBar = document.getElementById('game-loading-bar-fill');
        this.percentEl = document.getElementById('game-loading-percent');
        this.statusElement = document.getElementById('game-loading-status');
        this.startButton = document.getElementById('game-start-button');
        this.errorDetails = document.getElementById('error-details');
    }

    _createDOM() {
        const style = `
            #game-loading-screen { position: fixed; inset: 0; background: linear-gradient(to bottom, #f4a460, #c2b280); z-index: 1000; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: #fff; transition: opacity 1s ease; }
            #game-loading-screen.fade-out { opacity: 0; pointer-events: none; }
            #game-loading-content { width: 90%; max-width: 400px; text-align: center; position: relative; top: -5%; } /* Tad above center */
            h1 { font-family: 'Cinzel', serif; font-size: 3em; color: #fff; text-shadow: 0 0 10px rgba(0,0,0,0.3); margin-bottom: 0.5em; }
            #game-loading-bar-container { width: 100%; height: 8px; background-color: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden; margin: 1em 0; position: relative; }
            #game-loading-bar-fill { height: 100%; background-color: #fff; transition: width 0.3s ease, background-color 0.3s ease; }
            #game-loading-percent { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 0px; color: #333; } /* Hidden, but if needed visible inside */
            #game-loading-status { margin-bottom: 1em; font-size: 1em; color: #fff; text-shadow: 0 0 5px rgba(0,0,0,0.2); }
            #game-start-button { padding: 10px 20px; font-size: 1.2em; background-color: #a08d6e; color: #ddd; border: none; border-radius: 5px; cursor: not-allowed; opacity: 0.6; }
            #game-start-button:disabled { background-color: #a08d6e; opacity: 0.6; cursor: not-allowed; }
            #error-details { display: none; margin-top: 2em; text-align: left; background: rgba(0,0,0,0.5); padding: 1em; border-radius: 5px; color: #fff; max-height: 300px; overflow: auto; }
            #error-details pre { white-space: pre-wrap; word-wrap: break-word; }
        `;
        document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
        
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="game-loading-screen">
                <div id="game-loading-content">
                    <h1>Duneborne</h1>
                    <div id="game-loading-bar-container">
                        <div id="game-loading-bar-fill"></div>
                        <span id="game-loading-percent">0%</span>
                    </div>
                    <p id="game-loading-status">Initializing...</p>
                    <button id="game-start-button" disabled>Start</button>
                    <div id="error-details"></div>
                </div>
            </div>
        `);
    }
}