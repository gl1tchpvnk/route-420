// Produces ONE self-contained HTML file (scripts + stylesheet inlined) derived
// from index.html, so the script order lives in a single place. Not needed to
// run the game — index.html + src/ works as-is on any static host.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map((f) => `/* ---- ${f} ---- */\n${read(f)}`).join('\n\n');

html = html
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .replace('<link rel="stylesheet" href="style.css" />', () => `<style>\n${read('style.css')}\n</style>`)
  .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);

const outDir = path.join(root, 'bundled');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'route-420.bundle.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath, `(${(html.length / 1024).toFixed(1)} KB, ${scripts.length} scripts inlined)`);
