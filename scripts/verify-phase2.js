import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

function runHeadless(args) {
  return spawnSync(process.execPath, [path.join(ROOT, 'src', 'headless.js'), ...args], {
    encoding: 'utf8',
  });
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeTmp(name, obj) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return p;
}

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message });
    console.error(`FAIL  ${name}: ${err.message}`);
  }
}

// 1. Unit tests
check('Unit tests (node --test)', () => {
  execFileSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'unit.test.js')], {
    stdio: 'inherit',
  });
});

// 2. Phase 1 Regression: Pickup -> Deposit (10) -> Lantern Lit -> Win (all_lit)
check('Scenario 1 (P1 Regression): Pickup -> Deposit -> Win (all_lit)', () => {
  const sc = writeTmp('sc_win.json', {
    player: { pos: [0, 0, 0], carried: 9, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 2]],
    shades: [],
    lanterns: [
      { id: 'L1', pos: [0, 0, 4], deposited: 0, lit: false },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true },
    ],
    time_left_s: 200,
  });
  const inp = writeTmp('inp_win.json', {
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 40, move: [0, 0], interact: true },
      { tick: 41, interact: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_win.jsonl');
  const res = runHeadless(['--seed', '7', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '200', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.equal(rows[0].type, 'snapshot');
  assert.equal(rows[0].tick, 0);
  assert.equal(rows[0].night, 1);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'mote_picked'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'deposit'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'lantern_lit'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'all_lit'));
  assert.equal(rows.at(-1).state, 'won');
});

// 3. Phase 1 Regression: Shade hit -> recoil -> dropped motes -> Lose (no_flames)
check('Scenario 2 (P1 Regression): Shade hit -> Lose (no_flames)', () => {
  const sc = writeTmp('sc_shade.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 1 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }],
  });
  const out = path.join(OUT_DIR, 'out_shade.jsonl');
  const res = runHeadless(['--seed', '8', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const hit = rows.find((r) => r.type === 'event' && r.name === 'player_hit');
  assert.ok(hit);
  assert.equal(hit.data.by, 'shade');
  assert.equal(hit.data.dropped, 2);
  assert.equal(rows.at(-1).state, 'lost');
});

// 4. Phase 1 Regression: Timeout -> Lose (dawn)
check('Scenario 3 (P1 Regression): Timeout -> Lose (dawn)', () => {
  const sc = writeTmp('sc_dawn.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    time_left_s: 0.5,
  });
  const out = path.join(OUT_DIR, 'out_dawn.jsonl');
  const res = runHeadless(['--seed', '9', '--night', '1', '--scenario', sc, '--ticks', '100', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'dawn'));
  assert.equal(rows.at(-1).state, 'lost');
});

