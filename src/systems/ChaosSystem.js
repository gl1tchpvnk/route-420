// 420 CHAOS (Pass 1): player-driven meter. Reckless play fills it, it never decays, and at 100 it
// becomes ARMED; an armed meter launches ONE event, but only when the road is readable.
// Plain rule-based logic: no timers owned here except a short "stay readable" hold.
window.B420 = window.B420 || {};

B420.ChaosSystem = class ChaosSystem {
  constructor() { this.reset(); }

  reset() { this.value = 0; this.armed = false; this.safeTime = 0; }

  get chaosValue() { return this.value; }
  get chaosArmed() { return this.armed; }
  get chaosPercent() { return Math.floor(this.value); } // meter is 0-100, so value == percent

  heatMultiplier(tier) {
    return 1 + B420.CONFIG.CHAOS_HEAT_STEP * (B420.Utils.clamp(Math.floor(tier) || 1, 1, 5) - 1);
  }

  // Action-generated CHAOS = base x HEAT multiplier x (BLAZE active ? 1.25 : 1). Nothing else multiplies it.
  actionMultiplier(heatTier, blazeActive) {
    return this.heatMultiplier(heatTier) * (blazeActive ? B420.CONFIG.CHAOS_BLAZE_MULT : 1);
  }

  award(base, heatTier, blazeActive) {
    const amount = Math.round(base * this.actionMultiplier(heatTier, blazeActive) * 10) / 10;
    this.add(amount);
    return amount;
  }

  add(n) {
    if (this.armed || !(n > 0)) return;
    this.value = B420.Utils.clamp(this.value + n, 0, 100);
    if (this.value >= 100) this.arm();
  }

  arm() { this.value = 100; this.armed = true; }

  debugSet(n) { this.armed = false; this.value = B420.Utils.clamp(n, 0, 100); if (this.value >= 100) this.arm(); }

  // Tiny passive trickle so the meter never feels frozen. No decay, ever. Only while actively playing.
  update(dt, playing) {
    if (!playing || !(dt > 0)) return;
    this.add(B420.CONFIG.CHAOS_PASSIVE_RATE * dt);
  }

  // Road readability around the player, reusing the shared traffic-safety helper (escape corridor).
  assessRoad(vehicles, player, horizon) {
    const L = B420.CONFIG.LANES;
    const options = [player.lane - 1, player.lane, player.lane + 1].filter((l) => l >= 0 && l < L);
    const boxedIn = !options.some((l) => B420._playerLaneClear(vehicles, player, l, horizon));
    let danger = false;
    for (const v of vehicles) {
      if (v.dead || v.abducted) continue;
      const inLane = v.lane === player.lane || (v.laneT < 1 && v.laneFrom === player.lane);
      if (inLane && v.y > player.y - B420.CONFIG.CHAOS_DANGER_AHEAD && v.y < player.y + 30) { danger = true; break; }
    }
    return { boxedIn, danger };
  }

  // ctx: { playing, boxedIn, danger, eventBusy }
  canLaunch(ctx) {
    return this.armed && !!ctx.playing && !ctx.boxedIn && !ctx.danger && !ctx.eventBusy;
  }

  // Call once per frame. Returns true when the armed event should launch now (after a short readable hold).
  step(dt, ctx) {
    if (!this.canLaunch(ctx)) { this.safeTime = 0; return false; }
    this.safeTime += dt;
    return this.safeTime >= B420.CONFIG.CHAOS_SAFE_HOLD;
  }

  onLaunched() { this.reset(); }
};
