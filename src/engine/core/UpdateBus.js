// file: src/engine/core/UpdateBus.js
export default class UpdateBus {
  static listeners = new Set();

  static create() { return new UpdateBus(); } // for manifest compatibility

  static on(fn)  { UpdateBus.listeners.add(fn);  return () => UpdateBus.off(fn); }
  static off(fn) { UpdateBus.listeners.delete(fn); }
  static tick(dt){ for (const fn of UpdateBus.listeners) { try { fn(dt); } catch {} } }
}