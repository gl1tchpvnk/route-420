// Simple capped particle pool — exhaust smoke, sparks, impact bits
window.B420 = window.B420 || {};

B420.ParticleSystem = class ParticleSystem {
  constructor(max) {
    this.max = max || 180;
    this.particles = [];
  }

  spawnSmoke(x, y, color, count) {
    for (let i = 0; i < (count || 1); i++) {
      this._add({
        x: x + B420.Utils.randRange(-3, 3), y: y + B420.Utils.randRange(-2, 2),
        vx: B420.Utils.randRange(-8, 8), vy: B420.Utils.randRange(20, 55),
        life: B420.Utils.randRange(0.4, 0.8), age: 0,
        size: B420.Utils.randRange(3, 6), color: color || B420.COLORS.smoke, kind: 'smoke'
      });
    }
  }

  spawnSpark(x, y, count) {
    for (let i = 0; i < (count || 8); i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = B420.Utils.randRange(60, 220);
      this._add({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: B420.Utils.randRange(0.25, 0.55), age: 0,
        size: B420.Utils.randRange(1.5, 3), color: Math.random() > 0.5 ? B420.COLORS.flame1 : B420.COLORS.chrome, kind: 'spark'
      });
    }
  }

  spawnPop(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this._add({
        x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 20,
        life: 0.35, age: 0, size: 2.5, color, kind: 'spark'
      });
    }
  }

  _add(p) {
    if (this.particles.length >= this.max) this.particles.shift();
    this.particles.push(p);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') { p.vx *= 0.9; p.vy *= 0.9; }
      if (p.kind === 'smoke') { p.size += dt * 6; }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t) * (p.kind === 'smoke' ? 0.45 : 0.9);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.particles.length = 0; }
};
