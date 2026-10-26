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

// Masque du losange TW x TH
const TOP_PAD = 4 * WS; // marge au-dessus d'une tuile pour les brins d'herbe qui dépassent
function inDiamond(x, y) {
  if (y < 0 || y > TH - 1) return false;
  const r = y < TH / 2 ? y : TH - 1 - y;
  const half = 2 * (r + 1);
  return x >= TW / 2 - half && x < TW / 2 + half;
}

function randomInDiamond(r, minY = 0) {
  let x, y;
  do {
    x = (r() * TW) | 0;
    y = minY + ((r() * (TH - minY)) | 0);
  } while (!inDiamond(x, y));
  return [x, y];
}

// Brins d'herbe : un trait fin, plus clair à la pointe, légèrement penché
function addBlades(p, r, count) {
  const light = toRgb(['#7cc04c', '#88c858']), dark = toRgb(['#4a8a2c', '#3f7a28']);
  for (let k = 0; k < count; k++) {
    const [x, y] = randomInDiamond(r, 2 * WS);
    const hgt = 2 + ((r() * 4) | 0), lean = r() < 0.5 ? -1 : 1;
    const c = r() < 0.5 ? pick(light, r) : pick(dark, r);
    for (let s = 0; s < hgt; s++) p.set(x + (s > hgt / 2 ? lean : 0), y + TOP_PAD - s, s === hgt - 1 ? light[1] : c);
  }
}

// Petites fleurs : quatre pétales autour d'un cœur, sur une tige
function addFlowers(p, r, count, cols) {
  const stem = hexToRgb('#3f7a28'), heart = hexToRgb('#ffe27a');
  for (let k = 0; k < count; k++) {
    const [x, y] = randomInDiamond(r, 3 * WS);
    const c = pick(cols, r), yy = y + TOP_PAD - 3;
    p.set(x, yy + 2, stem);
    p.set(x, yy + 3, stem);
    p.set(x - 1, yy, c);
    p.set(x + 1, yy, c);
    p.set(x, yy - 1, c);
    p.set(x, yy + 1, c);
    p.set(x, yy, heart);
  }
}

