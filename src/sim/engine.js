import { createRng } from './rng.js';
import { TUNING, SIM_CONSTANTS, createDefaultLanterns, round3, roundPos } from './config.js';

export function distXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
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

export class GameSim {
  constructor({ seed = 1, night = 1, scenario = null } = {}) {
    this.seed = seed;
    this.night = night;
    this.rng = createRng(seed);
    this.tuning = TUNING;
    this.constants = SIM_CONSTANTS;

    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing'; // 'playing' | 'won' | 'lost'
    this.score = 0;

    this.initialTimeLeftS = this.tuning.night1_duration_s;
    this.timeLeftS = this.initialTimeLeftS;

    this.player = {
      pos: [0, 0, 0],
      vy: 0,
      flames: this.tuning.flames,
      carried: 0,
      invulnTimer: 0,
      pulseCooldown: 0,
      facingYaw: 0,
    };

    this.prevButtons = {
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
    };

    this.lanterns = createDefaultLanterns();
    this.motes = [];
    this.shades = [];
    this.nextMoteId = 1;
    this.nextShadeId = 1;

    this.randomMotes = true;
    this.randomShades = true;
    this.moteSpawnTimer = this.constants.MOTE_SPAWN_INTERVAL_S;
    this.shadeSpawnTimer = this.constants.SHADE_SPAWN_INTERVAL_S;

    this._applyScenario(scenario);
  }

