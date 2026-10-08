// Existing event effects (green fog, hot-rod swap, UFO, munchies, moving lines). Events no longer fire on a
// fixed clock: 420 CHAOS (ChaosSystem) decides when to launch one. Pass 1 launches the UFO event only.
window.B420 = window.B420 || {};

B420.Event420System = class Event420System {
  constructor(trafficManager, renderer, audio) {
    this.trafficManager = trafficManager;
    this.renderer = renderer;
    this.audio = audio;
    this.registry = [
      { type: B420.EVENTS.GREEN_FOG, name: 'GREEN FOG', duration: 18 },
      { type: B420.EVENTS.HOT_ROD_SWAP, name: "EVERYBODY'S A HOT ROD", duration: 15 },
      { type: B420.EVENTS.UFO, name: 'U.F.O.', duration: 18 },
      { type: B420.EVENTS.MUNCHIES, name: 'MUNCHIES RUN', duration: 15 },
      { type: B420.EVENTS.MOVING_LINES, name: 'MOVING LINES', duration: 12 }
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
  }

  isBusy() { return !!this.active || this.announcePhase > 0; }

  // Pass 1: one existing event only (UFO).
  launchChaosEvent() { this.forceTrigger(B420.EVENTS.UFO); }

  forceTrigger(type) {
    const def = this.registry.find(e => e.type === type) || B420.Utils.choice(this.registry);
    this._begin(def);
  }

  _begin(def) {
    this._endActive();
    this.active = { ...def, timer: def.duration };
    this.announceStep = 0;
    this.announcePhase = B420.CONFIG.EVENT_FLASH_MS;
    this.audio && this.audio.eventTrigger();
    if (def.type === B420.EVENTS.HOT_ROD_SWAP) this.trafficManager.setHotRodSkin(true);
    if (def.type === B420.EVENTS.UFO) this.ufo = new B420.UFO(this.renderer);
    if (def.type === B420.EVENTS.MUNCHIES) this.munchieTimer = 0.4;
    this.pendingSurvivedCredit = true;
  }

  _endActive() {
    if (!this.active) return;
    if (this.active.type === B420.EVENTS.HOT_ROD_SWAP) this.trafficManager.setHotRodSkin(false);
    if (this.active.type === B420.EVENTS.UFO) this.ufo = null;
    this.active = null;
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

    if (this.active.type === B420.EVENTS.UFO && this.ufo) {
      const hadTarget = !!this.ufo.beamTarget;
      this.ufo.update(dt, vehicles);
      if (!hadTarget && this.ufo.beamTarget) this.audio && this.audio.ufoBeam();
    }
    if (this.active.type === B420.EVENTS.MUNCHIES) {
      this.munchieTimer -= dt;
      if (this.munchieTimer <= 0) {
        this.munchieTimer = B420.Utils.randRange(0.7, 1.1);
        this.trafficManager.spawnMunchie(B420.Utils.randInt(0, B420.CONFIG.LANES - 1));
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
    if (this.active && this.active.type === B420.EVENTS.UFO && this.ufo) {
      this.ufo.draw(ctx, this.renderer.time);
    }
  }
};
