# ROUTE 420

A fast arcade driving game about hot rods, near misses, HEAT, and BLAZE.

Drive recklessly — near misses and tight passes build HEAT, multiplying your risk bonuses up to x5. Collect green leaf pickups to fill the BLAZE meter, then pop it for a short burst of chaos and bonus score. Grab a jerry can for a few seconds of FUEL: a faster road and x1.5 scoring, with collisions fully live. Your best score is kept on this device as HI. Survive to 4:20 and Route 420 fires one randomized event that flips the road on its head for the rest of the run.

## Controls

**Desktop**
- `← / A` — left
- `→ / D` — right
- `SPACE / ↑` — BLAZE (once the meter's full)
- `P / ESC` — pause

**Mobile**
- Touch controls for LEFT, RIGHT, and BLAZE, plus PAUSE/HOME buttons in the HUD.

## Run locally

Requires Node.js 16+ (only to run a zero-dependency static file server — no build tools, no npm packages).

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to `http://localhost:5173`). `npm install` is a no-op — the project has zero dependencies — it's there for a normal-feeling workflow.

## Production build

```
npm run build
```

This project ships no bundler — everything is plain HTML/CSS/JS loaded via `<script>` tags. `npm run build` just copies the static source into `dist/`, ready to deploy as-is.

## Debug mode

Visit with `?debug=true` (e.g. `http://localhost:5173/?debug=true`) to get a small panel in the top-right corner with:
- Instantly fill + activate BLAZE
- Force-trigger any of the 5 randomized 4:20 events
- Skip the run timer to just before 4:20
- Force-spawn any traffic type or the rival hot rod
- Max out HEAT, add score, and toggle collision off

It's only ever created when the query param is present — normal players never get this DOM at all.

## Project structure

```
index.html              Canvas + UI mount points, loads every script in order
style.css                All styling (single file)
src/
  utils/                 constants.js (all tuning values/palette), utils.js (math + save data)
  audio/AudioManager.js  Procedural WebAudio sound effects (no audio files)
  core/                  GameState.js (state machine + run stats), InputManager.js (keyboard)
  entities/              Player.js, Vehicle.js (traffic + Rival + UFO)
  render/                Renderer.js (canvas/road), VehicleArt.js (all procedural vehicle art),
                          ParticleSystem.js
  systems/                SpawnManager, TrafficManager, CollisionSystem, HeatSystem, BlazeSystem,
                          EscalationSystem, Event420System, ScoreSystem
  ui/                     HUD.js, Screens.js (menu + results), TouchControls.js, DebugPanel.js
  main.js                 Wires everything together and runs the game loop
tools/                    dev-server.js, build.js, bundle.js (dev tooling, not shipped to players)
```

There's no framework and no bundler — every file attaches its classes to a shared `window.B420` namespace and loads via a plain `<script src="...">` tag in `index.html`, in dependency order. That also makes `tools/bundle.js` trivial: it concatenates the same files in the same order into one portable HTML file if you ever need a single-file build.

## GitHub deployment

This is a static site, so any static host works with no build configuration:

- **GitHub Pages:** Settings → Pages → deploy from the `main` branch, root folder. No build step needed since everything is already plain files. All paths are relative, so it also works from a project subpath such as `https://<user>.github.io/route-420/`.
- **Vercel / Netlify:** Import the repo, leave the build command empty (or `npm run build`) and set the output/publish directory to `dist` (or the repo root if you skip building).

## Notes

- No API keys, secrets, or environment variables of any kind are required.
- Best score, longest run, and highest HEAT tier persist locally via `localStorage`.
