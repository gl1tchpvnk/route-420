// Route 420 permanent checks — run with `npm test`. Node built-ins only, no dependencies.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) pass++; else { fail++; console.log('  FAIL  ' + name + (detail ? '  :: ' + detail : '')); }
};
const section = (t) => console.log('- ' + t);

// ---------- headless loader for pure-logic modules ----------
function load(files, store) {
  let writes = 0;
  const ls = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { writes++; store[k] = String(v); }
  };
  const ctx = { localStorage: ls, console, Math, JSON, Number, String, Object, Array, Set, Infinity };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return { B420: ctx.B420, ctx, writes: () => writes, resetWrites: () => { writes = 0; } };
}
const CORE = ['src/utils/constants.js', 'src/utils/utils.js'];
const KEY = 'burnout420_save_v1'; // legacy key kept on purpose so saved scores survive

// ---------- PROJECT / BUILD ----------
section('project files + syntax');
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
ok('index.html lists game scripts', scripts.length > 15 && scripts[0].endsWith('constants.js') && scripts[scripts.length - 1].endsWith('main.js'));
const required = [...scripts, 'style.css', 'package.json', 'README.md', 'tools/build.js', 'tools/dev-server.js', 'tools/bundle.js', 'tests/check.js'];
for (const f of required) ok('exists: ' + f, fs.existsSync(path.join(root, f)));
for (const f of required.filter((f) => f.endsWith('.js'))) {
  const r = cp.spawnSync(process.execPath, ['--check', path.join(root, f)], { encoding: 'utf8' });
  ok('syntax: ' + f, r.status === 0, r.stderr.split('\n')[0]);
}

section('production build');
const distExisted = fs.existsSync(path.join(root, 'dist'));
const b = cp.spawnSync(process.execPath, [path.join(root, 'tools/build.js')], { cwd: root, encoding: 'utf8' });
ok('build exits 0', b.status === 0, b.stderr);
for (const f of ['dist/index.html', 'dist/style.css', 'dist/src/main.js', 'dist/src/systems/FuelSystem.js']) ok('dist has ' + f, fs.existsSync(path.join(root, f)));
if (!distExisted) fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });

section('metadata + static-game rules');
const pkg = JSON.parse(read('package.json'));
for (const s of ['dev', 'start', 'build', 'bundle', 'test']) ok('npm script: ' + s, !!pkg.scripts[s]);
ok('no dependencies', !Object.keys(pkg.dependencies || {}).length && !Object.keys(pkg.devDependencies || {}).length);
ok('no stale "filthy" metadata', !/filthy/i.test(read('package.json') + html + read('README.md')));
const allSrc = scripts.map(read).join('\n');
ok('no network/AI calls in game code', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|api\.openai|api\.anthropic/.test(allSrc));

