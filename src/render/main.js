import * as THREE from 'three';
import { GameSim, distXZ } from '../sim/engine.js';
import { SIM_CONSTANTS, TUNING, PALETTE } from '../sim/config.js';
import { getNightMap } from '../sim/maps.js';
import { createRng } from '../sim/rng.js';
import { addLeaderboardEntry, isValidLeaderboardName, sortLeaderboard } from '../sim/leaderboard.js';
import { SoundFX } from './audio.js';

const params = new URLSearchParams(window.location.search);
const IS_BENCH = params.get('bench') === '1';

// Default keybindings & Settings persisted in localStorage
const SETTINGS_KEY = 'dao_den_long_settings_v4';
const LB_LOCAL_KEY = 'dao_den_long_leaderboard';

const DEFAULT_KEYS = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'Escape',
};

const KEY_LABELS = {
  moveUp: 'Đi tới',
  moveDown: 'Đi lùi',
  moveLeft: 'Sang trái',
  moveRight: 'Sang phải',
  jump: 'Nhảy',
  dash: 'Lướt (Dash)',
  interact: 'Tương tác / Nạp đèn',
  pulse: 'Tỏa Sáng (Pulse)',
  pause: 'Tạm dừng',
};

function loadSettings() {
  try {
    const p = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      volume: typeof p.volume === 'number' ? p.volume : 70,
      sensitivity: typeof p.sensitivity === 'number' ? p.sensitivity : 0.3,
      colorblind: Boolean(p.colorblind),
      reducedMotion: Boolean(p.reducedMotion),
      largeText: Boolean(p.largeText),
      keys: { ...DEFAULT_KEYS, ...(p.keys || {}) },
    };
  } catch {
    return {
      volume: 70,
      sensitivity: 0.3,
      colorblind: false,
      reducedMotion: false,
      largeText: false,
      keys: { ...DEFAULT_KEYS },
    };
  }
}

const settings = loadSettings();
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function applyAccessibilityClasses() {
  document.body.classList.toggle('colorblind', settings.colorblind);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('large-text', settings.largeText);
}
applyAccessibilityClasses();

const sfx = new SoundFX();
sfx.setVolume(IS_BENCH ? 0 : settings.volume / 100);

// DOM Elements
const root = document.getElementById('canvas-root');
const hitFlash = document.getElementById('hit-flash');
const captionsEl = document.getElementById('captions');
const hud = document.getElementById('hud');
const hudFlames = document.getElementById('hud-flames');
const hudCharm = document.getElementById('hud-charm');
const hudTime = document.getElementById('hud-time');
const hudWind = document.getElementById('hud-wind');
const hudLanterns = document.getElementById('hud-lanterns');
const hudScore = document.getElementById('hud-score');
const hudInteract = document.getElementById('hud-interact');
const hudMoteBar = document.getElementById('hud-mote-bar');
const hudCapacity = document.getElementById('hud-capacity');
const hudDash = document.getElementById('hud-dash');
const hudPulse = document.getElementById('hud-pulse');
const lanternArrow = document.getElementById('lantern-arrow');
const shadeArrow = document.getElementById('shade-arrow');

const screenMenu = document.getElementById('screen-menu');
const screenIntro = document.getElementById('screen-intro');
const screenPause = document.getElementById('screen-pause');
const screenSettings = document.getElementById('screen-settings');
const screenLeaderboard = document.getElementById('screen-leaderboard');
const screenResult = document.getElementById('screen-result');

const introBadge = document.getElementById('intro-badge');
const introTitle = document.getElementById('intro-title');
const introQuote = document.getElementById('intro-quote');

const resultBadge = document.getElementById('result-badge');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const resultStats = document.getElementById('result-stats');
const btnResultPrimary = document.getElementById('btn-result-primary');
const lbSaveBox = document.getElementById('lb-save-box');
const lbNameInput = document.getElementById('lb-name-input');
const lbSaveMsg = document.getElementById('lb-save-msg');
const lbTableWrap = document.getElementById('lb-table-wrap');

const optVolume = document.getElementById('opt-volume');
const optVolumeVal = document.getElementById('opt-volume-val');
const optSens = document.getElementById('opt-sens');
const optSensVal = document.getElementById('opt-sens-val');
const optColorblind = document.getElementById('opt-colorblind');
const optReducedMotion = document.getElementById('opt-reduced-motion');
const optLargeText = document.getElementById('opt-large-text');
const keybindList = document.getElementById('keybind-list');
const keybindMsg = document.getElementById('keybind-msg');

optVolume.value = String(settings.volume);
optVolumeVal.textContent = `${settings.volume}%`;
optSens.value = String(Math.round(settings.sensitivity * 100));
optSensVal.textContent = settings.sensitivity.toFixed(2);
optColorblind.checked = settings.colorblind;
optReducedMotion.checked = settings.reducedMotion;
optLargeText.checked = settings.largeText;

// Dynamic mote bar (up to 20 slots)
const moteSlots = [];
for (let i = 0; i < TUNING.capacity_max; i++) {
  const slot = document.createElement('div');
  slot.className = 'mote-slot';
  hudMoteBar.appendChild(slot);
  moteSlots.push(slot);
}

// Visual captions helper (accessibility)
function showCaption(text, durationMs = 2600) {
  if (IS_BENCH) return;
  const item = document.createElement('div');
  item.className = 'caption-item';
  item.textContent = text;
  captionsEl.appendChild(item);
  setTimeout(() => item.remove(), durationMs);
}

// Keybinding UI
let listeningAction = null;
function renderKeybinds() {
  keybindList.innerHTML = '';
  for (const [action, label] of Object.entries(KEY_LABELS)) {
    const lbl = document.createElement('div');
    lbl.textContent = label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'keybind-btn' + (listeningAction === action ? ' listening' : '');
    btn.textContent = listeningAction === action ? 'Nhấn phím...' : settings.keys[action];
    btn.addEventListener('click', () => {
      listeningAction = action;
      keybindMsg.classList.add('hidden');
      renderKeybinds();
    });
    keybindList.append(lbl, btn);
  }
}
renderKeybinds();

