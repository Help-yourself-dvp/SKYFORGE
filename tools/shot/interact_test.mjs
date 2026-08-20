// Verify: player facing a tree gets chop mode; fall respawn lands on the top.
import * as THREE from 'three';
globalThis.__APP_VERSION__ = '0.1.0';
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
const { ModelLib } = await import('../../src/gfx/model_lib.js');
await initRapier();
const models = new ModelLib();
await models.init();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
scene.fog = new THREE.Fog(0xc5d4c6, 24, 150);
const gfx = { scene, camera, quality: QUALITY.MEDIUM, qualityName: 'MEDIUM',
  renderer: { info: { render: { calls: 0, triangles: 0 } }, setSize(){}, setPixelRatio(){}, render(){}, dispose(){} },
  resize(){}, setQuality(){}, render(){}, dispose(){},
  initWorld(pond){ this.water = new Water(scene, pond); this.particles = new Particles(scene, this.quality.particles); this.sky = new Sky(scene); } };
const game = { gfx, models, state: 'explore', simPaused: false, disposed: false, time: 0, placed: [], progress: {fruit:0,trees:0,driven:0,nightFire:0},
  tools: [], inventory: emptyInventory(), buildStock: emptyBuildStock(), unlocks: {}, hasTorch: false, hasLantern: false, seenHorizon: 0, autosaveT: 0,
  audio: { play(){}, setMotor(){}, update(){}, resume(){}, dispose(){}, activeNodes(){return 0} }, ui: { toast(){}, flash(){}, update(){} },
  toast(){}, saveNow(){}, newWorld(){}, lightsources(){ return []; }, notifyProgress(){}, onTreeFell(){}, pickupResource(){}, respawnFromDeath(){},
  enterVehicle(){}, exitVehicle(){}, machineLost(){} };
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
game.daynight = new DayNight();
game.workshop = new Workshop(game, new THREE.Vector3(game.world.main.workshop.x, game.world.heightAt(game.world.main.workshop.x, game.world.main.workshop.z), game.world.main.workshop.z));
game.flora = new Flora(game); game.flora.generate(game.world.main, game.rng);
game.resources = new Resources(game); game.resources.generate(game.world.main, game.rng);
console.log('trees:', game.resources.trees.length, 'first tree glb?', game.resources.trees[0].mesh.userData.modelName || 'procedural');
game.fauna = new Fauna(game); game.fauna.generate(game.world.main, game.rng);
game.enemies = new Enemies(game);
game.player = new Player(game);
game.interact = new Interact(game);
game.survival = new Survival(game);
game.machine = new MachineSystem(game);
game.build = new BuildController(game);
game.workshop.spawnCrates();
game.input = { keys: Object.create(null) };
game.cam = new GameCamera(camera, game);
game.physics.warm();
game.findSafeSpawn = (base) => {
  const anchor = base || game.player.lastSafe;
  let best = null;
  for (let ring = 0; ring < 6; ring++) {
    const n = ring === 0 ? 1 : 8;
    for (let i = 0; i < n; i++) {
      const a = ring === 0 ? 0 : (i / n) * Math.PI * 2 + ring * 0.35;
      const r = ring * 2.2;
      const x = anchor.x + Math.cos(a) * r;
      const z = anchor.z + Math.sin(a) * r;
      const y = game.world.heightAt(x, z);
      if (!best || y > best.y) best = { x, z, y };
    }
  }
  if (!best || best.y < 2.5) {
    const w = game.workshop.pos;
    return new THREE.Vector3(w.x + 2, game.world.heightAt(w.x + 2, w.z + 2) + 0.4, w.z + 2);
  }
  return new THREE.Vector3(best.x, best.y + 0.5, best.z);
};

