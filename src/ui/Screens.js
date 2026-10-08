// Start screen + results screen. Both are DOM overlays toggled by main.js.
window.B420 = window.B420 || {};

B420.Screens = class Screens {
  constructor(root) {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'screen menu-screen';
    this.menuEl.innerHTML = `
      <div class="menu-inner">
        <h1 class="game-title" aria-label="Route 420">ROUTE <span>420</span></h1>
        <p class="tagline">drive stupid.</p>
        <button class="btn btn-primary" data-el="playBtn">PLAY</button>
        <button class="btn btn-ghost" data-el="howBtn">HOW TO DRIVE</button>
        <div class="best-score" data-el="bestScore">HI 000000</div>
        <div class="how-to-drive" data-el="howPanel">
          <p>LEFT / RIGHT</p>
          <p>DON'T HIT SHIT</p>
          <p>DRIVE STUPID FOR MORE POINTS</p>
          <p>SPACE / \u2191 &mdash; BLAZE</p>
          <p>FILL 420 CHAOS</p>
          <button class="btn btn-ghost btn-small" data-el="howCloseBtn">GOT IT</button>
        </div>
      </div>
    `;

    this.resultsEl = document.createElement('div');
    this.resultsEl.className = 'screen results-screen';
    this.resultsEl.innerHTML = `
      <div class="results-inner">
        <h2 class="run-over">RUN OVER</h2>
        <div class="score-hero"><span class="score-hero-label">SCORE</span><span class="score-hero-value" data-el="scoreHero">0</span><span class="new-record" data-el="newRecord">NEW HIGH SCORE</span></div>
        <p class="run-summary-line" data-el="summaryLine"></p>
        <div class="stat-grid" data-el="statGrid"></div>
        <button class="btn btn-primary" data-el="retryBtn">RETRY</button>
        <button class="btn btn-ghost" data-el="menuBtn">MAIN MENU</button>
      </div>
    `;

    this.pauseEl = document.createElement('div');
    this.pauseEl.className = 'screen pause-screen';
    this.pauseEl.innerHTML = `
      <div class="menu-inner">
        <h2 class="run-over">PAUSED</h2>
        <button class="btn btn-primary" data-el="resumeBtn">RESUME</button>
        <button class="btn btn-ghost" data-el="pauseHomeBtn">MAIN MENU</button>
      </div>
    `;

    root.appendChild(this.menuEl);
    root.appendChild(this.resultsEl);
    root.appendChild(this.pauseEl);

    this.refs = {};
    [this.menuEl, this.resultsEl, this.pauseEl].forEach(el => {
      el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });
    });

    this.refs.howBtn.addEventListener('click', () => this.refs.howPanel.classList.add('show'));
    this.refs.howCloseBtn.addEventListener('click', () => this.refs.howPanel.classList.remove('show'));
  }

  showPause(v) { this.pauseEl.classList.toggle('show', v); }

  showMenu(save) {
    this.refs.howPanel.classList.remove('show');
    this.refs.bestScore.textContent = 'HI ' + B420.Utils.pad6(save.bestScore);
    this.menuEl.classList.add('show');
    this.resultsEl.classList.remove('show');
  }

  hideMenu() { this.menuEl.classList.remove('show'); }

  showResults(gameState) {
    const r = gameState.lastResult;
    const hi = Math.max(gameState.save.bestScore, r.score);
    this.refs.scoreHero.textContent = r.score.toLocaleString();
    this.refs.newRecord.classList.remove('show');
    void this.refs.newRecord.offsetWidth;
    this.refs.newRecord.classList.toggle('show', !!r.newRecord);
    const cell = ([label, value]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
    const primary = [['HI', hi.toLocaleString()], ['TIME', B420.Utils.formatTime(r.time)], ['MAX HEAT', 'x' + r.maxHeatTier]];
    const secondary = [['NEAR MISSES', r.nearMisses], ['BLAZE MODES', r.blazeModesUsed], ['420 EVENTS', r.events420Survived]];
    this.refs.statGrid.innerHTML =
      '<div class="stat-row primary">' + primary.map(cell).join('') + '</div>' +
      '<div class="stat-row secondary">' + secondary.map(cell).join('') + '</div>';
    this.refs.summaryLine.textContent = this._pickSummary(r, gameState.save);
    this.resultsEl.classList.add('show');
  }

  hideResults() { this.resultsEl.classList.remove('show'); }

  _pickSummary(r, save) {
    const lines = [];
    if (r.newRecord) lines.push(['NEW BEST. UNFORTUNATELY.', 10]);
    if (r.maxHeatTier >= 5 && r.nearMisses >= 8) lines.push(["WELL. THAT'S FUCKED.", 9]);
    if (r.nearMisses >= 10) lines.push(['EXTREMELY POOR DECISION MAKING', 8]);
    if (r.time >= B420.CONFIG.FIRST_420_TIME) lines.push(['YOU SURVIVED 4:20. TAKE A BREAK.', 8]);
    if (r.escalationStage >= 5) {
      lines.push(['MECHANIC IS GOING TO BE PISSED', 7]);
      lines.push(["MECHANIC'S GONNA LOVE THIS.", 7]);
      lines.push(["WE'RE GONNA NEED A BIGGER WRENCH.", 7]);
    }
    if (r.nearMisses <= 1 && r.time < 30) lines.push(['YOU DROVE LIKE SOMEONE WHO HAS INSURANCE', 6]);
    if (r.score > 0 && r.score < save.bestScore && r.score > save.bestScore * 0.85) {
      lines.push(['YOU ALMOST LOOKED COMPETENT', 6]);
      lines.push(['YOU ALMOST HAD IT.', 6]);
      lines.push(['YOU WERE DOING SO WELL.', 6]);
    }
    if (r.blazeModesUsed === 0) lines.push(['NEVER EVEN GOT BLAZED', 4]);
    lines.push(['THAT\u2019LL BUFF OUT.', 1]);
    lines.push(['EXPENSIVE NOISE.', 1]);
    lines.push(['I REGRET TO INFORM YOU THAT WAS A CAR.', 1]);
    lines.push(["THIS IS WHY WE CAN'T HAVE NICE THINGS.", 1]);
    const topWeight = Math.max(...lines.map(l => l[1]));
    const top = lines.filter(l => l[1] === topWeight);
    return top[Math.floor(Math.random() * top.length)][0];
  }
};