// Petits amas de pixels (jamais de bruit pixel par pixel) : lumière, ombre, grain
function addClusters(p, r, count, cols, size) {
  for (let k = 0; k < count; k++) {
    let [x, y] = randomInDiamond(r);
    const c = pick(cols, r), n = size[0] + ((r() * (size[1] - size[0] + 1)) | 0);
    for (let s = 0; s < n; s++) {
      if (inDiamond(x, y)) p.set(x, y + TOP_PAD, c);
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
  const p = new Pix(TW, TH + TOP_PAD);
  const base = TOP_PAL[t];
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      if (!inDiamond(x, y)) continue;
      // herbe, sable et eau : une teinte dominante, les nuances viennent en amas
      let c = t === T_GRASS || t === T_FLOWER || t === T_SAND || t === T_WATER ? base[0] : base[((x >> 1) * 7 + (y >> 1) * 13 + ((x * y) >> 4)) % base.length];
      if (t === T_STONE) {
        // pavés : joints selon les deux axes isométriques
        const u = (x * 0.5 + y) / WS + 40, v = (y - x * 0.5) / WS + 40;
        if (u % 5 < 0.6 || v % 5 < 0.6) c = hexToRgb('#5d5d66');
        else if (u % 5 < 1.2 || v % 5 < 1.2) c = mul(c, 1.08);
      }
      // arête éclairée en haut à gauche, ombrée en bas à droite
      if (!inDiamond(x, y - 1) && x < TW / 2) c = mul(c, 1.1);
      else if (!inDiamond(x, y + 1) && x >= TW / 2) c = mul(c, 0.9);
      p.set(x, y + TOP_PAD, c);
    }
  }
  if (t === T_GRASS) {
    addClusters(p, r, 8, GRASS_LIGHT, [5, 12]);
    addClusters(p, r, 7, GRASS_DARK, [3, 9]);
    addBlades(p, r, 10 + ((r() * 14) | 0));
    if (r() < 0.4) addFlowers(p, r, 1 + ((r() * 3) | 0), [pick(FLOWER_COLS, r)]);
  } else if (t === T_FLOWER) {
    addClusters(p, r, 8, GRASS_LIGHT, [5, 10]);
    addClusters(p, r, 5, GRASS_DARK, [3, 7]);
    addBlades(p, r, 12 + ((r() * 10) | 0));
    addFlowers(p, r, 7 + ((r() * 7) | 0), FLOWER_COLS);
  } else if (t === T_DIRT) {
    addClusters(p, r, 6, toRgb(['#a08060', '#7a5230']), [2, 5]);
    addClusters(p, r, 3, toRgb(['#4f3420']), [1, 3]);
  } else if (t === T_BURNT) {
    addClusters(p, r, 8, toRgb(['#6a5a50', '#2a201c']), [2, 6]);
    addClusters(p, r, 3, toRgb(['#d0602a']), [1, 2]);
  } else if (t === T_VOID) {
    // veines d'énergie violette
    const vein = toRgb(['#5a2ca0', '#7d3fd0', '#b37cff']);
    for (let v = 0; v < 2; v++) {
      let [x, y] = randomInDiamond(r);
      const len = 8 + ((r() * 14) | 0);
      for (let k = 0; k < len; k++) {
        if (inDiamond(x, y)) p.set(x, y + TOP_PAD, vein[k === len - 1 ? 2 : (r() * 2) | 0]);
        if (r() < 0.5) x += r() < 0.5 ? -1 : 1;
        else y += r() < 0.5 ? -1 : 1;
      }
    }
  } else if (t === T_WATER) {
    addClusters(p, r, 5, [TOP_PAL[T_WATER][2]], [8, 16]);
    // petites vagues en tirets
    const hl = toRgb(['#3c62a8', '#5a82c8']);
    const n = 8 + ((r() * 5) | 0);
    for (let k = 0; k < n; k++) {
      const [x, y] = randomInDiamond(r, 2);
      const len = 3 + ((r() * 5) | 0), c = r() < 0.3 ? hl[1] : hl[0];
      for (let s = 0; s < len; s++) if (inDiamond(x + s, y)) p.set(x + s, y + TOP_PAD, c);
    }
    // un reflet blanc de temps en temps
    if (r() < 0.5) {
      const [x, y] = randomInDiamond(r, 4);
      for (let s = 0; s < 3; s++) if (inDiamond(x + s, y)) p.set(x + s, y + TOP_PAD, hexToRgb('#a9c6ee'));
    }
  } else if (t === T_SAND) {
    // grain du sable en petits amas, plus clair au soleil
    addClusters(p, r, 14, SAND_GRAIN, [1, 4]);
    addClusters(p, r, 7, SAND_LIGHT, [3, 7]);
  }
  return p.canvas();
}

// Lisière d'herbe qui déborde sur une tuile de sable voisine, pour que la
// limite herbe/sable soit irrégulière plutôt qu'une diagonale parfaite.
// dir : 0 = bord haut-gauche (i-1), 1 = haut-droit (j-1), 2 = bas-droit (i+1), 3 = bas-gauche (j+1)
function buildFringe(dir, r) {
  const p = new Pix(TW, TH + TOP_PAD);
  const ph1 = r() * 6, ph2 = r() * 6, base = TOP_PAL[T_GRASS][0];
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      if (!inDiamond(x, y)) continue;
      const u = (x + 0.5 - TW / 2) / (TW / 2), v = (y + 0.5 - TH / 2) / (TH / 2);
      const d = [1 + u + v, 1 - u + v, 1 - u - v, 1 + u - v][dir] * (TH / 2);
      const w = WS * Math.max(0.6, 2.4 + 1.4 * Math.sin((x / WS) * 0.7 + ph1) + 0.8 * Math.sin((x / WS) * 1.9 + ph2));
      if (d < w) p.set(x, y + TOP_PAD, r() < 0.12 ? GRASS_LIGHT[0] : base);
      else if (d < w + 1) p.set(x, y + TOP_PAD, GRASS_DARK[0]);
    }
  }
  return p.canvas();
}

