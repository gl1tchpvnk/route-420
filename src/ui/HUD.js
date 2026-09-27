// DOM-based HUD overlay drawn on top of the canvas.
window.B420 = window.B420 || {};

B420.HUD = class HUD {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-score">
          <span class="hud-label">SCORE</span>
          <span class="hud-value" data-el="score">0</span>
        </div>
        <div class="hud-time" data-el="time">0:00</div>
        <div class="hud-next420" data-el="next420">4:20 IN <span data-el="next420Val">4:20</span></div>
        <button class="hud-pause" data-el="pauseBtn" aria-label="Pause">II</button>
      </div>
      <div class="hud-mid">
        <div class="heat-row">
          <span class="hud-label">HEAT</span>
          <span class="heat-value" data-el="heatValue">x1</span>
          <div class="heat-bar"><div class="heat-bar-fill" data-el="heatFill"></div></div>
        </div>
        <div class="blaze-row">
          <span class="hud-label">BLAZE</span>
          <div class="blaze-bar"><div class="blaze-bar-fill" data-el="blazeFill"></div></div>
        </div>
      </div>
      <div class="popup-layer" data-el="popups"></div>
      <div class="event-banner" data-el="eventBanner"></div>
      <div class="stage-toast" data-el="stageToast"></div>
    `;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });
    this._popupId = 0;
  }

  show(v) { this.el.style.display = v ? '' : 'none'; }

  bindPause(fn) { this.refs.pauseBtn.addEventListener('click', fn); }

  update(gameState, heat, blaze, nextEventIn) {
    this.refs.score.textContent = Math.floor(gameState.score).toLocaleString();
    this.refs.time.textContent = B420.Utils.formatTime(gameState.elapsed);
    this.refs.heatValue.textContent = 'x' + heat.tier;
    this.refs.heatValue.style.color = heat.tier >= 4 ? B420.COLORS.flame1 : '';
    this.refs.heatFill.style.width = (heat.value) + '%';
    this.refs.blazeFill.style.width = (blaze.progressFraction() * 100) + '%';
    this.refs.blazeFill.classList.toggle('ready', blaze.ready);
    this.el.classList.toggle('blaze-active', blaze.active);

    if (nextEventIn != null) {
      this.refs.next420Val.textContent = B420.Utils.formatTime(nextEventIn);
      const n = this.refs.next420;
      n.classList.toggle('t20', nextEventIn <= 20 && nextEventIn > 10);
      n.classList.toggle('t10', nextEventIn <= 10 && nextEventIn > 4);
      const tick = nextEventIn <= 4;
      n.classList.toggle('t4', tick);
      if (tick) {
        const sec = Math.ceil(nextEventIn);
        if (sec !== this._lastTickSec) { this._lastTickSec = sec; n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); }
      } else {
        this._lastTickSec = null;
      }
    }
  }

  popup(text, laneX, y, kind) {
    const id = this._popupId++;
    const node = document.createElement('div');
    node.className = 'popup ' + (kind || '');
    node.textContent = text;
    node.style.left = laneX + 'px';
    node.style.top = y + 'px';
    this.refs.popups.appendChild(node);
    requestAnimationFrame(() => node.classList.add('rise'));
    setTimeout(() => node.remove(), 900);
  }

  stageToast(text) {
    const node = this.refs.stageToast;
    node.textContent = text;
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
  }

  eventBanner(step, text) {
    const node = this.refs.eventBanner;
    node.textContent = step === 0 ? '4:20' : text;
    node.classList.remove('show', 'big');
    void node.offsetWidth;
    node.classList.add('show');
    if (step === 0) node.classList.add('big');
  }

  hideEventBanner() { this.refs.eventBanner.classList.remove('show', 'big'); }
};
