// HEAT is the reckless-driving multiplier. It climbs on near misses and
// drains after a grace period of safe (boring) driving.
window.B420 = window.B420 || {};

B420.HeatSystem = class HeatSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.value = 0;
    this.safeTimer = 0;
    this.tier = 1;
  }

  add(amount) {
    this.value = B420.Utils.clamp(this.value + amount, 0, B420.CONFIG.HEAT_MAX);
    this.safeTimer = 0;
    this._recalcTier();
  }

  update(dt) {
    this.safeTimer += dt;
    if (this.safeTimer > B420.CONFIG.HEAT_SAFE_GRACE && this.value > 0) {
      this.value = Math.max(0, this.value - B420.CONFIG.HEAT_DECAY_RATE * dt);
      this._recalcTier();
    }
  }

  _recalcTier() {
    const tiers = B420.CONFIG.HEAT_TIERS;
    let tier = 1;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (this.value >= tiers[i]) { tier = i + 1; break; }
    }
    this.tier = tier;
  }

  multiplier() { return this.tier; }
};
