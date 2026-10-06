// FUEL (jerry can) boost: one bounded speed modifier + x1.5 scoring for a few seconds.
// Kept standalone so a later system can read fuelActive / fuelMultiplier / fuelRemaining.
window.B420 = window.B420 || {};

B420.FuelSystem = class FuelSystem {
  constructor() { this.reset(); }

  reset() { this.remaining = 0; this.level = 0; }

  get fuelActive() { return this.remaining > 0; }
  get fuelRemaining() { return this.remaining; }
  // Eased, bounded: 1 .. 1 + FUEL_SPEED_BOOST. Never multiplied per can.
  get fuelMultiplier() { return 1 + B420.CONFIG.FUEL_SPEED_BOOST * this.level; }

  collect() {
    const C = B420.CONFIG;
    this.remaining = this.remaining > 0
      ? Math.min(C.FUEL_MAX_DURATION, this.remaining + C.FUEL_EXTEND) // already active: +1s, capped
      : C.FUEL_DURATION;
  }

  update(dt) {
    const C = B420.CONFIG;
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining > 0) this.level = Math.min(1, this.level + dt / C.FUEL_RAMP_UP);
    else this.level = Math.max(0, this.level - dt / C.FUEL_RAMP_DOWN); // smooth return to normal speed
  }

  speedMult() { return this.fuelMultiplier; }
  scoreMult() { return this.remaining > 0 ? B420.CONFIG.FUEL_SCORE_MULT : 1; }
};
