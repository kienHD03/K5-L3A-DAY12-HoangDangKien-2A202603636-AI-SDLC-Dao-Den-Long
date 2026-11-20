import contract from '../../game.contract.json' with { type: 'json' };

export const CONTRACT = contract;
export const TUNING = contract.tuning;

export const SIM_CONSTANTS = {
  TICK_RATE: 60,
  DT: 1 / 60,
  GRAVITY: 20.0,
  JUMP_VELOCITY: 7.0,
  FALL_Y_THRESHOLD: -10.0,
  RESPAWN_WAIT_TICKS: 60,
  INVULN_TICKS: Math.round(TUNING.invuln_s * 60), // 90
  DASH_TICKS: Math.round(TUNING.dash_duration_s * 60), // 12
  DASH_CD_TICKS: Math.round(TUNING.dash_cooldown_s * 60), // 90
  PULSE_CD_TICKS: Math.round(TUNING.pulse_cooldown_s * 60), // 180
  PULSE_STUN_TICKS: Math.round(TUNING.pulse_stun_s * 60), // 120
  PULSE_PUSH_TICKS: 15,
  PULSE_ORIGIN_Y_OFFSET: 0.8,
  MOTE_PICKUP_Y_TOLERANCE: 1.5,
  SHADE_HIT_Y_TOLERANCE: 1.5,
  SHADE_DETECT_RADIUS: 12.0,
  SHADE_LOSE_RADIUS: 18.0,
  SHADE_DRAIN_RADIUS: 2.0,
  SHADE_DRAIN_AGGRO_RADIUS: 6.0,
  SHADE_DRAIN_EVENT_INTERVAL_TICKS: 60,
  SHADE_WANDER_SPEED: 1.5,
  SHADE_RECOIL_DIST: 2.0,
  SHADE_RECOIL_TICKS: 60,
  SHADE_SAFE_PUSH_TICKS: 30,
  SHADE_FIRST_SPAWN_TICK: 300,
  INITIAL_MOTE_COUNT: 20,
  MAX_MOTES: 30,
  MOTE_SPAWN_INTERVAL_TICKS: 240,
  DROPPED_MOTE_TTL_TICKS: 480,
  DRIFTER_IDLE_SPEED: 2.0,
  DRIFTER_CHASE_SPEED: 7.0,
  DRIFTER_FLEE_SPEED: 7.0,
  DRIFTER_DETECT_RADIUS: 15.0,
  DRIFTER_MIN_CARRIED: 5,
  DRIFTER_STEAL_RADIUS: 1.2,
  DRIFTER_STEAL_MAX: 3,
  DRIFTER_FLEE_TICKS: 240,
  DRIFTER_POST_DROP_TICKS: 120,
  DRIFTER_SPAWN_INTERVAL_TICKS: 1200,
  CHARM_SPEED: 7.2,
  CHARM_DURATION_TICKS: 600,
  CHARM_RESPAWN_TICKS: 2700,
  WIND_CYCLE_TICKS: 1800, // 30s
  WIND_TELEGRAPH_TICKS: 120, // 2s
  WIND_DURATION_TICKS: 300, // 5s
  WIND_PUSH_SPEED: 2.0,
  // Phase 3 integer fuel units (1 fuel = 60 fuelTicks)
  FUEL_UNITS_PER_SECOND: 60,
  FUEL_MAX_TICKS: TUNING.fuel_max * 60, // 6000
  FUEL_LOW_TICKS: TUNING.low_fuel_threshold * 60, // 1800
  FUEL_PER_MOTE_TICKS: TUNING.fuel_per_mote * 60, // 600
  FUEL_DECAY_TICKS_PER_TICK: Math.round(TUNING.fuel_decay_per_s), // 1
  FUEL_DRAIN_TICKS_PER_TICK: Math.round(TUNING.drain_per_s), // 5
};

export const PALETTE = {
  SKY: 0x0e1430,
  FOG: 0x1b2350,
  GRASS: 0x2f5d50,
  SAND: 0xc9b48a,
  WOOD: 0x6b4a2f,
  CLOUD_SEA: 0x12384a,
  LANTERN_LIT: 0xffb347,
  LANTERN_CORE: 0xffe9b0,
  LANTERN_UNLIT: 0x5b5f6e,
  MOTE_CORE: 0xfff6c2,
  MOTE_GLOW: 0xffe58a,
  SHADE_BODY: 0x120a1a,
  SHADE_RIM: 0x7a3cff,
  SHADE_RIM_CB: 0x00b3ff,
  SHADE_STUNNED: 0x3a3450,
  MAY_CLOAK: 0xe8e2d0,
  MAY_SCARF_CHARM: 0xc8102e,
  GOLD_ACCENT: 0xf2c14e,
  DRIFTER: 0x8fa3b8,
  UI_DANGER: '#FF5A5F',
  UI_DANGER_CB: '#FFFFFF',
  UI_TEXT: '#F5F1E6',
};

export function round1(v) {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function roundPos(pos) {
  return [round3(pos[0]), round3(pos[1]), round3(pos[2])];
}
