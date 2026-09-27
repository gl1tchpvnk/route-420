// Large-target touch controls for mobile. Desktop keyboard still works fully
// without these; they call the same InputManager trigger methods.
window.B420 = window.B420 || {};

B420.TouchControls = class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch-controls';
    this.el.innerHTML = `
      <button class="tc-btn tc-left" data-el="left" aria-label="Move left">◀</button>
      <button class="tc-blaze" data-el="blaze" aria-label="Blaze">BLAZE</button>
      <button class="tc-btn tc-right" data-el="right" aria-label="Move right">▶</button>
    `;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });

    this._bindTap(this.refs.left, () => this.input.triggerLeft());
    this._bindTap(this.refs.right, () => this.input.triggerRight());
    this._bindTap(this.refs.blaze, () => this.input.triggerBlaze());

    this.el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  _bindTap(node, fn) {
    let handled = false;
    node.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handled = true;
      node.classList.add('pressed');
      fn();
    }, { passive: false });
    node.addEventListener('touchend', (e) => {
      e.preventDefault();
      node.classList.remove('pressed');
    }, { passive: false });
    node.addEventListener('click', (e) => {
      if (handled) { handled = false; return; }
      fn();
    });
  }

  setBlazeReady(ready) { this.refs.blaze.classList.toggle('ready', ready); }
  show(v) { this.el.style.display = v ? '' : 'none'; }
};
