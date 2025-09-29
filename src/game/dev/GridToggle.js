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

    // Grid matches the terrain size (WORLD_WIDTH × WORLD_DEPTH)
    const sizeX = WORLD_WIDTH * TILE_SIZE;
    const sizeZ = WORLD_DEPTH * TILE_SIZE;
    const divisions = WORLD_WIDTH; // 1 line per tile

    const gridHelper = new THREE.GridHelper(
      Math.max(sizeX, sizeZ),
      divisions,
      0x444444,
      0x444444
    );
    gridHelper.rotation.x = Math.PI / 2; // keep aligned with X/Z plane
    gridHelper.position.y = 0.02; // just above ground to avoid z-fighting
    this.group.add(gridHelper);

    // UI toggle button
    const button = document.createElement('button');
    button.textContent = 'Grid';
    Object.assign(button.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '20000',
      padding: '8px 12px',
      fontFamily: 'Orbitron, sans-serif',
      fontWeight: '600',
      letterSpacing: '1px',
      color: '#111',
      background: '#f5eeda',
      border: '1px solid rgba(0,0,0,.2)',
      borderRadius: '8px',
      cursor: 'pointer'
    });

    button.addEventListener('click', () => {
      this.group.visible = !this.group.visible;
    });
    document.body.appendChild(button);
  }

  /**
   * Call this per frame (or when player moves) to re-center grid on player.
   * Keeps the grid aligned to world tiles.
   */
  update(playerPosition) {
    if (!this.group.visible || !playerPosition) return;
    this.group.position.x = Math.round(playerPosition.x);
    this.group.position.z = Math.round(playerPosition.z);
  }
}