// 5. Phase 2 Feature: Dash
check('Scenario 4 (P2 Dash): Dash event + speed + cooldown', () => {
  const sc = writeTmp('sc_dash.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
  });
  const inp = writeTmp('inp_dash.json', {
    frames: [
      { tick: 0, move: [0, 1], dash: true },
      { tick: 1, dash: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_dash.jsonl');
  const res = runHeadless(['--seed', '20', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '20', '--out', out, '--snapshot-every', '12']);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'dash'));
  const snap12 = rows.find((r) => r.type === 'snapshot' && r.tick === 12);
  assert.ok(snap12.player.pos[2] >= 2.75);
});

// 6. Phase 2 Feature: Pause / Resume
check('Scenario 5 (P2 Pause): Freeze sim_tick & time_left_s while paused', () => {
  const sc = writeTmp('sc_pause.json', {
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
  });
  const inp = writeTmp('inp_pause.json', {
    frames: [
      { tick: 5, pause: true },
      { tick: 6, pause: false },
      { tick: 20, pause: true },
      { tick: 21, pause: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_pause.jsonl');
  const res = runHeadless(['--seed', '21', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '30', '--out', out, '--snapshot-every', '10']);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'paused'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'resumed'));
  const snap10 = rows.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.equal(snap10.state, 'paused');
  assert.equal(snap10.sim_tick, 5);
});

// 7. Phase 2 Feature: Night 2 Jump Pad + Charm + Drifter steal & drop
check('Scenario 6 (P2 Night 2): Drifter steal/drop + Charm + Jump Pad', () => {
  const sc = writeTmp('sc_n2.json', {
    player: { pos: [35, 0, 0], carried: 8, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    motes: [],
    shades: [],
    drifters: [{ id: 'D1', pos: [35.8, 0.8, 0], state: 'chase' }],
  });
  const inp = writeTmp('inp_n2.json', {
    frames: [
      { tick: 2, pulse: true },
      { tick: 3, pulse: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_n2.jsonl');
  const res = runHeadless(['--seed', '22', '--night', '2', '--scenario', sc, '--inputs', inp, '--ticks', '30', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'charm_picked'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'drifter_steal'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'drifter_drop'));
});

// 8. Phase 2 Feature: Night 3 Wind + Multi-tier
check('Scenario 7 (P2 Night 3): Wind activates at 30s and pushes player', () => {
  const sc = writeTmp('sc_n3.json', {
    player: { pos: [0, 0, -25], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: true,
    motes: [],
    shades: [],
    drifters: [],
  });
  const out = path.join(OUT_DIR, 'out_n3.jsonl');
  const res = runHeadless(['--seed', '23', '--night', '3', '--scenario', sc, '--ticks', '1900', '--out', out, '--snapshot-every', '100']);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const windSnap = rows.find((r) => r.type === 'snapshot' && r.wind && r.wind.active === true);
  assert.ok(windSnap, 'Expected wind.active === true during Night 3');
});

// 9. Bad format -> exit code 2
check('Scenario 8: Malformed inputs file exits with code 2', () => {
  const bad = writeTmp('inp_bad.json', {
    frames: [
      { tick: 5, move: [0, 1] },
      { tick: 5, move: [0, 0] },
    ],
  });
  const out = path.join(OUT_DIR, 'out_bad.jsonl');
  const res = runHeadless(['--seed', '12', '--night', '1', '--inputs', bad, '--ticks', '20', '--out', out]);
  assert.equal(res.status, 2);
  assert.ok(res.stderr.length > 0);
});

// 10. Determinism check (Night 3 full features)
check('Scenario 9: Determinism (Night 3 byte-identical across 2 runs)', () => {
  const inp = writeTmp('inp_det.json', {
    frames: [
      { tick: 0, move: [0.4, 0.9], cam_yaw_deg: 30 },
      { tick: 60, jump: true },
      { tick: 61, jump: false },
      { tick: 120, dash: true },
      { tick: 121, dash: false },
    ],
  });
  const out1 = path.join(OUT_DIR, 'out_det1.jsonl');
  const out2 = path.join(OUT_DIR, 'out_det2.jsonl');
  const r1 = runHeadless(['--seed', '42', '--night', '3', '--inputs', inp, '--ticks', '1200', '--out', out1]);
  const r2 = runHeadless(['--seed', '42', '--night', '3', '--inputs', inp, '--ticks', '1200', '--out', out2]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(out1, 'utf8'), fs.readFileSync(out2, 'utf8'));
});

// 11. Performance benchmark: Full Night 3 (21,600 ticks) <= 30s
check('Scenario 10 (Performance DoD): Full Night 3 (21,600 ticks) <= 30s', () => {
  const sc = writeTmp('sc_perf.json', {
    player: { pos: [0, 0, -25], carried: 0, flames: 3 },
    random_motes: true,
    random_shades: true,
    random_drifters: true,
    wind_enabled: true,
  });
  const out = path.join(OUT_DIR, 'out_perf.jsonl');
  const t0 = performance.now();
  const res = runHeadless(['--seed', '99', '--night', '3', '--scenario', sc, '--ticks', '21600', '--out', out, '--snapshot-every', '60']);
  const elapsedMs = performance.now() - t0;
  assert.equal(res.status, 0, res.stderr);
  console.log(`      Full Night 3 headless run finished in ${elapsedMs.toFixed(1)} ms`);
  assert.ok(elapsedMs <= 30000, `Expected <= 30000ms, got ${elapsedMs}ms`);
});

const failed = results.filter((r) => r.status === 'FAIL');
console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
