// file: src/engine/input/CameraTouchControls.js
// Joystick-only build: this module now handles ONLY orbit rotate + pinch/scroll zoom.
// No ground picking, no tap-to-move.
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    // Prevent the browser from hijacking gestures (scroll/zoom)
    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    // Gesture state
    this.activeId = null;
    this.startX = this.startY = 0;
    this.lastX = this.lastY = 0;
    this.moved = false;

    this.secondId = null;   // for pinch
    this.pinchLast = null;

    // Bind events
    this.canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onMove,  { passive: false });
    this.canvas.addEventListener('pointerup',   this.onUp,    { passive: false });
    this.canvas.addEventListener('pointercancel', this.onUp,  { passive: false });
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  onDown = (e) => {
    // Primary pointer begins rotate gesture
    if (this.activeId === null) {
      this.activeId = e.pointerId;
      this.startX = this.lastX = e.clientX;
      this.startY = this.lastY = e.clientY;
      this.moved = false;
      this.canvas.setPointerCapture?.(e.pointerId);
      return;
    }
    // Second pointer begins pinch gesture
    if (this.secondId === null && e.pointerId !== this.activeId) {
      this.secondId = e.pointerId;
      this.pinchLast = this._pinchDist(e);
    }
  };

  onMove = (e) => {
    // Pinch zoom (two pointers active)
    if (this.activeId !== null && this.secondId !== null) {
      e.preventDefault();
      const d = this._pinchDist(e);
      if (this.pinchLast != null) {
        const delta = d - this.pinchLast;
        this._zoomBy(-delta * 0.01);
      }
      this.pinchLast = d;
      return;
    }

    // Single-finger rotate
    if (e.pointerId === this.activeId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY; // reserved if you want tilt later
      if (Math.hypot(dx, dy) > 0) this.moved = true;
      if (this.moved) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    // End pinch if secondary pointer lifted
    if (e.pointerId === this.secondId) {
      this.secondId = null;
      this.pinchLast = null;
      return;
    }
    // End rotate if primary lifted
    if (e.pointerId === this.activeId) {
      this.canvas.releasePointerCapture?.(e.pointerId);
      this.activeId = null;
      this.moved = false;
    }
  };

  onWheel = (e) => this._zoomBy(e.deltaY * 0.001);

  // Distance between current primary pointer and this event (used as "second" point)
  _pinchDist(e) {
    // We approximate pinch by measuring the delta between current primary and this secondary move
    const ax = this.lastX, ay = this.lastY;
    const bx = e.clientX, by = e.clientY;
    return Math.hypot(ax - bx, ay - by);
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