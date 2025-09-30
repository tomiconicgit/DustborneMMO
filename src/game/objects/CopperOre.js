// file: src/game/objects/CopperOre.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from '../character/Character.js';
import CharacterAnimator from '../character/CharacterAnimator.js';
import Movement from '../character/Movement.js';
import { TILE_SIZE } from '../world/WorldMap.js';

export default class CopperOre {
  static all = new Map(); // mesh.uuid -> instance

  static createFromMesh(mesh, tileX, tileZ) {
    const ore = new CopperOre(mesh, tileX, tileZ);
    CopperOre.all.set(mesh.uuid, ore);
    // make it discoverable by raycasts
    mesh.userData.ore = ore;
    return ore;
  }

  constructor(mesh, tileX, tileZ) {
    this.mesh = mesh;
    this.tileX = tileX;
    this.tileZ = tileZ;

    // simple tuning for wooden pickaxe @ prospecting lvl 1
    this.maxHealth = 3;
    this.health = this.maxHealth;

    this.isDepleted = false;
    this.respawnDelay = 15;  // seconds
    this._respawnTimer = 0;

    this._mining = false;
    this._mineClock = 0;     // seconds accumulated since last hit

    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  /** User tapped this ore. Walk next to it and begin mining. */
  onTapped() {
    if (this.isDepleted) return;

    const ch = Character.instance?.object3D;
    if (!ch) return;

    // World center of the ore's tile
    const oreCenter = new THREE.Vector3(
      (this.tileX + 0.5) * TILE_SIZE,
      0,
      (this.tileZ + 0.5) * TILE_SIZE
    );

    // Choose the nearest adjacent tile (4-way) to stand on
    const candidates = [
      { x: this.tileX + 1, z: this.tileZ     },
      { x: this.tileX - 1, z: this.tileZ     },
      { x: this.tileX,     z: this.tileZ + 1 },
      { x: this.tileX,     z: this.tileZ - 1 },
    ];

    // Sort by distance to current player pos
    candidates.sort((a, b) => {
      const aw = new THREE.Vector3((a.x + 0.5) * TILE_SIZE, 0, (a.z + 0.5) * TILE_SIZE);
      const bw = new THREE.Vector3((b.x + 0.5) * TILE_SIZE, 0, (b.z + 0.5) * TILE_SIZE);
      return ch.position.distanceToSquared(aw) - ch.position.distanceToSquared(bw);
    });

    // Try each candidate until a path succeeds
    const tryNext = (i = 0) => {
      if (i >= candidates.length) return; // give up silently
      const c = candidates[i];
      const stand = new THREE.Vector3((c.x + 0.5) * TILE_SIZE, 0, (c.z + 0.5) * TILE_SIZE);
      Movement.main?.walkTo(stand, () => this._beginMining(), /*onFail*/ () => tryNext(i + 1));
    };

    tryNext(0);
  }

  _beginMining() {
    if (this.isDepleted) return;

    const ch = Character.instance?.object3D;
    const modelRoot = CharacterAnimator.main?.modelRoot;
    if (!ch || !modelRoot) return;

    // Face the ore
    const target = new THREE.Vector3(
      (this.tileX + 0.5) * TILE_SIZE - ch.position.x,
      0,
      (this.tileZ + 0.5) * TILE_SIZE - ch.position.z
    );
    const yaw = Math.atan2(target.x, target.z);
    modelRoot.rotation.set(0, yaw, 0);

    // Start / restart the mining loop animation
    CharacterAnimator.main?.playMining();
    this._mining = true;
    this._mineClock = 0;
  }

  update(dt) {
    if (this.isDepleted) {
      // countdown to respawn
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this._respawn();
      return;
    }

    // Only tick mining damage if we’re currently in the mining state
    if (this._mining && CharacterAnimator.main?.active === 'mining') {
      this._mineClock += dt;
      // One “hit” every 2 seconds
      if (this._mineClock >= 2.0) {
        this._mineClock = 0;
        this._applyMiningHit();
      }
    }
  }

  _applyMiningHit() {
    if (this.isDepleted) return;

    // 🔨 damage the ore
    this.health -= 1;

    // 🎁 reward a small random amount of copper (1–2)
    const gained = 1 + Math.floor(Math.random() * 2);
    this._grantCopper(gained);

    if (this.health <= 0) {
      this._deplete();
    } else {
      // Restart loop to simulate repeated swings
      CharacterAnimator.main?.playMining();
    }
  }

  _grantCopper(count) {
    // Placeholder hook; will integrate with actual inventory system later.
    console.log(`+${count} Copper Ore`);
    // naive visual feedback in the first slot (if inventory UI exists)
    const slot = document.querySelector('.inv-slot[data-slot="0"]');
    if (slot) {
      const cur = parseInt(slot.getAttribute('data-count') || '0', 10);
      const next = cur + count;
      slot.setAttribute('data-count', String(next));
      slot.textContent = String(next);
    }
  }

  _deplete() {
    this.isDepleted = true;
    this._mining = false;
    this.mesh.visible = false;
    this._respawnTimer = this.respawnDelay;
    CharacterAnimator.main?.playIdle();
  }

  _respawn() {
    this.isDepleted = false;
    this.health = this.maxHealth;
    this.mesh.visible = true;
    // do not auto-start mining; user needs to tap again
  }
}