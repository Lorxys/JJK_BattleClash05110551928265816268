'use strict';

// ---------------------------------------------------------------------------
// Tout le pixel art est généré ici au démarrage (aucune image externe)
// ---------------------------------------------------------------------------
const Gfx = {};
const OUTLINE = hexToRgb('#0b0b14');
const toRgb = (list) => list.map(hexToRgb);

// --- Satoru Gojo -----------------------------------------------------------
const GOJO_PAL = {
  W: '#f4f6fb', w: '#c3cbe0', K: '#15151d', k: '#3a3a52',
  S: '#f3cba9', s: '#d79f7e', N: '#232a48', n: '#151a30',
  M: '#3a4370', G: '#d9b45a', O: '#0e0e14',
};

const GOJO_FRONT = [
  '......W..W......',
  '...W.WWWWWW.W...',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWWWWWWW.',
  '..WWwWWWWWWwWW..',
  '.WWwWWWWWWWWwWW.',
  '..WKKKKKKKKKKW..',
  '..WKkKKKKKKkKW..',
  '..wSSSSSSSSSSw..',
  '...SSSSSSSSSS...',
  '...sSSSSSSSSs...',
  '....sSSssSSs....',
  '.....sSSSSs.....',
  '....nNNGGNNn....',
  '..nNNNNnnNNNNn..',
  '.nNNNNNnnNNNNNn.',
  '.NNMNNNnnNNNMNN.',
  '.NNMNNNnnNNNMNN.',
  '.NNnNNNnnNNNnNN.',
  '.NNnNNNnnNNNnNN.',
  '.SS.NNNnnNNN.SS.',
  '.ss.NNNNNNNN.ss.',
];

const GOJO_BACK = [
  '......W..W......',
  '...W.WWWWWW.W...',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWWWWWWW.',
  '..WWWWWWWWWWWW..',
  '.WWWWwWWWWwWWWW.',
  '..WKKKKKKKKKKW..',
  '..WwWWKKKKWWwW..',
  '..wWWWWKKWWWWw..',
  '...wWWKKKKWWw...',
  '...wwWKwwKWww...',
  '....swwwwwws....',
  '.....sSSSSs.....',
  '....nNNNNNNn....',
  '..nNNNNNNNNNNn..',
  '.nNNNNNNNNNNNNn.',
  '.NNMNNNNNNNNMNN.',
  '.NNMNNNNNNNNMNN.',
  '.NNnNNNNNNNNnNN.',
  '.NNnNNNNNNNNnNN.',
  '.SS.NNNNNNNN.SS.',
  '.ss.NNNNNNNN.ss.',
];

const GOJO_SIDE = [
  '.....W..W.......',
  '...W.WWWWW.W....',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWWWWWW..',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWwWWWW..',
  '..WWWKKKKKKKKK..',
  '..KKWKKKKKKKkK..',
  '...KwWWSSSSSSS..',
  '...K.wWSSSSSSSS.',
  '......wSSSSSSs..',
  '......sSSSSs....',
  '.......sSSs.....',
  '......nNNGn.....',
  '.....nNNNNNn....',
  '.....NNNNNNNn...',
  '.....NNMNNNNN...',
  '.....NNMNNNNN...',
  '.....NNMNNNNN...',
  '.....NNnNNNNN...',
  '.....NSSNNNNN...',
  '.....NssNNNNN...',
];

const LEGS_FRONT = {
  stand: ['....NNNNNNNN....', '....NNNn.NNN....', '....NNN..NNN....', '....nNN..NNn....', '....OOO..OOO....'],
  a: ['....NNNNNNNN....', '....NNNn.NNN....', '....NNN..NNN....', '....OOO..NNn....', '.........OOO....'],
  b: ['....NNNNNNNN....', '....NNNn.NNN....', '....NNN..NNN....', '....nNN..OOO....', '....OOO.........'],
};

const LEGS_SIDE = {
  stand: ['......NNNNN.....', '......NNNNN.....', '......NNNNN.....', '......nNNNn.....', '......OOOOOO....'],
  a: ['......NNNNN.....', '.....NNN.NNN....', '....NNN...NNN...', '....nN.....Nn...', '...OOO.....OOO..'],
  b: ['......NNNNN.....', '......NNNNN.....', '.....NNN.NN.....', '.....nN..Nn.....', '....OOO..OOO....'],
};

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

function buildGojo() {
  const pal = {};
  for (const k in GOJO_PAL) pal[k] = hexToRgb(GOJO_PAL[k]);
  const mk = (top, legs) => spriteFromRows(top.concat(legs), pal);
  const F = GOJO_FRONT, B = GOJO_BACK, S = GOJO_SIDE, LF = LEGS_FRONT, LS = LEGS_SIDE;
  // [repos, marche 1..4]
  Gfx.gojo = {
    down: [mk(F, LF.stand), mk(F, LF.a), mk(F, LF.stand), mk(F, LF.b), mk(F, LF.stand)],
    up: [mk(B, LF.stand), mk(B, LF.a), mk(B, LF.stand), mk(B, LF.b), mk(B, LF.stand)],
    right: [mk(S, LS.stand), mk(S, LS.a), mk(S, LS.b), mk(S, LS.a), mk(S, LS.b)],
  };
  Gfx.gojo.left = Gfx.gojo.right.map(flipH);
}

