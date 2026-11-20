import * as THREE from 'three';
import { GameSim } from '../sim/engine.js';
import { SIM_CONSTANTS, TUNING } from '../sim/config.js';
import { SoundFX } from './audio.js';

const root = document.getElementById('canvas-root');
const hudFlames = document.getElementById('hud-flames');
const hudCarried = document.getElementById('hud-carried');
const hudLanterns = document.getElementById('hud-lanterns');
const hudTime = document.getElementById('hud-time');
const hudScore = document.getElementById('hud-score');
const hudPulse = document.getElementById('hud-pulse');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const overlayStats = document.getElementById('overlay-stats');
const btnRestart = document.getElementById('btn-restart');

const sfx = new SoundFX();

// Renderer & Scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const nightSkyColor = new THREE.Color(0x0f081e);
const dawnSkyColor = new THREE.Color(0x3a254d);
scene.background = nightSkyColor.clone();
scene.fog = new THREE.FogExp2(0x130a26, 0.016);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);

// Lights
const hemiLight = new THREE.HemisphereLight(0x8a72c8, 0x1b122c, 0.55);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xc2b2ff, 0.55);
moonLight.position.set(25, 45, 20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 120;
const dShadow = 42;
moonLight.shadow.camera.left = -dShadow;
moonLight.shadow.camera.right = dShadow;
moonLight.shadow.camera.top = dShadow;
moonLight.shadow.camera.bottom = -dShadow;
scene.add(moonLight);

// Island (circular floating island, radius 35m, no fence -> fall_enabled: true)
const islandGroup = new THREE.Group();
scene.add(islandGroup);

const islandTop = new THREE.Mesh(
  new THREE.CylinderGeometry(SIM_CONSTANTS.ISLAND_RADIUS, SIM_CONSTANTS.ISLAND_RADIUS - 1.5, 2.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x243038, roughness: 0.92, metalness: 0.05 })
);
islandTop.position.y = -1.1;
islandTop.receiveShadow = true;
islandGroup.add(islandTop);

const islandBase = new THREE.Mesh(
  new THREE.ConeGeometry(SIM_CONSTANTS.ISLAND_RADIUS - 2, 16, 24),
  new THREE.MeshStandardMaterial({ color: 0x1b1629, roughness: 0.95 })
);
islandBase.rotation.x = Math.PI;
islandBase.position.y = -10;
islandGroup.add(islandBase);

// Soft glowing stone path ring connecting the 5 lanterns
const pathRing = new THREE.Mesh(
  new THREE.RingGeometry(SIM_CONSTANTS.LANTERN_RING_RADIUS - 1.3, SIM_CONSTANTS.LANTERN_RING_RADIUS + 1.3, 64),
  new THREE.MeshStandardMaterial({
    color: 0x39324b,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })
);
pathRing.rotation.x = -Math.PI / 2;
pathRing.position.y = 0.02;
pathRing.receiveShadow = true;
islandGroup.add(pathRing);

// Center stone medallion at (0,0,0)
const centerPad = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 32),
  new THREE.MeshStandardMaterial({ color: 0x453b59, roughness: 0.9 })
);
centerPad.rotation.x = -Math.PI / 2;
centerPad.position.y = 0.03;
islandGroup.add(centerPad);

// Sea of drifting clouds below & around the island (visual creativity, zero sim impact)
const clouds = [];
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0x2b2042,
  emissive: 0x170e2b,
  roughness: 1,
  transparent: true,
  opacity: 0.78,
});
for (let i = 0; i < 28; i++) {
  const angle = (i / 28) * Math.PI * 2;
  const dist = SIM_CONSTANTS.ISLAND_RADIUS + 12 + (i % 4) * 10;
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 3) * 2.5, 10, 8), cloudMat);
  cloud.scale.set(1.8, 0.55, 1.3);
  cloud.position.set(Math.cos(angle) * dist, -5 - (i % 3) * 3, Math.sin(angle) * dist);
  scene.add(cloud);
  clouds.push({ mesh: cloud, angle, dist, speed: 0.015 + (i % 5) * 0.004 });
}

// Starfield dome
const starGeo = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 320; i++) {
  const theta = (i * 137.5 * Math.PI) / 180;
  const phi = Math.acos(0.15 + ((i * 73) % 100) / 120);
  const r = 140;
  starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xffe9c4, size: 1.1, transparent: true, opacity: 0.85 })
);
scene.add(stars);