// Face latérale (gauche ou droite) d'une colonne de `drop` unités de haut
function buildSide(t, drop, right, r) {
  const hp = drop * HS;
  const p = new Pix(TW, TH + 1 + hp);
  const S = SIDE_PAL[t];
  const face = right ? 0.68 : 0.88;
  for (let xx = 0; xx < TW / 2; xx++) {
    const x = right ? TW - 1 - xx : xx;
    const y0 = TH + 1 - Math.ceil((TW / 2 - xx) / 2);
    for (let d = 0; d < hp; d++) {
      // terre en mottes (amas de 3 px) plutôt qu'en bruit
      let c = d < 2 * WS ? S.lip[(d / WS) | 0] : S.body[(((x / 3) | 0) * 7 + ((d / 3) | 0) * 13 + (((x >> 2) * (d >> 2)) | 0)) % S.body.length];
      if (d >= 2 * WS && r() < 0.012) c = S.stone;
      if (d % HS === HS - 1) c = mul(c, 0.82);
      p.set(x, y0 + d, mul(c, face * (1 - Math.min(0.3, d * 0.002))));
    }
  }
  return p.canvas();
}

function diamondCanvas(c) {
  const p = new Pix(TW, TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (inDiamond(x, y)) p.set(x, y, c);
  return p.canvas();
}

function reticleCanvas() {
  const p = new Pix(TW, TH), c = [255, 255, 255];
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
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
  const W = 8 * WS, H = 12 * WS, p = new Pix(W, H);
  const cols = toRgb(['#ff3a10', '#ff7a20', '#ffb040', '#ffe08a']);
  for (let y = 0; y < H; y++) {
    const hw = 3.6 * WS * Math.sin(((y + 1) / H) * Math.PI * 0.8) + (r() - 0.5) * 0.8 * WS;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - (W - 1) / 2);
      if (dx > hw) continue;
      const inner = 1 - dx / Math.max(hw, 0.5);
      p.set(x, y, cols[clamp(Math.floor((y / (H - 1)) * 2 + inner * 2 - 0.3), 0, 3)]);
    }
  }
  return p.canvas();
}

// --- Végétation, rochers, sanctuaires -----------------------------------------
const LEAF_OAK = toRgb(['#1c4424', '#2a6630', '#3a8238', '#52a044', '#78c058']);
const LEAF_SAKURA = toRgb(['#9a3e66', '#c85a88', '#e47ea6', '#f4a8c4', '#ffd4e4']);
const LEAF_PINE = toRgb(['#163a26', '#22573a', '#2f7246', '#4a9058']);
const BARK = toRgb(['#4e321e', '#74492a', '#94633a']);

// Feuillage en masses arrondies : ombre en bas à droite, lumière en haut à gauche
function shadeBlobs(p, blobs, pal, r, x0, x1, y0, y1, thresholds, noise = 0.22) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let best = 0, bl = null;
      for (const b of blobs) {
        const dx = x - b.x, dy = y - b.y;
        const q = 1 - (dx * dx + dy * dy) / (b.r * b.r);
        if (q > best) { best = q; bl = b; }
      }
      if (!bl || best < r() * 0.08) continue;
      const dx = (x - bl.x) / bl.r, dy = (y - bl.y) / bl.r;
      // le bruit varie par amas de 2 px pour former des grappes de feuilles
      const grain = (((x >> 1) * 73856093) ^ ((y >> 1) * 19349663)) % 100 / 100;
      const l = -dx * 0.45 - dy * 0.65 + best * 0.35 + (grain - 0.5) * noise * 1.6 + (r() - 0.5) * noise * 0.4 - (y - bl.y > 3 * WS ? 0.15 : 0);
      let idx = 0;
      while (idx < thresholds.length && l >= thresholds[idx]) idx++;
      p.set(x, y, pal[idx]);
    }
  }
}

