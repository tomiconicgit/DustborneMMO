// file: src/game/objects/CopperOre.js
import * as THREE from 'three';
import UpdateBus from '../../engine/core/UpdateBus.js';
import Character from '../character/Character.js';
import CharacterAnimator from '../character/CharacterAnimator.js';
import Movement from '../character/Movement.js';
import SoundManager from '../../engine/audio/SoundManager.js';
import { TILE_SIZE } from '../world/WorldMap.js';
import InventoryUI from '../../ui/inventory.js'; // NEW: wire mining to inventory UI

export default class CopperOre {
  static all = new Map();             // mesh.uuid -> instance
  static current = null;              // the ore actively being mined (exclusive)

  static createFromMesh(mesh, tileX, tileZ) {
    const ore = new CopperOre(mesh, tileX, tileZ);
    CopperOre.all.set(mesh.uuid, ore);
    return ore;
  }

  constructor(mesh, tileX, tileZ) {
    this.mesh = mesh;
    this.tileX = tileX;
    this.tileZ = tileZ;

    // Simple balance for wooden pickaxe
    this.maxHealth = 3;
    this.health = this.maxHealth;

    this.isDepleted = false;
    this.respawnDelay = 15; // seconds
    this.respawnTimer = 0;

    // One mining "cycle" timer:
    // - at 1.8s -> play hit sound
    // - at 2.0s -> apply hit (damage + loot) and restart loop
    this._mineClock = 0;
    this._playedHitSfxInCycle = false;

    // Mark all child meshes so ray hits can resolve back to this ore
    this.mesh.traverse((o) => { o.userData = o.userData || {}; o.userData.ore = this; });

    // Per-frame updates
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  /** Called by GroundPicker when the player taps this ore. */
  onTapped() {
    if (this.isDepleted) return;

    // Choose nearest adjacent (4-way) standing tile
    const ch = Character.instance?.object3D;
    if (!ch) return;

    const candidates = [
      { x: this.tileX + 1, z: this.tileZ     },
      { x: this.tileX - 1, z: this.tileZ     },
      { x: this.tileX,     z: this.tileZ + 1 },
      { x: this.tileX,     z: this.tileZ - 1 },
    ];

    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const wp = new THREE.Vector3((c.x + 0.5) * TILE_SIZE, 0, (c.z + 0.5) * TILE_SIZE);
      const d2 = wp.distanceToSquared(ch.position);
      if (d2 < bestDist) { bestDist = d2; best = { ...c, world: wp }; }
    }
    const standPos = best?.world || new THREE.Vector3((this.tileX + 1.5) * TILE_SIZE, 0, (this.tileZ + 0.5) * TILE_SIZE);

    // Select THIS ore as the active target and walk to it
    CopperOre.current = this;
    Movement.main?.walkTo(standPos, () => this._beginMining());
  }

  _beginMining() {
    if (this.isDepleted) return;

    // Re-assert selection (in case we arrived late and another tap happened)
    CopperOre.current = this;

    const ch = Character.instance?.object3D;
    const modelRoot = CharacterAnimator.main?.modelRoot;
    if (!ch || !modelRoot) return;

    // Face the ore
    const orePos = new THREE.Vector3(
      (this.tileX + 0.5) * TILE_SIZE,
      0,
      (this.tileZ + 0.5) * TILE_SIZE
    );
    const to = new THREE.Vector3().subVectors(orePos, ch.position); to.y = 0;
    if (to.lengthSq() > 1e-6) {
      const yaw = Math.atan2(to.x, to.z);
      modelRoot.rotation.set(0, yaw, 0);
    }

    // Start the mining loop
    CharacterAnimator.main?.playMining?.();
    this._mineClock = 0;
    this._playedHitSfxInCycle = false;
  }

  update(dt) {
    // Handle respawn timing
    if (this.isDepleted) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    // Only the currently selected ore progresses the mining cycle
    if (CopperOre.current !== this) return;

    // Drive the cadence off the mining animation being active
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

    // Damage this exact ore
    this.health -= 1;

    // Reward: +1–2 copper to slot 0 of UI (quantity badge)
    const gained = 1 + Math.floor(Math.random() * 2);
    this._giveCopper(gained);

    if (this.health <= 0) {
      this._deplete();
    } else {
      // Restart the visible mining loop for a fresh swing
      CharacterAnimator.main?.restartMiningLoop?.();
    }
  }

  _giveCopper(count) {
    // Use InventoryUI API to bump qty in slot 0
    const ui = InventoryUI.instance;
    if (!ui) {
      // fallback to DOM badge if UI not initialized for any reason
      const slot = document.querySelector('.inv-grid .inv-slot');
      const badge = slot?.querySelector('.inv-qty');
      const cur = parseInt(badge?.textContent || '0', 10) || 0;
      const next = cur + count;
      if (badge) {
        badge.style.display = next > 0 ? 'block' : 'none';
        badge.textContent = String(next);
      }
      return;
    }

    // Read current qty from badge (or track your own state if preferred)
    const slot = ui.grid.querySelector('.inv-slot[data-index="0"]');
    const badge = slot?.querySelector('.inv-qty');
    const cur = parseInt(badge?.textContent || '0', 10) || 0;
    const next = cur + count;

    ui.setSlotQty(0, next);
    // Icon is set automatically when ItemIcons fires 'icon:copper-ready'
  }

  _deplete() {
    this.isDepleted = true;
    this.mesh.visible = false;
    this.respawnTimer = this.respawnDelay;

    SoundManager.main?.play('rock-deplete', 1.0);

    // If this was the active ore, clear selection and stop mining
    if (CopperOre.current === this) {
      CopperOre.current = null;
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