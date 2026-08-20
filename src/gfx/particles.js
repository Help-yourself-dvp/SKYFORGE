import * as THREE from 'three';

const KINDS = {
  pollen: { size: 0.055, color: 0xb8a45e, life: 6, gravity: 0.02 },
  firefly: { size: 0.09, color: 0xb8d06a, life: 5, gravity: 0 },
  chip: { size: 0.1, color: 0x8a6238, life: 0.9, gravity: 9 },
  grit: { size: 0.08, color: 0x8a8478, life: 0.8, gravity: 10 },
  spray: { size: 0.07, color: 0xb7d4d6, life: 0.7, gravity: 3 },
  mist: { size: 0.22, color: 0xcfd8d4, life: 2.4, gravity: -0.15 },
  rain: { size: 0.05, color: 0x9bb4c0, life: 1.1, gravity: 18 },
  spark: { size: 0.06, color: 0xffc56a, life: 0.45, gravity: 2 },
  dust: { size: 0.1, color: 0xb59a72, life: 0.7, gravity: 1.2 },
  fire: { size: 0.09, color: 0xff8a3a, life: 0.55, gravity: -2.4 },
};

const _c = new THREE.Color();

export class Particles {
  constructor(scene, quality = 1) {
    this.scene = scene;
    this.quality = quality;
    this.max = Math.min(220, Math.floor(280 * quality));
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.max * 3);
    const col = new Float32Array(this.max * 3);
    const size = new Float32Array(this.max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.geo = geo;
    this.pos = pos;
    this.col = col;
    this.size = size;
    this.items = [];
    this.free = [];
    this.mat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.userData.kind = 'particles';
    scene.add(this.points);
    this._emitAcc = 0;
  }

  _take() {
    return this.free.pop() || {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, gravity: 0, r: 1, g: 1, b: 1,
    };
  }

  emit(kind, origin, count = 8, vel = null) {
    const spec = KINDS[kind] || KINDS.dust;
    const n = Math.max(1, Math.floor(count * this.quality));
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) {
        const old = this.items.shift();
        this.free.push(old);
      }
      const p = this._take();
      p.x = origin.x + (Math.random() - 0.5) * 0.2;
      p.y = origin.y + (Math.random() - 0.5) * 0.2;
      p.z = origin.z + (Math.random() - 0.5) * 0.2;
      p.vx = (vel ? vel.x : 0) + (Math.random() - 0.5) * 2;
      p.vy = (vel ? vel.y : 0.4) + Math.random() * 1.2;
      p.vz = (vel ? vel.z : 0) + (Math.random() - 0.5) * 2;
      p.life = spec.life * (0.7 + Math.random() * 0.5);
      p.max = spec.life;
      p.size = spec.size * (0.7 + Math.random() * 0.6);
      p.gravity = spec.gravity;
      _c.setHex(spec.color);
      p.r = _c.r;
      p.g = _c.g;
      p.b = _c.b;
      this.items.push(p);
    }
  }

  update(dt, wind, night, rain) {
    const w = wind || { x: 0, y: 0, z: 0 };
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.free.push(this.items[i]);
        this.items.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += (p.vx + w.x * 0.15) * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + w.z * 0.15) * dt;
    }
    this._emitAcc += dt;
    if (this._emitAcc > 0.12) {
      this._emitAcc = 0;
      if (night > 0.55 && this.items.length < this.max * 0.45 && Math.random() < 0.35 * this.quality) {
        _tmp.x = (Math.random() - 0.5) * 40;
        _tmp.y = 6 + Math.random() * 4;
        _tmp.z = (Math.random() - 0.5) * 40;
        _vel.x = (Math.random() - 0.5) * 0.4;
        _vel.y = 0.2;
        _vel.z = (Math.random() - 0.5) * 0.4;
        this.emit('firefly', _tmp, 1, _vel);
      }
      if (rain && this.items.length < this.max * 0.7) {
        _tmp.x = (Math.random() - 0.5) * 50;
        _tmp.y = 18;
        _tmp.z = (Math.random() - 0.5) * 50;
        _vel.x = w.x * 0.3;
        _vel.y = -8;
        _vel.z = w.z * 0.3;
        this.emit('rain', _tmp, 3, _vel);
      }
    }
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const p = this.items[i];
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      const fade = Math.min(1, p.life / 0.25) * Math.min(1, (p.max - p.life) / 0.15);
      this.col[i * 3] = p.r * fade;
      this.col[i * 3 + 1] = p.g * fade;
      this.col[i * 3 + 2] = p.b * fade;
      this.size[i] = p.size;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

const _tmp = { x: 0, y: 0, z: 0 };
const _vel = { x: 0, y: 0, z: 0 };
