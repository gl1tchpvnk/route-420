// Holds the live traffic/pickup/rival entities and advances them each frame.
// Spawn *decisions* come from SpawnManager; this class just instantiates and
// updates/culls what SpawnManager asks for.
window.B420 = window.B420 || {};

B420.TrafficManager = class TrafficManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.spawner = new B420.SpawnManager(renderer);
    this.vehicles = [];
    this.pickups = [];
    this.rival = null;
    this.rivalCooldown = B420.CONFIG.RIVAL_MIN_SURVIVAL;
    this.rivalActive = false;
    this.hotRodSkinActive = false;
  }

  reset() {
    this.vehicles = [];
    this.pickups = [];
    this.rival = null;
    this.rivalCooldown = B420.CONFIG.RIVAL_MIN_SURVIVAL;
    this.rivalActive = false;
    this.hotRodSkinActive = false;
    this.spawner.spawnTimer = B420.CONFIG.SPAWN_INTERVAL_START;
  }

  currentScrollSpeed(elapsed) {
    const t = B420.Utils.clamp(elapsed / B420.CONFIG.SPEED_RAMP_SECONDS, 0, 1);
    return B420.Utils.lerp(B420.CONFIG.BASE_SCROLL_SPEED, B420.CONFIG.MAX_SCROLL_SPEED, t);
  }

  update(dt, elapsed, player, opts) {
    opts = opts || {};
    const scrollSpeed = this.currentScrollSpeed(elapsed) * (opts.speedMult != null ? opts.speedMult : 1);

    const plan = this.spawner.update(dt, elapsed, this.vehicles);
    if (plan.spawnType) {
      const type = opts.forceType || plan.spawnType;
      const nv = new B420.Vehicle(type, plan.spawnLane, this.renderer, -60);
      if (this.hotRodSkinActive) nv.skinOverride = 'hotrod';
      this.vehicles.push(nv);
    }
    if (plan.spawnPickup && !opts.suppressBlazePickup) {
      this.pickups.push({
        kind: 'blaze', lane: plan.pickupLane,
        x: this.renderer.laneX(plan.pickupLane), y: -30, w: 22, h: 22, collected: false
      });
    }

    for (const v of this.vehicles) v.update(dt, scrollSpeed, player);
    this.vehicles = this.vehicles.filter(v => !v.dead && !v.abducted && v.y < this.renderer.height + 80);

    for (const p of this.pickups) {
      p.y += scrollSpeed * dt;
      p.x = this.renderer.laneX(p.lane);
    }
    this.pickups = this.pickups.filter(p => !p.collected && p.y < this.renderer.height + 60);

    if (this.rival) {
      this.rival.update(dt, scrollSpeed, player);
      if (this.rival.dead) { this.rival = null; this.rivalActive = false; this.rivalCooldown = B420.CONFIG.RIVAL_COOLDOWN; }
    } else if (!this.rivalActive) {
      this.rivalCooldown -= dt;
      if (this.rivalCooldown <= 0 && elapsed >= B420.CONFIG.RIVAL_MIN_SURVIVAL) {
        const lane = B420.Utils.clamp(player.lane + (Math.random() > 0.5 ? 1 : -1), 0, B420.CONFIG.LANES - 1);
        this.rival = new B420.Rival(this.renderer, lane, player.y - 70);
        this.rivalActive = true;
      }
    }

    return { scrollSpeed };
  }

  spawnMunchie(lane) {
    this.pickups.push({
      kind: 'munchie', lane, x: this.renderer.laneX(lane), y: -30, w: 22, h: 22,
      collected: false, emoji: B420.Utils.choice(B420.FOOD_EMOJI)
    });
  }

  setHotRodSkin(active) {
    this.hotRodSkinActive = active;
    for (const v of this.vehicles) v.skinOverride = active ? 'hotrod' : null;
  }

  draw(ctx, t) {
    for (const p of this.pickups) {
      if (p.collected) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === 'blaze') {
        const pulse = 1 + Math.sin(t * 6) * 0.08;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(180,220,120,0.35)';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = B420.COLORS.blazeGreenBright;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.bezierCurveTo(7, -3, 6, 5, 0, 10);
        ctx.bezierCurveTo(-6, 5, -7, -3, 0, -9);
        ctx.fill();
        ctx.fillStyle = B420.COLORS.blazeGreen;
        ctx.beginPath(); ctx.ellipse(0, 3, 2.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 2);
      }
      ctx.restore();
    }

    for (const v of this.vehicles) v.draw(ctx, t);
    if (this.rival) this.rival.draw(ctx, t);
  }
};
