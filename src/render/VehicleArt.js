// All vehicle art is drawn procedurally on canvas — no external images.
// Every vehicle faces "up" (nose toward top of screen, tail/exhaust toward bottom).
window.B420 = window.B420 || {};

B420.VehicleArt = (function () {
  const C = B420.COLORS;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- generic body used by traffic + player as a base ----
  function body(ctx, w, h, color, stripe) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, -w / 2 + 2, -h / 2 + 4, w, h, 8);
    ctx.fill();
    ctx.fillStyle = color;
    rr(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
    // windshield band
    ctx.fillStyle = 'rgba(15,14,10,0.55)';
    rr(ctx, -w / 2 + 4, -h / 2 + h * 0.16, w - 8, h * 0.22, 4);
    ctx.fill();
    if (stripe) {
      ctx.fillStyle = stripe;
      ctx.fillRect(-w * 0.09, -h / 2 + 2, w * 0.18, h - 4);
    }
    // wheels
    ctx.fillStyle = '#0e0d0a';
    const wheelW = 5, wheelH = h * 0.26;
    ctx.fillRect(-w / 2 - 1, -h * 0.28, wheelW, wheelH);
    ctx.fillRect(w / 2 - wheelW + 1, -h * 0.28, wheelW, wheelH);
    ctx.fillRect(-w / 2 - 1, h * 0.02, wheelW, wheelH);
    ctx.fillRect(w / 2 - wheelW + 1, h * 0.02, wheelW, wheelH);
  }

  function drawSedan(ctx) { body(ctx, 32, 54, '#5b6b73'); }

  function drawPickup(ctx) {
    body(ctx, 33, 56, '#8a6a3f');
    ctx.fillStyle = 'rgba(120,60,30,0.9)';
    rr(ctx, -14, 2, 12, 10, 2); ctx.fill();
    rr(ctx, 6, -14, 9, 8, 2); ctx.fill();
    ctx.fillStyle = 'rgba(30,25,18,0.5)';
    rr(ctx, -14, -26, 28, 20, 4); ctx.fill();
  }

  function drawMuscle(ctx) {
    body(ctx, 33, 55, '#1b1a17', C.red);
    // flare
    ctx.fillStyle = C.chromeDark;
    ctx.fillRect(-16.5, 6, 4, 14);
    ctx.fillRect(12.5, 6, 4, 14);
  }

  function drawGrandma(ctx) {
    body(ctx, 32, 53, '#c9b9d6');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-9, -20, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -20, 3, 0, 7); ctx.fill();
  }

  function drawCop(ctx, t) {
    body(ctx, 33, 55, '#101010');
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(-16.5, -8, 33, 12);
    const on = Math.floor(t * 6) % 2 === 0;
    ctx.fillStyle = on ? C.copRed : C.copBlue;
    ctx.fillRect(-6, -27, 5, 5);
    ctx.fillStyle = on ? C.copBlue : C.copRed;
    ctx.fillRect(1, -27, 5, 5);
  }

  function drawRival(ctx, t, stage) {
    drawPlayer(ctx, { stage: Math.max(3, stage || 3), wobble: t, w: 34, h: 58 }, '#3a2245', C.burntOrange);
  }

  const TRAFFIC_DRAW = {
    sedan: drawSedan,
    pickup: drawPickup,
    muscle: drawMuscle,
    grandma: drawGrandma,
    cop: drawCop
  };

  function drawTraffic(ctx, vehicle, t) {
    const fn = TRAFFIC_DRAW[vehicle.type] || drawSedan;
    fn(ctx, t);
  }

  // ---- player hot rod, cumulative stages 1-6 ----
  function drawPlayer(ctx, player, bodyColor, flameAccent) {
    const stage = player.stage || 1;
    const jitter = stage >= 5 ? Math.sin((player.wobble || 0) * 40) * (stage >= 6 ? 1.4 : 0.7) : 0;
    ctx.save();
    ctx.translate(jitter, 0);

    const lowered = stage >= 5 ? 3 : 0;
    const w = 34, h = 58 - lowered;
    const col = bodyColor || C.red;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, -w / 2 + 2, -h / 2 + 5, w, h, 7);
    ctx.fill();

    // body — narrow nose, wide tail (roadster silhouette)
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h / 2);
    ctx.lineTo(w * 0.28, -h / 2);
    ctx.lineTo(w * 0.5, -h * 0.12);
    ctx.lineTo(w * 0.5, h / 2 - 6);
    ctx.quadraticCurveTo(w * 0.5, h / 2, w * 0.36, h / 2);
    ctx.lineTo(-w * 0.36, h / 2);
    ctx.quadraticCurveTo(-w * 0.5, h / 2, -w * 0.5, h / 2 - 6);
    ctx.lineTo(-w * 0.5, -h * 0.12);
    ctx.closePath();
    ctx.fill();

    // pinstripe
    ctx.strokeStyle = C.chrome;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 3);
    ctx.lineTo(0, h / 2 - 4);
    ctx.stroke();

    // chopped roof / cabin
    ctx.fillStyle = 'rgba(10,9,7,0.6)';
    rr(ctx, -w * 0.22, -h * 0.06, w * 0.44, h * 0.28, 3);
    ctx.fill();

    // rear tires — widen at stage 3+
    const tireW = stage >= 3 ? 7 : 5;
    const tireOverhang = stage >= 3 ? 3 : 0;
    ctx.fillStyle = '#0e0d0a';
    ctx.fillRect(-w / 2 - tireOverhang, h * 0.08, tireW, h * 0.32);
    ctx.fillRect(w / 2 - tireW + tireOverhang, h * 0.08, tireW, h * 0.32);
    ctx.fillRect(-w / 2 + 1, -h * 0.32, 5, h * 0.22);
    ctx.fillRect(w / 2 - 6, -h * 0.32, 5, h * 0.22);

    // side pipes — stage 3+ more aggressive
    ctx.fillStyle = C.chrome;
    const pipeLen = stage >= 3 ? h * 0.46 : h * 0.3;
    ctx.fillRect(-w / 2 - 2, -2, 2.5, pipeLen);
    ctx.fillRect(w / 2 - 0.5, -2, 2.5, pipeLen);

    // hood scoop / blower — grows stage 2, huge at stage 6
    if (stage >= 2) {
      const scale = stage >= 6 ? 2.2 : stage >= 4 ? 1.5 : 1;
      ctx.fillStyle = C.chromeDark;
      const sw = 11 * scale, sh = 14 * scale;
      rr(ctx, -sw / 2, -h / 2 - sh * 0.35, sw, sh, 2);
      ctx.fill();
      if (stage >= 6) {
        ctx.fillStyle = C.chrome;
        ctx.fillRect(-sw / 2 + 2, -h / 2 - sh * 0.35 - 5, 4, 6);
        ctx.fillRect(sw / 2 - 6, -h / 2 - sh * 0.35 - 5, 4, 6);
      }
    }

    // flames from exhaust — stage 4+
    if (stage >= 4) {
      const t = (player.wobble || 0) * 10;
      const flicker = 0.75 + Math.sin(t) * 0.25;
      const flen = (stage >= 6 ? 22 : 13) * flicker;
      drawFlame(ctx, -w / 2 - 0.5, pipeLen - 1, flen, flameAccent);
      drawFlame(ctx, w / 2 + 0.5, pipeLen - 1, flen * 0.9, flameAccent);
    }

    ctx.restore();
  }

  function drawFlame(ctx, x, y, len, accent) {
    const grad = ctx.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, accent === undefined ? C.flame2 : C.flame2);
    grad.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x, y + len);
    ctx.closePath();
    ctx.fill();
  }

  // cheap flying saucer
  function drawUFO(ctx, t) {
    ctx.save();
    const bob = Math.sin(t * 2) * 3;
    ctx.translate(0, bob);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 6, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.chrome;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.chromeDark;
    ctx.beginPath(); ctx.ellipse(0, 4, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,140,0.85)';
    ctx.beginPath(); ctx.ellipse(0, -6, 12, 9, 0, Math.PI, 0); ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = Math.floor(t * 4 + i) % 2 === 0 ? C.blazeGreenBright : C.burntOrange;
      ctx.beginPath(); ctx.arc(i * 9, 3, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawBeam(ctx, x0, y0, x1, y1, t) {
    const flicker = 0.5 + Math.sin(t * 30) * 0.25;
    ctx.save();
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(180,230,140,${0.55 * flicker})`);
    grad.addColorStop(1, `rgba(180,230,140,0.05)`);
    ctx.fillStyle = grad;
    const spread = 14;
    ctx.beginPath();
    ctx.moveTo(x0 - 8, y0);
    ctx.lineTo(x0 + 8, y0);
    ctx.lineTo(x1 + spread, y1);
    ctx.lineTo(x1 - spread, y1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { drawPlayer, drawTraffic, drawRival, drawUFO, drawBeam, rr };
})();
