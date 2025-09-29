// file: src/engine/input/CameraTouchControls.js
import GroundPicker from './GroundPicker.js';
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    // Ensure the browser doesn't hijack gestures (critical on iOS)
    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    // Gesture thresholds
    this.tapMaxMs   = 280;
    this.tapMaxMove = 12; // px

    // Pointer state
    this.activeId = null;
    this.startX = 0; this.startY = 0;
    this.lastX  = 0; this.lastY  = 0;
    this.startTime = 0;
    this.moved = false;

    // Pinch (second pointer)
    this.secondId = null;
    this.pinchLast = null;

    // Events
    this.canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onMove,  { passive: false });
    this.canvas.addEventListener('pointerup',   this.onUp,    { passive: false });
    this.canvas.addEventListener('pointercancel', this.onUp,  { passive: false });
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });

    // Pick helper
    GroundPicker.create();
  }

  onDown = (e) => {
    // Only act on primary buttons/touches
    if (e.button !== undefined && e.button !== 0) return;

    // If no active pointer, make this one primary
    if (this.activeId === null) {
      this.activeId = e.pointerId;
      this.startX = this.lastX = e.clientX;
      this.startY = this.lastY = e.clientY;
      this.startTime = performance.now();
      this.moved = false;
      this.canvas.setPointerCapture?.(e.pointerId);
      return;
    }

    // If we already have a primary, this becomes the second pointer (pinch)
    if (this.secondId === null && e.pointerId !== this.activeId) {
      this.secondId = e.pointerId;
      this.pinchLast = this._pinchDistanceFromPointers(e);
    }
  };

  onMove = (e) => {
    // Pinch zoom when two pointers active
    if (this.activeId !== null && this.secondId !== null) {
      e.preventDefault();
      const dist = this._pinchDistanceFromPointers(e);
      if (this.pinchLast != null) {
        const delta = dist - this.pinchLast;
        this._zoomBy(-delta * 0.01);
      }
      this.pinchLast = dist;
      return;
    }

    // Single-pointer rotate
    if (e.pointerId === this.activeId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const moved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (moved > this.tapMaxMove) this.moved = true;

      if (this.moved) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }

      this.lastX = e.clientX; this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    // Ending second pointer?
    if (e.pointerId === this.secondId) {
      this.secondId = null;
      this.pinchLast = null;
      return;
    }

    // Ending primary pointer
    if (e.pointerId === this.activeId) {
      const dt = performance.now() - this.startTime;
      const wasTap = !this.moved && dt <= this.tapMaxMs;

      if (wasTap) {
        const point = GroundPicker.instance?.pick(e.clientX, e.clientY);
        if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
      }

      this.canvas.releasePointerCapture?.(e.pointerId);
      this.activeId = null;
      this.moved = false;
    }
  };

  onWheel = (e) => {
    this._zoomBy(e.deltaY * 0.001);
  };

  _pinchDistanceFromPointers(e) {
    // We compute distance using current positions of the two pointers tracked by the element.
    // PointerEvent doesn't give both pointers in one event; query active pointers from element.
    const pList = (e.currentTarget && e.currentTarget.getPointerList)
      ? e.currentTarget.getPointerList() : null;
    // Fallback: estimate from last known primary + this event (good enough)
    const ax = this.lastX, ay = this.lastY;
    const bx = e.clientX, by = e.clientY;
    return Math.hypot(ax - bx, ay - by);
  }

  _rotateBy(deltaAngle) {
    if (!this.cam) return;
    this.cam.orbitAngle += deltaAngle;
    this.cam.update?.();
  }

  _zoomBy(delta) {
    if (!this.cam) return;
    const c = this.cam;
    c.orbitDistance = Math.max(c.minDistance, Math.min(c.maxDistance, c.orbitDistance + delta));
    c.update?.();
  }
}