// Leaderboard persistence (local disk API via scripts/run.js + localStorage mirror)
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(data.entries));
        return sortLeaderboard(data.entries).slice(0, 10);
      }
    }
  } catch {
    // fallback to localStorage
  }
  try {
    return sortLeaderboard(JSON.parse(localStorage.getItem(LB_LOCAL_KEY) || '[]')).slice(0, 10);
  } catch {
    return [];
  }
}

async function persistLeaderboardEntry(entry) {
  const localCurrent = await fetchLeaderboard();
  const updated = addLeaderboardEntry(localCurrent, entry);
  try {
    localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) {
      const data = await res.json();
      return data.entries;
    }
  } catch {
    // fallback already saved to localStorage
  }
  return updated;
}

function showOnlyScreen(target) {
  for (const el of [screenMenu, screenIntro, screenPause, screenSettings, screenLeaderboard, screenResult]) {
    el.classList.toggle('hidden', el !== target);
  }
}

async function openLeaderboard() {
  const entries = await fetchLeaderboard();
  if (entries.length === 0) {
    lbTableWrap.innerHTML = '<p>Chưa có thành tích nào được lưu.</p>';
  } else {
    const rows = entries
      .map(
        (e, i) => `
      <tr>
        <td>#${i + 1}</td>
        <td>${e.name}</td>
        <td><strong>${e.score}</strong></td>
        <td>${e.nights_won}/3</td>
        <td>${new Date(e.achieved_at).toLocaleDateString('vi-VN')}</td>
      </tr>`
      )
      .join('');
    lbTableWrap.innerHTML = `
      <table class="lb-table">
        <thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }
  showOnlyScreen(screenLeaderboard);
}

// Three.js Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: !IS_BENCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(IS_BENCH ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !IS_BENCH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.SKY);
scene.fog = new THREE.FogExp2(PALETTE.FOG, 0.011);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);

const ambientLight = new THREE.AmbientLight(0xd6def8, 0.15);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0xc2d4ff, 0.55);
moonLight.position.set(35, 55, 25);
if (!IS_BENCH) {
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  const dShadow = 55;
  moonLight.shadow.camera.left = -dShadow;
  moonLight.shadow.camera.right = dShadow;
  moonLight.shadow.camera.top = dShadow;
  moonLight.shadow.camera.bottom = -dShadow;
}
scene.add(moonLight);

const cloudSea = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshBasicMaterial({ color: PALETTE.CLOUD_SEA })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -11;
scene.add(cloudSea);

const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 320; i++) {
  const theta = (i * 137.5 * Math.PI) / 180;
  const phi = Math.acos(0.15 + ((i * 73) % 100) / 120);
  const r = 180;
  starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffe9b0, size: 1.2 })));

const windLeaves = [];
const leafGeo = new THREE.PlaneGeometry(0.4, 0.2);
const leafMat = new THREE.MeshBasicMaterial({ color: PALETTE.SAND, side: THREE.DoubleSide });
for (let i = 0; i < 40; i++) {
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.visible = false;
  scene.add(leaf);
  windLeaves.push({ mesh: leaf, offset: [(i * 17) % 30 - 15, 1 + (i % 5), (i * 23) % 30 - 15] });
}

function createMayMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: PALETTE.MAY_CLOAK, roughness: 0.8 })
  );
  body.position.y = 0.58;
  group.add(body);
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.08, 8, 18),
    new THREE.MeshStandardMaterial({ color: PALETTE.MAY_SCARF_CHARM, roughness: 0.6 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.12;
  group.add(scarf);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.7 })
  );
  head.position.y = 1.34;
  group.add(head);
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: PALETTE.SAND, roughness: 0.8 })
  );
  hat.position.y = 1.62;
  group.add(hat);
  const miniLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshStandardMaterial({
      color: PALETTE.LANTERN_CORE,
      emissive: PALETTE.LANTERN_LIT,
      emissiveIntensity: 2.0,
    })
  );
  miniLantern.position.set(0, 1.22, 0.56);
  group.add(miniLantern);
  const light = new THREE.PointLight(PALETTE.LANTERN_LIT, 4.5, 14, 1.6);
  light.position.set(0, 1.4, 0.56);
  group.add(light);
  return { group, light };
}
const mayVisual = createMayMesh();
scene.add(mayVisual.group);

const pulseWave = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.95, 48),
  new THREE.MeshBasicMaterial({ color: PALETTE.MOTE_GLOW, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
pulseWave.rotation.x = -Math.PI / 2;
scene.add(pulseWave);
let pulseAnimT = 0;

let mapGroup = new THREE.Group();
scene.add(mapGroup);
const lanternVisuals = new Map();
const moteVisuals = new Map();
const shadeVisuals = new Map();
const drifterVisuals = new Map();
const charmVisuals = new Map();

function buildMapGeometry(night) {
  scene.remove(mapGroup);
  mapGroup = new THREE.Group();
  const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.GRASS, roughness: 0.92 });
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.SAND, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.WOOD, roughness: 0.88 });
  const padMat = new THREE.MeshStandardMaterial({
    color: PALETTE.GOLD_ACCENT,
    emissive: PALETTE.LANTERN_LIT,
    emissiveIntensity: 0.8,
  });

  if (night === 1) {
    const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 38.5, 2.2, 64), grassMat);
    island.position.y = -1.1;
    island.receiveShadow = true;
    mapGroup.add(island);
    const rim = new THREE.Mesh(new THREE.RingGeometry(37.5, 40, 64), sandMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.02;
    mapGroup.add(rim);
  } else if (night === 2) {
    for (const cx of [0, 70]) {
      const isl = new THREE.Mesh(new THREE.CylinderGeometry(28, 26.8, 2.2, 56), grassMat);
      isl.position.set(cx, -1.1, 0);
      isl.receiveShadow = true;
      mapGroup.add(isl);
      const rim = new THREE.Mesh(new THREE.RingGeometry(26, 28, 56), sandMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(cx, 0.02, 0);
      mapGroup.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 4), woodMat);
    bridge.position.set(35, -0.2, 0);
    mapGroup.add(bridge);
  } else if (night === 3) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(45, 43.5, 2.2, 64), grassMat);
    base.position.y = -1.1;
    base.receiveShadow = true;
    mapGroup.add(base);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 });
    tier1Geo.rotateX(Math.PI / 2);
    const tier1 = new THREE.Mesh(tier1Geo, grassMat);
    tier1.position.y = 3;
    mapGroup.add(tier1);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 36), sandMat);
    tier2.position.y = 3;
    mapGroup.add(tier2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), woodMat);
    tower.position.y = 10;
    mapGroup.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 12), woodMat);
    roof.position.y = 15.1;
    mapGroup.add(roof);
    const rampLen = Math.hypot(6, 3);
    const slopeAngle = Math.atan2(3, 6);
    for (const deg of [30, 150]) {
      const rad = (deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.3, 3), woodMat);
      ramp.position.set(Math.cos(rad) * 27, 1.35, Math.sin(rad) * 27);
      ramp.rotation.order = 'YXZ';
      ramp.rotation.y = -rad;
      ramp.rotation.z = -slopeAngle;
      mapGroup.add(ramp);
    }
  }

  const mapDef = getNightMap(night);
  for (const pad of mapDef.jumpPads) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius * 1.1, 0.25, 24), padMat);
    disc.position.set(pad.pos[0], pad.pos[1] + 0.12, pad.pos[2]);
    mapGroup.add(disc);
  }
  scene.add(mapGroup);
}

function createLanternMesh(l) {
  const group = new THREE.Group();
  group.position.set(l.pos[0], l.pos[1], l.pos[2]);
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 3.0, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.WOOD, roughness: 0.85 })
  );
  post.position.y = 1.5;
  group.add(post);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: PALETTE.LANTERN_UNLIT,
    emissive: PALETTE.LANTERN_LIT,
    emissiveIntensity: 0.08,
  });
  const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), bulbMat);
  bulb.position.y = 3.35;
  group.add(bulb);

  const tearGroup = new THREE.Group();
  const tearMat = new THREE.MeshBasicMaterial({ color: 0x1a1c26 });
  for (let i = 0; i < 3; i++) {
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), tearMat);
    const a = (i * 2 * Math.PI) / 3;
    tear.position.set(Math.cos(a) * 0.56, 3.35, Math.sin(a) * 0.56);
    tear.rotation.z = 0.25;
    tearGroup.add(tear);
  }
  group.add(tearGroup);

  const fuelBarGroup = new THREE.Group();
  fuelBarGroup.position.y = 4.45;
  const fuelBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.2),
    new THREE.MeshBasicMaterial({ color: 0x0e1430, side: THREE.DoubleSide })
  );
  const fuelFillMat = new THREE.MeshBasicMaterial({ color: PALETTE.LANTERN_LIT, side: THREE.DoubleSide });
  const fuelFill = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.13), fuelFillMat);
  fuelFill.position.z = 0.01;
  fuelBarGroup.add(fuelBg, fuelFill);
  fuelBarGroup.visible = false;
  group.add(fuelBarGroup);

  const light = new THREE.PointLight(PALETTE.LANTERN_LIT, 0, 24, 1.4);
  light.position.y = 3.4;
  group.add(light);

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.LANTERN_LIT, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.06;
  group.add(safeRing);

  scene.add(group);
  return { group, bulb, bulbMat, tearGroup, fuelBarGroup, fuelFill, fuelFillMat, light, safeRing };
}

function createMoteMesh() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.MOTE_CORE, emissive: PALETTE.MOTE_GLOW, emissiveIntensity: 2.0 })
  );
  scene.add(mesh);
  return mesh;
}

function createShadeMesh() {
  const group = new THREE.Group();
  const rim = settings.colorblind ? PALETTE.SHADE_RIM_CB : PALETTE.SHADE_RIM;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: PALETTE.SHADE_BODY,
    emissive: rim,
    emissiveIntensity: 0.6,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 12), bodyMat);
  body.position.y = 0.95;
  group.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: rim });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
  leftEye.position.set(-0.18, 1.25, 0.36);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.18;
  group.add(leftEye, rightEye);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.06, 8, 20),
    new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_ACCENT, transparent: true, opacity: 0 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.0;
  group.add(halo);
  scene.add(group);
  return { group, bodyMat, eyeMat, halo };
}

function createDrifterMesh() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 1.6),
    new THREE.MeshStandardMaterial({ color: PALETTE.DRIFTER, emissive: 0x3b4d63, emissiveIntensity: 0.6 })
  );
  scene.add(mesh);
  return mesh;
}

function createCharmMesh(c) {
  const group = new THREE.Group();
  group.position.set(c.pos[0], c.pos[1] + 1.0, c.pos[2]);
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.75, 0.08),
    new THREE.MeshStandardMaterial({ color: PALETTE.MAY_SCARF_CHARM, emissive: 0x6b0818, emissiveIntensity: 0.6 })
  );
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.83, 0.05),
    new THREE.MeshStandardMaterial({ color: PALETTE.GOLD_ACCENT, emissive: PALETTE.GOLD_ACCENT, emissiveIntensity: 0.5 })
  );
  group.add(border, card);
  scene.add(group);
  return group;
}

// =========================================================================
// BENCHMARK MODE (?bench=1&seed=42&duration=30)
// =========================================================================
if (IS_BENCH) {
  for (const el of [screenMenu, screenIntro, screenPause, screenSettings, screenLeaderboard, screenResult, hud]) {
    el.classList.add('hidden');
  }
  const seed = Number(params.get('seed')) || 42;
  const durationS = Number(params.get('duration')) || 30;
  const t0Param = Number(params.get('t0')) || Date.now();
  const rng = createRng(seed);

  buildMapGeometry(1);
  const map1 = getNightMap(1);
  const benchLanterns = map1.lanterns.map((l, idx) => ({
    id: l.id,
    pos: [...l.pos],
    lit: idx < 3,
    fuel: idx < 3 ? 100 : 0,
  }));
  ambientLight.intensity = 0.15 + 0.55 * (3 / 5);

  for (const l of benchLanterns) {
    const v = createLanternMesh(l);
    v.bulbMat.color.setHex(l.lit ? PALETTE.LANTERN_CORE : PALETTE.LANTERN_UNLIT);
    v.bulbMat.emissiveIntensity = l.lit ? 2.4 : 0.08;
    v.bulb.scale.set(1, l.lit ? 1 : 0.8, 1);
    v.tearGroup.visible = !l.lit;
    v.light.intensity = l.lit ? 22 : 0;
    v.safeRing.material.opacity = l.lit ? 0.25 : 0;
  }

  // InstancedMesh for 200 Shades + 100 Motes (high FPS)
  const SHADE_COUNT = 200;
  const MOTE_COUNT = 100;
  const shadeInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.65, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: PALETTE.SHADE_BODY, emissive: PALETTE.SHADE_RIM, emissiveIntensity: 0.6 }),
    SHADE_COUNT
  );
  const moteInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.24, 8, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.MOTE_CORE, emissive: PALETTE.MOTE_GLOW, emissiveIntensity: 2.0 }),
    MOTE_COUNT
  );
  scene.add(shadeInst, moteInst);

  const benchShades = [];
  for (let i = 0; i < SHADE_COUNT; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 38;
    benchShades.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      angle: rng() * Math.PI * 2,
      changeTicks: 60 + Math.floor(rng() * 90),
    });
  }

  const dummy = new THREE.Object3D();
  for (let i = 0; i < MOTE_COUNT; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 37;
    dummy.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
    dummy.updateMatrix();
    moteInst.setMatrixAt(i, dummy.matrix);
  }
  moteInst.instanceMatrix.needsUpdate = true;

  const WARMUP_MS = 3000;
  const MEASURE_MS = durationS * 1000;
  let firstFrameTime = 0;
  let prevFrameTime = 0;
  let loadMs = 0;
  const dts = [];

  function benchLoop(now) {
    if (!firstFrameTime) {
      firstFrameTime = now;
      prevFrameTime = now;
      loadMs = Math.max(1, Date.now() - t0Param);
    }
    const dtMs = Math.max(0.01, now - prevFrameTime);
    prevFrameTime = now;
    const elapsedMs = now - firstFrameTime;

    // Update 200 shades wandering
    const dtSec = Math.min(0.05, dtMs / 1000);
    for (let i = 0; i < SHADE_COUNT; i++) {
      const s = benchShades[i];
      s.changeTicks -= 1;
      if (s.changeTicks <= 0) {
        s.angle = rng() * Math.PI * 2;
        s.changeTicks = 90 + Math.floor(rng() * 60);
      }
      let nx = s.x + Math.cos(s.angle) * SIM_CONSTANTS.SHADE_WANDER_SPEED * dtSec;
      let nz = s.z + Math.sin(s.angle) * SIM_CONSTANTS.SHADE_WANDER_SPEED * dtSec;
      if (Math.hypot(nx, nz) > 39) {
        s.angle += Math.PI * 0.75;
      } else {
        s.x = nx;
        s.z = nz;
      }
      // Enforce lit L1-L3 safe radius 6m
      for (let li = 0; li < 3; li++) {
        const l = benchLanterns[li];
        const dx = s.x - l.pos[0];
        const dz = s.z - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 6.0 && d > 1e-5) {
          s.x = l.pos[0] + (dx / d) * 6.01;
          s.z = l.pos[2] + (dz / d) * 6.01;
        }
      }
      dummy.position.set(s.x, 0.95, s.z);
      dummy.updateMatrix();
      shadeInst.setMatrixAt(i, dummy.matrix);
    }
    shadeInst.instanceMatrix.needsUpdate = true;

    // Camera orbit: r=30, Y=15, CCW from (30,15,0), 15s/rev
    const ang = ((elapsedMs / 1000) / 15) * Math.PI * 2;
    camera.position.set(Math.cos(ang) * 30, 15, Math.sin(ang) * 30);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (elapsedMs >= WARMUP_MS) {
      dts.push(dtMs);
    }

    if (elapsedMs >= WARMUP_MS + MEASURE_MS) {
      const N = dts.length;
      const sumDt = dts.reduce((a, b) => a + b, 0);
      const avgFps = Math.round(((1000 * N) / sumDt) * 10) / 10;
      const sortedDesc = [...dts].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(0.01 * N));
      const topKMean = sortedDesc.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const p1LowFps = Math.round((1000 / topKMean) * 10) / 10;
      const sortedAsc = [...dts].sort((a, b) => a - b);
      const p95Idx = Math.min(N - 1, Math.floor(0.95 * N));
      const frameMsP95 = Math.round(sortedAsc[p95Idx] * 10) / 10;
      const memMb = performance.memory
        ? Math.round((performance.memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        : null;

      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'WebGL2';

      fetch('/api/bench-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avg_fps: avgFps,
          p1_low_fps: p1LowFps,
          frame_ms_p95: frameMsP95,
          frames: N,
          load_ms: loadMs,
          peak_mem_mb: memMb,
          renderer: `Three.js 0.170 / ${gpu}`,
        }),
      });
      return;
    }

    requestAnimationFrame(benchLoop);
  }

  requestAnimationFrame(benchLoop);
} else {
  // =========================================================================
  // NORMAL GAMEPLAY MODE
  // =========================================================================
  let appMode = 'menu';
  let settingsReturnMode = 'menu';
  let currentNight = 1;
  let currentSeed = 1;
  let totalCampaignScore = 0;
  let nightsWonCount = 0;
  let sim = null;
  let camYawDeg = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastCountdownSec = -1;
  let prevWindTelegraph = false;
  let cameraShakeT = 0;
  let alertedLowFuelIds = new Set();
  let recentShadePos = null;
  let recentShadeTimer = 0;

  const keys = new Set();
  let pendingJump = false;
  let pendingInteract = false;
  let pendingPulse = false;
  let pendingDash = false;
  let pendingPause = false;

  function clearDynamicVisuals() {
    for (const v of lanternVisuals.values()) scene.remove(v.group);
    lanternVisuals.clear();
    for (const m of moteVisuals.values()) scene.remove(m);
    moteVisuals.clear();
    for (const s of shadeVisuals.values()) scene.remove(s.group);
    shadeVisuals.clear();
    for (const d of drifterVisuals.values()) scene.remove(d);
    drifterVisuals.clear();
    for (const c of charmVisuals.values()) scene.remove(c);
    charmVisuals.clear();
  }

  function openIntro(night) {
    currentNight = night;
    const m = getNightMap(night);
    introBadge.textContent = `Đêm ${night} / 3`;
    introTitle.textContent = m.name;
    introQuote.textContent = m.introQuote;
    appMode = 'intro';
    hud.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    shadeArrow.classList.add('hidden');
    showOnlyScreen(screenIntro);
  }

  function startNight(night) {
    currentNight = night;
    currentSeed = (Date.now() ^ (night * 997)) & 0xffffff;
    clearDynamicVisuals();
    buildMapGeometry(night);
    sim = new GameSim({ seed: currentSeed, night });
    for (const l of sim.lanterns) lanternVisuals.set(l.id, createLanternMesh(l));
    for (const c of sim.charms) charmVisuals.set(c.id, createCharmMesh(c));
    camYawDeg = 0;
    pulseAnimT = 0;
    lastCountdownSec = -1;
    prevWindTelegraph = false;
    alertedLowFuelIds = new Set();
    recentShadePos = null;
    recentShadeTimer = 0;
    appMode = 'playing';
    showOnlyScreen(null);
    hud.classList.remove('hidden');
    sfx.startAmbient();
  }

  function showResult(reason) {
    appMode = 'result';
    hud.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    shadeArrow.classList.add('hidden');
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    lbSaveMsg.textContent = '';

    let showLbSave = false;
    if (sim.state === 'won') {
      totalCampaignScore += sim.score;
      nightsWonCount = Math.min(3, nightsWonCount + 1);
      if (currentNight === 3) {
        showLbSave = true;
        resultBadge.textContent = 'Bình Minh Đã Lên!';
        resultTitle.textContent = 'Hoàn Thành Cả Ba Hòn Đảo!';
        resultSubtitle.textContent =
          'Ánh sáng vàng ấm đã giữ vững tới bình minh trên Đảo Bến, Đảo Cau và Đảo Chuông!';
        btnResultPrimary.textContent = 'Chơi lại từ Đêm 1';
      } else {
        resultBadge.textContent = `Sống sót Đêm ${currentNight}`;
        resultTitle.textContent = `${sim.map.name} Đã Đón Bình Minh!`;
        resultSubtitle.textContent = `Chuẩn bị tiến tới Đêm ${currentNight + 1}: ${getNightMap(currentNight + 1).name}.`;
        btnResultPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
      }
    } else {
      showLbSave = true;
      resultBadge.textContent = `Đêm ${currentNight} Thất Bại`;
      resultTitle.textContent = 'Ánh Sáng Đã Tắt...';
      resultSubtitle.textContent =
        reason === 'dawn'
          ? 'Bình minh lên nhưng không đủ số đèn sáng theo yêu cầu.'
          : 'Mây đã mất hết Ngọn Lửa giữa biển sương.';
      btnResultPrimary.textContent = `Chơi lại Đêm ${currentNight}`;
    }

    lbSaveBox.classList.toggle('hidden', !showLbSave);
    resultStats.innerHTML = `
      <div>Đèn sáng cuối Đêm: <strong>${litCount} / ${sim.lanterns.length}</strong></div>
      <div>Điểm Đêm ${currentNight}: <strong>${sim.score}</strong></div>
      <div>Tổng điểm hành trình: <strong>${totalCampaignScore}</strong> (${nightsWonCount}/3 Đêm thắng)</div>
    `;
    showOnlyScreen(screenResult);
  }

  // Button wiring
  document.getElementById('btn-play').addEventListener('click', () => {
    totalCampaignScore = 0;
    nightsWonCount = 0;
    openIntro(1);
  });
  document.querySelectorAll('[data-night]').forEach((btn) => {
    btn.addEventListener('click', () => {
      totalCampaignScore = 0;
      nightsWonCount = 0;
      openIntro(Number(btn.dataset.night));
    });
  });
  document.getElementById('btn-start-night').addEventListener('click', () => startNight(currentNight));
  document.getElementById('btn-menu-leaderboard').addEventListener('click', () => openLeaderboard());
  document.getElementById('btn-lb-close').addEventListener('click', () => showOnlyScreen(screenMenu));
  document.getElementById('btn-menu-settings').addEventListener('click', () => {
    settingsReturnMode = 'menu';
    showOnlyScreen(screenSettings);
  });
  document.getElementById('btn-pause-settings').addEventListener('click', () => {
    settingsReturnMode = 'paused';
    showOnlyScreen(screenSettings);
  });
  document.getElementById('btn-settings-close').addEventListener('click', () => {
    listeningAction = null;
    saveSettings();
    showOnlyScreen(settingsReturnMode === 'paused' ? screenPause : screenMenu);
  });
  document.getElementById('btn-reset-keys').addEventListener('click', () => {
    settings.keys = { ...DEFAULT_KEYS };
    listeningAction = null;
    keybindMsg.classList.add('hidden');
    saveSettings();
    renderKeybinds();
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    if (appMode === 'paused') pendingPause = true;
  });
  document.getElementById('btn-pause-restart').addEventListener('click', () => startNight(currentNight));
  document.getElementById('btn-pause-menu').addEventListener('click', () => {
    appMode = 'menu';
    hud.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    shadeArrow.classList.add('hidden');
    showOnlyScreen(screenMenu);
  });
  btnResultPrimary.addEventListener('click', () => {
    if (sim && sim.state === 'won') {
      if (currentNight < 3) openIntro(currentNight + 1);
      else {
        totalCampaignScore = 0;
        nightsWonCount = 0;
        openIntro(1);
      }
    } else {
      startNight(currentNight);
    }
  });
  document.getElementById('btn-result-menu').addEventListener('click', () => {
    appMode = 'menu';
    showOnlyScreen(screenMenu);
  });
  document.getElementById('btn-lb-save').addEventListener('click', async () => {
    const name = lbNameInput.value.trim();
    if (!isValidLeaderboardName(name)) {
      lbSaveMsg.textContent = '⚠ Tên phải dài 3–12 ký tự (chữ cái, số hoặc _).';
      return;
    }
    await persistLeaderboardEntry({
      name,
      score: totalCampaignScore,
      nights_won: nightsWonCount,
      achieved_at: new Date().toISOString(),
      seed: currentSeed,
    });
    lbSaveMsg.textContent = '✔ Đã lưu điểm vào Bảng xếp hạng!';
    lbNameInput.value = '';
  });

  optVolume.addEventListener('input', () => {
    settings.volume = Number(optVolume.value);
    optVolumeVal.textContent = `${settings.volume}%`;
    sfx.setVolume(settings.volume / 100);
  });
  optSens.addEventListener('input', () => {
    settings.sensitivity = Number(optSens.value) / 100;
    optSensVal.textContent = settings.sensitivity.toFixed(2);
  });
  optColorblind.addEventListener('change', () => {
    settings.colorblind = optColorblind.checked;
    applyAccessibilityClasses();
    saveSettings();
  });
  optReducedMotion.addEventListener('change', () => {
    settings.reducedMotion = optReducedMotion.checked;
    applyAccessibilityClasses();
    saveSettings();
  });
  optLargeText.addEventListener('change', () => {
    settings.largeText = optLargeText.checked;
    applyAccessibilityClasses();
    saveSettings();
  });

  window.addEventListener('keydown', (e) => {
    if (listeningAction) {
      e.preventDefault();
      const conflict = Object.entries(settings.keys).find(
        ([act, code]) => act !== listeningAction && code === e.code
      );
      if (conflict) {
        keybindMsg.textContent = `⚠ Phím ${e.code} đang được dùng cho "${KEY_LABELS[conflict[0]]}"!`;
        keybindMsg.classList.remove('hidden');
      } else {
        settings.keys[listeningAction] = e.code;
        listeningAction = null;
        keybindMsg.classList.add('hidden');
        saveSettings();
      }
      renderKeybinds();
      return;
    }

    if (document.activeElement === lbNameInput) return;

    const code = e.code;
    if (!keys.has(code)) {
      if (code === settings.keys.pause || code === 'KeyP') {
        if (appMode === 'playing' || appMode === 'paused') pendingPause = true;
      }
      if (appMode === 'playing') {
        if (code === settings.keys.jump) pendingJump = true;
        if (code === settings.keys.interact) pendingInteract = true;
        if (code === settings.keys.pulse) pendingPulse = true;
        if (code === settings.keys.dash) pendingDash = true;
      }
    }
    keys.add(code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (appMode !== 'playing') return;
    if (e.button === 0) {
      isDragging = true;
      lastMouseX = e.clientX;
    } else if (e.button === 2) {
      pendingPulse = true;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging || appMode !== 'playing') return;
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    camYawDeg = (camYawDeg - dx * settings.sensitivity) % 360;
  });
  window.addEventListener('mouseup', () => (isDragging = false));
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function formatTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.name === 'mote_picked') sfx.pickup();
      else if (ev.name === 'deposit' || ev.name === 'refuel') sfx.deposit();
      else if (ev.name === 'lantern_lit') sfx.lanternLit();
      else if (ev.name === 'lantern_out') showCaption(`⚠ Đèn ${ev.data.lantern_id} đã cạn dầu!`);
      else if (ev.name === 'dash') sfx.dash();
      else if (ev.name === 'charm_picked') sfx.charm();
      else if (ev.name === 'shade_spawned') {
        sfx.shadeSpawn();
        showCaption(`👁 Bóng Mực ${ev.data.id} vừa xuất hiện!`);
        const sh = sim.shades.find((s) => s.id === ev.data.id);
        if (sh) {
          recentShadePos = [...sh.pos];
          recentShadeTimer = 3.0;
        }
      } else if (ev.name === 'drifter_steal') sfx.drifterSteal();
      else if (ev.name === 'pulse') {
        sfx.pulse();
        pulseAnimT = 0.001;
        pulseWave.position.set(sim.player.pos[0], sim.player.pos[1] + 0.3, sim.player.pos[2]);
      } else if (ev.name === 'player_hit') {
        sfx.hit();
        if (!settings.reducedMotion) {
          cameraShakeT = 0.25;
          hitFlash.classList.add('active');
          setTimeout(() => hitFlash.classList.remove('active'), 200);
        }
      } else if (ev.name === 'paused') {
        appMode = 'paused';
        showOnlyScreen(screenPause);
      } else if (ev.name === 'resumed') {
        appMode = 'playing';
        showOnlyScreen(null);
      } else if (ev.name === 'game_over') {
        if (ev.data.result === 'won') sfx.win();
        else sfx.lose();
        showResult(ev.data.reason);
      }
    }
  }

  const tmpVec = new THREE.Vector3();
  function positionEdgeArrow(arrowEl, worldPos) {
    tmpVec.set(worldPos[0], worldPos[1] + 2.0, worldPos[2]).project(camera);
    const onScreen = tmpVec.z < 1 && Math.abs(tmpVec.x) <= 0.92 && Math.abs(tmpVec.y) <= 0.92;
    if (onScreen) {
      arrowEl.classList.add('hidden');
      return;
    }
    let sx = tmpVec.x;
    let sy = tmpVec.y;
    if (tmpVec.z > 1) {
      sx = -sx;
      sy = -sy;
    }
    const angle = Math.atan2(sy, sx);
    const margin = 48;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    arrowEl.style.left = `${cx + Math.cos(angle) * (cx - margin) * 0.85}px`;
    arrowEl.style.top = `${cy - Math.sin(angle) * (cy - margin) * 0.85}px`;
    arrowEl.style.transform = `rotate(${90 - (angle * 180) / Math.PI}deg)`;
    arrowEl.classList.remove('hidden');
  }

  function syncVisuals(nowSec, dt) {
    if (!sim) return;
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    ambientLight.intensity = 0.15 + 0.55 * (litCount / sim.lanterns.length);

    mayVisual.group.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    mayVisual.group.rotation.y = sim.player.facingYaw;
    mayVisual.light.intensity = 3.5 + sim.player.carried * 0.5;
    mayVisual.group.visible =
      sim.player.respawnTicks === 0 && (sim.player.invulnTicks === 0 || Math.floor(nowSec * 16) % 2 === 0);

    const blink1Hz = Math.sin(nowSec * Math.PI * 2) >= 0;
    for (const l of sim.lanterns) {
      const v = lanternVisuals.get(l.id);
      if (!v) continue;
      const cost = sim.getLanternCost(l);
      const depRatio = l.deposited / cost;
      const fuelPct = l.fuelTicks / SIM_CONSTANTS.FUEL_MAX_TICKS;
      const isLowFuel = l.lit && l.fuelTicks < SIM_CONSTANTS.FUEL_LOW_TICKS;

      if (isLowFuel && !alertedLowFuelIds.has(l.id)) {
        alertedLowFuelIds.add(l.id);
        showCaption(`⚠ Đèn ${l.id} sắp cạn dầu (< 30%)!`);
      } else if (!isLowFuel) {
        alertedLowFuelIds.delete(l.id);
      }

      v.bulb.scale.set(1, l.lit ? 1.0 : 0.8, 1);
      v.tearGroup.visible = !l.lit;
      v.bulbMat.color.setHex(l.lit ? PALETTE.LANTERN_CORE : PALETTE.LANTERN_UNLIT);
      v.bulbMat.emissiveIntensity = l.lit
        ? isLowFuel && !blink1Hz
          ? 0.55
          : 2.4
        : 0.08 + depRatio * 1.1;
      v.light.intensity = l.lit ? (isLowFuel && !blink1Hz ? 8 : 22) : depRatio * 5;
      v.safeRing.material.opacity = sim.hasSafeRadius(l) ? 0.25 : 0;

      v.fuelBarGroup.visible = l.lit;
      if (l.lit) {
        v.fuelBarGroup.lookAt(camera.position);
        v.fuelFill.scale.x = Math.max(0.01, fuelPct);
        v.fuelFill.position.x = -0.76 * (1 - fuelPct);
        v.fuelFillMat.color.setHex(
          isLowFuel
            ? blink1Hz
              ? settings.colorblind
                ? 0xffffff
                : 0xff5a5f
              : PALETTE.LANTERN_LIT
            : PALETTE.LANTERN_LIT
        );
      }
    }

    const activeMotes = new Set(sim.motes.map((m) => m.id));
    for (const [id, mesh] of moteVisuals.entries()) {
      if (!activeMotes.has(id)) {
        scene.remove(mesh);
        moteVisuals.delete(id);
      }
    }
    for (const m of sim.motes) {
      let mesh = moteVisuals.get(m.id);
      if (!mesh) {
        mesh = createMoteMesh();
        moteVisuals.set(m.id, mesh);
      }
      mesh.position.set(m.pos[0], m.pos[1] + 0.75 + Math.sin(nowSec * 3.2 + m.pos[0]) * 0.2, m.pos[2]);
    }

    const activeShades = new Set(sim.shades.map((s) => s.id));
    for (const [id, v] of shadeVisuals.entries()) {
      if (!activeShades.has(id)) {
        scene.remove(v.group);
        shadeVisuals.delete(id);
      }
    }
    const rimHex = settings.colorblind ? PALETTE.SHADE_RIM_CB : PALETTE.SHADE_RIM;
    for (const s of sim.shades) {
      let v = shadeVisuals.get(s.id);
      if (!v) {
        v = createShadeMesh();
        shadeVisuals.set(s.id, v);
      }
      v.group.position.set(s.pos[0], s.pos[1] + Math.sin(nowSec * 4 + s.pos[0]) * 0.1, s.pos[2]);
      const stunned = s.state === 'stunned';
      v.bodyMat.color.setHex(stunned ? PALETTE.SHADE_STUNNED : PALETTE.SHADE_BODY);
      v.bodyMat.emissive.setHex(rimHex);
      v.eyeMat.color.setHex(rimHex);
      v.bodyMat.emissiveIntensity = stunned ? 0.25 : s.state === 'drain' ? 1.2 : 0.7;
      v.halo.material.opacity = stunned ? 0.9 : 0;
      v.halo.rotation.z = nowSec * 4;
    }

    const activeDrifters = new Set(sim.drifters.map((d) => d.id));
    for (const [id, mesh] of drifterVisuals.entries()) {
      if (!activeDrifters.has(id)) {
        scene.remove(mesh);
        drifterVisuals.delete(id);
      }
    }
    for (const d of sim.drifters) {
      let mesh = drifterVisuals.get(d.id);
      if (!mesh) {
        mesh = createDrifterMesh();
        drifterVisuals.set(d.id, mesh);
      }
      mesh.position.set(d.pos[0], d.pos[1] + 0.5 + Math.sin(nowSec * 5) * 0.2, d.pos[2]);
      mesh.rotation.y = nowSec * 2.5;
    }

    for (const c of sim.charms) {
      const mesh = charmVisuals.get(c.id);
      if (!mesh) continue;
      mesh.visible = c.available;
      mesh.rotation.y = nowSec * 2;
    }

    const windVisible = sim.windEnabled && (sim.wind.telegraph || sim.wind.active);
    if (sim.wind.telegraph && !prevWindTelegraph) {
      sfx.windTelegraph();
      showCaption('🍃 Gió mạnh sắp thổi!');
    }
    prevWindTelegraph = sim.wind.telegraph;
    hudWind.classList.toggle('hidden', !windVisible);
    if (windVisible) {
      hudWind.textContent = sim.wind.active ? '💨 Gió mạnh đang thổi!' : '🍃 Gió mạnh sắp tới!';
      const wr = (sim.wind.dirDeg * Math.PI) / 180;
      const speed = sim.wind.active ? 12 : 5;
      for (const leaf of windLeaves) {
        leaf.mesh.visible = true;
        leaf.offset[0] = ((leaf.offset[0] + Math.cos(wr) * speed * 0.016 + 15) % 30) - 15;
        leaf.offset[2] = ((leaf.offset[2] + Math.sin(wr) * speed * 0.016 + 15) % 30) - 15;
        leaf.mesh.position.set(
          sim.player.pos[0] + leaf.offset[0],
          sim.player.pos[1] + leaf.offset[1],
          sim.player.pos[2] + leaf.offset[2]
        );
      }
    } else {
      for (const leaf of windLeaves) leaf.mesh.visible = false;
    }

    if (pulseAnimT > 0) {
      pulseAnimT += 0.05;
      const scale = 1 + pulseAnimT * TUNING.pulse_radius;
      pulseWave.scale.set(scale, scale, 1);
      pulseWave.material.opacity = Math.max(0, 0.85 * (1 - pulseAnimT));
      if (pulseAnimT >= 1) {
        pulseAnimT = 0;
        pulseWave.material.opacity = 0;
      }
    }

    const yawRad = (camYawDeg * Math.PI) / 180;
    let shakeX = 0;
    let shakeY = 0;
    if (cameraShakeT > 0 && !settings.reducedMotion) {
      cameraShakeT = Math.max(0, cameraShakeT - dt);
      shakeX = (Math.random() - 0.5) * 0.5;
      shakeY = (Math.random() - 0.5) * 0.5;
    }
    const targetCamX = sim.player.pos[0] - Math.sin(yawRad) * 11.5 + shakeX;
    const targetCamZ = sim.player.pos[2] - Math.cos(yawRad) * 11.5;
    camera.position.lerp(
      new THREE.Vector3(targetCamX, Math.max(2, sim.player.pos[1] + 7.2 + shakeY), targetCamZ),
      0.16
    );
    camera.lookAt(sim.player.pos[0], sim.player.pos[1] + 1.2, sim.player.pos[2]);

    const needed = Math.ceil(TUNING.win_ratio * sim.lanterns.length);
    const cap = sim.getPlayerCapacity();
    hudFlames.textContent = `🔥 ${sim.player.flames} / ${TUNING.flames}`;
    hudLanterns.textContent = `🏮 ${litCount} / ${sim.lanterns.length} (cần ${needed})`;
    hudScore.textContent = `⭐ ${sim.score}`;
    const isDangerTime = sim.timeLeftS <= 30;
    hudTime.textContent =
      isDangerTime && settings.colorblind ? `⚠ ${formatTime(sim.timeLeftS)}` : formatTime(sim.timeLeftS);
    hudTime.classList.toggle('danger', isDangerTime);

    const secCeil = Math.ceil(sim.timeLeftS);
    if (appMode === 'playing' && secCeil <= 10 && secCeil > 0 && secCeil !== lastCountdownSec) {
      lastCountdownSec = secCeil;
      sfx.countdownTick();
      if (secCeil === 10) showCaption('⏳ Còn 10 giây tới bình minh!');
    }

    hudCharm.classList.toggle('hidden', sim.player.charmTicks <= 0);
    if (sim.player.charmTicks > 0) {
      hudCharm.textContent = `🧧 Bùa Gió: ${(sim.player.charmTicks / 60).toFixed(1)}s`;
    }

    hudCapacity.textContent = `${sim.player.carried} / ${cap}`;
    for (let i = 0; i < moteSlots.length; i++) {
      moteSlots[i].classList.toggle('hidden', i >= cap);
      moteSlots[i].classList.toggle('filled', i < sim.player.carried);
    }

    const nearLantern = sim.lanterns.find(
      (l) =>
        distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius &&
        (!l.lit || l.fuelTicks < SIM_CONSTANTS.FUEL_MAX_TICKS)
    );
    if (nearLantern) {
      const kLbl = settings.keys.interact.replace('Key', '');
      if (!nearLantern.lit) {
        const cost = sim.getLanternCost(nearLantern);
        hudInteract.textContent = `${kLbl} — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
      } else {
        hudInteract.textContent = `${kLbl} — Châm dầu (${Math.round(nearLantern.fuelTicks / 60)}%)`;
      }
      hudInteract.classList.remove('hidden');
    } else {
      hudInteract.classList.add('hidden');
    }

    if (sim.player.dashCdTicks > 0 && sim.player.charmTicks === 0) {
      hudDash.textContent = `Lướt: ${(sim.player.dashCdTicks / 60).toFixed(1)}s`;
      hudDash.className = 'pill cd-pill cooldown';
    } else {
      hudDash.textContent = sim.player.charmTicks > 0 ? 'Lướt: 0s 🧧' : 'Lướt: Sẵn sàng';
      hudDash.className = 'pill cd-pill ready';
    }

    if (sim.player.pulseCdTicks > 0) {
      hudPulse.textContent = `Tỏa Sáng: ${(sim.player.pulseCdTicks / 60).toFixed(1)}s`;
      hudPulse.className = 'pill cd-pill cooldown';
    } else if (sim.player.carried < TUNING.pulse_cost) {
      hudPulse.textContent = `Tỏa Sáng: Cần ${TUNING.pulse_cost} ✨`;
      hudPulse.className = 'pill cd-pill cooldown';
    } else {
      hudPulse.textContent = 'Tỏa Sáng: Sẵn sàng';
      hudPulse.className = 'pill cd-pill ready';
    }

    // Nearest unlit lantern edge arrow
    let nearestL = null;
    let bestD = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit) continue;
      const d = distXZ(sim.player.pos, l.pos);
      if (d < bestD) {
        bestD = d;
        nearestL = l;
      }
    }
    if (nearestL && appMode === 'playing') positionEdgeArrow(lanternArrow, nearestL.pos);
    else lanternArrow.classList.add('hidden');

    // Recently spawned shade edge arrow
    if (recentShadeTimer > 0 && recentShadePos && appMode === 'playing') {
      recentShadeTimer -= dt;
      positionEdgeArrow(shadeArrow, recentShadePos);
    } else {
      shadeArrow.classList.add('hidden');
    }
  }

  let lastTime = performance.now();
  let accumulator = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (appMode === 'playing') {
      if (keys.has('ArrowLeft')) camYawDeg = (camYawDeg + 110 * dt) % 360;
      if (keys.has('ArrowRight')) camYawDeg = (camYawDeg - 110 * dt) % 360;
    }

    accumulator += dt;
    while (accumulator >= SIM_CONSTANTS.DT) {
      accumulator -= SIM_CONSTANTS.DT;
      if (sim && (appMode === 'playing' || appMode === 'paused')) {
        let mx = 0;
        let mz = 0;
        if (appMode === 'playing') {
          if (keys.has(settings.keys.moveUp) || keys.has('ArrowUp')) mz += 1;
          if (keys.has(settings.keys.moveDown) || keys.has('ArrowDown')) mz -= 1;
          if (keys.has(settings.keys.moveRight)) mx -= 1;
          if (keys.has(settings.keys.moveLeft)) mx += 1;
        }
        const wasGrounded = sim.player.grounded;
        const events = sim.step({
          move: [mx, mz],
          cam_yaw_deg: camYawDeg,
          jump: pendingJump,
          interact: pendingInteract,
          pulse: pendingPulse,
          dash: pendingDash,
          pause: pendingPause,
        });
        if (pendingJump && wasGrounded && !sim.player.grounded) sfx.jump();
        pendingJump = false;
        pendingInteract = false;
        pendingPulse = false;
        pendingDash = false;
        pendingPause = false;
        handleEvents(events);
      }
    }

    syncVisuals(now / 1000, dt);
    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}
