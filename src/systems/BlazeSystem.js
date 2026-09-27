// BLAZE meter fills from pickups. Full meter lets the player pop BLAZE MODE:
// an 8s window that's advantageous but not free — traffic slows, but lane
// changes get floatier and the screen gets subtly psychedelic.
window.B420 = window.B420 || {};

B420.BlazeSystem = class BlazeSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.meter = 0;
    this.active = false;
    this.timer = 0;
    this.echoTimer = 0;
  }

  fill(amount) {
    if (this.active) return;
    this.meter = B420.Utils.clamp(this.meter + amount, 0, B420.CONFIG.BLAZE_MAX);
  }

  get ready() { return this.meter >= B420.CONFIG.BLAZE_MAX && !this.active; }

  activate() {
    if (!this.ready) return false;
    this.active = true;
    this.timer = B420.CONFIG.BLAZE_DURATION;
    this.meter = 0;
    return true;
  }

  update(dt) {
    if (!this.active) return;
    this.timer -= dt;
    this.echoTimer -= dt;
    if (this.timer <= 0) {
      this.active = false;
      this.timer = 0;
    }
  }

  shouldSpawnEcho() {
    if (!this.active) return false;
    if (this.echoTimer <= 0) { this.echoTimer = B420.CONFIG.BLAZE_ECHO_INTERVAL; return true; }
    return false;
  }

  trafficSpeedMult() { return this.active ? (1 - B420.CONFIG.BLAZE_TRAFFIC_SLOW) : 1; }
  scoreMult() { return this.active ? B420.CONFIG.BLAZE_SCORE_MULT : 1; }
  progressFraction() { return this.meter / B420.CONFIG.BLAZE_MAX; }
};
