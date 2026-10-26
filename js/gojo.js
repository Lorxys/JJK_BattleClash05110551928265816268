'use strict';

// ---------------------------------------------------------------------------
// Satoru Gojo, dessiné deux fois plus finement que le reste du monde, dans le
// style de l'illustration de référence : cheveux blanc lavande striés de violet,
// bandeau noir aux plis gris, peau cernée de brun-rouge, uniforme noir aux
// reflets violets. Tout est tracé avec des formes simples puis détouré.
// ---------------------------------------------------------------------------
const GOJO_HR = 2;              // pixels du sprite par pixel du jeu
const GOJO_W = 60, GOJO_H = 98;
const GOJO_FOOT = 95;           // rangée des semelles
const GOJO_AX = GOJO_W / 2 / GOJO_HR;

const GOJO_COLORS = {
  hair: '#eeedf8', hairMid: '#d4cfea', hairShade: '#a99ccf', strand: '#7c5aa8',
  band: '#1b1b21', bandFold: '#5f5f6b', bandHi: '#9c9caa',
  skin: '#f7d2b2', skinShade: '#e3a98a', skinDeep: '#c07a60', line: '#6a2418',
  coat: '#17131e', coatMid: '#241c31', far: '#0f0c14', rim: '#5d3f8e', rimHi: '#8a6ac0',
  shoe: '#0d0b11', shoeHi: '#3a3248',
};
let GC = null;

// Pics de cheveux qui rayonnent depuis (cx, cy) : [angle en degrés, longueur]
function gojoSpikes(p, cx, cy, spikes, w = 4) {
  for (const [deg, len] of spikes) {
    const a = (deg * Math.PI) / 180, nx = -Math.sin(a), ny = Math.cos(a);
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
    p.poly([[cx + nx * w, cy + ny * w], tip, [cx - nx * w, cy - ny * w]], GC.hair);
  }
}

// Mèches : traits du centre vers la pointe de chaque pic
function gojoStrands(p, cx, cy, spikes) {
  spikes.forEach(([deg, len], k) => {
    const a = (deg * Math.PI) / 180;
    const c = k % 3 === 1 ? GC.strand : GC.hairShade;
    p.line(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, cx + Math.cos(a) * len * 0.8, cy + Math.sin(a) * len * 0.8, c);
  });
}

// --- De face et de dos ----------------------------------------------------------
const FRONT_SPIKES = [[-172, 15], [-150, 17], [-128, 18], [-108, 19], [-90, 17], [-72, 19], [-52, 18], [-30, 17], [-8, 15]];

function gojoLegsFront(p, ph) {
  const step = ph === 1 ? 1 : ph === 3 ? -1 : 0;
  for (const side of [-1, 1]) {
    const lift = step * side > 0 ? 3 : 0, x0 = 30 + side * 5 - 4;
    p.rect(x0, 70, 8, 22 - lift, GC.coat);
    p.rect(side < 0 ? x0 + 6 : x0, 72, 2, 19 - lift, GC.far);
    p.rect(x0 - 1, 90 - lift, 10, 5, GC.shoe);
    p.rect(x0, 90 - lift, 8, 1, GC.shoeHi);
  }
}

function gojoBodyFront(p, ph, back) {
  const swing = ph === 1 ? 2 : ph === 3 ? -2 : 0;
  // bras (derrière le buste)
  for (const side of [-1, 1]) {
    const s = swing * side;
    p.poly([[30 + side * 11, 44], [30 + side * 17, 46], [30 + side * 18, 66 + s], [30 + side * 13, 66 + s]], GC.coatMid);
    p.line(30 + side * 17, 47, 30 + side * 18, 65 + s, side < 0 ? GC.rim : GC.far);
    p.ellipse(30 + side * 15.5, 68 + s, 2.7, 3, GC.skin);
    p.set(30 + side * 16, 70 + s, GC.skinShade);
  }
  // veste longue
  p.poly([[16, 43], [44, 43], [42, 62], [45, 76], [15, 76], [18, 62]], GC.coat);
  p.shade((x) => x > 36, GC.far);
  // reflets violets et plis, comme sur l'illustration
  p.line(17, 45, 16, 75, GC.rim);
  p.line(18, 46, 17, 60, GC.rimHi);
  p.line(23, 62, 21, 75, GC.rim);
  p.line(38, 52, 41, 75, GC.coatMid);
  p.line(30, 44, 30, 76, back ? GC.coatMid : GC.far);
  if (!back) for (const y of [49, 56, 63]) p.set(31, y, GC.rimHi);
}