// --- test 1: face a tree => chop mode ---
const tree = game.resources.trees[0];
console.log('tree', tree.id, 'at', tree.pos.x.toFixed(1), tree.pos.z.toFixed(1));
// place player 2m south of the tree, facing +Z (toward the tree)
const px = tree.pos.x, pz = tree.pos.z - 2.2;
game.player.setPosition(px, game.world.heightAt(px, pz) + 0.2, pz);
game.player.yaw = 0;
game.player.lastSafe.copy(game.player.position);
game.cam.update(1/60, game.player.position, null);
// debug raw raycast
const dbgFrom = { x: game.player.position.x, y: game.player.position.y + 1.2, z: game.player.position.z };
const dbgHit = game.physics.raycast(dbgFrom, { x: 0, y: -0.14, z: 1 }, 2.6, game.player.body);
console.log('raw raycast:', dbgHit ? 'HIT ' + (dbgHit.ent ? dbgHit.ent.kind + '/' + dbgHit.ent.id : 'collider') + ' toi=' + dbgHit.toi.toFixed(2) : 'MISS');
game.interact.update();
console.log('facing tree => mode =', game.interact.mode, '| prompt =', game.interact.prompt);

// --- test 2: fall respawn lands on top ---
game.player.setPosition(60, -30, 60); // far off the island
game.player.lastSafe.set(60, -30, 60);
game.player.respawnSafe();
const rp = game.player.position;
const rh = game.world.heightAt(rp.x, rp.z);
console.log('respawn at', rp.x.toFixed(1), rp.y.toFixed(1), rp.z.toFixed(1), 'terrain', rh.toFixed(1), rp.y >= rh + 0.2 ? 'ON TOP OK' : 'BAD (below/cliff)');

// --- test 3: fiber plant nearby => fiber mode ---
const fiberPlant = game.flora.plants.find(p => p.fiber);
if (fiberPlant) {
  game.player.setPosition(fiberPlant.pos.x, game.world.heightAt(fiberPlant.pos.x, fiberPlant.pos.z) + 0.2, fiberPlant.pos.z);
  game.player.yaw = 0;
  game.interact.update();
  console.log('near fiber bush => mode =', game.interact.mode, '| prompt =', game.interact.prompt);
}

// --- extra debug: tree collider probing ---
{
  const t = tree;
  game.player.setPosition(t.pos.x, game.world.heightAt(t.pos.x, t.pos.z - 2.2) + 0.2, t.pos.z - 2.2);
  game.player.yaw = 0;
  console.log('tree collider at', t.pos.x, (t.pos.y + t.h * 0.5).toFixed(1), t.pos.z, 'h=', t.h, 'halfH=', (t.h * 0.5));
  const probes = [
    { from: { x: t.pos.x, y: t.pos.y + t.h * 0.5, z: t.pos.z - 3 }, dir: { x: 0, y: 0, z: 1 }, label: 'level ray' },
    { from: { x: t.pos.x, y: t.pos.y + t.h * 0.5, z: t.pos.z }, dir: { x: 0, y: -1, z: 0 }, label: 'down ray' },
  ];
  for (const pr of probes) {
    const h = game.physics.raycast(pr.from, pr.dir, 8, null);
    console.log(pr.label, h ? 'HIT ' + (h.ent ? h.ent.kind + '/' + h.ent.id : '?') + ' toi=' + h.toi.toFixed(2) : 'MISS');
  }
  // also cast every 0.5 m along +Z from the player eye
  const eye = { x: game.player.position.x, y: game.player.position.y + 1.2, z: game.player.position.z };
  for (let zz = 0.5; zz <= 2.6; zz += 0.5) {
    const h = game.physics.raycast(eye, { x: 0, y: 0, z: 1 }, zz, game.player.body);
    console.log('max ' + zz.toFixed(1), h ? 'HIT toi=' + h.toi.toFixed(2) + ' ' + (h.ent ? h.ent.kind : '?') : 'MISS');
  }
}

// --- raw rapier probe: find the tree collider and cast directly ---
{
  let found = 0;
  game.physics.world.colliders.forEach((col) => {
    const ent = game.physics.sync.byCollider.get(col.handle);
    if (ent && ent.kind === 'tree') {
      found++;
      const t = col.parent().translation();
      const hit = game.physics.world.castRay(
        new game.physics.R.Ray({ x: t.x, y: t.y, z: t.z - 4 }, { x: 0, y: 0, z: 1 }),
        10, true,
      );
      console.log('raw rapier: tree collider handle', col.handle, 'at', t.x.toFixed(2), t.y.toFixed(2), t.z.toFixed(2), '=>', hit ? 'HIT' : 'MISS');
    }
  });
  console.log('tree colliders found:', found);
}
