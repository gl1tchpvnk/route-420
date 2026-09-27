// Decides WHEN and WHAT to spawn. Guarantees at least one lane near the top
// stays clear so a wall across all lanes can never be created.
window.B420 = window.B420 || {};

B420.SpawnManager = class SpawnManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.spawnTimer = B420.CONFIG.SPAWN_INTERVAL_START;
    this.pickupTimer = B420.Utils.randRange(B420.CONFIG.PICKUP_INTERVAL_MIN, B420.CONFIG.PICKUP_INTERVAL_MAX);
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

  chooseSafeLane(vehicles) {
    const occ = this.occupiedLanesNearTop(vehicles);
    const free = [];
    for (let i = 0; i < B420.CONFIG.LANES; i++) if (!occ.has(i)) free.push(i);
    if (free.length === 0) return null; // no safe lane right now — skip this spawn
    if (free.length === 1) return free[0];
    return B420.Utils.choice(free);
  }

  update(dt, elapsed, vehicles) {
    const result = { spawnType: null, spawnLane: null, spawnPickup: false, pickupLane: null };

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval(elapsed);
      const lane = this.chooseSafeLane(vehicles);
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

    return result;
  }
};
