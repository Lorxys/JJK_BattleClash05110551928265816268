'use strict';

// ---------------------------------------------------------------------------
// Tout le pixel art est généré ici au démarrage (aucune image externe)
// ---------------------------------------------------------------------------
const Gfx = {};
const OUTLINE = hexToRgb('#0b0b14');
const toRgb = (list) => list.map(hexToRgb);

function spriteFromRows(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w + 2, h + 2);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) p.set(x + 1, y + 1, c);
    }
  });
  return p.outline(OUTLINE).canvas();
}

function flipH(c) {
  const [o, ctx] = makeCanvas(c.width, c.height);
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(c, 0, 0);
  return o;
}

// Silhouette unie (flash quand un fléau est touché)
function tintOf(c, color) {
  const [o, ctx] = makeCanvas(c.width, c.height);
  ctx.drawImage(c, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return o;
}

// Version carbonisée d'un arbre (mise en cache)
const charredCache = new Map();
function charredSprite(c) {
  if (!charredCache.has(c)) charredCache.set(c, tintOf(c, 'rgba(24,18,16,0.82)'));
  return charredCache.get(c);
}

// --- Tuiles ----------------------------------------------------------------
// Charte claire et saturée : herbe vert tendre, sable chaud, mer bleu nuit
const GRASS_BASE = ['#62a838', '#5ea236', '#68ae3c', '#64aa3a', '#6db240', '#5a9c34'];
const TOP_PAL = [
  toRgb(GRASS_BASE),
  toRgb(['#9a6a3e', '#8f6139', '#a47244', '#946640']),
  toRgb(['#3a2e2a', '#43362f', '#4d3d34', '#352a25']),
  toRgb(['#1e1630', '#241a38', '#2a1f40', '#211834']),
  toRgb(['#24457f', '#264884', '#22427a', '#284b88']),
  toRgb(['#e2c088', '#dcba82', '#e6c68e', '#d9b67e']),
  toRgb(['#a09a94', '#a8a29c', '#98928c']),
  toRgb(GRASS_BASE),
];

const DIRT_BODY = toRgb(['#8a5a32', '#7e522e', '#946238', '#764c2b']);
const SIDE_PAL = [
  { lip: toRgb(['#5a9c34', '#3f7a28']), body: DIRT_BODY, stone: hexToRgb('#a88a6a') },
  { lip: toRgb(['#9a6a3e', '#86592f']), body: DIRT_BODY, stone: hexToRgb('#a88a6a') },
  { lip: toRgb(['#352a25', '#28201c']), body: toRgb(['#4a3a32', '#42342d', '#524038', '#3c2f29']), stone: hexToRgb('#6a5a50') },
  { lip: toRgb(['#3a2358', '#2b1a42']), body: toRgb(['#171020', '#1c1427', '#140d1c', '#21172e']), stone: hexToRgb('#6a35b8') },
  { lip: toRgb(['#3e63a6', '#2a4a88']), body: toRgb(['#1c3668', '#1f3a6e', '#1a3262', '#213e74']), stone: hexToRgb('#3e63a6') },
  { lip: toRgb(['#e2c088', '#c9a46e']), body: toRgb(['#c49c66', '#b8905c', '#cca46c', '#b08856']), stone: hexToRgb('#9a7a5a') },
  { lip: toRgb(['#a09a94', '#7e7872']), body: toRgb(['#86807a', '#7a746e', '#8e8882', '#706a64']), stone: hexToRgb('#b0aaa4') },
  { lip: toRgb(['#5a9c34', '#3f7a28']), body: DIRT_BODY, stone: hexToRgb('#a88a6a') },
];
const FLOWER_COLS = toRgb(['#fff6e0', '#ffd84a', '#f2a6c8', '#8fa8ff', '#ff8a5a']);

// Masque du losange 32x16
function inDiamond(x, y) {
  if (y < 0 || y > 15) return false;
  const r = y < 8 ? y : 15 - y;
  const half = 2 * (r + 1);
  return x >= 16 - half && x < 16 + half;
}

function randomInDiamond(r, minY = 0) {
  let x, y;
  do {
    x = (r() * 32) | 0;
    y = minY + ((r() * (16 - minY)) | 0);
  } while (!inDiamond(x, y));
  return [x, y];
}

function addBlades(p, r, count) {
  const light = toRgb(['#7cc04c', '#88c858']), dark = toRgb(['#4a8a2c', '#3f7a28']);
  for (let k = 0; k < count; k++) {
    const [x, y] = randomInDiamond(r, 2);
    const hgt = 1 + ((r() * 2) | 0);
    const c = r() < 0.5 ? pick(light, r) : pick(dark, r);
    for (let s = 0; s < hgt; s++) p.set(x + (s === hgt - 1 && r() < 0.4 ? 1 : 0), y + 4 - s, c);
  }
}

function addFlowers(p, r, count, cols) {
  for (let k = 0; k < count; k++) {
    const [x, y] = randomInDiamond(r, 3);
    p.set(x, y + 3, pick(cols, r));
    p.set(x, y + 4, hexToRgb('#3f7a28'));
  }
}

// Petits amas de pixels (jamais de bruit pixel par pixel) : lumière, ombre, grain
function addClusters(p, r, count, cols, size) {
  for (let k = 0; k < count; k++) {
    let [x, y] = randomInDiamond(r);
    const c = pick(cols, r), n = size[0] + ((r() * (size[1] - size[0] + 1)) | 0);
    for (let s = 0; s < n; s++) {
      if (inDiamond(x, y)) p.set(x, y + 4, c);
      if (r() < 0.6) x += r() < 0.5 ? -1 : 1;
      else y += r() < 0.5 ? -1 : 1;
    }
  }
}

const GRASS_LIGHT = toRgb(['#6eb43e', '#78bc46']);
const GRASS_DARK = toRgb(['#4f9230', '#558f2e']);
const SAND_GRAIN = toRgb(['#d0aa72', '#c8a06a']);
const SAND_LIGHT = toRgb(['#f0d8a6', '#eccf98']);

function buildTop(t, r) {
  // 4 px de marge en haut pour les brins d'herbe qui dépassent
  const p = new Pix(32, 20);
  const base = TOP_PAL[t];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inDiamond(x, y)) continue;
      // herbe, sable et eau : une teinte dominante, les nuances viennent en amas
      let c = t === T_GRASS || t === T_FLOWER || t === T_SAND || t === T_WATER ? base[0] : base[(r() * base.length) | 0];
      if (t === T_STONE) {
        // pavés : joints selon les deux axes isométriques
        const u = x * 0.5 + y + 40, v = y - x * 0.5 + 40;
        if (u % 5 < 1 || v % 5 < 1) c = hexToRgb('#5d5d66');
      }
      if (!inDiamond(x, y - 1) && x < 16) c = mul(c, 1.1);
      else if (!inDiamond(x, y + 1) && x >= 16) c = mul(c, 0.9);
      p.set(x, y + 4, c);
    }
  }
  if (t === T_GRASS) {
    addClusters(p, r, 3, GRASS_LIGHT, [3, 7]);
    addClusters(p, r, 3, GRASS_DARK, [2, 5]);
    addBlades(p, r, 4 + ((r() * 6) | 0));
    if (r() < 0.4) addFlowers(p, r, 1 + ((r() * 3) | 0), [pick(FLOWER_COLS, r)]);
  } else if (t === T_FLOWER) {
    addClusters(p, r, 3, GRASS_LIGHT, [3, 6]);
    addClusters(p, r, 2, GRASS_DARK, [2, 4]);
    addBlades(p, r, 5 + ((r() * 5) | 0));
    addFlowers(p, r, 7 + ((r() * 7) | 0), FLOWER_COLS);
  } else if (t === T_DIRT) {
    const n = 2 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const [x, y] = randomInDiamond(r);
      p.set(x, y + 4, hexToRgb(r() < 0.5 ? '#a08060' : '#4f3420'));
    }
  } else if (t === T_BURNT) {
    const n = 3 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const [x, y] = randomInDiamond(r);
      p.set(x, y + 4, hexToRgb(r() < 0.35 ? '#d0602a' : '#6a5a50'));
    }
  } else if (t === T_VOID) {
    // veines d'énergie violette
    const vein = toRgb(['#5a2ca0', '#7d3fd0', '#b37cff']);
    let [x, y] = randomInDiamond(r);
    const len = 4 + ((r() * 8) | 0);
    for (let k = 0; k < len; k++) {
      if (inDiamond(x, y)) p.set(x, y + 4, vein[k === len - 1 ? 2 : (r() * 2) | 0]);
      if (r() < 0.5) x += r() < 0.5 ? -1 : 1;
      else y += r() < 0.5 ? -1 : 1;
    }
  } else if (t === T_WATER) {
    addClusters(p, r, 2, [TOP_PAL[T_WATER][2]], [5, 9]);
    // petites vagues en tirets
    const hl = toRgb(['#3c62a8', '#5a82c8']);
    const n = 4 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const [x, y] = randomInDiamond(r, 1);
      const len = 2 + ((r() * 3) | 0), c = r() < 0.3 ? hl[1] : hl[0];
      for (let s = 0; s < len; s++) if (inDiamond(x + s, y)) p.set(x + s, y + 4, c);
    }
    // un reflet blanc de temps en temps
    if (r() < 0.4) {
      const [x, y] = randomInDiamond(r, 2);
      for (let s = 0; s < 2; s++) if (inDiamond(x + s, y)) p.set(x + s, y + 4, hexToRgb('#a9c6ee'));
    }
  } else if (t === T_SAND) {
    // grain du sable en petits amas, plus clair au soleil
    addClusters(p, r, 5, SAND_GRAIN, [1, 3]);
    addClusters(p, r, 3, SAND_LIGHT, [2, 4]);
  }
  return p.canvas();
}