// --- Tuiles ----------------------------------------------------------------
const TOP_PAL = [
  toRgb(['#3d7534', '#468439', '#4f913d', '#4a8a3a', '#55963f']),
  toRgb(['#6e4b2f', '#7a5535', '#86603c', '#704d30']),
  toRgb(['#2f2622', '#3a2f29', '#453830', '#2a221e']),
  toRgb(['#191223', '#1f162b', '#251a33', '#1c1428']),
];

const SIDE_PAL = [
  { lip: toRgb(['#3d7534', '#2e6229']), body: toRgb(['#6b4a2f', '#5f4129', '#74513a', '#5a3d27']), stone: hexToRgb('#8a7a6a') },
  { lip: toRgb(['#7a5535', '#6e4b2f']), body: toRgb(['#6b4a2f', '#5f4129', '#74513a', '#5a3d27']), stone: hexToRgb('#8a7a6a') },
  { lip: toRgb(['#2a221e', '#1e1815']), body: toRgb(['#3d302a', '#352a25', '#46372f', '#30261f']), stone: hexToRgb('#5a4a40') },
  { lip: toRgb(['#3a2358', '#2b1a42']), body: toRgb(['#171020', '#1c1427', '#140d1c', '#21172e']), stone: hexToRgb('#6a35b8') },
];

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

function buildTop(t, r) {
  // 4 px de marge en haut pour les brins d'herbe qui dépassent
  const p = new Pix(32, 20);
  const base = TOP_PAL[t];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inDiamond(x, y)) continue;
      let c = base[(r() * base.length) | 0];
      if (!inDiamond(x, y - 1) && x < 16) c = mul(c, 1.1);
      else if (!inDiamond(x, y + 1) && x >= 16) c = mul(c, 0.9);
      p.set(x, y + 4, c);
    }
  }
  if (t === T_GRASS) {
    const light = toRgb(['#6db84c', '#82c95a']), dark = hexToRgb('#2e6229');
    const blades = 8 + ((r() * 9) | 0);
    for (let k = 0; k < blades; k++) {
      const [x, y] = randomInDiamond(r, 2);
      const hgt = 2 + ((r() * 2) | 0);
      const c = r() < 0.65 ? pick(light, r) : dark;
      for (let s = 0; s < hgt; s++) p.set(x + (s === hgt - 1 && r() < 0.4 ? 1 : 0), y + 4 - s, c);
    }
    if (r() < 0.4) {
      const fc = pick(toRgb(['#f4f1e0', '#f2d544', '#e98bb5', '#8fb7f2']), r);
      const n = 1 + ((r() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const [x, y] = randomInDiamond(r, 3);
        p.set(x, y + 3, fc);
        p.set(x, y + 4, hexToRgb('#2e6229'));
      }
    }
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

// --- Végétation et rochers ---------------------------------------------------
const LEAF_OAK = toRgb(['#1d4a2a', '#2a6334', '#387d3b', '#4f9a43', '#78bd52']);
const LEAF_PINE = toRgb(['#143628', '#1f5040', '#2c6a4f', '#468a5d']);
const BARK = toRgb(['#4a3220', '#6b4a2f', '#86603c']);

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

function buildOak(r) {
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
  shadeBlobs(p, blobs, LEAF_OAK, r, 0, W, 0, 36, [-0.35, 0, 0.3, 0.55]);
  p.outline(OUTLINE);
  return { c: p.canvas(), ax: cx, ay: H - 3 };
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
  shadeBlobs(p, blobs, toRgb(['#1f4d2b', '#2d6b35', '#3f8a3c', '#5fa848', '#86c95e']), r, 0, W, 0, 13, [-0.35, 0, 0.3, 0.55]);
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
  const pal = toRgb(['#3e414d', '#585c6b', '#767b8b', '#9aa0b0', '#c0c5d2']);
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

function buildGraphics() {
  const r = mulberry32(1337);
  buildGojo();
  Gfx.tops = [];
  Gfx.sideL = [];
  Gfx.sideR = [];
  for (const t of [T_GRASS, T_DIRT, T_BURNT, T_VOID]) {
    const n = t === T_GRASS ? 12 : 6;
    Gfx.tops[t] = [];
    for (let v = 0; v < n; v++) Gfx.tops[t].push(buildTop(t, r));
    Gfx.sideL[t] = [null];
    Gfx.sideR[t] = [null];
    for (let d = 1; d <= MAX_DROP; d++) {
      Gfx.sideL[t].push(buildSide(t, d, false, r));
      Gfx.sideR[t].push(buildSide(t, d, true, r));
    }
  }
  Gfx.dark = diamondCanvas([0, 0, 0]);
  Gfx.light = diamondCanvas([255, 255, 230]);
  Gfx.reticle = reticleCanvas();
  Gfx.oaks = [0, 1, 2, 3].map(() => buildOak(r));
  Gfx.pines = [0, 1, 2].map(() => buildPine(r));
  Gfx.bushes = [0, 1, 2].map(() => buildBush(r));
  Gfx.rocks = [0, 1, 2].map(() => buildRock(r));
}
