// State machine + per-run stats
window.B420 = window.B420 || {};

B420.GameState = class GameState {
  constructor() {
    this.state = B420.STATES.MENU;
    this.save = B420.Storage.load();
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.score = 0;
    this.nearMisses = 0;
    this.tightMisses = 0;
    this.blazeModesUsed = 0;
    this.events420Survived = 0;
    this.maxHeatTier = 1;
    this.escalationStage = 1;
    this.rivalsSmoked = 0;
    this.crashPhaseTimer = 0;
    this.crashing = false;
    this.lastResult = null;
    this.hi = this.save.bestScore;   // live HI (single source: ScoreSystem score vs stored best)
    this.hiAtStart = this.hi;
    this._hiDirty = false;
    this._hiSavedAt = 0;
  }

  start() {
    this.save = B420.Storage.load();
    this.reset();
    this.state = B420.STATES.PLAYING;
  }

  pause() { if (this.state === B420.STATES.PLAYING) this.state = B420.STATES.PAUSED; }
  resume() { if (this.state === B420.STATES.PAUSED) this.state = B420.STATES.PLAYING; }
  togglePause() {
    if (this.state === B420.STATES.PLAYING && !this.crashing) this.pause();
    else if (this.state === B420.STATES.PAUSED) this.resume();
  }

  // Live high score: follows SCORE immediately, persisted right away (throttled ~5/s, flushed on exit).
  syncHi() {
    const s = Math.floor(this.score);
    if (s > this.hi) { this.hi = s; this._hiDirty = true; }
  }
  flushHi(force) {
    if (!this._hiDirty) return;
    const now = performance.now();
    if (!force && now - this._hiSavedAt < 200) return;
    this._hiSavedAt = now;
    this._hiDirty = false;
    this.save.bestScore = B420.Storage.setHi(this.hi);
  }

  beginCrash() {
    if (this.crashing) return;
    this.crashing = true;
    this.crashPhaseTimer = 0.6;
  }

  finishCrash() {
    this.crashing = false;
    this.state = B420.STATES.GAME_OVER;
    const result = {
      score: Math.floor(this.score),
      time: this.elapsed,
      maxHeatTier: this.maxHeatTier,
      nearMisses: this.nearMisses,
      blazeModesUsed: this.blazeModesUsed,
      events420Survived: this.events420Survived,
      escalationStage: this.escalationStage,
      newRecord: Math.floor(this.score) > this.hiAtStart && Math.floor(this.score) > 0
    };
    this.save = B420.Storage.updateBest(result);
    this.hi = Math.max(this.hi, this.save.bestScore);
    this.lastResult = result;
  }

  toMenu() { this.crashing = false; this.state = B420.STATES.MENU; }

  // Leave a run in progress (HOME button): keep any new best, then go to the menu.
  abandon() {
    this.crashing = false;
    this.save = B420.Storage.updateBest({ score: Math.floor(this.score), time: this.elapsed, maxHeatTier: this.maxHeatTier });
    this.state = B420.STATES.MENU;
  }
  isPlaying() { return this.state === B420.STATES.PLAYING; }
  isRunning() { return this.state === B420.STATES.PLAYING || this.crashing; }
};
