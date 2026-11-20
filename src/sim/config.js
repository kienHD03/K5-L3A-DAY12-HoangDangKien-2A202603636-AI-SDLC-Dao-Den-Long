import contract from '../../game.contract.json' with { type: 'json' };

export const CONTRACT = contract;
export const TUNING = contract.tuning;

export const SIM_CONSTANTS = {
  TICK_RATE: 60,
  DT: 1 / 60,
  ISLAND_RADIUS: 35.0,
  LANTERN_RING_RADIUS: 22.0,
  GRAVITY: 20.0,
  JUMP_VELOCITY: 7.5,
  FALL_Y_THRESHOLD: -6.0,
  INITIAL_MOTE_COUNT: 20,
  MAX_RANDOM_MOTES: 20,
  MOTE_SPAWN_INTERVAL_S: 3.5,
  INITIAL_SHADE_COUNT: 2,
  MAX_RANDOM_SHADES: 5,
  SHADE_SPAWN_INTERVAL_S: 30.0,
};

export function createDefaultLanterns() {
  const count = TUNING.lantern_count_night1;
  const r = SIM_CONSTANTS.LANTERN_RING_RADIUS;
  const lanterns = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = round3(Math.sin(angle) * r);
    const z = round3(Math.cos(angle) * r);
    lanterns.push({
      id: `L${i + 1}`,
      pos: [x, 0, z],
      lit: false,
      deposited: 0,
    });
  }
  return lanterns;
}

export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function roundPos(pos) {
  return [round3(pos[0]), round3(pos[1]), round3(pos[2])];
}
