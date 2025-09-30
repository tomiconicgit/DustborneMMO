// file: src/game/dev/TileMarker.js
import * as THREE from 'three';
import Scene from '../../engine/core/Scene.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class TileMarker {
  static main = null;
  static create() { if (!TileMarker.main) TileMarker.main = new TileMarker(); }

  constructor() {
    this.scene = Scene.main;
    this.group = new THREE.Group();
    this.group.name = 'DevTileMarkers';
    this.scene.add(this.group);

    // state
    this.enabled = false;
    this.marks = new Map(); // key "x,z" -> mesh

    // UI
    this._buildUI();

    // listen for world taps (emitted by CameraTouchControls ➜ GroundPicker)
    window.addEventListener('ground:tap', this._onGroundTap);
  }

  _buildUI() {
    // container
    const panel = document.createElement('div');
    panel.id = 'marker-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
      left: 'calc(env(safe-area-inset-left, 0px) + 10px)',
      zIndex: '20000',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      fontFamily: 'Orbitron, system-ui, sans-serif'
    });

    // main button (shows toggle/copy row)
    const btn = document.createElement('button');
    btn.textContent = 'Marker';
    Object.assign(btn.style, this._btnStyle());
    btn.addEventListener('click', () => {
      tools.style.display = (tools.style.display === 'none' ? 'flex' : 'none');
    });

    // tools row
    const tools = document.createElement('div');
    tools.style.display = 'none';
    tools.style.gap = '8px';
    tools.style.alignItems = 'center';

    // toggle
    const toggle = document.createElement('button');
    toggle.textContent = 'Toggle: OFF';
    Object.assign(toggle.style, this._btnStyle());
    toggle.addEventListener('click', () => this._toggle(toggle));

    // copy
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    Object.assign(copy.style, this._btnStyle());
    copy.addEventListener('click', () => this._copy());

    // clear
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    Object.assign(clear.style, this._btnStyle());
    clear.addEventListener('click', () => this._clear());

    tools.append(toggle, copy, clear);
    panel.append(btn, tools);
    document.body.appendChild(panel);
  }

  _btnStyle() {
    return {
      padding: '8px 12px',
      color: '#111',
      background: '#f5eeda',
      border: '1px solid rgba(0,0,0,.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      fontWeight: '600',
      letterSpacing: '1px'
    };
  }

  _toggle(toggleBtn) {
    this.enabled = !this.enabled;
    window.__DEV_MARKER_MODE__ = this.enabled; // read in Movement.js
    toggleBtn.textContent = `Toggle: ${this.enabled ? 'ON' : 'OFF'}`;
    // small visual hint
    toggleBtn.style.background = this.enabled ? '#ffd3d3' : '#f5eeda';
  }

  _onGroundTap = (ev) => {
    if (!this.enabled) return;
    const p = ev?.detail?.point;
    if (!p) return;

    // convert world->tile
    let tx = Math.floor(p.x / TILE_SIZE);
    let tz = Math.floor(p.z / TILE_SIZE);
    // keep inside bounds
    tx = Math.max(0, Math.min(WORLD_WIDTH  - 1, tx));
    tz = Math.max(0, Math.min(WORLD_DEPTH - 1, tz));

    const key = `${tx},${tz}`;
    if (this.marks.has(key)) {
      // toggle off: remove existing marker
      const mesh = this.marks.get(key);
      mesh?.parent?.remove(mesh);
      this.marks.delete(key);
      return;
    }

    // create a red disk marker at tile center
    const radius = TILE_SIZE * 0.35;
    const geom = new THREE.CylinderGeometry(radius, radius, 0.06, 20);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geom, mat);
    m.rotation.x = Math.PI / 2;
    m.position.set((tx + 0.5) * TILE_SIZE, 0.03, (tz + 0.5) * TILE_SIZE); // slight lift to avoid z-fight
    m.renderOrder = 999; // draw on top
    this.group.add(m);
    this.marks.set(key, m);
  };

  _copy() {
    const out = [];
    this.marks.forEach((_mesh, key) => {
      const [x, z] = key.split(',').map(n => Number(n));
      out.push([x, z]);
    });
    const text = JSON.stringify(out);
    // clipboard (best effort)
    try {
      navigator.clipboard?.writeText(text);
      this._toast(`Copied ${out.length} tiles`);
    } catch {
      this._toast('Could not access clipboard. Text logged to console.');
      console.log('[TileMarker] Copy:\n', text);
    }
  }

  _clear() {
    this.marks.forEach((m) => m?.parent?.remove(m));
    this.marks.clear();
  }

  _toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,.75)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '10px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: '20000'
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1400);
  }
}