// Lisière d'herbe qui déborde sur une tuile de sable voisine, pour que la
// limite herbe/sable soit irrégulière plutôt qu'une diagonale parfaite.
// dir : 0 = bord haut-gauche (i-1), 1 = haut-droit (j-1), 2 = bas-droit (i+1), 3 = bas-gauche (j+1)
function buildFringe(dir, r) {
  const p = new Pix(32, 20);
  const ph1 = r() * 6, ph2 = r() * 6, base = TOP_PAL[T_GRASS][0];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inDiamond(x, y)) continue;
      const u = (x + 0.5 - 16) / 16, v = (y + 0.5 - 8) / 8;
      const d = [1 + u + v, 1 - u + v, 1 - u - v, 1 + u - v][dir] * 8;
      const w = Math.max(0.6, 2.4 + 1.4 * Math.sin(x * 0.7 + ph1) + 0.8 * Math.sin(x * 1.9 + ph2));
      if (d < w) p.set(x, y + 4, r() < 0.15 ? GRASS_LIGHT[0] : base);
      else if (d < w + 1) p.set(x, y + 4, GRASS_DARK[0]);
    }
  }
  return p.canvas();
}

// Face latérale (gauche ou droite) d'une colonne de `drop` unités de haut
function buildSide(t, drop, right, r) {
  const hp = drop * HS;
  const p = new Pix(32, 17 + hp);
  const S = SIDE_PAL[t];
  const face = right ? 0.68 : 0.88;
  for (let xx = 0; xx < 16; xx++) {
    const x = right ? 31 - xx : xx;
    const y0 = 17 - Math.ceil((16 - xx) / 2);
    for (let d = 0; d < hp; d++) {
      let c = d < 2 ? S.lip[d] : S.body[(r() * S.body.length) | 0];
      if (d >= 2 && r() < 0.03) c = S.stone;
      if (d % HS === HS - 1) c = mul(c, 0.82);
      p.set(x, y0 + d, mul(c, face * (1 - Math.min(0.3, d * 0.004))));
    }
  }
  return p.canvas();
}

