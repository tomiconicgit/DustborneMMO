// file: src/engine/input/VirtualJoystick.js
export default class VirtualJoystick {
  static instance = null;
  static create() {
    if (!VirtualJoystick.instance) VirtualJoystick.instance = new VirtualJoystick();
  }

  constructor() {
    this.vec = { x: 0, y: 0 };     // -1..1
    this.activeId = null;
    this.size = 120;               // base diameter
    this.knobSize = 62;
    this.radius = (this.size - this.knobSize) * 0.5; // travel radius

    const root = document.createElement('div');
    root.id = 'vj-root';
    Object.assign(root.style, {
      position: 'fixed',
      left: 'calc(env(safe-area-inset-left, 0px) + 14px)',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      width: `${this.size}px`,
      height: `${this.size}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
      backdropFilter: 'blur(8px)',
      zIndex: 10010,
      touchAction: 'none',
      WebkitTapHighlightColor: 'transparent',
    });

    const knob = document.createElement('div');
    knob.id = 'vj-knob';
    Object.assign(knob.style, {
      position: 'absolute',
      left: `${(this.size - this.knobSize) / 2}px`,
      top: `${(this.size - this.knobSize) / 2}px`,
      width: `${this.knobSize}px`,
      height: `${this.knobSize}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.9)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
      transition: 'transform 80ms linear',
      transform: 'translate(0,0)',
    });

    root.appendChild(knob);
    document.body.appendChild(root);

    this.root = root;
    this.knob = knob;

    root.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp, { passive: false });
    window.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  onDown = (e) => {
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    this.root.setPointerCapture?.(e.pointerId);
    this._updateFrom(e);
  };

  onMove = (e) => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    this._updateFrom(e);
  };

  onUp = (e) => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.vec.x = this.vec.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.root.releasePointerCapture?.(e.pointerId);
    window.dispatchEvent(new CustomEvent('joystick:change', { detail: { x: 0, y: 0 } }));
    window.dispatchEvent(new Event('joystick:end'));
  };

  _updateFrom(e) {
    const rect = this.root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.radius);
    const nx = len > 0 ? (dx / len) : 0;
    const ny = len > 0 ? (dy / len) : 0;

    const tx = nx * clamped;
    const ty = ny * clamped;

    this.knob.style.transform = `translate(${tx}px, ${ty}px)`;

    // Normalized vector (screen space y-down -> convert to y-up for game)
    this.vec.x = nx;        // right +
    this.vec.y = -ny;       // up +
    window.dispatchEvent(new CustomEvent('joystick:change', { detail: { x: this.vec.x, y: this.vec.y } }));
  }

  getVector() { return { ...this.vec }; }
}