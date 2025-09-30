// file: src/game/world/StaticObjectMap.js

// Hand-placed objects by tile, keyed "x,z" where x/z are tile indices.
// Each entry is an array of objects with at least a `type` field.
// Supported types (so far): 'ore-copper'
//
// Objects are spawned at the *center* of the tile. Y is taken from the GLB.

export const STATIC_OBJECTS = {
  // Copper ore cluster around tiles (13..15, 15..17)
  '13,16': [ { type: 'ore-copper', yaw: 0.10 } ],
  '14,16': [ { type: 'ore-copper', yaw: 0.80 } ],
  '15,16': [ { type: 'ore-copper', yaw: 1.55 } ],
  '14,17': [ { type: 'ore-copper', yaw: 2.20 } ],
  '15,17': [ { type: 'ore-copper', yaw: 2.85 } ],
  '14,15': [ { type: 'ore-copper', yaw: -0.55 } ],
};