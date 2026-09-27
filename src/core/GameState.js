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
  }

  start() {
    this.reset();
    this.state = B420.STATES.PLAYING;
  }

  pause() { if (this.state === B420.STATES.PLAYING) this.state = B420.STATES.PAUSED; }
  resume() { if (this.state === B420.STATES.PAUSED) this.state = B420.STATES.PLAYING; }
  togglePause() {
    if (this.state === B420.STATES.PLAYING && !this.crashing) this.pause();
    else if (this.state === B420.STATES.PAUSED) this.resume();
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
      escalationStage: this.escalationStage
    };
    this.save = B420.Storage.updateBest(result);
    this.lastResult = result;
  }

  toMenu() { this.state = B420.STATES.MENU; }
  isPlaying() { return this.state === B420.STATES.PLAYING; }
  isRunning() { return this.state === B420.STATES.PLAYING || this.crashing; }
};
