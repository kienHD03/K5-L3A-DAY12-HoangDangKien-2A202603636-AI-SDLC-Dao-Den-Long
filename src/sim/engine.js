import { createRng } from './rng.js';
import { TUNING, SIM_CONSTANTS, round1, round3, roundPos } from './config.js';
import { getNightMap, getGroundY, resolveHorizontalMove } from './maps.js';

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function transformMove(move, camYawDeg) {
  let mx = move[0] || 0;
  let mz = move[1] || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const theta = (camYawDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return [mx * cos + mz * sin, -mx * sin + mz * cos];
}

function compareId(a, b) {
  const na = parseInt(a.id.replace(/\D+/g, ''), 10);
  const nb = parseInt(b.id.replace(/\D+/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class GameSim {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    this.seed = seed;
    this.night = night;
    this.map = getNightMap(night);
    this.rng = createRng(seed);
    this.tuning = TUNING;
    this.C = SIM_CONSTANTS;

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'paused' | 'won' | 'lost'
    this.score = 0;
    this.startedEmitted = false;

    this.initialTimeLeftS = this.map.durationS;
    this.timeLeftS = this.initialTimeLeftS;

    this.player = {
      pos: [...this.map.spawnPos],
      vel: [0, 0, 0],
      grounded: true,
      flames: this.tuning.flames,
      carried: 0,
      successfulLights: 0,
      invulnTicks: 0,
      dashTicks: 0,
      dashCdTicks: 0,
      dashDir: [0, 1],
      pulseCdTicks: 0,
      charmTicks: 0,
      respawnTicks: 0,
      launched: false,
      facingYaw: 0,
    };

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };

    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: false,
      deposited: 0,
      fuelTicks: 0,
      everLit: false,
      relitCount: 0,
    }));

    this.motes = [];
    this.shades = [];
    this.drifters = [];
    this.charms = this.map.charms.map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: true,
      respawnTicks: 0,
    }));

    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.nextDrifterId = 1;

    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = this.map.maxDrifters > 0;
    this.windEnabled = this.map.windEnabledDefault;

    this.wind = {
      active: false,
      telegraph: false,
      dirDeg: 0,
      nextStartTick: this.C.WIND_CYCLE_TICKS,
      endTick: 0,
    };

    this._applyScenario(scenario);
  }

  getPlayerCapacity() {
    return Math.min(
      this.tuning.capacity_max,
      this.tuning.carry_capacity + 2 * this.player.successfulLights
    );
  }

  getLanternCost(lantern) {
    return lantern.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
  }

  hasSafeRadius(lantern) {
    return lantern.lit && lantern.fuelTicks >= this.C.FUEL_LOW_TICKS;
  }

  _applyScenario(scenario) {
    const sc = scenario || {};

    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;
    if (sc.random_drifters !== undefined) this.randomDrifters = sc.random_drifters;
    if (sc.wind_enabled !== undefined) this.windEnabled = sc.wind_enabled;

    if (sc.time_left_s !== undefined) {
      this.initialTimeLeftS = sc.time_left_s;
      this.timeLeftS = sc.time_left_s;
    }

    if (sc.player) {
      if (sc.player.pos !== undefined) {
        this.player.pos = [sc.player.pos[0], sc.player.pos[1], sc.player.pos[2]];
        const g = getGroundY(this.night, this.player.pos[0], this.player.pos[2]);
        this.player.grounded = g !== -Infinity && Math.abs(this.player.pos[1] - g) < 0.05;
      }
      if (sc.player.carried !== undefined) this.player.carried = sc.player.carried;
      if (sc.player.flames !== undefined) this.player.flames = sc.player.flames;
      if (sc.player.invuln_ticks !== undefined) this.player.invulnTicks = sc.player.invuln_ticks;
      if (sc.player.dash_cd_ticks !== undefined) this.player.dashCdTicks = sc.player.dash_cd_ticks;
      if (sc.player.pulse_cd_ticks !== undefined) this.player.pulseCdTicks = sc.player.pulse_cd_ticks;
      if (sc.player.charm_ticks !== undefined) this.player.charmTicks = sc.player.charm_ticks;
      if (sc.player.successful_lights !== undefined) {
        this.player.successfulLights = sc.player.successful_lights;
      }
    }

    if (sc.lanterns) {
      for (const patch of sc.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos !== undefined) target.pos = [...patch.pos];
        if (patch.ever_lit !== undefined) target.everLit = patch.ever_lit;
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (target.lit) {
            target.everLit = patch.ever_lit !== undefined ? patch.ever_lit : true;
            const cost = this.getLanternCost(target);
            if (target.deposited < cost) target.deposited = cost;
            target.fuelTicks =
              patch.fuel !== undefined
                ? Math.min(this.C.FUEL_MAX_TICKS, Math.round(patch.fuel * 60))
                : this.C.FUEL_MAX_TICKS;
          } else {
            target.fuelTicks = 0;
          }
        } else {
          const cost = this.getLanternCost(target);
          if (target.deposited >= cost) {
            target.lit = true;
            target.everLit = true;
            target.fuelTicks =
              patch.fuel !== undefined
                ? Math.min(this.C.FUEL_MAX_TICKS, Math.round(patch.fuel * 60))
                : this.C.FUEL_MAX_TICKS;
          } else if (patch.fuel !== undefined && target.lit) {
            target.fuelTicks = Math.min(this.C.FUEL_MAX_TICKS, Math.round(patch.fuel * 60));
          }
        }
      }
    }

    if (sc.motes !== undefined) {
      this.motes = sc.motes.map((m) => {
        if (Array.isArray(m)) {
          return {
            id: `M${this.nextMoteId++}`,
            pos: [m[0], m[1], m[2]],
            kind: 'random',
            ttlTicks: null,
            createdSimTick: -1,
          };
        }
        const kind = m.kind === 'dropped' ? 'dropped' : 'random';
        const ttlTicks =
          m.ttl_s !== undefined
            ? Math.round(m.ttl_s * 60)
            : kind === 'dropped'
              ? this.C.DROPPED_MOTE_TTL_TICKS
              : null;
        return {
          id: m.id || `M${this.nextMoteId++}`,
          pos: [m.pos[0], m.pos[1], m.pos[2]],
          kind,
          ttlTicks,
          createdSimTick: -1,
        };
      });
    } else if (this.randomMotes) {
      this._spawnInitialMotes();
    }

    if (sc.shades !== undefined) {
      this.shades = sc.shades.map((s) => {
        const state = s.state || 'chase';
        return {
          id: s.id || `S${this.nextShadeId++}`,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          state,
          stateTicksLeft: s.state_ticks_left !== undefined ? s.state_ticks_left : 0,
          targetLanternId: s.target_lantern_id || null,
          drainTicks: 0,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safePushLantern: null,
          safePushTicks: 0,
          wanderAngle: this.rng() * Math.PI * 2,
          wanderChangeTicks: 90,
          createdSimTick: -1,
        };
      });
      this.shades.sort(compareId);
    }

    if (sc.drifters !== undefined) {
      this.drifters = sc.drifters.map((d) => ({
        id: d.id || `D${this.nextDrifterId++}`,
        pos: [d.pos[0], d.pos[1], d.pos[2]],
        state: d.state || 'idle',
        stolen: d.stolen || 0,
        fleeTicks: d.state === 'flee' ? this.C.DRIFTER_FLEE_TICKS : 0,
        wanderAngle: this.rng() * Math.PI * 2,
        wanderChangeTicks: 90,
        createdSimTick: -1,
      }));
      this.drifters.sort(compareId);
    }

    if (sc.charms !== undefined) {
      this.charms = sc.charms.map((c, idx) => ({
        id: c.id || `C${idx + 1}`,
        pos: [c.pos[0], c.pos[1], c.pos[2]],
        available: c.available !== undefined ? c.available : true,
        respawnTicks: c.respawn_s !== undefined ? Math.round(c.respawn_s * 60) : 0,
      }));
    }
  }

  _spawnInitialMotes() {
    const pool = this.map.moteSpawns.map((p) => [...p]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = Math.min(this.C.INITIAL_MOTE_COUNT, pool.length);
    for (let i = 0; i < count; i++) {
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: pool[i],
        kind: 'random',
        ttlTicks: null,
        createdSimTick: -1,
      });
    }
  }

  _spawnScheduledMote() {
    if (this.motes.length >= this.C.MAX_MOTES) return;
    const free = this.map.moteSpawns.filter(
      (pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 0.5)
    );
    if (free.length === 0) return;
    const pick = free[Math.floor(this.rng() * free.length)];
    this.motes.push({
      id: `M${this.nextMoteId++}`,
      pos: [...pick],
      kind: 'random',
      ttlTicks: null,
      createdSimTick: this.simTick,
    });
  }

  _spawnScheduledShade(events, eventTick) {
    if (this.shades.length >= this.map.maxShades) return;
    const valid = this.map.shadeSpawns.filter((pt) => {
      if (distXZ(pt, this.player.pos) < 15.0) return false;
      const inSafe = this.lanterns.some(
        (l) => this.hasSafeRadius(l) && distXZ(pt, l.pos) < this.tuning.safe_radius
      );
      if (inSafe) return false;
      return true;
    });
    if (valid.length === 0) return;
    const pick = valid[Math.floor(this.rng() * valid.length)];
    const shade = {
      id: `S${this.nextShadeId++}`,
      pos: [...pick],
      state: 'spawning',
      stateTicksLeft: 30,
      targetLanternId: null,
      drainTicks: 0,
      pushTicksLeft: 0,
      pushDir: [1, 0],
      recoilDir: [1, 0],
      safePushLantern: null,
      safePushTicks: 0,
      wanderAngle: this.rng() * Math.PI * 2,
      wanderChangeTicks: 90,
      createdSimTick: this.simTick,
    };
    this.shades.push(shade);
    events.push({ type: 'event', tick: eventTick, name: 'shade_spawned', data: { id: shade.id } });
  }

  _spawnScheduledDrifter() {
    const activeCount = this.drifters.filter((d) => d.state !== 'removed').length;
    if (activeCount >= this.map.maxDrifters || this.map.shadeSpawns.length === 0) return;
    const pick = this.map.shadeSpawns[Math.floor(this.rng() * this.map.shadeSpawns.length)];
    this.drifters.push({
      id: `D${this.nextDrifterId++}`,
      pos: [pick[0], pick[1] + 1.0, pick[2]],
      state: 'idle',
      stolen: 0,
      fleeTicks: 0,
      wanderAngle: this.rng() * Math.PI * 2,
      wanderChangeTicks: 90,
      createdSimTick: this.simTick,
    });
  }

  _dropMotesAround(originPos, count, createdSimTick) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const r = 1.5 + this.rng() * 1.0;
      let mx = originPos[0] + Math.cos(angle) * r;
      let mz = originPos[2] + Math.sin(angle) * r;
      let my = getGroundY(this.night, mx, mz);
      if (my === -Infinity) {
        mx = originPos[0];
        mz = originPos[2];
        my = Math.max(0, originPos[1]);
      }
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: [mx, my, mz],
        kind: 'dropped',
        ttlTicks: this.C.DROPPED_MOTE_TTL_TICKS,
        createdSimTick,
      });
    }
  }

  _pushShadesOutOfLantern(lantern) {
    for (const s of this.shades) {
      if (distXZ(s.pos, lantern.pos) < this.tuning.safe_radius) {
        s.safePushLantern = lantern;
        s.safePushTicks = this.C.SHADE_SAFE_PUSH_TICKS;
        if (s.state === 'drain' && s.targetLanternId === lantern.id) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTicks = 0;
        }
      }
    }
  }

  _pickNearestLantern(pos, predicate) {
    let best = null;
    let bestDist = Infinity;
    for (const l of this.lanterns) {
      if (!predicate(l)) continue;
      const d = distXZ(pos, l.pos);
      if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && best && compareId(l, best) < 0)) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  step(input) {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events = [];
    const nextTick = this.tick + 1;
    const inp = input || {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
      pause: false,
    };

    // STEP 1: Read input & handle pause first
    const pausePressed = Boolean(inp.pause) && !this.prevButtons.pause;
    this.prevButtons.pause = Boolean(inp.pause);

    if (this.state === 'paused') {
      if (pausePressed) {
        this.state = 'playing';
        events.push({ type: 'event', tick: nextTick, name: 'resumed', data: {} });
      } else {
        this.tick = nextTick;
        return events;
      }
    } else if (pausePressed) {
      this.state = 'paused';
      this.tick = nextTick;
      events.push({ type: 'event', tick: nextTick, name: 'paused', data: {} });
      return events;
    }

    const jumpPressed = Boolean(inp.jump) && !this.prevButtons.jump;
    const interactPressed = Boolean(inp.interact) && !this.prevButtons.interact;
    const pulsePressed = Boolean(inp.pulse) && !this.prevButtons.pulse;
    const dashPressed = Boolean(inp.dash) && !this.prevButtons.dash;

    this.prevButtons.jump = Boolean(inp.jump);
    this.prevButtons.interact = Boolean(inp.interact);
    this.prevButtons.pulse = Boolean(inp.pulse);
    this.prevButtons.dash = Boolean(inp.dash);

    if (!this.startedEmitted) {
      this.startedEmitted = true;
      events.push({ type: 'event', tick: nextTick, name: 'night_start', data: { night: this.night } });
    }

    // STEP 2: Decrement counters & fuel (decay + drain), then extinguish lanterns with fuel <= 0
    const dt = this.C.DT;
    this.tick = nextTick;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / this.C.TICK_RATE);

    if (this.player.dashCdTicks > 0) this.player.dashCdTicks -= 1;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks -= 1;
    if (this.player.invulnTicks > 0) this.player.invulnTicks -= 1;
    if (this.player.charmTicks > 0) this.player.charmTicks -= 1;

    if (this.player.respawnTicks > 0) {
      this.player.respawnTicks -= 1;
      if (this.player.respawnTicks === 0 && this.player.flames > 0) {
        this.player.pos = [...this.map.spawnPos];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.launched = false;
        this.player.invulnTicks = this.C.INVULN_TICKS;
      }
    }

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.kind === 'dropped' && m.ttlTicks !== null) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) this.motes.splice(i, 1);
      }
    }

    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks -= 1;
        if (c.respawnTicks === 0) c.available = true;
      }
    }

    for (const s of this.shades) {
      if (s.stateTicksLeft > 0) {
        s.stateTicksLeft -= 1;
        if (s.stateTicksLeft === 0) {
          if (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil') {
            s.state = 'wander';
          }
        }
      }
    }

    // Natural fuel decay on lit lanterns (1/60 fuel per tick)
    for (const l of this.lanterns) {
      if (l.lit) {
        l.fuelTicks -= this.C.FUEL_DECAY_TICKS_PER_TICK;
      }
    }

    // Active shade fuel drain (5/60 fuel per tick per draining shade)
    for (const s of this.shades) {
      if (s.state !== 'drain') continue;
      let target = s.targetLanternId
        ? this.lanterns.find((l) => l.id === s.targetLanternId)
        : this._pickNearestLantern(s.pos, (l) => l.lit && distXZ(s.pos, l.pos) <= this.C.SHADE_DRAIN_RADIUS);
      if (target && !s.targetLanternId) s.targetLanternId = target.id;
      if (target && target.lit && distXZ(s.pos, target.pos) <= this.C.SHADE_DRAIN_RADIUS) {
        target.fuelTicks -= this.C.FUEL_DRAIN_TICKS_PER_TICK;
        s.drainTicks += 1;
        if (s.drainTicks % this.C.SHADE_DRAIN_EVENT_INTERVAL_TICKS === 0) {
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'fuel_drain',
            data: {
              lantern_id: target.id,
              shade_id: s.id,
              fuel: round1(Math.max(0, target.fuelTicks) / 60),
            },
          });
        }
      }
    }

    // Immediately after Step 2: extinguish lanterns whose fuel <= 0
    for (const l of this.lanterns) {
      if (l.lit && l.fuelTicks <= 0) {
        l.lit = false;
        l.fuelTicks = 0;
        l.deposited = 0;
        l.everLit = true;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'lantern_out',
          data: { lantern_id: l.id },
        });
      }
    }

    if (this.windEnabled) {
      if (!this.wind.active && !this.wind.telegraph) {
        if (this.simTick >= this.wind.nextStartTick - this.C.WIND_TELEGRAPH_TICKS) {
          this.wind.telegraph = true;
          this.wind.dirDeg = Math.floor(this.rng() * 360);
        }
      }
      if (this.wind.telegraph && this.simTick >= this.wind.nextStartTick) {
        this.wind.telegraph = false;
        this.wind.active = true;
        this.wind.endTick = this.simTick + this.C.WIND_DURATION_TICKS;
      }
      if (this.wind.active && this.simTick >= this.wind.endTick) {
        this.wind.active = false;
        this.wind.nextStartTick += this.C.WIND_CYCLE_TICKS;
      }
    }

    // STEP 3: Move May (jump, dash, jump pads, wind) then fall check
    if (this.player.respawnTicks === 0 && this.player.flames > 0) {
      const [wx, wz] = transformMove(inp.move || [0, 0], inp.cam_yaw_deg || 0);
      const hasMove = Math.hypot(wx, wz) > 1e-4;
      if (hasMove) {
        this.player.facingYaw = Math.atan2(wx, wz);
      }

      if (
        dashPressed &&
        this.player.dashTicks === 0 &&
        (this.player.dashCdTicks === 0 || this.player.charmTicks > 0)
      ) {
        this.player.dashTicks = this.C.DASH_TICKS;
        this.player.dashCdTicks = this.player.charmTicks > 0 ? 0 : this.C.DASH_CD_TICKS;
        if (hasMove) {
          const len = Math.hypot(wx, wz);
          this.player.dashDir = [wx / len, wz / len];
        } else {
          this.player.dashDir = [Math.sin(this.player.facingYaw), Math.cos(this.player.facingYaw)];
        }
        this.player.launched = false;
        events.push({ type: 'event', tick: nextTick, name: 'dash', data: {} });
      }

      const isDashingThisTick = this.player.dashTicks > 0;
      if (isDashingThisTick) {
        this.player.vel[0] = this.player.dashDir[0] * this.tuning.dash_speed;
        this.player.vel[2] = this.player.dashDir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0;
        this.player.dashTicks -= 1;
      } else if (!this.player.launched) {
        const moveSpeed = this.player.charmTicks > 0 ? this.C.CHARM_SPEED : this.tuning.player_speed;
        this.player.vel[0] = wx * moveSpeed;
        this.player.vel[2] = wz * moveSpeed;
      }

      if (jumpPressed && this.player.grounded && !isDashingThisTick) {
        this.player.vel[1] = this.C.JUMP_VELOCITY;
        this.player.grounded = false;
      }

      let windVx = 0;
      let windVz = 0;
      if (this.windEnabled && this.wind.active) {
        const wr = (this.wind.dirDeg * Math.PI) / 180;
        windVx = Math.cos(wr) * this.C.WIND_PUSH_SPEED;
        windVz = Math.sin(wr) * this.C.WIND_PUSH_SPEED;
      }

      const targetX = this.player.pos[0] + (this.player.vel[0] + windVx) * dt;
      const targetZ = this.player.pos[2] + (this.player.vel[2] + windVz) * dt;
      const [nx, nz] = resolveHorizontalMove(
        this.night,
        this.player.pos[0],
        this.player.pos[1],
        this.player.pos[2],
        targetX,
        targetZ,
        true
      );
      this.player.pos[0] = nx;
      this.player.pos[2] = nz;

      const groundY = getGroundY(this.night, this.player.pos[0], this.player.pos[2]);
      if (isDashingThisTick) {
        if (groundY !== -Infinity && groundY > this.player.pos[1] && groundY <= this.player.pos[1] + 0.65) {
          this.player.pos[1] = groundY;
          this.player.grounded = true;
        } else {
          this.player.grounded = groundY !== -Infinity && Math.abs(this.player.pos[1] - groundY) < 0.01;
        }
      } else {
        if (this.player.grounded) {
          if (groundY !== -Infinity && Math.abs(groundY - this.player.pos[1]) <= 0.65) {
            this.player.pos[1] = groundY;
            this.player.vel[1] = 0;
          } else {
            this.player.grounded = false;
          }
        }

        if (!this.player.grounded) {
          const prevY = this.player.pos[1];
          this.player.vel[1] -= this.C.GRAVITY * dt;
          this.player.pos[1] += this.player.vel[1] * dt;
          if (
            groundY !== -Infinity &&
            this.player.vel[1] <= 0 &&
            prevY >= groundY - 0.15 &&
            this.player.pos[1] <= groundY
          ) {
            this.player.pos[1] = groundY;
            this.player.vel[1] = 0;
            this.player.grounded = true;
            this.player.launched = false;
          }
        }
      }

      if (!isDashingThisTick && !this.player.launched) {
        for (const pad of this.map.jumpPads) {
          if (
            distXZ(this.player.pos, pad.pos) <= pad.radius &&
            Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.5
          ) {
            this.player.vel[0] = pad.vx;
            this.player.vel[1] = pad.vy;
            this.player.vel[2] = pad.vz;
            this.player.grounded = false;
            this.player.launched = true;
            break;
          }
        }
      }

      if (this.player.pos[1] < this.C.FALL_Y_THRESHOLD) {
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.vel = [0, 0, 0];
        this.player.launched = false;
        this.player.dashTicks = 0;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'player_hit',
          data: { by: 'fall', flames: this.player.flames, dropped: 0, lost },
        });
        if (this.player.flames > 0) {
          this.player.respawnTicks = this.C.RESPAWN_WAIT_TICKS;
        }
      }
    }

    // STEP 4: Pickup motes and charms (using dynamic capacity)
    if (this.player.respawnTicks === 0 && this.player.flames > 0) {
      const cap = this.getPlayerCapacity();
      for (let i = 0; i < this.motes.length; ) {
        if (this.player.carried >= cap) break;
        const m = this.motes[i];
        if (
          m.createdSimTick < this.simTick &&
          distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - m.pos[1]) <= this.C.MOTE_PICKUP_Y_TOLERANCE
        ) {
          this.motes.splice(i, 1);
          this.player.carried += 1;
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'mote_picked',
            data: { carried: this.player.carried },
          });
        } else {
          i++;
        }
      }

      for (const c of this.charms) {
        if (
          c.available &&
          distXZ(this.player.pos, c.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - c.pos[1]) <= this.C.MOTE_PICKUP_Y_TOLERANCE
        ) {
          c.available = false;
          c.respawnTicks = this.C.CHARM_RESPAWN_TICKS;
          this.player.charmTicks = this.C.CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'charm_picked',
            data: { charm_id: c.id, charm_ticks: this.C.CHARM_DURATION_TICKS },
          });
        }
      }
    }

    // STEP 5: Interact with lantern (unlit OR lit with fuel < 100)
    if (this.player.respawnTicks === 0 && this.player.flames > 0 && interactPressed && this.player.carried > 0) {
      const best = this._pickNearestLantern(
        this.player.pos,
        (l) =>
          distXZ(this.player.pos, l.pos) <= this.tuning.interact_radius &&
          (!l.lit || l.fuelTicks < this.C.FUEL_MAX_TICKS)
      );

      if (best) {
        if (!best.lit) {
          const cost = this.getLanternCost(best);
          const needed = cost - best.deposited;
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            best.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: nextTick,
              name: 'deposit',
              data: { lantern_id: best.id, amount, deposited: best.deposited },
            });
            if (best.deposited >= cost) {
              const isRelight = best.everLit;
              best.lit = true;
              best.everLit = true;
              best.fuelTicks = this.C.FUEL_MAX_TICKS;
              if (isRelight) {
                best.relitCount += 1;
                this.score += this.tuning.score.per_relight;
              } else {
                this.score += this.tuning.score.per_lantern;
              }
              this.player.successfulLights += 1;
              events.push({
                type: 'event',
                tick: nextTick,
                name: 'lantern_lit',
                data: { lantern_id: best.id, relight: isRelight },
              });
              this._pushShadesOutOfLantern(best);
            }
          }
        } else {
          // Refuel lit lantern with fuel < 100
          const missingTicks = this.C.FUEL_MAX_TICKS - best.fuelTicks;
          const maxMotesNeeded = Math.ceil(missingTicks / this.C.FUEL_PER_MOTE_TICKS);
          const used = Math.min(this.player.carried, maxMotesNeeded);
          if (used > 0) {
            const wasLow = best.fuelTicks < this.C.FUEL_LOW_TICKS;
            this.player.carried -= used;
            best.fuelTicks = Math.min(
              this.C.FUEL_MAX_TICKS,
              best.fuelTicks + used * this.C.FUEL_PER_MOTE_TICKS
            );
            this.score += used * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: nextTick,
              name: 'refuel',
              data: {
                lantern_id: best.id,
                amount: used,
                fuel: round1(best.fuelTicks / 60),
              },
            });
            if (wasLow && best.fuelTicks >= this.C.FUEL_LOW_TICKS) {
              this._pushShadesOutOfLantern(best);
            }
          }
        }
      }
    }

    // STEP 6: Update safe radius (only lanterns with lit && fuel >= 30)
    for (const s of this.shades) {
      if (s.safePushTicks > 0 && s.safePushLantern) {
        const l = s.safePushLantern;
        const dx = s.pos[0] - l.pos[0];
        const dz = s.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        const targetR = this.tuning.safe_radius + 0.05;
        if (!this.hasSafeRadius(l) || d >= this.tuning.safe_radius) {
          s.safePushTicks = 0;
          s.safePushLantern = null;
        } else {
          const remain = targetR - d;
          const stepOut = remain / s.safePushTicks;
          const ux = d < 1e-6 ? 1 : dx / d;
          const uz = d < 1e-6 ? 0 : dz / d;
          s.pos[0] += ux * stepOut;
          s.pos[2] += uz * stepOut;
          s.safePushTicks -= 1;
          if (s.safePushTicks === 0) s.safePushLantern = null;
        }
      } else {
        for (const l of this.lanterns) {
          if (!this.hasSafeRadius(l)) continue;
          const dx = s.pos[0] - l.pos[0];
          const dz = s.pos[2] - l.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < this.tuning.safe_radius) {
            const targetR = this.tuning.safe_radius + 0.01;
            const ux = d < 1e-6 ? 1 : dx / d;
            const uz = d < 1e-6 ? 0 : dz / d;
            s.pos[0] = l.pos[0] + ux * targetR;
            s.pos[2] = l.pos[2] + uz * targetR;
          }
        }
      }
    }

    // STEP 7: Pulse (+5 normal shade, +15 draining shade)
    if (
      this.player.respawnTicks === 0 &&
      this.player.flames > 0 &&
      pulsePressed &&
      this.player.pulseCdTicks === 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCdTicks = this.C.PULSE_CD_TICKS;
      const origin = [
        this.player.pos[0],
        this.player.pos[1] + this.C.PULSE_ORIGIN_Y_OFFSET,
        this.player.pos[2],
      ];
      const stunnedIds = [];
      for (const s of this.shades) {
        if (s.createdSimTick >= this.simTick) continue;
        if (dist3D(origin, s.pos) <= this.tuning.pulse_radius) {
          const wasDraining = s.state === 'drain';
          stunnedIds.push(s.id);
          s.state = 'stunned';
          s.stateTicksLeft = this.C.PULSE_STUN_TICKS;
          s.targetLanternId = null;
          s.drainTicks = 0;
          s.pushTicksLeft = this.C.PULSE_PUSH_TICKS;
          const dx = s.pos[0] - this.player.pos[0];
          const dz = s.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          s.pushDir = d < 1e-6 ? [1, 0] : [dx / d, dz / d];
          this.score += wasDraining ? this.tuning.score.per_drain_stun : this.tuning.score.per_stun;
        }
      }

      for (const d of this.drifters) {
        if (d.state === 'removed' || d.createdSimTick >= this.simTick) continue;
        if (dist3D(origin, d.pos) <= this.tuning.pulse_radius) {
          if (d.state === 'chase') {
            d.state = 'flee';
            d.fleeTicks = this.C.DRIFTER_FLEE_TICKS;
          } else if (d.state === 'flee' && d.stolen > 0) {
            const amount = d.stolen;
            d.stolen = 0;
            this._dropMotesAround(d.pos, amount, this.simTick);
            d.fleeTicks = Math.min(d.fleeTicks, this.C.DRIFTER_POST_DROP_TICKS);
            events.push({
              type: 'event',
              tick: nextTick,
              name: 'drifter_drop',
              data: { drifter_id: d.id, amount },
            });
          }
        }
      }

      events.push({
        type: 'event',
        tick: nextTick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds },
      });
    }

    // STEP 8: Move Shades (including drain transitions) and Drifters
    for (const s of this.shades) {
      if (s.state === 'spawning') continue;

      if (s.state === 'stunned') {
        if (s.pushTicksLeft > 0) {
          const pushStep = this.tuning.pulse_push_m / this.C.PULSE_PUSH_TICKS;
          const tx = s.pos[0] + s.pushDir[0] * pushStep;
          const tz = s.pos[2] + s.pushDir[1] * pushStep;
          const [nx, nz, blocked] = resolveHorizontalMove(
            this.night,
            s.pos[0],
            s.pos[1],
            s.pos[2],
            tx,
            tz,
            false
          );
          s.pos[0] = nx;
          s.pos[2] = nz;
          s.pushTicksLeft = blocked ? 0 : s.pushTicksLeft - 1;
        }
        continue;
      }

      if (s.state === 'recoil') {
        const recoilStep = this.C.SHADE_RECOIL_DIST / this.C.SHADE_RECOIL_TICKS;
        const tx = s.pos[0] + s.recoilDir[0] * recoilStep;
        const tz = s.pos[2] + s.recoilDir[1] * recoilStep;
        const [nx, nz] = resolveHorizontalMove(this.night, s.pos[0], s.pos[1], s.pos[2], tx, tz, false);
        s.pos[0] = nx;
        s.pos[2] = nz;
        continue;
      }

      const dToPlayer = distXZ(s.pos, this.player.pos);

      if (s.state === 'drain') {
        const target = s.targetLanternId
          ? this.lanterns.find((l) => l.id === s.targetLanternId)
          : null;
        if (
          this.player.respawnTicks === 0 &&
          this.player.flames > 0 &&
          dToPlayer <= this.C.SHADE_DRAIN_AGGRO_RADIUS
        ) {
          s.state = 'chase';
          s.targetLanternId = null;
          s.drainTicks = 0;
        } else if (
          !target ||
          !target.lit ||
          target.fuelTicks >= this.C.FUEL_LOW_TICKS ||
          distXZ(s.pos, target.pos) > this.C.SHADE_DRAIN_RADIUS
        ) {
          s.state = 'wander';
          s.targetLanternId = null;
          s.drainTicks = 0;
        } else {
          // Stay still while draining
          continue;
        }
      }

      if (this.player.respawnTicks > 0 || this.player.flames <= 0) {
        s.state = 'wander';
      } else if (s.state === 'wander' && dToPlayer <= this.C.SHADE_DETECT_RADIUS) {
        s.state = 'chase';
        s.targetLanternId = null;
      } else if (s.state === 'chase' && dToPlayer > this.C.SHADE_LOSE_RADIUS) {
        s.state = 'wander';
      }

      let tx = s.pos[0];
      let tz = s.pos[2];
      if (s.state === 'chase') {
        if (dToPlayer > 1e-6) {
          const stepDist = Math.min(dToPlayer, this.map.shadeSpeed * dt);
          tx += ((this.player.pos[0] - s.pos[0]) / dToPlayer) * stepDist;
          tz += ((this.player.pos[2] - s.pos[2]) / dToPlayer) * stepDist;
        }
      } else {
        // wander: seek nearest weak lit lantern (fuel < 30), else nearest unlit lantern
        const weakLantern = this._pickNearestLantern(
          s.pos,
          (l) => l.lit && l.fuelTicks < this.C.FUEL_LOW_TICKS
        );
        const targetLantern =
          weakLantern || this._pickNearestLantern(s.pos, (l) => !l.lit);

        if (targetLantern) {
          const dLantern = distXZ(s.pos, targetLantern.pos);
          if (weakLantern && dLantern <= this.C.SHADE_DRAIN_RADIUS) {
            s.state = 'drain';
            s.targetLanternId = weakLantern.id;
            s.drainTicks = 0;
            continue;
          }
          if (dLantern > 1e-6) {
            const speed = weakLantern ? this.map.shadeSpeed : this.C.SHADE_WANDER_SPEED;
            const stepDist = Math.min(dLantern, speed * dt);
            tx += ((targetLantern.pos[0] - s.pos[0]) / dLantern) * stepDist;
            tz += ((targetLantern.pos[2] - s.pos[2]) / dLantern) * stepDist;
          }
        } else {
          s.wanderChangeTicks -= 1;
          if (s.wanderChangeTicks <= 0) {
            s.wanderAngle = this.rng() * Math.PI * 2;
            s.wanderChangeTicks = 90 + Math.floor(this.rng() * 60);
          }
          tx += Math.cos(s.wanderAngle) * this.C.SHADE_WANDER_SPEED * dt;
          tz += Math.sin(s.wanderAngle) * this.C.SHADE_WANDER_SPEED * dt;
        }
      }

      const [nx, nz, blocked] = resolveHorizontalMove(this.night, s.pos[0], s.pos[1], s.pos[2], tx, tz, false);
      s.pos[0] = nx;
      s.pos[2] = nz;
      if (blocked && s.state === 'wander') {
        s.wanderAngle += Math.PI * 0.75;
      }

      // Check if shade just arrived within 2m of weak lantern
      if (s.state === 'wander') {
        const weakNow = this._pickNearestLantern(
          s.pos,
          (l) => l.lit && l.fuelTicks < this.C.FUEL_LOW_TICKS && distXZ(s.pos, l.pos) <= this.C.SHADE_DRAIN_RADIUS
        );
        if (weakNow) {
          s.state = 'drain';
          s.targetLanternId = weakNow.id;
          s.drainTicks = 0;
        }
      }

      if (s.safePushTicks === 0) {
        for (const l of this.lanterns) {
          if (!this.hasSafeRadius(l)) continue;
          const dx = s.pos[0] - l.pos[0];
          const dz = s.pos[2] - l.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < this.tuning.safe_radius) {
            const targetR = this.tuning.safe_radius + 0.01;
            const ux = d < 1e-6 ? 1 : dx / d;
            const uz = d < 1e-6 ? 0 : dz / d;
            s.pos[0] = l.pos[0] + ux * targetR;
            s.pos[2] = l.pos[2] + uz * targetR;
          }
        }
      }

      const sg = getGroundY(this.night, s.pos[0], s.pos[2]);
      if (sg !== -Infinity) s.pos[1] = sg;
    }

    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const distP = distXZ(d.pos, this.player.pos);
      if (d.state === 'idle') {
        if (
          this.player.respawnTicks === 0 &&
          this.player.carried >= this.C.DRIFTER_MIN_CARRIED &&
          distP <= this.C.DRIFTER_DETECT_RADIUS
        ) {
          d.state = 'chase';
        }
      } else if (d.state === 'chase') {
        if (
          this.player.respawnTicks > 0 ||
          this.player.carried < this.C.DRIFTER_MIN_CARRIED ||
          distP > this.C.DRIFTER_DETECT_RADIUS
        ) {
          d.state = 'idle';
        }
      }

      if (d.state === 'idle') {
        d.wanderChangeTicks -= 1;
        if (d.wanderChangeTicks <= 0) {
          d.wanderAngle = this.rng() * Math.PI * 2;
          d.wanderChangeTicks = 90 + Math.floor(this.rng() * 60);
        }
        d.pos[0] += Math.cos(d.wanderAngle) * this.C.DRIFTER_IDLE_SPEED * dt;
        d.pos[2] += Math.sin(d.wanderAngle) * this.C.DRIFTER_IDLE_SPEED * dt;
      } else if (d.state === 'chase') {
        if (distP > 1e-6) {
          const stepDist = Math.min(distP, this.C.DRIFTER_CHASE_SPEED * dt);
          d.pos[0] += ((this.player.pos[0] - d.pos[0]) / distP) * stepDist;
          d.pos[2] += ((this.player.pos[2] - d.pos[2]) / distP) * stepDist;
        }
      } else if (d.state === 'flee') {
        const dx = d.pos[0] - this.player.pos[0];
        const dz = d.pos[2] - this.player.pos[2];
        const len = Math.hypot(dx, dz);
        const ux = len < 1e-6 ? 1 : dx / len;
        const uz = len < 1e-6 ? 0 : dz / len;
        d.pos[0] += ux * this.C.DRIFTER_FLEE_SPEED * dt;
        d.pos[2] += uz * this.C.DRIFTER_FLEE_SPEED * dt;
        d.fleeTicks -= 1;
        if (d.fleeTicks <= 0) d.state = 'removed';
      }
    }

    // STEP 9: Collisions — Drifters steal FIRST, then Shades hit (ascending id order)
    if (this.player.respawnTicks === 0 && this.player.flames > 0) {
      for (const d of this.drifters) {
        if (d.state !== 'chase' || d.createdSimTick >= this.simTick) continue;
        if (distXZ(this.player.pos, d.pos) <= this.C.DRIFTER_STEAL_RADIUS) {
          const amount = Math.min(this.C.DRIFTER_STEAL_MAX, this.player.carried);
          this.player.carried -= amount;
          d.stolen = amount;
          d.state = 'flee';
          d.fleeTicks = this.C.DRIFTER_FLEE_TICKS;
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'drifter_steal',
            data: { drifter_id: d.id, amount, carried: this.player.carried },
          });
        }
      }

      let hitThisTick = false;
      for (const s of this.shades) {
        if (hitThisTick) break;
        if (
          s.createdSimTick >= this.simTick ||
          this.player.invulnTicks > 0 ||
          s.state === 'stunned' ||
          s.state === 'spawning' ||
          s.state === 'recoil' ||
          s.safePushTicks > 0
        ) {
          continue;
        }
        if (
          distXZ(this.player.pos, s.pos) <= this.tuning.shade_hit_radius &&
          Math.abs(this.player.pos[1] - s.pos[1]) <= this.C.SHADE_HIT_Y_TOLERANCE
        ) {
          hitThisTick = true;
          const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
          this.player.carried -= dropped;
          this.player.flames = Math.max(0, this.player.flames - 1);
          this.player.invulnTicks = this.C.INVULN_TICKS;
          if (dropped > 0) {
            this._dropMotesAround(this.player.pos, dropped, this.simTick);
          }
          const dx = s.pos[0] - this.player.pos[0];
          const dz = s.pos[2] - this.player.pos[2];
          const len = Math.hypot(dx, dz);
          s.recoilDir = len < 1e-6 ? [1, 0] : [dx / len, dz / len];
          s.state = 'recoil';
          s.stateTicksLeft = this.C.SHADE_RECOIL_TICKS;
          s.targetLanternId = null;
          s.drainTicks = 0;

          events.push({
            type: 'event',
            tick: nextTick,
            name: 'player_hit',
            data: { by: 'shade', flames: this.player.flames, dropped },
          });
        }
      }
    }

    this.drifters = this.drifters.filter((d) => d.state !== 'removed');

    // STEP 10: Scheduled spawns
    if (this.randomMotes && this.simTick % this.C.MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this._spawnScheduledMote();
    }

    if (this.randomShades) {
      if (this.simTick === this.C.SHADE_FIRST_SPAWN_TICK) {
        this._spawnScheduledShade(events, nextTick);
        this._spawnScheduledShade(events, nextTick);
      } else if (
        this.simTick > this.C.SHADE_FIRST_SPAWN_TICK &&
        (this.simTick - this.C.SHADE_FIRST_SPAWN_TICK) % this.map.shadeSpawnIntervalTicks === 0
      ) {
        this._spawnScheduledShade(events, nextTick);
      }
    }

    if (
      this.randomDrifters &&
      this.map.maxDrifters > 0 &&
      this.simTick % this.C.DRIFTER_SPAWN_INTERVAL_TICKS === 0
    ) {
      this._spawnScheduledDrifter();
    }

    // STEP 11: Evaluate win / loss (Phase 3: no early win; no_flames always first; dawn_survived at timeLeftS <= 0)
    if (this.player.flames <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
    } else if (this.timeLeftS <= 0) {
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const needed = Math.ceil(this.tuning.win_ratio * this.lanterns.length);
      if (litLanterns.length >= needed) {
        this.state = 'won';
        for (const l of litLanterns) {
          this.score += this.tuning.score.per_dawn_lantern + Math.floor(l.fuelTicks / 60);
        }
        this.score += this.player.flames * this.tuning.score.per_flame_left;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' },
        });
      } else {
        this.state = 'lost';
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' },
        });
      }
    }

    return events;
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: Boolean(this.windEnabled && this.wind.active),
        dir_deg: this.wind.dirDeg,
      },
      player: {
        pos: roundPos(this.player.pos),
        vel: roundPos(this.player.vel),
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getPlayerCapacity(),
        grounded: this.player.grounded,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / this.C.TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCdTicks / this.C.TICK_RATE),
        charm_s: round3(this.player.charmTicks / this.C.TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundPos(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelTicks / 60) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundPos(s.pos),
        state: s.state,
      })),
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundPos(m.pos),
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / this.C.TICK_RATE),
      })),
      motes_active: this.motes.length,
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: roundPos(d.pos),
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / this.C.TICK_RATE),
      })),
    };
  }
}