function diamondCanvas(c) {
  const p = new Pix(32, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) if (inDiamond(x, y)) p.set(x, y, c);
  return p.canvas();
}

function reticleCanvas() {
  const p = new Pix(32, 16), c = [255, 255, 255];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (inDiamond(x, y) && (!inDiamond(x - 1, y) || !inDiamond(x + 1, y) || !inDiamond(x, y - 1) || !inDiamond(x, y + 1))) p.set(x, y, c);
    }
  }
  return p.canvas();
}

function glowCanvas(size, rgb, a) {
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // paliers nets plutôt qu'un dégradé lisse
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] / (255 * a / 4)) * ((255 * a) / 4);
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildFlame(r) {
  const p = new Pix(8, 12);
  const cols = toRgb(['#ff3a10', '#ff7a20', '#ffb040', '#ffe08a']);
  for (let y = 0; y < 12; y++) {
    const hw = 3.6 * Math.sin(((y + 1) / 12) * Math.PI * 0.8) + (r() - 0.5) * 0.8;
    for (let x = 0; x < 8; x++) {
      const dx = Math.abs(x - 3.5);
      if (dx > hw) continue;
      const inner = 1 - dx / Math.max(hw, 0.5);
      p.set(x, y, cols[clamp(Math.floor((y / 11) * 2 + inner * 2 - 0.3), 0, 3)]);
    }
  }
  return p.canvas();
}

