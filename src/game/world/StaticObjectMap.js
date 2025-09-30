// file: src/game/world/StaticObjectMap.js

// Hand-placed objects by tile, keyed "x,z" (tile indices).
// Supported types: 'copper-ore'
// Each object is placed at the tile center; the GLB's baked Y is preserved.

export const STATIC_OBJECTS = {
  // 6 copper rocks, arranged with a 1-tile moat around each one.
  // (Chebyshev distance between any pair >= 2)
  '12,12': [ { type: 'copper-ore', yaw: -0.35 } ],
  '14,12': [ { type: 'copper-ore', yaw:  0.55 } ],
  '16,12': [ { type: 'copper-ore', yaw:  1.20 } ],
  '12,14': [ { type: 'copper-ore', yaw:  2.10 } ],
  '14,16': [ { type: 'copper-ore', yaw: -1.10 } ],
  '16,16': [ { type: 'copper-ore', yaw:  2.75 } ],
};