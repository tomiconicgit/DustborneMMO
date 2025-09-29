// file: src/engine/lib/Pathfinding.js
import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_DEPTH, TILE_SIZE } from '../../game/world/WorldMap.js';

/**
 * Minimal tile grid adapter for your 30x30 world (no chunks).
 * World origin (0,0) is the corner of tile (0,0).
 * Tile centers are at (x+0.5, 0, z+0.5).
 */
class TileGrid {
  constructor({
    width  = WORLD_WIDTH,
    height = WORLD_DEPTH,
    tileSize = TILE_SIZE
  } = {}) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;

    // Walkability map: true = walkable
    this._walk = new Array(width * height).fill(true);
  }

  index(x, z) { return z * this.width + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.width && z < this.height; }

  setWalkable(x, z, walkable) {
    if (!this.inBounds(x, z)) return;
    this._walk[this.index(x, z)] = !!walkable;
  }
  isWalkable(x, z) {
    return this.inBounds(x, z) && this._walk[this.index(x, z)] === true;
  }

  // Convert world -> tile indices
  worldToTile(pos) {
    const x = Math.floor(pos.x / this.tileSize);
    const z = Math.floor(pos.z / this.tileSize);
    return { x, z };
  }

  // Tile center in world coords (y is passed or 0)
  tileCenter(x, z, y = 0) {
    return new THREE.Vector3(
      (x + 0.5) * this.tileSize,
      y,
      (z + 0.5) * this.tileSize
    );
  }

  neighbors4(x, z) {
    const out = [];
    const dirs = [
      [ 1, 0], [-1, 0],
      [ 0, 1], [ 0,-1],
    ];
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      if (this.inBounds(nx, nz) && this.isWalkable(nx, nz)) out.push({ x: nx, z: nz });
    }
    return out;
  }

  neighbors8(x, z) {
    const out = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = x + dx, nz = z + dz;
        if (!this.inBounds(nx, nz) || !this.isWalkable(nx, nz)) continue;

        // Optional: prevent "cutting corners" through blocked orthogonals
        if (dx !== 0 && dz !== 0) {
          const a = this.isWalkable(x + dx, z);
          const b = this.isWalkable(x, z + dz);
          if (!a || !b) continue;
        }
        out.push({ x: nx, z: nz });
      }
    }
    return out;
  }
}

/** Tiny binary-heap-ish priority queue (array + sort is fine for 30x30). */
class PriorityQueue {
  constructor() { this.q = []; }
  enqueue(node, priority) { this.q.push({ node, priority }); this.q.sort((a,b)=>a.priority-b.priority); }
  dequeue() { return this.q.shift()?.node; }
  isEmpty() { return this.q.length === 0; }
}

export default class Pathfinding {
  /**
   * @param {Object} opts
   * @param {number} [opts.tileCost=1]  Base move cost for orthogonal steps
   * @param {boolean} [opts.diagonal=true] Allow 8-way moves
   * @param {number} [opts.diagonalCost=Math.SQRT2] Cost for diagonal steps
   * @param {TileGrid} [opts.grid] Provide your own grid (optional)
   */
  constructor(opts = {}) {
    this.grid = opts.grid || new TileGrid();
    this.tileCost = opts.tileCost ?? 1;
    this.diagonal = opts.diagonal ?? true;
    this.diagonalCost = opts.diagonalCost ?? Math.SQRT2;
  }

  /** Expose grid so you can mark obstacles from game code. */
  getGrid() { return this.grid; }

  /** Manhattan heuristic (8-way uses octile for smooth diagonals). */
  _heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    if (this.diagonal) {
      // Octile distance
      const D = this.tileCost;
      const D2 = this.diagonalCost;
      return (D * (dx + dz)) + ((D2 - 2 * D) * Math.min(dx, dz));
    }
    return dx + dz;
  }

  /** Cost between tiles (orthogonal or diagonal). */
  _stepCost(ax, az, bx, bz) {
    const dx = Math.abs(bx - ax);
    const dz = Math.abs(bz - az);
    const diag = (dx !== 0 && dz !== 0);
    return diag ? this.diagonalCost : this.tileCost;
  }

  /**
   * Find a path from world-space start -> end, returning an array of world-space Vector3 points
   * placed at tile centers. Returns null if no path.
   */
  findPath(startWorld, endWorld, { clampToBounds = true } = {}) {
    // Convert incoming positions to tile indices
    let start = this.grid.worldToTile(startWorld);
    let goal  = this.grid.worldToTile(endWorld);

    if (clampToBounds) {
      start.x = THREE.MathUtils.clamp(start.x, 0, this.grid.width - 1);
      start.z = THREE.MathUtils.clamp(start.z, 0, this.grid.height - 1);
      goal.x  = THREE.MathUtils.clamp(goal.x, 0, this.grid.width - 1);
      goal.z  = THREE.MathUtils.clamp(goal.z, 0, this.grid.height - 1);
    }

    if (!this.grid.isWalkable(goal.x, goal.z)) return null;

    // A*
    const frontier = new PriorityQueue();
    frontier.enqueue(start, 0);

    const cameFrom = new Map(); // key: "x,z" -> {x,z}
    const costSoFar = new Map(); // key -> g
    const key = (t) => `${t.x},${t.z}`;

    cameFrom.set(key(start), null);
    costSoFar.set(key(start), 0);

    while (!frontier.isEmpty()) {
      const current = frontier.dequeue();
      if (current.x === goal.x && current.z === goal.z) break;

      const neighbors = this.diagonal
        ? this.grid.neighbors8(current.x, current.z)
        : this.grid.neighbors4(current.x, current.z);

      for (const n of neighbors) {
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
    let safety = this.grid.width * this.grid.height + 5;
    while (cur && safety-- > 0) {
      pathTiles.push(cur);
      cur = cameFrom.get(key(cur));
    }
    if (!pathTiles.length || pathTiles[pathTiles.length - 1].x !== start.x || pathTiles[pathTiles.length - 1].z !== start.z) {
      return null; // no path
    }
    pathTiles.reverse();

    // Convert to world centers (y = startWorld.y to keep your character on ground)
    const y = startWorld.y ?? 0;
    return pathTiles.map(t => this.grid.tileCenter(t.x, t.z, y));
  }
}

/* -----------------------------------------------------------
   Quick usage (example, wire where you handle taps/clicks):
   -----------------------------------------------------------
   import Pathfinding from './engine/lib/Pathfinding.js';
   import Character from '../../game/character/Character.js';

   const pf = new Pathfinding();

   // Optional: mark obstacles
   // pf.getGrid().setWalkable(10, 12, false);

   // On pointer/touch: raycast to ground, get world position `hit`
   const path = pf.findPath(Character.instance.object3D.position, hit);
   if (path) {
     // enqueue path for your movement system to follow tile centers
   }
*/