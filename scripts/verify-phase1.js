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

// 2. Scenario: Pickup mote, deposit into lantern, win (all_lit)
check('Scenario 1: Pickup -> Deposit -> Lantern Lit -> Win (all_lit)', () => {
  const sc = writeTmp('sc_win.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [[0, 0, 3]],
    shades: [],
    lanterns: [
      { id: 'L1', pos: [0, 0, 5], deposited: 0, lit: false },
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
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'mote_picked'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'deposit'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'lantern_lit'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.result === 'won' && r.data.reason === 'all_lit'));
  const end = rows.at(-1);
  assert.equal(end.type, 'end');
  assert.equal(end.state, 'won');
});

// 3. Scenario: Shade chases player -> player_hit -> no_flames loss
check('Scenario 2: Shade hit -> drop motes -> Lose (no_flames)', () => {
  const sc = writeTmp('sc_shade.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 1 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [3, 0, 0] }],
  });
  const out = path.join(OUT_DIR, 'out_shade.jsonl');
  const res = runHeadless(['--seed', '8', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const hit = rows.find((r) => r.type === 'event' && r.name === 'player_hit');
  assert.ok(hit);
  assert.equal(hit.data.by, 'shade');
  assert.equal(hit.data.flames, 0);
  assert.equal(hit.data.dropped, 2);
  const end = rows.at(-1);
  assert.equal(end.state, 'lost');
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'no_flames'));
});

// 4. Scenario: Dawn timeout loss
check('Scenario 3: Timeout -> Lose (dawn)', () => {
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

// 5. Scenario: Pulse stuns & pushes shade
check('Scenario 4: Pulse stuns and pushes Shade', () => {
  const sc = writeTmp('sc_pulse.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [4, 0, 0] }],
  });
  const inp = writeTmp('inp_pulse.json', {
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_pulse.jsonl');
  const res = runHeadless(['--seed', '10', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '10', '--out', out, '--snapshot-every', '1']);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const pulse = rows.find((r) => r.type === 'event' && r.name === 'pulse');
  assert.ok(pulse);
  assert.deepEqual(pulse.data.stunned_ids, ['S1']);
  const snap1 = rows.find((r) => r.type === 'snapshot' && r.tick === 1);
  assert.equal(snap1.shades[0].state, 'stunned');
});

// 6. Scenario: Fall off island (fall_enabled: true)
check('Scenario 5: Walk off island -> player_hit (fall)', () => {
  const sc = writeTmp('sc_fall.json', {
    player: { pos: [34, 0, 0], carried: 2, flames: 2 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
  });
  const inp = writeTmp('inp_fall.json', {
    frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 0 }],
  });
  const out = path.join(OUT_DIR, 'out_fall.jsonl');
  const res = runHeadless(['--seed', '11', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  const hit = rows.find((r) => r.type === 'event' && r.name === 'player_hit' && r.data.by === 'fall');
  assert.ok(hit, 'Expected fall hit event');
});

// 7. Bad format -> exit code 2
check('Scenario 6: Malformed inputs file exits with code 2', () => {
  const bad = writeTmp('inp_bad.json', {
    frames: [
      { tick: 5, move: [0, 1] },
      { tick: 5, move: [0, 0] },
    ],
  });
  const out = path.join(OUT_DIR, 'out_bad.jsonl');
  const res = runHeadless(['--seed', '12', '--night', '1', '--inputs', bad, '--ticks', '20', '--out', out]);
  assert.equal(res.status, 2, `Expected exit code 2, got ${res.status}`);
  assert.ok(res.stderr.length > 0, 'Expected error message on stderr');
});

// 8. Determinism check
check('Scenario 7: Determinism (2 runs with same seed/inputs are byte-identical)', () => {
  const inp = writeTmp('inp_det.json', {
    frames: [
      { tick: 0, move: [0.4, 0.9], cam_yaw_deg: 30 },
      { tick: 60, jump: true },
      { tick: 61, jump: false },
      { tick: 120, move: [-0.7, 0.3], cam_yaw_deg: 115 },
    ],
  });
  const out1 = path.join(OUT_DIR, 'out_det1.jsonl');
  const out2 = path.join(OUT_DIR, 'out_det2.jsonl');
  const r1 = runHeadless(['--seed', '42', '--night', '1', '--inputs', inp, '--ticks', '600', '--out', out1]);
  const r2 = runHeadless(['--seed', '42', '--night', '1', '--inputs', inp, '--ticks', '600', '--out', out2]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(out1, 'utf8'), fs.readFileSync(out2, 'utf8'));
});

const failed = results.filter((r) => r.status === 'FAIL');
console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
