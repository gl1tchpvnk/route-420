// Zero-dependency "build": this project ships no bundler, so building just
// means producing a clean, deployable copy of the static source in dist/.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const SKIP = new Set(['node_modules', 'dist', '.git', 'tools', '.github', 'bundled']);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
copyDir(root, dist);
console.log('Built static site to ./dist (deploy this folder as-is).');
