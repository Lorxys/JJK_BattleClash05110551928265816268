'use strict';

// ---------------------------------------------------------------------------
// Sons : si un fichier existe dans audio/ (voir audio/README.md), il est joué.
// Sinon, on garde le bruitage synthétisé avec Web Audio.
// ---------------------------------------------------------------------------
const SOUND_FILES = {
  blue: 'bleu',
  red: 'rouge',
  purple: 'violet',
  charge: 'charge_violet',
  boom: 'explosion',
  domain: 'extension_territoire',
  whoosh: 'teleportation',
  hurt: 'gojo_touche',
  block: 'infinite_bloque',
  squish: 'fleau_mort',
  curseShot: 'fleau_tir',
  spawn: 'fleau_apparition',
  slam: 'colosse_frappe',
  splash: 'eau',
  fizzle: 'pas_assez_energie',
  wave: 'vague',
  gameover: 'defaite',
};
const MUSIC_FILES = { main: 'musique', domain: 'musique_territoire' };
const AUDIO_EXT = 'mp3';
const MUSIC_VOLUME = 0.35;

const Sfx = {
  ac: null,
  out: null,
  noise: null,
  muted: false,
  raw: {},      // fichiers téléchargés, pas encore décodés
  buffers: {},  // fichiers prêts à jouer
  musicSrc: null,
  musicKey: null,
  wantMusic: null,

  // Télécharge les fichiers présents dès le chargement de la page
  preload() {
    const all = { ...SOUND_FILES };
    for (const k in MUSIC_FILES) all['music_' + k] = MUSIC_FILES[k];
    for (const [key, name] of Object.entries(all)) {
      fetch(`audio/${name}.${AUDIO_EXT}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((data) => {
          if (!data) return;
          this.raw[key] = data;
          this.decode(key);
        })
        .catch(() => {});
    }
  },

  decode(key) {
    if (!this.ac || !this.raw[key]) return;
    const data = this.raw[key];
    delete this.raw[key];
    this.ac.decodeAudioData(data).then((buf) => {
      this.buffers[key] = buf;
      if (key === 'music_' + this.wantMusic) this.music(this.wantMusic);
    }).catch(() => {});
  },

  // Le navigateur (et surtout iOS) exige un geste du joueur avant tout son
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
    for (const key in this.raw) this.decode(key);
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.out) this.out.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  },

  // Joue le fichier s'il existe ; renvoie true si c'est le cas
  file(key, vol = 1) {
    const buf = this.buffers[key];
    if (!buf) return false;
    if (!this.ac || this.muted) return true;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const g = this.ac.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.out);
    src.start();
    return true;
  },

  // Musique en boucle ; reste sur la précédente si le fichier demandé manque
  music(key) {
    this.wantMusic = key;
    const buf = this.buffers['music_' + key];
    if (!this.ac || !buf || this.musicKey === key) return;
    if (this.musicSrc) this.musicSrc.stop();
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ac.createGain();
    g.gain.value = MUSIC_VOLUME;
    src.connect(g).connect(this.out);
    src.start();
    this.musicSrc = src;
    this.musicKey = key;
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
    if (this.file('boom', Math.min(1, p))) return;
    this.noiseBurst(0.9 * p + 0.3, 'lowpass', 1200, 60, 0.9 * p);
    this.tone(0.6, 'sine', 90, 30, 0.8 * p);
  },
  blue() {
    if (this.file('blue')) return;
    this.noiseBurst(1.9, 'bandpass', 200, 1800, 0.35, 4);
    this.tone(1.9, 'sine', 220, 80, 0.15);
  },
  red() {
    if (this.file('red')) return;
    this.noiseBurst(0.25, 'highpass', 3000, 800, 0.25);
    this.tone(0.3, 'square', 600, 200, 0.06);
  },
  charge() {
    if (this.file('charge')) return;
    this.tone(1.0, 'sawtooth', 80, 320, 0.07);
    this.noiseBurst(1.0, 'bandpass', 400, 3000, 0.15, 6);
  },
  purple() {
    if (this.file('purple')) return;
    this.noiseBurst(2.5, 'lowpass', 2500, 80, 0.9);
    this.tone(2.5, 'sine', 60, 25, 0.9);
    this.tone(1.2, 'triangle', 900, 300, 0.08);
  },
  whoosh() {
    if (this.file('whoosh')) return;
    this.noiseBurst(0.25, 'bandpass', 800, 3000, 0.3, 2);
  },
  fizzle() {
    if (!this.throttle('fizzle', 0.15) || this.file('fizzle')) return;
    this.noiseBurst(0.3, 'highpass', 2000, 500, 0.1);
  },
  domain() {
    if (this.file('domain')) return;
    this.tone(3.2, 'sine', 45, 30, 0.7);
    this.tone(2.6, 'triangle', 220, 880, 0.07);
    this.noiseBurst(3, 'bandpass', 3000, 300, 0.2, 3);
  },
  splash() {
    if (!this.throttle('splash', 0.08) || this.file('splash')) return;
    this.noiseBurst(0.4, 'bandpass', 1500, 400, 0.25, 1.5);
  },
  hurt() {
    if (this.file('hurt')) return;
    this.tone(0.25, 'square', 220, 90, 0.12);
    this.noiseBurst(0.2, 'lowpass', 2000, 300, 0.3);
  },
  block() {
    if (!this.throttle('block', 0.06) || this.file('block')) return;
    this.tone(0.15, 'sine', 1400, 900, 0.07);
  },
  squish() {
    if (!this.throttle('squish', 0.04) || this.file('squish')) return;
    this.noiseBurst(0.3, 'lowpass', 900, 120, 0.3);
    this.tone(0.2, 'sine', 160, 60, 0.15);
  },
  curseShot() {
    if (!this.throttle('shot', 0.05) || this.file('curseShot')) return;
    this.tone(0.3, 'sawtooth', 300, 120, 0.04);
  },
  spawn() {
    if (!this.throttle('spawn', 0.1) || this.file('spawn', 0.7)) return;
    this.tone(0.4, 'sawtooth', 70, 40, 0.06);
  },
  slam() {
    if (this.file('slam')) return;
    this.boom(0.8);
  },
  wave() {
    if (this.file('wave')) return;
    this.tone(0.5, 'triangle', 330, 330, 0.08);
    this.tone(0.9, 'triangle', 220, 220, 0.06);
  },
  gameover() {
    if (this.musicSrc) {
      this.musicSrc.stop();
      this.musicSrc = null;
      this.musicKey = null;
    }
    if (this.file('gameover')) return;
    this.tone(1.6, 'sine', 300, 60, 0.2);
  },
};
