// Continuous score accrual (scaled by HEAT and BLAZE) plus one-off bonuses.
window.B420 = window.B420 || {};

B420.ScoreSystem = class ScoreSystem {
  constructor() {
    this.score = 0;
    this.eventMult = 1; // x4.20 window (CHAOS event); 1 otherwise
  }

  reset() { this.score = 0; this.eventMult = 1; }

  tick(dt, heatMult, blazeMult) {
    this.score += B420.CONFIG.SCORE_BASE_RATE * heatMult * blazeMult * this.eventMult * dt;
  }

  // raw=true skips the event multiplier (used for the flat CHAOS SURVIVED reward)
  addBonus(amount, raw) { this.score += raw ? amount : amount * this.eventMult; }

  get value() { return Math.floor(this.score); }
};
