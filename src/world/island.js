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
    // The island is a volume: beyond the rim the terrain keeps tapering down
    // (cone-like), so there is no giant flat plane under the island and the
    // underside always reads as a mass.
    const rimR = this.radius - 2.2;
    const edge = THREE.MathUtils.clamp((rimR - r) / 9, 0, 1);
    if (edge <= 0) {
      return -7 - (r - rimR) * 1.15;
    }
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
    const COLOR_A = new THREE.Color();
    const COLOR_B = new THREE.Color();
    const COLOR_C = new THREE.Color();
    const COLOR_D = new THREE.Color();
    const COLOR_E = new THREE.Color();
    const COLOR_F = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.sample(x, z);
      pos.setY(i, y);
      const zone = this.zoneAt(x, z);
      const slope = Math.abs(this.sample(x + 0.6, z) - this.sample(x - 0.6, z))
        + Math.abs(this.sample(x, z + 0.6) - this.sample(x, z - 0.6));
      // Zone palette: mossy meadow, damp reed-green wet zone, slate quarry.
      const mottle = this.noise.n2(x * 0.13, z * 0.13);
      if (zone === 'wet') {
        color.setHex(0x5c7c56).lerp(COLOR_D.setHex(0x7a8a60), (mottle * 0.5 + 0.5) * 0.5);
      } else if (zone === 'quarry') {
        color.setHex(0x94897c).lerp(COLOR_D.setHex(0x7c7468), (mottle * 0.5 + 0.5) * 0.6);
      } else {
        color.setHex(0x52794a).lerp(COLOR_D.setHex(0x6b8a4a), (mottle * 0.5 + 0.5) * 0.55);
      }
      // Slope = exposed rock / soil (fake AO + readability of cliffs).
      if (slope > 1.2) color.lerp(COLOR_E.setHex(0x8a7d6c), THREE.MathUtils.clamp((slope - 1.2) * 0.5, 0, 0.85));
      if (slope > 2.6) color.lerp(COLOR_F.setHex(0x5c5348), THREE.MathUtils.clamp((slope - 2.6) * 0.4, 0, 0.7));
      if (y < this.pond.level + 0.25 && zone === 'wet') color.setHex(0x7a6a50);
      const rr = Math.hypot(x, z);
      // Rim: exposed ochre soil. Beyond the rim: the tapering rocky mass.
      const rimR = this.radius - 2.2;
      if (rr > this.radius - 8) color.lerp(COLOR_A.setHex(0x8a6a42), THREE.MathUtils.clamp((rr - (this.radius - 8)) / 6, 0, 1));
      if (rr > rimR) {
        const k = THREE.MathUtils.clamp((rr - rimR) / 6, 0, 1);
        color.lerp(COLOR_B.setHex(0x5a4a3a), k * 0.75);
        color.lerp(COLOR_C.setHex(0x4a4440), k * k * 0.5);
      }
      color.offsetHSL((this.noise.n2(x * 0.11, z * 0.11)) * 0.04, 0.05, (this.noise.n2(x * 0.2, z * 0.2)) * 0.1);
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
      emissive: new THREE.Color(0x1c2a12),
      emissiveIntensity: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.kind = 'terrain';
    return mesh;
  }

  buildUnderside() {
    const g = new THREE.Group();
    g.userData.kind = 'underside';
    try {
      g.add(this._volumeShell());
    } catch (e) {
      console.warn('island volume', e);
    }
    const rock = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.9, metalness: 0.04 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + this.rng.range(-0.12, 0.12);
      const r = this.radius * this.rng.range(0.18, 0.62);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = this.sample(x, z);
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(this.rng.range(1.1, 2.4), this.rng.range(5, 11), 6),
        rock,
      );
      peak.position.set(x, y - this.rng.range(7, 13), z);
      peak.rotation.x = Math.PI;
      peak.rotation.y = this.rng.range(0, Math.PI);
      peak.castShadow = false;
      peak.receiveShadow = false;
      peak.userData.kind = 'underside';
      g.add(peak);
    }
    return g;
  }

  _volumeShell() {
    // The shell is the island's volume: a soil rim ring that begins right
    // under the terrain edge, then rock walls that follow the dome's profile
    // and sweep down into a tapering rocky tail. No thin-surface gap remains.
    const segs = 48;
    const rings = 7;
    const pos = [];
    const col = [];
    const idx = [];
    const soil = new THREE.Color(0x7a5a3a);
    const rock = new THREE.Color(0x5f5a52);
    const deep = new THREE.Color(0x34302a);
    const rimR = this.radius - 2.2;
    for (let j = 0; j < rings; j++) {
      const t = j / (rings - 1);
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const wobble = 0.94 + this.noise.n2(Math.cos(a) * 1.7, Math.sin(a) * 1.7) * 0.06;
        const topR = rimR * wobble;
        const botR = this.radius * (0.16 + this.noise.n2(Math.cos(a) * 3.1 + 4, Math.sin(a) * 3.1) * 0.07);
        const rad = THREE.MathUtils.lerp(topR, botR, t * t * (0.35 + 0.65 * t));
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        // Keep the shell just under the terrain surface near the rim, then
        // deepen into the dome and finally dive to the tail.
        const surfY = this.sample(x * 0.99, z * 0.99);
        const drop = 0.25 + Math.pow(t, 2.2) * 9.5;
        let y = surfY - drop;
        if (t > 0.45) {
          const botY = -7 - Math.abs(this.noise.n2(Math.cos(a) * 2, Math.sin(a) * 2)) * 4;
          const base = this.sample(x * 0.99, z * 0.99) - (0.25 + Math.pow(0.45, 2.2) * 9.5);
          y = THREE.MathUtils.lerp(base, botY, (t - 0.45) / 0.55);
        }
        pos.push(x, y, z);
        const c = t < 0.2 ? soil : t < 0.55 ? rock : deep;
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < rings - 1; j++) {
      for (let i = 0; i < segs; i++) {
        const i0 = j * segs + i;
        const i1 = j * segs + ((i + 1) % segs);
        const i2 = (j + 1) * segs + i;
        const i3 = (j + 1) * segs + ((i + 1) % segs);
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
    const last = (rings - 1) * segs;
    const tip = pos.length / 3;
    pos.push(0, -16, 0);
    col.push(deep.r, deep.g, deep.b);
    for (let i = 0; i < segs; i++) {
      idx.push(last + i, tip, last + ((i + 1) % segs));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.03,
        emissive: 0x1a1410,
        emissiveIntensity: 0.05,
      }),
    );
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'islandVolume';
    return mesh;
  }

  addCollider(physics) {
    const nrows = this.res;
    const ncols = this.res;
    const scale = { x: this.size, y: 1, z: this.size };
    // Rapier indexes heightfields as heights[zIndex + xIndex * (ncols + 1)]
    // (z is the fast axis), while this.island.heights is x-fast
    // [xIndex + zIndex * (res + 1)]. Transpose a copy so the collider surface
    // matches the visual terrain exactly (a transposed grid warps the island
    // by meters and makes props/machines float or sink).
    const rapierHeights = new Float32Array((nrows + 1) * (ncols + 1));
    for (let zi = 0; zi <= ncols; zi++) {
      for (let xi = 0; xi <= nrows; xi++) {
        rapierHeights[zi + xi * (ncols + 1)] = this.heights[zi * (nrows + 1) + xi];
      }
    }
    const desc = RAPIER.ColliderDesc.heightfield(nrows, ncols, rapierHeights, scale)
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
