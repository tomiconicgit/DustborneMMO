// file: src/engine/input/CameraTouchControls.js
import GroundPicker from './GroundPicker.js';
import Camera from '../rendering/Camera.js';
import Viewport from '../core/Viewport.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.tapMaxMs = 220;     // max duration to register as a tap
    this.tapMaxMove = 10;    // px movement allowed for a tap
    this.isDragging = false;

    // Touch state
    this.touchStartTime = 0;
    this.startX = 0; this.startY = 0;
    this.lastX = 0;
    this.pinchLast = null;

    // Mouse state
    this.mouseDown = false;
    this.mouseStartTime = 0;
    this.mStartX = 0; this.mStartY = 0; this._mx = 0; this._my = 0;
    this._mDragging = false;

    // Bind to the actual canvas so rect math stays correct.
    this.canvas = Viewport.instance?.renderer?.domElement || window;

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    this.canvas.addEventListener('touchend',   this.onTouchEnd,   { passive: false });

    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown, { passive: false });
    this.canvas.addEventListener('mousemove', this.onMouseMove, { passive: false });
    this.canvas.addEventListener('mouseup',   this.onMouseUp,   { passive: false });
    this.canvas.addEventListener('wheel',     this.onWheel,     { passive: true  });
  }

  /* ---------------- Touch ---------------- */

  onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.touchStartTime = performance.now();
      this.startX = this.lastX = t.clientX;
      this.startY = t.clientY;
      this.isDragging = false;
      this.pinchLast = null;
    } else if (e.touches.length === 2) {
      this.pinchLast = this._pinchDistance(e.touches);
      this.isDragging = false;
    }
  };

  onTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = this._pinchDistance(e.touches);
      if (this.pinchLast != null) {
        const delta = dist - this.pinchLast;
        this._zoomBy(-delta * 0.01);
      }
      this.pinchLast = dist;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - this.lastX;
      const moved = Math.hypot(t.clientX - this.startX, t.clientY - this.startY);

      if (moved > this.tapMaxMove) this.isDragging = true;

      if (this.isDragging) {
        e.preventDefault();
        this._rotateBy(-dx * 0.01);
      }

      this.lastX = t.clientX;
    }
  };

  onTouchEnd = (e) => {
    const dt = performance.now() - this.touchStartTime;
    const wasTap = !this.isDragging && this.pinchLast === null && dt <= this.tapMaxMs;

    if (wasTap) {
      const t = e.changedTouches?.[0];
      if (t) {
        const point = GroundPicker.instance?.pick(t.clientX, t.clientY);
        if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
      }
    }

    this.isDragging = false;
    this.pinchLast = null;
  };

  _pinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  /* ---------------- Mouse ---------------- */

  onMouseDown = (e) => {
    if (e.button !== 0) return;
    this.mouseDown = true;
    this.mouseStartTime = performance.now();
    this.mStartX = this._mx = e.clientX;
    this.mStartY = this._my = e.clientY;
    this._mDragging = false;
  };

  onMouseMove = (e) => {
    if (!this.mouseDown) return;
    const dx = e.clientX - this._mx;
    const moved = Math.hypot(e.clientX - this.mStartX, e.clientY - this.mStartY);
    if (moved > this.tapMaxMove) this._mDragging = true;
    if (this._mDragging) {
      e.preventDefault();
      this._rotateBy(-dx * 0.01);
    }
    this._mx = e.clientX; this._my = e.clientY;
  };

  onMouseUp = (e) => {
    if (e.button !== 0) return;
    const dt = performance.now() - this.mouseStartTime;
    const wasClick = !this._mDragging && dt <= this.tapMaxMs;
    if (wasClick) {
      const point = GroundPicker.instance?.pick(e.clientX, e.clientY);
      if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
    }
    this.mouseDown = false;
    this._mDragging = false;
  };

  onWheel = (e) => {
    this._zoomBy(e.deltaY * 0.001);
  };

  /* ------------- Camera ops ------------- */

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