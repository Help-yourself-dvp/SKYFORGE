export class Weather {
  constructor(rng) {
    this.rng = rng;
    this.state = 'clear';
    this.next = rng.range(40, 90);
    this.wet = 0;
    this.rain = false;
  }

  set(state) {
    this.state = state;
    this.rain = state === 'drizzle';
  }

  update(dt) {
    this.next -= dt;
    if (this.next <= 0) {
      const r = this.rng.next();
      this.state = r < 0.55 ? 'clear' : r < 0.82 ? 'windy' : 'drizzle';
      this.rain = this.state === 'drizzle';
      this.next = this.rng.range(35, 100);
    }
    const target = this.rain ? 1 : 0;
    this.wet += (target - this.wet) * Math.min(1, dt * 0.25);
  }
}