// Player: May wearing a conical hat (nón lá) with a small warm hanging lantern
function createMayMesh() {
  const group = new THREE.Group();

  // Cloak body
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: 0x4b6cb7, roughness: 0.75 })
  );
  body.position.y = 0.58;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.7 })
  );
  head.position.y = 1.32;
  head.castShadow = true;
  group.add(head);

  // Nón lá (conical Vietnamese hat)
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xe6c27a, roughness: 0.8 })
  );
  hat.position.y = 1.6;
  hat.castShadow = true;
  group.add(hat);

  // Small lantern hanging from front rim of nón lá
  const stringMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
    new THREE.MeshBasicMaterial({ color: 0xd9b36c })
  );
  stringMesh.position.set(0, 1.34, 0.56);
  group.add(stringMesh);

  const miniLantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffc864,
      emissive: 0xff9b26,
      emissiveIntensity: 2.0,
    })
  );
  miniLantern.position.set(0, 1.2, 0.56);
  group.add(miniLantern);

  const playerLight = new THREE.PointLight(0xffb44c, 4.5, 14, 1.6);
  playerLight.position.set(0, 1.4, 0.56);
  group.add(playerLight);

  return { group, playerLight };
}

const mayVisual = createMayMesh();
scene.add(mayVisual.group);

// Pulse shockwave ring visual
const pulseWave = new THREE.Mesh(
  new THREE.RingGeometry(0.6, 1.1, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffc966,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  })
);
pulseWave.rotation.x = -Math.PI / 2;
pulseWave.position.y = 0.25;
scene.add(pulseWave);
let pulseAnimT = 0;

// Dynamic entity pools
const lanternVisuals = new Map();
const moteVisuals = new Map();
const shadeVisuals = new Map();

function createLanternMesh(lantern) {
  const group = new THREE.Group();
  group.position.set(lantern.pos[0], 0, lantern.pos[2]);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.85, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x3b334a, roughness: 0.9 })
  );
  base.position.y = 0.25;
  group.add(base);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 3.0, 10),
    new THREE.MeshStandardMaterial({ color: 0x4c3c34, roughness: 0.85 })
  );
  post.position.y = 1.75;
  post.castShadow = true;
  group.add(post);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x5c4f6b,
    emissive: 0xff9f2e,
    emissiveIntensity: 0.08,
    roughness: 0.4,
  });
  const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), bulbMat);
  bulb.position.y = 3.55;
  group.add(bulb);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a3f, roughness: 0.8 })
  );
  roof.position.y = 4.25;
  group.add(roof);

  const light = new THREE.PointLight(0xffaa3b, 0, 26, 1.4);
  light.position.y = 3.6;
  group.add(light);

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.14, TUNING.safe_radius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    })
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = 0.05;
  group.add(safeRing);

  scene.add(group);
  return { group, bulbMat, light, safeRing };
}

function createMoteMesh() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe494,
      emissive: 0xffb732,
      emissiveIntensity: 2.2,
    })
  );
  scene.add(mesh);
  return mesh;
}

function createShadeMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x160924,
    emissive: 0x4b126e,
    emissiveIntensity: 0.7,
    roughness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 12), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd96bff });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
  leftEye.position.set(-0.18, 1.35, 0.35);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.18;
  group.add(leftEye, rightEye);

  const stunHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.06, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd56b, transparent: true, opacity: 0 })
  );
  stunHalo.rotation.x = Math.PI / 2;
  stunHalo.position.y = 2.05;
  group.add(stunHalo);

  scene.add(group);
  return { group, bodyMat, stunHalo };
}

// Game state & input
let sim = null;
let camYawDeg = 0;
let isDragging = false;
let lastMouseX = 0;
const keys = new Set();
let pendingInteract = false;
let pendingPulse = false;
let pendingJump = false;

function clearDynamicVisuals() {
  for (const v of lanternVisuals.values()) scene.remove(v.group);
  lanternVisuals.clear();
  for (const m of moteVisuals.values()) scene.remove(m);
  moteVisuals.clear();
  for (const s of shadeVisuals.values()) scene.remove(s.group);
  shadeVisuals.clear();
}

