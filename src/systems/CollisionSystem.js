// Real collision (ends the run) + near-miss detection (rewards risk).
// A near miss fires once per vehicle per pass — never repeatedly.
window.B420 = window.B420 || {};

B420.CollisionSystem = class CollisionSystem {
  constructor() {
    this.threadWindow = 0;
    this.threadSides = { left: false, right: false };
  }

  reset() { this.threadWindow = 0; this.threadSides = { left: false, right: false }; }

  checkPlayerCollision(player, vehicles, rival) {
    const pb = player.bounds();
    for (const v of vehicles) {
      if (v.dead || v.abducted) continue;
      if (B420.Utils.aabbOverlap(pb, v.bounds())) return v;
    }
    if (rival && B420.Utils.aabbOverlap(pb, rival.bounds())) return rival;
    return null;
  }

  // Returns an array of near-miss events this frame: {tight, vehicle}
  checkNearMisses(dt, player, vehicles) {
    const events = [];
    const pb = player.bounds();
    let sawLeft = false, sawRight = false;

    for (const v of vehicles) {
      if (v.dead || v.abducted || v.nearMissTriggered) continue;
      const laneDist = v.lane - player.lane;
      if (Math.abs(laneDist) !== 1) continue; // only adjacent-lane passes count

      const vb = v.bounds();
      const overlapping = pb.y < vb.y + vb.h && pb.y + pb.h > vb.y;
      if (!overlapping) continue;

      const centerDist = Math.abs((pb.y + pb.h / 2) - (vb.y + vb.h / 2));
      if (centerDist >= B420.CONFIG.NEAR_MISS_WINDOW_DIST) continue;
      const tight = centerDist < B420.CONFIG.NEAR_MISS_TIGHT_CENTER_DIST;
      v.nearMissTriggered = true;
      events.push({ tight, vehicle: v });
      if (laneDist < 0) sawLeft = true; else sawRight = true;
    }

    if (sawLeft) { this.threadSides.left = true; this.threadWindow = B420.CONFIG.NEAR_MISS_WINDOW; }
    if (sawRight) { this.threadSides.right = true; this.threadWindow = B420.CONFIG.NEAR_MISS_WINDOW; }
    let thread = false;
    if (this.threadWindow > 0) {
      this.threadWindow -= dt;
      if (this.threadSides.left && this.threadSides.right) {
        thread = true;
        this.threadSides.left = false;
        this.threadSides.right = false;
        this.threadWindow = 0;
      } else if (this.threadWindow <= 0) {
        this.threadSides.left = false;
        this.threadSides.right = false;
      }
    }

    return { events, thread };
  }

  checkPickups(player, pickups) {
    const pb = player.bounds();
    const collected = [];
    for (const p of pickups) {
      if (p.collected) continue;
      const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
      if (B420.Utils.aabbOverlap(pb, box)) {
        p.collected = true;
        collected.push(p);
      }
    }
    return collected;
  }

  checkRivalOvertake(player, rival) {
    if (!rival || rival.overtaken === undefined) return false;
    if (rival._counted) return false;
    if (rival.overtaken) { rival._counted = true; return true; }
    return false;
  }
};
