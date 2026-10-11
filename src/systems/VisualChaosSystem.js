// VisualChaosSystem (Pass 2C): tiny shared state for the standalone VISUAL CHAOS events.
// It only turns "which event is running, how far through, how eased in/out" into six bounded numbers the Renderer
// can draw. It knows nothing about the player, traffic, collisions, lanes or speed: these effects lie to the
// player's eyes, never to the game engine. Profiles are EVENT-SPECIFIC: any event without a profile is neutral,
// so MUNCHIES / UFO / COP PANIC etc. can never inherit distortion.
window.B420 = window.B420 || {};

(function () {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  B420.VisualChaosSystem = class VisualChaosSystem {
    // roadWave/perspectiveBreath/horizonDrift/ghost/speedSmear: 0..1.  cameraLean: -1..1 (x 5 degrees).
    static get KEYS() { return ['roadWave', 'perspectiveBreath', 'horizonDrift', 'cameraLean', 'ghost', 'speedSmear']; }
    static neutral() { return { roadWave: 0, perspectiveBreath: 0, horizonDrift: 0, cameraLean: 0, ghost: 0, speedSmear: 0 }; }

    // p = progress through the event 0..1, l = eased presence 0..1 (0.5s fade in/out)
    static get PROFILES() {
      const E = B420.EVENTS;
      return {
        [E.MELTING_POINT]: (p, l) => ({ roadWave: 0.8 * l, perspectiveBreath: 0.5 * l }),
        [E.DOUBLE_VISION]: (p, l) => ({ ghost: 0.9 * l }),
        [E.BAD_TRIP]: (p, l) => { // mild start, builds to a peak at 70%, then eases back
          const i = p < 0.7 ? 0.3 + 0.7 * (p / 0.7) : 1 - ((p - 0.7) / 0.3) * 0.5;
          return { roadWave: 0.9 * i * l, perspectiveBreath: 0.7 * i * l, horizonDrift: 0.7 * i * l, ghost: 0.6 * i * l };
        },
        [E.SIDEWAYS]: (p, l) => ({ cameraLean: Math.sin(p * Math.PI * 2) * l }), // one way, through level, the other way, home
        [E.WARP_SPEED]: (p, l) => ({ speedSmear: l }),
        [E.ROAD_IS_FINE]: (p, l) => ({ // deadpan escalation: wave first, then breath, then drift, then ghost
          roadWave: 0.8 * smooth(p / 0.9) * l,
          perspectiveBreath: 0.6 * smooth((p - 0.25) / 0.65) * l,
          horizonDrift: 0.7 * smooth((p - 0.45) / 0.5) * l,
          ghost: 0.5 * smooth((p - 0.6) / 0.4) * l
        })
      };
    }

    constructor() { this.reset(); }
    reset() { this.v = VisualChaosSystem.neutral(); this.motion = 1; }
    isNeutral() { return VisualChaosSystem.KEYS.every((k) => this.v[k] === 0); }

    // calm = prefers-reduced-motion: same event, much gentler (smaller amplitude, slower oscillation)
    update(events, calm) {
      const a = events.active, f = a && VisualChaosSystem.PROFILES[a.type];
      if (!f) { this.reset(); return; }
      const raw = f(clamp01((a.duration - a.timer) / a.duration), events.level(a.type)), k = calm ? 0.35 : 1;
      const v = VisualChaosSystem.neutral();
      for (const key of VisualChaosSystem.KEYS) v[key] = Math.max(key === 'cameraLean' ? -1 : 0, Math.min(1, (raw[key] || 0) * k));
      this.v = v;
      this.motion = calm ? 0.5 : 1;
    }
  };
})();
