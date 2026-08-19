import * as THREE from 'three';
import { CAMERA } from '../config.js';

const _ray = new THREE.Raycaster();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class GameCamera {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0.4;
    this.pitch = 0.18;
    this.mode = 'explore';
    this.current = new THREE.Vector3(0, 8, 8);
    this.look = new THREE.Vector3();
    this.punch = 0;
    this.locked = null;
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
    const back = new THREE.Vector3(sy * cp, -sp, cy * cp);
    const right = new THREE.Vector3(cy, 0, -sy);
    const desired = target.clone().add(back.multiplyScalar(dist)).add(new THREE.Vector3(0, height, 0)).add(right.multiplyScalar(shoulder));
    this._collide(target, desired);
    const k = 1 - Math.pow(0.001, dt * (this.mode === 'drive' ? 6 : cfg.spring * 0.6));
    this.current.lerp(desired, k);
    this.look.copy(target).add(new THREE.Vector3(0, 1.15, 0));
    if (this.mode === 'drive' && forwardHint) {
      this.look.lerp(target.clone().add(forwardHint.clone().multiplyScalar(4)).add(new THREE.Vector3(0, 1, 0)), 0.35);
    }
    this.camera.position.copy(this.current);
    if (this.punch > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.punch;
      this.camera.position.y += (Math.random() - 0.5) * this.punch * 0.5;
      this.punch *= 0.82;
    }
    this.camera.lookAt(this.look);
    this.camera.up.set(0, 1, 0);
  }

  _collide(target, desired) {
    _from.copy(target).add(new THREE.Vector3(0, 1.2, 0));
    _dir.copy(desired).sub(_from);
    const len = _dir.length();
    if (len < 0.2) return;
    _dir.multiplyScalar(1 / len);
    const hit = this.game.physics.raycast(
      { x: _from.x, y: _from.y, z: _from.z },
      { x: _dir.x, y: _dir.y, z: _dir.z },
      len,
      this.game.player?.body || null,
    );
    if (hit && hit.ent && (hit.ent.kind === 'terrain' || hit.ent.kind === 'workshop' || hit.ent.kind === 'rock' || hit.ent.kind === 'tree')) {
      desired.copy(_from).add(_dir.multiplyScalar(Math.max(0.4, hit.toi - 0.28)));
    }
  }

  forward() {
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-5) f.set(0, 0, 1);
    return f.normalize();
  }

  right() {
    return new THREE.Vector3().crossVectors(this.forward(), new THREE.Vector3(0, 1, 0)).normalize();
  }
}
