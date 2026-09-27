// Entry point. Boots once the DOM is ready, wires every system together, and
// runs the requestAnimationFrame loop using delta time throughout.
(function () {
  window.B420 = window.B420 || {};

  function boot() {
    const params = new URLSearchParams(window.location.search);
    const debugMode = params.get(B420.CONFIG.DEBUG_KEY) === 'true';

    const canvas = document.getElementById('game-canvas');
    const uiLayer = document.getElementById('ui-layer');
    const gameFrame = document.getElementById('game-frame');

    const renderer = new B420.Renderer(canvas);
    const player = new B420.Player(renderer);
    const gameState = new B420.GameState();
    const input = new B420.InputManager();
    const audio = new B420.AudioManager();
    const particles = new B420.ParticleSystem(200);
    const trafficManager = new B420.TrafficManager(renderer);
    const collision = new B420.CollisionSystem();
    const heat = new B420.HeatSystem();
    const blaze = new B420.BlazeSystem();
    const escalation = new B420.EscalationSystem();
    const score = new B420.ScoreSystem();
    const events = new B420.Event420System(trafficManager, renderer, audio);
    const hud = new B420.HUD(uiLayer);
    const screens = new B420.Screens(uiLayer);
    const touch = new B420.TouchControls(uiLayer, input);

    let debugPanel = null;
    let collisionEnabled = true;

    function syncFrameSize() {
      const size = renderer.resize();
      gameFrame.style.width = size.width + 'px';
      gameFrame.style.height = size.height + 'px';
      uiLayer.style.zoom = String(size.width / 400);
      player.onResize();
    }
    syncFrameSize();
    window.addEventListener('resize', syncFrameSize);
    window.addEventListener('orientationchange', () => setTimeout(syncFrameSize, 60));

    function unlockAudioOnce() {
      audio.unlock();
      window.removeEventListener('pointerdown', unlockAudioOnce);
      window.removeEventListener('keydown', unlockAudioOnce);
    }
    window.addEventListener('pointerdown', unlockAudioOnce);
    window.addEventListener('keydown', unlockAudioOnce);

    function showOnly(which) {
      hud.show(which === 'hud');
      touch.show(which === 'hud');
      if (which === 'menu') screens.showMenu(gameState.save); else screens.hideMenu();
      if (which === 'results') screens.showResults(gameState); else screens.hideResults();
    }

    function startRun() {
      unlockAudioOnce();
      gameState.start();
      player.setStage(1);
      player.lane = Math.floor((B420.CONFIG.LANES - 1) / 2);
      player.laneChangeT = 1;
      player.onResize();
      trafficManager.reset();
      heat.reset();
      blaze.reset();
      escalation.reset();
      score.reset();
      events.reset();
      collision.reset();
      particles.clear();
      audio.startEngine();
      showOnly('hud');
      hud.hideEventBanner();
    }

    function requestLaneChange(dir) {
      if (!gameState.isPlaying() || gameState.crashing) return;
      if (dir < 0) player.moveLeft(); else player.moveRight();
      audio.laneChange();
    }

    function requestBlaze() {
      if (!gameState.isPlaying() || gameState.crashing) return;
      if (blaze.activate()) {
        gameState.blazeModesUsed++;
        audio.blazeActivate();
      }
    }

    function requestPause() {
      if (gameState.state === B420.STATES.PLAYING || gameState.state === B420.STATES.PAUSED) {
        gameState.togglePause();
      }
    }

    input.bind({
      onLeft: () => requestLaneChange(-1),
      onRight: () => requestLaneChange(1),
      onBlaze: requestBlaze,
      onPause: requestPause
    });

    screens.refs.playBtn.addEventListener('click', startRun);
    screens.refs.retryBtn.addEventListener('click', startRun);
    screens.refs.menuBtn.addEventListener('click', () => { gameState.toMenu(); showOnly('menu'); });
    hud.bindPause(requestPause);

    if (debugMode) {
      debugPanel = new B420.DebugPanel(uiLayer, {
        onForceBlaze: () => { blaze.meter = B420.CONFIG.BLAZE_MAX; requestBlaze(); },
        onForceEvent: (type) => events.forceTrigger(type),
        onSkipTo420: () => { gameState.elapsed = Math.max(0, events.nextTriggerTime - 2); },
        onForceSpawn: (type) => {
          trafficManager.vehicles.push(new B420.Vehicle(type, B420.Utils.randInt(0, B420.CONFIG.LANES - 1), renderer, -60));
        },
        onForceRival: () => {
          if (!trafficManager.rival) {
            trafficManager.rival = new B420.Rival(renderer, B420.Utils.clamp(player.lane + 1, 0, B420.CONFIG.LANES - 1), player.y - 70);
            trafficManager.rivalActive = true;
          }
        },
        onMaxHeat: () => heat.add(999),
        onAddScore: (amt) => score.addBonus(amt),
        onToggleCollision: (v) => { collisionEnabled = v; }
      });
    }

    function triggerCollision(otherVehicle) {
      gameState.beginCrash();
      renderer.addShake(1);
      audio.collision();
      audio.stopEngine();
      const pt = player.exhaustPoint();
      particles.spawnSpark(player.x, player.y, 16);
      particles.spawnSpark(otherVehicle.x, otherVehicle.y, 10);
    }

    function popupAt(text, x, y, tight) {
      hud.popup(text, x - 30, y - 20, tight ? 'tight' : '');
    }

    function update(dt) {
      if (gameState.state === B420.STATES.PAUSED) return;

      if (gameState.crashing) {
        gameState.crashPhaseTimer -= dt;
        renderer.begin(dt);
        const slowMult = 0.08;
        trafficManager.update(dt * slowMult, gameState.elapsed, player, { speedMult: 1, suppressBlazePickup: true });
        particles.update(dt);
        player.wobble += dt * 6;
        if (gameState.crashPhaseTimer <= 0) {
          gameState.finishCrash();
          audio.results();
          showOnly('results');
        }
        renderer.end();
        return;
      }

      if (!gameState.isPlaying()) return;

      gameState.elapsed += dt;
      player.update(dt, blaze.active);
      blaze.update(dt);
      heat.update(dt);
      audio.updateEngine(B420.Utils.clamp(gameState.elapsed / B420.CONFIG.SPEED_RAMP_SECONDS, 0.15, 1));

      const speedMult = blaze.trafficSpeedMult();
      const { scrollSpeed } = trafficManager.update(dt, gameState.elapsed, player, { speedMult });

      score.tick(dt, heat.multiplier(), blaze.scoreMult());
      gameState.score = score.value;

      const stageMsg = escalation.update(gameState.score);
      if (stageMsg) { player.setStage(escalation.stage); gameState.escalationStage = escalation.stage; hud.stageToast(stageMsg); }

      const survivedBefore = events.survivedCount;
      events.update(dt, gameState.elapsed, player, trafficManager.vehicles);
      if (events.survivedCount > survivedBefore) {
        score.addBonus(B420.CONFIG.EVENT_SURVIVE_SCORE);
        popupAt(`4:20 SURVIVED +${B420.CONFIG.EVENT_SURVIVE_SCORE}`, player.x, player.y - 55, false);
      }
      if (events.announcePhase > 0) hud.eventBanner(events.announceStep, events.active ? events.active.name : '');
      else hud.hideEventBanner();
      gameState.events420Survived = events.survivedCount;
      const nextEventIn = Math.max(0, events.nextTriggerTime - gameState.elapsed);

      // near misses
      const nm = collision.checkNearMisses(dt, player, trafficManager.vehicles);
      for (const e of nm.events) {
        gameState.nearMisses++;
        const base = e.tight ? B420.CONFIG.NEAR_MISS_SCORE_TIGHT : B420.CONFIG.NEAR_MISS_SCORE;
        const pts = base * heat.multiplier();
        score.addBonus(pts);
        heat.add(e.tight ? B420.CONFIG.HEAT_PER_TIGHT_MISS : B420.CONFIG.HEAT_PER_NEAR_MISS);
        const text = e.tight ? B420.Utils.choice(B420.TIGHT_MISS_TEXTS) : B420.Utils.choice(B420.NEAR_MISS_TEXTS);
        popupAt(`${text} +${Math.round(pts)}`, player.x, player.y - 30, e.tight);
        audio.nearMiss(e.tight);
      }
      if (nm.thread) {
        const pts = B420.CONFIG.THREAD_NEEDLE_BONUS * heat.multiplier();
        score.addBonus(pts);
        heat.add(B420.CONFIG.HEAT_PER_THREAD);
        popupAt(`THREAD THE NEEDLE +${Math.round(pts)}`, player.x, player.y - 55, true);
        audio.heatUp();
      }
      gameState.maxHeatTier = Math.max(gameState.maxHeatTier, heat.tier);

      // pickups
      const collected = collision.checkPickups(player, trafficManager.pickups);
      for (const p of collected) {
        if (p.kind === 'blaze') {
          blaze.fill(B420.CONFIG.BLAZE_PICKUP_FILL);
          score.addBonus(B420.CONFIG.PICKUP_BLAZE_SCORE);
          audio.pickup();
          particles.spawnPop(p.x, p.y, B420.COLORS.blazeGreenBright);
        } else {
          score.addBonus(B420.CONFIG.MUNCHIE_SCORE);
          popupAt(`MUNCHIES +${B420.CONFIG.MUNCHIE_SCORE}`, p.x, p.y - 10, false);
          audio.munchiePickup();
          particles.spawnPop(p.x, p.y, B420.COLORS.burntOrange);
        }
      }

      // rival overtake
      if (trafficManager.rival && collision.checkRivalOvertake(player, trafficManager.rival)) {
        const pts = B420.CONFIG.RIVAL_SMOKE_SCORE * heat.multiplier();
        score.addBonus(pts);
        heat.add(B420.CONFIG.HEAT_PER_RIVAL);
        gameState.rivalsSmoked++;
        popupAt(`SMOKED HIM +${Math.round(pts)}`, player.x, player.y - 60, true);
        audio.heatUp();
      }

      // exhaust particles
      const exhaust = player.exhaustPoint();
      if (Math.random() < 0.6) {
        particles.spawnSmoke(exhaust.x, exhaust.y, blaze.active ? B420.COLORS.blazeGreenBright : B420.COLORS.smoke, 1);
      }
      particles.update(dt);

      // blaze echoes
      if (blaze.shouldSpawnEcho() && trafficManager.vehicles.length) {
        const v = B420.Utils.choice(trafficManager.vehicles);
        particles.spawnSmoke(v.x + B420.Utils.randRange(-16, 16), v.y, 'rgba(150,220,120,0.5)', 2);
      }

      // collision
      if (collisionEnabled) {
        const hit = collision.checkPlayerCollision(player, trafficManager.vehicles, trafficManager.rival);
        if (hit) triggerCollision(hit);
      }

      if (debugPanel) debugPanel.updateReadout(`heat ${heat.value.toFixed(0)}/100 (x${heat.tier}) | t=${gameState.elapsed.toFixed(1)}s | next420=${events.nextTriggerTime.toFixed(0)}s | vehicles=${trafficManager.vehicles.length}`);

      hud.update(gameState, heat, blaze, nextEventIn);
      touch.setBlazeReady(blaze.ready);
    }

    function render(dt) {
      renderer.begin(dt);
      const movingLines = events.isMovingLinesActive();
      let bgSpeed = 0;
      if (gameState.crashing) {
        bgSpeed = trafficManager.currentScrollSpeed(gameState.elapsed) * 0.08;
      } else if (gameState.isPlaying()) {
        bgSpeed = trafficManager.currentScrollSpeed(gameState.elapsed) * blaze.trafficSpeedMult();
      }
      renderer.drawBackground(dt, bgSpeed, movingLines);

      if (gameState.state === B420.STATES.MENU) {
        player.draw(renderer.ctx, false);
        renderer.drawVignette();
        renderer.end();
        return;
      }

      trafficManager.draw(renderer.ctx, renderer.time);
      events.drawOverlay(renderer.ctx);
      particles.draw(renderer.ctx);
      if (!gameState.crashing) {
        player.draw(renderer.ctx, blaze.active);
      } else if (gameState.crashPhaseTimer > 0.12) {
        const spin = Math.sin((0.6 - gameState.crashPhaseTimer) * 16) * 0.4;
        player.draw(renderer.ctx, false, spin);
      }
      if (events.isGreenFogActive()) renderer.drawGreenFog(events.greenFogStrength());
      renderer.drawVignette();
      renderer.drawGrain();
      renderer.end();
    }

    let lastT = performance.now();
    function frame(now) {
      let dt = (now - lastT) / 1000;
      lastT = now;
      dt = Math.min(dt, 1 / 20); // clamp huge gaps (tab switch, etc.)
      update(dt);
      render(dt);
      requestAnimationFrame(frame);
    }

    showOnly('menu');
    requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