  _applyScenario(scenario) {
    const sc = scenario || {};

    if (sc.random_motes !== undefined) this.randomMotes = sc.random_motes;
    if (sc.random_shades !== undefined) this.randomShades = sc.random_shades;

    if (sc.time_left_s !== undefined) {
      this.initialTimeLeftS = sc.time_left_s;
      this.timeLeftS = sc.time_left_s;
    }

    if (sc.player) {
      if (sc.player.pos !== undefined) {
        this.player.pos = [sc.player.pos[0], sc.player.pos[1], sc.player.pos[2]];
      }
      if (sc.player.carried !== undefined) {
        this.player.carried = sc.player.carried;
      }
      if (sc.player.flames !== undefined) {
        this.player.flames = sc.player.flames;
      }
    }

    if (sc.lanterns) {
      for (const patch of sc.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos !== undefined) {
          target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        }
        if (patch.deposited !== undefined) {
          target.deposited = patch.deposited;
        }
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (target.lit && target.deposited < this.tuning.lantern_cost) {
            target.deposited = this.tuning.lantern_cost;
          }
        } else if (target.deposited >= this.tuning.lantern_cost) {
          target.lit = true;
        }
      }
    }

    if (sc.motes !== undefined) {
      this.motes = sc.motes.map((m) => {
        if (Array.isArray(m)) {
          return { id: `M${this.nextMoteId++}`, pos: [m[0], m[1], m[2]] };
        }
        const id = m.id || `M${this.nextMoteId++}`;
        return { id, pos: [m.pos[0], m.pos[1], m.pos[2]] };
      });
    } else if (this.randomMotes) {
      for (let i = 0; i < this.constants.INITIAL_MOTE_COUNT; i++) {
        this._spawnRandomMote();
      }
    }

    if (sc.shades !== undefined) {
      this.shades = sc.shades.map((s) => ({
        id: s.id || `S${this.nextShadeId++}`,
        pos: [s.pos[0], s.pos[1], s.pos[2]],
        state: s.state || 'chase',
        stunTimer: 0,
      }));
    } else if (this.randomShades) {
      for (let i = 0; i < this.constants.INITIAL_SHADE_COUNT; i++) {
        this._spawnRandomShade(false);
      }
    }
  }

  _spawnRandomMote() {
    const angle = this.rng() * Math.PI * 2;
    const minR = 4.0;
    const maxR = this.constants.ISLAND_RADIUS - 4.0;
    const r = minR + Math.sqrt(this.rng()) * (maxR - minR);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const mote = { id: `M${this.nextMoteId++}`, pos: [x, 0, z] };
    this.motes.push(mote);
    return mote;
  }

  _spawnRandomShade(emitEvent, events = null, eventTick = 0) {
    let x = 0;
    let z = 0;
    const r = this.constants.ISLAND_RADIUS - 6.0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.rng() * Math.PI * 2;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      const inSafe = this.lanterns.some(
        (l) => l.lit && distXZ([x, 0, z], l.pos) < this.tuning.safe_radius
      );
      if (!inSafe) break;
    }
    const shade = {
      id: `S${this.nextShadeId++}`,
      pos: [x, 0, z],
      state: 'chase',
      stunTimer: 0,
    };
    this.shades.push(shade);
    if (emitEvent && events) {
      events.push({ type: 'event', tick: eventTick, name: 'shade_spawned', data: { id: shade.id } });
    }
    return shade;
  }

  _enforceSafeRadius(shade) {
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < this.tuning.safe_radius) {
        const targetR = this.tuning.safe_radius + 0.01;
        if (d < 1e-6) {
          shade.pos[0] = lantern.pos[0] + targetR;
          shade.pos[2] = lantern.pos[2];
        } else {
          shade.pos[0] = lantern.pos[0] + (dx / d) * targetR;
          shade.pos[2] = lantern.pos[2] + (dz / d) * targetR;
        }
      }
    }
  }

  step(input) {
    if (this.state !== 'playing') {
      return [];
    }

    const dt = this.constants.DT;
    const events = [];
    const nextTick = this.tick + 1;

    const inp = input || {
      move: [0, 0],
      cam_yaw_deg: 0,
      jump: false,
      interact: false,
      pulse: false,
      dash: false,
    };

    const jumpPressed = Boolean(inp.jump) && !this.prevButtons.jump;
    const interactPressed = Boolean(inp.interact) && !this.prevButtons.interact;
    const pulsePressed = Boolean(inp.pulse) && !this.prevButtons.pulse;

    this.prevButtons.jump = Boolean(inp.jump);
    this.prevButtons.interact = Boolean(inp.interact);
    this.prevButtons.pulse = Boolean(inp.pulse);
    this.prevButtons.dash = Boolean(inp.dash);

    // 1. Update timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - dt);
    }
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - dt);
    }

    // 2. Player movement & jump
    const [wx, wz] = transformMove(inp.move || [0, 0], inp.cam_yaw_deg || 0);
    this.player.pos[0] += wx * this.tuning.player_speed * dt;
    this.player.pos[2] += wz * this.tuning.player_speed * dt;
    if (Math.hypot(wx, wz) > 1e-4) {
      this.player.facingYaw = Math.atan2(wx, wz);
    }

    const distFromCenter = Math.hypot(this.player.pos[0], this.player.pos[2]);
    const onIsland = distFromCenter <= this.constants.ISLAND_RADIUS;

    if (!this.tuning.fall_enabled && !onIsland) {
      const scale = this.constants.ISLAND_RADIUS / distFromCenter;
      this.player.pos[0] *= scale;
      this.player.pos[2] *= scale;
    }

    const grounded = (onIsland || !this.tuning.fall_enabled) && this.player.pos[1] <= 0;
    if (jumpPressed && grounded) {
      this.player.vy = this.constants.JUMP_VELOCITY;
    }

    if (!grounded || this.player.vy !== 0) {
      this.player.vy -= this.constants.GRAVITY * dt;
      this.player.pos[1] += this.player.vy * dt;
      if ((onIsland || !this.tuning.fall_enabled) && this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
      }
    }

    // 3. Fall check
    if (this.tuning.fall_enabled && this.player.pos[1] <= this.constants.FALL_Y_THRESHOLD) {
      const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
      this.player.carried -= dropped;
      this.player.flames = Math.max(0, this.player.flames - 1);
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'player_hit',
        data: { by: 'fall', flames: this.player.flames, dropped },
      });
      if (this.player.flames > 0) {
        this.player.pos = [0, 0, 0];
        this.player.vy = 0;
        this.player.invulnTimer = this.tuning.invuln_s;
      }
    }

    // 4. Pickup motes
    if (this.player.flames > 0 && this.player.carried < this.tuning.carry_capacity) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.player.carried >= this.tuning.carry_capacity) break;
        const m = this.motes[i];
        if (distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius) {
          this.motes.splice(i, 1);
          this.player.carried += 1;
          this.score += this.tuning.score.per_mote;
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
    }

    // 5. Deposit into nearest unlit lantern within interact_radius
    if (this.player.flames > 0 && interactPressed && this.player.carried > 0) {
      let bestLantern = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius && d < bestDist) {
          bestDist = d;
          bestLantern = lantern;
        }
      }
      if (bestLantern) {
        const needed = this.tuning.lantern_cost - bestLantern.deposited;
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          events.push({
            type: 'event',
            tick: nextTick,
            name: 'deposit',
            data: {
              lantern_id: bestLantern.id,
              amount,
              deposited: bestLantern.deposited,
            },
          });
          if (bestLantern.deposited >= this.tuning.lantern_cost) {
            bestLantern.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push({
              type: 'event',
              tick: nextTick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id },
            });
          }
        }
      }
    }

    // 6. Pulse
    if (
      this.player.flames > 0 &&
      pulsePressed &&
      this.player.pulseCooldown <= 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldown = this.tuning.pulse_cooldown_s;
      const stunnedIds = [];
      for (const shade of this.shades) {
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= this.tuning.pulse_radius) {
          stunnedIds.push(shade.id);
          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          if (d < 1e-6) {
            shade.pos[0] += this.tuning.pulse_push_m;
          } else {
            shade.pos[0] += (dx / d) * this.tuning.pulse_push_m;
            shade.pos[2] += (dz / d) * this.tuning.pulse_push_m;
          }
          this.score += this.tuning.score.per_stun;
        }
      }
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds },
      });
    }

    // 7. Update shades & collision
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer -= dt;
        if (shade.stunTimer <= 0) {
          shade.stunTimer = 0;
          shade.state = 'chase';
        }
        continue;
      }

      const dx = this.player.pos[0] - shade.pos[0];
      const dz = this.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const stepDist = Math.min(d, this.tuning.shade_speed * dt);
        shade.pos[0] += (dx / d) * stepDist;
        shade.pos[2] += (dz / d) * stepDist;
      }

      this._enforceSafeRadius(shade);

      if (
        this.player.flames > 0 &&
        this.player.invulnTimer <= 0 &&
        distXZ(this.player.pos, shade.pos) <= this.tuning.shade_hit_radius
      ) {
        const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.invulnTimer = this.tuning.invuln_s;
        events.push({
          type: 'event',
          tick: nextTick,
          name: 'player_hit',
          data: { by: 'shade', flames: this.player.flames, dropped },
        });
      }
    }

    // 8. Random spawns
    if (this.randomMotes) {
      this.moteSpawnTimer -= dt;
      if (this.moteSpawnTimer <= 0) {
        this.moteSpawnTimer = this.constants.MOTE_SPAWN_INTERVAL_S;
        if (this.motes.length < this.constants.MAX_RANDOM_MOTES) {
          this._spawnRandomMote();
        }
      }
    }

    if (this.randomShades) {
      this.shadeSpawnTimer -= dt;
      if (this.shadeSpawnTimer <= 0) {
        this.shadeSpawnTimer = this.constants.SHADE_SPAWN_INTERVAL_S;
        if (this.shades.length < this.constants.MAX_RANDOM_SHADES) {
          this._spawnRandomShade(true, events, nextTick);
        }
      }
    }

    // 9. Advance tick & clock, evaluate end conditions
    this.tick = nextTick;
    this.simTick = nextTick;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / this.constants.TICK_RATE);

    const allLit = this.lanterns.every((l) => l.lit);
    if (allLit) {
      this.state = 'won';
      this.score +=
        Math.floor(this.timeLeftS) * this.tuning.score.per_second_left +
        this.player.flames * this.tuning.score.per_flame_left;
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'game_over',
        data: { result: 'won', reason: 'all_lit' },
      });
    } else if (this.player.flames <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
    } else if (this.timeLeftS <= 0) {
      this.state = 'lost';
      events.push({
        type: 'event',
        tick: nextTick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' },
      });
    }

    return events;
  }

  getSnapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: roundPos(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundPos(l.pos),
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundPos(s.pos),
        state: s.state,
      })),
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundPos(m.pos),
      })),
      motes_active: this.motes.length,
    };
  }
}
