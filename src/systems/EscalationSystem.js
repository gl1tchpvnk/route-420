// Watches score and bumps the player's visual stage (1-6). Purely automatic —
// no menus. Actual art lives in VehicleArt; this just tracks thresholds.
window.B420 = window.B420 || {};

B420.EscalationSystem = class EscalationSystem {
  constructor() {
    this.stage = 1;
  }

  reset() { this.stage = 1; }

  // returns a message string when a new stage is reached, else null
  update(score) {
    const thresholds = B420.CONFIG.ESCALATION_THRESHOLDS;
    let newStage = this.stage;
    for (let i = thresholds.length - 1; i >= 1; i--) {
      if (score >= thresholds[i]) { newStage = i; break; }
    }
    if (newStage > this.stage) {
      this.stage = newStage;
      return B420.CONFIG.ESCALATION_MESSAGES[this.stage] || null;
    }
    return null;
  }
};
