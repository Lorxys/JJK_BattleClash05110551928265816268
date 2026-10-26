'use strict';

// ---------------------------------------------------------------------------
// Constantes du monde isométrique (en pixels de la résolution interne)
// ---------------------------------------------------------------------------
const TW = 32;            // largeur d'une tuile
const TH = 16;            // hauteur d'une tuile
const HS = 8;             // pixels par unité de hauteur
const MAP_W = 128;
const MAP_H = 128;
const MIN_H = -5;         // profondeur max d'un cratère
const EDGE_H = -10;       // niveau du vide autour de l'île (falaises du bord)
const MAX_DROP = 16;      // hauteur max d'une face latérale (en unités)
const GRAVITY = 32;

const T_GRASS = 0, T_DIRT = 1, T_BURNT = 2, T_VOID = 3, T_WATER = 4, T_SAND = 5, T_STONE = 6, T_FLOWER = 7;
const WATER_H = -1;       // niveau de la surface des lacs

// Projection monde -> écran. x, y en tuiles, z en unités de hauteur.
const isoX = (x, y) => (x - y) * (TW / 2);
const isoY = (x, y, z) => (x + y) * (TH / 2) - z * HS;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr, r = Math.random) => arr[(r() * arr.length) | 0];

function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit de valeur lissé, utilisé pour le relief et les forêts
function makeNoise(seed) {
  const r = mulberry32(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const g = (i, j) => grid[((j & 255) << 8) | (i & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mul = (c, f) => [clamp((c[0] * f) | 0, 0, 255), clamp((c[1] * f) | 0, 0, 255), clamp((c[2] * f) | 0, 0, 255)];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Tampon de pixels : tout le pixel art est dessiné à la main dedans
class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  has(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0;
  }
  outline(c) {
    const pts = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.has(x, y) && (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1))) pts.push(x, y);
      }
    }
    for (let k = 0; k < pts.length; k += 2) this.set(pts[k], pts[k + 1], c);
    return this;
  }
  canvas() {
    const [c, ctx] = makeCanvas(this.w, this.h);
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
}