// --- Végétation, rochers, sanctuaires -----------------------------------------
const LEAF_OAK = toRgb(['#1c4424', '#2a6630', '#3a8238', '#52a044', '#78c058']);
const LEAF_SAKURA = toRgb(['#9a3e66', '#c85a88', '#e47ea6', '#f4a8c4', '#ffd4e4']);
const LEAF_PINE = toRgb(['#163a26', '#22573a', '#2f7246', '#4a9058']);
const BARK = toRgb(['#4e321e', '#74492a', '#94633a']);

function shadeBlobs(p, blobs, pal, r, x0, x1, y0, y1, thresholds) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let best = 0, bl = null;
      for (const b of blobs) {
        const dx = x - b.x, dy = y - b.y;
        const q = 1 - (dx * dx + dy * dy) / (b.r * b.r);
        if (q > best) { best = q; bl = b; }
      }
      if (!bl || best < r() * 0.12) continue;
      const dx = (x - bl.x) / bl.r, dy = (y - bl.y) / bl.r;
      const l = -dx * 0.45 - dy * 0.65 + best * 0.35 + (r() - 0.5) * 0.35 - (y - bl.y > 3 ? 0.15 : 0);
      let idx = 0;
      while (idx < thresholds.length && l >= thresholds[idx]) idx++;
      p.set(x, y, pal[idx]);
    }
  }
}

function buildOak(r, leaves = LEAF_OAK) {
  const W = 38, H = 52, cx = 19, p = new Pix(W, H);
  for (let y = 30; y < H - 2; y++) {
    const flare = y > H - 7 ? y - (H - 7) : 0;
    const xa = cx - 2 - flare, xb = cx + 1 + flare;
    for (let x = xa; x <= xb; x++) {
      let c = x === xa ? BARK[2] : x === xb ? BARK[0] : BARK[1];
      if (r() < 0.08) c = BARK[0];
      p.set(x, y, c);
    }
  }
  for (let t = 0; t < 6; t++) {
    p.set(cx - 2 - t, 31 - t, BARK[1]);
    p.set(cx + 1 + t, 32 - t, BARK[0]);
  }
  const blobs = [{ x: cx, y: 18, r: 10 }];
  const n = 5 + ((r() * 4) | 0);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = 3 + r() * 4;
    blobs.push({ x: cx + Math.cos(a) * d * 1.25, y: 18 + Math.sin(a) * d * 0.85, r: 5 + r() * 4 });
  }
  shadeBlobs(p, blobs, leaves, r, 0, W, 0, 36, [-0.35, 0, 0.3, 0.55]);
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: H - 3 };
}

// Touffe de hautes herbes sombres
function buildTuft(r) {
  const W = 14, H = 12, p = new Pix(W, H);
  const pal = toRgb(['#24501e', '#336a26', '#457f2e']);
  const n = 6 + ((r() * 4) | 0);
  for (let k = 0; k < n; k++) {
    const x0 = 2 + ((r() * 10) | 0), hgt = 5 + ((r() * 5) | 0), lean = (x0 - 7) * 0.12;
    for (let s = 0; s < hgt; s++) p.set(Math.round(x0 + lean * s), 10 - s, pal[s > hgt - 3 ? 2 : (r() * 2) | 0]);
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 7, ay: 10 };
}

