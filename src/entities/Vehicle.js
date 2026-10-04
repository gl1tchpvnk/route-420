// Traffic vehicle with per-type behaviour, plus the Rival hot rod and UFO.
// Vehicles now share a generic lane-change (targetLane/laneFrom/laneT +
// telegraphT) so real avoidance and cop's "move toward player" both use one
// safety-checked pathway instead of separate ad-hoc systems.
window.B420 = window.B420 || {};

let _vehicleId = 1;

// Nearest vehicle to `self` sharing `lane` (settled OR mid-transition through
// it), ahead (forward=true) or behind. A mid-transition vehicle counts as
// occupying both its origin and destination lane, which is what makes lane
// changes respect "someone's already moving into that space" for free.
B420._trafficNeighbor = function (vehicles, self, lane, forward) {
  let best = null, bestD = Infinity;
  for (const v of vehicles) {
    if (v === self || v.dead || v.abducted) continue;
    const occupies = v.lane === lane || (v.laneT < 1 && v.laneFrom === lane);
    if (!occupies) continue;
    const d = forward ? v.y - self.y : self.y - v.y;
    if (d > 0 && d < bestD) { bestD = d; best = v; }
  }
  return best ? { v: best, gap: bestD - (self.h + best.h) / 2 } : null;
};

// Player fairness (escape-corridor rule): is  free near the player right
// now? Used to stop a traffic lane change from taking the player's last open
// option. Deliberately simple/local, not predictive.
B420._playerLaneClear = function (vehicles, player, lane, horizon) {
  if (lane < 0 || lane >= B420.CONFIG.LANES) return false;
  for (const v of vehicles) {
    if (v.dead || v.abducted) continue;
    if (v.lane !== lane && !(v.laneT < 1 && v.laneFrom === lane)) continue;
    if (v.y > player.y - horizon && v.y < player.y + 40) return false;
  }
  return true;
};

