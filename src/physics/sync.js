import * as THREE from 'three';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _qB = new THREE.Quaternion();

export class PhysicsSync {
  constructor() {
    this.entities = [];
    this.byId = new Map();
    this.byBody = new Map();
    this.byCollider = new Map();
  }

  add(ent) {
    this.entities.push(ent);
    this.byId.set(ent.id, ent);
    if (ent.body) this.byBody.set(ent.body.handle, ent);
    if (ent.collider) this.byCollider.set(ent.collider.handle, ent);
    this.capture(ent, 'prev');
    this.capture(ent, 'curr');
    return ent;
  }

  remove(ent) {
    const i = this.entities.indexOf(ent);
    if (i >= 0) this.entities.splice(i, 1);
    this.byId.delete(ent.id);
    if (ent.body) this.byBody.delete(ent.body.handle);
    if (ent.collider) this.byCollider.delete(ent.collider.handle);
  }

  capture(ent, slot) {
    if (!ent.body) return;
    const t = ent.body.translation();
    const r = ent.body.rotation();
    ent[slot] = { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w };
  }

  snapshot() {
    for (const ent of this.entities) {
      if (!ent.body || ent.kinematicFollow) continue;
      ent.prev = ent.curr;
      this.capture(ent, 'curr');
    }
  }

  apply(alpha) {
    for (const ent of this.entities) {
      if (!ent.mesh || !ent.body || ent.manualSync) continue;
      const a = ent.prev || ent.curr;
      const b = ent.curr || a;
      if (!a || !b) continue;
      _pos.set(
        a.x + (b.x - a.x) * alpha,
        a.y + (b.y - a.y) * alpha,
        a.z + (b.z - a.z) * alpha,
      );
      _quat.set(a.qx, a.qy, a.qz, a.qw);
      _qB.set(b.qx, b.qy, b.qz, b.qw);
      _quat.slerp(_qB, alpha);
      ent.mesh.position.copy(_pos);
      ent.mesh.quaternion.copy(_quat);
    }
  }

  findByMesh(mesh) {
    if (!mesh) return null;
    let m = mesh;
    while (m) {
      if (m.userData && m.userData.physId) return this.byId.get(m.userData.physId) || null;
      m = m.parent;
    }
    return null;
  }
}
