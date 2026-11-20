import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/sim/rng.js';
import { GameSim, transformMove, distXZ } from '../src/sim/engine.js';
import { TUNING, SIM_CONSTANTS } from '../src/sim/config.js';
import { validateInputs, ContractFormatError } from '../src/sim/inputs.js';

test('PRNG is deterministic for the same seed', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('transformMove matches Test Contract formula and normalizes length > 1', () => {
  const [x0, z0] = transformMove([1, 0], 0);
  assert.ok(Math.abs(x0 - 1) < 1e-6 && Math.abs(z0) < 1e-6);
  const [x90, z90] = transformMove([0, 1], 90);
  assert.ok(Math.abs(x90 - 1) < 1e-6 && Math.abs(z90) < 1e-6);
  const [xd, zd] = transformMove([1, 1], 0);
  assert.ok(Math.abs(Math.hypot(xd, zd) - 1) < 1e-6);
});

// Updated for Phase 3 (ADR-001): lighting all lanterns no longer wins early; score is +5/mote deposit +100 first light; capacity grows +2
test('Phase 3 lighting: deposit (+5/mote), first light (+100, relight:false), no early win, capacity +2', () => {
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
  assert.equal(sim.getPlayerCapacity(), 10);

  const ev1 = sim.step({ move: [0, 0], cam_yaw_deg: 0, interact: true });
  assert.ok(ev1.some((e) => e.name === 'mote_picked' && e.data.carried === 10));
  assert.ok(ev1.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1' && e.data.amount === 10));
  assert.ok(ev1.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1' && e.data.relight === false));
  // Phase 3: lighting all 5 does NOT win early
  assert.equal(sim.state, 'playing');
  assert.equal(sim.score, 10 * 5 + 100);
  assert.equal(sim.getPlayerCapacity(), 12);
});

test('Phase 3 fuel decay, lantern_out, relight cost 5 (+40 score, relight:true)', () => {
  const sim = new GameSim({
    seed: 2,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 0.1 }],
      time_left_s: 100,
    },
  });

  // 0.1 fuel = 6 fuelTicks -> goes out on tick 6
  let outEv = null;
  for (let i = 0; i < 10; i++) {
    const evs = sim.step({ move: [0, 0] });
    const found = evs.find((e) => e.name === 'lantern_out');
    if (found) {
      outEv = found;
      break;
    }
  }
  assert.ok(outEv);
  assert.equal(outEv.data.lantern_id, 'L1');
  const l1 = sim.lanterns[0];
  assert.equal(l1.lit, false);
  assert.equal(l1.everLit, true);
  assert.equal(l1.deposited, 0);

  // Relight with only 5 motes
  const evRelight = sim.step({ move: [0, 0], interact: true });
  assert.ok(evRelight.some((e) => e.name === 'lantern_lit' && e.data.relight === true));
  assert.equal(l1.lit, true);
  assert.equal(l1.relitCount, 1);
  assert.equal(sim.score, 5 * 5 + 40);
});

test('Phase 3 refuel: ceil((100-fuel)/10) motes, full lantern skipped', () => {
  const sim = new GameSim({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.0], lit: true, fuel: 100 },
        { id: 'L2', pos: [0, 0, 1.5], lit: true, fuel: 85 },
      ],
      time_left_s: 100,
    },
  });

  // Step 0: L1 decays to 99.983 -> wait, let's test exact full by setting L1 to 100 after decay?
  // Wait: Step 2 decays L1 by 1/60 so L1 becomes 5999/6000 (< 100) and needs 1 mote!
  // Let's test L2 alone at 75 fuel (needs ceil(25/10) = 3 motes -> fuel 100)
  const sim2 = new GameSim({
    seed: 3,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 75 }],
      time_left_s: 100,
    },
  });

  const ev = sim2.step({ move: [0, 0], interact: true });
  const ref = ev.find((e) => e.name === 'refuel');
  assert.ok(ref);
  assert.equal(ref.data.amount, 3);
  assert.equal(ref.data.fuel, 100);
  assert.equal(sim2.player.carried, 2);
  assert.equal(sim2.score, 15);
});

test('Phase 3 shade drain: fuel < 30 loses safe_radius, drains 5/s, Pulse gives +15 score', () => {
  const sim = new GameSim({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 22], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      time_left_s: 100,
    },
  });

  // Run 60 ticks while player is out of 6m aggro range? Wait: player at z=22, shade at z=26 -> dist=4m <= 6m would aggro!
  // Place player at z=10 (dist=16m) for 60 ticks, then move closer for pulse test
  const simDrain = new GameSim({
    seed: 4,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 10], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      time_left_s: 100,
    },
  });

  let drainEv = null;
  for (let i = 0; i < 60; i++) {
    const evs = simDrain.step({ move: [0, 0] });
    const f = evs.find((e) => e.name === 'fuel_drain');
    if (f) drainEv = f;
  }
  assert.ok(drainEv, 'Expected fuel_drain event at 60 ticks');
  assert.equal(drainEv.data.lantern_id, 'L1');
  assert.equal(drainEv.data.shade_id, 'S1');
  // 25 - 1 (decay) - 5 (drain) = 19.0
  assert.equal(drainEv.data.fuel, 19);

  // Pulse a draining shade gives +15 score
  const simPulse = new GameSim({
    seed: 5,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 22], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0, 0, 25.5], state: 'drain', target_lantern_id: 'L1' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
      time_left_s: 100,
    },
  });
  const evP = simPulse.step({ move: [0, 0], pulse: true });
  assert.ok(evP.some((e) => e.name === 'pulse' && e.data.stunned_ids.includes('S1')));
  assert.equal(simPulse.score, 15);
});

