'use strict';

// ---------------------------------------------------------------------------
// Satoru Gojo d'après l'artwork de référence (gojo_V1), dessiné à la main pixel
// par pixel : une lettre = une couleur de la palette. Lumière en haut à gauche,
// le côté droit reprend les mêmes formes dans leurs teintes sombres.
// ---------------------------------------------------------------------------
const GOJO_PAL_HAND = {
  h: '#4b4373', // contour des cheveux
  W: '#ffffff', w: '#e6e3f3', l: '#bdb5da', v: '#8f84bd', // cheveux
  K: '#141219', k: '#2b2834', g: '#6a6778', // bandeau
  S: '#f9dcc4', s: '#ebb898', d: '#c98a6c', r: '#7a3426', // peau
  O: '#09080d', // contour sombre (uniforme, chaussures)
  m: '#2f2942', N: '#211c2f', n: '#15121d', // uniforme : clair, base, ombre
  Q: '#9a7fe0', P: '#6a4fb4', p: '#3e2f70', // plis violets : reflet, pli, pli dans l'ombre
  B: '#0f0e14', b: '#2e2a38', c: '#9a94a8', // chaussures cirées
};
// côté droit (à l'ombre) : chaque teinte passe à sa version sombre
const SHADE_RIGHT = { m: 'N', N: 'n', Q: 'P', P: 'p', S: 's', s: 'd', W: 'w', w: 'l', l: 'v', b: 'B', c: 'b' };

const GW = 31, GHT = 80;
function gBlank() {
  return Array.from({ length: GHT }, () => Array(GW).fill('.'));
}
// écrit str à partir de (x, y)
function gPut(g, x, y, str) {
  for (let k = 0; k < str.length; k++) if (str[k] !== ' ' && x + k >= 0 && x + k < GW) g[y][x + k] = str[k];
}
// écrit str à gauche et son reflet à droite (assombri)
function gSym(g, x, y, str) {
  gPut(g, x, y, str);
  const rev = [...str].reverse().map((ch) => SHADE_RIGHT[ch] || ch).join('');
  gPut(g, GW - x - str.length, y, rev);
}

function gSpan(g, y, x0, x1, ch) {
  for (let x = x0; x <= x1; x++) gPut(g, x, y, ch);
}
function gSymSpan(g, y, x0, x1, ch) {
  gSpan(g, y, x0, x1, ch);
  gSpan(g, y, GW - 1 - x1, GW - 1 - x0, SHADE_RIGHT[ch] || ch);
}
function gLine(g, x0, y0, x1, y1, ch) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) gPut(g, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), ch);
}
// contour : chaque pixel vide qui touche une couleur de la liste prend la couleur c
function gOutline(g, chars, c, y0 = 0, y1 = GHT - 1) {
  const pts = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < GW; x++) {
      if (g[y][x] !== '.') continue;
      const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => chars.includes((g[y + dy] || [])[x + dx]));
      if (near) pts.push([x, y]);
    }
  }
  for (const [x, y] of pts) g[y][x] = c;
}

// Cheveux : mèches en pointe qui partent du crâne, séparées par des traits lavande
const HAIR_SPIKES = [
  { tip: [5, 6], base: [6, 10] },
  { tip: [8, 2], base: [7, 12] },
  { tip: [11, 0], base: [9, 14] },
  { tip: [15, -1], base: [12, 18] },
  { tip: [19, 0], base: [15, 21] },
  { tip: [22, 2], base: [18, 23] },
  { tip: [25, 5], base: [20, 24] },
];
const HAIR_BASE_Y = 9;

function drawHair(g) {
  // calotte sous les mèches
  for (let y = 5; y <= 11; y++) {
    const hw = Math.round(9.5 * Math.sqrt(1 - ((y - 10) / 6) ** 2));
    gSpan(g, y, 15 - hw, 15 + hw, 'W');
  }
  for (const s of HAIR_SPIKES) {
    for (let y = Math.max(0, s.tip[1]); y <= HAIR_BASE_Y; y++) {
      const k = (y - s.tip[1]) / (HAIR_BASE_Y - s.tip[1]);
      gSpan(g, y, Math.round(s.tip[0] + (s.base[0] - s.tip[0]) * k), Math.round(s.tip[0] + (s.base[1] - s.tip[0]) * k), 'W');
    }
  }
  // ombre propre à chaque mèche : son flanc droit est lavande clair
  for (const s of HAIR_SPIKES) gLine(g, s.tip[0] + 1, s.tip[1] + 2, s.base[1] - 1, HAIR_BASE_Y, 'w');
  // traits lavande entre les mèches, qui convergent vers le front
  HAIR_SPIKES.slice(0, -1).forEach((s, k) => {
    const n = HAIR_SPIKES[k + 1], x = Math.round((s.tip[0] + n.tip[0]) / 2) + 1;
    gLine(g, x, Math.max(s.tip[1], n.tip[1]) + 3, Math.round(15 + (x - 15) * 0.6), 10, k % 2 ? 'v' : 'l');
  });
  // dessous des cheveux plus sombre, juste au-dessus du bandeau
  gSpan(g, 10, 7, 23, 'l');
  for (const x of [8, 11, 14, 17, 20, 22]) gPut(g, x, 10, 'w');
}