function gojoHeadFront(p) {
  p.ellipse(18.5, 26, 2.2, 3.4, GC.skinShade);
  p.ellipse(41.5, 26, 2.2, 3.4, GC.skinShade);
  p.poly([[19, 15], [41, 15], [41, 28], [36, 36], [30, 39], [24, 36], [19, 28]], GC.skin);
  p.rect(20, 24, 21, 2, GC.skinShade);
  p.poly([[36, 24], [41, 24], [41, 28], [36, 36], [33, 37]], GC.skinShade);
  p.set(30, 29, GC.skinDeep);
  p.set(31, 30, GC.skinDeep);
  p.line(27, 34, 32, 34, GC.line);
  p.set(33, 33, GC.line);
  // col montant qui cache le menton
  p.poly([[18, 37], [26, 39], [30, 41], [34, 39], [42, 37], [45, 46], [15, 46]], GC.coatMid);
  p.line(18, 37, 26, 39, GC.rim);
  p.line(34, 39, 42, 37, GC.rim);
  p.line(30, 41, 30, 46, GC.far);
  // bandeau et ses plis gris en diagonale
  p.rect(17, 16, 26, 8, GC.band);
  for (const x of [19, 24, 30, 35]) p.line(x, 22, x + 4, 17, GC.bandFold);
  p.line(19, 17, 41, 17, GC.bandHi);
  p.shade((x, y) => y === 17 && (x < 21 || (x > 27 && x < 32) || x > 38), GC.band, GC.bandHi);
  // cheveux
  p.ellipse(30, 11, 15, 8, GC.hair);
  gojoSpikes(p, 30, 12, FRONT_SPIKES);
  // mèches qui retombent sur le bandeau et sur les tempes
  p.poly([[23, 12], [27, 12], [25, 21]], GC.hair);
  p.poly([[31, 12], [35, 12], [34, 20]], GC.hair);
  p.poly([[15, 11], [19, 13], [17, 25]], GC.hair);
  p.poly([[45, 11], [41, 13], [43, 25]], GC.hair);
  p.shade((x, y) => y >= 14 && y <= 20, GC.hairMid, hexToRgb(GOJO_COLORS.hair));
  gojoStrands(p, 30, 12, FRONT_SPIKES);
  p.line(24, 13, 25, 19, GC.hairShade);
  p.line(32, 13, 33, 18, GC.strand);
}

function gojoHeadBack(p) {
  p.rect(26, 30, 9, 8, GC.skinShade); // nuque
  p.poly([[16, 36], [44, 36], [45, 46], [15, 46]], GC.coatMid);
  p.line(16, 36, 44, 36, GC.rim);
  p.ellipse(30, 18, 14.5, 13, GC.hair);
  gojoSpikes(p, 30, 13, FRONT_SPIKES);
  // pointes de la nuque
  for (const x of [20, 25, 30, 35, 40]) p.poly([[x - 3, 26], [x + 3, 26], [x + (x < 30 ? -1 : 1), 33]], GC.hair);
  p.shade((x, y) => y >= 23, GC.hairMid, hexToRgb(GOJO_COLORS.hair));
  p.shade((x, y) => y >= 29 && y <= 34, GC.hairShade, GC.hairMid);
  gojoStrands(p, 30, 13, FRONT_SPIKES);
  for (const x of [21, 26, 34, 39]) p.line(x, 24, x + (x < 30 ? -1 : 1), 30, GC.hairShade);
  // bandeau noué derrière la tête, un petit nœud et deux pans courts
  p.rect(16, 15, 28, 6, GC.band);
  for (const x of [18, 25, 36]) p.line(x, 20, x + 3, 16, GC.bandFold);
  p.ellipse(30, 18, 3, 2.6, GC.band);
  p.set(29, 17, GC.bandHi);
  p.poly([[28, 19], [31, 19], [28, 27], [26, 26]], GC.band);
  p.poly([[30, 19], [32, 19], [33, 25], [31, 25]], GC.band);
  p.line(28, 21, 27, 25, GC.bandFold);
}

// --- De profil, tourné vers la droite ------------------------------------------------
const SIDE_SPIKES = [[-178, 16], [-160, 18], [-140, 19], [-120, 18], [-100, 17], [-80, 16], [-60, 14], [-38, 12], [-200, 13]];

// ph : 0 et 2 = jambes qui se croisent, 1 et 3 = grande foulée
function gojoLegsSide(p, ph) {
  const stride = ph === 1 ? 8 : ph === 3 ? -8 : ph === 0 ? 2 : -2;
  const leg = (fx, c) => {
    p.poly([[26, 68], [34, 68], [30 + fx + 4, 91], [30 + fx - 4, 91]], c);
    p.rect(30 + fx - 4, 90, 10, 5, GC.shoe);
    p.rect(30 + fx - 3, 90, 8, 1, GC.shoeHi);
  };
  leg(-stride, GC.far);
  leg(stride, GC.coat);
}

