// Only ever instantiated when ?debug=true is present (checked in main.js) —
// normal players never get this DOM at all, not just CSS-hidden.
window.B420 = window.B420 || {};

B420.DebugPanel = class DebugPanel {
  constructor(root, hooks) {
    this.hooks = hooks;
    this.collisionOn = true;
    this.el = document.createElement('div');
    this.el.className = 'debug-panel';
    this.el.innerHTML = `
      <div class="debug-title">DEBUG</div>
      <button data-act="blaze">Fill + Activate BLAZE</button>
      <div class="debug-sub">420 events</div>
      <button data-act="ev-green_fog">Green Fog</button>
      <button data-act="ev-hot_rod_swap">Hot Rod Swap</button>
      <button data-act="ev-ufo">UFO</button>
      <button data-act="ev-munchies">Munchies</button>
      <button data-act="ev-moving_lines">Moving Lines</button>
      <button data-act="skip420">Skip timer to ~4:20</button>
      <div class="debug-sub">Force spawn</div>
      <button data-act="sp-sedan">Sedan</button>
      <button data-act="sp-pickup">Pickup</button>
      <button data-act="sp-muscle">Muscle</button>
      <button data-act="sp-grandma">Grandma</button>
      <button data-act="sp-cop">Cop</button>
      <button data-act="rival">Force Rival</button>
      <div class="debug-sub">Other</div>
      <button data-act="heat">Max HEAT</button>
      <button data-act="score">+5000 score</button>
      <label class="debug-toggle"><input type="checkbox" checked data-el="collisionToggle"> collision on</label>
      <div class="debug-readout" data-el="readout"></div>
    `;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });

    this.el.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this._act(btn.dataset.act));
    });
    this.refs.collisionToggle.addEventListener('change', (e) => {
      this.collisionOn = e.target.checked;
      this.hooks.onToggleCollision && this.hooks.onToggleCollision(this.collisionOn);
    });
  }

  _act(act) {
    if (act === 'blaze') this.hooks.onForceBlaze && this.hooks.onForceBlaze();
    else if (act.startsWith('ev-')) this.hooks.onForceEvent && this.hooks.onForceEvent(act.slice(3));
    else if (act === 'skip420') this.hooks.onSkipTo420 && this.hooks.onSkipTo420();
    else if (act.startsWith('sp-')) this.hooks.onForceSpawn && this.hooks.onForceSpawn(act.slice(3));
    else if (act === 'rival') this.hooks.onForceRival && this.hooks.onForceRival();
    else if (act === 'heat') this.hooks.onMaxHeat && this.hooks.onMaxHeat();
    else if (act === 'score') this.hooks.onAddScore && this.hooks.onAddScore(5000);
  }

  updateReadout(text) { this.refs.readout.textContent = text; }
};