function drawFrontIdle() {
  const g = gBlank();
  drawHair(g);
  // mèches des tempes qui descendent le long du visage
  gSymSpan(g, 11, 6, 7, 'W');
  gSymSpan(g, 12, 6, 7, 'w');
  gSymSpan(g, 13, 6, 7, 'l');
  gSymSpan(g, 14, 7, 7, 'l');
  gOutline(g, 'Wwlv', 'h', 0, 15);
  // --- bandeau, plis gris en diagonale --------------------------------------------
  for (let y = 11; y <= 14; y++) gSpan(g, y, 8, 22, 'K');
  for (const x0 of [9, 14, 19]) gLine(g, x0, 14, x0 + 3, 11, 'k');
  for (const x0 of [10, 20]) gLine(g, x0, 14, x0 + 1, 13, 'g');
  gSpan(g, 11, 9, 21, 'K');
  gPut(g, 12, 11, 'W'); // une mèche qui retombe sur le bandeau
  gPut(g, 12, 12, 'l');
  gPut(g, 17, 11, 'w');
  // --- visage : front sous le bandeau, menton en pointe ---------------------------
  const faceRows = [[15, 9, 21], [16, 9, 21], [17, 10, 20], [18, 10, 20], [19, 11, 19], [20, 11, 19], [21, 12, 18], [22, 13, 17]];
  for (const [y, x0, x1] of faceRows) {
    gSpan(g, y, x0, x1, 'S');
    gPut(g, x1, y, 's');
    gPut(g, x1 - 1, y, y > 16 ? 's' : 'S');
  }
  gSpan(g, 15, 9, 21, 'd'); // ombre portée du bandeau
  gSpan(g, 15, 11, 19, 's');
  gPut(g, 16, 18, 'd');     // nez
  gPut(g, 16, 19, 's');
  gLine(g, 14, 21, 16, 21, 'r'); // sourire en coin
  gPut(g, 17, 20, 'r');
  gOutline(g, 'Ssd', 'r', 15, 23);
  // oreilles
  gPut(g, 8, 16, 's');
  gPut(g, 22, 16, 'd');
  // --- col montant qui encadre la mâchoire ------------------------------------------
  for (let y = 18; y <= 23; y++) {
    const x1 = y < 21 ? 10 : y < 23 ? 11 + (y - 21) : 13;
    gSymSpan(g, y, 6 - (y > 20 ? 1 : 0), x1 - (y < 21 ? 1 : 0), 'm');
  }
  gSymSpan(g, 23, 6, 14, 'm');
  gPut(g, 15, 23, 'N');
  gLine(g, 6, 18, 9, 18, 'Q');
  gLine(g, 21, 18, 24, 18, 'P');
  gLine(g, 5, 21, 5, 23, 'Q');
  // --- épaules, bras le long du corps, buste --------------------------------------
  gSymSpan(g, 24, 3, 14, 'm');
  gPut(g, 15, 24, 'N');
  for (let y = 25; y <= 50; y++) {
    // veste : étroite à la taille, plus large à l'ourlet
    const w = y < 38 ? 7 : y < 44 ? 6 : 7;
    gSymSpan(g, y, 15 - w, 14, 'm');
    gPut(g, 15, y, 'n');
  }
  // bras gauche et droit : manche de 4 px, plonge dans la poche à la hanche
  for (let y = 25; y <= 44; y++) {
    const x0 = y < 40 ? 2 : 2 + Math.round((y - 39) * 0.8);
    gSymSpan(g, y, x0, x0 + 3, 'm');
    gPut(g, x0, y, 'Q');                      // reflet violet sur le bord du bras
    gPut(g, GW - 1 - x0, y, 'p');
    if (y > 26 && y < 41) {
      gPut(g, x0 + 4, y, 'O');                // creux entre le bras et le buste
      gPut(g, GW - 1 - x0 - 4, y, 'O');
    }
  }
  // poignets et pouces qui dépassent des poches
  gSymSpan(g, 45, 6, 9, 'Q');
  gPut(g, 9, 46, 'S');
  gPut(g, 21, 46, 's');
  // plis de la veste : grandes diagonales violettes
  gLine(g, 7, 26, 12, 31, 'P');
  gLine(g, 8, 26, 13, 31, 'Q');
  gLine(g, 9, 35, 12, 38, 'P');
  gLine(g, 9, 44, 12, 47, 'P');
  gLine(g, 23, 26, 18, 31, 'p');
  gLine(g, 21, 36, 18, 39, 'p');
  gSpan(g, 50, 8, 22, 'N');
  // --- jambes --------------------------------------------------------------------------
  for (let y = 51; y <= 75; y++) {
    gSymSpan(g, y, 9, 13, 'm');
    gPut(g, 14, y, y < 53 ? 'n' : '.');
    gPut(g, 16, y, y < 53 ? 'n' : '.');
    gPut(g, 15, y, y < 53 ? 'n' : '.');
  }
  gLine(g, 10, 54, 11, 59, 'P');
  gLine(g, 11, 63, 11, 66, 'P');
  gLine(g, 10, 70, 10, 72, 'P');
  gLine(g, 20, 55, 19, 59, 'p');
  gLine(g, 19, 64, 19, 66, 'p');
  // --- chaussures cirées --------------------------------------------------------------
  gSymSpan(g, 76, 8, 13, 'B');
  gSymSpan(g, 77, 7, 13, 'B');
  gSymSpan(g, 78, 7, 13, 'B');
  gPut(g, 9, 76, 'b');
  gPut(g, 8, 77, 'c');
  gPut(g, 9, 77, 'b');
  gPut(g, 20, 77, 'b');
  // contour sombre de tout l'uniforme
  gOutline(g, 'mNnQPpBbcS', 'O', 17, GHT - 1);
  return g.map((row) => row.join(''));
}

