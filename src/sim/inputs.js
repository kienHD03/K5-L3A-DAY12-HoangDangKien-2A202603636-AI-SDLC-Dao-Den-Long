/**
 * Validation and frame-by-frame reader for Test Contract v1.2 inputs & scenarios.
 */

export class ContractFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractFormatError';
  }
}

export function isVec3(val) {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

const VALID_SHADE_STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);

export function validateInputs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ContractFormatError('Inputs JSON must be an object.');
  }
  if (!Array.isArray(raw.frames)) {
    throw new ContractFormatError('Inputs JSON must contain a "frames" array.');
  }
  let prevTick = -1;
  for (let i = 0; i < raw.frames.length; i++) {
    const f = raw.frames[i];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      throw new ContractFormatError(`Frame at index ${i} must be an object.`);
    }
    if (typeof f.tick !== 'number' || !Number.isInteger(f.tick) || f.tick < 0) {
      throw new ContractFormatError(`Frame at index ${i} has invalid "tick".`);
    }
    if (f.tick <= prevTick) {
      throw new ContractFormatError(
        `Frame ticks must be strictly increasing (got ${f.tick} after ${prevTick}).`
      );
    }
    prevTick = f.tick;

    if (f.move !== undefined) {
      if (
        !Array.isArray(f.move) ||
        f.move.length !== 2 ||
        !f.move.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1)
      ) {
        throw new ContractFormatError(
          `Frame at tick ${f.tick} has invalid "move" (expected [x, z] in [-1, 1]).`
        );
      }
    }
    if (f.cam_yaw_deg !== undefined) {
      if (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg)) {
        throw new ContractFormatError(`Frame at tick ${f.tick} has invalid "cam_yaw_deg".`);
      }
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (f[key] !== undefined && typeof f[key] !== 'boolean') {
        throw new ContractFormatError(`Frame at tick ${f.tick} has non-boolean "${key}".`);
      }
    }
  }
  return raw.frames;
}

