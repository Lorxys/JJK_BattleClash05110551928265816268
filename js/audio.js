'use strict';

// ---------------------------------------------------------------------------
// Bruitages synthétisés avec Web Audio (aucun fichier son)
// ---------------------------------------------------------------------------
const Sfx = {
  ac: null,
  out: null,
  noise: null,
  muted: false,

  // Le navigateur exige une interaction avant de jouer du son
  init() {
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.out = this.ac.createGain();
    this.out.gain.value = this.muted ? 0 : 0.45;
    this.out.connect(this.ac.destination);
    const len = this.ac.sampleRate * 2;
    this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  },

  noiseBurst(dur, type, f0, f1, vol, q = 1) {
    const ac = this.ac;
    if (!ac || this.muted) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + dur);
  },

  tone(dur, wave, f0, f1, vol) {
    const ac = this.ac;
    if (!ac || this.muted) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur);
  },

  boom(p = 1) {
    this.noiseBurst(0.9 * p + 0.3, 'lowpass', 1200, 60, 0.9 * p);
    this.tone(0.6, 'sine', 90, 30, 0.8 * p);
  },
  blue() {
    this.noiseBurst(1.9, 'bandpass', 200, 1800, 0.35, 4);
    this.tone(1.9, 'sine', 220, 80, 0.15);
  },
  red() {
    this.noiseBurst(0.25, 'highpass', 3000, 800, 0.25);
    this.tone(0.3, 'square', 600, 200, 0.06);
  },
  charge() {
    this.tone(1.0, 'sawtooth', 80, 320, 0.07);
    this.noiseBurst(1.0, 'bandpass', 400, 3000, 0.15, 6);
  },
  purple() {
    this.noiseBurst(2.5, 'lowpass', 2500, 80, 0.9);
    this.tone(2.5, 'sine', 60, 25, 0.9);
    this.tone(1.2, 'triangle', 900, 300, 0.08);
  },
  whoosh() {
    this.noiseBurst(0.25, 'bandpass', 800, 3000, 0.3, 2);
  },
  fizzle() {
    if (this.throttle('fizzle', 0.15)) this.noiseBurst(0.3, 'highpass', 2000, 500, 0.1);
  },

  // évite d'empiler cent fois le même son dans la même fraction de seconde
  last: {},
  throttle(key, gap) {
    if (!this.ac) return false;
    const t = this.ac.currentTime;
    if (t - (this.last[key] || -1) < gap) return false;
    this.last[key] = t;
    return true;
  },

  domain() {
    this.tone(3.2, 'sine', 45, 30, 0.7);
    this.tone(2.6, 'triangle', 220, 880, 0.07);
    this.noiseBurst(3, 'bandpass', 3000, 300, 0.2, 3);
  },
  splash() {
    if (this.throttle('splash', 0.08)) this.noiseBurst(0.4, 'bandpass', 1500, 400, 0.25, 1.5);
  },
  hurt() {
    this.tone(0.25, 'square', 220, 90, 0.12);
    this.noiseBurst(0.2, 'lowpass', 2000, 300, 0.3);
  },
  block() {
    if (this.throttle('block', 0.06)) this.tone(0.15, 'sine', 1400, 900, 0.07);
  },
  squish() {
    if (!this.throttle('squish', 0.04)) return;
    this.noiseBurst(0.3, 'lowpass', 900, 120, 0.3);
    this.tone(0.2, 'sine', 160, 60, 0.15);
  },
  curseShot() {
    if (this.throttle('shot', 0.05)) this.tone(0.3, 'sawtooth', 300, 120, 0.04);
  },
};
