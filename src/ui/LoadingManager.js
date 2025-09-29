// file: src/ui/LoadingManager.js
import Debugger from '../debugger.js';
import Viewport from '../engine/core/Viewport.js';

export default class LoadingManager {
  constructor() {
    this.hasFailed = false;
    this.loadedModules = new Map();
    this.engineInstance = null;

    try {
      this._buildOverlayDOM();
      this._cacheDOMElements();
      Debugger.log('Loading Manager initialized (launcher style).');
    } catch (err) {
      this.hasFailed = true;
      Debugger.error('Failed to build launcher/loading UI.', err);
      document.body.innerHTML =
        `<div style="color: #f66; font-family: sans-serif; padding: 2em;">
           Critical Error: UI failed to build. See console.
         </div>`;
    }
  }

  async start(engineInstance) {
    if (this.hasFailed) return;
    this.engineInstance = engineInstance;

    this._show(this.launcherScreen);
    this._hide(this.loadingScreen);

    this.startGameBtn.addEventListener('click', () => {
      this._hide(this.launcherScreen);
      this._show(this.loadingScreen);
      this._beginBoot();
    });

    this.accountBtn?.addEventListener('click', () => {
      Debugger.log('Account clicked (placeholder).');
    });
  }

  async _beginBoot() {
    if (this.hasFailed) return;

    const manifest = this.engineInstance?.getManifest?.();
    if (!manifest || manifest.length === 0) {
      return this.fail(new Error('Manifest is empty or invalid.'));
    }

    this._setStatus('Initializing game engine...');
    this._setProgress(0);

    // Phase 1: load modules
    for (let i = 0; i < manifest.length; i++) {
      const task = manifest[i];
      const progress = ((i + 1) / manifest.length) * 45;
      this._setStatus(`Loading: ${task.name}`);
      this._setProgress(progress);
      try {
        const mod = await import(task.path);
        this.loadedModules.set(task.path, mod);
      } catch (err) {
        return this.fail(err, task);
      }
    }

    // Phase 2: init
    for (let i = 0; i < manifest.length; i++) {
      const task = manifest[i];
      const progress = 45 + ((i + 1) / manifest.length) * 55;
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
        Debugger.log(
          `Skipping initialization for ${task.name} (no create method)`
        );
      }
    }

    this._setStatus('Finalizing...');
    this._setProgress(100);

    try {
      Viewport.instance?.beginRenderLoop?.();
    } catch (e) {}

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

    this._show(this.loadingScreen);
    this._setStatus('Fatal Error');
    this._setProgress(100);
    this.progressBar.style.background =
      'linear-gradient(90deg, rgba(220,38,38,1) 0%, rgba(239,68,68,1) 100%)';

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
    this.accountBtn     = document.getElementById('accountBtn');

    this.progressBar    = document.getElementById('progressBar');
    this.loadingStatus  = document.getElementById('loadingStatus');
    this.progressPct    = document.getElementById('progressPercentage');
  }

  _buildOverlayDOM() {
    const html = `
      <div id="dustborne-launcher-root" class="min-h-screen flex items-center justify-center overflow-hidden">
        <!-- Launcher/Main Menu Screen -->
        <div id="launcherScreen" class="w-full max-w-sm px-8 py-12 rounded-lg shadow-2xl glass-panel">
          <h1 class="text-5xl font-black text-center text-white mt-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-6">DUSTBORNE</h1>
          <div class="flex flex-col space-y-4">
            <button id="startGameBtn" class="w-full py-3 rounded-md btn-launcher">Start Game</button>
            <button id="accountBtn" class="w-full py-3 rounded-md btn-launcher">Account</button>
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

        <!-- Version tag -->
        <div id="version-tag">v0.1.0-alpha</div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }
}