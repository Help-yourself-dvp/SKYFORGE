export class Input {
  constructor(root) {
    this.root = root;
    this.keys = Object.create(null);
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.jump = false;
    this.jumpPressed = false;
    this.action = false;
    this.actionPressed = false;
    this.actionHeld = false;
    this.build = false;
    this.buildPressed = false;
    this.inventory = false;
    this.inventoryPressed = false;
    this.pausePressed = false;
    this.attack = false;
    this.attackPressed = false;
    this.rotateL = false;
    this.rotateR = false;
    this.backPressed = false;
    this._stickId = null;
    this._lookId = null;
    this._stickOrigin = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };
    this._pointers = new Map();
    this.charge = 0;
    this.enabled = true;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this._key(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this._key(e, false), { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerdown', (e) => this._pdown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this._pmove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this._pup(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this._pup(e), { passive: false });
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('popstate', () => {
      this.backPressed = true;
    });
    document.addEventListener('sky-back', () => {
      this.backPressed = true;
    });
    try {
      const cap = typeof window !== 'undefined' ? window.Capacitor : null;
      const app = cap && cap.Plugins && cap.Plugins.App;
      if (app && app.addListener) app.addListener('backButton', () => { this.backPressed = true; });
    } catch (e) {
      console.warn('capacitor back', e);
    }
  }

  _key(e, down) {
    const k = e.code;
    this.keys[k] = down;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
      e.preventDefault();
    }
    if (down) {
      if (k === 'Space') this.jumpPressed = true;
      if (k === 'KeyE') this.actionPressed = true;
      if (k === 'KeyB') this.buildPressed = true;
      if (k === 'KeyI' || k === 'Tab') {
        this.inventoryPressed = true;
        e.preventDefault();
      }
      if (k === 'Escape' || k === 'Backquote') this.pausePressed = true;
      if (k === 'KeyF' || k === 'KeyQ') this.attackPressed = true;
      if (k === 'KeyR') this.rotateL = true;
      if (k === 'KeyT') this.rotateR = true;
    }
  }

  _uiIgnore(el) {
    return el && el.closest && el.closest('[data-ui]');
  }

  _pdown(e) {
    if (!this.enabled) return;
    if (this._uiIgnore(e.target)) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const w = window.innerWidth;
    const touchStick = e.pointerType !== 'mouse' && e.clientX < w * 0.42 && this._stickId == null;
    if (touchStick) {
      this._stickId = e.pointerId;
      this._stickOrigin.x = e.clientX;
      this._stickOrigin.y = e.clientY;
      this._updateStick(e.clientX, e.clientY);
      try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    } else if (this._lookId == null) {
      this._lookId = e.pointerId;
      this._lookLast.x = e.clientX;
      this._lookLast.y = e.clientY;
      try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    }
  }

  _pmove(e) {
    if (!this._pointers.has(e.pointerId)) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerId === this._stickId) this._updateStick(e.clientX, e.clientY);
    if (e.pointerId === this._lookId) {
      const dx = e.clientX - this._lookLast.x;
      const dy = e.clientY - this._lookLast.y;
      this._lookLast.x = e.clientX;
      this._lookLast.y = e.clientY;
      this.look.x += dx * 0.0055;
      this.look.y += dy * 0.0042;
    }
  }

  _pup(e) {
    this._pointers.delete(e.pointerId);
    if (e.pointerId === this._stickId) {
      this._stickId = null;
      this.move.x = 0;
      this.move.y = 0;
    }
    if (e.pointerId === this._lookId) this._lookId = null;
  }

  _updateStick(x, y) {
    const dx = x - this._stickOrigin.x;
    const dy = y - this._stickOrigin.y;
    const max = 54;
    const len = Math.hypot(dx, dy);
    const dead = 8;
    if (len < dead) {
      this.move.x = 0;
      this.move.y = 0;
      return;
    }
    const k = Math.min(1, (len - dead) / (max - dead));
    this.move.x = (dx / Math.max(len, 0.001)) * k;
    this.move.y = (-dy / Math.max(len, 0.001)) * k;
  }

  press(name) {
    if (name === 'jump') this.jumpPressed = true;
    if (name === 'action') {
      this.actionPressed = true;
      this.actionHeld = true;
    }
    if (name === 'build') this.buildPressed = true;
    if (name === 'inventory') this.inventoryPressed = true;
    if (name === 'pause') this.pausePressed = true;
    if (name === 'attack') this.attackPressed = true;
    if (name === 'rotL') this.rotateL = true;
    if (name === 'rotR') this.rotateR = true;
    if (name === 'flip') this.actionPressed = true;
  }

  release(name) {
    if (name === 'action') this.actionHeld = false;
  }

  beginFrame() {
    const k = this.keys;
    let mx = this._stickId != null ? this.move.x : 0;
    let my = this._stickId != null ? this.move.y : 0;
    if (k.KeyA || k.ArrowLeft) mx -= 1;
    if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyW || k.ArrowUp) my += 1;
    if (k.KeyS || k.ArrowDown) my -= 1;
    const ml = Math.hypot(mx, my);
    if (ml > 1) {
      mx /= ml;
      my /= ml;
    }
    this.axis = { x: mx, y: my };
    this.jump = !!(k.Space || this.jumpPressed);
    this.action = !!(k.KeyE || this.actionHeld);
    this.attack = !!(k.KeyF || k.KeyQ);
    if (k.KeyE) this.actionHeld = true;
  }

  consumeLook() {
    const x = this.look.x;
    const y = this.look.y;
    this.look.x = 0;
    this.look.y = 0;
    return { x, y };
  }

  endFrame() {
    this.jumpPressed = false;
    this.actionPressed = false;
    this.buildPressed = false;
    this.inventoryPressed = false;
    this.pausePressed = false;
    this.attackPressed = false;
    this.rotateL = false;
    this.rotateR = false;
    this.backPressed = false;
    if (!this.keys.KeyE && !this.actionHeld) this.action = false;
  }

  reset() {
    this.keys = Object.create(null);
    this.move.x = 0;
    this.move.y = 0;
    this._stickId = null;
    this._lookId = null;
    this.actionHeld = false;
  }
}
