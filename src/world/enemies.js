import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { enemyFilter } from '../physics/materials.js';
import { SURVIVAL } from '../config.js';

const _edest = new THREE.Vector3();

export class Enemies {
  constructor(game) {
    this.game = game;
    this.shades = [];
    this.group = new THREE.Group();
    this.group.userData.kind = 'enemies';
    game.gfx.scene.add(this.group);
    this.spawned = false;
    this.hitCd = 0;
  }

  update(dt) {
    const night = this.game.daynight.isDangerNight();
    if (night && !this.spawned) this._spawn();
    if (!night && this.spawned) this._despawn();
    this.hitCd = Math.max(0, this.hitCd - dt);
    if (!this.spawned) return;
    const player = this.game.player.position;
    const lights = this.game.lightsources();
    for (const s of this.shades) {
      this._ai(s, dt, player, lights);
    }
  }

  _spawn() {
    this.spawned = true;
    const island = this.game.world.main;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const r = 22 + i * 3;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = island.sample(x, z) + 0.7;
      this.shades.push(this._make(new THREE.Vector3(x, y, z), `shade_${i}`));
    }
  }

  _make(pos, id) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x12141c,
      roughness: 0.45,
      metalness: 0.1,
      emissive: 0x1a2340,
      emissiveIntensity: 0.35,
    });
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), bodyMat);
    torso.scale.set(0.7, 1.3, 0.7);
    torso.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bodyMat);
    head.position.y = 1.35;
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x8ad0e0, emissive: 0x4ad0e8, emissiveIntensity: 1.4 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeM);
    const e2 = e1.clone();
    e1.position.set(-0.08, 1.38, 0.14);
    e2.position.set(0.08, 1.38, 0.14);
    g.add(torso, head, e1, e2);
    g.position.copy(pos);
    g.userData.kind = 'enemy';
    this.group.add(g);
    const body = this.game.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z),
    );
    const col = RAPIER.ColliderDesc.capsule(0.45, 0.28).setCollisionGroups(enemyFilter()).setSensor(true);
    const collider = this.game.physics.world.createCollider(col, body);
    return { id, mesh: g, body, collider, pos: pos.clone(), vel: new THREE.Vector3(), state: 'wander', retreat: 0 };
  }

  _ai(s, dt, player, lights) {
    let nearestLight = 99;
    let lightPos = null;
    for (const l of lights) {
      const d = s.mesh.position.distanceTo(l.pos);
      if (d < nearestLight) {
        nearestLight = d;
        lightPos = l.pos;
      }
    }
    if (nearestLight < 4.5) {
      s.state = 'retreat';
      s.retreat = 1.6;
    } else if (s.retreat > 0) {
      s.state = 'retreat';
      s.retreat -= dt;
    } else if (s.mesh.position.distanceTo(player) < 18) {
      s.state = 'chase';
    } else s.state = 'wander';

    const dest = _edest;
    if (s.state === 'retreat' && lightPos) {
      dest.copy(s.mesh.position).sub(lightPos);
      dest.y = 0;
      if (dest.lengthSq() < 0.01) dest.set(1, 0, 0);
      dest.normalize().multiplyScalar(6).add(s.mesh.position);
    } else if (s.state === 'chase') {
      dest.copy(player);
    } else {
      dest.set(
        s.mesh.position.x + Math.sin(this.game.time + s.pos.x) * 3,
        s.mesh.position.y,
        s.mesh.position.z + Math.cos(this.game.time * 0.7 + s.pos.z) * 3,
      );
    }
    const dir = dest.sub(s.mesh.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.1) dir.multiplyScalar((s.state === 'chase' ? 2.6 : 1.6) / dist);
    const nx = s.mesh.position.x + dir.x * dt;
    const nz = s.mesh.position.z + dir.z * dt;
    const ny = this.game.world.heightAt(nx, nz) + 0.15 + Math.sin(this.game.time * 3 + s.pos.x) * 0.08;
    s.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    s.mesh.position.set(nx, ny, nz);
    s.mesh.lookAt(nx + dir.x, ny, nz + dir.z);
    s.mesh.scale.y = 1 + Math.sin(this.game.time * 4 + s.pos.z) * 0.06;

    if (s.state === 'chase' && s.mesh.position.distanceTo(player) < 1.25 && this.hitCd <= 0) {
      this.hitCd = SURVIVAL.shadeCooldown;
      this.game.player.hurt(SURVIVAL.shadeDamage, s.mesh.position);
      this.game.audio.play('hurt');
    }
  }

  _despawn() {
    for (const s of this.shades) {
      this.game.physics.world.removeRigidBody(s.body);
      this.group.remove(s.mesh);
    }
    this.shades.length = 0;
    this.spawned = false;
  }
}
