// Existing event effects (green fog, hot-rod swap, UFO, munchies, moving lines). Events no longer fire on a
// fixed clock: 420 CHAOS (ChaosSystem) decides WHEN, ChaosDirector decides WHICH; this class just runs the effect
// and reports completion through onEnd.
window.B420 = window.B420 || {};

B420.Event420System = class Event420System {
  static get UFO_OPTS() {
    const E = B420.EVENTS;
    return {
      [E.UFO]: {},
      [E.UFO_SWEEP]: { beamDur: 0.35, cooldown: [0.4, 0.7], maxTargets: 5, speed: 85, yMax: 0.62, firstCooldown: 0.5 },
      [E.COP_UFO]: { beamDur: 0.5, cooldown: [1.2, 2.0], maxTargets: 3, speed: 45, yMax: 0.6, firstCooldown: 1.0 }
    };
  }

  constructor(trafficManager, renderer, audio) {
    this.trafficManager = trafficManager;
    this.renderer = renderer;
    this.audio = audio;
    this.registry = [
      { type: B420.EVENTS.GREEN_FOG, name: 'GREEN FOG', duration: 18 },
      { type: B420.EVENTS.HOT_ROD_SWAP, name: "EVERYBODY'S A HOT ROD", duration: 15 },
      { type: B420.EVENTS.UFO, name: 'U.F.O.', duration: 18 },
      { type: B420.EVENTS.MUNCHIES, name: 'MUNCHIES RUN', duration: 15 },
      { type: B420.EVENTS.MOVING_LINES, name: 'MOVING LINES', duration: 12 },
      // Pass 2B-1: traffic-pressure / scoring events. ambient:false = no slowdown haze; banner = text after the 420 flash.
      { type: B420.EVENTS.GRANDMA_CONVOY, name: 'GRANDMA CONVOY', duration: 7, banner: 'GRANDMA CONVOY', ambient: false },
      { type: B420.EVENTS.COP_PANIC, name: 'COP PANIC', duration: 7, banner: 'COP PANIC', ambient: false },
      { type: B420.EVENTS.TRAFFIC_RUSH, name: 'TRAFFIC RUSH', duration: 6, banner: 'TRAFFIC RUSH', ambient: false },
      { type: B420.EVENTS.UFO_SWEEP, name: 'UFO SWEEP', duration: 5, banner: 'UFO SWEEP', ambient: false },
      { type: B420.EVENTS.X420, name: 'x4.20', duration: 6, banner: 'x4.20', ambient: false },
      // Pass 2B-2: late/weird events. Visual ones are derived from level() every frame, so they cannot leak.
      { type: B420.EVENTS.ROAD_DRUNK, name: 'ROAD DRUNK', duration: 5, banner: 'ROAD DRUNK', ambient: false },
      { type: B420.EVENTS.HOT_ROD_STAMPEDE, name: 'HOT ROD STAMPEDE', duration: 7, banner: 'HOT ROD STAMPEDE', ambient: false },
      { type: B420.EVENTS.GREENOUT, name: 'GREENOUT', duration: 8, banner: 'GREENOUT' },
      { type: B420.EVENTS.COP_UFO, name: 'COP + UFO', duration: 8, banner: 'COP + UFO', ambient: false },
      { type: B420.EVENTS.MUNCHIES_MAYHEM, name: 'MUNCHIES MAYHEM', duration: 8, banner: 'MUNCHIES MAYHEM' },
      { type: B420.EVENTS.ROAD_MELTDOWN, name: 'ROAD MELTDOWN', duration: 7, banner: 'ROAD MELTDOWN', ambient: false },
      { type: B420.EVENTS.BLOWN, name: 'BLOWN', duration: 6, banner: 'BLOWN', ambient: false }
    ];
    this.reset();
  }

  reset() {
    this.active = null; // {type, name, duration, timer, ...eventState}
    this.announcePhase = 0; // ms remaining showing "4:20" / name banner
    this.announceStep = 0; // 0 = "4:20" big, 1 = event name
    this.ufo = null;
    this.munchieTimer = 0;
    this.survivedCount = 0;
    this.pendingSurvivedCredit = false;
    this.trafficManager.setHotRodSkin(false); // no transformed traffic carried into a new run
    this.trafficManager.clearEventMods();      // ...and no leftover spawn/cop pressure
  }

  // x4.20 window: the one scoring multiplier events can apply (collisions stay fully active).
  scoreMult() { return this.active && this.active.type === B420.EVENTS.X420 ? B420.CONFIG.X420_MULT : 1; }
  bannerText() { return (this.active && this.active.banner) || "WHOA... IT'S SLOWING DOWN"; }
  ambientOn() { return !!this.active && this.announcePhase <= 0 && this.active.ambient !== false; }

  // MAYHEM: more snacks, but only into lanes with no traffic near the top and never more than 6 on the road.
  _spawnMayhemMunchie(vehicles) {
    const lanes = [];
    for (let l = 0; l < B420.CONFIG.LANES; l++) if (!vehicles.some((v) => !v.dead && v.lane === l && v.y < 220)) lanes.push(l);
    const n = this.trafficManager.pickups.filter((p) => p.kind === 'munchie').length;
    if (lanes.length && n < 6) this.trafficManager.spawnMunchie(B420.Utils.choice(lanes));
  }

  // 0..1 presence of a running event (0.5s fade in/out). Visual effects are derived from this each frame, so they
  // disappear the moment the event ends, is cleared, or the run resets: there is no persistent flag to leak.
  level(type) {
    const a = this.active;
    if (!a || a.type !== type) return 0;
    return B420.Utils.clamp(Math.min((a.duration - a.timer) / 0.5, a.timer / 0.5), 0, 1);
  }

  isBusy() { return !!this.active || this.announcePhase > 0; }

  // Start a registered event by type. Returns false (and starts nothing) for an unknown type.
  launch(type) {
    const def = this.registry.find(e => e.type === type);
    if (!def) return false;
    this._begin(def);
    return true;
  }

  // Debug / reset helper: stop the running event cleanly (and report it ended).
  clear() { this._endActive(); this.announcePhase = 0; }

  _begin(def) {
    this._endActive();
    this.active = { ...def, timer: def.duration };
    this.announceStep = 0;
    this.announcePhase = B420.CONFIG.EVENT_FLASH_MS;
    this.audio && this.audio.eventTrigger();
    if (def.type === B420.EVENTS.HOT_ROD_SWAP) this.trafficManager.setHotRodSkin(true);
    this.trafficManager.setEventMods(def.type);
    const ufoOpts = Event420System.UFO_OPTS[def.type];
    if (ufoOpts) this.ufo = new B420.UFO(this.renderer, ufoOpts); // UFO, UFO SWEEP and COP + UFO all reuse the one UFO class
    if (def.type === B420.EVENTS.MUNCHIES || def.type === B420.EVENTS.MUNCHIES_MAYHEM) this.munchieTimer = 0.4;
    this.pendingSurvivedCredit = true;
  }

  _endActive() {
    if (!this.active) return;
    if (this.active.type === B420.EVENTS.HOT_ROD_SWAP) this.trafficManager.setHotRodSkin(false);
    this.ufo = null;
    this.trafficManager.clearEventMods();
    const type = this.active.type;
    this.active = null;
    if (this.onEnd) this.onEnd(type); // tell the Director the major event is over
  }

  update(dt, elapsed, player, vehicles) {
    if (this.announcePhase > 0) {
      this.announcePhase -= dt * 1000;
      if (this.announcePhase <= 0 && this.announceStep === 0) {
        this.announceStep = 1;
        this.announcePhase = B420.CONFIG.EVENT_FLASH_MS;
      }
    }

    if (!this.active) return;
    this.active.timer -= dt;

    if (this.ufo) {
      const hadTarget = !!this.ufo.beamTarget;
      this.ufo.update(dt, vehicles);
      if (!hadTarget && this.ufo.beamTarget) this.audio && this.audio.ufoBeam();
    }
    const E = B420.EVENTS, mm = this.active.type === E.MUNCHIES ? [0.7, 1.1] : this.active.type === E.MUNCHIES_MAYHEM ? [0.45, 0.7] : null;
    if (mm) {
      this.munchieTimer -= dt;
      if (this.munchieTimer <= 0) {
        this.munchieTimer = B420.Utils.randRange(mm[0], mm[1]);
        if (this.active.type === E.MUNCHIES) this.trafficManager.spawnMunchie(B420.Utils.randInt(0, B420.CONFIG.LANES - 1));
        else this._spawnMayhemMunchie(vehicles);
      }
    }

    if (this.active.timer <= 0) {
      if (this.pendingSurvivedCredit) { this.survivedCount++; this.pendingSurvivedCredit = false; }
      this._endActive();
    }
  }

  isMovingLinesActive() { return !!this.active && this.active.type === B420.EVENTS.MOVING_LINES; }
  isGreenFogActive() { return !!this.active && this.active.type === B420.EVENTS.GREEN_FOG; }
  greenFogStrength() {
    if (!this.isGreenFogActive()) return 0;
    const t = this.active.timer / this.active.duration;
    return Math.min(1, (1 - Math.abs(t - 0.5) * 1.4) * 1.3 + 0.15);
  }

  drawOverlay(ctx) {
    if (this.active && this.ufo) {
      this.ufo.draw(ctx, this.renderer.time);
    }
  }
};