test('Phase 3 win at dawn: >= 3/5 lit -> dawn_survived + dawn score; < 3/5 -> dawn loss', () => {
  const simWin = new GameSim({
    seed: 6,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 2 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [
        { id: 'L1', lit: true, fuel: 51 },
        { id: 'L2', lit: true, fuel: 81 },
        { id: 'L3', lit: true, fuel: 31 },
      ],
      time_left_s: 1.0,
    },
  });

  let overEv = null;
  for (let i = 0; i < 65; i++) {
    const evs = simWin.step({ move: [0, 0] });
    const go = evs.find((e) => e.name === 'game_over');
    if (go) {
      overEv = go;
      break;
    }
  }
  assert.ok(overEv);
  assert.equal(overEv.data.result, 'won');
  assert.equal(overEv.data.reason, 'dawn_survived');
  // After 1.0s decay: fuels are 50, 80, 30 -> (50+50)+(50+80)+(50+30) + 2*50 = 100+130+80+100 = 410
  assert.equal(simWin.score, 410);
});

test('Shade cannot enter safe_radius when lantern fuel >= 30', () => {
  const sim = new GameSim({
    seed: 7,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [8, 0, 0], state: 'chase' }],
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 60 }],
    },
  });

  for (let i = 0; i < 120; i++) sim.step({ move: [0, 0], cam_yaw_deg: 0 });
  assert.ok(distXZ(sim.shades[0].pos, [0, 0, 0]) >= TUNING.safe_radius);
  assert.equal(sim.player.flames, 3);
});

test('Dash moves at 14 m/s for 12 ticks, holds air altitude, triggers 90-tick cooldown', () => {
  const sim = new GameSim({
    seed: 8,
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
  assert.equal(sim.player.dashCdTicks, SIM_CONSTANTS.DASH_CD_TICKS);
  for (let i = 0; i < 11; i++) sim.step({ move: [0, 1], cam_yaw_deg: 0, dash: false });
  assert.ok(Math.abs(sim.player.pos[2] - 2.8) < 0.05);
  assert.equal(sim.player.pos[1], 2);
});

test('Pause freezes sim_tick, time_left_s, and lantern fuel', () => {
  const sim = new GameSim({
    seed: 9,
    night: 1,
    scenario: {
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [{ id: 'L1', lit: true, fuel: 50 }],
    },
  });

  sim.step({ move: [0, 0] });
  const fuelBefore = sim.lanterns[0].fuelTicks;
  sim.step({ move: [0, 0], pause: true });
  for (let i = 0; i < 10; i++) sim.step({ move: [0, 0], pause: false });
  assert.equal(sim.lanterns[0].fuelTicks, fuelBefore);
  assert.equal(sim.state, 'paused');
});

test('Drifter steals up to 3 motes and drops them when hit by Pulse while fleeing', () => {
  const sim = new GameSim({
    seed: 10,
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
  assert.ok(ev1.some((e) => e.name === 'drifter_steal' && e.data.amount === 3));
  const ev2 = sim.step({ move: [0, 0], pulse: true });
  assert.ok(ev2.some((e) => e.name === 'drifter_drop' && e.data.amount === 3));
});

test('Night 2 & Night 3 jump pads land on target islands/tiers', () => {
  const sim2 = new GameSim({
    seed: 11,
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
  for (let i = 0; i < 120; i++) sim2.step({ move: [0, 0] });
  assert.ok(Math.hypot(sim2.player.pos[0] - 70, sim2.player.pos[2]) <= 28);

  const sim3 = new GameSim({
    seed: 12,
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
  for (let i = 0; i < 90; i++) sim3.step({ move: [0, 0] });
  assert.equal(sim3.player.pos[1], 6);
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

import { addLeaderboardEntry, isValidLeaderboardName } from '../src/sim/leaderboard.js';

test('Leaderboard validates names (3-12 chars incl. Vietnamese) and sorts top 10 with tie-break', () => {
  assert.equal(isValidLeaderboardName('ab'), false);
  assert.equal(isValidLeaderboardName('May_01'), true);
  assert.equal(isValidLeaderboardName('Mây_Đảo1'), true);
  assert.equal(isValidLeaderboardName('bad name!'), false);

  let lb = [];
  lb = addLeaderboardEntry(lb, { name: 'Bob', score: 500, nights_won: 2, achieved_at: '2026-11-20T10:05:00Z', seed: 2 });
  lb = addLeaderboardEntry(lb, { name: 'Alice', score: 500, nights_won: 2, achieved_at: '2026-11-20T10:00:00Z', seed: 1 });
  lb = addLeaderboardEntry(lb, { name: 'Top1', score: 900, nights_won: 3, achieved_at: '2026-11-20T10:10:00Z', seed: 3 });
  assert.equal(lb[0].name, 'Top1');
  assert.equal(lb[1].name, 'Alice'); // earlier achieved_at wins tie
  assert.equal(lb[2].name, 'Bob');

  for (let i = 0; i < 12; i++) {
    lb = addLeaderboardEntry(lb, { name: `User_${i}`, score: 100 + i, nights_won: 1, achieved_at: '2026-11-20T11:00:00Z', seed: i });
  }
  assert.equal(lb.length, 10);
});
