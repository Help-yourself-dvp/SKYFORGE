import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { faunaFilter } from '../physics/materials.js';

const _fdir = new THREE.Vector3();

const ARCH = {
  TRAILBEAST: { speed: 1.8, flee: 4.2, size: [0.45, 0.55, 0.8], color: 0x8a6a48, mass: 8 },
  GLIDER: { speed: 3.4, flee: 5, size: [0.9, 0.12, 0.55], color: 0x5a7a86, mass: 2.2, fly: true },
  CRITTER: { speed: 0.7, flee: 1.6, size: [0.28, 0.18, 0.3], color: 0x6d6a66, mass: 1.6 },
};

export class Fauna {
  constructor(game) {
    this.game = game;
    this.animals = [];
    this.group = new THREE.Group();
    this.group.userData.kind = 'fauna';
    game.gfx.scene.add(this.group);
    this.acc = 0;
  }

  generate(island, rng) {
    const types = ['TRAILBEAST', 'TRAILBEAST', 'TRAILBEAST', 'TRAILBEAST', 'GLIDER', 'GLIDER', 'CRITTER', 'CRITTER'];
    for (let i = 0; i < types.length; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = rng.range(8, island.radius - 8);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = island.sample(x, z) + 0.6;
      this.spawn(types[i], new THREE.Vector3(x, y, z), `fauna_${i}`);
    }
  }

