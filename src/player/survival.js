import { SURVIVAL } from '../config.js';

export class Survival {
  constructor(game) {
    this.game = game;
    this.health = SURVIVAL.maxHealth;
    this.hunger = SURVIVAL.maxHunger;
    this.thirst = SURVIVAL.maxThirst;
    this.enabled = true;
    this.acc = 0;
    this.dead = false;
  }

  apply(data) {
    if (!data) return;
    this.health = data.health ?? this.health;
    this.hunger = data.hunger ?? this.hunger;
    this.thirst = data.thirst ?? this.thirst;
  }

  update(dt) {
    if (!this.enabled || this.game.simPaused) return;
    this.acc += dt;
    if (this.acc < 1) return;
    const s = this.acc;
    this.acc = 0;
    this.hunger = Math.max(0, this.hunger - SURVIVAL.hungerPerSec * s);
    this.thirst = Math.max(0, this.thirst - SURVIVAL.thirstPerSec * s);
    const critical = this.hunger < 8 || this.thirst < 8;
    if (critical) this.health = Math.max(0, this.health - SURVIVAL.healthDrainCritical * s);
    else if (this.health < SURVIVAL.maxHealth && !this.game.player.inCombat) {
      this.health = Math.min(SURVIVAL.maxHealth, this.health + SURVIVAL.healthRegen * s);
    }
    if (this.health <= 0 && !this.dead) this.die();
  }

  eatFruit() {
    this.hunger = Math.min(SURVIVAL.maxHunger, this.hunger + SURVIVAL.fruitHunger);
    this.thirst = Math.min(SURVIVAL.maxThirst, this.thirst + SURVIVAL.fruitThirst);
  }

  drink() {
    this.thirst = Math.min(SURVIVAL.maxThirst, this.thirst + SURVIVAL.waterThirst);
  }

  hurt(n) {
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0 && !this.dead) this.die();
  }

  die() {
    this.dead = true;
    this.game.respawnFromDeath();
  }

  revive() {
    this.dead = false;
    this.health = 62;
    this.hunger = Math.max(this.hunger, 40);
    this.thirst = Math.max(this.thirst, 40);
  }
}