B420.Vehicle = class Vehicle {
  constructor(type, lane, renderer, y) {
    this.id = _vehicleId++;
    this.type = type;
    this.cfg = B420.TYPE_CONFIG[type] || B420.TYPE_CONFIG.sedan;
    this.renderer = renderer;
    this.lane = lane;
    this.targetLane = lane;
    this.laneFrom = lane;
    this.laneT = 1;
    this.telegraphT = 0;
    this.laneChangeCooldown = B420.Utils.randRange(0, 1.5);
    this.brakeMult = 1;
    this.w = this.cfg.w;
    this.h = this.cfg.h;
    this.wanderOffset = 0;
    this.wanderPhase = 'idle'; // idle | out | hold | back
    this.wanderTimer = B420.Utils.randRange(1.4, 3.2);
    this.burstT = 0;
    this.burstCooldown = 0;
    this.copState = this.type === 'cop' ? 'idle' : null;
    this.copTimer = B420.Utils.randRange(0.6, 1.3);
    this.nearMissTriggered = false;
    this.tiltAngle = 0;
    this.y = y;
    this._laneX = renderer.laneX(lane);
    this.x = this._laneX;
    this.abducted = false;
    this.dead = false;
    this.skinOverride = null; // used by "Everybody's a Hot Rod" event
  }

  bounds() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(dt, scrollSpeed, player, vehicles) {
    let factor = this.cfg.speedFactor;

    if (this.type === 'muscle') {
      this.burstCooldown = Math.max(0, this.burstCooldown - dt);
      if (this.burstT > 0) {
        this.burstT = Math.max(0, this.burstT - dt);
        factor += this.cfg.burst;
      } else if (this.burstCooldown <= 0) {
        const laneDist = Math.abs(this.lane - player.lane);
        const gap = Math.abs(this.y - player.y);
        if (laneDist <= 1 && gap < 90) { this.burstT = 1.1; this.burstCooldown = 2.5; }
      }
    }

    // --- avoidance: brake for whatever is ahead in-lane, swerve around it if blocked ---
    this.laneChangeCooldown = Math.max(0, this.laneChangeCooldown - dt);
    const settled = this.laneT >= 1 && this.telegraphT <= 0;
    const ahead = B420._trafficNeighbor(vehicles, this, this.lane, true);
    const FG = B420.CONFIG.TRAFFIC_FOLLOW_GAP, BG = B420.CONFIG.TRAFFIC_BRAKE_GAP;
    if (ahead && ahead.gap < BG) {
      this.brakeMult = Math.max(0.42, this.brakeMult - dt * 4); // emergency brake: immediate, not eased, but never looks stuck
    } else {
      const target = !ahead || ahead.gap >= FG ? 1 : B420.Utils.clamp(ahead.gap / FG, 0.48, 1);
      this.brakeMult = B420.Utils.lerp(this.brakeMult, target, Math.min(1, dt * 5));
    }

    const reactionDist = B420.CONFIG.REACTION_BASE + scrollSpeed * B420.CONFIG.REACTION_TIME;
    const copWantsMove = this.type === 'cop' && this.copState === 'idle'
      && this.y > 0 && this.y < this.renderer.height * 0.55 && (this.copTimer -= dt) <= 0;
    if (settled && (copWantsMove || (ahead && ahead.gap < FG && this.laneChangeCooldown <= 0))) {
      const tries = copWantsMove
        ? [B420.Utils.clamp(this.lane + (player.lane > this.lane ? 1 : player.lane < this.lane ? -1 : 0), 0, B420.CONFIG.LANES - 1)]
        : [this.lane - 1, this.lane + 1];
      let chosen = null, best = -1;
      for (const l of tries) {
        if (l < 0 || l >= B420.CONFIG.LANES || l === this.lane) continue;
        const a = B420._trafficNeighbor(vehicles, this, l, true);
        const b = B420._trafficNeighbor(vehicles, this, l, false);
        const spaceAhead = a ? a.gap : Infinity, spaceBehind = b ? b.gap : Infinity;
        if (spaceAhead < B420.CONFIG.TRAFFIC_CHECK_AHEAD || spaceBehind < B420.CONFIG.TRAFFIC_CHECK_BEHIND || spaceAhead <= best) continue;
        // Escape-corridor rule: near the player, never take what would be their last open lane.
        if (Math.abs(this.y - player.y) < reactionDist) {
          const opts = [player.lane - 1, player.lane, player.lane + 1].filter(o => o >= 0 && o < B420.CONFIG.LANES && o !== l);
          if (!opts.some(o => B420._playerLaneClear(vehicles, player, o, reactionDist))) continue;
        }
        chosen = l; best = spaceAhead;
      }
      if (copWantsMove) this.copState = 'done'; // one attempt only, whether or not a gap was found
      if (chosen != null) { this.telegraphT = B420.CONFIG.TRAFFIC_TELEGRAPH_S; this.targetLane = chosen; this.laneChangeCooldown = B420.CONFIG.TRAFFIC_LANE_COOLDOWN; }
    }

    if (this.telegraphT > 0) {
      this.telegraphT = Math.max(0, this.telegraphT - dt);
      this.tiltAngle = Math.sin(this.renderer.time * 20) * 0.04;
      if (this.telegraphT <= 0) { this.laneFrom = this.lane; this.lane = this.targetLane; this.laneT = 0; }
    } else if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / B420.CONFIG.TRAFFIC_LANECHANGE_S);
      const fromX = this.renderer.laneX(this.laneFrom), toX = this.renderer.laneX(this.lane);
      this._laneX = B420.Utils.lerp(fromX, toX, B420.Utils.easeOutCubic(this.laneT));
      this.tiltAngle = (1 - this.laneT) * 0.05 * (toX > fromX ? 1 : -1);
      if (this.laneT >= 1) this.tiltAngle = 0;
    } else {
      this._laneX = this.renderer.laneX(this.lane);
    }

    // --- pickup's personality wander, gated so it never swerves into another car ---
    if (this.type === 'pickup') {
      this.wanderTimer -= dt;
      const laneW = this.renderer.laneWidth();
      if (this.wanderPhase === 'idle' && this.wanderTimer <= 0) {
        const dir = (this.lane <= 0) ? 1 : (this.lane >= B420.CONFIG.LANES - 1 ? -1 : (Math.random() > 0.5 ? 1 : -1));
        const n = B420._trafficNeighbor(vehicles, this, this.lane + dir, true);
        if (!n || n.gap >= B420.CONFIG.TRAFFIC_CHECK_AHEAD) { this.wanderPhase = 'out'; this.wanderTimer = 0.85; this._wanderDir = dir; }
        else this.wanderTimer = 0.6;
      } else if (this.wanderPhase === 'out') {
        const t = 1 - Math.max(0, this.wanderTimer) / 0.85;
        this.wanderOffset = B420.Utils.easeOutCubic(t) * laneW * 0.42 * this._wanderDir;
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) { this.wanderPhase = 'hold'; this.wanderTimer = 0.4; }
      } else if (this.wanderPhase === 'hold') {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) { this.wanderPhase = 'back'; this.wanderTimer = 0.85; }
      } else if (this.wanderPhase === 'back') {
        const t = 1 - Math.max(0, this.wanderTimer) / 0.85;
        this.wanderOffset = (1 - B420.Utils.easeOutCubic(t)) * laneW * 0.42 * this._wanderDir;
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) { this.wanderPhase = 'idle'; this.wanderOffset = 0; this.wanderTimer = B420.Utils.randRange(2, 4); }
      }
    }

    this.y += scrollSpeed * factor * this.brakeMult * dt;
    this.x = this._laneX + this.wanderOffset;
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.tiltAngle) ctx.rotate(this.tiltAngle);
    if (this.telegraphT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.renderer.time * 20) * 0.3;
      ctx.strokeStyle = B420.COLORS.burntOrange;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.w * 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (this.skinOverride === 'hotrod') {
      B420.VehicleArt.drawPlayer(ctx, { stage: 1 + (this.id % 3), wobble: t }, this._skinColor || B420.COLORS.burntOrange, B420.COLORS.flame1);
    } else {
      B420.VehicleArt.drawTraffic(ctx, this, t);
    }
    ctx.restore();
  }
};

