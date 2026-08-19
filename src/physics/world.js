import RAPIER from '@dimforge/rapier3d-compat';
import { FIXED_DT, GRAVITY, MAX_SUBSTEPS } from '../config.js';
import { PhysicsSync } from './sync.js';
import { applyMaterial } from './materials.js';

let _ready = false;

export async function initRapier() {
  if (_ready) return RAPIER;
  await RAPIER.init();
  _ready = true;
  return RAPIER;
}

export { RAPIER };

export class PhysicsWorld {
  constructor() {
    this.R = RAPIER;
    this.world = new RAPIER.World(GRAVITY);
    this.world.timestep = FIXED_DT;
    this.sync = new PhysicsSync();
    this.accumulator = 0;
    this.alpha = 0;
    this.paused = false;
    this.debug = false;
    this._id = 1;
    this._ray = null;
    this.buoyant = [];
    this.waterLevel = 4.2;
    this.pond = { x: 16, z: 10, radius: 9.5 };
    this.onStep = null;
  }

  nextId(prefix = 'e') {
    return `${prefix}_${this._id++}`;
  }

  bodyCount() {
    let n = 0;
    this.world.bodies.forEach(() => { n += 1; });
    return n;
  }

  colliderCount() {
    let n = 0;
    this.world.colliders.forEach(() => { n += 1; });
    return n;
  }

  jointCount() {
    let n = 0;
    try { this.world.impulseJoints.forEach(() => { n += 1; }); } catch (_) { /* */ }
    return n;
  }

  setPaused(v) {
    this.paused = !!v;
  }

  step(dt, fn) {
    if (this.paused) {
      this.alpha = 1;
      return 0;
    }
    this.accumulator += Math.min(dt, 0.05);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.sync.snapshot();
      if (fn) fn(FIXED_DT);
      this.applyBuoyancy(FIXED_DT);
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (this.accumulator > FIXED_DT * MAX_SUBSTEPS) this.accumulator = 0;
    this.alpha = Math.min(1, this.accumulator / FIXED_DT);
    return steps;
  }

  applyBuoyancy(dt) {
    const { pond, waterLevel } = this;
    for (const ent of this.buoyant) {
      if (!ent.body || !ent.buoyancy) continue;
      const t = ent.body.translation();
      const dx = t.x - pond.x;
      const dz = t.z - pond.z;
      const inPond = dx * dx + dz * dz < pond.radius * pond.radius;
      const below = t.y < waterLevel + 0.4;
      if (!inPond || !below) continue;
      const sub = Math.min(1.4, waterLevel + 0.2 - t.y);
      if (sub <= 0) continue;
      const mass = ent.mass || 4;
      const lift = 14 * sub * (ent.buoyancyScale || 1);
      ent.body.applyImpulse({ x: 0, y: lift * dt * 60 * (mass * 0.12), z: 0 }, true);
      const lv = ent.body.linvel();
      ent.body.setLinvel(
        { x: lv.x * 0.94, y: lv.y * 0.9, z: lv.z * 0.94 },
        true,
      );
    }
  }

  createFixed(desc, colliderDesc, mesh, extra = {}) {
    const body = this.world.createRigidBody(desc);
    const collider = this.world.createCollider(colliderDesc, body);
    if (extra.material) applyMaterial(collider, extra.material);
    const ent = {
      id: extra.id || this.nextId(extra.kind || 'fix'),
      kind: extra.kind || 'static',
      body,
      collider,
      mesh,
      mass: 0,
      ...extra,
    };
    if (mesh) {
      mesh.userData.physId = ent.id;
      mesh.userData.kind = mesh.userData.kind || ent.kind;
    }
    return this.sync.add(ent);
  }

  createDynamic(desc, colliderDesc, mesh, extra = {}) {
    if (extra.ccd) desc.setCcdEnabled(true);
    const body = this.world.createRigidBody(desc);
    const collider = this.world.createCollider(colliderDesc, body);
    if (extra.material) applyMaterial(collider, extra.material);
    if (extra.mass) {
      collider.setMass(extra.mass);
    }
    const ent = {
      id: extra.id || this.nextId(extra.kind || 'dyn'),
      kind: extra.kind || 'prop',
      body,
      collider,
      mesh,
      mass: extra.mass || collider.mass(),
      buoyancy: !!extra.buoyancy,
      buoyancyScale: extra.buoyancyScale || 1,
      grabbable: extra.grabbable !== false,
      ...extra,
    };
    if (mesh) {
      mesh.userData.physId = ent.id;
      mesh.userData.kind = mesh.userData.kind || ent.kind;
      mesh.userData.grabbable = ent.grabbable;
      mesh.userData.mass = ent.mass;
    }
    if (ent.buoyancy) this.buoyant.push(ent);
    return this.sync.add(ent);
  }

  removeEntity(ent) {
    if (!ent) return;
    if (ent.joint) {
      try { this.world.removeImpulseJoint(ent.joint, true); } catch (e) { console.warn('joint remove', e); }
    }
    if (ent.body) {
      this.world.removeRigidBody(ent.body);
    }
    this.sync.remove(ent);
    const bi = this.buoyant.indexOf(ent);
    if (bi >= 0) this.buoyant.splice(bi, 1);
  }

  _ensureRay(origin, dir) {
    const o = { x: origin.x, y: origin.y, z: origin.z };
    const d = { x: dir.x, y: dir.y, z: dir.z };
    if (!this._ray) {
      this._ray = new this.R.Ray(o, d);
      return this._ray;
    }
    try {
      this._ray.origin.x = o.x;
      this._ray.origin.y = o.y;
      this._ray.origin.z = o.z;
      this._ray.dir.x = d.x;
      this._ray.dir.y = d.y;
      this._ray.dir.z = d.z;
    } catch (_) {
      this._ray = new this.R.Ray(o, d);
    }
    return this._ray;
  }

  raycast(origin, dir, max = 8, excludeBody = null) {
    const ray = this._ensureRay(origin, dir);
    const hit = this.world.castRay(ray, max, true, undefined, undefined, undefined, excludeBody || undefined);
    if (!hit) return null;
    const collider = hit.collider;
    const toi = hit.timeOfImpact;
    const point = {
      x: origin.x + dir.x * toi,
      y: origin.y + dir.y * toi,
      z: origin.z + dir.z * toi,
    };
    const ent = this.sync.byCollider.get(collider.handle) || null;
    return { collider, toi, point, ent, body: collider.parent() };
  }

  dispose() {
    this.world.free();
  }
}
