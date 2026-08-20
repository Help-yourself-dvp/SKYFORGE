import * as THREE from 'three';
import { RAPIER } from '../physics/world.js';
import { TREE_HEALTH, ROCK_HEALTH, ORE_HEALTH, GROUPS, interactionGroups, ALL_GROUPS } from '../config.js';
import { applyMaterial, propFilter, worldFilter } from '../physics/materials.js';

const _AX_X = new THREE.Vector3(1, 0, 0);
const _AX_Y = new THREE.Vector3(0, 1, 0);

export class Resources {
  constructor(game) {
    this.game = game;
    this.trees = [];
    this.rocks = [];
    this.ores = [];
    this.fruitSlots = [];
    this.props = [];
    this.group = new THREE.Group();
    this.group.userData.kind = 'resources';
    game.gfx.scene.add(this.group);
    this.cut = new Set();
  }

  generate(island, rng, savedCut = []) {
    this.cut = new Set(savedCut);
    this._trees(island, rng);
    this._rocks(island, rng);
    this._ore(island, rng);
    this._loose(island, rng);
  }

  _trees(island, rng) {
    const spots = [];
    for (let i = 0; i < 22; i++) {
      const p = this._spot(island, rng, 'meadow', 5);
      if (p) spots.push(p);
    }
    for (let i = 0; i < spots.length; i++) {
      const r = i % 3;
      let type = r === 0 ? 'fruit' : r === 1 ? 'pine' : (rng.chance(0.3) ? 'sapling' : 'broad');
      const id = `tree_${i}`;
      if (this.cut.has(id)) continue;
      this.spawnTree(spots[i], type, id, rng);
    }
  }