B420.Rival = class Rival {
  constructor(renderer, lane, y) {
    this.type = 'rival';
    this.renderer = renderer;
    this.lane = lane;
    this.w = 34; this.h = 56;
    this.y = y;
    this.x = renderer.laneX(lane);
    this.age = 0;
    this.duration = B420.CONFIG.RIVAL_DURATION;
    this.changeTimer = B420.Utils.randRange(1.2, 2.2);
    this.laneChangeFrom = lane;
    this.laneChangeT = 1;
    this.overtaken = false;
    this._counted = false;
    this.dead = false;
    this.wobble = 0;
  }

  bounds() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  update(dt, scrollSpeed, player) {
    this.age += dt;
    this.wobble += dt;
    // rival roughly tracks a point just ahead of the player, racing alongside
    const targetY = player.y - 70;
    this.y = B420.Utils.lerp(this.y, targetY, dt * 1.6);

    this.changeTimer -= dt;
    if (this.changeTimer <= 0 && this.laneChangeT >= 1) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      const next = B420.Utils.clamp(this.lane + dir, 0, B420.CONFIG.LANES - 1);
      if (next !== this.lane) {
        this.laneChangeFrom = this.lane;
        this.lane = next;
        this.laneChangeT = 0;
      }
      this.changeTimer = B420.Utils.randRange(1.4, 2.6);
    }
    if (this.laneChangeT < 1) {
      this.laneChangeT = Math.min(1, this.laneChangeT + dt / 0.22);
      const fromX = this.renderer.laneX(this.laneChangeFrom);
      const toX = this.renderer.laneX(this.lane);
      this.x = B420.Utils.lerp(fromX, toX, B420.Utils.easeOutCubic(this.laneChangeT));
    } else {
      this.x = this.renderer.laneX(this.lane);
    }

    if (!this.overtaken && this.y > player.y + player.h * 0.6) this.overtaken = true;
    if (this.age > this.duration) this.dead = true;
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    B420.VehicleArt.drawRival(ctx, t, 3);
    ctx.restore();
  }
};

B420.UFO = class UFO {
  constructor(renderer) {
    this.renderer = renderer;
    this.x = renderer.width * 0.5;
    this.y = 46;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.beamTarget = null;
    this.beamTimer = 0;
    this.cooldown = 1.4;
    this.age = 0;
  }

  update(dt, vehicles) {
    this.age += dt;
    this.x += this.dir * 22 * dt;
    if (this.x < this.renderer.width * 0.18 || this.x > this.renderer.width * 0.82) this.dir *= -1;

    if (this.beamTarget) {
      this.beamTimer -= dt;
      if (this.beamTimer <= 0) {
        this.beamTarget.abducted = true;
        this.beamTarget = null;
        this.cooldown = B420.Utils.randRange(3.5, 5.5);
      }
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const candidates = vehicles.filter(v => !v.dead && !v.abducted && v.y > 90 && v.y < this.renderer.height * 0.55);
      if (candidates.length) {
        this.beamTarget = B420.Utils.choice(candidates);
        this.beamTimer = 0.6;
      } else {
        this.cooldown = 0.8;
      }
    }
  }

  draw(ctx, t) {
    if (this.beamTarget) {
      B420.VehicleArt.drawBeam(ctx, this.x, this.y + 8, this.beamTarget.x, this.beamTarget.y, t);
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    B420.VehicleArt.drawUFO(ctx, t);
    ctx.restore();
  }
};
