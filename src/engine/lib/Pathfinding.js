// file: src/engine/lib/Pathfinding.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

/**
 * Minimal grid for a fixed 30x30 world (or whatever is in WorldMap).
 * World origin (0,0) is the corner of tile (0,0).
 * Tile centers are (x + 0.5, 0, z + 0.5).
 */
class TileGrid {
  constructor(width = WORLD_WIDTH, height = WORLD_DEPTH, tileSize = TILE_SIZE) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    // Walkability map: true = walkable
    this.walk = new Array(width * height).fill(true);
  }

  index(x, z) { return z * this.width + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.width && z < this.height; }

  setWalkable(x, z, value) {
    if (!this.inBounds(x, z)) return;
    this.walk[this.index(x, z)] = !!value;
  }
  isWalkable(x, z) {
    return this.inBounds(x, z) && this.walk[this.index(x, z)] === true;
  }

  // Convert world -> tile indices
  worldToTile(pos) {
    const x = Math.floor(pos.x / this.tileSize);
    const z = Math.floor(pos.z / this.tileSize);
    return { x, z };
  }

  // Tile center in world coords
  tileCenter(x, z, y = 0) {
    return new THREE.Vector3(
      (x + 0.5) * this.tileSize,
      y,
      (z + 0.5) * this.tileSize
    );
  }

  // 4-way neighbors (no diagonals)
  neighbors4(x, z) {
    const out = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < 4; i++) {
      const nx = x + dirs[i][0], nz = z + dirs[i][1];
      if (this.inBounds(nx, nz) && this.isWalkable(nx, nz)) out.push({ x: nx, z: nz });
    }
    return out;
  }

  // 8-way neighbors (diagonals) with optional corner-cut prevention
  neighbors8(x, z, preventCut = true) {
    const out = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx, nz = z + dz;
        if (!this.inBounds(nx, nz) || !this.isWalkable(nx, nz)) continue;
        if (preventCut && dx !== 0 && dz !== 0) {
          // require orthogonal access when going diagonal
          if (!this.isWalkable(x + dx, z) || !this.isWalkable(x, z + dz)) continue;
        }
        out.push({ x: nx, z: nz });
      }
    }
    return out;
  }
}

/** Tiny priority queue (good enough for 30x30). */
class PriorityQueue {
  constructor() { this.q = []; }
  enqueue(node, priority) { this.q.push({ node, priority }); this.q.sort((a, b) => a.priority - b.priority); }
  dequeue() { const n = this.q.shift(); return n ? n.node : null; }
  isEmpty() { return this.q.length === 0; }
}

export default class Pathfinding {
  // 🔁 Shared/singleton behavior so every system uses the same grid
  static main = null;
  static sharedGrid = new TileGrid();

  // Allow the engine to instantiate early via manifest
  static create() {
    if (!Pathfinding.main) {
      Pathfinding.main = new Pathfinding({ useShared: true });
    }
  }

  /**
   * @param {Object} opts
   * @param {boolean} [opts.diagonal=true]       Allow 8-way movement
   * @param {number}  [opts.tileCost=1]          Orthogonal step cost
   * @param {number}  [opts.diagonalCost=Math.SQRT2] Diagonal step cost
   * @param {boolean} [opts.useShared=true]      Use shared global grid
   */
  constructor(opts = {}) {
    const {
      diagonal = true,
      tileCost = 1,
      diagonalCost = Math.SQRT2,
      useShared = true
    } = opts;

    // Everyone points at the same grid by default
    this.grid = useShared ? Pathfinding.sharedGrid : new TileGrid();
    this.diagonal = !!diagonal;
    this.tileCost = tileCost;
    this.diagonalCost = diagonalCost;

    // Register the first constructed instance as the singleton
    if (!Pathfinding.main) Pathfinding.main = this;
  }

  /** Expose the grid so the game can mark obstacles at runtime. */
  getGrid() { return this.grid; }

  /** Heuristic: Manhattan for 4-way, Octile for 8-way. */
  _heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(b.z - a.z) || Math.abs(a.z - b.z); // tolerate both orders
    if (!this.diagonal) return (dx + dz) * this.tileCost;
    const D = this.tileCost, D2 = this.diagonalCost;
    return D * (dx + dz) + (D2 - 2 * D) * Math.min(dx, dz);
  }

  _stepCost(ax, az, bx, bz) {
    const dx = Math.abs(bx - ax);
    const dz = Math.abs(bz - az);
    const diag = (dx !== 0 && dz !== 0);
    return diag ? this.diagonalCost : this.tileCost;
  }

  /**
   * Find a path from world-space start -> end.
   * Returns an array of THREE.Vector3 at tile centers (world coords) or null if no path.
   */
  findPath(startWorld, endWorld) {
    if (!startWorld || !endWorld) return null;

    const start = this.grid.worldToTile(startWorld);
    const goal  = this.grid.worldToTile(endWorld);

    // Clamp inside bounds
    start.x = THREE.MathUtils.clamp(start.x, 0, this.grid.width - 1);
    start.z = THREE.MathUtils.clamp(start.z, 0, this.grid.height - 1);
    goal.x  = THREE.MathUtils.clamp(goal.x, 0, this.grid.width - 1);
    goal.z  = THREE.MathUtils.clamp(goal.z, 0, this.grid.height - 1);

    if (!this.grid.isWalkable(goal.x, goal.z)) return null;

    const frontier = new PriorityQueue();
    const cameFrom = new Map();
    const costSoFar = new Map();
    const key = (t) => t.x + ',' + t.z;

    frontier.enqueue(start, 0);
    cameFrom.set(key(start), null);
    costSoFar.set(key(start), 0);

    while (!frontier.isEmpty()) {
      const current = frontier.dequeue();
      if (!current) break;
      if (current.x === goal.x && current.z === goal.z) break;

      const neighbors = this.diagonal
        ? this.grid.neighbors8(current.x, current.z, true)
        : this.grid.neighbors4(current.x, current.z);

      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        const newCost = costSoFar.get(key(current)) + this._stepCost(current.x, current.z, n.x, n.z);
        const nKey = key(n);
        if (!costSoFar.has(nKey) || newCost < costSoFar.get(nKey)) {
          costSoFar.set(nKey, newCost);
          const priority = newCost + this._heuristic(n, goal);
          frontier.enqueue(n, priority);
          cameFrom.set(nKey, current);
        }
      }
    }

    // Reconstruct
    const pathTiles = [];
    let cur = goal;
    let guard = this.grid.width * this.grid.height + 5;
    while (cur && guard-- > 0) {
      pathTiles.push(cur);
      cur = cameFrom.get(key(cur));
    }
    if (!pathTiles.length || pathTiles[pathTiles.length - 1].x !== start.x || pathTiles[pathTiles.length - 1].z !== start.z) {
      return null;
    }
    pathTiles.reverse();

    // Convert to world centers; keep Y from start
    const y = (typeof startWorld.y === 'number') ? startWorld.y : 0;
    const out = new Array(pathTiles.length);
    for (let i = 0; i < pathTiles.length; i++) {
      const t = pathTiles[i];
      out[i] = this.grid.tileCenter(t.x, t.z, y);
    }
    return out;
  }
}