// file: src/ui/LoadingManager.js
import Viewport from '../engine/core/Viewport.js';
import Debugger from '../debugger.js';

export default class LoadingManager {
    constructor() {
        this.hasFailed = false;
        this.loadedModules = new Map();
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
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
        await this._appendTerminalLine('Loading assets...');
        for (let i = 0; i < manifest.length; i++) {
            const task = manifest[i];
            await this._appendTerminalLine(`Loading: ${task.name}`);
            try {
                const mod = await import(task.path);
                this.loadedModules.set(task.path, mod);
            } catch (err) {
                return this.fail(err, task);
            }
        }
        
        // Phase 2: Initialize modules in order
        await this._appendTerminalLine('Initializing systems...');
        for (let i = 0; i < manifest.length; i++) {
            const task = manifest[i];
            await this._appendTerminalLine(`Initializing: ${task.name}`);
            
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
        }

        await this._appendTerminalLine('Ready');
        this._showStartButton();
    }

    async _appendTerminalLine(message) {
        if (this.hasFailed) return;
        const line = document.createElement('p');
        line.className = 'terminal-line';
        line.textContent = message;
        this.terminalOutput.appendChild(line);
        this._playBeep();
        // Trigger typing animation (CSS handles it)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay for typing
    }

    _playBeep() {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
        oscillator.connect(this.audioContext.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 100);
    }

    _showStartButton() {
        if (this.hasFailed) return;
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
        const taskModule = task.module || task.path || 'Unknown';
        const errorMessage = `Failed during [${taskName}]: ${error.message}`;
        
        Debugger.error(errorMessage, error.stack);
        
        const errorLine = document.createElement('p');
        errorLine.className = 'terminal-line error';
        errorLine.textContent = 'Fatal Error: ' + errorMessage;
        this.terminalOutput.appendChild(errorLine);

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

    _cacheDOMElements() {
        this.loadingScreen = document.getElementById('game-loading-screen');
        this.terminalOutput = document.getElementById('terminal-output');
        this.startButton = document.getElementById('game-start-button');
        this.errorDetails = document.getElementById('error-details');
    }

    _createDOM() {
        const style = `
            #game-loading-screen { position: fixed; inset: 0; background-color: #000; z-index: 1000; display: flex; align-items: center; justify-content: center; font-family: 'VT323', monospace; color: #0f0; transition: opacity 1s ease; }
            #game-loading-screen.fade-out { opacity: 0; pointer-events: none; }
            #game-loading-content { width: 90%; max-width: 800px; height: 90%; position: relative; border: 2px solid #0f0; padding: 1em; box-shadow: 0 0 10px #0f0; }
            h1 { color: #0f0; text-align: center; animation: flicker 0.15s infinite; }
            #terminal-output { height: 70%; overflow-y: auto; }
            .terminal-line { margin: 0; white-space: pre; animation: typing 1s steps(40, end), blink-caret 0.75s step-end infinite; overflow: hidden; border-right: .15em solid #0f0; }
            .terminal-line.error { color: #f00; }
            @keyframes typing { from { width: 0; } to { width: 100%; } }
            @keyframes blink-caret { from, to { border-color: transparent; } 50% { border-color: #0f0; } }
            @keyframes flicker { 50% { opacity: 0.5; } }
            .scanline { width: 100%; height: 2px; background: rgba(255,255,255,0.2); position: absolute; top: 0; animation: scanline 6s linear infinite; }
            @keyframes scanline { 0% { top: -2px; } 100% { top: 100%; } }
            #game-start-button { padding: 10px 20px; font-size: 24px; background-color: #000; color: #0f0; border: 1px solid #0f0; cursor: pointer; display: block; margin: 1em auto; }
            #game-start-button:disabled { color: #333; border-color: #333; cursor: not-allowed; }
            #error-details { display: none; margin-top: 2em; text-align: left; background: #111; padding: 1em; border: 1px solid #f00; color: #f00; max-height: 200px; overflow: auto; }
        `;
        document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
        
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="game-loading-screen">
                <div id="game-loading-content">
                    <h1>Duneborne</h1>
                    <div class="scanline"></div>
                    <div id="terminal-output"></div>
                    <button id="game-start-button" disabled>Start</button>
                    <div id="error-details"></div>
                </div>
            </div>
        `);
    }
}