// ---------- CONTROLS ----------
section('controls');
const tc = read('src/ui/TouchControls.js'), main = read('src/main.js'), css = read('style.css'), inp = read('src/core/InputManager.js');
ok('LEFT/BLAZE/RIGHT markup', /tc-left/.test(tc) && /tc-blaze/.test(tc) && /tc-right/.test(tc));
ok('controls activated by PLAYING (hud) state', /touch\.setActive\(which === 'hud'\)/.test(main));
ok('.touch-controls.active displays unconditionally', /\.touch-controls\.active\s*\{\s*display:\s*flex/.test(css) && !/@media[^{]*\{\s*\.touch-controls\.active/.test(css));
ok('controls not gated on device type in JS', !/matchMedia|maxTouchPoints|pointer: coarse/.test(tc) && !/touchSeen/.test(main + allSrc));
ok('keyboard: Left/A, Right/D', /case 'ArrowLeft': case 'KeyA'/.test(inp) && /case 'ArrowRight': case 'KeyD'/.test(inp));
ok('keyboard: Space + Up = BLAZE', /case 'Space': case 'ArrowUp'/.test(inp));
ok('keyboard: P + Escape = pause', /case 'KeyP': case 'Escape'/.test(inp));
ok('primary buttons flat at rest', /\.btn-primary\s*\{[^}]*box-shadow:\s*none/.test(css) && /\.btn-primary:active\s*\{[^}]*translateY\(1px\)/.test(css));

// ---------- BLAZE + FUEL wiring ----------
section('BLAZE pickup + FUEL wiring');
const art = read('src/render/VehicleArt.js'), tm = read('src/systems/TrafficManager.js'), sp = read('src/systems/SpawnManager.js');
ok('leaf + jerry-can renderers are separate functions', /function drawBlazeLeaf/.test(art) && /function drawJerryCan/.test(art) && /drawBlazeLeaf,\s*drawJerryCan/.test(art));
ok("pickup kinds dispatch to distinct art", /kind === 'blaze'\)\s*\{\s*B420\.VehicleArt\.drawBlazeLeaf/.test(tm) && /kind === 'fuel'\)\s*\{\s*B420\.VehicleArt\.drawJerryCan/.test(tm));
ok('FUEL spawns + is pushed as kind fuel', /spawnFuel/.test(sp) && /kind: 'fuel'/.test(tm));
ok('FUEL collected via fuel.collect()', /p\.kind === 'fuel'[\s\S]{0,80}fuel\.collect\(\)/.test(main));
const fnBody = (name) => { const i = main.indexOf('function ' + name); return i < 0 ? '' : main.slice(i, i + 900); };
ok('FUEL cleared on run start / crash / Home', /fuel\.reset\(\)/.test(fnBody('startRun')) && /fuel\.reset\(\)/.test(fnBody('triggerCollision')) && /fuel\.reset\(\)/.test(fnBody('goHome')));

section('FuelSystem logic');
{
  const { B420 } = load([...CORE, 'src/systems/FuelSystem.js'], {});
  const C = B420.CONFIG, f = new B420.FuelSystem();
  ok('exposes fuelActive/fuelMultiplier/fuelRemaining', 'fuelActive' in f && 'fuelMultiplier' in f && 'fuelRemaining' in f);
  ok('idle: inactive, 1.0x', !f.fuelActive && f.fuelMultiplier === 1);
  f.collect(); ok('collect: duration ' + C.FUEL_DURATION, f.fuelActive && f.fuelRemaining === C.FUEL_DURATION);
  f.collect(); ok('re-collect adds +' + C.FUEL_EXTEND + 's', Math.abs(f.fuelRemaining - (C.FUEL_DURATION + C.FUEL_EXTEND)) < 1e-9);
  for (let i = 0; i < 10; i++) f.collect();
  ok('duration capped at ' + C.FUEL_MAX_DURATION, f.fuelRemaining <= C.FUEL_MAX_DURATION + 1e-9);
  for (let i = 0; i < 120; i++) f.update(1 / 60);
  ok('speed bounded (no stacking)', f.fuelMultiplier <= 1 + C.FUEL_SPEED_BOOST + 1e-9, String(f.fuelMultiplier));
  f.reset(); ok('reset clears everything', !f.fuelActive && f.fuelMultiplier === 1 && f.scoreMult() === 1);
}

// ---------- HIGH SCORE ----------
section('high-score persistence');
{
  const store = {};
  const t = load([...CORE, 'src/core/GameState.js'], store), B = t.B420;
  for (const bad of ['garbage{', 'null', '[]', '{"bestScore":"abc"}', '{"bestScore":-5}']) { store[KEY] = bad; ok('corrupt storage -> 0 (' + bad + ')', B.Storage.load().bestScore === 0); }
  delete store[KEY]; ok('missing storage -> 0', B.Storage.load().bestScore === 0);
  store[KEY] = JSON.stringify({ bestScore: 5000, longestRun: 0, highestHeatTier: 1 });
  B.Storage.setHi(100); ok('setHi never lowers HI', B.Storage.load().bestScore === 5000);
  const saved = () => B.Storage.load().bestScore;
  const gs = new B.GameState();
  gs.start(); t.resetWrites();
  for (let s = 5001; s <= 5600; s++) { gs.score = s; gs.syncHi(); }
  ok('live HI follows score in memory', gs.hi === 5600);
  ok('no storage writes while driving', t.writes() === 0, 'writes=' + t.writes());
  gs.score = 5600; gs.beginCrash(); gs.finishCrash();
  ok('game over persists new HI', saved() === 5600 && gs.lastResult.newRecord === true);
  gs.start(); gs.score = 200; gs.syncHi(); gs.beginCrash(); gs.finishCrash();
  ok('lower run does not overwrite HI / no false NEW HIGH SCORE', saved() === 5600 && gs.lastResult.newRecord === false);
  gs.start(); gs.score = 7000; gs.syncHi(); gs.abandon();
  ok('Home/abandon persists new HI', saved() === 7000);
  gs.start(); gs.score = 9000; gs.syncHi(); gs.flushHi();
  ok('pagehide/visibility flush persists HI', saved() === 9000);
  t.resetWrites(); gs.flushHi(); gs.flushHi(); ok('flush is idempotent (no repeat writes)', t.writes() === 0);
  ok('pagehide + visibilitychange wired; no flush in the update loop', /pagehide[\s\S]{0,60}flushHi/.test(main) && /visibilitychange[\s\S]{0,120}flushHi/.test(main) && (main.match(/flushHi/g) || []).length === 2);
}

// ---------- SPAWN RESET LIFECYCLE ----------
section('spawn reset lifecycle');
{
  const { B420 } = load([...CORE, 'src/systems/SpawnManager.js', 'src/systems/TrafficManager.js'], {});
  const C = B420.CONFIG, stub = { height: 800, width: 400, laneX: () => 0, laneWidth: () => 100 };
  ok('SpawnManager.reset exists', typeof B420.SpawnManager.prototype.reset === 'function');
  const tmgr = new B420.TrafficManager(stub), s = tmgr.spawner;
  s.spawnTimer = 0.01; s.pickupTimer = 0.01; s.fuelTimer = 0.01;
  tmgr.reset();
  ok('traffic timer fresh', s.spawnTimer === C.SPAWN_INTERVAL_START);
  ok('BLAZE pickup timer fresh', s.pickupTimer >= C.PICKUP_INTERVAL_MIN && s.pickupTimer <= C.PICKUP_INTERVAL_MAX, String(s.pickupTimer));
  ok('FUEL timer fresh (20-32s cadence)', s.fuelTimer >= C.FUEL_SPAWN_MIN && s.fuelTimer <= C.FUEL_SPAWN_MAX, String(s.fuelTimer));
  ok('TrafficManager.reset uses spawner.reset()', /spawner\.reset\(\)/.test(tm));
  ok('startRun resets traffic manager', /trafficManager\.reset\(\)/.test(fnBody('startRun')));
}

// ---------- 420 CHAOS (Pass 1) ----------
section('420 CHAOS logic');
{
  const { B420 } = load([...CORE, 'src/entities/Vehicle.js', 'src/systems/ChaosSystem.js'], {});
  const C = B420.CONFIG, A = C.CHAOS_AWARD, mk = () => new B420.ChaosSystem();
  ok('ChaosSystem exists, exposes chaosValue/chaosArmed/chaosPercent', typeof B420.ChaosSystem === 'function' && (() => { const c = mk(); return 'chaosValue' in c && 'chaosArmed' in c && 'chaosPercent' in c; })());
  ok('base awards 8 / 12 / 20 / 20 / 5', A.nearMiss === 8 && A.tightMiss === 12 && A.thread === 20 && A.rival === 20 && A.blaze === 5);
  let c = mk(); c.award(A.nearMiss, 1, false); ok('near-miss CHAOS added (x1 = 8)', c.chaosValue === 8);
  c = mk(); c.add(-50); ok('never goes below 0', c.chaosValue === 0);
  const m = [1, 2, 3, 4, 5].map((t) => +mk().heatMultiplier(t).toFixed(2));
  ok('HEAT multipliers 1.0/1.1/1.2/1.3/1.4', m.join() === '1,1.1,1.2,1.3,1.4', m.join());
  c = mk(); c.award(10, 3, false); ok('HEAT x3 applied (10 -> 12)', Math.abs(c.chaosValue - 12) < 1e-9, String(c.chaosValue));
  c = mk(); c.award(8, 3, true); ok('BLAZE x1.25 stacks with HEAT (8*1.2*1.25 = 12)', Math.abs(c.chaosValue - 12) < 1e-9, String(c.chaosValue));
  ok('FUEL never multiplies CHAOS (no FUEL input anywhere)', !/fuel/i.test(read('src/systems/ChaosSystem.js')) && !/chaos\.award\([^)]*fuel/i.test(main));
  c = mk(); c.update(10, true); ok('passive ~0.5/s (10s -> 5)', Math.abs(c.chaosValue - 5) < 1e-9, String(c.chaosValue));
  c = mk(); c.update(10, false); ok('passive paused when not playing', c.chaosValue === 0);
  ok('main only ticks passive CHAOS inside the playing update (pause/crash return earlier)', /heat\.update\(dt\);\s*chaos\.update\(dt, true\)/.test(main));
  c = mk(); c.add(30); const before = c.chaosValue; for (let i = 0; i < 600; i++) c.update(0, true); ok('CHAOS never decays', c.chaosValue === before);
  c = mk(); c.add(99.9); c.add(50); ok('clamps at 100 and ARMS', c.chaosValue === 100 && c.chaosArmed);
  c.add(40); ok('armed meter stays full', c.chaosValue === 100 && c.chaosArmed);
  const ctx = (o) => Object.assign({ playing: true, boxedIn: false, danger: false, eventBusy: false }, o);
  c = mk(); c.arm();
  ok('does not launch on the arming frame', c.step(0.016, ctx({ boxedIn: true })) === false);
  for (const [name, o] of [['boxed in', { boxedIn: true }], ['immediate danger', { danger: true }], ['event active', { eventBusy: true }], ['paused/over', { playing: false }]]) {
    c = mk(); c.arm(); let fired = false; for (let i = 0; i < 100; i++) fired = fired || c.step(0.05, ctx(o));
    ok('unsafe delays launch: ' + name, !fired);
  }
  c = mk(); c.arm(); ok('readable window waits a short hold first', c.step(0.1, ctx({})) === false);
  let go = false; for (let i = 0; i < 20 && !go; i++) go = c.step(0.05, ctx({})); ok('readable road launches', go);
  c.onLaunched(); ok('launch resets CHAOS to 0 and clears ARMED', c.chaosValue === 0 && !c.chaosArmed);
  c = mk(); c.add(60); c.arm(); c.reset(); ok('reset clears value + ARMED', c.chaosValue === 0 && !c.chaosArmed);
  c = mk(); c.arm(); c.step(0.2, ctx({})); c.step(0.05, ctx({ danger: true })); ok('hold restarts when the road becomes unsafe', c.step(0.2, ctx({})) === false);
  const P = { lane: 1, y: 600, h: 56 }, V = (lane, y) => ({ lane, y, laneT: 1, laneFrom: lane, dead: false, abducted: false });
  ok('road: empty = readable', (() => { const r = mk().assessRoad([], P, 300); return !r.boxedIn && !r.danger; })());
  ok('road: cars in all three reachable lanes = boxed in', mk().assessRoad([V(0, 560), V(1, 540), V(2, 570)], P, 300).boxedIn);
  ok('road: car just ahead in own lane = danger', mk().assessRoad([V(1, 520)], P, 300).danger);
  ok('road: far-ahead car is not danger', !mk().assessRoad([V(1, 100)], P, 300).danger);
}

section('near-miss paths: normal +8 vs very tight +12');
{
  const { B420 } = load([...CORE, 'src/systems/CollisionSystem.js', 'src/systems/ChaosSystem.js'], {});
  const A = B420.CONFIG.CHAOS_AWARD;
  const player = { lane: 1, bounds: () => ({ x: 100, y: 580, w: 34, h: 56 }) }; // centre y = 608
  const pass = (centreY) => {
    const v = { lane: 2, dead: false, abducted: false, nearMissTriggered: false, bounds: () => ({ x: 200, y: centreY - 27, w: 32, h: 54 }) };
    return new B420.CollisionSystem().checkNearMisses(0.016, player, [v]).events;
  };
  const normal = pass(608 + 20), tight = pass(608 + 3);
  ok('detector: centre gap ~20 = normal near miss', normal.length === 1 && normal[0].tight === false);
  ok('detector: centre gap ~3 = very tight near miss', tight.length === 1 && tight[0].tight === true);
  ok('detector: far car = no near miss', pass(608 + 200).length === 0);
  // same mapping main.js uses: e.tight ? tightMiss : nearMiss
  const gain = (ev, tier, blaze) => { const c = new B420.ChaosSystem(); return c.award(ev.tight ? A.tightMiss : A.nearMiss, tier, blaze); };
  const near = (x) => Math.abs(x - Math.round(x * 10) / 10) < 1e-9;
  for (const [label, ev, tier, blaze, want] of [
    ['normal x1', normal[0], 1, false, 8], ['tight x1', tight[0], 1, false, 12],
    ['normal HEAT x3', normal[0], 3, false, 9.6], ['tight HEAT x3', tight[0], 3, false, 14.4],
    ['normal BLAZE x1', normal[0], 1, true, 10], ['tight BLAZE x1', tight[0], 1, true, 15]]) {
    const g = gain(ev, tier, blaze); ok('CHAOS ' + label + ' = +' + want, Math.abs(g - want) < 1e-9 && near(g), String(g));
  }
  ok('main maps tight -> tightMiss(12), normal -> nearMiss(8)', /e\.tight \? B420\.CONFIG\.CHAOS_AWARD\.tightMiss : B420\.CONFIG\.CHAOS_AWARD\.nearMiss/.test(main));
}

section('Enter = RETRY (game over only)');
{
  const t = load([...CORE, 'src/core/InputManager.js'], {}), handlers = {};
  t.ctx.addEventListener = (type, fn) => { handlers[type] = fn; };
  const input = new t.B420.InputManager();
  let state = 'GAME_OVER', restarts = 0, prevented = 0;
  input.bind({ onEnter: () => { if (state !== 'GAME_OVER') return false; restarts++; state = 'PLAYING'; return true; } });
  const key = (type, code) => handlers[type]({ code, preventDefault() { prevented++; } });
  key('keydown', 'Enter'); ok('Enter on game over restarts once', restarts === 1 && state === 'PLAYING');
  key('keydown', 'Enter'); ok('key repeat / Enter while playing does nothing', restarts === 1);
  key('keyup', 'Enter'); key('keydown', 'Enter'); ok('Enter ignored during PLAYING even after re-press', restarts === 1);
  state = 'GAME_OVER'; key('keyup', 'Enter'); key('keydown', 'NumpadEnter'); ok('NumpadEnter also retries', restarts === 2);
  ok('handled Enter prevents the focused button from double-firing', prevented >= 2);
  ok('main: Enter uses the same startRun as the RETRY button, only on the results screen', /onEnter: \(\) => \{\s*if \(gameState\.state !== B420\.STATES\.GAME_OVER \|\| !screens\.resultsEl\.classList\.contains\('show'\)\) return false;\s*startRun\(\);/.test(main) && /retryBtn\.addEventListener\('click', startRun\)/.test(main));
}

section('traffic personalities + relative motion');
{
  const { B420 } = load([...CORE, 'src/entities/Vehicle.js'], {});
  const T = B420.TYPE_CONFIG, types = ['sedan', 'pickup', 'muscle', 'grandma', 'cop'];
  ok('personality config for every vehicle type', types.every((k) => T[k] && T[k].speedFactor && T[k].followMult && T[k].passDelay != null && T[k].speedVar != null && T[k].varEvery));
  ok('every ordinary type moves visibly relative to the road (5-20% off marking speed)', types.every((k) => Math.abs(T[k].speedFactor - 1) >= 0.04 && Math.abs(T[k].speedFactor - 1) <= 0.2), types.map((k) => T[k].speedFactor).join());
  ok('grandma slowest, muscle fastest, sedan is the baseline in between', T.grandma.speedFactor < T.sedan.speedFactor && T.sedan.speedFactor < T.muscle.speedFactor && T.grandma.speedFactor < T.pickup.speedFactor && T.cop.speedFactor > T.sedan.speedFactor);
  ok('muscle follows closest + passes soonest; grandma follows furthest + rarely passes', T.muscle.followMult < T.sedan.followMult && T.sedan.followMult < T.grandma.followMult && T.muscle.passDelay < T.sedan.passDelay && T.sedan.passDelay < T.grandma.passDelay);
  ok('pickup drifts most, grandma/sedan least; only muscle surges', T.pickup.speedVar > T.sedan.speedVar && T.sedan.speedVar > T.grandma.speedVar && !!T.muscle.surge && !T.sedan.surge && !T.grandma.surge);
  // real simulated motion vs road markings (marking speed == scroll speed)
  const R = { height: 800, width: 400, time: 0, laneX: (l) => 50 + l * 100, laneWidth: () => 100 };
  const player = { lane: 3, y: 600, h: 56 };
  const rel = {};
  for (const k of types) {
    const v = new B420.Vehicle(k, 0, R, 0); v.copTimer = 999; const scroll = 300, dt = 1 / 60; let y0 = v.y;
    for (let i = 0; i < 60 * 8; i++) v.update(dt, scroll, player, [v]);
    rel[k] = (v.y - y0) / (scroll * 8) - 1;
  }
  ok('simulated: every type drifts down relative to the lane markings (not stationary)', types.every((k) => rel[k] > 0.03 && rel[k] < 0.22), JSON.stringify(rel));
  ok('simulated: grandma < sedan < muscle relative movement', rel.grandma < rel.sedan && rel.sedan < rel.muscle, JSON.stringify(rel));
  // geometry and drawing stay in sync: no render-only offset
  const v = new B420.Vehicle('pickup', 1, R, 100); for (let i = 0; i < 600; i++) v.update(1 / 60, 300, player, [v]);
  const bb = v.bounds(); ok('collision box centred on drawn position (x and y)', Math.abs(bb.x + bb.w / 2 - v.x) < 1e-9 && Math.abs(bb.y + bb.h / 2 - v.y) < 1e-9);
  const vsrc = read('src/entities/Vehicle.js'), drawSrc = vsrc.slice(vsrc.indexOf('  draw(ctx, t) {'), vsrc.indexOf('B420.Rival'));
  ok('Vehicle.draw uses only this.x/this.y (no render-only drift)', /ctx\.translate\(this\.x, this\.y\)/.test(drawSrc) && !/visualOffset|renderOffset|drawOffset|driftY/.test(vsrc));
  ok('no per-frame randomness in speed (drift uses timers/targets)', /speedModT/.test(vsrc) && !/speedFactor[^\n]*Math\.random\(\)/.test(vsrc));
  ok('lane changes still go through the shared safety gate (neighbors, reservations, escape corridor)', /_trafficNeighbor\(vehicles, this, l, true\)/.test(vsrc) && /_trafficNeighbor\(vehicles, this, l, false\)/.test(vsrc) && /_playerLaneClear/.test(vsrc) && /TRAFFIC_CHECK_AHEAD/.test(vsrc) && /TRAFFIC_CHECK_BEHIND/.test(vsrc));
  ok('personality only requests: no per-type avoidance code', !/this\.type === '(sedan|grandma|pickup)'[^\n]*(_trafficNeighbor|laneT)/.test(vsrc));
}

section('ChaosDirector (Pass 2A)');
{
  const { B420 } = load([...CORE, 'src/entities/Vehicle.js', 'src/systems/ChaosSystem.js', 'src/systems/ChaosDirector.js', 'src/systems/Event420System.js'], {});
  const E = B420.EVENTS, D = B420.ChaosDirector, pool = Object.keys(D.BASE), mk = () => new D();
  const base = { vehicles: 2, heatTier: 2, blazeActive: false };
  const evSrc = read('src/systems/Event420System.js'), dirSrc = read('src/systems/ChaosDirector.js');
  ok('ChaosDirector exists; event count starts at 0', typeof D === 'function' && mk().eventCount === 0);
  const d0 = mk();
  ok('tiers: 1-2 EARLY, 3-5 MID, 6+ LATE', [1, 2].every((n) => d0.tierFor(n) === 'EARLY') && [3, 4, 5].every((n) => d0.tierFor(n) === 'MID') && [6, 7, 20].every((n) => d0.tierFor(n) === 'LATE'));
  ok('next-selection tier follows events reached (0->EARLY, 2->MID, 5->LATE)', (() => { const d = mk(); const r = []; for (const n of [0, 1, 2, 5, 6]) { d.setCount(n); r.push(d.tier); } return r.join() === 'EARLY,EARLY,MID,LATE,LATE'; })());
  const registry = [...evSrc.matchAll(/type: B420\.EVENTS\.([A-Z0-9_]+)/g)].map((m) => E[m[1]]).sort();
  ok('Director pool == the existing Event420System registry (nothing invented)', registry.length === 17 && JSON.stringify([...pool].sort()) === JSON.stringify(registry), registry.join());
  ok('selection only ever returns existing events', Array.from({ length: 300 }, () => mk().select(base)).every((t) => pool.includes(t)));
  { const d = mk(); d.onStarted(E.UFO); d.onEnded(E.UFO);
    ok('immediate repeat has zero weight', d.weights(base)[E.UFO] === 0);
    ok('selection never immediately repeats (300 draws)', Array.from({ length: 300 }, () => d.select(base)).every((t) => t !== E.UFO));
    d.onStarted(E.MUNCHIES); d.onEnded(E.MUNCHIES);
    ok('the event before last is strongly discouraged', d.weights(base)[E.UFO] < D.BASE[E.UFO][1] * 0.3 && d.weights(base)[E.MUNCHIES] === 0); }
  { const d = mk(); d.onStarted(E.UFO); d.onEnded(E.UFO); d.weights = () => Object.fromEntries(pool.map((t) => [t, 0]));
    ok('all-zero weights still yields a valid, non-repeating fallback', Array.from({ length: 60 }, () => d.select(base)).every((t) => pool.includes(t) && t !== E.UFO)); }
  ok('dense traffic raises UFO weight over sparse', mk().weights({ ...base, vehicles: 6 })[E.UFO] > mk().weights({ ...base, vehicles: 0 })[E.UFO] * 3);
  ok('HEAT influences weights (high HEAT favors MOVING LINES)', mk().weights({ ...base, heatTier: 5 })[E.MOVING_LINES] > mk().weights({ ...base, heatTier: 1 })[E.MOVING_LINES]);
  ok('BLAZE active influences weights (favors HOT ROD swap)', mk().weights({ ...base, blazeActive: true })[E.HOT_ROD_SWAP] > mk().weights(base)[E.HOT_ROD_SWAP]);
  ok('tier shifts weights (LATE favors MOVING LINES over EARLY)', (() => { const e = mk(), l = mk(); l.setCount(6); return l.weights(base)[E.MOVING_LINES] > e.weights(base)[E.MOVING_LINES]; })());
  { const d = mk();
    ok('start records the event: count 1, active set', d.onStarted(E.UFO) && d.eventCount === 1 && d.activeType === E.UFO);
    ok('only one major event: canStart false, select null, second start refused', !d.canStart() && d.select(base) === null && d.onStarted(E.MUNCHIES) === false && d.eventCount === 1);
    d.onEnded(E.UFO); ok('completion clears active state', d.canStart() && d.activeType === null);
    d.reset(); ok('reset clears count, history, active', d.eventCount === 0 && d.history.length === 0 && d.activeType === null); }
  // full lifecycle with the real Event420System + ChaosSystem
  const tm = { setHotRodSkin() {}, spawnMunchie() {}, setEventMods() {}, clearEventMods() {} }, rend = { width: 400, height: 800 };
  const ev = new B420.Event420System(tm, rend, null), d = mk(), chaos = new B420.ChaosSystem();
  ev.onEnd = (t) => d.onEnded(t);
  ok('failed/unknown start does not count', d.tryStart('bogus', ev) === false && d.tryStart(null, ev) === false && d.eventCount === 0 && !ev.active);
  chaos.add(150); ok('CHAOS armed at 100', chaos.chaosArmed && chaos.chaosValue === 100);
  ok('launch starts the event, Director counts it', d.tryStart(E.UFO, ev) === true && d.eventCount === 1 && ev.active.type === E.UFO);
  chaos.onLaunched(); ok('event start resets CHAOS to 0 / clears ARMED', chaos.chaosValue === 0 && !chaos.chaosArmed);
  chaos.add(150);
  let early = false; for (let i = 0; i < 100; i++) early = early || chaos.step(0.05, { playing: true, boxedIn: false, danger: false, eventBusy: ev.isBusy() || !d.canStart() });
  ok('CHAOS re-arms during an active event and waits (no second launch)', chaos.chaosArmed && chaos.chaosValue === 100 && !early && d.eventCount === 1);
  let t = 0; while (ev.active && t < 60) { ev.update(0.1, 0, {}, []); t += 0.1; }
  ok('event completion clears active state and notifies the Director', !ev.active && d.activeType === null && d.canStart());
  let go = false; for (let i = 0; i < 40 && !go; i++) go = chaos.step(0.05, { playing: true, boxedIn: false, danger: false, eventBusy: ev.isBusy() || !d.canStart() });
  ok('second event launches only after the first finished AND the road is readable', go === true);
  ok('readable-window requirement still applies to the waiting meter', (() => { const c = new B420.ChaosSystem(); c.arm(); let f = false; for (let i = 0; i < 60; i++) f = f || c.step(0.05, { playing: true, boxedIn: true, danger: false, eventBusy: false }); return !f; })());
  const second = d.select(base), prevType = d.history[d.history.length - 1];
  ok('next pick avoids the event that just ran', second !== prevType && d.tryStart(second, ev) && d.eventCount === 2);
  ev.reset(); d.reset(); ok('run reset leaves no active event or Director state', !ev.active && ev.announcePhase === 0 && d.eventCount === 0 && d.activeType === null);
  ok('Director has no second traffic-safety model and no bypass', !/assessRoad|boxedIn|_playerLaneClear/.test(dirSrc));
}

section('Pass 2B-1: CHAOS SURVIVED, x4.20, convoy, cop panic, rush, UFO sweep');
{
  const t = load([...CORE, 'src/entities/Vehicle.js', 'src/systems/ScoreSystem.js', 'src/systems/ChaosSystem.js', 'src/systems/ChaosDirector.js', 'src/systems/Event420System.js', 'src/systems/SpawnManager.js', 'src/systems/TrafficManager.js'], {});
  const B420 = t.B420, E = B420.EVENTS, C = B420.CONFIG, D = B420.ChaosDirector;
  const R = { width: 400, height: 800, time: 0, laneX: (l) => 50 + l * 100, laneWidth: () => 100 };
  const mkEv = () => { const tm = new B420.TrafficManager(R), ev = new B420.Event420System(tm, R, null), d = new B420.ChaosDirector(); ev.onEnd = (x) => d.onEnded(x); return { tm, ev, d }; };
  const runOut = (ev, tmax = 40) => { let x = 0; while (ev.active && x < tmax) { ev.update(0.1, 0, {}, []); x += 0.1; } return x; };
  const share = (sp, type) => { let n = 0; for (let i = 0; i < 4000; i++) if (sp.pickType(120) === type) n++; return n / 4000; };
  const dur = (ev, type) => ev.registry.find((e) => e.type === type).duration;
  const evSrc = read('src/systems/Event420System.js'), vSrc = read('src/entities/Vehicle.js');

  // --- CHAOS SURVIVED +420 ---
  { const { ev } = mkEv(); ev.launch(E.GRANDMA_CONVOY); runOut(ev); const n1 = ev.survivedCount; for (let i = 0; i < 50; i++) ev.update(0.1, 0, {}, []);
    ok('completed event counts as survived exactly once', n1 === 1 && ev.survivedCount === 1); }
  { const { ev } = mkEv(); ev.launch(E.COP_PANIC); ev.update(1, 0, {}, []); ev.reset(); ok('crash/Home/reset mid-event: no survival credit', ev.survivedCount === 0 && !ev.active);
    ev.launch(E.COP_PANIC); ev.update(1, 0, {}, []); ev.clear(); ok('aborted event: no survival credit', ev.survivedCount === 0); }
  { const sc = new B420.ScoreSystem(); sc.eventMult = C.X420_MULT; const b = sc.score; sc.addBonus(C.CHAOS_SURVIVE_SCORE, true);
    ok('+420 is flat: not multiplied by x4.20', C.CHAOS_SURVIVE_SCORE === 420 && Math.abs(sc.score - b - 420) < 1e-9);
    const b2 = sc.score; sc.addBonus(100); ok('ordinary bonuses ARE multiplied by x4.20', Math.abs(sc.score - b2 - 420) < 1e-6); }
  ok('main awards +420 once per completed event with a thin toast; old +1000 gone', /events\.survivedCount > survivedBefore\) \{\s*score\.addBonus\(B420\.CONFIG\.CHAOS_SURVIVE_SCORE, true\);[^\n]*\n\s*hud\.stageToast\('CHAOS SURVIVED \+'/.test(main) && !/EVENT_SURVIVE_SCORE|4:20 SURVIVED/.test(main + read('src/utils/constants.js')));

  // --- x4.20 ---
  { const { ev } = mkEv(); const d0 = dur(ev, E.X420);
    ok('x4.20 duration bounded to 4-6s', d0 >= 4 && d0 <= 6, String(d0));
    ok('idle multiplier is 1', ev.scoreMult() === 1);
    ev.launch(E.X420); ok('x4.20 active = 4.20', ev.scoreMult() === 4.2 && C.X420_MULT === 4.2);
    const sc = new B420.ScoreSystem(); sc.eventMult = ev.scoreMult(); sc.tick(1, 1, 1); ok('scoring actually multiplied (passive tick x4.2)', Math.abs(sc.score - C.SCORE_BASE_RATE * 4.2) < 1e-9);
    runOut(ev); ok('natural expiry restores x1', ev.scoreMult() === 1);
    ev.launch(E.X420); ev.reset(); ok('reset/crash/Home clears x4.20', ev.scoreMult() === 1);
    ev.launch(E.X420); ev.clear(); ok('abort clears x4.20', ev.scoreMult() === 1); }
  ok('x4.20 grants no invincibility; main syncs/clears the multiplier', !/invinc|immun|setCollision|collisionEnabled/i.test(evSrc) && /score\.eventMult = events\.scoreMult\(\)/.test(main) && /events\.reset\(\);\s*score\.eventMult = 1;/.test(main) && /if \(collisionEnabled\) \{/.test(main));

  // --- GRANDMA CONVOY ---
  { const { tm, ev } = mkEv(), sp = tm.spawner, base = share(sp, 'grandma');
    ok('convoy lasts 5-8s (major)', dur(ev, E.GRANDMA_CONVOY) >= 5 && dur(ev, E.GRANDMA_CONVOY) <= 8);
    ev.launch(E.GRANDMA_CONVOY); const during = share(sp, 'grandma');
    ok('convoy: grandma presence rises sharply', during > base * 2 && during > 0.4, base.toFixed(2) + ' -> ' + during.toFixed(2));
    runOut(ev); ok('convoy cleanup restores baseline spawn mix + rate', Math.abs(share(sp, 'grandma') - base) < 0.04 && sp.mods.intervalMult === 1 && Object.keys(sp.mods.typeBoost).length === 0);
    ok('baseline grandma personality untouched', B420.TYPE_CONFIG.grandma.speedFactor === 1.05 && B420.TYPE_CONFIG.grandma.passDelay === 5.0);
    const occ = (lanes) => lanes.map((l) => ({ dead: false, lane: l, y: 60, laneT: 1 }));
    ok('spawn safety: never fills the last open lane (no wall), even mid-event', sp.chooseSafeLane(occ([0, 1, 2]), []) === null && sp.chooseSafeLane(occ([0, 1]), []) !== null); }

  // --- COP PANIC ---
  { const { tm, ev } = mkEv(), sp = tm.spawner, base = share(sp, 'cop');
    ok('cop panic lasts 5-8s', dur(ev, E.COP_PANIC) >= 5 && dur(ev, E.COP_PANIC) <= 8);
    ev.launch(E.COP_PANIC); ok('cop panic: modifier on, more cops spawn', tm.mods.copPanic === true && share(sp, 'cop') > base * 3);
    const player = { lane: 3, y: 600, h: 56 };
    const timerAfter = (mods) => { const v = new B420.Vehicle('cop', 0, R, 100); v.copTimer = 0; v.update(0.016, 300, player, [v], mods); return v.copTimer; };
    ok('cop re-requests a move sooner under panic (<=2.2s vs >=3.5s)', timerAfter({ copPanic: true }) <= 2.2 && timerAfter({ copPanic: false }) >= 3.5);
    ok('panic only changes WHEN cops ask; moves still need the shared safety gate', /copPanic\) \? B420\.Utils\.randRange\(1\.2, 2\.2\)/.test(vSrc) && /_trafficNeighbor\(vehicles, this, l, true\)/.test(vSrc) && /_playerLaneClear/.test(vSrc) && !/copPanic[^\n]*(laneT = 0|this\.lane =)/.test(vSrc));
    runOut(ev); ok('cop panic cleanup restores baseline', tm.mods.copPanic === false && Math.abs(share(sp, 'cop') - base) < 0.03 && B420.TYPE_CONFIG.cop.speedFactor === 1.11); }

  // --- TRAFFIC RUSH ---
  { const { tm, ev } = mkEv(), sp = tm.spawner, base = sp.spawnInterval(60);
    ok('rush lasts 5-8s', dur(ev, E.TRAFFIC_RUSH) >= 5 && dur(ev, E.TRAFFIC_RUSH) <= 8);
    ev.launch(E.TRAFFIC_RUSH); ok('rush: spawn interval shortened (more traffic)', sp.spawnInterval(60) < base * 0.85, base + ' -> ' + sp.spawnInterval(60));
    runOut(ev); ok('rush cleanup restores the exact baseline cadence', sp.spawnInterval(60) === base);
    ev.launch(E.TRAFFIC_RUSH); ev.reset(); ok('reset mid-rush restores baseline', sp.spawnInterval(60) === base && !ev.active); }

  // --- UFO SWEEP ---
  { const { ev } = mkEv(); ev.launch(E.UFO_SWEEP);
    ok('sweep reuses the existing UFO class with stronger settings', /\[E\.UFO_SWEEP\]: \{[^}]*maxTargets: 5/.test(evSrc) && /new B420\.UFO\(this\.renderer, ufoOpts\)/.test(evSrc) && ev.ufo && ev.ufo.maxTargets > 1 && ev.ufo.beamDur < 0.6);
    const cars = Array.from({ length: 7 }, (_, i) => ({ dead: false, abducted: false, lane: i % 4, y: 90 + i * 45, laneT: 1 }));
    for (let i = 0; i < 80; i++) ev.update(0.1, 0, {}, cars);
    const taken = cars.filter((c) => c.abducted).length;
    ok('sweep removes several cars (3-5)', taken >= 3 && taken <= 5, String(taken));
    ok('sweep is bounded by its duration and cleans up its UFO', !ev.active && ev.ufo === null && dur(ev, E.UFO_SWEEP) <= 6);
    ok('UFO code can only target the traffic list (never the player)', !/player/i.test(vSrc.slice(vSrc.indexOf('B420.UFO = class')).replace(/\/\/[^\n]*/g, '')));
    ok('regular UFO unchanged (single slow abductions)', (() => { const e2 = mkEv().ev; e2.launch(E.UFO); return e2.ufo.maxTargets === Infinity && e2.ufo.beamDur === 0.6; })()); }

  // --- Director expansion ---
  { const pool = Object.keys(D.BASE), W = (c, n, ctx) => { const d = new D(); d.setCount(n); return d.weights(ctx); };
    const base = { vehicles: 2, heatTier: 2, blazeActive: false };
    ok('expanded Director pool includes the five new events', [E.GRANDMA_CONVOY, E.COP_PANIC, E.TRAFFIC_RUSH, E.UFO_SWEEP, E.X420].every((e) => pool.includes(e)) && pool.length === 17);
    const early = W(null, 0, base), mid = W(null, 2, base), late = W(null, 6, base);
    ok('EARLY: gentle mix + occasional convoy; no cop panic / rush / sweep yet', early[E.COP_PANIC] === 0 && early[E.TRAFFIC_RUSH] === 0 && early[E.UFO_SWEEP] === 0 && early[E.GRANDMA_CONVOY] > 0 && early[E.UFO] > 0 && early[E.MUNCHIES] > 0);
    ok('MID unlocks cop panic / rush / sweep', mid[E.COP_PANIC] > 0 && mid[E.TRAFFIC_RUSH] > 0 && mid[E.UFO_SWEEP] > 0);
    ok('LATE weights the aggressive events more than MID', late[E.COP_PANIC] > mid[E.COP_PANIC] && late[E.TRAFFIC_RUSH] > mid[E.TRAFFIC_RUSH] && late[E.UFO_SWEEP] > mid[E.UFO_SWEEP]);
    const dense = W(null, 2, { ...base, vehicles: 6 }), sparse = W(null, 2, { ...base, vehicles: 0 });
    ok('dense traffic favors clearing (UFO, UFO SWEEP) and avoids convoy/rush', dense[E.UFO_SWEEP] > sparse[E.UFO_SWEEP] * 5 && dense[E.UFO] > sparse[E.UFO] && dense[E.GRANDMA_CONVOY] < sparse[E.GRANDMA_CONVOY] && dense[E.TRAFFIC_RUSH] < sparse[E.TRAFFIC_RUSH]);
    ok('sparse traffic can favor pressure events (convoy, rush)', sparse[E.GRANDMA_CONVOY] > base_w(E.GRANDMA_CONVOY) && sparse[E.TRAFFIC_RUSH] > base_w(E.TRAFFIC_RUSH));
    function base_w(type) { return W(null, 2, base)[type]; }
    const hot = W(null, 2, { ...base, heatTier: 5 }), cool = W(null, 2, { ...base, heatTier: 1 });
    ok('high HEAT lifts cop panic + traffic rush', hot[E.COP_PANIC] > cool[E.COP_PANIC] && hot[E.TRAFFIC_RUSH] > cool[E.TRAFFIC_RUSH]);
    const tally = (n) => { const c = {}; for (let i = 0; i < 6000; i++) { const d = new D(); d.setCount(n); const x = d.select(base); c[x] = (c[x] || 0) + 1; } return c[E.X420] / 6000; };
    ok('x4.20 stays rare at every tier (<10%)', [0, 2, 6].every((n) => tally(n) < 0.10 && tally(n) > 0), [0, 2, 6].map((n) => tally(n).toFixed(3)).join());
    { const d = new D(); d.setCount(2); const clean = d.weights(base)[E.TRAFFIC_RUSH]; d.onStarted(E.COP_PANIC); d.onEnded(E.COP_PANIC);
      ok('pressure events are not chained back to back', d.weights(base)[E.TRAFFIC_RUSH] < clean * 0.5); }
    { const d = new D(); d.onStarted(E.X420); d.onEnded(E.X420); ok('repeat protection covers new events too', d.weights(base)[E.X420] === 0 && Array.from({ length: 200 }, () => d.select(base)).every((x) => x !== E.X420)); }
    { const { ev, d } = mkEv(), chaos = new B420.ChaosSystem(); d.tryStart(E.X420, ev); chaos.add(150);
      let early2 = false; for (let i = 0; i < 80; i++) early2 = early2 || chaos.step(0.05, { playing: true, boxedIn: false, danger: false, eventBusy: ev.isBusy() || !d.canStart() });
      ok('re-armed meter waits through x4.20, one major event at a time', chaos.chaosArmed && !early2 && !d.canStart() && d.select(base) === null);
      runOut(ev); ok('after x4.20 ends the waiting meter may launch the next event', d.canStart() && d.select(base) !== E.X420); }
    { const { tm, ev, d } = mkEv(); d.tryStart(E.TRAFFIC_RUSH, ev); const sc = new B420.ScoreSystem(); sc.eventMult = 4.2;
      ev.reset(); d.reset(); sc.reset(); ok('reset clears every event modifier + Director state', tm.spawner.mods.intervalMult === 1 && !tm.mods.copPanic && ev.scoreMult() === 1 && sc.eventMult === 1 && d.eventCount === 0 && d.activeType === null); }
  }
  ok('debug can force each new event', ['ev-grandma_convoy', 'ev-cop_panic', 'ev-traffic_rush', 'ev-ufo_sweep', 'ev-x420'].every((a) => read('src/ui/DebugPanel.js').includes(a)));
}

section('Pass 2B-2: ROAD DRUNK, STAMPEDE, GREENOUT, COP + UFO, MAYHEM, MELTDOWN, BLOWN');
{
  const t = load([...CORE, 'src/entities/Vehicle.js', 'src/systems/ChaosSystem.js', 'src/systems/ChaosDirector.js', 'src/systems/Event420System.js', 'src/systems/SpawnManager.js', 'src/systems/TrafficManager.js'], {});
  const B420 = t.B420, E = B420.EVENTS, C = B420.CONFIG, D = B420.ChaosDirector;
  const R = { width: 400, height: 800, time: 0, laneX: (l) => 50 + l * 100, laneWidth: () => 100 };
  const mkEv = () => { const tm = new B420.TrafficManager(R), ev = new B420.Event420System(tm, R, null), d = new B420.ChaosDirector(); ev.onEnd = (x) => d.onEnded(x); return { tm, ev, d }; };
  const runOut = (ev, veh, tmax = 40) => { let x = 0; while (ev.active && x < tmax) { ev.update(0.1, 0, {}, veh || []); x += 0.1; } return x; };
  const share = (sp, type) => { let n = 0; for (let i = 0; i < 4000; i++) if (sp.pickType(120) === type) n++; return n / 4000; };
  const dur = (ev, type) => ev.registry.find((e) => e.type === type).duration;
  const NEW = [E.ROAD_DRUNK, E.HOT_ROD_STAMPEDE, E.GREENOUT, E.COP_UFO, E.MUNCHIES_MAYHEM, E.ROAD_MELTDOWN, E.BLOWN];
  const evSrc = read('src/systems/Event420System.js'), art = read('src/render/VehicleArt.js'), rsrc = read('src/render/Renderer.js');
  const base = { vehicles: 2, heatTier: 2, blazeActive: false };
  const W = (n, ctx) => { const d = new D(); d.setCount(n); return d.weights(ctx || base); };

  { const { ev } = mkEv();
    ok('all seven events registered', NEW.every((n) => ev.registry.some((e) => e.type === n)));
    ok('durations bounded: drunk 4-6s, meltdown 5-8s, every new event <= 8s', dur(ev, E.ROAD_DRUNK) >= 4 && dur(ev, E.ROAD_DRUNK) <= 6 && dur(ev, E.ROAD_MELTDOWN) >= 5 && dur(ev, E.ROAD_MELTDOWN) <= 8 && NEW.every((n) => dur(ev, n) <= 8)); }

  // Director availability
  ok('new events never appear EARLY', NEW.every((n) => W(0)[n] === 0));
  ok('MID unlocks drunk / stampede / greenout only', [E.ROAD_DRUNK, E.HOT_ROD_STAMPEDE, E.GREENOUT].every((n) => W(2)[n] > 0) && [E.COP_UFO, E.MUNCHIES_MAYHEM, E.ROAD_MELTDOWN, E.BLOWN].every((n) => W(2)[n] === 0));
  ok('LATE unlocks all seven, heavier for drunk / stampede / greenout', NEW.every((n) => W(6)[n] > 0) && [E.ROAD_DRUNK, E.HOT_ROD_STAMPEDE, E.GREENOUT].every((n) => W(6)[n] > W(2)[n]));
  ok('LATE selection is valid and never deadlocks', Array.from({ length: 400 }, () => { const d = new D(); d.setCount(6); return d.select(base); }).every((x) => Object.keys(D.BASE).includes(x)));
  ok('every new event shows up in LATE draws (pool is not over-restricted)', (() => { const seen = new Set(); for (let i = 0; i < 6000; i++) { const d = new D(); d.setCount(6); seen.add(d.select(base)); } return NEW.every((n) => seen.has(n)); })());
  { const d = new D(); d.setCount(6); d.onStarted(E.GREENOUT); d.onEnded(E.GREENOUT); ok('repeat protection covers the new events', d.weights(base)[E.GREENOUT] === 0 && Array.from({ length: 200 }, () => d.select(base)).every((x) => x !== E.GREENOUT)); }
  const dense = W(6, { ...base, vehicles: 6 }), sparse = W(6, { ...base, vehicles: 0 }), hot = W(6, { ...base, heatTier: 5 }), cool = W(6, { ...base, heatTier: 1 }), blz = W(6, { ...base, blazeActive: true }), noBlz = W(6);
  ok('dense traffic: COP + UFO up, STAMPEDE down', dense[E.COP_UFO] > sparse[E.COP_UFO] && dense[E.HOT_ROD_STAMPEDE] < sparse[E.HOT_ROD_STAMPEDE]);
  ok('sparse traffic: STAMPEDE and MAYHEM gain weight', sparse[E.HOT_ROD_STAMPEDE] > noBlz[E.HOT_ROD_STAMPEDE] && sparse[E.MUNCHIES_MAYHEM] > noBlz[E.MUNCHIES_MAYHEM]);
  ok('high HEAT: BLOWN / MELTDOWN / STAMPEDE gain modest weight (<2x)', [E.BLOWN, E.ROAD_MELTDOWN, E.HOT_ROD_STAMPEDE].every((n) => hot[n] > cool[n] && hot[n] < cool[n] * 2));
  ok('BLAZE active: GREENOUT / ROAD DRUNK gain modest weight (<2x)', [E.GREENOUT, E.ROAD_DRUNK].every((n) => blz[n] > noBlz[n] && blz[n] < noBlz[n] * 2));

  // ROAD DRUNK / MELTDOWN: presentation only
  { const { ev } = mkEv(); ev.launch(E.ROAD_DRUNK); ev.update(1, 0, {}, []);
    ok('ROAD DRUNK level rises while active', ev.level(E.ROAD_DRUNK) > 0.9 && ev.level(E.ROAD_MELTDOWN) === 0);
    runOut(ev); ok('ROAD DRUNK cleanup: level back to 0', ev.level(E.ROAD_DRUNK) === 0 && !ev.active);
    ev.launch(E.ROAD_DRUNK); ev.reset(); ok('reset clears ROAD DRUNK', ev.level(E.ROAD_DRUNK) === 0); }
  const player = read('src/entities/Player.js'), input = read('src/core/InputManager.js');
  ok('steering untouched: Player/InputManager know nothing about events; lane positions (laneX) unchanged', !/events|sway|drunk|melt/i.test((player + input).replace(/\/\/[^\n]*/g, '')) && /laneX\(lane\) \{ return this\.laneWidth\(\) \* \(lane \+ 0\.5\); \}/.test(rsrc));
  ok('sway/melt only move the lane-marking lines (cars, collision, steering never read them)', /fx && fx\.sway\) x \+=/.test(rsrc) && /fx && fx\.melt/.test(rsrc) && !/fx\./.test(read('src/entities/Vehicle.js') + player + read('src/systems/CollisionSystem.js')));
  ok('MELTDOWN: exhaust level feeds flames only, never the shake', !/jitter[^\n]*exhaust|exhaust[^\n]*jitter/.test(art) && /const flameLvl = Math\.max\(fuel, player\.exhaust/.test(art) && /\+ fuel \* Math\.sin/.test(art));

  // GREENOUT / MELTDOWN / BLOWN levels + cleanup
  for (const type of [E.GREENOUT, E.ROAD_MELTDOWN, E.BLOWN]) {
    const { ev } = mkEv(); ev.launch(type); ev.update(1, 0, {}, []); const up = ev.level(type) > 0.9; runOut(ev); const a = ev.level(type) === 0 && !ev.active;
    ev.launch(type); ev.update(0.2, 0, {}, []); ev.clear(); ok(type + ': visible while active, cleaned on end and on clear', up && a && ev.level(type) === 0);
    ev.launch(type); ev.reset(); ok(type + ': reset clears it', ev.level(type) === 0 && !ev.active);
  }
  ok('GREENOUT filter and BLOWN/MELTDOWN exhaust are derived per frame and zeroed on reset', /canvas\.style\.filter = go > 0\.01 \?[^;]*: ''/.test(main) && /player\.blown = 0;\s*player\.exhaust = 0;/.test(main));
  ok('GREENOUT keeps the road readable (edge-weighted, bounded alpha, no blur)', /0\.05 \* level/.test(rsrc) && /0\.5 \* level/.test(rsrc) && !/blur\(/.test(rsrc + main));

  // HOT ROD STAMPEDE
  { const { tm, ev } = mkEv(), sp = tm.spawner, base0 = share(sp, 'muscle'), baseInt = sp.spawnInterval(60);
    const m = new B420.Vehicle('muscle', 0, R, 100), s = new B420.Vehicle('sedan', 1, R, 100); tm.vehicles.push(m, s);
    ev.launch(E.HOT_ROD_STAMPEDE);
    ok('stampede: muscle presence up, traffic a bit faster, muscles hot-rod styled', share(sp, 'muscle') > base0 * 2.5 && tm.mods.speedBoost > 0 && m.skinOverride === 'hotrod' && !s.skinOverride);
    const mv = (mods) => { const v = new B420.Vehicle('sedan', 0, R, 0); v.update(0.1, 300, { lane: 3, y: 600, h: 56 }, [v], mods); return v.y; };
    ok('speedBoost really moves cars faster (still through the same update)', mv({ speedBoost: 0.05 }) > mv({}) * 1.03);
    runOut(ev); ok('stampede cleanup restores spawn mix, cadence, speed and skins', Math.abs(share(sp, 'muscle') - base0) < 0.03 && sp.spawnInterval(60) === baseInt && tm.mods.speedBoost === 0 && !tm.mods.muscleSkin && !m.skinOverride);
    ok('baseline TYPE_CONFIG untouched', B420.TYPE_CONFIG.muscle.speedFactor === 1.16 && B420.TYPE_CONFIG.sedan.speedFactor === 1.08); }

  // COP + UFO (one compound event)
  { const { tm, ev, d } = mkEv(), sp = tm.spawner, baseCop = share(sp, 'cop');
    ok('COP + UFO is a single Director event', d.tryStart(E.COP_UFO, ev) && d.activeType === E.COP_UFO && ev.active.type === E.COP_UFO && d.eventCount === 1 && d.select(base) === null);
    ok('both halves run: cop pressure + a UFO', tm.mods.copPanic === true && share(sp, 'cop') > baseCop * 2.5 && ev.ufo && ev.ufo.maxTargets === 3);
    const cars = Array.from({ length: 6 }, (_, i) => ({ dead: false, abducted: false, lane: i % 4, y: 100 + i * 40, laneT: 1 }));
    for (let i = 0; i < 90; i++) ev.update(0.1, 0, {}, cars);
    const taken = cars.filter((c) => c.abducted).length; ok('UFO half removes traffic (1-3 cars), only from the traffic list', taken >= 1 && taken <= 3, String(taken));
    ok('cleanup resets BOTH parts', !ev.active && ev.ufo === null && tm.mods.copPanic === false && Math.abs(share(sp, 'cop') - baseCop) < 0.03 && d.activeType === null); }

  // MUNCHIES MAYHEM
  { const { tm, ev } = mkEv(); let spawned = 0; const orig = tm.spawnMunchie.bind(tm); tm.spawnMunchie = (l) => { spawned++; orig(l); };
    const firstSeconds = (type, secs) => { tm.pickups.length = 0; spawned = 0; ev.launch(type); for (let i = 0; i < secs * 10; i++) ev.update(0.1, 0, {}, []); return spawned; };
    const normal = firstSeconds(E.MUNCHIES, 4); ev.clear(); const mayhem = firstSeconds(E.MUNCHIES_MAYHEM, 4); let peak = tm.pickups.filter((p) => p.kind === 'munchie').length;
    for (let i = 0; i < 40; i++) { ev.update(0.1, 0, {}, []); peak = Math.max(peak, tm.pickups.filter((p) => p.kind === 'munchie').length); }
    ok('MAYHEM drops snacks at least as fast as MUNCHIES, reaches the 6-on-road cap, never exceeds it', mayhem >= normal && peak === 6, normal + ' vs ' + mayhem + ' peak ' + peak);
    runOut(ev, []); ok('MAYHEM cleanup: event ends cleanly', !ev.active && ev.level(E.MUNCHIES_MAYHEM) === 0);
    tm.pickups.length = 0; ev.launch(E.MUNCHIES_MAYHEM); const wall = [0, 1, 2, 3].map((l) => ({ dead: false, lane: l, y: 100 })); for (let i = 0; i < 40; i++) ev.update(0.1, 0, {}, wall);
    ok('MAYHEM never drops snacks into lanes with traffic (no object spam in the cars)', tm.pickups.filter((p) => p.kind === 'munchie').length === 0); }

  // all-event reset + safety
  for (const type of NEW) { const { tm, ev } = mkEv(); ev.launch(type); ev.update(0.3, 0, {}, []); ev.reset();
    ok(type + ': reset leaves no modifiers/visuals/UFO', !ev.active && ev.ufo === null && ev.level(type) === 0 && tm.mods.copPanic === false && tm.mods.speedBoost === 0 && !tm.mods.muscleSkin && tm.spawner.mods.intervalMult === 1 && Object.keys(tm.spawner.mods.typeBoost).length === 0 && ev.scoreMult() === 1); }
  ok('no event bypasses centralized traffic safety (events never touch lanes; spawns go through chooseSafeLane)', !/\.lane\s*=(?!=)|targetLane|laneT|laneFrom/.test(evSrc) && /chooseSafeLane\(this\.vehicles, this\.pickups\)|chooseSafeLane\(vehicles, pickups\)/.test(read('src/systems/SpawnManager.js')) && /if \(free\.length <= 1\) return null/.test(read('src/systems/SpawnManager.js')));
  ok('debug can force all seven', ['road_drunk', 'hot_rod_stampede', 'greenout', 'cop_ufo', 'munchies_mayhem', 'road_meltdown', 'blown'].every((a) => read('src/ui/DebugPanel.js').includes('ev-' + a)));
}

section('results label + first-time tip');
{
  const scr = read('src/ui/Screens.js');
  ok('results say CHAOS EVENTS (not 420 EVENTS)', /'CHAOS EVENTS'/.test(scr) && !/420 EVENTS/.test(scr + read('README.md') + main));
  ok('CHAOS EVENTS counts events that began (Director count), not armed/filled', /events420Survived = director\.eventCount/.test(main));
  { const d = new (load([...CORE, 'src/systems/ChaosDirector.js'], {}).B420.ChaosDirector)(); d.onStarted('ufo'); ok('count increments only on a real start', d.eventCount === 1); }
  const store = {}, t = load(CORE, store), T = t.B420.Tips;
  ok('tip not seen at first', T.seen('chaos_tip') === false);
  T.mark('chaos_tip'); ok('tip shows once: marked + persisted under its own key', T.seen('chaos_tip') === true && JSON.parse(store['route420_tips_v1']).chaos_tip === true);
  store['burnout420_save_v1'] = JSON.stringify({ bestScore: 777 }); T.mark('other'); ok('tip storage never touches the HI key', JSON.parse(store['burnout420_save_v1']).bestScore === 777 && T.KEY !== t.B420.Storage.KEY);
  store['route420_tips_v1'] = 'garbage{'; ok('corrupt tip storage is safe', (() => { try { return T.seen('zzz') === false; } catch (e) { return false; } })());
  { const ctx = { localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, console, Math, JSON, Number, String, Object, Array, Set, Infinity }; ctx.window = ctx; vm.createContext(ctx);
    for (const f of CORE) vm.runInContext(read(f), ctx, { filename: f });
    const TT = ctx.B420.Tips; let threw = false, first, second; try { first = TT.seen('chaos_tip'); TT.mark('chaos_tip'); second = TT.seen('chaos_tip'); } catch (e) { threw = true; }
    ok('without localStorage: no crash, still once per session', !threw && first === false && second === true); }
  ok("main shows 'RECKLESS DRIVING BUILDS CHAOS' once via the existing toast, gated by Tips; no modal/pause", /function chaosTip\(\) \{[^}]*Tips\.seen\('chaos_tip'\)\) return;[^}]*Tips\.mark\('chaos_tip'\);[^}]*hud\.stageToast\('RECKLESS DRIVING BUILDS CHAOS'\)/.test(main) && /chaos\.chaosValue - chaosBefore >= 4\) chaosTip\(\)/.test(main));
}

section('420 CHAOS wiring + HUD');
{
  const hud = read('src/ui/HUD.js'), ev = read('src/systems/Event420System.js'), dbg = read('src/ui/DebugPanel.js'), ci = fs.existsSync(path.join(root, '.github/workflows/ci.yml')) ? read('.github/workflows/ci.yml') : '';
  ok('420 CHAOS HUD slot + meter exist', /420 CHAOS/.test(hud) && /chaosFill/.test(hud) && /ARMED/.test(hud));
  ok('CHAOS has its own full-width HUD row with state levels', /hud-row-chaos/.test(hud) && /chaos-meter/.test(hud) && /chaosState/.test(hud) && /\.hud-row-chaos/.test(css) && /chaos-mid/.test(css) && /chaos-high/.test(css));
  ok('old 4:20 countdown HUD is gone', !/4:20 IN|next420|nextEventIn/.test(hud + main) && !/hud-next420/.test(css));
  ok('old fixed-time trigger removed', !/nextTriggerTime|FIRST_420_TIME/.test(ev + main) && !/skip420|onSkipTo420/.test(dbg + main));
  ok('armed launch goes through the Director (select -> events.launch -> record), then CHAOS resets', /director\.tryStart\(director\.select\(directorCtx\(\)\), events\)\) chaos\.onLaunched\(\)/.test(main) && /launch\(type\) \{/.test(ev) && !/launchChaosEvent|forceTrigger/.test(ev + main));
  ok('launch still waits for readable road + no active event/rival', /chaos\.step\(dt, \{[^}]*boxedIn[^}]*danger[^}]*eventBusy: events\.isBusy\(\) \|\| !director\.canStart\(\) \|\| trafficManager\.rivalActive/.test(main));
  ok('CHAOS awards wired: near/tight miss, thread, rival, BLAZE pickup', ['tightMiss', 'nearMiss', 'thread', 'rival', 'blaze'].every((k) => new RegExp('chaos\\.award\\([^;]*CHAOS_AWARD\\.' + k).test(main)));
  ok('CHAOS + Director + event reset on run start / crash / Home', ['startRun', 'triggerCollision', 'goHome'].every((f) => /clearChaos\(\)/.test(fnBody(f))) && /function clearChaos\(\) \{[^}]*chaos\.reset\(\);[^}]*director\.reset\(\);[^}]*events\.reset\(\);/.test(main));
  ok('debug: CHAOS 25/50/99/100, ARM, RESET', ['chaos-25', 'chaos-50', 'chaos-99', 'chaos-100', 'chaos-arm', 'chaos-reset'].every((a) => dbg.includes(a)));
  ok('CI: push main + PR, Node 24.x, npm test + build only', /branches: \[main\]/.test(ci) && /pull_request/.test(ci) && /24\.x/.test(ci) && /run: npm test/.test(ci) && /run: npm run build/.test(ci) && !/vercel|deploy|lint|coverage/i.test(ci));
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ': ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