function buildOak(r, leaves = LEAF_OAK) {
  const W = 38 * WS, H = 52 * WS, cx = W / 2, p = new Pix(W, H);
  const top = 30 * WS;
  // tronc avec écorce striée et racines évasées
  for (let y = top; y < H - 2 * WS; y++) {
    const flare = y > H - 8 * WS ? Math.round((y - (H - 8 * WS)) * 0.6) : 0;
    const xa = cx - 2 * WS - flare, xb = cx + 2 * WS - 1 + flare;
    for (let x = xa; x <= xb; x++) {
      let c = x <= xa + 1 ? BARK[2] : x >= xb - 1 ? BARK[0] : BARK[1];
      if ((x + ((y / 5) | 0)) % 4 === 0 && x > xa + 1 && x < xb - 1) c = BARK[0]; // stries
      p.set(x, y, c);
    }
  }
  // branches qui partent dans le feuillage
  for (let t = 0; t < 6 * WS; t++) {
    p.set(cx - 2 * WS - t, top + 1 - t, BARK[1]);
    p.set(cx - 2 * WS - t, top + 2 - t, BARK[2]);
    p.set(cx + 2 * WS + t, top + 2 - t, BARK[0]);
    p.set(cx + 2 * WS + t, top + 3 - t, BARK[0]);
  }
  const blobs = [{ x: cx, y: 18 * WS, r: 10 * WS }];
  const n = 6 + ((r() * 4) | 0);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = (3 + r() * 4) * WS;
    blobs.push({ x: cx + Math.cos(a) * d * 1.25, y: 18 * WS + Math.sin(a) * d * 0.85, r: (5 + r() * 4) * WS });
  }
  shadeBlobs(p, blobs, leaves, r, 0, W, 0, 36 * WS, [-0.35, 0, 0.3, 0.55]);
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: H - 3 * WS };
}

// Touffe de hautes herbes sombres
function buildTuft(r) {
  const W = 14 * WS, H = 12 * WS, p = new Pix(W, H);
  const pal = toRgb(['#24501e', '#336a26', '#457f2e', '#5a9a38']);
  const n = 12 + ((r() * 8) | 0);
  for (let k = 0; k < n; k++) {
    const x0 = 3 * WS + ((r() * 8 * WS) | 0), hgt = (5 + ((r() * 5) | 0)) * WS, lean = (x0 - W / 2) * 0.12;
    for (let s = 0; s < hgt; s++) p.set(Math.round(x0 + lean * (s / WS)), H - 2 * WS - s, pal[s > hgt - 3 ? 3 : s > hgt / 2 ? 2 : (r() * 2) | 0]);
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: W / 2, ay: H - 2 * WS };
}

// Roseaux (massettes) au bord de l'eau
function buildReed(r) {
  const W = 18 * WS, H = 26 * WS, p = new Pix(W, H);
  const stem = toRgb(['#3a5e22', '#55782c', '#6e8a34']), head = toRgb(['#5a3a1e', '#7a5028', '#946436']);
  const n = 5 + ((r() * 3) | 0), base = H - 2 * WS;
  for (let k = 0; k < n; k++) {
    const x = 3 * WS + ((r() * 12 * WS) | 0), hgt = (14 + ((r() * 9) | 0)) * WS;
    for (let s = 0; s < hgt; s++) {
      p.set(x, base - s, stem[s > hgt * 0.7 ? 2 : 1]);
      if (s < hgt / 2) p.set(x + 1, base - s, stem[0]);
    }
    // massette brune, éclairée à gauche
    if (r() < 0.75) {
      fillRect(p, x - 1, base - hgt - 1, x + 2, base - hgt + 4 * WS, head[1]);
      fillRect(p, x - 1, base - hgt - 1, x - 1, base - hgt + 4 * WS, head[2]);
      fillRect(p, x + 2, base - hgt, x + 2, base - hgt + 4 * WS, head[0]);
      p.set(x, base - hgt - 3, stem[2]);
      p.set(x, base - hgt - 2, stem[2]);
    }
  }
  // une ou deux feuilles courbées
  for (let k = 0; k < 2; k++) {
    const x = 4 * WS + ((r() * 10 * WS) | 0), dir = r() < 0.5 ? -1 : 1;
    for (let s = 0; s < 8 * WS; s++) p.set(x + Math.round(dir * (s * s) / (12 * WS)), base - s, stem[s > 5 * WS ? 2 : 1]);
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: W / 2, ay: base };
}

