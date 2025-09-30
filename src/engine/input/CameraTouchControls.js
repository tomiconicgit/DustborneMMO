// file: src/engine/input/CameraTouchControls.js
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';
import GroundPicker from './GroundPicker.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam    = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    // allow us to handle touch gestures
    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    // tap detection
    this.tapMaxMs   = 280;   // max duration to count as tap
    this.tapMaxMove = 12;    // max pixels moved to count as tap

    // gesture state
    this.activeId  = null;
    this.startX    = 0;
    this.startY    = 0;
    this.lastX     = 0;
    this.lastY     = 0;
    this.startTime = 0;
    this.moved     = false;

    // pinch state
    this.secondId  = null;
    this.pinchLast = null;

    // listeners
    this.canvas.addEventListener('pointerdown', this.onDown,    { passive: false });
    this.canvas.addEventListener('pointermove', this.onMove,    { passive: false });
    this.canvas.addEventListener('pointerup',   this.onUp,      { passive: false });
    this.canvas.addEventListener('pointercancel', this.onUp,    { passive: false });
    this.canvas.addEventListener('wheel',       this.onWheel,   { passive: true  });

    // ensure picker exists
    GroundPicker.create();
  }

  onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    if (this.activeId === null) {
      this.activeId  = e.pointerId;
      this.startX    = this.lastX = e.clientX;
      this.startY    = this.lastY = e.clientY;
      this.startTime = performance.now();
      this.moved     = false;
      this.canvas.setPointerCapture?.(e.pointerId);
      return;
    }

    if (this.secondId === null && e.pointerId !== this.activeId) {
      this.secondId  = e.pointerId;
      this.pinchLast = this._pinchDist(e);
    }
  };

  onMove = (e) => {
    // pinch zoom with two pointers
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

    // single finger -> rotate
    if (e.pointerId === this.activeId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const movedPx = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (movedPx > this.tapMaxMove) this.moved = true;

      if (this.moved) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }

      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    // end pinch?
    if (e.pointerId === this.secondId) {
      this.secondId  = null;
      this.pinchLast = null;
      return;
    }

    // end primary
    if (e.pointerId === this.activeId) {
      const dt = performance.now() - this.startTime;
      const totalMove = Math.hypot(this.lastX - this.startX, this.lastY - this.startY);
      const wasTap = dt <= this.tapMaxMs && totalMove <= this.tapMaxMove;

      if (wasTap) {
        // raycast to ground and emit event Movement listens for
        const point = GroundPicker.instance?.pick(e.clientX, e.clientY);
        if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
      }

      this.canvas.releasePointerCapture?.(e.pointerId);
      this.activeId = null;
      this.moved = false;
    }
  };

  onWheel = (e) => this._zoomBy(e.deltaY * 0.001);

  _pinchDist(e) {
    // approximate pinch distance using last primary vs current secondary
    const ax = this.lastX, ay = this.lastY;
    const bx = e.clientX, by = e.clientY;
    return Math.hypot(ax - bx, ay - by);
  }

  _rotateBy(da) {
    const c = this.cam;
    c.orbitAngle += da;
    c.notifyUserRotated?.();
    c.update?.();
  }

  _zoomBy(dz) {
    const c = this.cam;
    c.orbitDistance = Math.max(c.minDistance, Math.min(c.maxDistance, c.orbitDistance + dz));
    c.notifyUserRotated?.();
    c.update?.();
  }
}