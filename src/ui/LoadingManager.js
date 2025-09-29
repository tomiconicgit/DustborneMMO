// file: src/ui/LoadingManager.js
import Debugger from '../debugger.js';
import Viewport from '../engine/core/Viewport.js';

export default class LoadingManager {
  constructor() {
    this.hasFailed = false;
    this.loadedModules = new Map();
    this.engineInstance = null;

    try {
      this._buildOverlayDOM();     // Build launcher + loading screens
      this._cacheDOMElements();    // Grab references
      Debugger.log('Loading Manager initialized (launcher style).');
    } catch (err) {
      this.hasFailed = true;
      Debugger.error('Failed to build launcher/loading UI.', err);
      document.body.innerHTML = `<div style="color: #f66; font-family: sans-serif; padding: 2em;">Critical Error: UI failed to build. See console.</div>`;
    }
  }

  /**
   * Starts the launcher flow. We render the launcher first.
   * When "Start Game" is clicked, we begin actual module loading + init.
   */
  async start(engineInstance) {
    if (this.hasFailed) return;
    this.engineInstance = engineInstance;

    // Show launcher screen initially
    this._show(this.launcherScreen);
    this._hide(this.loadingScreen);

    // Wire actions
    this.startGameBtn.addEventListener('click', () => {
      // Flip to loading UI and begin the real boot
      this._hide(this.launcherScreen);
      this._show(this.loadingScreen);
      this._beginBoot();
    });

    // Optional: other buttons are placeholders to match exact layout
    this.optionsBtn?.addEventListener('click', () => {
      Debugger.log('Options clicked (placeholder).');
    });
    this.exitBtn?.addEventListener('click', () => {
      Debugger.log('Exit clicked (placeholder).');
    });
  }

  async _beginBoot() {
    if (this.hasFailed) return;

    const manifest = this.engineInstance?.getManifest?.();
    if (!manifest || manifest.length === 0) {
      return this.fail(new Error('Manifest is empty or invalid.'));
    }

    // Phase 1: Fetch all modules
    this._setStatus('Initializing game engine...');
    this._setProgress(0);

    for (let i = 0; i < manifest.length; i++) {
      const task = manifest[i];
      const progress = ((i + 1) / manifest.length) * 45; // first half
      this._setStatus(`Loading: ${task.name}`);
      this._setProgress(progress);
      try {
        const mod = await import(task.path);
        this.loadedModules.set(task.path, mod);
      } catch (err) {
        return this.fail(err, task);
      }
    }

    // Phase 2: Initialize in order
    for (let i = 0; i < manifest.length; i++) {
      const task = manifest[i];
      const progress = 45 + ((i + 1) / manifest.length) * 55; // 45..100
      this._setStatus(`Initializing: ${task.name}`);
      this._setProgress(progress);

      const module = this.loadedModules.get(task.path);
      if (!module) {
        return this.fail(new Error(`Module not found for ${task.name}`), task);
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

    // Done
    this._setStatus('Finalizing...');
    this._setProgress(100);

    // Ensure the render loop is running after everything is ready
    try {
      Viewport.instance?.beginRenderLoop?.();
    } catch (e) {
      // If beginRenderLoop not yet set up, ignore.
    }

    // Fade out the overlay so the game is visible
    requestAnimationFrame(() => {
      this.root.classList.add('fade-out');
      setTimeout(() => {
        this.root.remove();
      }, 650);
    });
  }

  fail(error, task = {}) {
    if (this.hasFailed) return;
    this.hasFailed = true;

    const taskName = task.name || 'Unnamed Task';
    const taskModule = task.module || task.path || 'Unknown';
    const msg = `Failed during [${taskName}]: ${error.message}`;

    Debugger.error(msg, error.stack);

    // Keep the loading UI visible, show error details
    this._show(this.loadingScreen);
    this._setStatus('Fatal Error');
    this._setProgress(100);
    this.progressBar.style.background =
      'linear-gradient(90deg, rgba(220,38,38,1) 0%, rgba(239,68,68,1) 100%)';

    // Render a simple error block under the loading UI
    if (!this.errorBlock) {
      this.errorBlock = document.createElement('div');
      this.errorBlock.className =
        'mt-6 text-left text-sm glass-panel p-4 rounded-md';
      this.loadingScreen.appendChild(this.errorBlock);
    }
    this.errorBlock.innerHTML = `
      <h2 class="text-red-400 font-bold mb-2">Error Details</h2>
      <p><strong>Message:</strong> ${error.message}</p>
      <p><strong>Module:</strong> ${taskModule} (${taskName})</p>
      <pre class="mt-2 whitespace-pre-wrap opacity-80">${error.stack || 'No stack trace'}</pre>
    `;
  }

  // --- DOM helpers -----------------------------------------------------

  _setStatus(text) {
    if (this.loadingStatus) this.loadingStatus.textContent = text;
  }
  _setProgress(value) {
    const pct = Math.max(0, Math.min(100, Math.floor(value)));
    this.progressBar.style.width = `${pct}%`;
    if (this.progressPct) this.progressPct.textContent = `${pct}%`;
  }

  _show(el) { el?.classList.remove('hidden'); }
  _hide(el) { el?.classList.add('hidden'); }

  _cacheDOMElements() {
    this.root           = document.getElementById('dustborne-launcher-root');
    this.launcherScreen = document.getElementById('launcherScreen');
    this.loadingScreen  = document.getElementById('loadingScreen');

    this.startGameBtn   = document.getElementById('startGameBtn');
    this.optionsBtn     = document.getElementById('optionsBtn');
    this.exitBtn        = document.getElementById('exitBtn');

    this.progressBar    = document.getElementById('progressBar');
    this.loadingStatus  = document.getElementById('loadingStatus');
    this.progressPct    = document.getElementById('progressPercentage');
  }

  /**
   * Builds the exact launcher/loading markup you provided,
   * wrapped in a single fixed overlay root so it sits above the canvas.
   */
  _buildOverlayDOM() {
    const html = `
      <div id="dustborne-launcher-root" class="min-h-screen flex items-center justify-center overflow-hidden">
        <!-- Launcher/Main Menu Screen -->
        <div id="launcherScreen" class="w-full max-w-lg p-8 rounded-lg shadow-2xl glass-panel">
          <h1 class="text-5xl font-black text-center text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-2">PROJECT: ODYSSEY</h1>
          <p class="text-center text-indigo-300 mb-8">Main Menu</p>
          <div class="flex flex-col space-y-4">
            <button id="startGameBtn" class="w-full py-3 rounded-md btn-launcher">Start Game</button>
            <button id="optionsBtn" class="w-full py-3 rounded-md btn-launcher">Options</button>
            <button id="exitBtn" class="w-full py-3 rounded-md btn-launcher">Exit</button>
          </div>
        </div>

        <!-- Loading Screen -->
        <div id="loadingScreen" class="hidden w-full max-w-xl text-center">
          <h2 class="text-3xl font-bold text-white mb-4">LOADING...</h2>
          <p id="loadingStatus" class="text-purple-300 mb-6">Initializing game engine...</p>
          <div class="progress-bar-container w-full h-6 rounded-full overflow-hidden">
            <div id="progressBar" class="progress-bar-fill h-full rounded-full" style="width: 0%;"></div>
          </div>
          <p id="progressPercentage" class="mt-3 text-lg font-semibold">0%</p>
        </div>

        <!-- Version tag (exact) -->
        <div id="version-tag">v0.1.0-alpha</div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }
}