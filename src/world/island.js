import * as THREE from 'three';
import { ISLAND_RADIUS, HEIGHTMAP_RES, GROUPS, interactionGroups, ALL_GROUPS, MATERIALS } from '../config.js';
import { RAPIER } from '../physics/world.js';

export class Island {
  constructor(rng, noise) {
    this.rng = rng;
    this.noise = noise;
    this.radius = ISLAND_RADIUS;
    this.res = HEIGHTMAP_RES;
    this.pond = { x: 18, z: 12, radius: 9.2, level: 5.15 };
    this.quarry = { x: -16, z: 14, radius: 12 };
    this.meadow = { x: -6, z: -10, radius: 16 };
    this.workshop = { x: 4.5, z: -6.5 };
    this.viewpoint = { x: -8, z: -28 };
    this.heights = new Float32Array((this.res + 1) * (this.res + 1));
    this.size = this.radius * 2.15;
    this._buildHeights();
  }

  _idx(i, j) {
    return j * (this.res + 1) + i;
  }

  _xz(i, j) {
    const s = this.size;
    return {
      x: -s * 0.5 + (i / this.res) * s,
      z: -s * 0.5 + (j / this.res) * s,
    };
  }

  heightAt(x, z) {
    const n = this.noise;
    const r = Math.hypot(x, z);
    const edge = THREE.MathUtils.clamp((this.radius - 2.2 - r) / 9, 0, 1);
    if (edge <= 0) return -18;
    let h = 6.4 + n.fbm(x * 0.028, z * 0.028, 5) * 4.6 + n.fbm(x * 0.07 + 8, z * 0.07, 3) * 1.6;
    const pondD = Math.hypot(x - this.pond.x, z - this.pond.z);
    if (pondD < this.pond.radius + 3) {
      const k = 1 - THREE.MathUtils.clamp(pondD / (this.pond.radius + 1.2), 0, 1);
      h -= k * k * 3.4;
    }
    const qD = Math.hypot(x - this.quarry.x, z - this.quarry.z);
    if (qD < this.quarry.radius) {
      const k = 1 - qD / this.quarry.radius;
      h -= k * 1.8;
      h += n.n2(x * 0.2, z * 0.2) * k * 0.7;
    }
    const wD = Math.hypot(x - this.workshop.x, z - this.workshop.z);
    if (wD < 7) h = THREE.MathUtils.lerp(h, 6.55, 1 - wD / 7);
    h *= THREE.MathUtils.smootherstep(edge, 0, 1);
    if (r > this.radius - 1.2) h -= (r - (this.radius - 1.2)) * 4;
    return h;
  }

  _buildHeights() {
    for (let j = 0; j <= this.res; j++) {
      for (let i = 0; i <= this.res; i++) {
        const { x, z } = this._xz(i, j);
        this.heights[this._idx(i, j)] = this.heightAt(x, z);
      }
    }
  }

  sample(x, z) {
    const s = this.size;
    const u = (x + s * 0.5) / s;
    const v = (z + s * 0.5) / s;
    const i = u * this.res;
    const j = v * this.res;
    const i0 = Math.floor(i);
    const j0 = Math.floor(j);
    if (i0 < 0 || j0 < 0 || i0 >= this.res || j0 >= this.res) return -20;
    const tx = i - i0;
    const ty = j - j0;
    const h00 = this.heights[this._idx(i0, j0)];
    const h10 = this.heights[this._idx(i0 + 1, j0)];
    const h01 = this.heights[this._idx(i0, j0 + 1)];
    const h11 = this.heights[this._idx(i0 + 1, j0 + 1)];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(h00, h10, tx),
      THREE.MathUtils.lerp(h01, h11, tx),
      ty,
    );
  }

  zoneAt(x, z) {
    if (Math.hypot(x - this.pond.x, z - this.pond.z) < this.pond.radius + 2) return 'wet';
    if (Math.hypot(x - this.quarry.x, z - this.quarry.z) < this.quarry.radius) return 'quarry';
    return 'meadow';
  }

  buildMesh() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.res, this.res);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.sample(x, z);
      pos.setY(i, y);
      const zone = this.zoneAt(x, z);
      const slope = Math.abs(this.sample(x + 0.6, z) - this.sample(x - 0.6, z))
        + Math.abs(this.sample(x, z + 0.6) - this.sample(x, z - 0.6));
      if (zone === 'wet') color.setHex(0x3a5a48);
      else if (zone === 'quarry') color.setHex(0x6d6a66);
      else color.setHex(0x3f5a3a);
      if (slope > 1.6) color.setHex(0x6a6258);
      if (y < this.pond.level + 0.25 && zone === 'wet') color.setHex(0x5a5340);
      color.offsetHSL(0, 0, (this.noise.n2(x * 0.2, z * 0.2)) * 0.05);
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.kind = 'terrain';
    return mesh;
  }

  buildUnderside() {
    const g = new THREE.Group();
    g.userData.kind = 'underside';
    const rock = new THREE.MeshStandardMaterial({ color: 0x4a453f, roughness: 0.92, metalness: 0.04 });
    const soil = new THREE.MeshStandardMaterial({ color: 0x5a4634, roughness: 0.95 });
    const rng = this.rng;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const r = this.radius * rng.range(0.15, 0.72);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = this.sample(x, z);
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(rng.range(1.4, 3.4), rng.range(7, 16), 6),
        i % 3 === 0 ? soil : rock,
      );
      peak.position.set(x, y - rng.range(6, 12), z);
      peak.rotation.x = Math.PI;
      peak.rotation.y = rng.range(0, Math.PI);
      peak.castShadow = true;
      peak.userData.kind = 'underside';
      g.add(peak);
    }
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius * 0.92, this.radius * 0.55, 10, 24, 1, true),
      soil,
    );
    rim.position.y = 1.2;
    rim.userData.kind = 'underside';
    g.add(rim);
    return g;
  }

  addCollider(physics) {
    const nrows = this.res;
    const ncols = this.res;
    const scale = { x: this.size, y: 1, z: this.size };
    const desc = RAPIER.ColliderDesc.heightfield(nrows, ncols, this.heights, scale)
      .setTranslation(0, 0, 0)
      .setFriction(MATERIALS.ground.friction)
      .setRestitution(MATERIALS.ground.restitution)
      .setCollisionGroups(interactionGroups(GROUPS.staticWorld, ALL_GROUPS));
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const collider = physics.world.createCollider(desc, body);
    return physics.sync.add({
      id: 'terrain',
      kind: 'terrain',
      body,
      collider,
      mesh: null,
      mass: 0,
      manualSync: true,
    });
  }
}