// Nénuphar posé sur l'eau
function buildLily(r) {
  const W = 12 * WS, H = 7 * WS, p = new Pix(W, H);
  const [d, m, l] = toRgb(['#2f7a3a', '#4aa04a', '#6cc060']);
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W / 2), dy = (y - cy) / (H / 2);
      if (dx * dx + dy * dy > 1 || (x >= cx && Math.abs(y - cy) < 0.6)) continue;
      p.set(x, y, dy < -0.3 ? l : dy > 0.4 ? d : m);
    }
  }
  // nervures
  for (let k = 1; k < 4 * WS; k++) p.set(cx - k, cy - k * 0.4, d);
  if (r() < 0.5) {
    const fc = toRgb(r() < 0.5 ? ['#ffd4e4', '#f4a8c4'] : ['#fff6e0', '#e8dcc0']);
    fillRect(p, 3 * WS, 1 * WS, 3 * WS + 3, 1 * WS + 2, fc[0]);
    p.set(3 * WS + 1, 1 * WS - 1, fc[0]);
    p.set(3 * WS + 3, 1 * WS + 2, fc[1]);
    p.set(3 * WS + 1, 1 * WS + 1, hexToRgb('#ffe27a'));
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: W / 2, ay: H / 2 + 1 };
}

function buildPine(r) {
  const W = 30 * WS, H = 54 * WS, cx = W / 2, p = new Pix(W, H);
  for (let y = 38 * WS; y < H - 2 * WS; y++) {
    for (let x = cx - WS; x <= cx + WS; x++) p.set(x, y, x <= cx - WS + 1 ? BARK[2] : x >= cx + WS - 1 ? BARK[0] : BARK[1]);
  }
  for (let L = 0; L < 4; L++) {
    const top = (2 + L * 9) * WS, hgt = 15 * WS, maxW = (5 + L * 2.6) * WS;
    for (let y = top; y < top + hgt; y++) {
      const t = (y - top) / hgt;
      // bord dentelé : des pointes d'aiguilles tous les quelques pixels
      const hw = Math.max(1, t * maxW + (((y >> 1) % 3 === 0) ? WS : 0));
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const dx = (x - cx) / (maxW + 1);
        const grain = (((x >> 1) * 7 + (y >> 1) * 13) % 10) / 10;
        const l = -dx * 0.8 + (1 - t) * 0.3 - (t > 0.8 ? 0.4 : 0) + (grain - 0.5) * 0.35;
        const idx = l < -0.35 ? 0 : l < 0.05 ? 1 : l < 0.35 ? 2 : 3;
        p.set(x, y, LEAF_PINE[idx]);
      }
    }
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: H - 3 * WS };
}

function buildBush(r) {
  const W = 20 * WS, H = 14 * WS, p = new Pix(W, H);
  const blobs = [{ x: 10 * WS, y: 8 * WS, r: 5 * WS }];
  for (let k = 0; k < 4; k++) blobs.push({ x: (10 + (r() - 0.5) * 8) * WS, y: (8 + (r() - 0.5) * 3) * WS, r: (3 + r() * 2) * WS });
  shadeBlobs(p, blobs, LEAF_OAK, r, 0, W, 0, 13 * WS, [-0.35, 0, 0.3, 0.55]);
  if (r() < 0.6) {
    const fc = pick(toRgb(['#e98bb5', '#f4f1e0', '#f2d544']), r);
    for (let k = 0; k < 7; k++) {
      const x = 5 * WS + ((r() * 10 * WS) | 0), y = 4 * WS + ((r() * 6 * WS) | 0);
      if (p.has(x, y) && p.has(x + 1, y + 1)) {
        p.set(x, y, fc);
        p.set(x + 1, y, fc);
        p.set(x, y + 1, fc);
        p.set(x + 1, y + 1, mul(fc, 0.8));
      }
    }
  }
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: W / 2, ay: 12 * WS };
}