// Roseaux (massettes) au bord de l'eau
function buildReed(r) {
  const W = 18, H = 26, p = new Pix(W, H);
  const stem = toRgb(['#3a5e22', '#55782c', '#6e8a34']), head = toRgb(['#5a3a1e', '#7a5028']);
  const n = 4 + ((r() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const x = 3 + ((r() * 12) | 0), hgt = 14 + ((r() * 9) | 0);
    for (let s = 0; s < hgt; s++) {
      p.set(x, 24 - s, stem[(r() * 3) | 0]);
      if (s < hgt / 2) p.set(x + 1, 24 - s, stem[0]);
    }
    if (r() < 0.7) fillRect(p, x, 24 - hgt - 1, x + 1, 24 - hgt + 4, head[r() < 0.5 ? 0 : 1]);
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 9, ay: 24 };
}

// Nénuphar posé sur l'eau
function buildLily(r) {
  const W = 12, H = 7, p = new Pix(W, H);
  const [d, m, l] = toRgb(['#2f7a3a', '#4aa04a', '#6cc060']);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 5.5) / 5.5, dy = (y - 3) / 3;
      if (dx * dx + dy * dy > 1 || (x >= 6 && y === 3)) continue;
      p.set(x, y, dy < -0.3 ? l : dy > 0.4 ? d : m);
    }
  }
  if (r() < 0.5) {
    const fc = hexToRgb(r() < 0.5 ? '#ffd4e4' : '#fff6e0');
    p.set(4, 2, fc);
    p.set(5, 2, fc);
    p.set(4, 1, fc);
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 6, ay: 4 };
}

function buildPine(r) {
  const W = 30, H = 54, cx = 15, p = new Pix(W, H);
  for (let y = 38; y < H - 2; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) p.set(x, y, x === cx - 1 ? BARK[2] : x === cx + 1 ? BARK[0] : BARK[1]);
  }
  for (let L = 0; L < 4; L++) {
    const top = 2 + L * 9, hgt = 15, maxW = 5 + L * 2.6;
    for (let y = top; y < top + hgt; y++) {
      const t = (y - top) / hgt;
      const hw = Math.max(1, t * maxW + (r() < 0.3 ? 1 : 0));
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const dx = (x - cx) / (maxW + 1);
        const l = -dx * 0.8 + (1 - t) * 0.3 - (t > 0.8 ? 0.4 : 0) + (r() - 0.5) * 0.3;
        const idx = l < -0.35 ? 0 : l < 0.05 ? 1 : l < 0.35 ? 2 : 3;
        p.set(x, y, LEAF_PINE[idx]);
      }
    }
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: H - 3 };
}

function buildBush(r) {
  const W = 20, H = 14, p = new Pix(W, H);
  const blobs = [{ x: 10, y: 8, r: 5 }];
  for (let k = 0; k < 3; k++) blobs.push({ x: 10 + (r() - 0.5) * 8, y: 8 + (r() - 0.5) * 3, r: 3 + r() * 2 });
  shadeBlobs(p, blobs, LEAF_OAK, r, 0, W, 0, 13, [-0.35, 0, 0.3, 0.55]);
  if (r() < 0.6) {
    const fc = pick(toRgb(['#e98bb5', '#f4f1e0', '#f2d544']), r);
    for (let k = 0; k < 4; k++) {
      const x = 5 + ((r() * 10) | 0), y = 4 + ((r() * 6) | 0);
      if (p.has(x, y)) p.set(x, y, fc);
    }
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 10, ay: 12 };
}

function buildRock(r) {
  const W = 20, H = 15, p = new Pix(W, H);
  const pal = toRgb(['#4a4a52', '#66666e', '#86868e', '#a6a6ac', '#c8c8cc']);
  const rx = 7 + r() * 2, ry = 5 + r() * 1.5, cx = 10, cy = 13 - ry;
  for (let y = 0; y <= 13; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy + (r() - 0.5) * 0.15 > 1) continue;
      const l = -dx * 0.5 - dy * 0.7 + (r() - 0.5) * 0.3;
      const idx = l < -0.4 ? 0 : l < -0.05 ? 1 : l < 0.3 ? 2 : l < 0.6 ? 3 : 4;
      p.set(x, y, pal[idx]);
    }
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: 13 };
}

function fillRect(p, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.set(x, y, c);
}

