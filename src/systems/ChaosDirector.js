// ChaosDirector (Pass 2A): decides WHICH existing event an ARMED 420 CHAOS meter launches, and tracks the
// event lifecycle. ChaosSystem still owns the meter/ARMED/readable-window; Event420System still owns the effects.
// Plain weighted-random rules, no AI. Selection inputs: tier, traffic density, HEAT, BLAZE, recent history.
window.B420 = window.B420 || {};

B420.ChaosDirector = class ChaosDirector {
  constructor() { this.reset(); }

  reset() {
    this.eventCount = 0;     // events that actually BEGAN this run
    this.history = [];       // recent event types, oldest first
    this.activeType = null;  // the one major event currently running
  }

  // Tier of the Nth event (1-based): EARLY 1-2, MID 3-5, LATE 6+. Based on events reached, never elapsed time.
  tierFor(n) {
    const C = B420.CONFIG;
    return n <= C.CHAOS_TIER_EARLY_MAX ? 'EARLY' : n <= C.CHAOS_TIER_MID_MAX ? 'MID' : 'LATE';
  }
  get tier() { return this.tierFor(this.eventCount + 1); } // tier the NEXT selection uses
  canStart() { return this.activeType === null; }
  setCount(n) { this.eventCount = Math.max(0, Math.floor(n) || 0); }

  // Base weight per tier [EARLY, MID, LATE] for the existing effects only.
  static get BASE() {
    const E = B420.EVENTS;
    return {
      [E.UFO]: [1.2, 1.0, 0.9],
      [E.MUNCHIES]: [1.2, 1.0, 0.6],
      [E.HOT_ROD_SWAP]: [1.0, 1.0, 1.0],
      [E.GREEN_FOG]: [0.7, 1.0, 1.3],
      [E.MOVING_LINES]: [0.4, 1.0, 1.4],
      [E.GRANDMA_CONVOY]: [0.7, 0.9, 0.8],
      [E.COP_PANIC]: [0, 0.9, 1.5],      // not available EARLY
      [E.TRAFFIC_RUSH]: [0, 0.9, 1.5],
      [E.UFO_SWEEP]: [0, 0.9, 1.4],
      [E.X420]: [0.25, 0.3, 0.3],        // rare at every tier
      // Pass 2B-2 late/weird events: mostly MID/LATE, never EARLY
      [E.ROAD_DRUNK]: [0, 0.8, 1.2],
      [E.HOT_ROD_STAMPEDE]: [0, 0.7, 1.3],
      [E.GREENOUT]: [0, 0.6, 1.3],
      [E.COP_UFO]: [0, 0, 1.2],
      [E.MUNCHIES_MAYHEM]: [0, 0, 1.0],
      [E.ROAD_MELTDOWN]: [0, 0, 1.1],
      [E.BLOWN]: [0, 0, 1.0]
    };
  }

  static get PRESSURE() { const E = B420.EVENTS; return [E.GRANDMA_CONVOY, E.COP_PANIC, E.TRAFFIC_RUSH, E.HOT_ROD_STAMPEDE, E.COP_UFO]; }

  // ctx: { vehicles (on-screen count), heatTier, blazeActive }
  weights(ctx) {
    const E = B420.EVENTS, C = B420.CONFIG, base = ChaosDirector.BASE;
    const ti = { EARLY: 0, MID: 1, LATE: 2 }[this.tier];
    const w = {};
    for (const type of Object.keys(base)) w[type] = base[type][ti];
    const n = (ctx && ctx.vehicles) || 0, heat = (ctx && ctx.heatTier) || 1;
    if (n >= C.CHAOS_DENSE_AT) { w[E.UFO] *= 2.2; w[E.MOVING_LINES] *= 0.6; w[E.UFO_SWEEP] *= 2.4; w[E.GRANDMA_CONVOY] *= 0.4; w[E.TRAFFIC_RUSH] *= 0.35; w[E.COP_PANIC] *= 0.7; w[E.COP_UFO] *= 2.0; w[E.HOT_ROD_STAMPEDE] *= 0.4; w[E.ROAD_DRUNK] *= 0.7; w[E.MUNCHIES_MAYHEM] *= 0.7; }           // crowded: thin it out, keep it readable
    else if (n <= C.CHAOS_SPARSE_AT) { w[E.UFO] *= 0.35; w[E.MUNCHIES] *= 1.5; w[E.MOVING_LINES] *= 1.2; w[E.UFO_SWEEP] *= 0.2; w[E.GRANDMA_CONVOY] *= 1.5; w[E.TRAFFIC_RUSH] *= 1.6; w[E.HOT_ROD_STAMPEDE] *= 1.5; w[E.MUNCHIES_MAYHEM] *= 1.3; w[E.COP_UFO] *= 0.5; } // empty: UFO has nothing to take
    if (heat >= 4) { w[E.MOVING_LINES] *= 1.3; w[E.GREEN_FOG] *= 1.3; w[E.UFO] *= 0.9; w[E.COP_PANIC] *= 1.35; w[E.TRAFFIC_RUSH] *= 1.3; w[E.BLOWN] *= 1.3; w[E.ROAD_MELTDOWN] *= 1.3; w[E.HOT_ROD_STAMPEDE] *= 1.3; } // hot: slightly more intense
    else if (heat <= 1) { w[E.MUNCHIES] *= 1.2; w[E.COP_PANIC] *= 0.8; w[E.TRAFFIC_RUSH] *= 0.8; }
    if (ctx && ctx.blazeActive) { w[E.HOT_ROD_SWAP] *= 1.4; w[E.GREEN_FOG] *= 1.3; w[E.MOVING_LINES] *= 0.7; w[E.GREENOUT] *= 1.4; w[E.ROAD_DRUNK] *= 1.4; } // weird/visual fits BLAZE
    const last = this.history[this.history.length - 1], prev = this.history[this.history.length - 2];
    // don't chain traffic-pressure events back to back
    if (this.history.length && ChaosDirector.PRESSURE.includes(this.history[this.history.length - 1])) for (const t of ChaosDirector.PRESSURE) w[t] *= 0.35;
    if (last in w) w[last] = 0;      // never immediately repeat
    if (prev in w) w[prev] *= 0.2;   // and avoid the one before when alternatives exist
    return w;
  }

  // Returns an event type, or null if a major event is already running. Never deadlocks on all-zero weights.
  select(ctx, rng) {
    if (!this.canStart()) return null;
    rng = rng || Math.random;
    const w = this.weights(ctx), types = Object.keys(w);
    const total = types.reduce((s, t) => s + Math.max(0, w[t]), 0);
    if (!(total > 0)) {
      const last = this.history[this.history.length - 1];
      const pool = types.filter((t) => t !== last);
      return (pool.length ? pool : types)[Math.floor(rng() * (pool.length ? pool.length : types.length))];
    }
    let r = rng() * total;
    for (const t of types) { r -= Math.max(0, w[t]); if (r < 0) return t; }
    return types[types.length - 1];
  }

  // The only way an event starts: Director picks -> Event420System runs it -> Director records it.
  // Count/history change only when the event actually began.
  tryStart(type, events) {
    if (!type || !this.canStart() || !events.launch(type)) return false;
    this.onStarted(type);
    return true;
  }

  onStarted(type) {
    if (!this.canStart()) return false;
    this.activeType = type;
    this.eventCount++;
    this.history.push(type);
    if (this.history.length > 4) this.history.shift();
    return true;
  }

  // Event420System reports completion (or replacement/clear) here.
  onEnded(type) { if (type == null || this.activeType === type) this.activeType = null; }
};