function buildRock(r) {
  const W = 20 * WS, H = 15 * WS, p = new Pix(W, H);
  const pal = toRgb(['#4a4a52', '#66666e', '#86868e', '#a6a6ac', '#c8c8cc']);
  const rx = (7 + r() * 2) * WS, ry = (5 + r() * 1.5) * WS, cx = W / 2, cy = 13 * WS - ry;
  // contour irrégulier : quelques bosses le long du bord
  const bumps = [0, 1, 2, 3, 4].map(() => [r() * Math.PI * 2, 0.1 + r() * 0.15]);
  for (let y = 0; y <= 13 * WS; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx);
      let lim = 1;
      for (const [ba, bs] of bumps) lim -= bs * Math.max(0, Math.cos(a - ba)) ** 6;
      if (dx * dx + dy * dy > lim) continue;
      // facettes : la lumière change par paliers selon l'orientation
      const l = -dx * 0.5 - dy * 0.7 + ((((x >> 2) * 7 + (y >> 2) * 3) % 5) - 2) * 0.06;
      const idx = l < -0.4 ? 0 : l < -0.05 ? 1 : l < 0.3 ? 2 : l < 0.6 ? 3 : 4;
      p.set(x, y, pal[idx]);
    }
  }
  // fissure et mousse
  let fx = cx + ((r() - 0.5) * rx) | 0, fy = cy | 0;
  for (let s = 0; s < 4 * WS; s++) {
    if (p.has(fx, fy)) p.set(fx, fy, pal[0]);
    fx += r() < 0.5 ? 1 : 0;
    fy += 1;
  }
  if (r() < 0.6) for (let x = cx - rx * 0.5; x < cx + rx * 0.2; x++) if (p.has(x | 0, (cy - ry * 0.7) | 0)) p.set(x, cy - ry * 0.7, hexToRgb('#5a8a3a'));
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: 13 * WS };
}

function fillRect(p, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.set(x, y, c);
}

// Rectangle en coordonnées d'origine, agrandi à l'échelle du monde
const fillW = (p, x0, y0, x1, y1, c) => fillRect(p, x0 * WS, y0 * WS, x1 * WS + WS - 1, y1 * WS + WS - 1, c);

function buildTorii() {
  const W = 46 * WS, H = 48 * WS, p = new Pix(W, H);
  const [red, dark, light] = toRgb(['#c8322a', '#8f1f1a', '#e05a48']);
  const black = hexToRgb('#1c1416'), blackHi = hexToRgb('#3a2c2e');
  for (const px of [9, 33]) {
    fillW(p, px, 10, px + 3, 45, red);
    fillRect(p, px * WS, 10 * WS, px * WS + 1, 46 * WS, light);
    fillRect(p, (px + 4) * WS - 2, 10 * WS, (px + 4) * WS - 1, 46 * WS, dark);
    fillW(p, px - 1, 43, px + 4, 45, black);
    fillRect(p, (px - 1) * WS, 43 * WS, (px + 5) * WS - 1, 43 * WS, blackHi);
  }
  fillW(p, 2, 4, 43, 7, black);           // kasagi
  fillRect(p, 2 * WS, 4 * WS, 44 * WS - 1, 4 * WS + 1, blackHi);
  fillW(p, 0, 2, 2, 5, black);
  fillW(p, 43, 2, 45, 5, black);
  fillW(p, 4, 8, 41, 9, red);             // shimaki
  fillRect(p, 4 * WS, 8 * WS, 42 * WS - 1, 8 * WS, light);
  fillW(p, 5, 16, 40, 18, red);           // nuki
  fillRect(p, 5 * WS, 16 * WS, 41 * WS - 1, 16 * WS + 1, light);
  fillRect(p, 5 * WS, 19 * WS - 2, 41 * WS - 1, 19 * WS - 1, dark);
  fillW(p, 21, 9, 24, 15, black);         // plaque
  fillW(p, 22, 11, 23, 13, hexToRgb('#d9b45a'));
  fillRect(p, 22 * WS + 1, 11 * WS + 1, 24 * WS - 2, 14 * WS - 2, hexToRgb('#a8842e'));
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: 23 * WS, ay: 45 * WS };
}

