export class Needs {
  constructor(game) {
    this.game = game;
    this.acc = 0;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc = 0;
    this.game.survival.update(0);
  }
}
