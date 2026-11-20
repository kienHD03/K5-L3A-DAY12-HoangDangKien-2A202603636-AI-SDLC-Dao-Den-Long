import { TUNING, round3 } from './config.js';

function ringPoints(cx, cz, r, count, startDeg = 0, y = 0) {
  const pts = [];
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const rad = ((startDeg + i * step) * Math.PI) / 180;
    pts.push([round3(cx + Math.cos(rad) * r), y, round3(cz + Math.sin(rad) * r)]);
  }
  return pts;
}

function arcPoints(cx, cz, r, anglesDeg, y = 0) {
  return anglesDeg.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [round3(cx + Math.cos(rad) * r), y, round3(cz + Math.sin(rad) * r)];
  });
}

function normalize2D(dx, dz) {
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

// Night 2 jump pad horizontal launch vectors
const [pad1DirX, pad1DirZ] = normalize2D(70 - 20, 0 - 18);
const [pad2DirX, pad2DirZ] = normalize2D(0 - 50, 0 - -18);

export const NIGHT_MAPS = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    introQuote:
      'Ông Đăng: "Sương đen vừa nuốt lấy Đảo Bến rồi, Mây à. Hãy gom những đốm đom đóm về thắp sáng 5 Đèn Lồng Lớn trước khi bình minh lên!"',
    durationS: TUNING.night1_duration_s,
    spawnPos: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 25] },
      { id: 'L2', pos: [23.8, 0, 7.7] },
      { id: 'L3', pos: [14.7, 0, -20.2] },
      { id: 'L4', pos: [-14.7, 0, -20.2] },
      { id: 'L5', pos: [-23.8, 0, 7.7] },
    ],
    moteSpawns: [
      ...ringPoints(0, 0, 12, 8, 0, 0),
      ...ringPoints(0, 0, 33, 16, 0, 0),
    ],
    shadeSpawns: ringPoints(0, 0, 37, 12, 15, 0),
    shadeSpeed: TUNING.shade_speed,
    shadeSpawnIntervalTicks: 480, // 8s
    maxShades: 6,
    maxDrifters: 0,
    charms: [],
    jumpPads: [],
    windEnabledDefault: false,
  },

  2: {
    night: 2,
    name: 'Đảo Cau',
    introQuote:
      'Ông Đăng: "Đảo Cau chia làm hai bờ nối bằng cầu tre mỏng manh. Cẩn thận Gió Lạc cướp ánh sáng — hãy tận dụng bục nhảy và Bùa Gió trên cầu!"',
    durationS: TUNING.night2_duration_s,
    spawnPos: [0, 0, 0],
    lanterns: [
      { id: 'L1', pos: [0, 0, 20] },
      { id: 'L2', pos: [17, 0, -10] },
      { id: 'L3', pos: [-17, 0, -10] },
      { id: 'L4', pos: [70, 0, 20] },
      { id: 'L5', pos: [87, 0, -10] },
      { id: 'L6', pos: [53, 0, -10] },
    ],
    moteSpawns: [
      ...ringPoints(0, 0, 10, 4, 0, 0),
      ...ringPoints(0, 0, 22, 8, 0, 0),
      ...ringPoints(70, 0, 10, 4, 0, 0),
      ...ringPoints(70, 0, 22, 8, 0, 0),
    ],
    shadeSpawns: [
      ...ringPoints(0, 0, 26, 8, 22.5, 0),
      ...ringPoints(70, 0, 26, 8, 22.5, 0),
    ],
    shadeSpeed: TUNING.shade_speed,
    shadeSpawnIntervalTicks: 420, // 7s
    maxShades: 8,
    maxDrifters: 2,
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    jumpPads: [
      { id: 'JP1', pos: [20, 0, 18], radius: 1.0, vy: 14, vx: pad1DirX * 24, vz: pad1DirZ * 24 },
      { id: 'JP2', pos: [50, 0, -18], radius: 1.0, vy: 14, vx: pad2DirX * 24, vz: pad2DirZ * 24 },
    ],
    windEnabledDefault: false,
  },

  3: {
    night: 3,
    name: 'Đảo Chuông',
    introQuote:
      'Ông Đăng: "Đêm cuối cùng trên Đảo Chuông ba tầng! Gió lớn sẽ thổi từng cơn và Bóng Mực nhanh hơn. Thắp sáng cả 7 ngọn đèn để đón Bình Minh!"',
    durationS: TUNING.night3_duration_s,
    spawnPos: [0, 0, -10],
    lanterns: [
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ],
    moteSpawns: [
      ...ringPoints(0, 0, 34, 18, 0, 0),
      ...arcPoints(0, 0, 18, [20, 40, 60, 80, 100, 120, 140, 160], 3),
      ...arcPoints(0, 0, 5, [45, 135, 225, 315], 6),
    ],
    shadeSpawns: ringPoints(0, 0, 43, 16, 0, 0),
    shadeSpeed: 4.5,
    shadeSpawnIntervalTicks: 360, // 6s
    maxShades: 10,
    maxDrifters: 2,
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
    jumpPads: [{ id: 'JP1', pos: [0, 3, 13], radius: 1.0, vy: 12, vx: 0, vz: -8 }],
    windEnabledDefault: true,
  },
};

