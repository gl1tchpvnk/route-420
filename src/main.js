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
    const fuel = new B420.FuelSystem();
    const chaos = new B420.ChaosSystem();
    const escalation = new B420.EscalationSystem();
    const score = new B420.ScoreSystem();
    const events = new B420.Event420System(trafficManager, renderer, audio);
    const director = new B420.ChaosDirector();
    events.onEnd = (type) => director.onEnded(type);
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
      uiLayer.style.setProperty('--ui-zoom', String(size.width / 400)); // lets touch buttons keep a >=44px tap height at small zoom
      player.onResize();
    }
    syncFrameSize();
    window.addEventListener('resize', syncFrameSize);
    window.addEventListener('orientationchange', () => setTimeout(syncFrameSize, 60));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', syncFrameSize);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('pagehide', () => gameState.flushHi());
    document.addEventListener('visibilitychange', () => { if (document.hidden) gameState.flushHi(); });
    gameFrame.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    function unlockAudioOnce() {
      audio.unlock();
      window.removeEventListener('pointerdown', unlockAudioOnce);
      window.removeEventListener('keydown', unlockAudioOnce);
    }
    window.addEventListener('pointerdown', unlockAudioOnce);
    window.addEventListener('keydown', unlockAudioOnce);

    function showOnly(which) {
      screens.showPause(false);
      hud.show(which === 'hud');
      touch.setActive(which === 'hud');
      if (debugPanel) debugPanel.el.style.display = which === 'hud' ? '' : 'none';
      if (which === 'menu') screens.showMenu(gameState.save); else screens.hideMenu();
      if (which === 'results') screens.showResults(gameState); else screens.hideResults();
    }

    // Everything CHAOS / event related that must never leak between runs (crash, RETRY, Home, new run).
    function clearChaos() {
      chaos.reset();
      director.reset();
      events.reset();
      score.eventMult = 1; // no x4.20 carried over
      gameState.scoreMult = 1;
      player.blown = 0;
      player.exhaust = 0;
      hud.hideEventBanner();
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
      fuel.reset();
      player.fuel = 0;
      clearChaos();
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
      if (gameState.crashing) return;
      if (gameState.state !== B420.STATES.PLAYING && gameState.state !== B420.STATES.PAUSED) return;
      gameState.togglePause();
      const paused = gameState.state === B420.STATES.PAUSED;
      screens.showPause(paused);
      if (paused) audio.stopEngine(); else audio.startEngine();
    }

    function goHome() {
      if (gameState.state !== B420.STATES.PLAYING && gameState.state !== B420.STATES.PAUSED) return;
      gameState.abandon();
      fuel.reset();
      player.fuel = 0;
      clearChaos();
      audio.stopEngine();
      hud.hideEventBanner();
      particles.clear();
      showOnly('menu');
    }

    input.bind({
      onLeft: () => requestLaneChange(-1),
      onRight: () => requestLaneChange(1),
      onBlaze: requestBlaze,
      onPause: requestPause,
      // Enter = RETRY, only on the game-over screen; same startRun path as the RETRY button.
      // Returns true when handled (so a focused button doesn't also fire its own click).
      onEnter: () => {
        if (gameState.state !== B420.STATES.GAME_OVER || !screens.resultsEl.classList.contains('show')) return false;
        startRun();
        return true;
      }
    });

    screens.refs.playBtn.addEventListener('click', startRun);
    screens.refs.retryBtn.addEventListener('click', startRun);
    screens.refs.menuBtn.addEventListener('click', () => { gameState.toMenu(); showOnly('menu'); });
    hud.bindPause(requestPause);
    hud.bindHome(goHome);
    screens.refs.resumeBtn.addEventListener('click', requestPause);
    screens.refs.pauseHomeBtn.addEventListener('click', goHome);

    if (debugMode) {
      B420.debug = { gameState, player, heat, blaze, score, events, trafficManager, renderer, fuel, hud, roadSpeedMult, chaos, director, directorCtx, setCollision: (v) => { collisionEnabled = v; } };
      debugPanel = new B420.DebugPanel(uiLayer, {
        onForceBlaze: () => { blaze.meter = B420.CONFIG.BLAZE_MAX; requestBlaze(); },
        onForceEvent: (type) => { events.clear(); director.tryStart(type, events); },
        onForceNext: () => { events.clear(); director.tryStart(director.select(directorCtx()), events); },
        onClearEvent: () => events.clear(),
        onSetEventCount: (n) => director.setCount(n),
        onChaos: (n) => chaos.debugSet(n),
        onArmChaos: () => chaos.arm(),
        onResetChaos: () => chaos.reset(),
        onForceSpawn: (type) => {
          trafficManager.vehicles.push(new B420.Vehicle(type, B420.Utils.randInt(0, B420.CONFIG.LANES - 1), renderer, -60));
        },
        onForceRival: () => {
          if (!trafficManager.rival) {
            trafficManager.rival = new B420.Rival(renderer, B420.Utils.clamp(player.lane + 1, 0, B420.CONFIG.LANES - 1), player.y - 70);
            trafficManager.rivalActive = true;
          }
        },
        onForceFuel: () => trafficManager.pickups.push({ kind: 'fuel', lane: player.lane, x: renderer.laneX(player.lane), y: player.y - 150, w: 22, h: 22, collected: false }),
        onMaxHeat: () => heat.add(999),
        onAddScore: (amt) => score.addBonus(amt),
        onToggleCollision: (v) => { collisionEnabled = v; }
      });
    }

    function triggerCollision(otherVehicle) {
      gameState.beginCrash();
      fuel.reset();
      player.fuel = 0;
      clearChaos();
      renderer.addShake(1);
      audio.collision();
      audio.stopEngine();
      const pt = player.exhaustPoint();
      particles.spawnSpark(player.x, player.y, 16);
      particles.spawnSpark(otherVehicle.x, otherVehicle.y, 10);
    }

    function popupAt(text, x, y, tight) {
      hud.popup(text, x, y - 20, tight ? 'tight' : '');
    }

    // Road speed: BLAZE alone slows traffic (0.78x); FUEL alone boosts (up to 1.22x). Together they blend
    // toward a bounded FUEL_BLAZE_COMBINED (~1.08x) so FUEL still reads as a boost during BLAZE.
    function roadSpeedMult() {
      const bm = blaze.trafficSpeedMult();
      return bm < 1 ? B420.Utils.lerp(bm, B420.CONFIG.FUEL_BLAZE_COMBINED, fuel.level) : fuel.speedMult();
    }

    function chaosTip() { // one-time teaching line; persisted, fails safe without localStorage
      if (B420.Tips.seen('chaos_tip')) return;
      B420.Tips.mark('chaos_tip');
      hud.stageToast('RECKLESS DRIVING BUILDS CHAOS');
    }

    function directorCtx() {
      const onRoad = trafficManager.vehicles.filter((v) => v.y > -20 && v.y < renderer.height).length;
      return { vehicles: onRoad, heatTier: heat.tier, blazeActive: blaze.active };
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
      fuel.update(dt);
      player.fuel = fuel.level;
      heat.update(dt);
      chaos.update(dt, true); // passive trickle only while actively playing (pause/crash never reach here)
      audio.updateEngine(B420.Utils.clamp(gameState.elapsed / B420.CONFIG.SPEED_RAMP_SECONDS, 0.15, 1) + fuel.level * 0.3);

      const speedMult = roadSpeedMult();
      const { scrollSpeed } = trafficManager.update(dt, gameState.elapsed, player, { speedMult });

      score.tick(dt, heat.multiplier(), blaze.scoreMult() * fuel.scoreMult());

      const stageMsg = escalation.update(score.value);
      if (stageMsg) { player.setStage(escalation.stage); gameState.escalationStage = escalation.stage; hud.stageToast(stageMsg); }

      const survivedBefore = events.survivedCount;
      events.update(dt, gameState.elapsed, player, trafficManager.vehicles);
      if (events.survivedCount > survivedBefore) {
        score.addBonus(B420.CONFIG.CHAOS_SURVIVE_SCORE, true); // flat +420, once per completed CHAOS event
        hud.stageToast('CHAOS SURVIVED +' + B420.CONFIG.CHAOS_SURVIVE_SCORE);
      }
      score.eventMult = events.scoreMult(); // x4.20 window
      gameState.scoreMult = score.eventMult;
      player.blown = events.level(B420.EVENTS.BLOWN);
      player.exhaust = events.level(B420.EVENTS.ROAD_MELTDOWN) * 0.55;
      if (events.announcePhase > 0) hud.eventBanner(events.announceStep, events.bannerText());
      else hud.hideEventBanner();
      gameState.events420Survived = director.eventCount; // CHAOS EVENTS: events that actually began
      // 420 CHAOS: an ARMED meter launches the one event only once the road is readable
      const road = chaos.assessRoad(trafficManager.vehicles, player, B420.CONFIG.REACTION_BASE + scrollSpeed * B420.CONFIG.REACTION_TIME);
      if (chaos.step(dt, { playing: true, boxedIn: road.boxedIn, danger: road.danger, eventBusy: events.isBusy() || !director.canStart() || trafficManager.rivalActive })) {
        // armed + readable road: Director picks one existing event, it starts, then CHAOS resets
        if (director.tryStart(director.select(directorCtx()), events)) chaos.onLaunched();
      }

      // near misses
      const chaosBefore = chaos.chaosValue;
      const nm = collision.checkNearMisses(dt, player, trafficManager.vehicles);
      for (const e of nm.events) {
        gameState.nearMisses++;
        const base = e.tight ? B420.CONFIG.NEAR_MISS_SCORE_TIGHT : B420.CONFIG.NEAR_MISS_SCORE;
        const pts = base * heat.multiplier() * fuel.scoreMult();
        score.addBonus(pts);
        chaos.award(e.tight ? B420.CONFIG.CHAOS_AWARD.tightMiss : B420.CONFIG.CHAOS_AWARD.nearMiss, heat.tier, blaze.active);
        heat.add(e.tight ? B420.CONFIG.HEAT_PER_TIGHT_MISS : B420.CONFIG.HEAT_PER_NEAR_MISS);
        const text = e.tight ? B420.Utils.choice(B420.TIGHT_MISS_TEXTS) : B420.Utils.choice(B420.NEAR_MISS_TEXTS);
        popupAt(`${text} +${Math.round(pts * score.eventMult)}`, player.x, player.y - 30, e.tight);
        audio.nearMiss(e.tight);
      }
      if (nm.thread) {
        const pts = B420.CONFIG.THREAD_NEEDLE_BONUS * heat.multiplier() * fuel.scoreMult();
        score.addBonus(pts);
        chaos.award(B420.CONFIG.CHAOS_AWARD.thread, heat.tier, blaze.active);
        heat.add(B420.CONFIG.HEAT_PER_THREAD);
        popupAt(`THREAD THE NEEDLE +${Math.round(pts * score.eventMult)}`, player.x, player.y - 55, true);
        audio.heatUp();
      }
      gameState.maxHeatTier = Math.max(gameState.maxHeatTier, heat.tier);

      // pickups
      const collected = collision.checkPickups(player, trafficManager.pickups);
      for (const p of collected) {
        if (p.kind === 'blaze') {
          chaos.award(B420.CONFIG.CHAOS_AWARD.blaze, heat.tier, blaze.active);
          blaze.fill(B420.CONFIG.BLAZE_PICKUP_FILL);
          score.addBonus(B420.CONFIG.PICKUP_BLAZE_SCORE);
          audio.pickup();
          particles.spawnPop(p.x, p.y, B420.COLORS.blazeGreenBright);
        } else if (p.kind === 'fuel') {
          fuel.collect();
          audio.fuelHit();
          hud.stageToast('FUEL HIT');
          particles.spawnPop(p.x, p.y, B420.COLORS.burntOrange);
        } else {
          score.addBonus(B420.CONFIG.MUNCHIE_SCORE);
          popupAt(`MUNCHIES +${B420.CONFIG.MUNCHIE_SCORE}`, p.x, p.y - 10, false);
          audio.munchiePickup();
          particles.spawnPop(p.x, p.y, B420.COLORS.burntOrange);
        }
      }

      // rival overtake
      if (trafficManager.rival && collision.checkRivalOvertake(player, trafficManager.rival)) {
        const pts = B420.CONFIG.RIVAL_SMOKE_SCORE * heat.multiplier() * fuel.scoreMult();
        score.addBonus(pts);
        chaos.award(B420.CONFIG.CHAOS_AWARD.rival, heat.tier, blaze.active);
        heat.add(B420.CONFIG.HEAT_PER_RIVAL);
        gameState.rivalsSmoked++;
        popupAt(`SMOKED HIM +${Math.round(pts * score.eventMult)}`, player.x, player.y - 60, true);
        audio.heatUp();
      }

      if (chaos.chaosValue - chaosBefore >= 4) chaosTip(); // a reckless action just fed the meter

      // exhaust particles
      const exhaust = player.exhaustPoint();
      if (Math.random() < 0.6) {
        particles.spawnSmoke(exhaust.x, exhaust.y, blaze.active ? B420.COLORS.blazeGreenBright : B420.COLORS.smoke, 1);
      }
      particles.update(dt);

      if (Math.max(fuel.level, player.blown, player.exhaust) > 0.2 && Math.random() < 0.7) particles.spawnSmoke(exhaust.x, exhaust.y, '#d9822b', 1);

      // blaze echoes
      if (blaze.shouldSpawnEcho() && trafficManager.vehicles.length) {
        const v = B420.Utils.choice(trafficManager.vehicles);
        particles.spawnSmoke(v.x + B420.Utils.randRange(-16, 16), v.y, 'rgba(150,220,120,0.5)', 2);
      }

      gameState.score = score.value; // ScoreSystem is the single source of truth, synced after ALL bonuses
      gameState.syncHi();

      // collision
      if (collisionEnabled) {
        const hit = collision.checkPlayerCollision(player, trafficManager.vehicles, trafficManager.rival);
        if (hit) triggerCollision(hit);
      }

      if (debugPanel) debugPanel.updateReadout(`heat ${heat.value.toFixed(0)}/100 (x${heat.tier}) | t=${gameState.elapsed.toFixed(1)}s | chaos=${chaos.chaosValue.toFixed(0)}${chaos.chaosArmed ? " ARMED" : ""} safe=${!road.boxedIn && !road.danger} | ${director.tier} #${director.eventCount} ev=${director.activeType || "-"} x${score.eventMult.toFixed(2)} | vehicles=${trafficManager.vehicles.length}`);

      hud.update(gameState, heat, blaze, chaos);
      touch.setBlaze(blaze.progressFraction(), blaze.ready);
    }

    function render(dt) {
      renderer.begin(dt);
      const movingLines = events.isMovingLinesActive();
      let bgSpeed = 0;
      if (gameState.crashing) {
        bgSpeed = trafficManager.currentScrollSpeed(gameState.elapsed) * 0.08;
      } else if (gameState.isPlaying()) {
        bgSpeed = trafficManager.currentScrollSpeed(gameState.elapsed) * roadSpeedMult();
      }
      const slowdownActive = events.ambientOn();
      const go = events.level(B420.EVENTS.GREENOUT); // 0 the instant the event ends, so the filter can't linger
      canvas.style.filter = go > 0.01 ? 'saturate(' + (1 + 0.3 * go).toFixed(2) + ') hue-rotate(' + (go * 14).toFixed(1) + 'deg)' : '';
      renderer.drawBackground(dt, bgSpeed, movingLines, slowdownActive ? B420.CONFIG.SLOWDOWN_TRAIL_ALPHA : 0,
        { sway: events.level(B420.EVENTS.ROAD_DRUNK) * 13, melt: events.level(B420.EVENTS.ROAD_MELTDOWN) * 9 });
      hud.el.classList.toggle('slowdown-ease', slowdownActive);

      if (gameState.state === B420.STATES.MENU) {
        player.draw(renderer.ctx, false);
        renderer.drawVignette();
        renderer.end();
        return;
      }

      const streak = Math.max(fuel.level, events.level(B420.EVENTS.BLOWN) * 0.8, events.level(B420.EVENTS.ROAD_MELTDOWN) * 0.6);
      if (streak > 0.02) renderer.drawFuelStreaks(streak);
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
      if (go > 0.01) renderer.drawGreenout(go);
      if (slowdownActive) renderer.drawSlowdownVignette(B420.CONFIG.SLOWDOWN_VIGNETTE_ALPHA * (events.isGreenFogActive() ? 0.35 : 1));
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
      render(gameState.state === B420.STATES.PAUSED ? 0 : dt);
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
