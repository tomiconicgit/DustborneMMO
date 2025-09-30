// file: src/game/objects/CopperOre.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from '../character/Character.js';
import CharacterAnimator from '../character/CharacterAnimator.js';
import Movement from '../character/Movement.js';
import SoundManager from '../../engine/audio/SoundManager.js';
import { TILE_SIZE } from '../world/WorldMap.js';

// Shared across ore types so only one node mines at a time
const ActiveOre = {
  get current() { return window.__ActiveOre || null; },
  set current(v) { window.__ActiveOre = v; }
};

export default class CopperOre {
  static all = new Map(); // mesh.uuid -> instance

  static createFromMesh(mesh, tileX, tileZ) {
    const ore = new CopperOre(mesh, tileX, tileZ);
    CopperOre.all.set(mesh.uuid, ore);
    return ore;
  }

  constructor(mesh, tileX, tileZ) {
    this.mesh = mesh;
    this.tileX = tileX;
    this.tileZ = tileZ;

    this.maxHealth = 3;
    this.health = this.maxHealth;

    this.isDepleted = false;
    this.respawnDelay = 15;
    this.respawnTimer = 0;

    this._mineClock = 0;
    this._playedHitSfxInCycle = false;

    this.mesh.traverse(o => { o.userData = o.userData || {}; o.userData.ore = this; });

    this._unsub = UpdateBus.on(dt => this.update(dt));
  }

  onTapped() {
    if (this.isDepleted) return;

    const ch = Character.instance?.object3D;
    if (!ch) return;

    const cands = [
      { x: this.tileX + 1, z: this.tileZ     },
      { x: this.tileX - 1, z: this.tileZ     },
      { x: this.tileX,     z: this.tileZ + 1 },
      { x: this.tileX,     z: this.tileZ - 1 },
    ];
    let best = null, bestD2 = Infinity;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const wp = new THREE.Vector3((c.x + 0.5) * TILE_SIZE, 0, (c.z + 0.5) * TILE_SIZE);
      const d2 = wp.distanceToSquared(ch.position);
      if (d2 < bestD2) { bestD2 = d2; best = { ...c, world: wp }; }
    }
    const standPos = best?.world || new THREE.Vector3((this.tileX + 1.5) * TILE_SIZE, 0, (this.tileZ + 0.5) * TILE_SIZE);

    ActiveOre.current = this;
    Movement.main?.walkTo(standPos, () => this._beginMining());
  }

  _beginMining() {
    if (this.isDepleted) return;
    ActiveOre.current = this;

    const ch = Character.instance?.object3D;
    const modelRoot = CharacterAnimator.main?.modelRoot;
    if (!ch || !modelRoot) return;

    const orePos = new THREE.Vector3((this.tileX + 0.5) * TILE_SIZE, 0, (this.tileZ + 0.5) * TILE_SIZE);
    const to = new THREE.Vector3().subVectors(orePos, ch.position); to.y = 0;
    if (to.lengthSq() > 1e-6) {
      const yaw = Math.atan2(to.x, to.z);
      modelRoot.rotation.set(0, yaw, 0);
    }

    CharacterAnimator.main?.playMining?.();
    this._mineClock = 0;
    this._playedHitSfxInCycle = false;
  }

  update(dt) {
    if (this.isDepleted) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    if (ActiveOre.current !== this) return;

    if (CharacterAnimator.main?.active === 'mining') {
      this._mineClock += dt;

      if (!this._playedHitSfxInCycle && this._mineClock >= 1.8) {
        this._playedHitSfxInCycle = true;
        SoundManager.main?.play('mining-hit', 0.9);
      }

      if (this._mineClock >= 2.0) {
        this._mineClock = 0;
        this._playedHitSfxInCycle = false;
        this._applyMiningHit();
      }
    }
  }

  _applyMiningHit() {
    if (this.isDepleted) return;

    this.health -= 1;

    // +1–2 Copper into slot #0
    const gained = 1 + Math.floor(Math.random() * 2);
    const slot = document.querySelector('.inv-grid .inv-slot[data-index="0"]') ||
                 document.querySelector('.inv-grid .inv-slot');
    if (slot) {
      const cur = parseInt(slot.textContent || '0', 10) || 0;
      slot.textContent = String(cur + gained);
    }

    if (this.health <= 0) {
      this._deplete();
    } else {
      CharacterAnimator.main?.restartMiningLoop?.();
    }
  }

  _deplete() {
    this.isDepleted = true;
    this.mesh.visible = false;
    this.respawnTimer = this.respawnDelay;

    SoundManager.main?.play('rock-deplete', 1.0);

    if (ActiveOre.current === this) {
      ActiveOre.current = null;
      CharacterAnimator.main?.playIdle?.();
    }
  }

  _respawn() {
    this.isDepleted = false;
    this.health = this.maxHealth;
    this.mesh.visible = true;
    this._mineClock = 0;
    this._playedHitSfxInCycle = false;
  }
}