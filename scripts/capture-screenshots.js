import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  for (const cmd of ['google-chrome', 'chromium', 'msedge', 'chrome']) {
    try {
      const found = execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpSend(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', onMsg);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const browserPath = findBrowser();
  if (!browserPath) {
    process.stderr.write('No Chrome/Edge found.\n');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/leaderboard') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"entries":[]}');
      return;
    }
    const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const fp = path.join(DIST_DIR, path.normalize(reqPath));
    if (!fp.startsWith(DIST_DIR) || !fs.existsSync(fp)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const cdpPort = 9229;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-shots-'));

  const browser = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      '--window-size=1280,720',
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--user-data-dir=${profileDir}`,
      `http://127.0.0.1:${port}/`,
    ],
    { stdio: 'ignore' }
  );

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {
        // wait
      }
      await sleep(200);
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let cid = 1;

    await cdpSend(ws, cid++, 'Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(1000);

    // 1. Main Menu
    const shotMenu = await cdpSend(ws, cid++, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'menu.png'), Buffer.from(shotMenu.data, 'base64'));
    console.log('Saved docs/screenshots/menu.png');

    // 2. Settings & Accessibility
    await cdpSend(ws, cid++, 'Runtime.evaluate', {
      expression: `document.getElementById('btn-menu-settings').click()`,
    });
    await sleep(400);
    const shotSettings = await cdpSend(ws, cid++, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'settings.png'), Buffer.from(shotSettings.data, 'base64'));
    console.log('Saved docs/screenshots/settings.png');

    // 3. Gameplay (Night 1)
    await cdpSend(ws, cid++, 'Runtime.evaluate', {
      expression: `document.getElementById('btn-settings-close').click(); document.getElementById('btn-play').click(); document.getElementById('btn-start-night').click();`,
    });
    await sleep(1200);
    const shotGame = await cdpSend(ws, cid++, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'gameplay.png'), Buffer.from(shotGame.data, 'base64'));
    console.log('Saved docs/screenshots/gameplay.png');

    ws.close();
  } finally {
    try {
      browser.kill();
    } catch {
      // ignore
    }
    server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  process.stderr.write(err.message + '\n');
  process.exit(1);
});