export function validateScenario(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ContractFormatError('Scenario JSON must be an object.');
  }
  if (raw.player !== undefined) {
    if (!raw.player || typeof raw.player !== 'object' || Array.isArray(raw.player)) {
      throw new ContractFormatError('Scenario "player" must be an object.');
    }
    if (raw.player.pos !== undefined && !isVec3(raw.player.pos)) {
      throw new ContractFormatError('Scenario "player.pos" must be [x, y, z].');
    }
    for (const intKey of [
      'carried',
      'flames',
      'invuln_ticks',
      'dash_cd_ticks',
      'pulse_cd_ticks',
      'charm_ticks',
      'successful_lights',
    ]) {
      if (
        raw.player[intKey] !== undefined &&
        (!Number.isInteger(raw.player[intKey]) || raw.player[intKey] < 0)
      ) {
        throw new ContractFormatError(
          `Scenario "player.${intKey}" must be a non-negative integer.`
        );
      }
    }
  }
  for (const key of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') {
      throw new ContractFormatError(`Scenario "${key}" must be a boolean.`);
    }
  }
  if (raw.time_left_s !== undefined) {
    if (
      typeof raw.time_left_s !== 'number' ||
      !Number.isFinite(raw.time_left_s) ||
      raw.time_left_s < 0
    ) {
      throw new ContractFormatError('Scenario "time_left_s" must be a non-negative number.');
    }
  }
  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) {
      throw new ContractFormatError('Scenario "motes" must be an array.');
    }
    for (let i = 0; i < raw.motes.length; i++) {
      const m = raw.motes[i];
      if (!isVec3(m) && !(m && typeof m === 'object' && isVec3(m.pos))) {
        throw new ContractFormatError(
          `Scenario motes[${i}] must be [x, y, z] or { pos: [x, y, z] }.`
        );
      }
    }
  }
  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) {
      throw new ContractFormatError('Scenario "shades" must be an array.');
    }
    for (let i = 0; i < raw.shades.length; i++) {
      const s = raw.shades[i];
      if (!s || typeof s !== 'object' || !isVec3(s.pos)) {
        throw new ContractFormatError(
          `Scenario shades[${i}] must be an object with "pos": [x, y, z].`
        );
      }
      if (s.state !== undefined && !VALID_SHADE_STATES.has(s.state)) {
        throw new ContractFormatError(`Scenario shades[${i}] has invalid state "${s.state}".`);
      }
      if (
        s.state_ticks_left !== undefined &&
        (!Number.isInteger(s.state_ticks_left) || s.state_ticks_left < 0)
      ) {
        throw new ContractFormatError(
          `Scenario shades[${i}].state_ticks_left must be a non-negative integer.`
        );
      }
      if (s.target_lantern_id !== undefined && typeof s.target_lantern_id !== 'string') {
        throw new ContractFormatError(
          `Scenario shades[${i}].target_lantern_id must be a string.`
        );
      }
    }
  }
  if (raw.drifters !== undefined) {
    if (!Array.isArray(raw.drifters)) {
      throw new ContractFormatError('Scenario "drifters" must be an array.');
    }
    for (let i = 0; i < raw.drifters.length; i++) {
      const d = raw.drifters[i];
      if (!d || typeof d !== 'object' || !isVec3(d.pos)) {
        throw new ContractFormatError(
          `Scenario drifters[${i}] must be an object with "pos": [x, y, z].`
        );
      }
    }
  }
  if (raw.charms !== undefined) {
    if (!Array.isArray(raw.charms)) {
      throw new ContractFormatError('Scenario "charms" must be an array.');
    }
    for (let i = 0; i < raw.charms.length; i++) {
      const c = raw.charms[i];
      if (!c || typeof c !== 'object' || !isVec3(c.pos)) {
        throw new ContractFormatError(
          `Scenario charms[${i}] must be an object with "pos": [x, y, z].`
        );
      }
    }
  }
  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) {
      throw new ContractFormatError('Scenario "lanterns" must be an array.');
    }
    for (let i = 0; i < raw.lanterns.length; i++) {
      const l = raw.lanterns[i];
      if (!l || typeof l !== 'object' || typeof l.id !== 'string') {
        throw new ContractFormatError(`Scenario lanterns[${i}] must have string "id".`);
      }
      if (l.pos !== undefined && !isVec3(l.pos)) {
        throw new ContractFormatError(`Scenario lanterns[${i}].pos must be [x, y, z].`);
      }
      if (l.deposited !== undefined && (!Number.isInteger(l.deposited) || l.deposited < 0)) {
        throw new ContractFormatError(
          `Scenario lanterns[${i}].deposited must be a non-negative integer.`
        );
      }
      if (l.lit !== undefined && typeof l.lit !== 'boolean') {
        throw new ContractFormatError(`Scenario lanterns[${i}].lit must be a boolean.`);
      }
      if (l.fuel !== undefined && (typeof l.fuel !== 'number' || !Number.isFinite(l.fuel) || l.fuel < 0)) {
        throw new ContractFormatError(`Scenario lanterns[${i}].fuel must be a non-negative number.`);
      }
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') {
        throw new ContractFormatError(`Scenario lanterns[${i}].ever_lit must be a boolean.`);
      }
    }
  }
  return raw;
}

export class InputTape {
  constructor(frames = []) {
    this.frames = frames;
    this.cursor = 0;
    this.current = {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };
  }

  getInputForTick(tick) {
    while (this.cursor < this.frames.length && this.frames[this.cursor].tick === tick) {
      const f = this.frames[this.cursor];
      if (f.move !== undefined) this.current.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) this.current.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) this.current.jump = f.jump;
      if (f.interact !== undefined) this.current.interact = f.interact;
      if (f.pulse !== undefined) this.current.pulse = f.pulse;
      if (f.dash !== undefined) this.current.dash = f.dash;
      if (f.pause !== undefined) this.current.pause = f.pause;
      this.cursor++;
    }
    return {
      move: [this.current.move[0], this.current.move[1]],
      cam_yaw_deg: this.current.cam_yaw_deg,
      jump: this.current.jump,
      interact: this.current.interact,
      pulse: this.current.pulse,
      dash: this.current.dash,
      pause: this.current.pause,
    };
  }
}
