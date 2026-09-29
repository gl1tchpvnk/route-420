// Math helpers + save data
window.B420 = window.B420 || {};

B420.Utils = {
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  randRange(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(this.randRange(min, max + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  weightedChoice(entries) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return entries[0] ? entries[0].value : null;
    let r = Math.random() * total;
    for (const e of entries) {
      if (r < e.weight) return e.value;
      r -= e.weight;
    }
    return entries[entries.length - 1].value;
  },
  aabbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  vGap(a, b) {
    // vertical gap between two AABBs (negative/0 if overlapping)
    if (a.y < b.y) return b.y - (a.y + a.h);
    return a.y - (b.y + b.h);
  },
  formatTime(seconds) {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  },
  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
};

B420.Storage = {
  // Legacy key name kept on purpose so existing saved best scores survive the Route 420 rename.
  KEY: 'burnout420_save_v1',
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { bestScore: 0, longestRun: 0, highestHeatTier: 1 };
      const data = JSON.parse(raw);
      return {
        bestScore: data.bestScore || 0,
        longestRun: data.longestRun || 0,
        highestHeatTier: data.highestHeatTier || 1
      };
    } catch (e) {
      return { bestScore: 0, longestRun: 0, highestHeatTier: 1 };
    }
  },
  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },
  updateBest(result) {
    const data = this.load();
    let changed = false;
    let isNewBest = false;
    if (result.score > data.bestScore) { data.bestScore = result.score; changed = true; isNewBest = true; }
    if (result.time > data.longestRun) { data.longestRun = result.time; changed = true; }
    if (result.maxHeatTier > (data.highestHeatTier || 1)) { data.highestHeatTier = result.maxHeatTier; changed = true; }
    if (changed) this.save(data);
    data.isNewBest = isNewBest;
    return data;
  }
};
