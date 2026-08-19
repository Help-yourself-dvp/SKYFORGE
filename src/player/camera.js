import * as THREE from 'three';
import { CAMERA } from '../config.js';
import { V3A, V3B, V3C, V3D, V3E } from '../scratch.js';

export class GameCamera {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0.55;
    this.pitch = 0.22;
    this.mode = 'explore';
    this.current = new THREE.Vector3(0, 8, 8);
    this.look = new THREE.Vector3();
    this.punch = 0;
    this.locked = null;
    this.distNow = CAMERA.distance;
    this._faded = [];
  }

  addLook(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, CAMERA.pitchMin, CAMERA.pitchMax);
  }

  shake(amt = 0.08) {
    this.punch = Math.max(this.punch, amt);
  }

  update(dt, target, forwardHint) {
    if (this.locked) {
      this.camera.position.copy(this.locked.position);
      this.camera.lookAt(this.locked.look);
      this.camera.up.set(0, 1, 0);
      return;
    }
    const cfg = CAMERA;
    let dist = cfg.distance;
    let height = cfg.height;
    let shoulder = cfg.shoulder;
    if (this.mode === 'drive') {
      dist = cfg.driveDistance;
      height = cfg.driveHeight;
      shoulder = 0.2;
    } else if (this.mode === 'build') {
      dist = cfg.buildDistance;
      height = cfg.buildHeight;
      shoulder = 0.1;
    }

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const back = V3A.set(sy * cp, -sp, cy * cp);
    const right = V3B.set(cy, 0, -sy);
    const desired = V3C.copy(target).addScaledVector(back, dist);
    desired.y += height;
    desired.addScaledVector(right, shoulder);

    const safeDist = this._collide(target, desired, dist);
    const outK = 1 - Math.pow(0.001, dt * (this.mode === 'drive' ? 6 : 8));
    const inK = 1 - Math.pow(0.0001, dt * 14);
    if (safeDist < this.distNow) this.distNow = THREE.MathUtils.lerp(this.distNow, safeDist, inK);
    else this.distNow = THREE.MathUtils.lerp(this.distNow, safeDist, outK);

    V3A.set(sy * Math.cos(this.pitch), -Math.sin(this.pitch), cy * Math.cos(this.pitch));
    this.current.copy(target).addScaledVector(V3A, this.distNow);
    this.current.y += height * (this.distNow / Math.max(0.4, dist));
    this.current.addScaledVector(V3B.set(cy, 0, -sy), shoulder * (this.distNow / Math.max(0.4, dist)));
    this._keepAboveTerrain(target);

    this.look.copy(target);
    this.look.y += 1.15;
    if (this.mode === 'drive' && forwardHint) {
      V3D.copy(target).addScaledVector(forwardHint, 4);
      V3D.y += 1;
      this.look.lerp(V3D, 0.35);
    }
    this.camera.position.copy(this.current);
    if (this.punch > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.punch;
      this.camera.position.y += (Math.random() - 0.5) * this.punch * 0.5;
      this.punch *= 0.82;
    }
    this.camera.lookAt(this.look);
    this.camera.up.set(0, 1, 0);
    this._occluders(target);
  }

  _collide(target, desired, maxDist) {
    const from = V3D.copy(target);
    from.y += 1.25;
    const dir = V3E.copy(desired).sub(from);
    const len = dir.length();
    if (len < 0.2) return Math.max(0.55, len);
    dir.multiplyScalar(1 / len);
    const hit = this.game.physics.raycast(
      { x: from.x, y: from.y, z: from.z },
      { x: dir.x, y: dir.y, z: dir.z },
      len,
      this.game.player?.body || null,
    );
    let safe = len;
    if (hit && hit.ent && (
      hit.ent.kind === 'terrain'
      || hit.ent.kind === 'workshop'
      || hit.ent.kind === 'rock'
      || hit.ent.kind === 'tree'
      || hit.ent.kind === 'ore'
    )) {
      safe = Math.max(0.55, hit.toi - 0.32);
    }
    return Math.min(maxDist, safe);
  }

  _keepAboveTerrain(target) {
    const h = this.game.world?.heightAt?.(this.current.x, this.current.z);
    if (h == null || !Number.isFinite(h)) return;
    const minY = h + 0.85;
    if (this.current.y < minY) {
      this.current.y = minY;
      const dx = this.current.x - target.x;
      const dz = this.current.z - target.z;
      const flat = Math.hypot(dx, dz);
      if (flat > 0.2 && this.current.y > target.y + 0.4) {
        /* stay on the player side of the surface */
      }
    }
    if (this.current.y < target.y + 0.35) this.current.y = target.y + 0.35;
  }

  _occluders(target) {
    for (const m of this._faded) {
      m.traverse((o) => {
        if (o.isMesh && o.material && o.userData._occ) {
          o.material.transparent = o.userData._occTrans;
          o.material.opacity = o.userData._occOp;
          o.material.depthWrite = o.userData._occDw;
          delete o.userData._occ;
        }
      });
    }
    this._faded.length = 0;
    const from = V3D.copy(this.camera.position);
    const dir = V3E.copy(target).sub(from);
    dir.y += 1.1;
    const len = dir.length();
    if (len < 0.4) return;
    dir.multiplyScalar(1 / len);
    const hit = this.game.physics.raycast(
      { x: from.x, y: from.y, z: from.z },
      { x: dir.x, y: dir.y, z: dir.z },
      Math.max(0.2, len - 0.4),
      this.game.player?.body || null,
    );
    if (!hit || !hit.ent || (hit.ent.kind !== 'tree' && hit.ent.kind !== 'plant')) return;
    const mesh = hit.ent.mesh;
    if (!mesh) return;
    this._faded.push(mesh);
    mesh.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (!o.userData._occ) {
        o.userData._occ = 1;
        o.userData._occTrans = o.material.transparent;
        o.userData._occOp = o.material.opacity ?? 1;
        o.userData._occDw = o.material.depthWrite;
      }
      o.material.transparent = true;
      o.material.opacity = 0.22;
      o.material.depthWrite = false;
    });
  }

  forward() {
    this.camera.getWorldDirection(V3A);
    V3A.y = 0;
    if (V3A.lengthSq() < 1e-5) V3A.set(0, 0, 1);
    return V3A.normalize();
  }

  right() {
    return V3B.crossVectors(this.forward(), V3C.set(0, 1, 0)).normalize();
  }
}
