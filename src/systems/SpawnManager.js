// Decides WHEN and WHAT to spawn. Guarantees at least one lane near the top
// stays clear so a wall across all lanes can never be created.
window.B420 = window.B420 || {};

B420.SpawnManager = class SpawnManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.reset();
  }

  // Fresh spawn timing for a new run: traffic, BLAZE pickup and FUEL timers.
  reset() {
    this.spawnTimer = B420.CONFIG.SPAWN_INTERVAL_START;
    this.pickupTimer = B420.Utils.randRange(B420.CONFIG.PICKUP_INTERVAL_MIN, B420.CONFIG.PICKUP_INTERVAL_MAX);
    this.resetFuelTimer();
  }

  difficultyT(elapsed) {
    return B420.Utils.clamp(elapsed / B420.CONFIG.SPAWN_RAMP_SECONDS, 0, 1);
  }

  spawnInterval(elapsed) {
    if (elapsed < B420.CONFIG.FORGIVING_SECONDS) return B420.CONFIG.SPAWN_INTERVAL_START * 1.3;
    const t = this.difficultyT(elapsed);
    return B420.Utils.lerp(B420.CONFIG.SPAWN_INTERVAL_START, B420.CONFIG.SPAWN_INTERVAL_MIN, t);
  }

  pickType(elapsed) {
    const t = this.difficultyT(elapsed);
    const entries = Object.keys(B420.TYPE_CONFIG).map((type) => {
      const c = B420.TYPE_CONFIG[type];
      return { value: type, weight: B420.Utils.lerp(c.weightBase, c.weightLate, t) };
    });
    return B420.Utils.weightedChoice(entries);
  }

  occupiedLanesNearTop(vehicles) {
    const occ = new Set();
    for (const v of vehicles) {
      if (!v.dead && v.y < B420.CONFIG.DANGER_ZONE_Y) occ.add(v.lane);
    }
    return occ;
  }

  chooseSafeLane(vehicles, pickups) {
    const occ = this.occupiedLanesNearTop(vehicles);
    // a jerry can still near the top reserves its lane, so traffic never spawns right on top of it
    for (const p of pickups || []) if (p.kind === 'fuel' && !p.collected && p.y < 170) occ.add(p.lane);
    const free = [];
    for (let i = 0; i < B420.CONFIG.LANES; i++) if (!occ.has(i)) free.push(i);
    if (free.length === 0) return null; // no safe lane right now — skip this spawn
    if (free.length === 1) return free[0];
    return B420.Utils.choice(free);
  }

  resetFuelTimer() {
    this.fuelTimer = B420.Utils.randRange(B420.CONFIG.FUEL_SPAWN_MIN, B420.CONFIG.FUEL_SPAWN_MAX);
  }

  // Jerry can lane: only lanes with no traffic near the top and no other pickup just spawned,
  // so a can is never dropped into traffic. Taking it (and the extra speed) stays the player's choice.
  chooseFuelLane(vehicles, pickups, avoidLane) {
    const free = [];
    for (let l = 0; l < B420.CONFIG.LANES; l++) {
      if (l === avoidLane) continue; // a car spawning this very tick
      const busy = vehicles.some(v => !v.dead && (v.lane === l || (v.laneT < 1 && v.laneFrom === l)) && v.y < 260)
        || pickups.some(p => p.lane === l && p.y < 140);
      if (!busy) free.push(l);
    }
    return free.length ? B420.Utils.choice(free) : null;
  }

  update(dt, elapsed, vehicles, pickups) {
    const result = { spawnType: null, spawnLane: null, spawnPickup: false, pickupLane: null, spawnFuel: false, fuelLane: null };

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval(elapsed);
      const lane = this.chooseSafeLane(vehicles, pickups);
      if (lane !== null) {
        let type = this.pickType(elapsed);
        if (type === 'cop' && elapsed < 30) type = 'sedan'; // cops don't show up immediately
        result.spawnType = type;
        result.spawnLane = lane;
      }
    }

    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = B420.Utils.randRange(B420.CONFIG.PICKUP_INTERVAL_MIN, B420.CONFIG.PICKUP_INTERVAL_MAX);
      result.spawnPickup = true;
      result.pickupLane = B420.Utils.randInt(0, B420.CONFIG.LANES - 1);
    }

    if (this.fuelTimer === undefined) this.resetFuelTimer();
    this.fuelTimer -= dt;
    if (this.fuelTimer <= 0 && elapsed >= B420.CONFIG.FUEL_MIN_ELAPSED) {
      const lane = this.chooseFuelLane(vehicles, pickups || [], result.spawnLane);
      if (lane !== null) { result.spawnFuel = true; result.fuelLane = lane; this.resetFuelTimer(); }
      else this.fuelTimer = 1.2;
    }

    return result;
  }
};