function buildTorii() {
  const W = 46, H = 48, p = new Pix(W, H);
  const [red, dark, light] = toRgb(['#c8322a', '#8f1f1a', '#e05a48']);
  const black = hexToRgb('#1c1416');
  for (const px of [9, 33]) {
    fillRect(p, px, 10, px + 3, 45, red);
    fillRect(p, px, 10, px, 45, light);
    fillRect(p, px + 3, 10, px + 3, 45, dark);
    fillRect(p, px - 1, 43, px + 4, 45, black);
  }
  fillRect(p, 2, 4, 43, 7, black);           // kasagi
  fillRect(p, 0, 2, 2, 5, black);
  fillRect(p, 43, 2, 45, 5, black);
  fillRect(p, 4, 8, 41, 9, red);             // shimaki
  fillRect(p, 5, 16, 40, 18, red);           // nuki
  fillRect(p, 5, 16, 40, 16, light);
  fillRect(p, 21, 9, 24, 15, black);         // plaque
  fillRect(p, 22, 11, 23, 13, hexToRgb('#d9b45a'));
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 23, ay: 45 };
}

function buildLantern() {
  const W = 14, H = 26, p = new Pix(W, H);
  const [d, m, l] = toRgb(['#5d606c', '#8d93a3', '#b4b9c6']);
  fillRect(p, 3, 21, 10, 23, m);
  fillRect(p, 3, 23, 10, 23, d);
  fillRect(p, 5, 14, 8, 20, m);
  fillRect(p, 5, 14, 5, 20, l);
  fillRect(p, 3, 9, 10, 13, m);
  fillRect(p, 5, 10, 8, 12, hexToRgb('#ffd36a'));
  fillRect(p, 1, 6, 12, 8, d);
  fillRect(p, 3, 5, 10, 5, d);
  fillRect(p, 6, 3, 7, 4, d);
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 7, ay: 23 };
}

// --- Fléaux ------------------------------------------------------------------
function curseArt(p, ax, ay) {
  p.outline(OUTLINE);
  const c = p.canvas();
  return { c, w: tintOf(c, '#ffffff'), ax, ay };
}

function eyeDot(p, x, y) {
  p.set(x, y, [240, 236, 228]);
  p.set(x + 1, y, [240, 236, 228]);
  p.set(x, y + 1, [240, 236, 228]);
  p.set(x + 1, y + 1, [20, 10, 14]);
}

function buildLarva(r, squash) {
  const W = 20, H = 17, p = new Pix(W, H);
  const pal = toRgb(['#2e2040', '#4a3466', '#6a4c8e', '#8f6cb8']);
  const rx = squash ? 8 : 7, ry = squash ? 4.5 : 5.5, cx = 10, cy = 14 - ry;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.4 - dy * 0.7 + (r() - 0.5) * 0.3;
      p.set(x, y, pal[l < -0.35 ? 0 : l < 0 ? 1 : l < 0.4 ? 2 : 3]);
    }
  }
  for (const fx of [5, 9, 13]) fillRect(p, fx, 14, fx + 1, 15, pal[0]);
  const my = Math.round(cy + ry * 0.35);
  for (let x = cx - 4; x <= cx + 4; x++) {
    p.set(x, my, [150, 20, 40]);
    if ((x & 1) === 0) p.set(x, my - 1, [236, 228, 210]);
  }
  eyeDot(p, cx - 4, Math.round(cy - 2));
  eyeDot(p, cx + 1, Math.round(cy - 3));
  eyeDot(p, cx + 4, Math.round(cy));
  return curseArt(p, cx, 15);
}

