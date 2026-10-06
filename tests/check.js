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

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ': ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
