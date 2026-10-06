// On-screen LEFT / BLAZE / RIGHT, built on pointer events (one input path for mouse/touch/pen).
// Shown on every device whenever the game is PLAYING (game state only; never device-based).
// Keyboard input stays available at the same time.
window.B420 = window.B420 || {};

B420.TouchControls = class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch-controls';
    this.el.innerHTML = `
      <button class="tc-btn tc-left" data-el="left" aria-label="Move left"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 5 12l10 8z"/></svg><span>LEFT</span></button>
      <button class="tc-btn tc-blaze" data-el="blaze" aria-label="Blaze" aria-disabled="true"><span>BLAZE</span></button>
      <button class="tc-btn tc-right" data-el="right" aria-label="Move right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l10 8-10 8z"/></svg><span>RIGHT</span></button>
    `;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });

    this._bind(this.refs.left, () => this.input.triggerLeft());
    this._bind(this.refs.right, () => this.input.triggerRight());
    this._bind(this.refs.blaze, () => this.input.triggerBlaze());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // One action per press (pointerdown only, no click fallback => no double trigger).
  _bind(node, fn) {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      node.classList.add('pressed');
      fn();
    });
    const release = () => node.classList.remove('pressed');
    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', release);
    node.addEventListener('pointerleave', release);
  }

  // BLAZE button: fills with meter progress; solid + pulsing when ready.
  setBlaze(fraction, ready) {
    this.refs.blaze.style.setProperty('--p', String(fraction));
    this.refs.blaze.classList.toggle('ready', ready);
    this.refs.blaze.dataset.state = ready ? 'ready' : (fraction > 0.001 ? 'charging' : 'empty');
    this.refs.blaze.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  setActive(v) { this.el.classList.toggle('active', v); }
};
