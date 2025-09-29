// file: src/debugger.js
export default class Debugger {
  static init() {
    // No FPS/Stats panel; keep console-only logging.
  }

  static update() {
    // noop
  }

  static log(message, ...optional)   { console.log(`[INFO] ${message}`, ...optional); }
  static warn(message, ...optional)  { console.warn(`[WARN] ${message}`, ...optional); }
  static error(message, ...optional) { console.error(`[ERROR] ${message}`, ...optional); }
}