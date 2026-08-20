import * as THREE from 'three';
import { HIT, PLAYER } from '../config.js';

const _dir = new THREE.Vector3();
const _from = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _fromP = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1.2, 0);

export class Interact {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.prompt = '';
    this.mode = 'none';
  }

  update() {
    const g = this.game;
    if (g.state === 'drive' || g.state === 'pause' || g.state === 'title') {
      this.target = null;
      this.prompt = '';
      this.mode = 'none';
      return;
    }
    const origin = g.cam.camera.position;
    const dir = g.cam.camera.getWorldDirection(_camDir);
    const fromPlayer = _fromP.copy(g.player.position).add(_up);
    let hit = g.physics.raycast(
      { x: fromPlayer.x, y: fromPlayer.y, z: fromPlayer.z },
      { x: dir.x, y: dir.y, z: dir.z },
      HIT.reach,
      g.player.body,
    );
    if (!hit) {
      hit = g.physics.raycast(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: dir.x, y: dir.y, z: dir.z },
        7,
        g.player.body,
      );
      if (hit && hit.toi > 6) hit = null;
    }
    this.target = hit;
    this.mode = 'none';
    this.prompt = '';

    if (g.player.carry) {
      this.prompt = g.player.charging ? 'Бросить' : 'Положить';
      this.mode = 'carry';
      return;
    }

    const pond = g.world.main.pond;
    const p = g.player.position;
    if (Math.hypot(p.x - pond.x, p.z - pond.z) < pond.radius - 0.6 && p.y < pond.level + 1.4) {
      this.prompt = 'Пить';
      this.mode = 'drink';
    }

    const camp = this._nearCampfire();
    if (camp && !camp.lit) {
      this.prompt = 'Разжечь';
      this.mode = 'fire';
      this.target = { ent: camp };
    }

    if (hit && hit.ent) {
      const e = hit.ent;
      const kind = e.kind || e.mesh?.userData.kind;
      if (e.part && g.machine.launched && e.part.def?.seat) {
        this.prompt = 'Сесть';
        this.mode = 'seat';
      } else if (kind === 'tree' && e.tree && !e.tree.fallen) {
        this.prompt = 'Срубить';
        this.mode = 'chop';
      } else if (kind === 'rock' || kind === 'ore') {
        this.prompt = 'Ударить';
        this.mode = 'mine';
      } else if (e.grabbable && (e.mass || 1) <= PLAYER.carryMass) {
        this.prompt = kind === 'fruit' ? 'Взять' : 'Взять';
        this.mode = 'grab';
      } else if (kind === 'plant' && e.mesh?.userData.fiber) {
        this.prompt = 'Собрать';
        this.mode = 'fiber';
      }
    }

    if (g.state === 'build') {
      this.prompt = this.game.build.validPlace ? 'Поставить' : 'Сборка';
      this.mode = 'build';
    }
  }

  _nearCampfire() {
    return this.game.placed?.find((p) => p.kind === 'campfire' && p.mesh.position.distanceTo(this.game.player.position) < 2.2) || null;
  }

  primaryDown() {
    const g = this.game;
    if (g.state === 'build') {
      g.build.place();
      return;
    }
    if (this.mode === 'deposit' && g.player.carry) {
      const res = g.player.carry.resource || g.player.carry.mesh?.userData.resource;
      g.resources.collectProp(g.player.carry);
      g.player.carry = null;
      if (g.state === 'grab') g.setState('explore');
      if (res) g.pickupResource(res);
      g.audio.play('drop');
      g.toast('Мастерская приняла материал.');
      return;
    }
    if (this.mode === 'carry') {
      g.player.charging = true;
      return;
    }
    if (this.mode === 'grab' && this.target?.ent) {
      g.player.grab(this.target.ent);
      g.setState('grab');
      return;
    }
    if (this.mode === 'drink') {
      g.survival.drink();
      g.inventory.water = (g.inventory.water || 0) + 1;
      g.audio.play('ui');
      g.toast('Вода холодная и чистая.');
      return;
    }
    if (this.mode === 'fire' && this.target?.ent) {
      this.target.ent.lit = true;
      g.audio.play('fire');
      g.toast('Огонь принял дыхание.');
      return;
    }
    if (this.mode === 'seat' && this.target?.ent?.part) {
      g.enterVehicle();
      return;
    }
    if (this.mode === 'chop' && this.target?.ent?.tree) {
      this._hit('wood', this.target.ent.tree);
      return;
    }
    if (this.mode === 'mine' && this.target?.ent?.rock) {
      this._hit('stone', this.target.ent.rock);
      return;
    }
    if (this.playerHasTarget()) this._hit('wood', null);
  }

  primaryUp() {
    const g = this.game;
    if (g.player.carry && g.player.charging) {
      if (g.player.throwCharge > 0.18) g.player.throw(g.cam);
      else g.player.drop();
      if (g.state === 'grab') g.setState('explore');
    }
  }

  attack() {
    const g = this.game;
    if (g.player.hitCd > 0) return;
    if (this.mode === 'chop' && this.target?.ent?.tree) this._hit('wood', this.target.ent.tree);
    else if (this.mode === 'mine' && this.target?.ent?.rock) this._hit('stone', this.target.ent.rock);
    else if (this.target?.ent?.tree) this._hit('wood', this.target.ent.tree);
    else if (this.target?.ent?.rock) this._hit('stone', this.target.ent.rock);
  }

  _hit(kind, rec) {
    const g = this.game;
    if (g.player.hitCd > 0) return;
    g.player.hitCd = HIT.cooldown;
    g.cam.shake(0.06);
    const tools = g.tools || [];
    if (kind === 'wood' && rec) {
      const dmg = tools.includes('axe') ? HIT.woodDamageAxe : HIT.woodDamage;
      const fell = g.resources.hitTree(rec, dmg);
      if (fell) g.onTreeFell();
    } else if (kind === 'stone' && rec) {
      const dmg = tools.includes('hammer') ? HIT.stoneDamageHammer : HIT.stoneDamage;
      g.resources.hitRock(rec, dmg);
    }
  }

  playerHasTarget() {
    return !!(this.target && this.target.ent);
  }
}
