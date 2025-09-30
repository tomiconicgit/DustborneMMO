// file: src/engine/input/CameraTouchControls.js
// Orbit rotate (1 finger drag) + pinch/scroll zoom.
// Proper two-pointer tracking to avoid jumpy zoom deltas.
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    // Pointer tracking
    this.primaryId = null;
    this.lastX = 0;
    this.lastY = 0;

    // Store active pointers { id: {x,y} }
    this.points = new Map();
    this.lastPinchDist = null;

    // Bind events
    this.canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onMove,  { passive: false });
    this.canvas.addEventListener('pointerup',   this.onUp,    { passive: false });
    this.canvas.addEventListener('pointercancel', this.onUp,  { passive: false });
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  onDown = (e) => {
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.primaryId === null) {
      this.primaryId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.setPointerCapture?.(e.pointerId);
    }

    // If two pointers now, seed pinch distance
    if (this.points.size === 2) {
      this.lastPinchDist = this._currentPinchDistance();
    }
  };

  onMove = (e) => {
    if (!this.points.has(e.pointerId)) return;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.points.size === 2) {
      // Proper pinch: distance between the two active pointers
      e.preventDefault();
      const d = this._currentPinchDistance();
      if (this.lastPinchDist != null && isFinite(d)) {
        const delta = d - this.lastPinchDist;
        this._zoomBy(-delta * 0.01);
      }
      this.lastPinchDist = d;
      return;
    }

    // Single-finger orbit rotate
    if (e.pointerId === this.primaryId) {
      const dx = e.clientX - this.lastX;
      const moved = Math.abs(dx) > 0;
      if (moved) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    // Release pointer
    if (e.pointerId === this.primaryId) {
      this.canvas.releasePointerCapture?.(e.pointerId);
      this.primaryId = null;
    }
    this.points.delete(e.pointerId);

    // Reset pinch state if fewer than 2 pointers
    if (this.points.size < 2) {
      this.lastPinchDist = null;
    }

    // Choose a new primary if one finger remains
    if (this.primaryId === null && this.points.size === 1) {
      const [id, pt] = this.points.entries().next().value;
      this.primaryId = id;
      this.lastX = pt.x;
      this.lastY = pt.y;
    }
  };

  onWheel = (e) => this._zoomBy(e.deltaY * 0.001);

  _currentPinchDistance() {
    if (this.points.size !== 2) return null;
    const it = this.points.values();
    const a = it.next().value;
    const b = it.next().value;
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
    }

  _rotateBy(da) {
    this.cam.orbitAngle += da;
    this.cam.notifyUserRotated?.();
    this.cam.update?.();
  }

  _zoomBy(dz) {
    const c = this.cam;
    c.orbitDistance = Math.max(c.minDistance, Math.min(c.maxDistance, c.orbitDistance + dz));
    this.cam.notifyUserRotated?.();
    this.cam.update?.();
  }
}