  // Tree visual: Kenney Nature Kit GLB when available, procedural fallback.
  _treeGroup(type, id, rng) {
    const pools = {
      broad: ['tree_default', 'tree_default_dark', 'tree_fat'],
      pine: ['tree_pineDefaultA', 'tree_pineRoundB', 'tree_pineTallA'],
      fruit: ['tree_oak'],
      sapling: ['tree_small'],
    };
    const name = this.game.models?.pick(rng ? rng.next() : 0.5, pools[type] || pools.broad);
    if (name) {
      const g = this.game.models.get(name);
      g.position.set(0, 0, 0);
      g.userData.kind = 'tree';
      g.userData.id = id;
      g.userData.modelName = name;
      return { g, h: type === 'pine' ? 4.6 : type === 'fruit' ? 4.2 : type === 'sapling' ? 2.4 : 4.4, crowns: [], glb: true };
    }
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
      color: type === 'pine' ? 0x7a5a40 : 0x9a6e46,
      roughness: 0.78,
      emissive: 0x2a1810,
      emissiveIntensity: 0.06,
    });
    const leafCol = type === 'pine' ? 0x4f7a4e : type === 'fruit' ? 0x5a8a4c : 0x56824c;
    const leaf = new THREE.MeshStandardMaterial({
      color: leafCol,
      roughness: 0.62,
      metalness: 0.02,
      emissive: 0x142010,
      emissiveIntensity: 0.1,
    });
    const h = type === 'pine' ? 5.4 : 4.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 7), bark);
    trunk.position.y = h * 0.5;
    trunk.castShadow = true;
    trunk.userData.kind = 'tree';
    g.add(trunk);
    const crowns = [];
    if (type === 'pine') {
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.92 - i * 0.14, 1.35, 7), leaf);
        c.position.y = 2.2 + i * 0.8;
        c.castShadow = true;
        g.add(c);
        crowns.push(c);
      }
    } else {
      const n = type === 'fruit' ? 5 : 6;
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.56 + (i % 3) * 0.09, 8, 6), leaf);
        c.position.set(((i % 3) - 1) * 0.5, h - 0.45 + (i % 2) * 0.3, (Math.floor(i / 2) - 1) * 0.36);
        c.scale.set(1.05, 0.72, 1);
        c.castShadow = true;
        g.add(c);
        crowns.push(c);
      }
    }
    g.userData.kind = 'tree';
    g.userData.id = id;
    return { g, h, crowns, glb: false };
  }

  spawnTree(pos, type, id, rng) {
    const { g, h, crowns } = this._treeGroup(type, id, rng);
    g.position.copy(pos);
    this.group.add(g);
    const body = this.game.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y + h * 0.5, pos.z),
    );
    const col = RAPIER.ColliderDesc.cylinder(h * 0.5, 0.28)
      .setCollisionGroups(worldFilter())
      .setFriction(0.7);
    const collider = this.game.physics.world.createCollider(col, body);
    applyMaterial(collider, 'wood');
    const tree = {
      id,
      type,
      mesh: g,
      body,
      collider,
      health: TREE_HEALTH,
      max: TREE_HEALTH,
      pos: pos.clone(),
      h,
      fallen: false,
      fruit: type === 'fruit',
      crowns,
    };
    g.userData.physId = id;
    g.userData.harvest = 'wood';
    this.game.physics.sync.add({
      id, kind: 'tree', body, collider, mesh: g, mass: 0, manualSync: true, tree,
    });
    this.trees.push(tree);
    if (type === 'fruit') this._fruitOn(tree, rng);
    return tree;
  }

  _fruitOn(tree, rng) {
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const off = new THREE.Vector3(rng.range(-0.6, 0.6), tree.h - 0.3, rng.range(-0.5, 0.5));
      const p = tree.pos.clone().add(off);
      this.fruitSlots.push({ treeId: tree.id, pos: p, fruit: null, timer: rng.range(0, 8) });
      this.spawnFruit(p);
    }
  }

  spawnFruit(pos) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb84a3a, roughness: 0.55 }),
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.userData.kind = 'fruit';
    mesh.userData.grabbable = true;
    this.group.add(mesh);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true);
    const col = RAPIER.ColliderDesc.ball(0.14).setCollisionGroups(propFilter()).setMass(0.35);
    const ent = this.game.physics.createDynamic(desc, col, mesh, {
      kind: 'fruit', mass: 0.35, buoyancy: true, grabbable: true, material: 'wood', resource: 'fruit',
    });
    this.props.push(ent);
    return ent;
  }

  _rocks(island, rng) {
    for (let i = 0; i < 14; i++) {
      const p = this._spot(island, rng, 'quarry', 3) || this._spot(island, rng, null, 4);
      if (!p) continue;
      this.spawnRock(p, `rock_${i}`, rng, false);
    }
  }

  _ore(island, rng) {
    for (let i = 0; i < 6; i++) {
      const p = this._spot(island, rng, 'quarry', 3);
      if (!p) continue;
      this.spawnRock(p, `ore_${i}`, rng, true);
    }
  }

  spawnRock(pos, id, rng, ore) {
    const s = rng.range(0.45, 0.85);
    let mesh = null;
    let visH = 0;
    if (this.game.models?.ready) {
      let name;
      if (ore) {
        name = 'stone_largeA';
        visH = 0.68;
      } else if (s > 0.62) {
        name = rng.next() < 0.5 ? 'rock_largeA' : 'rock_largeB';
        visH = name === 'rock_largeA' ? 0.68 : 0.86;
      } else {
        name = rng.next() < 0.5 ? 'rock_smallA' : 'rock_smallB';
        visH = 0.45;
      }
      mesh = this.game.models.get(name);
      visH *= s / 0.6; // tie the visual size to the gameplay size draw
      mesh.rotation.y = rng.range(0, Math.PI * 2);
    }
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        new THREE.MeshStandardMaterial({
          color: ore ? 0x5a6570 : 0x6d6a66,
          roughness: ore ? 0.55 : 0.9,
          metalness: ore ? 0.35 : 0.05,
        }),
      );
      visH = s * 1.1;
    }
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.userData.kind = ore ? 'ore' : 'rock';
    mesh.userData.id = id;
    mesh.userData.harvest = ore ? 'ore' : 'stone';
    mesh.userData.baseScale = mesh.scale.x || 1;
    this.group.add(mesh);
    const centerY = pos.y + Math.max(0.3, visH * 0.5);
    const body = this.game.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, centerY, pos.z),
    );
    const col = RAPIER.ColliderDesc.ball(Math.max(0.3, s * 0.85)).setCollisionGroups(worldFilter());
    const collider = this.game.physics.world.createCollider(col, body);
    applyMaterial(collider, 'stone');
    const rec = { id, mesh, body, collider, health: ore ? ORE_HEALTH : ROCK_HEALTH, max: ore ? ORE_HEALTH : ROCK_HEALTH, ore, s, pos: new THREE.Vector3(pos.x, centerY, pos.z) };
    this.game.physics.sync.add({ id, kind: mesh.userData.kind, body, collider, mesh, mass: 0, manualSync: true, rock: rec });
    (ore ? this.ores : this.rocks).push(rec);
    return rec;
  }

  _loose(island, rng) {
    for (let i = 0; i < 8; i++) {
      const p = this._spot(island, rng, null, 4);
      if (!p) continue;
      this.spawnLooseRock(p.clone().add(new THREE.Vector3(0, 0.35, 0)), rng);
    }
    for (let i = 0; i < 3; i++) {
      const p = this._spot(island, rng, 'meadow', 5);
      if (!p) continue;
      this.spawnLog(p.clone().add(new THREE.Vector3(0, 0.4, 0)), rng.range(0, Math.PI));
    }
  }

  spawnLooseRock(pos, rng) {
    const s = rng ? rng.range(0.18, 0.28) : 0.22;
    let mesh = this.game.models?.ready ? this.game.models.get(rng && rng.next() < 0.5 ? 'rock_smallA' : 'rock_smallB') : null;
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        new THREE.MeshStandardMaterial({ color: 0x7a7670, roughness: 0.88 }),
      );
    }
    mesh.position.copy(pos);
    mesh.rotation.y = rng ? rng.range(0, Math.PI * 2) : 0;
    mesh.castShadow = true;
    mesh.userData.kind = 'prop';
    mesh.userData.grabbable = true;
    this.group.add(mesh);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y + 0.12, pos.z).setCcdEnabled(true);
    const col = RAPIER.ColliderDesc.ball(s).setCollisionGroups(propFilter()).setMass(2.4);
    const ent = this.game.physics.createDynamic(desc, col, mesh, {
      kind: 'prop', mass: 2.4, grabbable: true, material: 'stone',
    });
    this.props.push(ent);
    return ent;
  }

  spawnCrate(pos) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.75 }),
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.userData.kind = 'crate';
    mesh.userData.grabbable = true;
    this.group.add(mesh);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
    const col = RAPIER.ColliderDesc.cuboid(0.275, 0.225, 0.225).setCollisionGroups(propFilter()).setMass(3.5);
    const ent = this.game.physics.createDynamic(desc, col, mesh, {
      kind: 'crate', mass: 3.5, buoyancy: true, grabbable: true, material: 'wood',
    });
    this.props.push(ent);
    return ent;
  }

  spawnLog(pos, yaw = 0) {
    const big = Math.random() < 0.25;
    let mesh = this.game.models?.ready
      ? this.game.models.get(big ? 'log_large' : 'log')
      : null;
    const halfLen = big ? 0.62 : 0.62; // half-length of the collider along Z
    const radius = big ? 0.25 : 0.11;
    if (mesh) {
      // GLB log origin is at its bottom; lift so the body center matches the
      // visual center (the collider sits at the body position).
      mesh.position.set(pos.x, pos.y + radius, pos.z);
      mesh.rotation.y = yaw;
      mesh.userData.kind = 'log';
      mesh.userData.grabbable = true;
      mesh.userData.resource = 'wood';
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 1.35, 7),
        new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.86 }),
      );
      mesh.rotation.z = Math.PI / 2;
      mesh.rotation.y = yaw;
      mesh.position.set(pos.x, pos.y + radius, pos.z);
      mesh.userData.kind = 'log';
      mesh.userData.grabbable = true;
      mesh.userData.resource = 'wood';
    }
    mesh.castShadow = true;
    this.group.add(mesh);
    // Horizontal cylinder collider along Z (matches the GLB log orientation):
    // base rotation 90° about X (Y->Z) composed with the yaw around Y.
    const q = new THREE.Quaternion()
      .setFromAxisAngle(_AX_X, Math.PI / 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(_AX_Y, yaw));
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y + radius, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setCcdEnabled(true);
    const col = RAPIER.ColliderDesc.cylinder(halfLen, radius).setCollisionGroups(propFilter()).setMass(5);
    const ent = this.game.physics.createDynamic(desc, col, mesh, {
      kind: 'log', mass: 5, buoyancy: true, buoyancyScale: 1.35, grabbable: true, material: 'wood', resource: 'wood',
    });
    this.props.push(ent);
    return ent;
  }

  spawnStoneChunk(pos) {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9 }),
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.userData.kind = 'chunk';
    mesh.userData.grabbable = true;
    mesh.userData.resource = 'stone';
    this.group.add(mesh);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true);
    const col = RAPIER.ColliderDesc.ball(0.16).setCollisionGroups(propFilter()).setMass(2.2);
    return this.game.physics.createDynamic(desc, col, mesh, {
      kind: 'chunk', mass: 2.2, grabbable: true, material: 'stone', resource: 'stone',
    });
  }

  hitTree(tree, dmg) {
    if (!tree || tree.fallen) return false;
    tree.health -= dmg;
    tree.mesh.rotation.z = (Math.random() - 0.5) * 0.05;
    this.game.gfx.particles?.emit('chip', tree.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), 10);
    this.game.audio.play('wood_hit');
    if (tree.health <= 0) {
      this.fallTree(tree);
      return true;
    }
    return false;
  }

  fallTree(tree) {
    tree.fallen = true;
    this.cut.add(tree.id);
    this.game.physics.world.removeRigidBody(tree.body);
    this.game.physics.sync.remove(this.game.physics.sync.byId.get(tree.id));
    const dir = new THREE.Vector3(1, 0, 0.3).normalize();
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(tree.pos.x, tree.pos.y + tree.h * 0.45, tree.pos.z)
      .setCcdEnabled(true)
      .setLinvel(dir.x * 0.4, 0.2, dir.z * 0.4)
      .setAngvel(0, 0, 1.6);
    const col = RAPIER.ColliderDesc.cylinder(tree.h * 0.45, 0.26).setMass(18).setCollisionGroups(propFilter());
    tree.mesh.position.copy(tree.pos);
    const ent = this.game.physics.createDynamic(desc, col, tree.mesh, {
      kind: 'treeFall', mass: 18, buoyancy: true, grabbable: false, material: 'wood',
    });
    this.game.audio.play('tree_fall');
    this.game.notifyProgress?.('tree');
    this.spawnStump(tree.pos, tree.id);
    setTimeout(() => {
      if (!this.game || this.game.disposed) return;
      this.game.physics.removeEntity(ent);
      this.group.remove(tree.mesh);
      for (let i = 0; i < 3; i++) {
        const p = tree.pos.clone().add(new THREE.Vector3((i - 1) * 0.7, 0.45, (i % 2) * 0.3));
        p.y = Math.max(p.y, this.game.world.heightAt(p.x, p.z) + 0.4);
        this.spawnLog(p, i * 0.4);
      }
    }, 1600);
  }

  // Static stump left behind after a tree falls (solid, small cylinder).
  spawnStump(pos, treeId) {
    const name = Math.random() < 0.5 ? 'stump_round' : 'stump_old';
    let mesh = this.game.models?.ready ? this.game.models.get(name) : null;
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.3, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.85 }),
      );
      mesh.position.y = 0.2;
    }
    mesh.position.copy(pos);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.userData.kind = 'stump';
    mesh.userData.id = `stump_${treeId}`;
    this.group.add(mesh);
    const body = this.game.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y + 0.2, pos.z),
    );
    const col = RAPIER.ColliderDesc.cylinder(0.22, 0.28).setCollisionGroups(worldFilter());
    const collider = this.game.physics.world.createCollider(col, body);
    applyMaterial(collider, 'wood');
    this.game.physics.sync.add({
      id: `stump_${treeId}`, kind: 'stump', body, collider, mesh, mass: 0, manualSync: true,
    });
  }

  hitRock(rock, dmg) {
    if (!rock) return false;
    rock.health -= dmg;
    this.game.gfx.particles?.emit('grit', rock.pos, 12);
    this.game.audio.play('stone_crack');
    const base = rock.mesh.userData.baseScale || 1;
    rock.mesh.scale.setScalar(base * (0.92 + (rock.health / rock.max) * 0.08));
    if (rock.health <= 0) {
      this.breakRock(rock);
      return true;
    }
    return false;
  }

  breakRock(rock) {
    this.game.physics.world.removeRigidBody(rock.body);
    this.game.physics.sync.remove(this.game.physics.sync.byId.get(rock.id));
    this.group.remove(rock.mesh);
    const n = rock.ore ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const p = rock.pos.clone().add(new THREE.Vector3((i - 1) * 0.25, 0.2, (i % 2) * 0.2));
      const chunk = this.spawnStoneChunk(p);
      if (rock.ore) {
        chunk.resource = 'ore';
        chunk.mesh.userData.resource = 'ore';
        chunk.mesh.material.color.setHex(0x5a6570);
      }
    }
    const arr = rock.ore ? this.ores : this.rocks;
    const ix = arr.indexOf(rock);
    if (ix >= 0) arr.splice(ix, 1);
  }

  _spot(island, rng, zone, margin) {
    for (let k = 0; k < 16; k++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * (island.radius - (margin || 5));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (zone && island.zoneAt(x, z) !== zone && !(zone === 'meadow' && island.zoneAt(x, z) !== 'quarry')) continue;
      if (Math.hypot(x - island.workshop.x, z - island.workshop.z) < 6) continue;
      const y = island.sample(x, z);
      if (y < island.pond.level + 0.35) continue;
      return new THREE.Vector3(x, y, z);
    }
    return null;
  }

  collectProp(ent) {
    if (!ent) return null;
    const res = ent.resource || ent.mesh?.userData.resource;
    if (!res) return null;
    this.game.physics.removeEntity(ent);
    ent.mesh?.parent?.remove(ent.mesh);
    return res;
  }

  dropFruitFrom(tree, force = false) {
    for (const slot of this.fruitSlots) {
      if (slot.treeId !== tree.id || !slot.fruit) continue;
      if (force || Math.random() < 0.5) {
        const f = slot.fruit;
        if (f.body) f.body.applyImpulse({ x: (Math.random() - 0.5) * 2, y: 1, z: (Math.random() - 0.5) * 2 }, true);
        slot.fruit = null;
      }
    }
  }
}
