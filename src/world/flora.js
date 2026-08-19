import * as THREE from 'three';
import { GRASS_FRAG, GRASS_VERT } from '../gfx/shaders.js';

export class Flora {
  constructor(game) {
    this.game = game;
    this.plants = [];
    this.group = new THREE.Group();
    this.group.userData.kind = 'flora';
    game.gfx.scene.add(this.group);
    this.grass = null;
    this.windUniform = { value: new THREE.Vector3() };
    this.playerUniform = { value: new THREE.Vector3() };
    this.timeUniform = { value: 0 };
  }

  generate(island, rng) {
    this._grass(island, rng);
    this._flowers(island, rng);
    this._bushes(island, rng);
    this._mushrooms(island, rng);
    this._ferns(island, rng);
  }

  _grass(island, rng) {
    const quality = this.game.gfx.quality.grass;
    const count = Math.floor(1600 * quality);
    const geo = new THREE.PlaneGeometry(0.055, 0.26, 1, 2);
    geo.translate(0, 0.13, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      uniforms: {
        uTime: this.timeUniform,
        uWind: this.windUniform,
        uPlayer: this.playerUniform,
      },
      vertexColors: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const phase = new Float32Array(count);
    const shade = new Float32Array(count);
    const dummy = new THREE.Object3D();
    let n = 0;
    let guard = 0;
    while (n < count && guard < count * 8) {
      guard += 1;
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * (island.radius - 4);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = island.sample(x, z);
      if (y < island.pond.level + 0.15) continue;
      if (island.zoneAt(x, z) === 'quarry' && rng.next() < 0.7) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
      dummy.scale.setScalar(rng.range(0.75, 1.15));
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      phase[n] = rng.range(0, Math.PI * 2);
      shade[n] = rng.range(0.2, 1);
      n += 1;
    }
    mesh.count = n;
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    mesh.geometry.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 1));
    mesh.userData.kind = 'grass';
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.grass = mesh;
  }

  _addPlant(kind, pos, stage, extra = {}) {
    const mesh = this._meshFor(kind, stage);
    mesh.position.copy(pos);
    mesh.userData.kind = 'plant';
    this.group.add(mesh);
    const rec = { id: `pl_${this.plants.length}`, kind, stage, mesh, pos: pos.clone(), dirty: false, ...extra };
    this.plants.push(rec);
    return rec;
  }

  _meshFor(kind, stage) {
    const s = 0.35 + stage * 0.28;
    const g = new THREE.Group();
    if (kind === 'flower') {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.35 * s * 2, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a5a32, roughness: 0.8 }),
      );
      stem.position.y = 0.35 * s;
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 * s * 2, 6, 5),
        new THREE.MeshStandardMaterial({ color: [0x8a3040, 0xc4a15a, 0x6a5080, 0xd8c4a0][this.plants.length % 4], roughness: 0.55 }),
      );
      bloom.position.y = 0.7 * s;
      g.add(stem, bloom);
    } else if (kind === 'bush') {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 * s * 1.4, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a6a48, roughness: 0.78, emissive: 0x101808, emissiveIntensity: 0.08 }),
      );
      m.position.y = 0.3 * s;
      m.scale.set(1.2, 0.8, 1.1);
      g.add(m);
    } else if (kind === 'fern') {
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18 * s * 2, 0.5 * s * 2),
          new THREE.MeshStandardMaterial({ color: 0x3d6a48, side: THREE.DoubleSide, roughness: 0.8 }),
        );
        leaf.position.y = 0.25 * s;
        leaf.rotation.y = (i / 4) * Math.PI * 2;
        leaf.rotation.x = -0.6;
        g.add(leaf);
      }
    } else {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 * s * 2, 7, 5),
        new THREE.MeshStandardMaterial({ color: 0x8a4034, roughness: 0.7 }),
      );
      cap.position.y = 0.16 * s;
      cap.scale.y = 0.55;
      const st = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.14 * s * 2, 5),
        new THREE.MeshStandardMaterial({ color: 0xd8c4a0, roughness: 0.8 }),
      );
      st.position.y = 0.07 * s;
      g.add(cap, st);
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.kind = 'plant';
      }
    });
    return g;
  }

  _flowers(island, rng) {
    for (let i = 0; i < 48; i++) {
      const p = this._scatter(island, rng, 'meadow');
      if (p) this._addPlant('flower', p, rng.int(1, 3));
    }
  }

  _bushes(island, rng) {
    for (let i = 0; i < 18; i++) {
      const p = this._scatter(island, rng, null);
      if (p) this._addPlant('bush', p, rng.int(1, 3), { fiber: true });
    }
  }

  _ferns(island, rng) {
    for (let i = 0; i < 16; i++) {
      const p = this._scatter(island, rng, 'wet');
      if (p) this._addPlant('fern', p, rng.int(1, 3));
    }
  }

  _mushrooms(island, rng) {
    for (let i = 0; i < 12; i++) {
      const p = this._scatter(island, rng, 'wet');
      if (p) this._addPlant('mushroom', p, rng.int(1, 3));
    }
  }

  _scatter(island, rng, zone) {
    for (let k = 0; k < 12; k++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * (island.radius - 6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (zone && island.zoneAt(x, z) !== zone && zone !== 'meadow') continue;
      if (zone === 'meadow' && island.zoneAt(x, z) === 'quarry') continue;
      const y = island.sample(x, z);
      if (y < island.pond.level + 0.2) continue;
      return new THREE.Vector3(x, y, z);
    }
    return null;
  }

  crushNear(pos, radius = 1.1) {
    for (const p of this.plants) {
      if (p.stage <= 0) continue;
      if (p.pos.distanceTo(pos) < radius) {
        p.crushed = true;
        p.dirty = true;
      }
    }
  }

  update(dt, wind, player) {
    this.timeUniform.value += dt;
    this.windUniform.value.copy(wind);
    if (player) this.playerUniform.value.copy(player);
    for (const p of this.plants) {
      if (!p.dirty) continue;
      p.dirty = false;
      const vis = Math.max(0.15, p.stage / 3);
      p.mesh.scale.setScalar(vis);
      p.mesh.visible = p.stage > 0.05;
    }
  }
}