function buildLantern() {
  const W = 14 * WS, H = 26 * WS, p = new Pix(W, H);
  const [d, m, l] = toRgb(['#5d606c', '#8d93a3', '#b4b9c6']);
  const glow = toRgb(['#ffd36a', '#fff0b0']);
  fillW(p, 3, 21, 10, 23, m);
  fillW(p, 3, 23, 10, 23, d);
  fillRect(p, 3 * WS, 21 * WS, 3 * WS + 1, 24 * WS - 1, l);
  fillW(p, 5, 14, 8, 20, m);
  fillRect(p, 5 * WS, 14 * WS, 5 * WS + 1, 21 * WS - 1, l);
  fillRect(p, 9 * WS - 2, 14 * WS, 9 * WS - 1, 21 * WS - 1, d);
  fillW(p, 3, 9, 10, 13, m);
  fillW(p, 5, 10, 8, 12, glow[0]);
  fillRect(p, 5 * WS + 2, 10 * WS + 2, 7 * WS, 12 * WS, glow[1]);
  fillW(p, 1, 6, 12, 8, d);
  fillRect(p, 1 * WS, 6 * WS, 13 * WS - 1, 6 * WS + 1, m);
  fillW(p, 3, 5, 10, 5, d);
  fillW(p, 6, 3, 7, 4, d);
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: W / 2, ay: 23 * WS };
}

// --- Fléaux ------------------------------------------------------------------
function curseArt(p, ax, ay) {
  p.outline(OUTLINE);
  const c = p.canvas();
  return { c, w: tintOf(c, '#ffffff'), ax, ay };
}

// Œil de fléau : blanc jaunâtre, pupille fendue, reflet
function eyeDot(p, x, y) {
  const white = [240, 236, 228], shade = [196, 184, 170], pupil = [20, 10, 14];
  fillRect(p, x, y, x + 2, y + 2, white);
  fillRect(p, x, y + 2, x + 2, y + 2, shade);
  fillRect(p, x + 1, y, x + 1, y + 2, pupil);
  p.set(x + 2, y, [255, 255, 255]);
}

function buildLarva(r, squash) {
  const W = 20 * WS, H = 17 * WS, p = new Pix(W, H);
  const pal = toRgb(['#2e2040', '#4a3466', '#6a4c8e', '#8f6cb8', '#b090d8']);
  const rx = (squash ? 8 : 7) * WS, ry = (squash ? 4.5 : 5.5) * WS, cx = W / 2, cy = 14 * WS - ry;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      // anneaux du corps de larve
      const ring = Math.abs(Math.sin((x / WS) * 0.9)) < 0.25 ? -0.2 : 0;
      const l = -dx * 0.4 - dy * 0.7 + ring;
      p.set(x, y, pal[l < -0.35 ? 0 : l < 0 ? 1 : l < 0.35 ? 2 : l < 0.6 ? 3 : 4]);
    }
  }
  for (const fx of [5, 9, 13]) fillW(p, fx, 14, fx + 1, 15, pal[0]);
  // gueule pleine de dents
  const my = Math.round(cy + ry * 0.35);
  for (let x = cx - 4 * WS; x <= cx + 4 * WS; x++) {
    p.set(x, my, [150, 20, 40]);
    p.set(x, my + 1, [100, 10, 30]);
    if (x % 3 === 0) p.set(x, my - 1, [236, 228, 210]);
    if (x % 3 === 1) p.set(x, my + 2, [236, 228, 210]);
  }
  eyeDot(p, cx - 4 * WS, Math.round(cy - 2 * WS));
  eyeDot(p, cx + 1 * WS, Math.round(cy - 3 * WS));
  eyeDot(p, cx + 4 * WS, Math.round(cy));
  return curseArt(p, cx, 15 * WS);
}