function gojoBodySide(p, ph, punch) {
  p.poly([[21, 43], [39, 43], [39, 62], [41, 76], [19, 76], [21, 62]], GC.coat);
  p.shade((x) => x < 24, GC.far);
  p.line(38, 45, 40, 75, GC.rim);
  p.line(37, 47, 38, 60, GC.rimHi);
  p.line(28, 52, 27, 75, GC.rim);
  if (punch) {
    // bras tendu, poing serré
    p.poly([[28, 44], [33, 44], [50, 45], [50, 50], [33, 51], [28, 50]], GC.coatMid);
    p.line(33, 44, 50, 45, GC.rimHi);
    p.ellipse(53, 47.5, 3.6, 3.4, GC.skin);
    p.line(52, 45, 52, 50, GC.skinShade);
    p.set(55, 46, GC.skinDeep);
    p.set(55, 48, GC.skinDeep);
    return;
  }
  const swing = ph === 1 ? -5 : ph === 3 ? 5 : 0;
  p.poly([[26, 44], [34, 44], [32 + swing, 64], [27 + swing, 64]], GC.coatMid);
  p.line(33, 46, 32 + swing, 63, GC.rim);
  p.ellipse(29.5 + swing, 66, 2.7, 3, GC.skin);
  p.set(31 + swing, 67, GC.skinShade);
}

function gojoHeadSide(p) {
  p.poly([[22, 15], [39, 15], [41, 21], [44, 26], [41, 28], [41, 32], [37, 37], [28, 38], [24, 32], [22, 26]], GC.skin);
  p.poly([[22, 15], [29, 15], [28, 38], [24, 32], [22, 26]], GC.skinShade);
  p.ellipse(28, 27, 2.6, 3.6, GC.skin);
  p.line(28, 25, 27, 29, GC.skinDeep);
  p.set(43, 26, GC.skinDeep);
  p.line(38, 33, 40, 33, GC.line);
  // col montant
  p.poly([[23, 36], [31, 38], [38, 37], [40, 46], [20, 46]], GC.coatMid);
  p.line(31, 38, 38, 37, GC.rim);
  // bandeau, noué à l'arrière avec ses pans
  p.poly([[20, 16], [42, 16], [43, 23], [20, 23]], GC.band);
  for (const x of [26, 32, 37]) p.line(x, 22, x + 4, 17, GC.bandFold);
  p.line(22, 17, 41, 17, GC.bandHi);
  p.shade((x, y) => y === 17 && (x < 24 || (x > 29 && x < 34)), GC.band, GC.bandHi);
  p.ellipse(19, 20, 3, 3, GC.band);
  p.poly([[17, 21], [20, 22], [14, 32], [12, 31]], GC.band);
  p.poly([[18, 22], [20, 23], [18, 34], [16, 33]], GC.band);
  p.line(17, 23, 14, 30, GC.bandFold);
  // cheveux rejetés vers l'arrière, mèches sur le front
  p.ellipse(27, 11, 14, 8, GC.hair);
  gojoSpikes(p, 28, 12, SIDE_SPIKES);
  p.poly([[35, 10], [40, 12], [42, 19]], GC.hair);
  p.poly([[30, 12], [34, 12], [35, 19]], GC.hair);
  p.poly([[14, 12], [21, 14], [18, 24]], GC.hair);
  p.shade((x, y) => y >= 14 && y <= 20, GC.hairMid, hexToRgb(GOJO_COLORS.hair));
  gojoStrands(p, 28, 12, SIDE_SPIKES);
  p.line(36, 12, 40, 17, GC.strand);
}

function buildGojoFrame(view, ph, punch = false) {
  const p = new Pix(GOJO_W, GOJO_H);
  if (view === 'side') {
    gojoLegsSide(p, punch ? 1 : ph);
    gojoBodySide(p, ph, punch);
    gojoHeadSide(p);
  } else {
    gojoLegsFront(p, ph);
    gojoBodyFront(p, ph, view === 'back');
    if (view === 'back') gojoHeadBack(p);
    else gojoHeadFront(p);
  }
  return p.selout(0.34).canvas();
}

function buildGojo() {
  GC = {};
  for (const k in GOJO_COLORS) GC[k] = hexToRgb(GOJO_COLORS[k]);
  // [repos, marche 1..4]
  Gfx.gojo = {
    down: [0, 1, 2, 3, 2].map((ph) => buildGojoFrame('front', ph)),
    up: [0, 1, 2, 3, 2].map((ph) => buildGojoFrame('back', ph)),
    right: [0, 1, 2, 3, 0].map((ph) => buildGojoFrame('side', ph)),
  };
  Gfx.gojo.left = Gfx.gojo.right.map(flipH);
  Gfx.gojo.punchRight = buildGojoFrame('side', 1, true);
  Gfx.gojo.punchLeft = flipH(Gfx.gojo.punchRight);
}
