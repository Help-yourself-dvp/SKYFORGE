import * as THREE from 'three';
import { DAY_LENGTH } from '../config.js';

export class DayNight {
  constructor() {
    this.timeOfDay = 0.28;
    this.speed = 1;
    this.paused = false;
    this.zenith = new THREE.Color(0x6ea8c4);
    this.horizon = new THREE.Color(0xd8c4a0);
    this.sunColor = new THREE.Color(0xffe2b0);
    this.ground = new THREE.Color(0x3d3428);
    this.fog = new THREE.Color(0x8aa4b0);
    this.sunIntensity = 1.3;
    this.hemiIntensity = 0.55;
    this.night = 0;
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.2);
  }

  setTime(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this._eval();
  }

  update(dt) {
    if (this.paused) return;
    this.timeOfDay = (this.timeOfDay + (dt * this.speed) / DAY_LENGTH) % 1;
    this._eval();
  }

  _eval() {
    const t = this.timeOfDay;
    const ang = (t - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.22).normalize();
    const elev = this.sunDir.y;
    this.night = THREE.MathUtils.clamp(1 - (elev + 0.12) / 0.45, 0, 1);

    const dawn = this._pulse(t, 0.22, 0.08);
    const dusk = this._pulse(t, 0.78, 0.08);
    const day = THREE.MathUtils.clamp(elev, 0, 1);

    this.zenith.setHex(0x1a2340).lerp(new THREE.Color(0x6ea8c4), day);
    this.horizon.setHex(0x2a2438);
    if (dawn > 0) this.horizon.lerp(new THREE.Color(0xf0b896), dawn);
    if (dusk > 0) this.horizon.lerp(new THREE.Color(0xc46a3a), dusk);
    if (day > 0.2) this.horizon.lerp(new THREE.Color(0xd8c4a0), (day - 0.2) * 0.8);

    this.sunColor.setHex(0xffe2b0);
    if (dusk > 0.2) this.sunColor.lerp(new THREE.Color(0xe09a4a), dusk);
    if (dawn > 0.2) this.sunColor.lerp(new THREE.Color(0xffc8a0), dawn);

    this.sunIntensity = 0.05 + day * 1.35;
    this.hemiIntensity = 0.18 + day * 0.42;
    this.fog.copy(this.horizon).lerp(this.zenith, 0.35);
  }

  _pulse(t, c, w) {
    const d = Math.min(Math.abs(t - c), 1 - Math.abs(t - c));
    return THREE.MathUtils.clamp(1 - d / w, 0, 1);
  }

  isNight() {
    return this.night > 0.55;
  }

  isDangerNight() {
    return this.timeOfDay > 0.82 || this.timeOfDay < 0.16;
  }
}
