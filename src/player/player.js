import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { PLAYER } from '../config.js';
import { playerFilter } from '../physics/materials.js';

const _wish = new THREE.Vector3();
const _hold = new THREE.Vector3();
const _throwDir = new THREE.Vector3();
const _scarf = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.radius = PLAYER.radius;
    this.height = PLAYER.height;
    this.vy = 0;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.yaw = 0;
    this.position = new THREE.Vector3(4.5, 10, -4);
    this.lastSafe = this.position.clone();
    this.falling = 0;
    this.speed = 0;
    this.onSurface = 'grass';
    this.carry = null;
    this.throwCharge = 0;
    this.charging = false;
    this.hitCd = 0;
    this.inCombat = false;
    this.combatT = 0;
    this.foot = 0;
    this.hidden = false;
    this.group = this._mesh();
    game.gfx.scene.add(this.group);
    this._body();
  }

  _mesh() {
    const g = new THREE.Group();
    g.userData.kind = 'player';
    const cloth = new THREE.MeshStandardMaterial({ color: 0x8a4034, roughness: 0.72 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.65 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc4a15a, metalness: 0.5, roughness: 0.4 });

    this.hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), dark);
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.22), cloth);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), skin);
    this.mask = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.1, 0.06), dark);
    this.lArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), cloth);
    this.rArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), cloth);
    this.lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), dark);
    this.rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), dark);
    this.hips.position.y = 0.78;
    this.torso.position.y = 1.08;
    this.head.position.y = 1.42;
    this.mask.position.set(0, 1.4, 0.12);
    this.lArm.position.set(-0.26, 1.02, 0);
    this.rArm.position.set(0.26, 1.02, 0);
    this.lLeg.position.set(-0.1, 0.4, 0);
    this.rLeg.position.set(0.1, 0.4, 0);
    g.add(this.hips, this.torso, this.head, this.mask, this.lArm, this.rArm, this.lLeg, this.rLeg);

    this.scarf = [];
    let prev = this.torso;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.22), cloth);
      s.position.set(0.08, 1.18 - i * 0.12, -0.18 - i * 0.05);
      g.add(s);
      this.scarf.push({ mesh: s, vel: new THREE.Vector3(), rest: s.position.clone() });
      prev = s;
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.kind = 'player';
      }
    });
    this.parts = { cloth, dark, skin, brass };
    return g;
  }

  _body() {
    const p = this.position;
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z);
    this.body = this.game.physics.world.createRigidBody(desc);
    const half = (this.height - this.radius * 2) * 0.5;
    const col = RAPIER.ColliderDesc.capsule(half, this.radius)
      .setTranslation(0, this.height * 0.5, 0)
      .setCollisionGroups(playerFilter())
      .setFriction(0.0)
      .setRestitution(0);
    this.collider = this.game.physics.world.createCollider(col, this.body);
    this.controller = this.game.physics.world.createCharacterController(0.01);
    this.controller.setMaxSlopeClimbAngle(PLAYER.maxSlope);
    this.controller.setMinSlopeSlideAngle(PLAYER.maxSlope + 0.08);
    this.controller.enableAutostep(PLAYER.stepHeight, 0.18, true);
    this.controller.enableSnapToGround(0.35);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(12);
    this.game.physics.sync.add({
      id: 'player', kind: 'player', body: this.body, collider: this.collider, mesh: this.group, mass: 12, manualSync: true,
    });
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.body.setNextKinematicTranslation({ x, y, z });
    this.group.position.copy(this.position);
  }

  update(dt, input, cam) {
    if (this.hidden) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.combatT = Math.max(0, this.combatT - dt);
    this.inCombat = this.combatT > 0;

    const look = input.consumeLook();
    cam.addLook(look.x, look.y);
    if (this.game.input.keys.MouseMove) { /* */ }

    const axis = input.axis || { x: 0, y: 0 };
    const fwd = cam.forward();
    const rx = fwd.z;
    const rz = -fwd.x;
    _wish.set(fwd.x * axis.y + rx * axis.x, 0, fwd.z * axis.y + rz * axis.x);
    const moving = _wish.length() > 0.05;
    if (moving) _wish.normalize();

    const grounded = this.controller.computedGrounded();
    if (grounded) {
      this.grounded = true;
      this.coyote = PLAYER.coyoteTime;
      if (this.vy < -3.2) this.game.audio.play('land');
      this.vy = 0;
      const t = this.position;
      if (t.y > this.game.world.heightAt(t.x, t.z) - 0.5) this.lastSafe.set(t.x, t.y, t.z);
    } else {
      this.coyote -= dt;
      this.grounded = this.coyote > 0;
      this.vy -= 9.81 * dt;
    }
    if (input.jumpPressed) this.jumpBuf = PLAYER.jumpBuffer;
    else this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = PLAYER.jumpSpeed;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.grounded = false;
      this.game.audio.play('jump');
    }

    const spd = (this.game.input.keys.ShiftLeft ? PLAYER.runSpeed : PLAYER.walkSpeed);
    const control = this.grounded ? 1 : PLAYER.airControl;
    const vx = _wish.x * spd * control;
    const vz = _wish.z * spd * control;
    const desired = { x: vx * dt, y: this.vy * dt, z: vz * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const mv = this.controller.computedMovement();
    const t = this.body.translation();
    let nx = t.x + mv.x;
    let ny = t.y + mv.y;
    let nz = t.z + mv.z;
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      this.respawnSafe();
      return;
    }
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.position.set(nx, ny, nz);
    this.speed = Math.hypot(vx, vz);
    if (moving) this.yaw = Math.atan2(wish.x, wish.z);

    if (ny < -8 || (Math.hypot(nx, nz) > this.game.world.main.radius + 2 && ny < this.game.world.heightAt(nx, nz) - 4)) {
      this.falling += dt;
      if (this.falling > PLAYER.fallRespawnDelay) this.respawnSafe();
    } else this.falling = 0;

    this._animate(dt, moving);
    this._carry(dt, cam, input);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    if (this.grounded && moving) {
      this.foot += dt * this.speed;
      if (this.foot > 0.42) {
        this.foot = 0;
        const h = this.game.world.heightAt(nx, nz);
        const zone = this.game.world.main.zoneAt(nx, nz);
        const sfx = zone === 'quarry' ? 'foot_stone' : this.onSurface === 'wood' ? 'foot_wood' : 'foot_grass';
        this.game.audio.play(sfx, 0.8);
        if (zone === 'quarry') this.onSurface = 'stone';
        else this.onSurface = 'grass';
        void h;
      }
    }
  }

  _animate(dt, moving) {
    const t = this.game.time;
    const walk = moving ? this.speed / PLAYER.walkSpeed : 0;
    const bob = Math.sin(t * 8) * 0.18 * walk;
    this.lLeg.rotation.x = bob;
    this.rLeg.rotation.x = -bob;
    this.lArm.rotation.x = -bob * 0.7;
    this.rArm.rotation.x = bob * 0.7;
    this.torso.position.y = 1.08 + Math.sin(t * 2.2) * 0.015 + (this.grounded ? 0 : 0.04);
    this.torso.rotation.x = walk * 0.08 + (this.grounded ? 0 : -0.08);
    if (!this.grounded) {
      this.lLeg.rotation.x = -0.3;
      this.rLeg.rotation.x = 0.15;
    }
    if (this.carry) {
      this.lArm.rotation.x = -1.05;
      this.rArm.rotation.x = -1.05;
    }
    const wind = this.game.wind.vector;
    for (let i = 0; i < this.scarf.length; i++) {
      const s = this.scarf[i];
      _scarf.copy(s.rest);
      _scarf.x += wind.x * 0.04 * (i + 1);
      _scarf.z -= 0.04 * i + wind.z * 0.03 * (i + 1);
      _scarf.y -= i * 0.02;
      s.mesh.position.lerp(_scarf, 1 - Math.pow(0.02, dt));
    }
  }

  _carry(dt, cam, input) {
    if (!this.carry || !this.carry.body) {
      this.throwCharge = 0;
      this.charging = false;
      return;
    }
    const hold = _hold.copy(this.position);
    hold.y += 1.25;
    const cf = cam.forward();
    hold.x += cf.x * 1.15;
    hold.z += cf.z * 1.15;
    const t = this.carry.body.translation();
    const dx = hold.x - t.x;
    const dy = hold.y - t.y;
    const dz = hold.z - t.z;
    this.carry.body.setLinvel({ x: dx * 14, y: dy * 14, z: dz * 14 }, true);
    this.carry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (this.charging) {
      this.throwCharge = Math.min(1, this.throwCharge + dt / PLAYER.throwChargeTime);
    }
  }

  grab(ent) {
    if (!ent || !ent.body || !ent.grabbable) return false;
    if ((ent.mass || 1) > PLAYER.carryMass) return false;
    this.carry = ent;
    ent.body.wakeUp();
    this.game.audio.play('grab');
    return true;
  }

  drop() {
    if (!this.carry) return;
    this.carry = null;
    this.charging = false;
    this.throwCharge = 0;
    this.game.audio.play('drop');
  }

  throw(cam) {
    if (!this.carry) return;
    const f = PLAYER.throwForceMin + (PLAYER.throwForceMax - PLAYER.throwForceMin) * this.throwCharge;
    const dir = cam.camera.getWorldDirection(_throwDir);
    const extra = this.speed * 0.35;
    this.carry.body.applyImpulse({ x: dir.x * f + extra, y: dir.y * f + 1.2, z: dir.z * f }, true);
    this.carry = null;
    this.charging = false;
    this.throwCharge = 0;
    this.game.audio.play('throw');
  }

  hurt(n, from) {
    this.game.survival.hurt(n);
    this.combatT = 3;
    this.game.cam.shake(0.12);
    if (from) {
      const dir = this.position.clone().sub(from);
      dir.y = 0;
      dir.normalize();
      const t = this.body.translation();
      this.body.setNextKinematicTranslation({ x: t.x + dir.x * 0.7, y: t.y + 0.15, z: t.z + dir.z * 0.7 });
    }
  }

  respawnSafe() {
    this.falling = 0;
    this.vy = 0;
    const p = this.lastSafe;
    this.setPosition(p.x, p.y + 0.4, p.z);
    this.game.ui?.flash?.();
  }

  hide(v) {
    this.hidden = v;
    this.group.visible = !v;
    if (this.collider) this.collider.setEnabled(!v);
  }
}
