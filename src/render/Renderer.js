// Owns the canvas. Draws the road, orchestrates every entity's draw call in
// back-to-front order, and layers 4:20 event visual effects on top.
window.B420 = window.B420 || {};

B420.Renderer = class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dashOffset = 0;
    this.shake = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const maxH = vh * 0.95;
    const maxW = Math.min(vw - 16, 760);
    let cssH = maxH;
    let cssW = Math.min(maxW, cssH * 0.64);
    cssW = B420.Utils.clamp(cssW, 280, 760);
    cssH = B420.Utils.clamp(cssH, 420, maxH);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = cssW;
    this.height = cssH;
    return { width: cssW, height: cssH };
  }

  laneWidth() { return this.width / B420.CONFIG.LANES; }
  laneX(lane) { return this.laneWidth() * (lane + 0.5); }

  addShake(amount) { this.shake = Math.min(1, this.shake + amount); }

  drawBackground(dt, scrollSpeed, movingLinesActive) {
    const ctx = this.ctx;
    ctx.fillStyle = B420.COLORS.asphaltDark;
    ctx.fillRect(0, 0, this.width, this.height);

    const laneW = this.laneWidth();
    // subtle lane shading
    for (let i = 0; i < B420.CONFIG.LANES; i++) {
      ctx.fillStyle = i % 2 === 0 ? B420.COLORS.asphalt : B420.COLORS.asphaltDark;
      ctx.fillRect(i * laneW, 0, laneW, this.height);
    }
    // shoulders
    ctx.fillStyle = B420.COLORS.asphaltLight;
    ctx.fillRect(0, 0, 6, this.height);
    ctx.fillRect(this.width - 6, 0, 6, this.height);

    this.dashOffset = (this.dashOffset + scrollSpeed * dt) % 46;
    ctx.strokeStyle = B420.COLORS.laneLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 24]);
    for (let i = 1; i < B420.CONFIG.LANES; i++) {
      let x = i * laneW;
      if (movingLinesActive) x += Math.sin(this.time * 3.2 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(x, this.dashOffset - 46);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  begin(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 8;
      ctx.translate(B420.Utils.randRange(-s, s), B420.Utils.randRange(-s, s));
    }
  }

  end() { this.ctx.restore(); }

  drawGreenFog(strength) {
    const ctx = this.ctx;
    const drift = Math.sin(this.time * 0.5) * 30;
    const grad = ctx.createLinearGradient(0, 0, drift, this.height);
    grad.addColorStop(0, `rgba(120,160,70,${0.05 * strength})`);
    grad.addColorStop(0.5, `rgba(120,180,70,${0.22 * strength})`);
    grad.addColorStop(1, `rgba(120,160,70,${0.12 * strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawVignette() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.35,
      this.width / 2, this.height / 2, this.height * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawGrain() {
    // cheap dither grain using randomized tiny rects, capped count for perf
    const ctx = this.ctx;
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = '#000';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * this.width, Math.random() * this.height, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
};