function buildEye(phase) {
  const W = 24, H = 30, p = new Pix(W, H), cx = 12, cy = 9, R = 8;
  const tent = toRgb(['#2a1830', '#3e2448']);
  for (let t = 0; t < 4; t++) {
    const bx = cx - 5 + t * 3;
    for (let y = 15; y < 28; y++) {
      const x = bx + Math.sin(y * 0.55 + phase + t * 1.3) * 1.5;
      p.set(x, y, tent[1]);
      if (y < 24) p.set(x + 1, y, tent[0]);
    }
  }
  const scl = toRgb(['#9a8a86', '#c8bab2', '#e8e0d8', '#fffaf4']);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R) continue;
      const l = (-(x - cx) / R) * 0.4 - ((y - cy) / R) * 0.6 + (1 - d / R) * 0.3;
      p.set(x, y, scl[l < -0.3 ? 0 : l < 0.05 ? 1 : l < 0.4 ? 2 : 3]);
    }
  }
  const vr = mulberry32(77 + phase * 10);
  for (let v = 0; v < 5; v++) {
    const a = vr() * Math.PI * 2;
    let x = cx + Math.cos(a) * (R - 1), y = cy + Math.sin(a) * (R - 1);
    for (let s = 0; s < 4; s++) {
      p.set(x, y, [192, 80, 106]);
      x += (cx - x) * 0.25 + (vr() - 0.5) * 1.5;
      y += (cy - y) * 0.25 + (vr() - 0.5) * 1.5;
    }
  }
  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d <= 3.6) p.set(cx + 1 + x, cy + 1 + y, d > 2.6 ? [122, 16, 32] : d > 1.6 ? [200, 32, 58] : [10, 6, 8]);
    }
  }
  p.set(cx - 1, cy - 1, [255, 255, 255]);
  return curseArt(p, cx, H - 3);
}

function buildBrute(r, phase) {
  const W = 40, H = 46, p = new Pix(W, H);
  const pal = toRgb(['#17171a', '#2a2a26', '#3e3d35', '#55533f', '#6b6a50']);
  const blobs = [
    { x: 20, y: 24, r: 13 }, { x: 20, y: 12, r: 8 }, { x: 20, y: 31, r: 10 },
    { x: 6, y: 27 + phase, r: 5 }, { x: 6, y: 35 + phase, r: 4.5 },
    { x: 34, y: 27 - phase, r: 5 }, { x: 34, y: 35 - phase, r: 4.5 },
    { x: 14, y: 40, r: 4.5 }, { x: 26, y: 40, r: 4.5 },
  ];
  shadeBlobs(p, blobs, pal, r, 0, W, 0, H - 2, [-0.4, -0.1, 0.25, 0.5]);
  fillRect(p, 13, 25, 27, 28, hexToRgb('#3a0a10'));
  for (let x = 13; x <= 27; x += 2) {
    p.set(x, 25, [232, 224, 200]);
    p.set(x + 1, 28, [232, 224, 200]);
  }
  for (const [ex, ey] of [[16, 9], [23, 10], [19, 13], [13, 15], [27, 16]]) {
    p.set(ex, ey, [242, 213, 68]);
    p.set(ex + 1, ey, [242, 213, 68]);
    p.set(ex + 1, ey + 1, [20, 20, 10]);
  }
  return curseArt(p, 20, H - 4);
}

// --- Icônes des boutons ---------------------------------------------------------
// Orbe en anneaux concentriques : cœur blanc puis trois teintes vers le bord
function iconOrb(cols, R, deco) {
  const p = new Pix(18, 18), c = toRgb(cols);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x - 8.5, y - 8.5) / R;
      if (d > 1) continue;
      p.set(x, y, c[d < 0.3 ? 0 : d < 0.55 ? 1 : d < 0.8 ? 2 : 3]);
    }
  }
  p.set(6, 6, c[0]);
  p.set(7, 5, c[0]);
  if (deco) deco(p, c);
  return p.outline(OUTLINE).canvas();
}

function iconRows(rows, pal) {
  const rgb = {};
  for (const k in pal) rgb[k] = hexToRgb(pal[k]);
  return spriteFromRows(rows, rgb);
}

