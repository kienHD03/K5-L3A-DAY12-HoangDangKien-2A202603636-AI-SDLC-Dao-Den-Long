import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/sim/rng.js';
import { GameSim, transformMove, distXZ } from '../src/sim/engine.js';
import { TUNING, SIM_CONSTANTS } from '../src/sim/config.js';
import { validateInputs, ContractFormatError } from '../src/sim/inputs.js';

test('PRNG is deterministic for the same seed', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  for (let i = 0; i < 20; i++) {
    assert.equal(a(), b());
  }
});

test('transformMove matches Test Contract formula and normalizes length > 1', () => {
  const [x0, z0] = transformMove([1, 0], 0);
  assert.ok(Math.abs(x0 - 1) < 1e-6 && Math.abs(z0) < 1e-6);

  const [x90, z90] = transformMove([0, 1], 90);
  assert.ok(Math.abs(x90 - 1) < 1e-6 && Math.abs(z90) < 1e-6);

  const [xd, zd] = transformMove([1, 1], 0);
  assert.ok(Math.abs(Math.hypot(xd, zd) - 1) < 1e-6);
});

test('Phase 1 regression (v1.1 numbers): pickup, deposit (+10/mote on deposit), lantern_lit, win', () => {
  const sim = new GameSim({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 9, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 0.8]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.5], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    },
  });

  assert.equal(sim.score, 0);
  const ev1 = sim.step({ move: [0, 0], cam_yaw_deg: 0, interact: true });
  assert.ok(ev1.some((e) => e.name === 'mote_picked' && e.data.carried === 10));
  assert.ok(ev1.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1' && e.data.amount === 10));
  assert.ok(ev1.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(ev1.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));
  assert.equal(sim.state, 'won');

  const expectedScore =
    10 * TUNING.score.per_mote +
    TUNING.score.per_lantern +
    Math.floor(sim.timeLeftS) * TUNING.score.per_second_left +
    3 * TUNING.score.per_flame_left;
  assert.equal(sim.score, expectedScore);
});

test('Pulse (v1.1): 3D radius 5m from Y+0.8, 120-tick stun, 4m push over 15 ticks, +5 score', () => {
  const sim = new GameSim({
    seed: 2,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [
        { id: 'S1', pos: [4, 0, 0], state: 'chase' },
        { id: 'S2', pos: [12, 0, 0], state: 'chase' },
      ],
    },
  });

  const ev = sim.step({ move: [0, 0], cam_yaw_deg: 0, pulse: true });
  const pulseEv = ev.find((e) => e.name === 'pulse');
  assert.ok(pulseEv);
  assert.deepEqual(pulseEv.data.stunned_ids, ['S1']);
  assert.equal(sim.player.carried, 5 - TUNING.pulse_cost);
  assert.equal(sim.score, TUNING.score.per_stun);

  // Run 15 more ticks for push to complete
  for (let i = 0; i < 15; i++) {
    sim.step({ move: [0, 0], cam_yaw_deg: 0, pulse: false });
  }
  const s1 = sim.shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  assert.ok(Math.abs(s1.pos[0] - (4 + TUNING.pulse_push_m)) < 0.05);
});

test('Shade cannot enter safe_radius of a lit lantern', () => {
  const sim = new GameSim({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [8, 0, 0], state: 'chase' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    },
  });

  for (let i = 0; i < 180; i++) {
    sim.step({ move: [0, 0], cam_yaw_deg: 0 });
  }
  const s1 = sim.shades[0];
  assert.ok(distXZ(s1.pos, [0, 0, 0]) >= TUNING.safe_radius);
  assert.equal(sim.player.flames, 3);
});

test('Fall off island (Y < -10): ignores invuln, loses all carried, waits 60 ticks, respawns with invuln', () => {
  const sim = new GameSim({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [40.5, 0, 0], carried: 6, flames: 2, invuln_ticks: 90 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
    },
  });

  let fallEvent = null;
  for (let i = 0; i < 120; i++) {
    const evs = sim.step({ move: [1, 0], cam_yaw_deg: 0 });
    const hit = evs.find((e) => e.name === 'player_hit' && e.data.by === 'fall');
    if (hit) {
      fallEvent = hit;
      break;
    }
  }
  assert.ok(fallEvent);
  assert.equal(fallEvent.data.flames, 1);
  assert.equal(fallEvent.data.lost, 6);
  assert.equal(sim.player.carried, 0);

  // Wait 60 ticks for respawn
  for (let i = 0; i < 60; i++) {
    sim.step({ move: [0, 0], cam_yaw_deg: 0 });
  }
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
  assert.ok(sim.player.invulnTicks > 0);
});