function startNewGame() {
  clearDynamicVisuals();
  sim = new GameSim({ seed: Date.now() & 0xffffff, night: 1 });
  for (const l of sim.lanterns) {
    lanternVisuals.set(l.id, createLanternMesh(l));
  }
  camYawDeg = 0;
  pulseAnimT = 0;
  overlay.classList.add('hidden');
}

// Controls
window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (!keys.has(code)) {
    if (code === 'Space') pendingJump = true;
    if (code === 'KeyR' || code === 'KeyE') pendingInteract = true;
    if (code === 'KeyF') pendingPulse = true;
  }
  keys.add(code);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
  } else if (e.button === 2) {
    pendingPulse = true;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.25) % 360;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
btnRestart.addEventListener('click', () => startNewGame());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function showGameOver(reason) {
  overlay.classList.remove('hidden');
  if (sim.state === 'won') {
    overlayTitle.textContent = 'Đảo Bến Đã Sáng Trở Lại!';
    overlaySubtitle.textContent = 'Mây đã thắp sáng cả 5 Đèn Lồng Lớn, xua tan màn sương đen.';
  } else {
    overlayTitle.textContent = 'Ánh Sáng Đã Tắt...';
    overlaySubtitle.textContent =
      reason === 'dawn'
        ? 'Bình minh đã lên trước khi cả 5 đèn kịp thắp sáng.'
        : 'Mây đã mất hết ngọn lửa ấm áp giữa biển sương.';
  }
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  overlayStats.innerHTML = `
    <div>Đèn đã thắp: <strong>${litCount} / ${sim.lanterns.length}</strong></div>
    <div>Thời gian còn lại: <strong>${formatTime(sim.timeLeftS)}</strong></div>
    <div>Ngọn lửa còn lại: <strong>${sim.player.flames} / ${TUNING.flames}</strong></div>
    <div>Tổng điểm: <strong>${sim.score}</strong></div>
  `;
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.name === 'mote_picked') sfx.pickup();
    else if (ev.name === 'deposit') sfx.deposit();
    else if (ev.name === 'lantern_lit') sfx.lanternLit();
    else if (ev.name === 'pulse') {
      sfx.pulse();
      pulseAnimT = 0.001;
      pulseWave.position.set(sim.player.pos[0], 0.25, sim.player.pos[2]);
    } else if (ev.name === 'player_hit') sfx.hit();
    else if (ev.name === 'game_over') {
      if (ev.data.result === 'won') sfx.win();
      else sfx.lose();
      showGameOver(ev.data.reason);
    }
  }
}

