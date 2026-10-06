// ROUTE 420 — global config, tuning values, palette
window.B420 = window.B420 || {};

B420.CONFIG = {
  LANES: 4,
  LANE_CHANGE_MS: 150,
  BLAZE_LANE_CHANGE_MS: 230,
  PLAYER_Y_FRACTION: 0.76,
  PLAYER_Y_FRACTION_NARROW: 0.72, // touch/narrow: extra breathing room above the controls

  BASE_SCROLL_SPEED: 250,
  MAX_SCROLL_SPEED: 560,
  SPEED_RAMP_SECONDS: 150,
  FORGIVING_SECONDS: 22,

  SPAWN_INTERVAL_START: 1.2,
  SPAWN_INTERVAL_MIN: 0.5,
  SPAWN_RAMP_SECONDS: 110,
  PICKUP_INTERVAL_MIN: 6,
  PICKUP_INTERVAL_MAX: 9.5,

  SCORE_BASE_RATE: 9,
  NEAR_MISS_SCORE: 250,
  NEAR_MISS_SCORE_TIGHT: 500,
  THREAD_NEEDLE_BONUS: 750,
  PICKUP_BLAZE_SCORE: 100,
  MUNCHIE_SCORE: 250,
  RIVAL_SMOKE_SCORE: 1500,
  EVENT_SURVIVE_SCORE: 1000,

  HEAT_MAX: 100,
  HEAT_PER_NEAR_MISS: 14,
  HEAT_PER_TIGHT_MISS: 24,
  HEAT_PER_THREAD: 30,
  HEAT_PER_RIVAL: 30,
  HEAT_SAFE_GRACE: 2.5,
  HEAT_DECAY_RATE: 9,
  HEAT_TIERS: [0, 20, 40, 60, 80],

  NEAR_MISS_WINDOW_DIST: 30,
  NEAR_MISS_TIGHT_CENTER_DIST: 12,
  NEAR_MISS_WINDOW: 0.35,

  BLAZE_MAX: 100,
  BLAZE_PICKUP_FILL: 25,
  BLAZE_DURATION: 8,
  BLAZE_TRAFFIC_SLOW: 0.22,
  BLAZE_SCORE_MULT: 1.6,
  BLAZE_ECHO_INTERVAL: 0.2,

  ESCALATION_THRESHOLDS: [0, 0, 900, 2600, 6200, 12000, 20000],
  ESCALATION_MESSAGES: [
    '', '',
    'ENGINE: QUESTIONABLE',
    'THIS SEEMS UNSAFE',
    'WARRANTY VOID',
    'MECHANICALLY ILLEGAL',
    'DMV HAS BEEN NOTIFIED'
  ],

  FIRST_420_TIME: 260,
  SECOND_420_TIME: 520,
  EVENT_FLASH_MS: 1300,

  RIVAL_MIN_SURVIVAL: 42,
  RIVAL_COOLDOWN: 55,
  RIVAL_DURATION: 8.5,

  DANGER_ZONE_Y: 150,

  TRAFFIC_FOLLOW_GAP: 150,
  TRAFFIC_BRAKE_GAP: 60,
  TRAFFIC_LANE_COOLDOWN: 2.6,
  TRAFFIC_CHECK_AHEAD: 85,
  TRAFFIC_CHECK_BEHIND: 55,
  TRAFFIC_TELEGRAPH_S: 0.2,
  TRAFFIC_LANECHANGE_S: 0.3,
  SLOWDOWN_TRAIL_ALPHA: 0.42,
  SLOWDOWN_VIGNETTE_ALPHA: 0.16,

  FUEL_DURATION: 4.5,
  FUEL_EXTEND: 1.0,        // re-collect while active: extend modestly...
  FUEL_MAX_DURATION: 6.5,  // ...but never beyond this cap
  FUEL_SPEED_BOOST: 0.22,  // single bounded modifier (never multiplied per can)
  FUEL_SCORE_MULT: 1.5,
  FUEL_BLAZE_COMBINED: 1.08, // FUEL + BLAZE together: modestly above normal speed
  FUEL_RAMP_UP: 0.3,
  FUEL_RAMP_DOWN: 0.9,
  FUEL_SPAWN_MIN: 20,
  FUEL_SPAWN_MAX: 32,
  FUEL_MIN_ELAPSED: 14,

  REACTION_BASE: 70,
  REACTION_TIME: 0.55, // reactionDistance = base + scrollSpeed * this

  DEBUG_KEY: 'debug',

  // Touch-capable or narrow screens: full-bleed game layout + raised car (layout only; controls are always shown)
  NARROW_MQ: '(max-width: 760px), (any-pointer: coarse)'
};

B420.COLORS = {
  asphalt: '#2c2a25',
  asphaltDark: '#201e1a',
  asphaltLight: '#3a372f',
  laneLine: '#cbbf9c',
  laneLineDim: '#8f855f',
  cream: '#e9dfc4',
  creamDim: '#c9bd9a',
  black: '#17150f',
  red: '#b8402d',
  redDark: '#7c2a1e',
  olive: '#6d7a3f',
  oliveBright: '#95a852',
  burntOrange: '#c9702c',
  chrome: '#cfd3d6',
  chromeDark: '#8e928f',
  blazeGreen: '#7fae3b',
  blazeGreenBright: '#b6e35f',
  smoke: '#928d7d',
  flame1: '#ff8a2b',
  flame2: '#ffd23f',
  copRed: '#c22f2f',
  copBlue: '#2f5fc2'
};

B420.VEHICLE = {
  SEDAN: 'sedan',
  PICKUP: 'pickup',
  MUSCLE: 'muscle',
  GRANDMA: 'grandma',
  COP: 'cop',
  RIVAL: 'rival'
};

B420.TYPE_CONFIG = {
  sedan:   { speedFactor: 1.00, w: 32, h: 54, weightBase: 58, weightLate: 32 },
  pickup:  { speedFactor: 0.98, w: 33, h: 56, weightBase: 17, weightLate: 15, wander: true },
  muscle:  { speedFactor: 0.55, w: 33, h: 55, weightBase: 7,  weightLate: 19, burst: -0.35 },
  grandma: { speedFactor: 1.55, w: 32, h: 53, weightBase: 15, weightLate: 9  },
  cop:     { speedFactor: 1.00, w: 33, h: 55, weightBase: 3,  weightLate: 9,  rare: true }
};

B420.EVENTS = {
  GREEN_FOG: 'green_fog',
  HOT_ROD_SWAP: 'hot_rod_swap',
  UFO: 'ufo',
  MUNCHIES: 'munchies',
  MOVING_LINES: 'moving_lines'
};

B420.STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

B420.FOOD_EMOJI = ['🍕', '🍟', '🍩', '🍔', '🥤'];

B420.NEAR_MISS_TEXTS = ['CLOSE', 'CLOSE!', 'NICE'];
B420.TIGHT_MISS_TEXTS = ['TOO CLOSE', 'IDIOT', 'BAD IDEA'];
