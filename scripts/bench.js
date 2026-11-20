import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

function parseArgs(argv) {
  const args = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const v = argv[i + 1];
    if (f === '--seed') {
      args.seed = Number(v);
      i++;
    } else if (f === '--duration') {
      args.duration = Number(v);
      i++;
    } else if (f === '--out') {
      args.out = v;
      i++;
    } else {
      throw new Error(`Unknown argument: ${f}`);
    }
  }
  if (!Number.isInteger(args.seed)) throw new Error('Invalid --seed');
  if (!Number.isFinite(args.duration) || args.duration <= 0) throw new Error('Invalid --duration');
  if (!args.out) throw new Error('Missing --out');
  return args;
}

function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  for (const cmd of ['google-chrome', 'chromium', 'chromium-browser', 'msedge', 'chrome']) {
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const found = execFileSync(which, [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)[0]
        .trim();
      if (found) return found;
    } catch {
      // continue
    }
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function main() {
  const procStart = performance.now();
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    process.stderr.write('dist/ not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    process.stderr.write('No Chrome/Chromium/Edge browser found to run WebGL benchmark.\n');
    process.exit(1);
  }

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  let browserProc = null;
  let finished = false;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/api/bench-done' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const loadMs = Math.round(data.load_ms || performance.now() - procStart);
          const outObj = {
            contract_version: '1.3',
            avg_fps: data.avg_fps,
            p1_low_fps: data.p1_low_fps,
            frame_ms_p95: data.frame_ms_p95,
            frames: data.frames,
            load_ms: loadMs,
            peak_mem_mb: data.peak_mem_mb ?? null,
            vsync_off: true,
            renderer: data.renderer || 'Three.js 0.170 WebGL2 (Chromium)',
            os: `${os.platform()} ${os.release()} (${os.arch()})`,
          };
          fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
          fs.writeFileSync(args.out, JSON.stringify(outObj, null, 2) + '\n', 'utf8');
          console.log(JSON.stringify(outObj, null, 2));
          finished = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          setTimeout(() => cleanup(0), 150);
        } catch (err) {
          res.writeHead(400);
          res.end(err.message);
          cleanup(1);
        }
      });
      return;
    }

    const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(DIST_DIR, path.normalize(reqPath));
    if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  function cleanup(code) {
    if (browserProc && !browserProc.killed) {
      try {
        browserProc.kill();
      } catch {
        // ignore
      }
    }
    server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    process.exit(code);
  }

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const benchUrl = `http://127.0.0.1:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}&t0=${Date.now()}`;
    const flags = [
      `--app=${benchUrl}`,
      '--window-size=1280,720',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      `--user-data-dir=${profileDir}`,
    ];
    browserProc = spawn(browserPath, flags, { stdio: 'ignore' });
    browserProc.on('exit', () => {
      if (!finished) {
        process.stderr.write('Browser exited before benchmark completed.\n');
        cleanup(1);
      }
    });

    const timeoutMs = (args.duration + 30) * 1000;
    setTimeout(() => {
      if (!finished) {
        process.stderr.write('Benchmark timed out.\n');
        cleanup(1);
      }
    }, timeoutMs);
  });
}

main();
