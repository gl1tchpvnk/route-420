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
  return { B420: ctx.B420, writes: () => writes, resetWrites: () => { writes = 0; } };
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

section('420 CHAOS wiring + HUD');
{
  const hud = read('src/ui/HUD.js'), ev = read('src/systems/Event420System.js'), dbg = read('src/ui/DebugPanel.js'), ci = fs.existsSync(path.join(root, '.github/workflows/ci.yml')) ? read('.github/workflows/ci.yml') : '';
  ok('420 CHAOS HUD slot + meter exist', /420 CHAOS/.test(hud) && /chaosFill/.test(hud) && /ARMED/.test(hud));
  ok('old 4:20 countdown HUD is gone', !/4:20 IN|next420|nextEventIn/.test(hud + main) && !/hud-next420/.test(css));
  ok('old fixed-time trigger removed', !/nextTriggerTime|FIRST_420_TIME/.test(ev + main) && !/skip420|onSkipTo420/.test(dbg + main));
  ok('armed launch fires the existing UFO event', /launchChaosEvent\(\)\s*\{\s*this\.forceTrigger\(B420\.EVENTS\.UFO\)/.test(ev) && /events\.launchChaosEvent\(\);\s*chaos\.onLaunched\(\)/.test(main));
  ok('launch waits for readable road + no active event/rival', /chaos\.step\(dt, \{[^}]*boxedIn[^}]*danger[^}]*eventBusy: events\.isBusy\(\) \|\| trafficManager\.rivalActive/.test(main));
  ok('CHAOS awards wired: near/tight miss, thread, rival, BLAZE pickup', ['tightMiss', 'nearMiss', 'thread', 'rival', 'blaze'].every((k) => new RegExp('chaos\\.award\\([^;]*CHAOS_AWARD\\.' + k).test(main)));
  ok('CHAOS reset on run start / crash / Home', ['startRun', 'triggerCollision', 'goHome'].every((f) => /chaos\.reset\(\)/.test(fnBody(f))));
  ok('debug: CHAOS 25/50/99/100, ARM, RESET', ['chaos-25', 'chaos-50', 'chaos-99', 'chaos-100', 'chaos-arm', 'chaos-reset'].every((a) => dbg.includes(a)));
  ok('CI: push main + PR, Node 24.x, npm test + build only', /branches: \[main\]/.test(ci) && /pull_request/.test(ci) && /24\.x/.test(ci) && /run: npm test/.test(ci) && /run: npm run build/.test(ci) && !/vercel|deploy|lint|coverage/i.test(ci));
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ': ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
