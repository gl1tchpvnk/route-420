// Player hot rod: discrete lane position with a smooth animated transition
// between lanes (never free horizontal sliding).
window.B420 = window.B420 || {};

B420.Player = class Player {
  constructor(renderer) {
    this.renderer = renderer;
    this.lanes = B420.CONFIG.LANES;
    this.lane = Math.floor((this.lanes - 1) / 2);
    this.laneChangeFrom = this.lane;
    this.laneChangeT = 1;
    this.w = 34;
    this.h = 56;
    this.stage = 1;
    this.wobble = 0;
    this.x = renderer.laneX(this.lane);
    this.y = renderer.height * B420.CONFIG.PLAYER_Y_FRACTION;
    this.blazeMult = 1;
  }

  onResize() {
    this.y = this.renderer.height * B420.CONFIG.PLAYER_Y_FRACTION;
    if (this.laneChangeT >= 1) this.x = this.renderer.laneX(this.lane);
  }

  moveLeft() {
    if (this.lane > 0) this._changeLane(this.lane - 1);
  }
  moveRight() {
    if (this.lane < this.lanes - 1) this._changeLane(this.lane + 1);
  }

  _changeLane(newLane) {
    this.laneChangeFrom = this.lane;
    this.lane = newLane;
    this.laneChangeT = 0;
  }

  get isChangingLanes() { return this.laneChangeT < 1; }

  update(dt, blazeActive) {
    const durMs = blazeActive ? B420.CONFIG.BLAZE_LANE_CHANGE_MS : B420.CONFIG.LANE_CHANGE_MS;
    const dur = durMs / 1000;
    if (this.laneChangeT < 1) {
      this.laneChangeT = Math.min(1, this.laneChangeT + dt / dur);
      const t = blazeActive ? B420.Utils.easeOutBack(this.laneChangeT) : B420.Utils.easeOutCubic(this.laneChangeT);
      const fromX = this.renderer.laneX(this.laneChangeFrom);
      const toX = this.renderer.laneX(this.lane);
      this.x = B420.Utils.lerp(fromX, toX, t);
    } else {
      this.x = this.renderer.laneX(this.lane);
    }
    this.wobble += dt;
  }

  setStage(stage) { this.stage = stage; }

  bounds() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  exhaustPoint() {
    return { x: this.x, y: this.y + this.h / 2 - 4 };
  }

  draw(ctx, blazeActive, rotation) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (rotation) ctx.rotate(rotation);
    const color = blazeActive ? B420.COLORS.olive : B420.COLORS.red;
    B420.VehicleArt.drawPlayer(ctx, this, color, B420.COLORS.flame1);
    ctx.restore();
  }
};
