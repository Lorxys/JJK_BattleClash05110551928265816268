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
const EDGE_H = -1;        // la mer qui entoure l'île (même niveau que les lacs)
const MAX_DROP = 16;      // hauteur max d'une face latérale (en unités)
const GRAVITY = 32;

const T_GRASS = 0, T_DIRT = 1, T_BURNT = 2, T_VOID = 3, T_WATER = 4, T_SAND = 5, T_STONE = 6, T_FLOWER = 7;
const WATER_H = -1;       // niveau de la surface des lacs

// Projection monde -> écran. x, y en tuiles, z en unités de hauteur.
// Téléphone / tablette (ou ?touch dans l'URL pour forcer l'interface tactile)

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
    this.oy = 0; // décalage vertical appliqué au dessin (marge en haut d'un sprite)
  }
  set(x, y, c) {
    x |= 0; y = (y + this.oy) | 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
  }
  has(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[(y * this.w + x) * 4 + 3] > 0;
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }
  // Contour coloré (« sel-out ») : chaque bord prend une version sombre de la
  // couleur qu'il entoure, comme le trait brun autour de la peau
  selout(f = 0.36) {
    const pts = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          if (this.has(x + dx, y + dy)) {
            pts.push(x, y, mul(this.get(x + dx, y + dy), f));
            break;
          }
        }
      }
    }
    for (let k = 0; k < pts.length; k += 3) this.set(pts[k], pts[k + 1], pts[k + 2]);
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }
  // Polygone quelconque (test du centre de chaque pixel)
  poly(pts, c) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
    return this;
  }
  // Trait épais (membres) : disques de rayon r le long du segment
  capsule(x0, y0, x1, y1, r, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let k = 0; k <= n; k++) this.ellipse(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, r, c);
    return this;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  // Recolore les pixels déjà dessinés qui vérifient test(x, y)
  shade(test, c, only) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.has(x, y) || !test(x, y - this.oy)) continue;
        if (only) {
          const o = this.get(x, y);
          if (o[0] !== only[0] || o[1] !== only[1] || o[2] !== only[2]) continue;
        }
        this.set(x, y - this.oy, c);
      }
    }
    return this;
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

// ---------------------------------------------------------------------------
// Primitives « pixel » pour le canevas : tout tombe sur la grille, rien n'est
// lissé (ni dégradé, ni anticrénelage), comme sur une console 16 bits
// ---------------------------------------------------------------------------
function pxEllipse(ctx, x, y, rx, ry) {
  x = Math.round(x);
  y = Math.round(y);
  const R = Math.max(1, Math.round(ry));
  for (let dy = -R; dy <= R; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (R + 0.5)) ** 2)));
    if (hw > 0) ctx.fillRect(x - hw, y + dy, hw * 2, 1);
  }
}
const pxDisc = (ctx, x, y, r) => pxEllipse(ctx, x, y, r, r);

// Contour d'ellipse en pixels (éventuellement un arc de a0 à a1)
function pxRing(ctx, x, y, rx, ry, w = 1, a0 = 0, a1 = Math.PI * 2) {
  if (rx < 0.5) return;
  const n = Math.max(12, Math.ceil(((rx + ry) * 3.2 * (a1 - a0)) / (Math.PI * 2)));
  let lx = 1e9, ly = 1e9;
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    const px = Math.round(x + Math.cos(a) * rx), py = Math.round(y + Math.sin(a) * ry);
    if (px === lx && py === ly) continue;
    lx = px;
    ly = py;
    ctx.fillRect(px - (w >> 1), py - (w >> 1), w, w);
  }
}

function pxLine(ctx, x0, y0, x1, y1, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * k) / n) - (w >> 1), Math.round(y0 + ((y1 - y0) * k) / n) - (w >> 1), w, w);
  }
}