export function getNightMap(night) {
  const m = NIGHT_MAPS[night];
  if (!m) throw new Error(`Unsupported night: ${night}`);
  return m;
}

const NIGHT3_RAMPS = [30, 150].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return { deg, ux: Math.cos(rad), uz: Math.sin(rad) };
});

/**
 * Returns the walkable ground elevation Y at (x, z), or -Infinity if over the cloud sea.
 */
export function getGroundY(night, x, z) {
  if (night === 1) {
    return Math.hypot(x, z) <= 40.0 ? 0 : -Infinity;
  }

  if (night === 2) {
    const onA = Math.hypot(x, z) <= 28.0;
    const onB = Math.hypot(x - 70.0, z) <= 28.0;
    const onBridge = x >= 26.0 && x <= 44.0 && z >= -2.0 && z <= 2.0;
    return onA || onB || onBridge ? 0 : -Infinity;
  }

  if (night === 3) {
    const r = Math.hypot(x, z);
    if (r > 45.0) return -Infinity;
    if (r <= 8.0) return 6.0;
    if (r >= 12.0 && r <= 24.0 && z > 0) return 3.0;
    for (const ramp of NIGHT3_RAMPS) {
      const s = x * ramp.ux + z * ramp.uz;
      const p = -x * ramp.uz + z * ramp.ux;
      if (s >= 24.0 && s <= 30.0 && Math.abs(p) <= 1.5) {
        return 3.0 * ((30.0 - s) / 6.0);
      }
    }
    return 0.0;
  }

  return -Infinity;
}

/**
 * Resolves solid obstacle collisions (Night 3 bell tower & vertical cliffs).
 * Returns adjusted [nx, nz, blocked].
 */
export function resolveHorizontalMove(night, oldX, oldY, oldZ, targetX, targetZ, allowFallOff = true) {
  let nx = targetX;
  let nz = targetZ;
  let blocked = false;

  if (night === 3) {
    // Bell tower cylinder at (0, 0), radius 2.0, Y in [6, 14]
    const towerR = 2.0;
    if (oldY >= 5.5 && oldY < 14.0) {
      const r = Math.hypot(nx, nz);
      if (r < towerR) {
        blocked = true;
        if (r < 1e-6) {
          nx = towerR;
          nz = 0;
        } else {
          nx = (nx / r) * towerR;
          nz = (nz / r) * towerR;
        }
      }
    }

    // Vertical cliff check: cannot step up more than 0.65m horizontally
    const nextGround = getGroundY(3, nx, nz);
    if (nextGround > oldY + 0.65) {
      // Try sliding along X or Z independently
      const tryXGround = getGroundY(3, nx, oldZ);
      const tryZGround = getGroundY(3, oldX, nz);
      if (tryXGround <= oldY + 0.65) {
        nz = oldZ;
      } else if (tryZGround <= oldY + 0.65) {
        nx = oldX;
      } else {
        nx = oldX;
        nz = oldZ;
      }
      blocked = true;
    }
  }

  if (!allowFallOff) {
    const g = getGroundY(night, nx, nz);
    if (g === -Infinity) {
      nx = oldX;
      nz = oldZ;
      blocked = true;
    }
  }

  return [nx, nz, blocked];
}
