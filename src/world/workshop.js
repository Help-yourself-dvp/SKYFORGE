import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { GROUPS, interactionGroups, ALL_GROUPS } from '../config.js';

export class Workshop {
  constructor(game, pos) {
    this.game = game;
    this.pos = pos.clone();
    this.radius = 10;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.userData.kind = 'workshop';
    this.lights = [];
    this._build();
    game.gfx.scene.add(this.group);
  }

  _mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.08, ...extra });
  }

  _box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.kind = 'workshop';
    return m;
  }

  _build() {
    const wood = this._mat(0x6a4a32);
    const dark = this._mat(0x3a2a22);
    const brass = this._mat(0xc4a15a, { metalness: 0.7, roughness: 0.32 });
    const copper = this._mat(0x6e8b74, { metalness: 0.45, roughness: 0.4 });
    const cloth = this._mat(0x4a3030);
    const stone = this._mat(0x6d6a66, { roughness: 0.88 });

    const floor = this._box(8.4, 0.18, 7.2, wood);
    floor.position.y = 0.05;
    this.group.add(floor);

    const posts = [[-3.6, -2.8], [3.6, -2.8], [-3.6, 2.8], [3.6, 2.8]];
    for (const [x, z] of posts) {
      const p = this._box(0.22, 3.1, 0.22, dark);
      p.position.set(x, 1.55, z);
      this.group.add(p);
    }
    const roof = this._box(8.8, 0.16, 7.6, cloth);
    roof.position.y = 3.25;
    roof.rotation.z = -0.06;
    this.group.add(roof);
    const beam = this._box(8.6, 0.18, 0.2, wood);
    beam.position.y = 3.05;
    this.group.add(beam);

    const bench = this._box(2.6, 0.16, 1.1, wood);
    bench.position.set(0.2, 0.92, 0.4);
    this.group.add(bench);
    for (const x of [-1.1, 1.1]) {
      const leg = this._box(0.12, 0.84, 0.9, dark);
      leg.position.set(x, 0.46, 0.4);
      this.group.add(leg);
    }

    const shelf = this._box(2.2, 1.6, 0.35, wood);
    shelf.position.set(-2.6, 1.1, -2.4);
    this.group.add(shelf);

    const forge = this._box(1.3, 0.7, 1.1, stone);
    forge.position.set(2.6, 0.45, -1.8);
    this.group.add(forge);
    const coals = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0xff6a22, emissiveIntensity: 1.4 }),
    );
    coals.position.set(2.6, 0.86, -1.8);
    coals.userData.kind = 'workshop';
    this.group.add(coals);
    this.coals = coals;
    const glow = new THREE.PointLight(0xff7a32, 1.4, 8, 1.6);
    glow.position.set(2.6, 1.2, -1.8);
    this.group.add(glow);
    this.lights.push(glow);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8c878, emissive: 0xffc056, emissiveIntensity: 0.9 }),
    );
    lantern.position.set(-1.4, 2.55, 1.2);
    this.group.add(lantern);
    const lamp = new THREE.PointLight(0xffd090, 0.7, 7, 1.8);
    lamp.position.copy(lantern.position);
    this.group.add(lamp);
    this.lights.push(lamp);

    const vanePole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), brass);
    vanePole.position.set(3.4, 3.9, 2.2);
    this.group.add(vanePole);
    this.vane = this._box(0.7, 0.06, 0.16, copper);
    this.vane.position.set(3.4, 4.55, 2.2);
    this.group.add(this.vane);

    this.anvil = this._box(0.7, 0.28, 0.35, this._mat(0x3a3a40, { metalness: 0.8, roughness: 0.28 }));
    this.anvil.position.set(1.4, 1.12, -1.5);
    this.group.add(this.anvil);

    this._staticCollider();
    this.crates = [];
  }

  _staticCollider() {
    const p = this.pos;
    const body = this.game.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y + 0.05, p.z),
    );
    const floor = RAPIER.ColliderDesc.cuboid(4.2, 0.1, 3.6)
      .setCollisionGroups(interactionGroups(GROUPS.staticWorld, ALL_GROUPS));
    this.game.physics.world.createCollider(floor, body);
  }

  spawnCrates() {
    const spots = [
      new THREE.Vector3(this.pos.x + 2.1, this.pos.y + 0.45, this.pos.z + 1.6),
      new THREE.Vector3(this.pos.x - 1.8, this.pos.y + 0.45, this.pos.z + 1.8),
    ];
    for (const s of spots) {
      this.crates.push(this.game.resources.spawnCrate(s));
    }
  }

  contains(pos) {
    return pos.distanceTo(this.pos) <= this.radius;
  }

  update(dt, wind, night) {
    if (this.vane) this.vane.rotation.y = Math.atan2(wind.x, wind.z);
    if (this.coals) {
      this.coals.material.emissiveIntensity = 1.15 + Math.sin(performance.now() * 0.008) * 0.3;
    }
    for (const l of this.lights) {
      l.intensity = (night > 0.25 ? 1.5 : 0.45) * (0.9 + Math.sin(performance.now() * 0.006) * 0.1);
    }
  }
}
