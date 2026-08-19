import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { faunaFilter } from '../physics/materials.js';

const ARCH = {
  TRAILBEAST: { speed: 1.8, flee: 4.2, size: [0.45, 0.55, 0.8], color: 0x8a6a48, mass: 8 },
  GLIDER: { speed: 3.4, flee: 5, size: [0.9, 0.12, 0.55], color: 0x4a6570, mass: 2.2, fly: true },
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
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.75 });
    if (type === 'TRAILBEAST') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.7), mat);
      body.position.y = 0.38;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.28), mat);
      head.position.set(0, 0.5, 0.42);
      const legG = new THREE.BoxGeometry(0.08, 0.28, 0.08);
      for (const [x, z] of [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]]) {
        const l = new THREE.Mesh(legG, mat);
        l.position.set(x, 0.14, z);
        g.add(l);
      }
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), new THREE.MeshStandardMaterial({ color: 0xd8c4a0 }));
      horn.position.set(0, 0.66, 0.48);
      g.add(body, head, horn);
    } else if (type === 'GLIDER') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.45), mat);
      wing.position.y = 0.02;
      g.add(body, wing);
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat);
      body.scale.set(1.1, 0.7, 1.2);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), mat);
      spike.position.y = 0.18;
      g.add(body, spike);
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
    const fruits = this.game.physics.sync.entities.filter((e) => e.kind === 'fruit' && e.body);
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
      const dir = pos.clone().sub(player);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
      dir.normalize().multiplyScalar(8);
      a.target.copy(pos).add(dir);
    } else if (a.state === 'seekFood' && fruits.length) {
      let best = fruits[0];
      let bd = 1e9;
      for (const f of fruits) {
        const t = f.body.translation();
        const d = (t.x - pos.x) ** 2 + (t.z - pos.z) ** 2;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      const t = best.body.translation();
      a.target.set(t.x, t.y, t.z);
      if (bd < 1.2) {
        a.hunger = 0.1;
        this.game.resources.collectProp(best);
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
    const dir = new THREE.Vector3(dest.x - pos.x, 0, dest.z - pos.z);
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
      const base = 10 + Math.sin(this.game.time * 0.4 + a.yaw) * 2;
      ny = THREE.MathUtils.lerp(pos.y, base, 1 - Math.pow(0.05, dt));
    } else {
      ny = island.sample(nx, nz) + (a.type === 'CRITTER' ? 0.18 : 0.35);
    }
    a.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    a.mesh.position.set(nx, ny, nz);
    a.mesh.rotation.y = a.yaw;
    if (a.type === 'TRAILBEAST') a.mesh.rotation.z = Math.sin(this.game.time * 8 + a.yaw) * 0.04 * spd;
    if (a.type === 'GLIDER') a.mesh.rotation.z = Math.sin(this.game.time * 2 + a.yaw) * 0.15;
    if (a.state === 'flee' && a.type === 'CRITTER') a.mesh.scale.y = 0.55;
    else a.mesh.scale.y = 1;
  }
}
