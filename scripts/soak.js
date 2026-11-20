import fs from 'node:fs';
import path from 'node:path';
import { GameSim } from '../src/sim/engine.js';
import { createRng } from '../src/sim/rng.js';

function parseArgs(argv) {
  const args = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const v = argv[i + 1];
    if (f === '--seed') {
      args.seed = Number(v);
      i++;
    } else if (f === '--nights') {
      args.nights = Number(v);
      i++;
    } else if (f === '--out') {
      args.out = v;
      i++;
    } else {
      throw new Error(`Unknown argument: ${f}`);
    }
  }
  if (!Number.isInteger(args.seed)) throw new Error('Invalid --seed');
  if (!Number.isInteger(args.nights) || args.nights <= 0) throw new Error('Invalid --nights');
  if (!args.out) throw new Error('Missing --out');
  return args;
}

function getRssMb() {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Warm up V8 JIT for GameSim.step() before loading Night 1 so mem_start_mb reflects steady-state runtime RSS
  {
    const warm = new GameSim({ seed: 1, night: 1 });
    for (let w = 0; w < 600; w++) {
      if (warm.state !== 'playing') break;
      warm.step({ move: [0.5, 0.5], cam_yaw_deg: 0, jump: w % 20 === 0, dash: w % 40 === 0, pulse: false, interact: false, pause: false });
    }
  }
  const t0 = performance.now();
  const results = [];
  let crashes = 0;
  let memStartMb = 0;

  for (let i = 0; i < args.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = args.seed + i;
    try {
      let sim = new GameSim({ seed: nightSeed, night });
      if (i === 0) {
        memStartMb = getRssMb();
      }
      const inputRng = createRng(nightSeed ^ 0x9e3779b9);
      const maxTicks = Math.ceil(sim.initialTimeLeftS * 60) + 10;
      let move = [0, 0];

      for (let t = 0; t < maxTicks; t++) {
        if (sim.state === 'won' || sim.state === 'lost') break;
        if (t % 30 === 0) {
          const ang = inputRng() * Math.PI * 2;
          move = [Math.cos(ang), Math.sin(ang)];
        }
        sim.step({
          move,
          cam_yaw_deg: 0,
          jump: inputRng() < 0.05,
          dash: inputRng() < 0.03,
          pulse: inputRng() < 0.02,
          interact: inputRng() < 0.1,
          pause: false,
        });
      }

      results.push(sim.state === 'won' ? 'won' : 'lost');
      sim = null;
    } catch (err) {
      crashes++;
      results.push('crash');
      process.stderr.write(`Night ${i + 1} crashed: ${err.message}\n`);
    }
  }

  const memEndMb = getRssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const output = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const outDir = path.dirname(path.resolve(args.out));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output));
  process.exit(crashes === 0 ? 0 : 1);
}

main();
