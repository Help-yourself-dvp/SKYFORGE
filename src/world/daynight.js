import * as THREE from 'three';
import { DAY_LENGTH } from '../config.js';

const CA = new THREE.Color();
const CB = new THREE.Color();
const CC = new THREE.Color();
const CD = new THREE.Color();
const CE = new THREE.Color();
const CF = new THREE.Color();

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
    this.sunIntensity = 1.2;
    this.hemiIntensity = 1.15;
    this.fillIntensity = 0.48;
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

    const dawn = this._pulse(t, 0.22, 0.09);
    const dusk = this._pulse(t, 0.78, 0.09);
    const day = THREE.MathUtils.clamp(elev, 0, 1);

    // Richer palette: deep indigo night -> clear azure day; warm earth ground.
    this.zenith.setHex(0x141c38).lerp(CA.setHex(0x5f9cc0), day);
    this.horizon.setHex(0x241f36);
    if (dawn > 0) this.horizon.lerp(CB.setHex(0xf2b88e), dawn * 0.9);
    if (dusk > 0) this.horizon.lerp(CC.setHex(0xc96a3e), dusk * 0.95);
    if (day > 0.18) this.horizon.lerp(CD.setHex(0xe8d2a8), (day - 0.18) * 0.85);

    this.sunColor.setHex(0xfff0c8);
    if (dusk > 0.2) this.sunColor.lerp(CE.setHex(0xe8964a), dusk);
    if (dawn > 0.2) this.sunColor.lerp(CF.setHex(0xffc8a0), dawn);

    this.sunIntensity = 0.2 + day * 1.25;
    this.hemiIntensity = 0.6 + day * 0.8;
    this.fillIntensity = 0.26 + day * 0.34;
    this.ground.setHex(0x4e4232).lerp(CB.setHex(0x6a5a42), day * 0.6);
    this.fog.copy(this.horizon).lerp(CA.setHex(0xa8bcbe), 0.5);
    this.zenith.lerp(CB.setHex(0x8ec4dc), 0.16);
    this.horizon.lerp(CC.setHex(0xe6d2b0), 0.1);
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
