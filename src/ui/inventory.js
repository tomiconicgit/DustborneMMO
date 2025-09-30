// file: src/ui/inventory.js
// Minimal floating Inventory UI (button + bottom sheet grid)
// - Circular button on the left edge with a bag icon
// - Bottom sheet slides up/down; 3 rows x 5 columns of "invisible" item slots

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
  }

  _injectStyles() {
    const css = `
      :root {
        --inv-z: 900;                 /* below launcher (1000), above canvas */
        --inv-gap: 10px;
        --inv-slot-min: 64px;         /* min height per slot */
        --inv-bg: rgba(15,15,18,0.55);
        --inv-border: rgba(255,255,255,0.08);
        --inv-shadow: 0 10px 30px rgba(0,0,0,0.45);
        --inv-radius: 14px;
        --button-size: 56px;
      }

      /* ------- Floating button ------- */
      .inv-btn {
        position: fixed;
        top: 50%;
        left: calc(env(safe-area-inset-left, 0px) + 12px);
        transform: translateY(-50%);
        width: var(--button-size);
        height: var(--button-size);
        border-radius: 9999px;
        z-index: var(--inv-z);
        display: grid;
        place-items: center;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .15s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
        backdrop-filter: blur(6px);
      }
      .inv-btn:hover {
        transform: translateY(-50%) scale(1.03);
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.26);
        box-shadow: 0 6px 20px rgba(0,0,0,0.42);
      }
      .inv-btn:active {
        transform: translateY(-50%) scale(0.98);
      }
      .inv-btn svg {
        width: 26px;
        height: 26px;
        opacity: 0.92;
      }

      /* ------- Bottom sheet panel ------- */
      .inv-sheet {
        position: fixed;
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 110%); /* hidden offscreen initially */
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
      .inv-sheet.open {
        transform: translate(-50%, 0%);
      }

      /* Grabber / header */
      .inv-sheet__head {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px 4px;
      }
      .inv-sheet__grab {
        width: 44px;
        height: 4px;
        border-radius: 999px;
        background: rgba(255,255,255,0.25);
      }

      /* Grid container */
      .inv-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        grid-auto-rows: 1fr;
        gap: var(--inv-gap);
        padding: 12px;
        padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
      }

      /* Invisible item slots: reserve space only (no borders) */
      .inv-slot {
        min-height: var(--inv-slot-min);
        border-radius: 10px; /* radius helps future hover/focus rings, but remains invisible */
        display: grid;
        place-items: center;
      }

      /* Optional placeholder style when debugged – left off by default
         .inv-slot::before { content:''; inset:0; position:absolute; border:1px dashed rgba(255,255,255,.07); border-radius:10px; }
      */

      /* Touch affordances */
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
    // Button
    this.button = document.createElement('button');
    this.button.className = 'inv-btn';
    this.button.setAttribute('aria-label', 'Open inventory');
    this.button.setAttribute('aria-expanded', 'false');

    // Inline SVG (bag icon)
    this.button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="white" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round" />
        <rect x="3.8" y="9" width="16.4" height="12.2" rx="2.4" stroke="white" stroke-opacity=".9" stroke-width="1.6" />
        <path d="M9 13h6" stroke="white" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    `;

    // Bottom sheet
    this.sheet = document.createElement('section');
    this.sheet.className = 'inv-sheet';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'false');
    this.sheet.setAttribute('aria-label', 'Inventory');

    // Header / grabber
    const head = document.createElement('div');
    head.className = 'inv-sheet__head';
    head.innerHTML = `<div class="inv-sheet__grab"></div>`;

    // Grid: 3 rows x 5 columns (15 empty, invisible slots)
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    for (let i = 0; i < 15; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.index = String(i);
      grid.appendChild(slot);
    }

    this.sheet.appendChild(head);
    this.sheet.appendChild(grid);

    // Mount
    document.body.appendChild(this.button);
    document.body.appendChild(this.sheet);
  }

  _wireEvents() {
    // Toggle on click/tap
    this.button.addEventListener('click', () => this.toggle());

    // Close with Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Swipe down to close (simple pointer gesture on the sheet header)
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

  open() {
    this.isOpen = true;
    this.sheet.classList.add('open');
    this.button.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.isOpen = false;
    this.sheet.classList.remove('open');
    this.button.setAttribute('aria-expanded', 'false');
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }
}