function syncVisuals(nowSec) {
  // Progressive island illumination based on lit lanterns
  const litCount = sim.lanterns.filter((l) => l.lit).length;
  const progress = litCount / sim.lanterns.length;
  scene.background.copy(nightSkyColor).lerp(dawnSkyColor, progress);
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.017 - progress * 0.008;
  hemiLight.intensity = 0.5 + progress * 0.85;
  moonLight.intensity = 0.5 + progress * 0.7;

  // Player
  mayVisual.group.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
  mayVisual.group.rotation.y = sim.player.facingYaw;
  mayVisual.playerLight.intensity = 3.5 + sim.player.carried * 0.9;
  mayVisual.group.visible = sim.player.invulnTimer <= 0 || Math.floor(nowSec * 16) % 2 === 0;

  // Lanterns
  for (const l of sim.lanterns) {
    const v = lanternVisuals.get(l.id);
    if (!v) continue;
    const ratio = l.deposited / TUNING.lantern_cost;
    v.bulbMat.emissiveIntensity = l.lit ? 2.6 : 0.1 + ratio * 1.1;
    v.light.intensity = l.lit ? 24 : ratio * 5;
    v.safeRing.material.opacity = l.lit ? 0.26 : 0;
  }

  // Motes
  const activeMoteIds = new Set(sim.motes.map((m) => m.id));
  for (const [id, mesh] of moteVisuals.entries()) {
    if (!activeMoteIds.has(id)) {
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
    const bob = 0.75 + Math.sin(nowSec * 3.2 + m.pos[0] + m.pos[2]) * 0.22;
    mesh.position.set(m.pos[0], bob, m.pos[2]);
  }

  // Shades
  const activeShadeIds = new Set(sim.shades.map((s) => s.id));
  for (const [id, v] of shadeVisuals.entries()) {
    if (!activeShadeIds.has(id)) {
      scene.remove(v.group);
      shadeVisuals.delete(id);
    }
  }
  for (const s of sim.shades) {
    let v = shadeVisuals.get(s.id);
    if (!v) {
      v = createShadeMesh();
      shadeVisuals.set(s.id, v);
    }
    const hover = Math.sin(nowSec * 4 + s.pos[0]) * 0.12;
    v.group.position.set(s.pos[0], hover, s.pos[2]);
    v.group.lookAt(sim.player.pos[0], 1, sim.player.pos[2]);
    const isStunned = s.state === 'stunned';
    v.bodyMat.emissiveIntensity = isStunned ? 0.2 : 0.85;
    v.stunHalo.material.opacity = isStunned ? 0.9 : 0;
    v.stunHalo.rotation.z = nowSec * 4;
  }

  // Pulse wave animation
  if (pulseAnimT > 0) {
    pulseAnimT += 0.045;
    const scale = 1 + pulseAnimT * TUNING.pulse_radius;
    pulseWave.scale.set(scale, scale, 1);
    pulseWave.material.opacity = Math.max(0, 0.85 * (1 - pulseAnimT));
    if (pulseAnimT >= 1) {
      pulseAnimT = 0;
      pulseWave.material.opacity = 0;
    }
  }

  // Drift clouds
  for (const c of clouds) {
    c.angle += c.speed * 0.016;
    c.mesh.position.x = Math.cos(c.angle) * c.dist;
    c.mesh.position.z = Math.sin(c.angle) * c.dist;
  }

  // Third-person camera following May
  const yawRad = (camYawDeg * Math.PI) / 180;
  const camDist = 11.5;
  const camHeight = 7.2;
  const targetCamX = sim.player.pos[0] - Math.sin(yawRad) * camDist;
  const targetCamZ = sim.player.pos[2] - Math.cos(yawRad) * camDist;
  camera.position.lerp(new THREE.Vector3(targetCamX, Math.max(2, sim.player.pos[1] + camHeight), targetCamZ), 0.14);
  camera.lookAt(sim.player.pos[0], sim.player.pos[1] + 1.2, sim.player.pos[2]);

  // HUD
  hudFlames.textContent = `🔥 ${sim.player.flames} / ${TUNING.flames}`;
  hudCarried.textContent = `✨ ${sim.player.carried} / ${TUNING.carry_capacity}`;
  hudLanterns.textContent = `🏮 ${litCount} / ${sim.lanterns.length}`;
  hudTime.textContent = `⏳ ${formatTime(sim.timeLeftS)}`;
  hudScore.textContent = `⭐ ${sim.score}`;

  if (sim.player.pulseCooldown > 0) {
    hudPulse.textContent = `Tỏa sáng [F]: Hồi ${sim.player.pulseCooldown.toFixed(1)}s`;
    hudPulse.className = 'pill cooldown';
  } else if (sim.player.carried < TUNING.pulse_cost) {
    hudPulse.textContent = `Tỏa sáng [F]: Cần ${TUNING.pulse_cost} ✨`;
    hudPulse.className = 'pill cooldown';
  } else {
    hudPulse.textContent = `Tỏa sáng [F]: Sẵn sàng (tốn ${TUNING.pulse_cost} ✨)`;
    hudPulse.className = 'pill ready';
  }
}

startNewGame();

let lastTime = performance.now();
let accumulator = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (keys.has('ArrowLeft')) camYawDeg = (camYawDeg + 110 * dt) % 360;
  if (keys.has('ArrowRight')) camYawDeg = (camYawDeg - 110 * dt) % 360;

  accumulator += dt;
  while (accumulator >= SIM_CONSTANTS.DT) {
    accumulator -= SIM_CONSTANTS.DT;
    if (sim.state === 'playing') {
      let mx = 0;
      let mz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyD')) mx -= 1;
      if (keys.has('KeyA')) mx += 1;

      const events = sim.step({
        move: [mx, mz],
        cam_yaw_deg: camYawDeg,
        jump: pendingJump,
        interact: pendingInteract,
        pulse: pendingPulse,
      });
      pendingJump = false;
      pendingInteract = false;
      pendingPulse = false;
      handleEvents(events);
    }
  }

  syncVisuals(now / 1000);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
