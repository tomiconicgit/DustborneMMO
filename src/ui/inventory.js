// file: src/ui/inventory.js
// Inventory UI with icon + quantity helpers.
// Also auto-adds the procedural copper icon to slot 0 when it's generated.

export default class InventoryUI {
  static instance = null;

  static create() {
    if (!InventoryUI.instance) InventoryUI.instance = new InventoryUI();
  }

  constructor() {
    this.isOpen = false;
    this._injectStyles();
    this._buildDOM();
    this._wireEvents();

    // Listen for the generated copper icon and show it in slot 0 as default
    window.addEventListener('icon:copper-ready', (e) => {
      const dataURL = e?.detail?.dataURL;
      if (dataURL) this.setSlotIcon(0, dataURL);
    });

    // Expose for other modules
    InventoryUI.instance = this;
  }

  _injectStyles() {
    const css = `
      :root {
        --inv-z: 900;
        --inv-gap: 10px;
        --inv-slot-min: 64px;
        --inv-bg: rgba(15,15,18,0.55);
        --inv-border: rgba(255,255,255,0.08);
        --inv-shadow: 0 10px 30px rgba(0,0,0,0.45);
        --inv-radius: 14px;
        --button-size: 56px;
      }
      .inv-btn {
        position: fixed;
        top: 50%;
        left: calc(env(safe-area-inset-left, 0px) + 12px);
        transform: translateY(-50%);
        width: var(--button-size);
        height: var(--button-size);
        border-radius: 9999px;
        z-index: var(--inv-z);
        display: grid; place-items: center;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .15s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
        backdrop-filter: blur(6px);
      }
      .inv-btn:hover { transform: translateY(-50%) scale(1.03); background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.26); box-shadow: 0 6px 20px rgba(0,0,0,0.42); }
      .inv-btn:active { transform: translateY(-50%) scale(0.98); }
      .inv-btn svg { width: 26px; height: 26px; opacity: 0.92; }

      .inv-sheet {
        position: fixed;
        left: 50%; bottom: 0;
        transform: translate(-50%, 110%);
        width: min(94vw, 880px);
        z-index: var(--inv-z);
        background: var(--inv-bg);
        border: 1px solid var(--inv-border);
        border-bottom: none;
        border-radius: var(--inv-radius) var(--inv-radius) 0 0;
        box-shadow: var(--inv-shadow);
        backdrop-filter: blur(10px);
        transition: transform .28s ease;
        will-change: transform;
      }
      .inv-sheet.open { transform: translate(-50%, 0%); }

      .inv-sheet__head { display: flex; align-items: center; justify-content: center; padding: 8px 12px 4px; }
      .inv-sheet__grab { width: 44px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.25); }

      .inv-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: var(--inv-gap); padding: 12px; padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); }
      .inv-slot { position: relative; min-height: var(--inv-slot-min); border-radius: 10px; display: grid; place-items: center; overflow: visible; }
      .inv-slot img { display: block; max-width: 80%; max-height: 80%; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35)); pointer-events: none; }
      .inv-qty { position: absolute; right: 4px; bottom: 4px; min-width: 20px; padding: 2px 6px; font-size: 12px; font-weight: 700; text-align: center; color: #111; background: rgba(255,255,255,0.9); border-radius: 10px; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 2px 6px rgba(0,0,0,0.25); }

      @media (pointer: coarse) {
        .inv-btn { width: 64px; height: 64px; }
        .inv-btn svg { width: 28px; height: 28px; }
        .inv-slot { min-height: 72px; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'inventory-ui-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  _buildDOM() {
    this.button = document.createElement('button');
    this.button.className = 'inv-btn';
    this.button.setAttribute('aria-label', 'Open inventory');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="white" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round" />
        <rect x="3.8" y="9" width="16.4" height="12.2" rx="2.4" stroke="white" stroke-opacity=".9" stroke-width="1.6" />
        <path d="M9 13h6" stroke="white" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    `;

    this.sheet = document.createElement('section');
    this.sheet.className = 'inv-sheet';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'false');
    this.sheet.setAttribute('aria-label', 'Inventory');

    const head = document.createElement('div');
    head.className = 'inv-sheet__head';
    head.innerHTML = `<div class="inv-sheet__grab"></div>`;

    this.grid = document.createElement('div');
    this.grid.className = 'inv-grid';
    for (let i = 0; i < 15; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.index = String(i);

      const qty = document.createElement('div');
      qty.className = 'inv-qty';
      qty.textContent = '';
      qty.style.display = 'none';
      slot.appendChild(qty);

      this.grid.appendChild(slot);
    }

    this.sheet.appendChild(head);
    this.sheet.appendChild(this.grid);

    document.body.appendChild(this.button);
    document.body.appendChild(this.sheet);
  }

  _wireEvents() {
    this.button.addEventListener('click', () => this.toggle());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    let startY = null;
    const head = this.sheet.querySelector('.inv-sheet__head');
    head.addEventListener('pointerdown', (e) => { startY = e.clientY; });
    head.addEventListener('pointerup', (e) => {
      if (startY == null) return;
      const dy = e.clientY - startY;
      startY = null;
      if (dy > 28) this.close();
    });
  }

  open()  { this.isOpen = true;  this.sheet.classList.add('open');  this.button.setAttribute('aria-expanded', 'true'); }
  close() { this.isOpen = false; this.sheet.classList.remove('open'); this.button.setAttribute('aria-expanded', 'false'); }
  toggle(){ this.isOpen ? this.close() : this.open(); }

  /** Set/replace an icon image for a slot (0..14). */
  setSlotIcon(index, dataURL) {
    const slot = this.grid.querySelector(`.inv-slot[data-index="${index}"]`);
    if (!slot) return;
    let img = slot.querySelector('img');
    if (!img) { img = document.createElement('img'); slot.appendChild(img); }
    img.src = dataURL;
    img.alt = 'Item';
  }

  /** Set a numeric quantity badge for a slot; hide when <= 0 or null. */
  setSlotQty(index, qty) {
    const slot = this.grid.querySelector(`.inv-slot[data-index="${index}"]`);
    if (!slot) return;
    const badge = slot.querySelector('.inv-qty');
    if (!badge) return;
    if (qty == null || qty <= 0) {
      badge.style.display = 'none';
      badge.textContent = '';
    } else {
      badge.style.display = 'block';
      badge.textContent = String(qty);
    }
  }
}