// Procedural SFX via WebAudio. No external audio files — safe hooks with real
// (but simple) synthesized blips, per the "no terrible fake audio" rule.
window.B420 = window.B420 || {};

B420.AudioManager = class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.engineOsc = null;
    this.engineGain = null;
    this._unlocked = false;
  }

  unlock() {
    if (this._unlocked) return;
    this._unlocked = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { this.enabled = false; return; }
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.32 : 0;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.32 : 0;
    return this.enabled;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol != null ? vol : 0.4, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  later(fn, ms) { setTimeout(() => { if (this.enabled) fn(); }, ms); }

  laneChange() { this.tone(320, 0.06, 'square', 0.22, 260); }
  nearMiss(tight) { this.tone(tight ? 720 : 520, 0.09, 'sawtooth', 0.28, tight ? 980 : 640); }
  pickup() { this.tone(660, 0.05, 'square', 0.28, 990); this.later(() => this.tone(880, 0.08, 'square', 0.22), 55); }
  heatUp() { this.tone(200, 0.12, 'sawtooth', 0.26, 340); }
  blazeActivate() { [0, 60, 120].forEach((d, i) => this.later(() => this.tone(260 + i * 140, 0.14, 'square', 0.28), d)); }
  collision() { this.tone(90, 0.42, 'sawtooth', 0.5, 38); }
  eventTrigger() { [0, 90, 180].forEach((d, i) => this.later(() => this.tone(440 + i * 220, 0.16, 'triangle', 0.28), d)); }
  ufoBeam() { this.tone(880, 0.5, 'sine', 0.18, 220); }
  munchiePickup() { this.tone(500, 0.07, 'triangle', 0.25, 760); }
  results() { [0, 120, 240].forEach((d, i) => this.later(() => this.tone(330 + i * 110, 0.2, 'square', 0.24), d)); }
  uiTap() { this.tone(420, 0.04, 'square', 0.2); }

  startEngine() {
    if (!this.ctx || this.engineOsc || !this.enabled) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain.gain.value = 0.045;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  updateEngine(speedFactor) {
    if (!this.engineOsc) return;
    const f = 52 + B420.Utils.clamp(speedFactor, 0, 1) * 65;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.09);
  }

  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
    this.engineOsc.disconnect();
    this.engineGain.disconnect();
    this.engineOsc = null;
    this.engineGain = null;
  }
};
