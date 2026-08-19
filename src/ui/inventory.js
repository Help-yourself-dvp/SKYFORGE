import { RESOURCE_KEYS } from '../craft/resources.js';

export class InventoryView {
  constructor(game) {
    this.game = game;
  }

  counts() {
    const o = {};
    for (const k of RESOURCE_KEYS) o[k] = this.game.inventory[k] || 0;
    return o;
  }
}
