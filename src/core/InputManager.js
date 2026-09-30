// Keyboard input + hooks touch controls call into directly
window.B420 = window.B420 || {};

B420.InputManager = class InputManager {
  constructor() {
    this._onLeft = null;
    this._onRight = null;
    this._onBlaze = null;
    this._onPause = null;
    this._down = {};
    window.addEventListener('keydown', (e) => this._keydown(e));
    window.addEventListener('keyup', (e) => this._keyup(e));
  }

  bind({ onLeft, onRight, onBlaze, onPause }) {
    this._onLeft = onLeft || null;
    this._onRight = onRight || null;
    this._onBlaze = onBlaze || null;
    this._onPause = onPause || null;
  }

  _keydown(e) {
    if (this._down[e.code]) {
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowUp'].includes(e.code)) e.preventDefault();
      return;
    }
    this._down[e.code] = true;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': this._onLeft && this._onLeft(); e.preventDefault(); break;
      case 'ArrowRight': case 'KeyD': this._onRight && this._onRight(); e.preventDefault(); break;
      case 'Space': case 'ArrowUp': this._onBlaze && this._onBlaze(); e.preventDefault(); break;
      case 'KeyP': case 'Escape': this._onPause && this._onPause(); e.preventDefault(); break;
    }
  }

  _keyup(e) { this._down[e.code] = false; }

  triggerLeft() { this._onLeft && this._onLeft(); }
  triggerRight() { this._onRight && this._onRight(); }
  triggerBlaze() { this._onBlaze && this._onBlaze(); }
  triggerPause() { this._onPause && this._onPause(); }
};
