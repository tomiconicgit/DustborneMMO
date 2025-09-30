// file: src/engine/input/CameraTouchControls.js
// Orbit rotate (one-finger drag) + pinch/scroll zoom + safe tap-to-move.
// - Tap is only recognized if there was exactly one finger, short time, and tiny movement.
// - Any pinch or significant drag cancels the tap.
// - Proper two-pointer tracking avoids "jumpy" zoom deltas.

import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';
import GroundPicker from './GroundPicker.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    // Ensure GroundPicker exists for tap raycasts
    GroundPicker.create();

    // Avoid browser gestures interfering
    if (this.canvas.style) this.canvas.style.touchAction = 'none';

    // ----- gesture state -----
    // active pointers: Map<pointerId, {x,y}>
    this.points = new Map();

    // primary finger tracking for rotate/tap
    this.primaryId = null;
    this.lastX = 0;
    this.lastY = 0;

    // tap detection (for primary)
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.movedBeyondTap = false;
    this.everPinchedThisGesture = false;

    // pinch tracking
    this.lastPinchDist = null;

    // thresholds
    this.tapMaxMs = 250;     // <= this to count as tap
    this.tapMaxMove = 8;     // <= px movement to count as tap
    this.rotateSensitivity = 0.01; // radians per px
    this.pinchZoomScale   = 0.01;  // orbitDistance delta per px distance change
    this.wheelZoomScale   = 0.001; // orbitDistance delta per wheel unit

    // bind events
    this.canvas.addEventListener('pointerdown',  this.onDown, { passive: false });
    this.canvas.addEventListener('pointermove',  this.onMove, { passive: false });
    this.canvas.addEventListener('pointerup',    this.onUp,   { passive: false });
    this.canvas.addEventListener('pointercancel',this.onUp,   { passive: false });
    this.canvas.addEventListener('wheel',        this.onWheel, { passive: true });
  }

  // ----- helpers -----
  _currentPinchDistance() {
    if (this.points.size !== 2) return null;
    const it = this.points.values();
    const a = it.next().value;
    const b = it.next().value;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _rotateBy(deltaAngle) {
    this.cam.orbitAngle += deltaAngle;
    this.cam.notifyUserRotated?.();
    this.cam.update?.();
  }

  _zoomBy(delta) {
    const c = this.cam;
    c.orbitDistance = Math.max(c.minDistance, Math.min(c.maxDistance, c.orbitDistance + delta));
    this.cam.notifyUserRotated?.();
    this.cam.update?.();
  }

  // ----- events -----
  onDown = (e) => {
    // record/update this pointer
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // choose primary if none
    if (this.primaryId === null) {
      this.primaryId = e.pointerId;
      this.lastX = this.startX = e.clientX;
      this.lastY = this.startY = e.clientY;
      this.startTime = performance.now();
      this.movedBeyondTap = false;
      this.everPinchedThisGesture = false;
      this.canvas.setPointerCapture?.(e.pointerId);
    }

    // if we just reached 2 pointers, seed pinch
    if (this.points.size === 2) {
      this.lastPinchDist = this._currentPinchDistance();
      this.everPinchedThisGesture = true; // mark so we won't treat this as a tap later
    }
  };

  onMove = (e) => {
    if (!this.points.has(e.pointerId)) return;

    // update this pointer position
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // pinch zoom if two pointers
    if (this.points.size === 2) {
      e.preventDefault(); // stop page scroll/zoom
      const d = this._currentPinchDistance();
      if (d != null && this.lastPinchDist != null && isFinite(d) && isFinite(this.lastPinchDist)) {
        const delta = d - this.lastPinchDist;
        this._zoomBy(-delta * this.pinchZoomScale);
      }
      this.lastPinchDist = d;
      return;
    }

    // single-finger rotate (primary pointer only)
    if (e.pointerId === this.primaryId) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;

      // track total movement for tap cancellation
      const totalMoved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (totalMoved > this.tapMaxMove) this.movedBeyondTap = true;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault(); // avoid touch scrolling
        this._rotateBy(-dx * this.rotateSensitivity);
      }

      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  onUp = (e) => {
    const wasPrimary = (e.pointerId === this.primaryId);

    // remove pointer
    this.points.delete(e.pointerId);

    // stop pinch if fewer than 2 pointers remain
    if (this.points.size < 2) this.lastPinchDist = null;

    // evaluate tap only if this was the primary AND we never pinched AND no other pointer is down
    if (wasPrimary) {
      this.canvas.releasePointerCapture?.(e.pointerId);

      const dt = performance.now() - this.startTime;
      const totalMoved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      const isTap = (dt <= this.tapMaxMs) && (totalMoved <= this.tapMaxMove) && !this.everPinchedThisGesture && this.points.size === 0;

      if (isTap) {
        // true tap: ray-pick and dispatch a ground:tap with the world point
        const p = GroundPicker.instance?.pick(e.clientX, e.clientY);
        if (p) {
          window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point: p } }));
        }
      }

      // clear primary
      this.primaryId = null;
      this.movedBeyondTap = false;
      this.everPinchedThisGesture = false;
    }

    // if one finger remains, promote it to new primary (for continued rotate), but don't allow it to tap-emit immediately
    if (this.primaryId === null && this.points.size === 1) {
      const [id, pt] = this.points.entries().next().value;
      this.primaryId = id;
      this.lastX = this.startX = pt.x;
      this.lastY = this.startY = pt.y;
      this.startTime = performance.now();
      this.movedBeyondTap = false;
      // if we came from a pinch, keep this true so the next lift won't be interpreted as a tap
      // (we reset it only when the current primary lifts)
    }
  };

  onWheel = (e) => {
    this._zoomBy(e.deltaY * this.wheelZoomScale);
  };
}