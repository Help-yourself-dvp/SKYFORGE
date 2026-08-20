// Reusable headless drive trace: spawns the cart, launches, drives with a
// given throttle/steer, prints per-part Y and velocity every N frames.
import * as THREE from 'three';
globalThis.__APP_VERSION__ = '0.1.0';

const THROTTLE = Number(process.argv[2] ?? 1);
const STEER = Number(process.argv[3] ?? 0);
const SECONDS = Number(process.argv[4] ?? 6);

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
  const { emptyInventory } = await import('../../src/craft/resources.js');
  const { emptyBuildStock } = await import('../../src/build/inventory.js');
  await initRapier();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
  scene.fog = new THREE.Fog(0xc5d4c6, 24, 150);
  const gfx = {
    scene, camera, quality: QUALITY.MEDIUM, qualityName: 'MEDIUM',
    renderer: { info: { render: { calls: 0, triangles: 0 } }, setSize() {}, setPixelRatio() {}, render() {}, dispose() {} },
    resize() {}, setQuality() {}, render() {}, dispose() {},
    initWorld(pond) { this.water = new Water(scene, pond); this.particles = new Particles(scene, this.quality.particles); this.sky = new Sky(scene); },
  };
  const game = {
    gfx, state: 'drive', simPaused: false, disposed: false, time: 0, placed: [],
    progress: { fruit: 0, trees: 0, driven: 0, nightFire: 0 },
    tools: [], inventory: emptyInventory(), buildStock: emptyBuildStock(), unlocks: {},
    hasTorch: false, hasLantern: false, seenHorizon: 0, autosaveT: 0,
    audio: { play() {}, setMotor() {}, update() {}, resume() {}, dispose() {}, activeNodes() { return 0; } },
    ui: { toast() {}, flash() {}, update() {} },
    toast() {}, saveNow() {}, newWorld() {}, lightsources() { return []; }, notifyProgress() {}, onTreeFell() {}, pickupResource() {},
    respawnFromDeath() {},
    enterVehicle() { this.player.hide(true); this.state = 'drive'; },
    exitVehicle() { this.player.hide(false); this.state = 'explore'; },
    machineLost() { this.machine.stop(); this.exitVehicle(); },
  };
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
  const pond = game.world.main.pond;
  const wb = game.physics.world.createRigidBody(game.physics.R.RigidBodyDesc.fixed().setTranslation(pond.x, pond.level - 0.8, pond.z));
  game.physics.world.createCollider(game.physics.R.ColliderDesc.cylinder(1.2, pond.radius).setSensor(true), wb);
  gfx.initWorld(pond);
  game.physics.warm();
  game.daynight = new DayNight();
  game.workshop = new Workshop(game, new THREE.Vector3(game.world.main.workshop.x, game.world.heightAt(game.world.main.workshop.x, game.world.main.workshop.z), game.world.main.workshop.z));
  game.flora = new Flora(game); game.flora.generate(game.world.main, game.rng);
  game.resources = new Resources(game); game.resources.generate(game.world.main, game.rng);
  game.fauna = new Fauna(game); game.fauna.generate(game.world.main, game.rng);
  game.enemies = new Enemies(game);
  game.player = new Player(game);
  game.interact = new Interact(game);
  game.survival = new Survival(game);
  game.machine = new MachineSystem(game);
  game.build = new BuildController(game);
  game.workshop.spawnCrates();
  const spawn = new THREE.Vector3(game.world.main.workshop.x + 2.2, game.world.heightAt(game.world.main.workshop.x + 2.2, game.world.main.workshop.z + 3.4) + 0.2, game.world.main.workshop.z + 3.4);
  game.player.setPosition(spawn.x, spawn.y, spawn.z);
  game.player.lastSafe.copy(spawn);
  game.cam = new GameCamera(camera, game);
  game.daynight.setTime(0.32);
  const o = game.workshop.pos.clone();
  o.z += 5; o.y = game.world.heightAt(o.x, o.z);
  game.machine.spawnCart(o);
  game.machine.launch();
  const input = {
    axis: { x: STEER, y: THROTTLE }, action: false, actionPressed: false, attackPressed: false,
    jumpPressed: false, buildPressed: false, inventoryPressed: false, pausePressed: false, backPressed: false,
    rotateL: false, rotateR: false, keys: Object.create(null), beginFrame() {}, endFrame() {},
    consumeLook() { return { x: 0, y: 0 }; },
  };
  let lost = false;
  for (let i = 0; i < SECONDS * 60; i++) {
    game.time += 1 / 60;
    game.physics.step(1 / 60, () => {
      if (game.state === 'drive') game.machine.drive(1 / 60, input.axis, input.action);
    });
    if (game.state === 'drive') {
      const seat = game.machine.seat();
      if (seat) {
        game.player.position.copy(seat.mesh.position);
        const sp = seat.mesh.position;
        if (sp.y < game.machine.lostY) { game.machineLost(); lost = true; }
      }
    }
    if (i % 15 === 0) {
      const seat = game.machine.seat();
      const st = seat ? seat.body.translation() : null;
      if (st) {
        // probe what supports the machine: ray down from the seat
        const probe = game.physics.world.castRay(
          new game.physics.R.Ray({ x: st.x, y: st.y + 3, z: st.z }, { x: 0, y: -1, z: 0 }),
          20, true,
        );
        let under = 'none';
        if (probe) {
          const ent = game.physics.sync.byCollider.get(probe.collider.handle);
          under = (ent ? ent.kind : 'collider') + '@' + (st.y + 3 - probe.timeOfImpact).toFixed(1);
        }
        console.log(`  UNDER: ${under} (ground visual ${game.world.heightAt(st.x, st.z).toFixed(1)})`);
      }
      const sv = seat ? seat.body.linvel() : null;
      const ps = game.machine.parts.map((p) => `${p.type[0]}${p.body.translation().y.toFixed(1)}`).join(' ');
      const r = seat ? seat.body.rotation() : null;
      const q = r ? new THREE.Quaternion(r.x, r.y, r.z, r.w) : null;
      const e = q ? new THREE.Euler().setFromQuaternion(q, 'YXZ') : null;
      const pch = e ? (e.x * 180 / Math.PI).toFixed(0) : '-';
      const wav = game.machine.parts.filter((q) => q.type === 'WHEEL').map((q) => q.body.angvel().x.toFixed(1)).join(',');
      const yw = e ? (e.y * 180 / Math.PI).toFixed(0) : '-';
      console.log(
        `t=${game.time.toFixed(2)} seat y=${st ? st.y.toFixed(2) : '-'} x=${st ? st.x.toFixed(1) : '-'} z=${st ? st.z.toFixed(1) : '-'} ` +
        `pitch=${pch} yaw=${yw} vy=${sv ? sv.y.toFixed(2) : '-'} wheelSpin=[${wav}] [${ps}]`,
      );
    }
    game.flora.update(1 / 60, game.wind.vector, game.player.position);
    game.physics.sync.apply(game.physics.alpha);
    if (lost) break;
  }
  console.log(`FINAL state=${game.state} distance=${game.machine.distance.toFixed(1)} lost=${lost}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
