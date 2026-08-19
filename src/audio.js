export class AudioSys {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.sfx = null;
    this.amb = null;
    this.ui = null;
    this.music = null;
    this.comp = null;
    this._amb = {};
    this._motor = null;
    this._time = 0;
    this.muted = false;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.master.connect(this.comp);
    this.comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = 0.35;
    this.amb.connect(this.master);
    this.ui = this.ctx.createGain();
    this.ui.gain.value = 0.45;
    this.ui.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.18;
    this.music.connect(this.master);
    this.ready = true;
    this._startDrone();
    this._startAmb();
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _osc(type, freq, t, dur, gain, dest, slide) {
    if (!this.ready || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(t, dur, gain, dest, bpFreq, q) {
    if (!this.ready || this.muted) return;
    const n = this.ctx.createBufferSource();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = bpFreq || 800;
    f.Q.value = q || 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    n.start(t);
    n.stop(t + dur + 0.02);
  }

  play(name, extra = 1) {
    this.resume();
    if (!this.ready) return;
    const t = this._now();
    switch (name) {
      case 'foot_grass':
        this._noise(t, 0.08, 0.12 * extra, this.sfx, 420, 0.6);
        break;
      case 'foot_stone':
        this._noise(t, 0.07, 0.16 * extra, this.sfx, 900, 1.1);
        this._osc('triangle', 140, t, 0.05, 0.04, this.sfx);
        break;
      case 'foot_wood':
        this._osc('triangle', 180, t, 0.06, 0.07, this.sfx, 90);
        this._noise(t, 0.06, 0.08, this.sfx, 600, 0.8);
        break;
      case 'jump':
        this._osc('sine', 220, t, 0.12, 0.08, this.sfx, 140);
        break;
      case 'land':
        this._noise(t, 0.12, 0.2, this.sfx, 280, 0.5);
        break;
      case 'grab':
        this._osc('sine', 320, t, 0.08, 0.07, this.sfx, 200);
        break;
      case 'drop':
        this._noise(t, 0.1, 0.12, this.sfx, 200, 0.4);
        break;
      case 'throw':
        this._osc('sawtooth', 180, t, 0.14, 0.06, this.sfx, 70);
        this._noise(t, 0.1, 0.1, this.sfx, 700, 0.5);
        break;
      case 'wood_hit':
        this._osc('triangle', 160, t, 0.1, 0.1, this.sfx, 70);
        this._noise(t, 0.08, 0.16, this.sfx, 500, 0.7);
        break;
      case 'tree_fall':
        this._noise(t, 0.7, 0.28, this.sfx, 180, 0.4);
        this._osc('sine', 70, t, 0.6, 0.12, this.sfx, 40);
        break;
      case 'stone_crack':
        this._noise(t, 0.16, 0.22, this.sfx, 1100, 1.4);
        this._osc('square', 90, t, 0.08, 0.05, this.sfx);
        break;
      case 'snap':
        this._osc('sine', 540, t, 0.08, 0.08, this.ui, 720);
        this._noise(t, 0.05, 0.06, this.sfx, 2000, 2);
        break;
      case 'launch':
        this._osc('sawtooth', 90, t, 0.3, 0.08, this.sfx, 50);
        break;
      case 'ui':
        this._osc('sine', 660, t, 0.05, 0.05, this.ui);
        break;
      case 'fire':
        this._noise(t, 0.2, 0.08, this.amb, 400, 0.5);
        break;
      case 'growl':
        this._osc('sawtooth', 70, t, 0.35, 0.08, this.sfx, 40);
        break;
      case 'hurt':
        this._osc('square', 180, t, 0.12, 0.07, this.sfx, 80);
        break;
      case 'craft':
        this._osc('triangle', 420, t, 0.12, 0.07, this.ui, 280);
        break;
      default:
        this._osc('sine', 240, t, 0.06, 0.04, this.ui);
    }
  }

  setMotor(rpm) {
    this.resume();
    if (!this.ready) return;
    if (!this._motor) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      o.start();
      this._motor = { o, f, g };
    }
    const t = this._now();
    const on = rpm > 0.04;
    this._motor.o.frequency.setTargetAtTime(55 + rpm * 90, t, 0.08);
    this._motor.f.frequency.setTargetAtTime(240 + rpm * 400, t, 0.1);
    this._motor.g.gain.setTargetAtTime(on ? 0.035 + rpm * 0.05 : 0.0001, t, 0.08);
  }

  _startDrone() {
    const t = this._now();
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';
    o1.frequency.value = 72;
    o2.frequency.value = 108.2;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    const g = this.ctx.createGain();
    g.gain.value = 0.04;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.music);
    o1.start(t);
    o2.start(t);
    this._drone = { o1, o2, f, g };
  }

  _startAmb() {
    const t = this._now();
    const src = this.ctx.createBufferSource();
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.03;
    src.connect(f);
    f.connect(g);
    g.connect(this.amb);
    src.start(t);
    this._wind = { src, f, g };
  }

  update(dt, { wind, night, nearWater, fire, rain }) {
    if (!this.ready) return;
    this._time += dt;
    if (this._wind) {
      this._wind.f.frequency.setTargetAtTime(280 + (wind || 1) * 90 + (rain ? 120 : 0), this._now(), 0.3);
      this._wind.g.gain.setTargetAtTime(0.025 + (wind || 1) * 0.012 + (nearWater ? 0.02 : 0) + (night ? 0.01 : 0), this._now(), 0.4);
    }
    if (this._drone) {
      this._drone.g.gain.setTargetAtTime(night > 0.5 ? 0.055 : 0.03, this._now(), 0.6);
    }
    if (fire && Math.random() < dt * 3) this.play('fire');
  }

  dispose() {
    try { this.ctx?.close(); } catch (_) { /* */ }
  }
}
