// file: src/game/dev/GridToggle.js
import * as THREE from 'three';
import Scene from '../../engine/core/Scene.js';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../world/WorldMap.js';

export default class GridToggle {
  static main = null;

  static create() {
    if (GridToggle.main) return;
    if (!Scene.main) return;
    GridToggle.main = new GridToggle(Scene.main);
  }

  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'DevGridOverlay';
    this.group.visible = false;
    this.scene.add(this.group);

    // Grid sized to terrain and positioned exactly where the terrain is.
    const width  = WORLD_WIDTH * TILE_SIZE;   // 30
    const depth  = WORLD_DEPTH * TILE_SIZE;   // 30
    const size   = Math.max(width, depth);
    const divs   = WORLD_WIDTH;               // 30 lines-per-side so each tile shows

    const grid   = new THREE.GridHelper(size, divs, 0x444444, 0x444444);
    grid.rotation.x = 0;              // GridHelper already lies on XZ
    grid.position.set(width / 2, 0.02, depth / 2); // ✅ align with ProceduralGround
    this.group.add(grid);

    // Safe-area aware toggle button
    const button = document.createElement('button');
    button.textContent = 'Grid';
    Object.assign(button.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
      right: 'calc(env(safe-area-inset-right, 0px) + 10px)',
      zIndex: '20000',
      padding: '8px 12px',
      fontFamily: 'Orbitron, system-ui, sans-serif',
      fontWeight: '600',
      letterSpacing: '1px',
      color: '#111',
      background: '#f5eeda',
      border: '1px solid rgba(0,0,0,.2)',
      borderRadius: '8px',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent'
    });
    button.addEventListener('click', () => {
      this.group.visible = !this.group.visible;
    });
    document.body.appendChild(button);
  }

  // No need to chase the player anymore; grid is world-aligned.
  update(_playerPosition) {}
}