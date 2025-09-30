// file: src/engine/audio/SoundManager.js
// Tiny WebAudio loader/player with one shared AudioContext.
// Preloads a few SFX and exposes play('key').

export default class SoundManager {
  static main = null;

  static create() {
    if (!SoundManager.main) {
      SoundManager.main = new SoundManager();
    }
  }

  constructor() {
    // WebAudio context (created suspended; resume on first user interaction)
    this.ctx = null;
    this.buffers = new Map();
    this._unlocked = false;

    // Prepare early so decode can begin soon after boot
    this._ensureContext();
    this._installUnlockHandlers();

    // Preload our SFX
    this._preload('mining-hit', new URL('../../assets/sounds/mining-hit.wav', import.meta.url).href);
    this._preload('rock-deplete', new URL('../../assets/sounds/rock-deplete.wav', import.meta.url).href);
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      console.warn('[SoundManager] WebAudio not supported.');
      return null;
    }
    this.ctx = new AC();
    return this.ctx;
  }

  _installUnlockHandlers() {
    const unlock = () => {
      if (!this.ctx) return;
      if (this._unlocked) return;
      // resume context on any user gesture
      this.ctx.resume?.().then(() => { this._unlocked = true; }).catch(()=>{});
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('touchstart', unlock, { capture: true });
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  }

  async _preload(key, url) {
    try {
      const ctx = this._ensureContext();
      if (!ctx) return;
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.buffers.set(key, buf);
    } catch (err) {
      console.warn(`[SoundManager] Failed to load "${key}" from ${url}:`, err);
    }
  }

  /**
   * Play a preloaded sound at the given volume (0..1).
   */
  play(key, volume = 1.0) {
    const ctx = this._ensureContext();
    const buf = this.buffers.get(key);
    if (!ctx || !buf) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(gain);
    gain.connect(ctx.destination);

    try { src.start(); } catch { /* no-op */ }
  }
}