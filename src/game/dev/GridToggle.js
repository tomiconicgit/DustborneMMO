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

    // GridHelper is already on the XZ plane; no rotation needed.
    const size   = Math.max(WORLD_WIDTH, WORLD_DEPTH) * TILE_SIZE;
    const divs   = WORLD_WIDTH; // lines per tile
    const grid   = new THREE.GridHelper(size, divs, 0x444444, 0x444444);
    grid.position.y = 0.02; // avoid z-fighting
    this.group.add(grid);

    // Safe-area aware toggle button (won’t hide under the notch)
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

  update(playerPosition) {
    if (!this.group.visible || !playerPosition) return;
    this.group.position.x = Math.round(playerPosition.x);
    this.group.position.z = Math.round(playerPosition.z);
  }
}