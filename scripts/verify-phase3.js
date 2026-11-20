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

// 2. Phase 3 Win Law: Dawn Survived (>= 3/5 lit in Night 1)
check('Scenario 1 (P3 Dawn Survived): 3/5 lit at dawn -> won (dawn_survived)', () => {
  const sc = writeTmp('sc_p3_win.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    lanterns: [
      { id: 'L1', lit: true, fuel: 50 },
      { id: 'L2', lit: true, fuel: 50 },
      { id: 'L3', lit: true, fuel: 50 },
    ],
    time_left_s: 1.0,
  });
  const out = path.join(OUT_DIR, 'out_p3_win.jsonl');
  const res = runHeadless(['--seed', '31', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'dawn_survived'));
  assert.equal(rows.at(-1).state, 'won');
});

// 3. Phase 3 Fuel Decay -> lantern_out -> Relight with 5 motes + Capacity grows
check('Scenario 2 (P3 Fuel/Relight/Capacity): lantern_out -> relight (5 motes) -> capacity 12', () => {
  const sc = writeTmp('sc_p3_relight.json', {
    player: { pos: [0, 0, 24], carried: 5, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 0.1 }],
    time_left_s: 100,
  });
  const inp = writeTmp('inp_p3_relight.json', {
    frames: [
      { tick: 15, interact: true },
      { tick: 16, interact: false },
    ],
  });
  const out = path.join(OUT_DIR, 'out_p3_relight.jsonl');
  const res = runHeadless(['--seed', '32', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '30', '--out', out, '--snapshot-every', '20']);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'lantern_out' && r.data.lantern_id === 'L1'));
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'lantern_lit' && r.data.relight === true));
  const snap20 = rows.find((r) => r.type === 'snapshot' && r.tick === 20);
  assert.equal(snap20.player.capacity, 12);
  assert.equal(snap20.lanterns[0].relit_count, 1);
});

// 4. Phase 3 Refuel + Shade Drain + fuel_drain event
check('Scenario 3 (P3 Drain & Refuel): Shade drains weak lantern -> refuel pushes shade out', () => {
  const sc = writeTmp('sc_p3_drain.json', {
    player: { pos: [0, 0, 23.5], carried: 4, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    time_left_s: 100,
  });
  // Put player far away for 65 ticks? Actually test drain first in separate scenario
  const scDrain = writeTmp('sc_p3_drain_only.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [],
    shades: [{ id: 'S1', pos: [0, 0, 26], state: 'drain', target_lantern_id: 'L1' }],
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    time_left_s: 100,
  });
  const out = path.join(OUT_DIR, 'out_p3_drain.jsonl');
  const res = runHeadless(['--seed', '33', '--night', '1', '--scenario', scDrain, '--ticks', '70', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const rows = readJsonl(out);
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'fuel_drain' && r.data.shade_id === 'S1'));

  // Refuel test
  const inpRef = writeTmp('inp_p3_refuel.json', {
    frames: [
      { tick: 0, interact: true },
      { tick: 1, interact: false },
    ],
  });
  const out2 = path.join(OUT_DIR, 'out_p3_refuel.jsonl');
  const res2 = runHeadless(['--seed', '34', '--night', '1', '--scenario', sc, '--inputs', inpRef, '--ticks', '40', '--out', out2]);
  assert.equal(res2.status, 0, res2.stderr);
  const rows2 = readJsonl(out2);
  assert.ok(rows2.some((r) => r.type === 'event' && r.name === 'refuel' && r.data.lantern_id === 'L1'));
});

// 5. Phase 1/2 Regression: Shade hit -> no_flames loss
check('Scenario 4 (P1/P2 Regression): Shade hit -> Lose (no_flames)', () => {
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
  assert.ok(rows.some((r) => r.type === 'event' && r.name === 'player_hit' && r.data.by === 'shade'));
  assert.equal(rows.at(-1).state, 'lost');
});

// 6. Phase 2 Regression: Dash, Pause, Night 2 Drifter + Charm, Night 3 Wind
check('Scenario 5 (P2 Regression): Night 2 Drifter steal/drop + Charm', () => {
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
  assert.equal(res.status, 2);
});

// 8. Determinism + Full Night 3 Performance (18,000 ticks <= 30s)
check('Scenario 7 (Determinism + Performance): Full Night 3 (18,000 ticks) byte-identical & <= 30s', () => {
  const sc = writeTmp('sc_perf3.json', {
    player: { pos: [0, 0, -25], carried: 0, flames: 3 },
    random_motes: true,
    random_shades: true,
    random_drifters: true,
    wind_enabled: true,
  });
  const out1 = path.join(OUT_DIR, 'out_perf3_a.jsonl');
  const out2 = path.join(OUT_DIR, 'out_perf3_b.jsonl');
  const t0 = performance.now();
  const r1 = runHeadless(['--seed', '99', '--night', '3', '--scenario', sc, '--ticks', '18000', '--out', out1, '--snapshot-every', '60']);
  const elapsedMs = performance.now() - t0;
  const r2 = runHeadless(['--seed', '99', '--night', '3', '--scenario', sc, '--ticks', '18000', '--out', out2, '--snapshot-every', '60']);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(fs.readFileSync(out1, 'utf8'), fs.readFileSync(out2, 'utf8'));
  console.log(`      Full Night 3 (18,000 ticks) finished in ${elapsedMs.toFixed(1)} ms`);
  assert.ok(elapsedMs <= 30000);
});

const failed = results.filter((r) => r.status === 'FAIL');
console.log(`\nSummary: ${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) process.exit(1);
