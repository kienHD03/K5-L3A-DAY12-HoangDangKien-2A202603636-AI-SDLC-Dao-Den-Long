import fs from 'node:fs';
import path from 'node:path';
import { GameSim } from './sim/engine.js';
import { ContractFormatError, InputTape, validateInputs, validateScenario } from './sim/inputs.js';

function parseArgs(argv) {
  const args = {
    seed: null,
    night: null,
    scenario: null,
    inputs: null,
    ticks: null,
    out: null,
    snapshotEvery: 10,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    switch (flag) {
      case '--seed':
        args.seed = Number(val);
        i++;
        break;
      case '--night':
        args.night = Number(val);
        i++;
        break;
      case '--scenario':
        args.scenario = val;
        i++;
        break;
      case '--inputs':
        args.inputs = val;
        i++;
        break;
      case '--ticks':
        args.ticks = Number(val);
        i++;
        break;
      case '--out':
        args.out = val;
        i++;
        break;
      case '--snapshot-every':
        args.snapshotEvery = Number(val);
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!Number.isInteger(args.seed)) throw new Error('Missing or invalid --seed <int>.');
  if (![1, 2, 3].includes(args.night)) {
    throw new Error('Missing or unsupported --night (expected 1, 2, or 3).');
  }
  if (!Number.isInteger(args.ticks) || args.ticks < 0) {
    throw new Error('Missing or invalid --ticks <int>.');
  }
  if (!args.out) throw new Error('Missing required --out <file.jsonl>.');
  if (!Number.isInteger(args.snapshotEvery) || args.snapshotEvery <= 0) {
    throw new Error('Invalid --snapshot-every <int> (must be > 0).');
  }
  return args;
}

function readJsonFile(filePath, label) {
  let rawText;
  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ${label} file "${filePath}": ${err.message}`);
  }
  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw new ContractFormatError(`Invalid JSON in ${label} file "${filePath}": ${err.message}`);
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    let scenario = null;
    if (args.scenario) {
      const rawScenario = readJsonFile(args.scenario, 'scenario');
      scenario = validateScenario(rawScenario);
    }

    let frames = [];
    if (args.inputs) {
      const rawInputs = readJsonFile(args.inputs, 'inputs');
      frames = validateInputs(rawInputs);
    }

    const sim = new GameSim({ seed: args.seed, night: args.night, scenario });
    const tape = new InputTape(frames);
    const lines = [];

    // Tick 0 snapshot (before any input)
    lines.push(JSON.stringify(sim.getSnapshot()));

    for (let k = 0; k < args.ticks; k++) {
      if (sim.state === 'won' || sim.state === 'lost') break;
      const input = tape.getInputForTick(k);
      const events = sim.step(input);
      for (const ev of events) {
        lines.push(JSON.stringify(ev));
      }
      if (sim.tick % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(sim.getSnapshot()));
      }
    }

    lines.push(
      JSON.stringify({
        type: 'end',
        ticks: sim.tick,
        state: sim.state,
        score: sim.score,
      })
    );

    const outDir = path.dirname(path.resolve(args.out));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');
    process.exit(0);
  } catch (err) {
    if (err instanceof ContractFormatError) {
      process.stderr.write(`Format error: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
