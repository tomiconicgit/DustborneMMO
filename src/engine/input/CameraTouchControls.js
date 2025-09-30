// file: src/engine/input/CameraTouchControls.js
// One-finger drag = orbit rotate, two-finger pinch = zoom,
// light tap = pick ground & dispatch 'ground:tap'.
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';
import GroundPicker from './GroundPicker.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;
    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    GroundPicker.create();

    // Tap detection
    this.tapMaxMs = 260;
    this.tapMaxMove = 10;

    // Pointer tracking
    this.primaryId = null;
    this.startX = this.startY = 0;
    this.lastX = this.lastY = 0;
    this.startTime = 0;
    this.moved = false;

    // Multi-touch for pinch
    this.points = new Map();
    this.lastPinchDist = null;

    // Events
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
      this.startX = this.lastX = e.clientX;
      this.startY = this.lastY = e.clientY;
      this.startTime = performance.now();
      this.moved = false;
      this.canvas.setPointerCapture?.(e.pointerId);
    }

    if (this.points.size === 2) {
      this.lastPinchDist = this._currentPinchDistance();
    }
  };

  onMove = (e) => {
    if (!this.points.has(e.pointerId)) return;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.points.size === 2) {
      e.preventDefault();
      const d = this._currentPinchDistance();
      if (this.lastPinchDist != null && isFinite(d)) {
        const delta = d - this.lastPinchDist;
        this._zoomBy(-delta * 0.01);
      }
      this.lastPinchDist = d;
      return;
    }

    if (e.pointerId === this.primaryId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const movedMag = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (movedMag > this.tapMaxMove) this.moved = true;

      if (this.moved) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    const wasPrimary = e.pointerId === this.primaryId;

    if (wasPrimary) {
      const dt = performance.now() - this.startTime;
      const movedMag = Math.hypot(this.lastX - this.startX, this.lastY - this.startY);
      const wasTap = movedMag <= this.tapMaxMove && dt <= this.tapMaxMs;

      if (wasTap) {
        const point = GroundPicker.instance?.pick(e.clientX, e.clientY);
        if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
      }

      this.canvas.releasePointerCapture?.(e.pointerId);
      this.primaryId = null;
      this.moved = false;
    }

    this.points.delete(e.pointerId);
    if (this.points.size < 2) this.lastPinchDist = null;

    if (!this.primaryId && this.points.size === 1) {
      const [id, pt] = this.points.entries().next().value;
      this.primaryId = id;
      this.startX = this.lastX = pt.x;
      this.startY = this.lastY = pt.y;
      this.startTime = performance.now();
      this.moved = false;
    }
  };

  onWheel = (e) => this._zoomBy(e.deltaY * 0.001);

  _currentPinchDistance() {
    if (this.points.size !== 2) return null;
    const it = this.points.values();
    const a = it.next().value;
    const b = it.next().value;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _rotateBy(da) { this.cam.orbitAngle += da; this.cam.update?.(); }
  _zoomBy(dz) {
    const c = this.cam;
    c.orbitDistance = Math.max(c.minDistance, Math.min(c.maxDistance, c.orbitDistance + dz));
    this.cam.update?.();
  }
}