/**
 * Lightweight Web Audio API synthesizer for fairy-tale night sound effects.
 * Purely client-side (never imported in headless mode).
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
  }

  _ensure() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _tone(freq, duration, type = 'sine', gain = 0.08, delay = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  pickup() {
    this._tone(660, 0.14, 'triangle', 0.07, 0);
    this._tone(990, 0.18, 'sine', 0.06, 0.05);
  }

  deposit() {
    this._tone(440, 0.15, 'triangle', 0.07, 0);
    this._tone(554, 0.18, 'triangle', 0.07, 0.06);
  }

  lanternLit() {
    this._tone(523.25, 0.3, 'triangle', 0.09, 0);
    this._tone(659.25, 0.35, 'triangle', 0.09, 0.08);
    this._tone(783.99, 0.45, 'sine', 0.09, 0.16);
    this._tone(1046.5, 0.55, 'sine', 0.07, 0.24);
  }

  pulse() {
    this._tone(280, 0.35, 'sine', 0.11, 0);
    this._tone(560, 0.4, 'triangle', 0.07, 0.04);
  }

  hit() {
    this._tone(180, 0.28, 'sawtooth', 0.08, 0);
    this._tone(120, 0.32, 'sine', 0.09, 0.06);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => this._tone(n, 0.5, 'triangle', 0.09, idx * 0.1));
  }

  lose() {
    const notes = [330, 293.66, 246.94, 196];
    notes.forEach((n, idx) => this._tone(n, 0.45, 'sine', 0.08, idx * 0.12));
  }
}
