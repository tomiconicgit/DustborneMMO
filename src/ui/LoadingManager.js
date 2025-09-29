// file: src/ui/LoadingManager.js
import Viewport from '../engine/core/Viewport.js';
import Debugger from '../debugger.js';

export default class LoadingManager {
    constructor() {
        this.hasFailed = false;
        this.loadedModules = new Map();
        this._createDOM();
        this._cacheDOMElements();
        Debugger.log('Loading Manager initialized.');
    }

    async start(engineInstance) {
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
        }
        
        // Phase 2: Initialize modules in order
        this._updateProgress('Initializing systems...', 50);
        for (let i = 0; i < manifest.length; i++) {
            const task = manifest[i];
            const progress = 50 + ((i + 1) / manifest.length) * 50;
            this._updateProgress(`Initializing: ${task.name}`, progress);
            
            const module = this.loadedModules.get(task.path);
            if (!module || !module.default) {
                return this.fail(new Error(`Module not found or has no default export for ${task.name}`));
            }

            const ModuleClass = module.default;
            if (typeof ModuleClass.create === 'function') {
                try {
                    await ModuleClass.create();
                } catch (err) {
                    return this.fail(err, task);
                }
            }
        }

        this._updateProgress('Ready', 100, true);
        this._showStartButton();
    }

    _showStartButton() {
        this.startButton.disabled = false;
        this.startButton.addEventListener('click', () => {
            Viewport.instance?.beginRenderLoop();
            this.loadingScreen.classList.add('fade-out');
            setTimeout(() => this.loadingScreen.remove(), 1000);
        }, { once: true });
    }

    fail(error, task = {}) {
        if (this.hasFailed) return;
        this.hasFailed = true;
        const taskName = task.name || 'Unnamed Task';
        const errorMessage = `Failed during [${taskName}]: ${error.message}`;
        
        Debugger.error(errorMessage, error.stack);
        
        this.statusElement.textContent = 'Fatal Error';
        this.progressBar.style.width = '100%';
        this.progressBar.style.backgroundColor = '#c94a4a';
        this.percentEl.textContent = 'FAIL';
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
    }

    _createDOM() {
        const style = `
            #game-loading-screen { position: fixed; inset: 0; background-color: #1a1612; z-index: 1000; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: #f5eeda; transition: opacity 1s ease; }
            #game-loading-screen.fade-out { opacity: 0; }
            #game-loading-content { width: 90%; max-width: 400px; text-align: center; }
            h1 { color: #e88b33; }
            #game-loading-bar { width: 100%; height: 8px; background-color: #333; border-radius: 4px; overflow: hidden; margin: 1em 0; }
            #game-loading-bar-fill { width: 0%; height: 100%; background-color: #e88b33; transition: width 0.3s ease, background-color 0.3s ease; }
            #game-loading-status { margin-bottom: 1.5em; height: 1.2em; }
            #game-start-button { padding: 10px 20px; font-size: 16px; background-color: #e88b33; color: #1a1612; border: none; border-radius: 5px; cursor: pointer; }
            #game-start-button:disabled { background-color: #555; cursor: not-allowed; }
        `;
        document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="game-loading-screen">
                <div id="game-loading-content">
                    <h1>Loading Game</h1>
                    <div id="game-loading-status-container">
                        <p id="game-loading-status">Initializing...</p>
                        <span id="game-loading-percent">0%</span>
                    </div>
                    <div id="game-loading-bar"><div id="game-loading-bar-fill"></div></div>
                    <button id="game-start-button" disabled>Start</button>
                </div>
            </div>
        `);
    }
}