// Les images de Gojo sont posées dans un cadre plus large pour laisser la place
// aux bras tendus et aux coups de pied des futures animations.
const GOJO_CW = 64, GOJO_CH = 88, GOJO_OX = 16, GOJO_OY = 4;
const GOJO_AX = GOJO_OX + 15;    // axe du corps
const GOJO_FOOT = GOJO_OY + 78;  // rangée des semelles (point d'ancrage)

function gojoCanvas(rows) {
  const c = document.createElement('canvas');
  c.width = GOJO_CW;
  c.height = GOJO_CH;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = GOJO_PAL_HAND[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(GOJO_OX + x, GOJO_OY + y, 1, 1);
    }
  });
  return c;
}

// respiration : tête et épaules descendent d'un pixel
function gojoBreath(rows) {
  return rows.map((row, y) => (y === 0 ? '.'.repeat(GW) : y <= 25 ? rows[y - 1] : row));
}

// pas provisoire : une jambe se lève de 2 px, le corps monte d'un pixel
function gojoStep(rows, leg) {
  const out = rows.map((row) => [...row]);
  const x0 = leg < 0 ? 0 : 15, x1 = leg < 0 ? 14 : GW - 1;
  for (let y = 56; y < GHT; y++) {
    for (let x = x0; x <= x1; x++) out[y][x] = y + 2 < GHT ? rows[y + 2][x] : '.';
  }
  return out.map((r) => r.join(''));
}

function buildGojo() {
  const idle = drawFrontIdle();
  const frames = [idle, gojoBreath(idle), idle, gojoStep(idle, -1), idle, gojoStep(idle, 1)].map(gojoCanvas);
  // en attendant les vues de dos, de profil et les animations, toutes les
  // directions et toutes les poses reprennent la vue de face
  const G = { down: frames, up: frames, right: frames, left: frames, act: {} };
  for (const k of ['jab', 'cross', 'kick', 'upper', 'flash', 'blue0', 'blue1', 'red0', 'red1', 'purple0', 'purple1', 'purple2',
    'dash', 'hurt', 'front_pose', 'front_domain', 'front_hurt', 'front_down']) {
    G.act[k] = { right: frames[0], left: frames[0] };
  }
  Gfx.gojo = G;
}
