import * as THREE from 'three';
import { WIND } from '../config.js';

export class Wind {
  constructor(rng) {
    this.rng = rng;
    this.vector = new THREE.Vector3(1.2, 0, 0.4);
    this.base = new THREE.Vector3(1.2, 0, 0.4);
    this.gust = 0;
    this.nextGust = rng.range(WIND.gustIntervalMin, WIND.gustIntervalMax);
    this.time = 0;
    this.strength = 1.4;
  }

  update(dt) {
    this.time += dt;
    this.nextGust -= dt;
    if (this.nextGust <= 0) {
      this.gust = 1;
      this.nextGust = this.rng.range(WIND.gustIntervalMin, WIND.gustIntervalMax);
      const a = this.rng.range(0, Math.PI * 2);
      this.base.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(WIND.base);
    }
    this.gust = Math.max(0, this.gust - dt * 0.35);
    const wobble = Math.sin(this.time * 0.35) * 0.25;
    const mag = WIND.base + this.gust * WIND.gustStrength + wobble;
    this.vector.copy(this.base).normalize().multiplyScalar(mag);
    this.strength = this.vector.length();
    return this.vector;
  }
}