function buildEye(phase) {
  const W = 24 * WS, H = 30 * WS, p = new Pix(W, H), cx = 12 * WS, cy = 9 * WS, R = 8 * WS;
  const tent = toRgb(['#2a1830', '#3e2448', '#563260']);
  for (let t = 0; t < 4; t++) {
    const bx = cx - 5 * WS + t * 3 * WS;
    for (let y = 15 * WS; y < 28 * WS; y++) {
      const x = bx + Math.sin((y / WS) * 0.55 + phase + t * 1.3) * 1.5 * WS;
      const w = Math.max(1, Math.round((28 * WS - y) / (5 * WS)));
      for (let k = 0; k < w + 1; k++) p.set(x + k, y, k === 0 ? tent[2] : k === w ? tent[0] : tent[1]);
    }
  }
  const scl = toRgb(['#9a8a86', '#c8bab2', '#e8e0d8', '#fffaf4']);
  for (let y = 0; y < 18 * WS; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R) continue;
      const l = (-(x - cx) / R) * 0.4 - ((y - cy) / R) * 0.6 + (1 - d / R) * 0.3;
      p.set(x, y, scl[l < -0.3 ? 0 : l < 0.05 ? 1 : l < 0.4 ? 2 : 3]);
    }
  }
  // veines rouges qui serpentent vers l'iris
  const vr = mulberry32(77 + phase * 10);
  for (let v = 0; v < 7; v++) {
    const a = vr() * Math.PI * 2;
    let x = cx + Math.cos(a) * (R - 1), y = cy + Math.sin(a) * (R - 1);
    for (let s = 0; s < 4 * WS; s++) {
      p.set(x, y, [192, 80, 106]);
      x += (cx - x) * 0.12 + (vr() - 0.5) * 1.5;
      y += (cy - y) * 0.12 + (vr() - 0.5) * 1.5;
    }
  }
  for (let y = -4 * WS; y <= 4 * WS; y++) {
    for (let x = -4 * WS; x <= 4 * WS; x++) {
      const d = Math.hypot(x, y) / WS;
      if (d <= 3.6) p.set(cx + WS + x, cy + WS + y, d > 3 ? [80, 8, 20] : d > 2.4 ? [122, 16, 32] : d > 1.4 ? [200, 32, 58] : [10, 6, 8]);
    }
  }
  fillRect(p, cx - WS, cy - WS, cx, cy, [255, 255, 255]);
  return curseArt(p, cx, H - 3 * WS);
}

function buildBrute(r, phase) {
  const W = 40 * WS, H = 46 * WS, p = new Pix(W, H);
  const pal = toRgb(['#17171a', '#2a2a26', '#3e3d35', '#55533f', '#6b6a50']);
  const b = (x, y, rr) => ({ x: x * WS, y: y * WS, r: rr * WS });
  const blobs = [
    b(20, 24, 13), b(20, 12, 8), b(20, 31, 10),
    b(6, 27 + phase, 5), b(6, 35 + phase, 4.5),
    b(34, 27 - phase, 5), b(34, 35 - phase, 4.5),
    b(14, 40, 4.5), b(26, 40, 4.5),
  ];
  shadeBlobs(p, blobs, pal, r, 0, W, 0, H - 2 * WS, [-0.4, -0.1, 0.25, 0.5]);
  // gueule et dents
  fillW(p, 13, 25, 27, 28, hexToRgb('#3a0a10'));
  fillRect(p, 13 * WS, 27 * WS, 28 * WS - 1, 28 * WS, hexToRgb('#5a1018'));
  for (let x = 13 * WS; x < 28 * WS; x += 3) {
    fillRect(p, x, 25 * WS, x + 1, 25 * WS + 2, [232, 224, 200]);
    fillRect(p, x + 1, 29 * WS - 3, x + 2, 29 * WS - 1, [232, 224, 200]);
  }
  for (const [ex, ey] of [[16, 9], [23, 10], [19, 13], [13, 15], [27, 16]]) {
    fillRect(p, ex * WS, ey * WS, ex * WS + 3, ey * WS + 2, [242, 213, 68]);
    fillRect(p, ex * WS + 2, ey * WS, ex * WS + 2, ey * WS + 2, [20, 20, 10]);
    p.set(ex * WS, ey * WS, [255, 248, 200]);
  }
  return curseArt(p, W / 2, H - 4 * WS);
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
  Gfx.fireGlow = glowCanvas(32 * WS, '255,130,40', 0.55);
  Gfx.lanternGlow = glowCanvas(18 * WS, '255,210,110', 0.7);
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