function buildIcons() {
  Gfx.icons = {
    // Bleu : orbe qui aspire, avec des débris en spirale
    blue: iconOrb(['#ffffff', '#bfe4ff', '#5aa8ff', '#1d4fb8'], 6, (p, c) => {
      for (const [x, y] of [[1, 6], [2, 3], [15, 11], [14, 14], [11, 1], [6, 16]]) p.set(x, y, c[1]);
    }),
    // Rouge : orbe qui repousse, avec des rayons
    red: iconOrb(['#ffffff', '#ffd0a0', '#ff6a3a', '#b81d1d'], 5.5, (p, c) => {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        p.set(Math.round(8.5 + Math.cos(a) * 7.6), Math.round(8.5 + Math.sin(a) * 7.6), c[k & 1 ? 2 : 1]);
      }
    }),
    // Violet : grande orbe crépitante
    purple: iconOrb(['#ffffff', '#ead0ff', '#b06aff', '#5a1db8'], 7.8, (p) => {
      for (const [x, y] of [[4, 11], [12, 4], [13, 12], [5, 4]]) p.set(x, y, [255, 255, 255]);
    }),
    dash: iconRows([
      'C.....C......',
      'CC....CC.....',
      '.CC....CC....',
      '..CC....CC...',
      '...CW....CW..',
      '....CW....CW.',
      '...CW....CW..',
      '..CC....CC...',
      '.CC....CC....',
      'CC....CC.....',
      'C.....C......',
    ], { C: '#8ee6ff', W: '#ffffff' }),
    // Territoire : le symbole de l'infini
    domain: iconRows([
      '..WWWW....WWWW..',
      '.WWbbWW..WWbbWW.',
      'WWb..bWWWWb..bWW',
      'WW....bWWb....WW',
      'WWb..bWWWWb..bWW',
      '.WWbbWW..WWbbWW.',
      '..WWWW....WWWW..',
    ], { W: '#ffffff', b: '#9fd4ff' }),
    // Frappe : éclair du Black Flash
    melee: iconRows([
      '.......RRRR',
      '......RWWR.',
      '.....RWWR..',
      '....RWWR...',
      '...RWWRRRRR',
      '..RRRRRWWR.',
      '.....RWWR..',
      '....RWWR...',
      '...RWR.....',
      '..RWR......',
      '.RR........',
    ], { R: '#ff2a3a', W: '#ffe0e4' }),
  };
}

function buildGraphics() {
  buildIcons();
  const r = mulberry32(1337);
  buildGojo();
  Gfx.tops = [];
  Gfx.sideL = [];
  Gfx.sideR = [];
  for (let t = 0; t < TOP_PAL.length; t++) {
    const n = t === T_GRASS ? 12 : t === T_WATER || t === T_FLOWER ? 8 : 6;
    Gfx.tops[t] = [];
    for (let v = 0; v < n; v++) Gfx.tops[t].push(buildTop(t, r));
    Gfx.sideL[t] = [null];
    Gfx.sideR[t] = [null];
    for (let d = 1; d <= MAX_DROP; d++) {
      Gfx.sideL[t].push(buildSide(t, d, false, r));
      Gfx.sideR[t].push(buildSide(t, d, true, r));
    }
  }
  Gfx.fringe = [0, 1, 2, 3].map((d) => [0, 1, 2].map(() => buildFringe(d, r)));
  Gfx.dark = diamondCanvas([0, 0, 0]);
  Gfx.light = diamondCanvas([255, 255, 230]);
  Gfx.reticle = reticleCanvas();
  Gfx.fireGlow = glowCanvas(32, '255,130,40', 0.55);
  Gfx.lanternGlow = glowCanvas(18, '255,210,110', 0.7);
  Gfx.flames = [0, 1, 2].map(() => buildFlame(r));
  Gfx.oaks = [0, 1, 2, 3].map(() => buildOak(r));
  Gfx.sakuras = [0, 1, 2].map(() => buildOak(r, LEAF_SAKURA));
  Gfx.tufts = [0, 1, 2, 3].map(() => buildTuft(r));
  Gfx.reeds = [0, 1, 2].map(() => buildReed(r));
  Gfx.lilies = [0, 1, 2].map(() => buildLily(r));
  Gfx.pines = [0, 1, 2].map(() => buildPine(r));
  Gfx.bushes = [0, 1, 2].map(() => buildBush(r));
  Gfx.rocks = [0, 1, 2].map(() => buildRock(r));
  Gfx.torii = buildTorii();
  Gfx.lantern = buildLantern();
  Gfx.curses = {
    // même graine pour les deux images d'une animation : seule la pose change
    larva: [buildLarva(mulberry32(55), false), buildLarva(mulberry32(55), true)],
    eye: [buildEye(0), buildEye(1.6)],
    brute: [buildBrute(mulberry32(99), 0), buildBrute(mulberry32(99), 2)],
  };
}
