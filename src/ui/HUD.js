// DOM-based HUD: one compact instrument cluster on top of the canvas.
// The 4:20/event readout is a self-contained slot (.hud-next420) so it can be swapped later.
window.B420 = window.B420 || {};

B420.HUD = class HUD {
  constructor(root) {
    this.touch = !!(window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-cluster">
        <div class="hud-row hud-row-main">
          <div class="hud-stat hud-score"><span class="hud-label">SCORE</span><span class="hud-value" data-el="score">000000</span></div>
          <div class="hud-stat hud-hi"><span class="hud-label">HI</span><span class="hud-value sm" data-el="hi">000000</span></div>
          <div class="hud-stat hud-time"><span class="hud-label">TIME</span><span class="hud-value sm" data-el="time">0:00</span></div>
          <div class="hud-btns">
            <button class="hud-btn" data-el="pauseBtn" aria-label="Pause" title="Pause (P)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg></button>
            <button class="hud-btn" data-el="homeBtn" aria-label="Home" title="Main menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/></svg></button>
          </div>
        </div>
        <div class="hud-row hud-row-sys">
          <div class="hud-sys hud-heat"><span class="hud-label">HEAT</span><span class="heat-value" data-el="heatValue">x1</span><div class="meter"><div class="meter-fill heat-fill" data-el="heatFill"></div></div></div>
          <div class="hud-sys hud-blaze"><span class="hud-label" data-el="blazeLabel">BLAZE</span><div class="meter"><div class="meter-fill blaze-fill" data-el="blazeFill"></div></div></div>
          <div class="hud-sys hud-next420" data-el="next420"><span class="hud-label" data-el="next420Label">4:20 IN</span><span class="hud-value sm" data-el="next420Val">4:20</span></div>
        </div>
      </div>
      <div class="popup-layer" data-el="popups"></div>
      <div class="event-banner" data-el="eventBanner"></div>
      <div class="stage-toast" data-el="stageToast"></div>
    `;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });
  }

  show(v) { this.el.style.display = v ? 'block' : 'none'; }
  bindPause(fn) { this.refs.pauseBtn.addEventListener('click', fn); }
  bindHome(fn) { this.refs.homeBtn.addEventListener('click', fn); }

  update(gameState, heat, blaze, nextEventIn) {
    const r = this.refs;
    r.score.textContent = B420.Utils.pad6(gameState.score);
    r.hi.textContent = B420.Utils.pad6(gameState.hi);
    r.hi.classList.toggle('beat', gameState.hi > gameState.hiAtStart);
    r.time.textContent = B420.Utils.formatTime(gameState.elapsed);
    r.heatValue.textContent = 'x' + heat.tier;
    r.heatValue.classList.toggle('hot', heat.tier >= 4);
    r.heatFill.style.width = heat.value + '%';
    r.blazeFill.style.width = (blaze.progressFraction() * 100) + '%';
    r.blazeFill.classList.toggle('ready', blaze.ready);
    r.blazeLabel.textContent = blaze.ready ? (this.touch ? 'READY' : 'SPACE') : 'BLAZE';
    r.blazeLabel.classList.toggle('ready', blaze.ready);
    this.el.classList.toggle('blaze-active', blaze.active);

    const n = r.next420;
    if (nextEventIn != null) {
      const sec = Math.ceil(nextEventIn);
      r.next420Label.textContent = '4:20 IN';
      r.next420Val.textContent = B420.Utils.formatTime(sec);
      n.classList.toggle('t20', nextEventIn <= 20 && nextEventIn > 10);
      n.classList.toggle('t10', nextEventIn <= 10 && nextEventIn > 4);
      n.classList.toggle('t4', nextEventIn <= 4);
      if (nextEventIn <= 4) {
        if (sec !== this._lastTickSec) { this._lastTickSec = sec; n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); }
      } else {
        this._lastTickSec = null;
      }
    } else {
      r.next420Label.textContent = '4:20';
      r.next420Val.textContent = 'SURVIVED';
      n.classList.remove('t20', 't10', 't4', 'tick');
    }
  }

  // x/y are canvas pixels; the UI layer is CSS-zoomed (internal width ~400), so convert.
  popup(text, x, y, kind) {
    const z = parseFloat(this.el.parentNode.style.zoom) || 1;
    const node = document.createElement('div');
    node.className = 'popup ' + (kind || '');
    node.textContent = text;
    node.style.left = B420.Utils.clamp(x / z, 105, 295) + 'px';
    node.style.top = (y / z) + 'px';
    this.refs.popups.appendChild(node);
    requestAnimationFrame(() => node.classList.add('rise'));
    setTimeout(() => node.remove(), 900);
  }

  stageToast(text) {
    const node = this.refs.stageToast;
    clearTimeout(this._toastTimer);
    node.textContent = text;
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
    this._toastTimer = setTimeout(() => node.classList.remove('show'), 900);
  }

  eventBanner(step, text) {
    const node = this.refs.eventBanner;
    node.textContent = step === 0 ? '420' : text;
    node.classList.remove('show', 'big', 'flicker');
    void node.offsetWidth;
    node.classList.add('show');
    if (step === 0) node.classList.add('big', 'flicker');
  }

  hideEventBanner() { this.refs.eventBanner.classList.remove('show', 'big', 'flicker'); }
};
