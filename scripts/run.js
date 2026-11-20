import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { addLeaderboardEntry, sortLeaderboard } from '../src/sim/leaderboard.js';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const LB_FILE = path.join(ROOT, 'data', 'leaderboard.json');

function readLeaderboard() {
  try {
    const raw = JSON.parse(fs.readFileSync(LB_FILE, 'utf8'));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    return sortLeaderboard(entries).slice(0, 10);
  } catch {
    return [];
  }
}

function writeLeaderboard(entries) {
  fs.mkdirSync(path.dirname(LB_FILE), { recursive: true });
  fs.writeFileSync(LB_FILE, JSON.stringify({ entries: sortLeaderboard(entries).slice(0, 10) }, null, 2) + '\n', 'utf8');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startServer(port = 4173) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    process.stderr.write('dist/ not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ entries: readLeaderboard() }));
      return;
    }

    if (url.pathname === '/api/leaderboard' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const updated = addLeaderboardEntry(readLeaderboard(), payload);
          writeLeaderboard(updated);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ entries: updated }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    let reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(DIST_DIR, path.normalize(reqPath));
    if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Đảo Đèn Lồng đang chạy tại http://127.0.0.1:${port}`);
    console.log('Nhấn Ctrl+C để dừng.');
  });
}

function main() {
  const argv = process.argv.slice(2);
  const expIdx = argv.indexOf('--export-leaderboard');
  if (expIdx !== -1) {
    const outPath = argv[expIdx + 1];
    if (!outPath) {
      process.stderr.write('Missing output path for --export-leaderboard <file.json>\n');
      process.exit(1);
    }
    const entries = readLeaderboard();
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  const portIdx = argv.indexOf('--port');
  const port = portIdx !== -1 ? Number(argv[portIdx + 1]) || 4173 : 4173;
  startServer(port);
}

main();
