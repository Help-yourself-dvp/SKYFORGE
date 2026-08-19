import * as THREE from 'three';

const KINDS = {
  pollen: { size: 0.08, color: 0xe8d48a, life: 6, gravity: 0.02 },
  firefly: { size: 0.12, color: 0xc9e07a, life: 5, gravity: 0 },
  chip: { size: 0.1, color: 0x8a6238, life: 0.9, gravity: 9 },
  grit: { size: 0.08, color: 0x8a8478, life: 0.8, gravity: 10 },
  spray: { size: 0.07, color: 0xb7d4d6, life: 0.7, gravity: 3 },
  mist: { size: 0.22, color: 0xcfd8d4, life: 2.4, gravity: -0.15 },
  rain: { size: 0.05, color: 0x9bb4c0, life: 1.1, gravity: 18 },
  spark: { size: 0.06, color: 0xffc56a, life: 0.45, gravity: 2 },
  dust: { size: 0.1, color: 0xb59a72, life: 0.7, gravity: 1.2 },
  fire: { size: 0.09, color: 0xff8a3a, life: 0.55, gravity: -2.4 },
};

export class Particles {
  constructor(scene, quality = 1) {
    this.scene = scene;
    this.quality = quality;
    this.pools = {};
    this.max = Math.floor(420 * quality);
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
    this.mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.userData.kind = 'particles';
    scene.add(this.points);
  }

  emit(kind, origin, count = 8, vel = null) {
    const spec = KINDS[kind] || KINDS.dust;
    const n = Math.max(1, Math.floor(count * this.quality));
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const dir = vel
        ? vel.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5))
        : new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2);
      const c = new THREE.Color(spec.color);
      c.offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.08);
      this.items.push({
        x: origin.x + (Math.random() - 0.5) * 0.2,
        y: origin.y + (Math.random() - 0.5) * 0.2,
        z: origin.z + (Math.random() - 0.5) * 0.2,
        vx: dir.x,
        vy: dir.y,
        vz: dir.z,
        life: spec.life * (0.7 + Math.random() * 0.5),
        max: spec.life,
        size: spec.size * (0.7 + Math.random() * 0.6),
        gravity: spec.gravity,
        r: c.r,
        g: c.g,
        b: c.b,
      });
    }
  }

  update(dt, wind, night, rain) {
    const w = wind || { x: 0, y: 0, z: 0 };
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += (p.vx + w.x * 0.15) * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + w.z * 0.15) * dt;
    }
    if (night > 0.55 && this.items.length < this.max * 0.6) {
      if (Math.random() < dt * 6 * this.quality) {
        this.emit('firefly', new THREE.Vector3((Math.random() - 0.5) * 40, 6 + Math.random() * 4, (Math.random() - 0.5) * 40), 1, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4));
      }
    }
    if (rain && Math.random() < dt * 40 * this.quality) {
      this.emit('rain', new THREE.Vector3((Math.random() - 0.5) * 50, 18, (Math.random() - 0.5) * 50), 4, new THREE.Vector3(w.x * 0.3, -8, w.z * 0.3));
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
