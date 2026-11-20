import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/sim/rng.js';
import { GameSim, transformMove, distXZ } from '../src/sim/engine.js';
import { TUNING } from '../src/sim/config.js';
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
  // theta = 90 deg -> x' = z*sin(90) = 1, z' = z*cos(90) = 0
  assert.ok(Math.abs(x90 - 1) < 1e-6 && Math.abs(z90) < 1e-6);

  const [xd, zd] = transformMove([1, 1], 0);
  assert.ok(Math.abs(Math.hypot(xd, zd) - 1) < 1e-6);
});

test('mote pickup, deposit, lantern_lit, and win condition', () => {
  const sim = new GameSim({
    seed: 1,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 4, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 1]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 2], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    },
  });

  // Scenario setup emits no events and adds no score
  assert.equal(sim.score, 0);

  // Step 0: pick up mote at (0,0,1) within pickup_radius and interact with L1 at (0,0,2)
  const ev1 = sim.step({ move: [0, 0], cam_yaw_deg: 0, interact: true });
  assert.ok(ev1.some((e) => e.name === 'mote_picked' && e.data.carried === 5));
  assert.ok(ev1.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1' && e.data.amount === 5));
  assert.ok(ev1.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(ev1.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));
  assert.equal(sim.state, 'won');

  const expectedScore =
    TUNING.score.per_mote +
    TUNING.score.per_lantern +
    Math.floor(sim.timeLeftS) * TUNING.score.per_second_left +
    3 * TUNING.score.per_flame_left;
  assert.equal(sim.score, expectedScore);
});

test('pulse stuns and pushes shades in pulse_radius', () => {
  const sim = new GameSim({
    seed: 2,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [
        { id: 'S1', pos: [5, 0, 0] },
        { id: 'S2', pos: [20, 0, 0] },
      ],
    },
  });

  const ev = sim.step({ move: [0, 0], cam_yaw_deg: 0, pulse: true });
  const pulseEv = ev.find((e) => e.name === 'pulse');
  assert.ok(pulseEv);
  assert.deepEqual(pulseEv.data.stunned_ids, ['S1']);
  assert.equal(sim.player.carried, 3 - TUNING.pulse_cost);
  const s1 = sim.shades.find((s) => s.id === 'S1');
  assert.equal(s1.state, 'stunned');
  assert.ok(Math.abs(s1.pos[0] - (5 + TUNING.pulse_push_m)) < 1e-4);
});

test('shade cannot enter safe_radius of a lit lantern', () => {
  const sim = new GameSim({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [8, 0, 0] }],
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

test('falling off island triggers player_hit by fall and respawns', () => {
  const sim = new GameSim({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [34.5, 0, 0], carried: 4, flames: 2 },
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
  assert.ok(fallEvent, 'Expected player_hit with by: "fall"');
  assert.equal(fallEvent.data.flames, 1);
  assert.equal(fallEvent.data.dropped, Math.floor(4 * TUNING.hit_drop_ratio));
  assert.deepEqual(sim.player.pos, [0, 0, 0]);
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