  spawn(type, pos, id) {
    const def = ARCH[type];
    const mesh = this._mesh(type, def);
    mesh.position.copy(pos);
    this.group.add(mesh);
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z);
    const col = RAPIER.ColliderDesc.capsule(def.size[1] * 0.35, Math.max(def.size[0], def.size[2]) * 0.35)
      .setCollisionGroups(faunaFilter())
      .setSensor(false);
    const body = this.game.physics.world.createRigidBody(desc);
    const collider = this.game.physics.world.createCollider(col, body);
    const rec = {
      id,
      type,
      def,
      mesh,
      body,
      collider,
      hunger: 0.4,
      fear: 0,
      stamina: 1,
      state: 'wander',
      target: pos.clone(),
      vel: new THREE.Vector3(),
      yaw: 0,
      rest: 0,
    };
    mesh.userData.kind = 'fauna';
    mesh.userData.id = id;
    this.game.physics.sync.add({ id, kind: 'fauna', body, collider, mesh, mass: def.mass, manualSync: true, animal: rec });
    this.animals.push(rec);
    return rec;
  }

  _mesh(type, def) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.78 });
    const light = new THREE.MeshStandardMaterial({ color: 0xd8c4a0, roughness: 0.6 });
    // Meshes are built with the origin at the FEET so the group sits on the
    // terrain (no floating animals).
    if (type === 'TRAILBEAST') {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 4, 10), mat);
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.48;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
      head.position.set(0, 0.56, 0.52);
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), light);
      muzzle.position.set(0, 0.5, 0.66);
      for (const [x, z] of [[-0.12, 0.24], [0.12, 0.24], [-0.12, -0.24], [0.12, -0.24]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 6), mat);
        l.position.set(x, 0.15, z);
        g.add(l);
      }
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 6), light);
      horn.position.set(0, 0.74, 0.55);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), mat);
      ear.position.set(-0.09, 0.7, 0.46);
      const ear2 = ear.clone();
      ear2.position.x = 0.09;
      g.add(body, head, muzzle, horn, ear, ear2);
    } else if (type === 'GLIDER') {
      // Sky ray: small body + flat diamond wings, clearly flying.
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat);
      body.position.y = 0.1;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.025, 0.55), mat);
      wing.position.y = 0.16;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), mat);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 0.1, -0.4);
      g.add(body, wing, tail);
      g.userData.wing = wing;
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
      body.position.y = 0.18;
      body.scale.set(1.1, 0.8, 1.2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 5), mat);
        spike.position.set(Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.16);
        g.add(spike);
      }
      g.add(body);
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.kind = 'fauna';
      }
    });
    return g;
  }

  update(dt) {
    this.acc += dt;
    const run = this.acc >= 0.08;
    const step = run ? this.acc : 0;
    if (run) this.acc = 0;
    const player = this.game.player?.position;
    const machineFast = this.game.machine?.launched && Math.abs(this.game.machine.throttle) > 0.35;
    // Live fruit list: bodies can be removed mid-tick (an animal eats a fruit,
    // the player collects it), so entries are pruned and never used after removal.
    const fruits = this.game.physics.sync.entities.filter(
      (e) => e.kind === 'fruit' && e.body && this.game.physics.sync.byId.has(e.id),
    );
    const pond = this.game.world.main.pond;

    for (const a of this.animals) {
      if (run) this._ai(a, step, player, machineFast, fruits, pond);
      this._integrate(a, dt);
    }
  }

  _ai(a, dt, player, machineFast, fruits, pond) {
    a.hunger = Math.min(1, a.hunger + dt * 0.02);
    a.fear = Math.max(0, a.fear - dt * 0.25);
    if (player) {
      const d = a.mesh.position.distanceTo(player);
      if (d < (a.type === 'CRITTER' ? 4 : 6)) a.fear = Math.min(1, a.fear + dt * 1.4);
    }
    if (machineFast && this.game.machine.seat()) {
      const s = this.game.machine.seat().mesh.position;
      if (a.mesh.position.distanceTo(s) < 10) a.fear = 1;
    }
    if (a.fear > 0.45) a.state = 'flee';
    else if (a.hunger > 0.55 && fruits.length) a.state = 'seekFood';
    else if (a.hunger > 0.4) a.state = 'seekWater';
    else if (a.rest > 0) {
      a.state = 'rest';
      a.rest -= dt;
    } else if (Math.random() < dt * 0.15) {
      a.state = 'idle';
      a.rest = 1.2;
    } else a.state = 'wander';

    const pos = a.mesh.position;
    if (a.state === 'flee' && player) {
      const dir = _fdir.set(pos.x - player.x, 0, pos.z - player.z);
      if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
      dir.normalize().multiplyScalar(8);
      a.target.set(pos.x + dir.x, pos.y, pos.z + dir.z);
    } else if (a.state === 'seekFood' && fruits.length) {
      let best = null;
      let bd = 1e9;
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        // Prune entries whose body was removed earlier in this same tick.
        if (!f || !f.body || !this.game.physics.sync.byId.has(f.id)) {
          fruits.splice(i, 1);
          continue;
        }
        const t = f.body.translation();
        const d = (t.x - pos.x) ** 2 + (t.z - pos.z) ** 2;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (!best) return;
      const t = best.body.translation();
      a.target.set(t.x, t.y, t.z);
      if (bd < 1.2) {
        a.hunger = 0.1;
        this.game.resources.collectProp(best);
        const ix = fruits.indexOf(best);
        if (ix >= 0) fruits.splice(ix, 1);
      }
    } else if (a.state === 'seekWater') {
      a.target.set(pond.x + Math.sin(this.game.time) * 2, pond.level, pond.z);
      if (pos.distanceTo(a.target) < 2.5) a.hunger = Math.max(0.2, a.hunger - 0.3);
    } else if (a.state === 'wander') {
      if (pos.distanceTo(a.target) < 1.2 || Math.random() < dt * 0.4) {
        const ang = Math.random() * Math.PI * 2;
        a.target.set(pos.x + Math.cos(ang) * 6, pos.y, pos.z + Math.sin(ang) * 6);
      }
    }
  }

  _integrate(a, dt) {
    const pos = a.mesh.position;
    const dest = a.target;
    const dir = _fdir.set(dest.x - pos.x, 0, dest.z - pos.z);
    const dist = dir.length();
    const fly = a.def.fly;
    let spd = a.state === 'flee' ? a.def.flee : a.state === 'idle' || a.state === 'rest' ? 0 : a.def.speed;
    if (dist > 0.15 && spd > 0) {
      dir.multiplyScalar(1 / dist);
      a.vel.lerp(dir.multiplyScalar(spd), 1 - Math.pow(0.001, dt));
      a.yaw = Math.atan2(a.vel.x, a.vel.z);
    } else {
      a.vel.multiplyScalar(0.85);
    }
    let nx = pos.x + a.vel.x * dt;
    let nz = pos.z + a.vel.z * dt;
    const island = this.game.world.main;
    const r = Math.hypot(nx, nz);
    if (r > island.radius - 4) {
      nx *= (island.radius - 5) / r;
      nz *= (island.radius - 5) / r;
    }
    let ny;
    if (fly) {
      const base = 13 + Math.sin(this.game.time * 0.4 + a.yaw) * 2.5;
      ny = THREE.MathUtils.lerp(pos.y, base, 1 - Math.pow(0.05, dt));
    } else {
      // Feet on the ground: mesh origins are at the feet now.
      ny = island.sample(nx, nz) + (a.type === 'CRITTER' ? 0.05 : 0.12);
    }
    a.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    a.mesh.position.set(nx, ny, nz);
    a.mesh.rotation.y = a.yaw;
    if (a.type === 'TRAILBEAST') a.mesh.rotation.z = Math.sin(this.game.time * 8 + a.yaw) * 0.04 * spd;
    if (a.type === 'GLIDER') {
      a.mesh.rotation.z = Math.sin(this.game.time * 2 + a.yaw) * 0.12;
      if (a.mesh.userData.wing) a.mesh.userData.wing.rotation.z = Math.sin(this.game.time * 5 + a.yaw) * 0.18;
    }
    if (a.state === 'flee' && a.type === 'CRITTER') a.mesh.scale.y = 0.55;
    else a.mesh.scale.y = 1;
  }
}
