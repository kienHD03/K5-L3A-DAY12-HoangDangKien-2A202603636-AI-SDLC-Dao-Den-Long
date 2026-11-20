/**
 * Web Audio API synthesizer: soft night ambient music + full Phase 2 SFX set.
 * Purely client-side (never imported in headless mode).
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.ambientTimer = null;
    this.ambientStep = 0;
  }

  setVolume(vol01) {
    this.volume = Math.max(0, Math.min(1, vol01));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  _ensure() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _tone(freq, duration, type = 'sine', gain = 0.08, delay = 0) {
    const ctx = this._ensure();
    if (!ctx || !this.masterGain || this.volume <= 0.001) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  startAmbient() {
    if (this.ambientTimer) return;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
    this.ambientTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const n = notes[this.ambientStep % notes.length];
      this.ambientStep++;
      this._tone(n * 0.5, 1.8, 'sine', 0.022, 0);
      if (this.ambientStep % 2 === 0) {
        this._tone(n, 1.1, 'triangle', 0.014, 0.15);
      }
    }, 1800);
  }

  pickup() {
    this._tone(660, 0.14, 'triangle', 0.08, 0);
    this._tone(990, 0.18, 'sine', 0.06, 0.05);
  }

  deposit() {
    this._tone(440, 0.15, 'triangle', 0.08, 0);
    this._tone(554.37, 0.18, 'triangle', 0.07, 0.06);
  }

  lanternLit() {
    this._tone(523.25, 0.3, 'triangle', 0.09, 0);
    this._tone(659.25, 0.35, 'triangle', 0.09, 0.08);
    this._tone(783.99, 0.45, 'sine', 0.09, 0.16);
    this._tone(1046.5, 0.55, 'sine', 0.07, 0.24);
  }

  pulse() {
    this._tone(280, 0.35, 'sine', 0.12, 0);
    this._tone(560, 0.4, 'triangle', 0.08, 0.04);
  }

  hit() {
    this._tone(180, 0.28, 'sawtooth', 0.09, 0);
    this._tone(110, 0.34, 'sine', 0.1, 0.06);
  }

  jump() {
    this._tone(320, 0.12, 'sine', 0.06, 0);
    this._tone(480, 0.14, 'sine', 0.05, 0.04);
  }

  dash() {
    this._tone(520, 0.12, 'triangle', 0.08, 0);
    this._tone(780, 0.15, 'sine', 0.06, 0.03);
  }

  charm() {
    this._tone(587.33, 0.2, 'triangle', 0.08, 0);
    this._tone(880, 0.3, 'sine', 0.08, 0.07);
    this._tone(1174.66, 0.35, 'sine', 0.07, 0.14);
  }

  shadeSpawn() {
    this._tone(140, 0.45, 'sawtooth', 0.05, 0);
    this._tone(105, 0.5, 'sine', 0.06, 0.1);
  }

  drifterSteal() {
    this._tone(420, 0.15, 'sine', 0.07, 0);
    this._tone(260, 0.2, 'triangle', 0.07, 0.06);
  }

  windTelegraph() {
    this._tone(240, 0.6, 'sine', 0.04, 0);
    this._tone(300, 0.6, 'sine', 0.035, 0.2);
  }

  countdownTick() {
    this._tone(880, 0.08, 'square', 0.04, 0);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => this._tone(n, 0.5, 'triangle', 0.09, i * 0.1));
  }

  lose() {
    [330, 293.66, 246.94, 196].forEach((n, i) => this._tone(n, 0.45, 'sine', 0.08, i * 0.12));
  }
}
