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
    return ore;
  }

  constructor(mesh, tileX, tileZ) {
    this.mesh = mesh;
    this.tileX = tileX;
    this.tileZ = tileZ;

    // Simple balance for a wooden pickaxe (level 1 prospecting placeholder)
    this.maxHealth = 3;
    this.health = this.maxHealth;

    this.isDepleted = false;
    this.respawnDelay = 15; // seconds
    this.respawnTimer = 0;

    this._mineClock = 0;

    // Bind for ray hit
    this.mesh.userData.ore = this;

    // Per-frame updates
    this._unsub = UpdateBus.on((dt) => this.update(dt));
  }

  onTapped() {
    if (this.isDepleted) return;

    // Player target: nearest adjacent tile (4-way). Pick the closest of the four.
    const ch = Character.instance?.object3D;
    if (!ch) return;

    const oreCenter = new THREE.Vector3(
      (this.tileX + 0.5) * TILE_SIZE,
      0,
      (this.tileZ + 0.5) * TILE_SIZE
    );

    const candidates = [
      { x: this.tileX + 1, z: this.tileZ     },
      { x: this.tileX - 1, z: this.tileZ     },
      { x: this.tileX,     z: this.tileZ + 1 },
      { x: this.tileX,     z: this.tileZ - 1 },
    ];

    // Choose closest candidate in world space
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const wp = new THREE.Vector3((c.x + 0.5) * TILE_SIZE, 0, (c.z + 0.5) * TILE_SIZE);
      const d = wp.distanceToSquared(ch.position);
      if (d < bestDist) { bestDist = d; best = { ...c, world: wp }; }
    }
    const standPos = best?.world || oreCenter.clone().add(new THREE.Vector3(TILE_SIZE, 0, 0));

    // Walk there, then start mining
    Movement.main?.walkTo(standPos, () => this._beginMining());
  }

  _beginMining() {
    if (this.isDepleted) return;

    const ch = Character.instance?.object3D;
    const modelRoot = CharacterAnimator.main?.modelRoot;
    if (!ch || !modelRoot) return;

    // Face the ore
    const orePos = new THREE.Vector3(
      (this.tileX + 0.5) * TILE_SIZE,
      0,
      (this.tileZ + 0.5) * TILE_SIZE
    );
    const dir = new THREE.Vector3().subVectors(orePos, ch.position);
    dir.y = 0;
    const yaw = Math.atan2(dir.x, dir.z);
    modelRoot.rotation.set(0, yaw, 0);

    // Play mining animation loop
    CharacterAnimator.main?.playMining();

    // Reset tick
    this._mineClock = 0;
  }

  update(dt) {
    // Handle respawn
    if (this.isDepleted) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    // If mining anim is active, apply timed hits
    if (CharacterAnimator.main?.active === 'mining') {
      this._mineClock += dt;
      if (this._mineClock >= 2.0) { // one hit every ~2s
        this._mineClock = 0;
        this._applyMiningHit();
      }
    }
  }

  _applyMiningHit() {
    if (this.isDepleted) return;

    // Damage this ore
    this.health -= 1;

    // Reward: 1–2 copper per hit (temporary balance)
    const gained = 1 + Math.floor(Math.random() * 2);
    this._giveCopper(gained);

    if (this.health <= 0) {
      this._deplete();
    } else {
      // Restart loop cleanly each time an ore is collected
      CharacterAnimator.main?.playMining();
    }
  }

  _giveCopper(count) {
    // TODO: hook into a real inventory model later. For now, drop a counter in slot 1 if UI exists.
    console.log(`+${count} Copper Ore`);
    const slot = document.querySelector('.inv-grid .inv-slot');
    if (slot) {
      const current = parseInt(slot.textContent || '0', 10) || 0;
      slot.textContent = String(current + count);
    }
  }

  _deplete() {
    this.isDepleted = true;
    this.mesh.visible = false;
    this.respawnTimer = this.respawnDelay;
    // Stop mining if we just depleted the node
    CharacterAnimator.main?.playIdle();
  }

  _respawn() {
    this.isDepleted = false;
    this.health = this.maxHealth;
    this.mesh.visible = true;
    console.log('Copper ore respawned at same spot.');
  }
}