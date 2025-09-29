// file: src/engine/input/CameraTouchControls.js
import GroundPicker from './GroundPicker.js';
import Camera from '../rendering/Camera.js';

export default class CameraTouchControls {
  static create() { new CameraTouchControls(); }

  constructor() {
    this.cam = Camera.main;
    this.tapMaxMs = 220;          // max duration to count as a tap
    this.tapMaxMove = 10;         // px threshold for tap vs drag
    this.isDragging = false;

    // Touch state
    this.touchStartTime = 0;
    this.startX = 0; this.startY = 0;
    this.lastX = 0;
    this.pinchLast = null;

    // Mouse state
    this.mouseDown = false;
    this.mouseStartTime = 0;
    this.mStartX = 0; this.mStartY = 0;

    // Touch events
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    window.addEventListener('touchend',   this.onTouchEnd,   { passive: false });

    // Mouse events
    window.addEventListener('mousedown', this.onMouseDown, { passive: false });
    window.addEventListener('mousemove', this.onMouseMove, { passive: false });
    window.addEventListener('mouseup',   this.onMouseUp,   { passive: false });
    window.addEventListener('wheel',     this.onWheel,     { passive: true  });
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
      // Begin pinch
      this.pinchLast = this._pinchDistance(e.touches);
      this.isDragging = false;
    }
  };

  onTouchMove = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const dist = this._pinchDistance(e.touches);
      if (this.pinchLast != null) {
        const delta = dist - this.pinchLast;
        this._zoomBy(-delta * 0.01);  // invert feels natural
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
        this._rotateBy(-dx * 0.01);   // drag left/right to rotate
      }

      this.lastX = t.clientX;
    }
  };

  onTouchEnd = (e) => {
    // A tap is: single touch, short time, tiny move, no pinch
    const dt = performance.now() - this.touchStartTime;
    const wasTap = !this.isDragging && this.pinchLast === null && dt <= this.tapMaxMs;

    if (wasTap) {
      const point = GroundPicker.instance?.pick(this.startX, this.startY);
      if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
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
    if (e.button !== 0) return; // left only
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
      const point = GroundPicker.instance?.pick(this.mStartX, this.mStartY);
      if (point) window.dispatchEvent(new CustomEvent('ground:tap', { detail: { point } }));
    }

    this.mouseDown = false;
    this._mDragging = false;
  };

  onWheel = (e) => {
    this._zoomBy(e.deltaY * 0.001); // scroll to zoom
  };

  /* ------------- Camera ops ------------- */

  _rotateBy(deltaAngle) {
    if (!this.cam) return;
    this.cam.orbitAngle += deltaAngle;
    this.cam.update?.();
  }

  _zoomBy(delta) {
    if (!this.cam) return;
    this.cam.orbitDistance = Math.max(this.cam.minDistance, Math.min(this.cam.maxDistance, this.cam.orbitDistance + delta));
    this.cam.update?.();
  }
}