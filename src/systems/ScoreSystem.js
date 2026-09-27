// Continuous score accrual (scaled by HEAT and BLAZE) plus one-off bonuses.
window.B420 = window.B420 || {};

B420.ScoreSystem = class ScoreSystem {
  constructor() {
    this.score = 0;
  }

  reset() { this.score = 0; }

  tick(dt, heatMult, blazeMult) {
    this.score += B420.CONFIG.SCORE_BASE_RATE * heatMult * blazeMult * dt;
  }

  addBonus(amount) { this.score += amount; }

  get value() { return Math.floor(this.score); }
};
