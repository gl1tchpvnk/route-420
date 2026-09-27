// Produces a single self-contained HTML file with every script and the
// stylesheet inlined. Not required to run the game (index.html + src/ works
// fine as-is via any static server) — this is only for contexts that need
// one portable file, e.g. embedding or sharing a single-file build.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const LOAD_ORDER = [
  'src/utils/constants.js',
  'src/utils/utils.js',
  'src/audio/AudioManager.js',
  'src/core/GameState.js',
  'src/core/InputManager.js',
  'src/render/VehicleArt.js',
  'src/render/ParticleSystem.js',
  'src/render/Renderer.js',
  'src/entities/Player.js',
  'src/entities/Vehicle.js',
  'src/systems/SpawnManager.js',
  'src/systems/TrafficManager.js',
  'src/systems/CollisionSystem.js',
  'src/systems/HeatSystem.js',
  'src/systems/BlazeSystem.js',
  'src/systems/EscalationSystem.js',
  'src/systems/Event420System.js',
  'src/systems/ScoreSystem.js',
  'src/ui/HUD.js',
  'src/ui/Screens.js',
  'src/ui/TouchControls.js',
  'src/ui/DebugPanel.js',
  'src/main.js'
];

const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = LOAD_ORDER
  .map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
<title>BURNOUT 4:20</title>
<meta name="description" content="A fast, filthy little arcade driving game. Drive stupid." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
  <div id="app">
    <div id="game-frame">
      <canvas id="game-canvas"></canvas>
      <div id="ui-layer"></div>
    </div>
  </div>
  <script>
${js}
  </script>
</body>
</html>
`;

const outDir = path.join(root, 'bundled');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'burnout-420.bundle.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote single-file bundle to', outPath, `(${(html.length / 1024).toFixed(1)} KB)`);
