import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { VEHICLE, GROUPS, interactionGroups, ALL_GROUPS } from '../config.js';
import { createPartMesh, partDef } from './parts.js';
import { createJoint } from './joints.js';
import { applyMaterial } from '../physics/materials.js';
import { CART_BLUEPRINT } from './blueprints.js';
import { machineFilter } from '../physics/materials.js';

const machineGroups = machineFilter();

export class MachineSystem {
  constructor(game) {
    this.game = game;
    this.parts = [];
    this.joints = [];
    this.launched = false;
    this.editor = [];
    this.group = new THREE.Group();
    this.group.userData.kind = 'machineRoot';
    game.gfx.scene.add(this.group);
    this.throttle = 0;
    this.steer = 0;
    this.handbrake = false;
    this.flipTimer = 0;
    this.distance = 0;
    this.lastPos = null;
    this.idSeq = 1;
  }

  _id() {
    return `part_${this.idSeq++}`;
  }

  place(type, position, quaternion, snap = null, id = null) {
    const def = partDef(type);
    const mesh = createPartMesh(type);
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    mesh.userData.kind = 'part';
    mesh.userData.partType = type;
    this.group.add(mesh);

    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w });
    const body = this.game.physics.world.createRigidBody(desc);
    const col = this._collider(def);
    col.setCollisionGroups(machineGroups);
    col.setMass(def.mass);
    const collider = this.game.physics.world.createCollider(col, body);
    applyMaterial(collider, def.material || (def.metal > 0.4 ? 'metal' : 'wood'));

    const part = {
      id: id || this._id(),
      type,
      mesh,
      body,
      collider,
      def,
      usedPorts: new Set(),
      kinematic: true,
    };
    mesh.userData.physId = part.id;
    mesh.userData.partId = part.id;
    const ent = {
      id: part.id,
      kind: 'part',
      body,
      collider,
      mesh,
      mass: def.mass,
      buoyancy: !!def.lift || !!def.buoyancy,
      buoyancyScale: def.lift ? 1.6 : 1,
      grabbable: false,
      manualSync: false,
      part,
    };
    this.game.physics.sync.add(ent);
    if (ent.buoyancy) this.game.physics.buoyant.push(ent);
    part.ent = ent;
    this.parts.push(part);

    if (snap && snap.target && snap.ghostPort && snap.targetPort) {
      this.connect(part, snap.ghostPort.id, snap.target, snap.targetPort.id);
    }
    return part;
  }

  _collider(def) {
    if (def.shape === 'sphere') return RAPIER.ColliderDesc.ball(def.size[0] * 0.5);
    if (def.shape === 'cylinder') return RAPIER.ColliderDesc.cylinder(def.size[0] * 0.5, def.size[1] * 0.5);
    return RAPIER.ColliderDesc.cuboid(def.size[0] * 0.5, def.size[1] * 0.5, def.size[2] * 0.5);
  }

  connect(a, portA, b, portB) {
    if (a.id === b.id) return null;
    if (a.usedPorts.has(portA) || b.usedPorts.has(portB)) return null;
    const rec = createJoint(this.game.physics.world, a, portA, b, portB);
    a.usedPorts.add(portA);
    b.usedPorts.add(portB);
    this.joints.push(rec);
    return rec;
  }

  removePart(part) {
    for (let i = this.joints.length - 1; i >= 0; i--) {
      const j = this.joints[i];
      if (j.a === part.id || j.b === part.id) {
        try { this.game.physics.world.removeImpulseJoint(j.joint, true); } catch (e) { console.warn(e); }
        this.joints.splice(i, 1);
      }
    }
    this.game.physics.removeEntity(part.ent);
    this.group.remove(part.mesh);
    this.parts.splice(this.parts.indexOf(part), 1);
  }

  clear() {
    for (const j of this.joints) {
      try { this.game.physics.world.removeImpulseJoint(j.joint, true); } catch (e) { console.warn(e); }
    }
    this.joints.length = 0;
    for (const p of [...this.parts]) {
      this.game.physics.removeEntity(p.ent);
      this.group.remove(p.mesh);
    }
    this.parts.length = 0;
    this.launched = false;
    this.editor = [];
  }

  snapshotEditor() {
    this.editor = this.parts.map((p) => ({
      id: p.id,
      type: p.type,
      x: p.mesh.position.x,
      y: p.mesh.position.y,
      z: p.mesh.position.z,
      qx: p.mesh.quaternion.x,
      qy: p.mesh.quaternion.y,
      qz: p.mesh.quaternion.z,
      qw: p.mesh.quaternion.w,
    }));
  }

  launch() {
    if (this.launched || this.parts.length === 0) return;
    this.snapshotEditor();
    for (const p of this.parts) {
      p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      p.body.wakeUp();
      p.body.setCcdEnabled(true);
      p.kinematic = false;
    }
    this.launched = true;
    this.distance = 0;
    const s = this.seat();
    if (s) this.lastPos = s.mesh.position.clone();
    this.game.audio.play('launch');
  }

  stop() {
    if (!this.launched) return;
    const byId = new Map(this.parts.map((p) => [p.id, p]));
    for (const rec of this.editor) {
      const p = byId.get(rec.id);
      if (!p) continue;
      p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      p.body.setTranslation({ x: rec.x, y: rec.y, z: rec.z }, true);
      p.body.setRotation({ x: rec.qx, y: rec.qy, z: rec.qz, w: rec.qw }, true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      p.mesh.position.set(rec.x, rec.y, rec.z);
      p.mesh.quaternion.set(rec.qx, rec.qy, rec.qz, rec.qw);
      p.kinematic = true;
    }
    this.launched = false;
    this.throttle = 0;
    this.steer = 0;
    this.game.audio.setMotor(0);
  }

  seat() {
    return this.parts.find((p) => p.def.seat) || null;
  }

  spawnCart(origin) {
    const placed = {};
    for (const spec of CART_BLUEPRINT.parts) {
      const pos = new THREE.Vector3(origin.x + spec.x, origin.y + spec.y, origin.z + spec.z);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.yaw || 0);
      placed[spec.key] = this.place(spec.type, pos, q, null, `cart_${spec.key}_${this.idSeq}`);
    }
    for (const j of CART_BLUEPRINT.joints) {
      const a = placed[j.a];
      const b = placed[j.b];
      if (a && b) this.connect(a, j.pa, b, j.pb);
    }
    return placed;
  }

  findPartAt(mesh) {
    let m = mesh;
    while (m) {
      if (m.userData && m.userData.partId) {
        return this.parts.find((p) => p.id === m.userData.partId) || null;
      }
      m = m.parent;
    }
    return null;
  }

  drive(dt, axis, handbrake) {
    if (!this.launched) return;
    this.throttle = THREE.MathUtils.clamp(axis.y, -1, 1);
    this.steer = THREE.MathUtils.clamp(axis.x, -1, 1);
    this.handbrake = !!handbrake;

    const wheels = this.parts.filter((p) => p.type === 'WHEEL');
    const steers = this.parts.filter((p) => p.def.steer);
    const motors = this.parts.filter((p) => p.type === 'MOTOR');
    const balloons = this.parts.filter((p) => p.def.lift);
    const props = this.parts.filter((p) => p.def.thrust);
    const wings = this.parts.filter((p) => p.def.wing);

    const torque = this.throttle * VEHICLE.motorTorque;
    for (const j of this.joints) {
      if (j.type !== 'hinge' || !j.joint) continue;
      const a = this.parts.find((p) => p.id === j.a);
      const b = this.parts.find((p) => p.id === j.b);
      const wheel = a?.type === 'WHEEL' ? a : b?.type === 'WHEEL' ? b : null;
      const steerP = a?.def.steer ? a : b?.def.steer ? b : null;
      try {
        if (wheel) {
          const target = this.handbrake ? 0 : this.throttle * VEHICLE.maxWheelSpeed;
          const factor = this.handbrake ? VEHICLE.handbrake : 18;
          if (j.joint.configureMotorVelocity) j.joint.configureMotorVelocity(target, factor);
          if (this.handbrake && wheel.body) {
            const av = wheel.body.angvel();
            wheel.body.setAngvel({ x: av.x * 0.4, y: av.y * 0.4, z: av.z * 0.4 }, true);
          }
        } else if (steerP) {
          const ang = -this.steer * VEHICLE.steerAngle;
          if (j.joint.configureMotorPosition) j.joint.configureMotorPosition(ang, 80, 8);
        }
      } catch (e) {
        /* motor not supported on this joint instance */
      }
    }

    for (const m of motors) {
      if (!m.body) continue;
      const f = new THREE.Vector3(0, 0, this.throttle * 42);
      f.applyQuaternion(m.mesh.quaternion);
      m.body.addForce({ x: f.x, y: f.y, z: f.z }, true);
    }
    if (wheels.length && Math.abs(this.throttle) > 0.05) {
      for (const w of wheels) {
        const t = new THREE.Vector3(this.throttle * 7.5, 0, 0);
        t.applyQuaternion(w.mesh.quaternion);
        w.body.addTorque({ x: t.x, y: t.y, z: t.z }, true);
      }
    }
    for (const s of steers) {
      if (!s.body) continue;
    }
    const wind = this.game.wind?.vector || { x: 0, y: 0, z: 0 };
    for (const b of balloons) {
      b.body.addForce({ x: wind.x * 1.6, y: b.def.lift, z: wind.z * 1.6 }, true);
    }
    for (const p of props) {
      const f = new THREE.Vector3(0, 0, this.throttle * p.def.thrust);
      f.applyQuaternion(p.mesh.quaternion);
      p.body.addForce({ x: f.x, y: f.y, z: f.z }, true);
    }
    this._aero(wings, wind);

    const seat = this.seat();
    if (seat) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(seat.mesh.quaternion);
      if (up.y < 0.15) this.flipTimer += dt;
      else this.flipTimer = 0;
      if (this.lastPos) this.distance += seat.mesh.position.distanceTo(this.lastPos);
      this.lastPos = seat.mesh.position.clone();
    }

    const rpm = Math.min(1, Math.abs(this.throttle) + (wheels[0]?.body ? Math.hypot(wheels[0].body.angvel().x, wheels[0].body.angvel().z) / 20 : 0));
    this.game.audio.setMotor(this.launched ? rpm : 0);

    if (this.game.gfx.particles && seat && Math.abs(this.throttle) > 0.2 && Math.random() < dt * 10) {
      const p = seat.mesh.position;
      this.game.gfx.particles.emit('dust', new THREE.Vector3(p.x, p.y - 0.4, p.z), 2);
    }
  }

  _aero(wings, wind) {
    for (const w of wings) {
      const lv = w.body.linvel();
      const rel = new THREE.Vector3(lv.x - wind.x, lv.y - (wind.y || 0), lv.z - wind.z);
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(w.mesh.quaternion);
      const speed = rel.length();
      if (speed < 0.4) continue;
      const flow = rel.clone().normalize();
      const aoa = n.dot(flow);
      const liftDir = n.clone().multiplyScalar(-aoa);
      const lift = liftDir.multiplyScalar(speed * speed * 0.35);
      const drag = flow.multiplyScalar(-speed * speed * 0.08);
      w.body.addForce({ x: lift.x + drag.x, y: lift.y + drag.y, z: lift.z + drag.z }, true);
    }
  }

  unflip() {
    const seat = this.seat();
    if (!seat) return;
    const c = new THREE.Vector3();
    for (const p of this.parts) c.add(p.mesh.position);
    c.multiplyScalar(1 / Math.max(1, this.parts.length));
    for (const p of this.parts) {
      const t = p.body.translation();
      p.body.setTranslation({ x: t.x, y: t.y + 1.2, z: t.z }, true);
      p.body.setLinvel({ x: 0, y: 0.4, z: 0 }, true);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      p.body.setRotation({ x: 0, y: p.mesh.quaternion.y, z: 0, w: p.mesh.quaternion.w }, true);
    }
    this.flipTimer = 0;
  }

  serialize() {
    return {
      launched: this.launched,
      parts: this.parts.map((p) => {
        const t = p.body.translation();
        const r = p.body.rotation();
        return {
          id: p.id,
          type: p.type,
          x: t.x, y: t.y, z: t.z,
          qx: r.x, qy: r.y, qz: r.z, qw: r.w,
        };
      }),
      joints: this.joints.map((j) => ({ a: j.a, b: j.b, pa: j.portA, pb: j.portB, type: j.type })),
      editor: this.editor,
    };
  }

  restore(data) {
    this.clear();
    if (!data || !data.parts) return;
    const map = new Map();
    for (const rec of data.parts) {
      const pos = new THREE.Vector3(rec.x, rec.y, rec.z);
      const q = new THREE.Quaternion(rec.qx, rec.qy, rec.qz, rec.qw);
      const p = this.place(rec.type, pos, q, null, rec.id);
      map.set(rec.id, p);
    }
    for (const j of data.joints || []) {
      const a = map.get(j.a);
      const b = map.get(j.b);
      if (a && b) this.connect(a, j.pa, b, j.pb);
    }
    this.editor = data.editor || [];
    if (data.launched) this.launch();
    const maxN = this.parts.reduce((m, p) => {
      const n = Number(String(p.id).split('_').pop());
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 1);
    this.idSeq = maxN + 1;
  }
}