test('Dash moves at 14 m/s for 12 ticks, holds air altitude, triggers 90-tick cooldown', () => {
  const sim = new GameSim({
    seed: 5,
    night: 1,
    scenario: {
      player: { pos: [0, 2, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
    },
  });

  const ev = sim.step({ move: [0, 1], cam_yaw_deg: 0, dash: true });
  assert.ok(ev.some((e) => e.name === 'dash'));
  assert.equal(sim.player.pos[1], 2); // held altitude in air
  assert.equal(sim.player.dashCdTicks, SIM_CONSTANTS.DASH_CD_TICKS);

  for (let i = 0; i < 11; i++) {
    sim.step({ move: [0, 1], cam_yaw_deg: 0, dash: false });
  }
  assert.ok(Math.abs(sim.player.pos[2] - 2.8) < 0.05); // 14 * 0.2 = 2.8m
  assert.equal(sim.player.pos[1], 2);
});

test('Pause freezes sim_tick and time_left_s while tick advances', () => {
  const sim = new GameSim({
    seed: 6,
    night: 1,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
  });

  sim.step({ move: [0, 0] }); // tick 1, sim_tick 1
  const tBefore = sim.timeLeftS;

  const evPause = sim.step({ move: [0, 0], pause: true });
  assert.ok(evPause.some((e) => e.name === 'paused'));
  assert.equal(sim.state, 'paused');
  assert.equal(sim.tick, 2);
  assert.equal(sim.simTick, 1);

  for (let i = 0; i < 10; i++) {
    sim.step({ move: [0, 1], pause: false });
  }
  assert.equal(sim.tick, 12);
  assert.equal(sim.simTick, 1);
  assert.equal(sim.timeLeftS, tBefore);

  const evResume = sim.step({ move: [0, 0], pause: true });
  assert.ok(evResume.some((e) => e.name === 'resumed'));
  assert.equal(sim.state, 'playing');
  assert.equal(sim.simTick, 2);
});

test('Drifter steals up to 3 motes and drops them when hit by Pulse while fleeing', () => {
  const sim = new GameSim({
    seed: 7,
    night: 2,
    scenario: {
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [0.8, 0.8, 0], state: 'chase' }],
    },
  });

  const ev1 = sim.step({ move: [0, 0] });
  const steal = ev1.find((e) => e.name === 'drifter_steal');
  assert.ok(steal);
  assert.equal(steal.data.amount, 3);
  assert.equal(steal.data.carried, 5);
  assert.equal(sim.drifters[0].state, 'flee');

  const ev2 = sim.step({ move: [0, 0], pulse: true });
  const drop = ev2.find((e) => e.name === 'drifter_drop');
  assert.ok(drop);
  assert.equal(drop.data.amount, 3);
  assert.equal(sim.motes.filter((m) => m.kind === 'dropped').length, 3);
});

test('Wind Charm grants 7.2 m/s speed and zero dash cooldown for 600 ticks', () => {
  const sim = new GameSim({
    seed: 8,
    night: 2,
    scenario: {
      player: { pos: [35, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [],
    },
  });

  const ev = sim.step({ move: [0, 0] });
  assert.ok(ev.some((e) => e.name === 'charm_picked' && e.data.charm_id === 'C1'));
  assert.equal(sim.player.charmTicks, 600);

  const evDash = sim.step({ move: [0, 1], dash: true });
  assert.ok(evDash.some((e) => e.name === 'dash'));
  assert.equal(sim.player.dashCdTicks, 0);
});

test('Night 2 jump pad launches player from Island A to Island B', () => {
  const sim = new GameSim({
    seed: 9,
    night: 2,
    scenario: {
      player: { pos: [20, 0, 18], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [],
    },
  });

  for (let i = 0; i < 120; i++) {
    sim.step({ move: [0, 0] });
  }
  assert.equal(sim.player.grounded, true);
  assert.ok(Math.hypot(sim.player.pos[0] - 70, sim.player.pos[2]) <= 28, 'Should land on Island B');
});

test('Night 3 jump pad launches player from Tier 1 (Y=3) to Tier 2 (Y=6)', () => {
  const sim = new GameSim({
    seed: 10,
    night: 3,
    scenario: {
      player: { pos: [0, 3, 13], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      motes: [],
      shades: [],
      drifters: [],
    },
  });

  for (let i = 0; i < 90; i++) {
    sim.step({ move: [0, 0] });
  }
  assert.equal(sim.player.grounded, true);
  assert.equal(sim.player.pos[1], 6);
  assert.ok(Math.hypot(sim.player.pos[0], sim.player.pos[2]) <= 8);
});

test('validateInputs rejects non-increasing ticks', () => {
  assert.throws(
    () =>
      validateInputs({
        frames: [
          { tick: 10, move: [0, 1] },
          { tick: 10, move: [0, 0] },
        ],
      }),
    ContractFormatError
  );
});
