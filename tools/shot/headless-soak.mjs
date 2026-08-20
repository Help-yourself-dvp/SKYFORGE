// Headless soak harness: runs the exact Game.update() sequence with the real
// subsystems (Rapier + Three scene graph work in Node; only WebGL render is
// stubbed). Purpose: find exceptions that would kill the real RAF loop on a
// phone ("freeze"), and verify no runaway entity/body/particle growth over
// 60-120+ simulated seconds.
//
// Usage: node tools/shot/headless-soak.mjs [seconds] [mode]
//   mode: idle | night | drive | chaos
import * as THREE from 'three';

globalThis.__APP_VERSION__ = '0.1.0';

const SECONDS = Number(process.argv[2] || 130);
const MODE = process.argv[3] || 'idle';
const DT = 1 / 60;

async function main() {
  const { createRng, createNoise2D } = await import('../../src/rng.js');
  const { QUALITY } = await import('../../src/config.js');
  const { initRapier, PhysicsWorld } = await import('../../src/physics/world.js');
  const { Archipelago } = await import('../../src/world/archipelago.js');
  const { Workshop } = await import('../../src/world/workshop.js');
  const { Flora } = await import('../../src/world/flora.js');
  const { Resources } = await import('../../src/world/resources.js');
  const { Fauna } = await import('../../src/world/fauna.js');
  const { Enemies } = await import('../../src/world/enemies.js');
  const { DayNight } = await import('../../src/world/daynight.js');
  const { Weather } = await import('../../src/world/weather.js');
  const { Wind } = await import('../../src/sim/wind.js');
  const { Growth } = await import('../../src/sim/growth.js');
  const { Player } = await import('../../src/player/player.js');
  const { GameCamera } = await import('../../src/player/camera.js');
  const { Interact } = await import('../../src/player/interact.js');
  const { Survival } = await import('../../src/player/survival.js');
  const { MachineSystem } = await import('../../src/build/machine.js');
  const { BuildController } = await import('../../src/build/ghost_ctrl.js');
  const { Sky } = await import('../../src/gfx/sky.js');
  const { Water } = await import('../../src/gfx/water.js');
  const { Particles } = await import('../../src/gfx/particles.js');
  const { Dbg } = await import('../../src/dbg.js');
  const { emptyInventory, grant } = await import('../../src/craft/resources.js');
  const { emptyBuildStock } = await import('../../src/build/inventory.js');
  await initRapier();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
  scene.fog = new THREE.Fog(0xc5d4c6, 24, 150);

  // ---- gfx stub (only WebGL parts are stubbed) ----
  const gfx = {
    scene,
    camera,
    sky: null, // set below after Sky import (created inside main)
    quality: QUALITY.MEDIUM,
    qualityName: 'MEDIUM',
    renderer: {
      info: { render: { calls: 0, triangles: 0 } },
      setSize() {}, setPixelRatio() {}, render() {}, dispose() {},
    },
    resize() {}, setQuality() {}, render() {}, dispose() {},
    initWorld(pond) {
      this.water = new Water(scene, pond);
      this.particles = new Particles(scene, this.quality.particles);
      this.sky = new Sky(scene);
    },
  };

  // ---- fake game object mirroring Game fields used by subsystems ----
  const game = {
    gfx,
    version: '0.1.0',
    state: 'explore',
    simPaused: false,
    disposed: false,
    time: 0,
    placed: [],
    progress: { fruit: 0, trees: 0, driven: 0, nightFire: 0 },
    tools: [],
    inventory: emptyInventory(),
    buildStock: emptyBuildStock(),
    unlocks: {},
    hasTorch: false,
    hasLantern: false,
    seenHorizon: 0,
    autosaveT: 0,
    qualityName: 'MEDIUM',
    portraitLocked: false,
    audio: {
      play() {}, setMotor() {}, update() {}, resume() {}, dispose() {},
      activeNodes() { return 0; },
    },
    ui: { toast() {}, flash() {}, update() {} },
    toast() {}, saveNow() {}, newWorld() {},
    lightsources() { return []; },
    notifyProgress() {},
    onTreeFell() {
      this.progress.trees += 1;
    },
    pickupResource(kind) {
      grant(this.inventory, kind, 1);
      if (kind === 'fruit') this.survival.eatFruit();
    },
    respawnFromDeath() {
      const w = this.workshop.pos;
      this.player.setPosition(w.x + 2, this.world.heightAt(w.x + 2, w.z + 2) + 0.3, w.z + 2);
      this.survival.revive();
      this.player.hide(false);
      if (this.state === 'drive') this.state = 'explore';
    },
    enterVehicle() {
      const seat = this.machine.seat();
      if (!seat || !this.machine.launched) return;
      this.player.hide(true);
      this.player.drop();
      this.state = 'drive';
    },
    exitVehicle() {
      const seat = this.machine.seat();
      const p = seat ? seat.mesh.position.clone() : this.player.position.clone();
      p.x += 1.2;
      p.y = this.world.heightAt(p.x, p.z) + 0.2;
      this.player.hide(false);
      this.player.setPosition(p.x, p.y, p.z);
      this.machine.throttle = 0;
      this.state = 'explore';
    },
  };

  // ---- build the world exactly like Game._systemsFromSeed ----
  game.rng = createRng('SKY-001');
  game.noise = createNoise2D(game.rng);
  game.wind = new Wind(game.rng);
  game.weather = new Weather(game.rng);
  game.growth = new Growth();
  game.world = new Archipelago(game.rng, game.noise).build(scene);
  game.physics = new PhysicsWorld();
  game.physics.pond = game.world.main.pond;
  game.physics.waterLevel = game.world.main.pond.level;
  game.world.main.addCollider(game.physics);
  // water sensor
  const pond = game.world.main.pond;
  const wb = game.physics.world.createRigidBody(
    game.physics.R.RigidBodyDesc.fixed().setTranslation(pond.x, pond.level - 0.8, pond.z),
  );
  game.physics.world.createCollider(
    game.physics.R.ColliderDesc.cylinder(1.2, pond.radius).setSensor(true),
    wb,
  );
  gfx.initWorld(pond);
  game.physics.warm();
  game.daynight = new DayNight();
  game.workshop = new Workshop(game, new THREE.Vector3(
    game.world.main.workshop.x,
    game.world.heightAt(game.world.main.workshop.x, game.world.main.workshop.z),
    game.world.main.workshop.z,
  ));
  game.flora = new Flora(game);
  game.flora.generate(game.world.main, game.rng);
  game.resources = new Resources(game);
  game.resources.generate(game.world.main, game.rng);
  game.fauna = new Fauna(game);
  game.fauna.generate(game.world.main, game.rng);
  game.enemies = new Enemies(game);
  game.player = new Player(game);
  game.interact = new Interact(game);
  game.survival = new Survival(game);
  game.survival.enabled = true;
  game.machine = new MachineSystem(game);
  game.build = new BuildController(game);
  game.workshop.spawnCrates();
  const spawn = new THREE.Vector3(
    game.world.main.workshop.x + 2.2,
    game.world.heightAt(game.world.main.workshop.x + 2.2, game.world.main.workshop.z + 3.4) + 0.2,
    game.world.main.workshop.z + 3.4,
  );
  game.player.setPosition(spawn.x, spawn.y, spawn.z);
  game.player.lastSafe.copy(spawn);
  game.cam = new GameCamera(camera, game);
  game.dbg = new Dbg(game);
  game.daynight.setTime(0.32);

  // ---- fake input (idle) ----
  const input = {
    axis: { x: 0, y: 0 },
    action: false, actionPressed: false, attackPressed: false,
    jumpPressed: false, buildPressed: false, inventoryPressed: false,
    pausePressed: false, backPressed: false, rotateL: false, rotateR: false,
    keys: Object.create(null),
    beginFrame() {}, endFrame() {},
    consumeLook() { return { x: 0, y: 0 }; },
  };
  game.input = input;

  if (MODE === 'night') game.daynight.setTime(0.92);
  if (MODE === 'drive') {
    const o = game.workshop.pos.clone();
    o.z += 5;
    o.y = game.world.heightAt(o.x, o.z);
    game.machine.spawnCart(o);
    game.machine.launch();
    game.player.hide(true);
    game.state = 'drive';
  }

  // ---- replicate Game.update() !paused branch faithfully ----
  const _amb = { x: 0, y: 7, z: 0 };
  const _ambV = { x: 0, y: 0.15, z: 0 };
  let lastReport = 0;
  let frames = 0;
  let throws = 0;
  const firstThrow = [];

  const report = (label) => {
    const ent = game.physics.sync.entities;
    const dyn = ent.filter((e) => e.body && !e.manualSync);
    const p = game.player.position;
    console.log([
      label,
      `t=${game.time.toFixed(0)}`,
      `state=${game.state}`,
      `bodies=${game.physics.bodyCount()}`,
      `ents=${ent.length}`,
      `dyn=${dyn.length}`,
      `joints=${game.physics.jointCount()}`,
      `props=${game.resources.props.length}`,
      `animals=${game.fauna.animals.length}`,
      `shades=${game.enemies.shades.length}`,
      `plants=${game.flora.plants.length}`,
      `particles=${game.gfx.particles.items.length}`,
      `sceneChildren=${scene.children.length}`,
      `px=${p.x.toFixed(1)} py=${p.y.toFixed(1)} pz=${p.z.toFixed(1)}`,
    ].join(' '));
  };

  report('START');

  const runFrame = (i) => {
    const dt = DT;
    input.beginFrame();
    game.time += dt;
    game.daynight.update(dt);
    game.wind.update(dt);
    game.weather.update(dt);
    game.physics.step(dt, () => {
      if (game.state === 'drive') game.machine.drive(DT, input.axis, input.action);
    });
    if (game.state !== 'drive') {
      game.player.update(dt, input, game.cam);
    } else {
      input.consumeLook();
      game.cam.addLook(0, 0);
      const seat = game.machine.seat();
      if (seat) {
        game.player.position.copy(seat.mesh.position);
      }
      game.progress.driven = game.machine.distance;
      const seatP = game.machine.seat()?.mesh.position;
      if (seatP) {
        game.flora.crushNear(seatP, 1.3);
        if (seatP.y < game.machine.lostY) {
          game.machine.stop();
          game.player.hide(false);
          game.state = 'explore';
        }
      }
    }
    game.interact.update();
    game.flora.update(dt, game.wind.vector, game.player.position);
    game.growth.update(dt, game.flora.plants);
    game.fauna.update(dt);
    game.enemies.update(dt);
    game.workshop.update(dt, game.wind.vector, game.daynight.night);
    game.survival.update(dt);
    game.gfx.water?.update(dt, game.wind.vector, game.daynight.sunDir, camera.position);
    game.gfx.particles?.update(dt, game.wind.vector, game.daynight.night, game.weather.rain);
    if (Math.random() < dt * 0.35) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 20;
      _amb.x = Math.cos(a) * r;
      _amb.y = 7;
      _amb.z = Math.sin(a) * r;
      _ambV.x = game.wind.vector.x * 0.2;
      _ambV.y = 0.15;
      _ambV.z = game.wind.vector.z * 0.2;
      game.gfx.particles?.emit('pollen', _amb, 1, _ambV);
    }
    const focus = game.state === 'drive' && game.machine.seat()
      ? game.machine.seat().mesh.position
      : game.player.position;
    let hint = null;
    if (game.state === 'drive' && game.machine.seat()) {
      hint = new THREE.Vector3(0, 0, 1).applyQuaternion(game.machine.seat().mesh.quaternion);
    }
    game.cam.update(dt, focus, hint);
    game.gfx.sky.update(dt, game.daynight, focus, camera.position);
    game.physics.sync.apply(game.physics.alpha);
    game.ui.update(dt);
    game.dbg.update(dt);
    game.autosaveT += dt;
    if (game.autosaveT > 20) game.autosaveT = 0; // saveNow stubbed
    for (const c of game.placed) {
      if (c.kind === 'campfire' && c.lit && game.gfx.particles && Math.random() < dt * 8) {
        game.gfx.particles.emit('fire', c.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 2);
      }
    }
    game.audio.update(dt, {
      wind: game.wind.strength,
      night: game.daynight.night,
      nearWater: false,
      fire: game.placed.some((p) => p.lit),
      rain: game.weather.rain,
    });
    input.endFrame();
    void i;
  };

  const checks = new Set([5, 10, 20, 30, 60, 90, 120, 180, 240, 300]);
  const t0 = Date.now();
  for (let i = 0; i < SECONDS * 60; i++) {
    const tSec = (i + 1) / 60;
    if (MODE === 'chaos' && tSec % 4 < 0.06) {
      input.axis = { x: (Math.random() - 0.5) * 2, y: Math.random() > 0.5 ? 1 : 0 };
      input.jumpPressed = Math.random() < 0.3;
      input.attackPressed = Math.random() < 0.2;
      input.actionPressed = Math.random() < 0.2;
    } else if (MODE === 'chaos') {
      input.jumpPressed = false;
      input.attackPressed = false;
      input.actionPressed = false;
    }
    try {
      runFrame(i);
      frames += 1;
    } catch (e) {
      throws += 1;
      if (firstThrow.length < 5) firstThrow.push(`t=${tSec.toFixed(2)}s ${e.stack || e}`);
      console.error(`  *** THROW at t=${tSec.toFixed(2)}s: ${e.message}\n${e.stack}`);
      break; // a real RAF loop would die here => freeze
    }
    // NaN check
    const bad = game.physics.sync.entities.filter((e) => {
      if (!e.body) return false;
      const t = e.body.translation();
      return !Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z);
    });
    if (bad.length) {
      console.error(`  *** NaN bodies at t=${tSec.toFixed(2)}s: ${bad.map((e) => e.id).join(',')}`);
      break;
    }
    if (checks.has(Math.round(tSec)) && (i + 1) % 60 === 0) {
      report(`CHECK ${Math.round(tSec)}s`);
    }
    if (i % 600 === 599) {
      // every 10 s also verify the loop is still alive (equivalent of RAF ticking)
      if (game.time < (i + 1) / 60 - 0.1) {
        console.error(`  *** time desync at ${Math.round(tSec)}s`);
        break;
      }
    }
  }
  report('END');
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${frames} frames in ${wall}s wall (${(frames / Number(wall)).toFixed(0)} fps sim)`);
  console.log(`throws: ${throws}`);
  if (firstThrow.length) console.log(firstThrow.join('\n'));
  const ok = throws === 0 && frames === SECONDS * 60;
  console.log(ok ? 'SOAK OK' : 'SOAK FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('harness fatal', e);
  process.exit(2);
});
