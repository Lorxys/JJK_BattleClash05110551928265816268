'use strict';

// ---------------------------------------------------------------------------
// Satoru Gojo d'après l'artwork de référence (gojo_V1) : silhouette fine et
// élancée, cheveux blancs en pics ombrés de lavande, bandeau noir, uniforme
// noir à col montant strié de plis violets, pantalon noir, chaussures cirées.
//
// Même échelle de pixels que le décor. Chaque pose est un petit squelette
// (épaules, coudes, mains, hanches, genoux, pieds) dessiné membre par membre
// puis détouré : toutes les images sont de vraies images distinctes, aucune
// n'est obtenue en tournant ou en déformant une autre.
// ---------------------------------------------------------------------------
const GOJO_W = 40, GOJO_H = 64;
const GOJO_TOP = 8;             // marge en haut pour les pics de cheveux
const GOJO_FOOT = 51 + GOJO_TOP; // rangée des semelles (point d'ancrage)
const GOJO_AX = GOJO_W / 2;
const GX = 20;                   // axe vertical du corps dans le sprite

const GOJO_COLORS = {
  hair: '#fbfbff', hairMid: '#d9d6ea', hairShade: '#a8a2c8', strand: '#7a6aa8',
  band: '#16141c', bandHi: '#55525f',
  skin: '#f6d3b8', skinShade: '#dba88c', skinDeep: '#b8735c', line: '#6a2a1e',
  coat: '#1b1826', coatMid: '#272236', far: '#110f18', fold: '#5e4596', foldHi: '#8e70d2',
  shoe: '#0c0b10', shoeHi: '#5a5468',
};
let GC = null;

// --- Mains -------------------------------------------------------------------------
// type : fist (poing), point (index tendu), two (index et majeur levés, le signe
// de Gojo), open (paume ouverte), pocket (dans la poche : rien à dessiner)
function gojoHand(p, x, y, type, dx = 1, dy = 0) {
  if (type === 'pocket') return;
  if (type === 'open') {
    p.ellipse(x, y, 1.9, 1.6, GC.skin);
    p.set(x + dx * 2, y - 1, GC.skin);
    p.set(x - 1, y + 1, GC.skinShade);
    return;
  }
  p.ellipse(x, y, 1.6, 1.6, GC.skin);
  p.set(x, y + 1, GC.skinShade);
  if (type === 'point') {
    p.set(x + dx * 2, y + dy * 2, GC.skin);
    p.set(x + dx * 3, y + dy * 3, GC.skin);
  } else if (type === 'two') {
    p.rect(Math.round(x), Math.round(y) - 4, 2, 3, GC.skin);
    p.set(Math.round(x) + 1, Math.round(y) - 4, GC.skinShade);
  }
}

// Bras : manche jusqu'au coude puis avant-bras, main au bout
function gojoArm(p, s, a, col) {
  p.capsule(s[0], s[1], a.e[0], a.e[1], 1.6, col);
  p.capsule(a.e[0], a.e[1], a.h[0], a.h[1], 1.4, col);
  // poignet de la manche, un pli violet sur le bras le plus proche
  if (col === GC.coat) p.line(s[0], s[1] + 1, a.e[0], a.e[1], GC.fold);
  const l = Math.hypot(a.h[0] - a.e[0], a.h[1] - a.e[1]) || 1;
  gojoHand(p, a.h[0], a.h[1], a.hand, Math.round((a.h[0] - a.e[0]) / l), Math.round((a.h[1] - a.e[1]) / l));
}

// Jambe et chaussure ; toe = sens de la pointe (1 à droite, 0 de face)
function gojoLeg(p, hip, l, col, toe) {
  p.capsule(hip[0], hip[1], l.k[0], l.k[1], 1.8, col);
  p.capsule(l.k[0], l.k[1], l.f[0], l.f[1] - 1, 1.6, col);
  if (col === GC.coat) p.line(l.k[0] - 1, l.k[1] - 2, l.k[0], l.k[1] + 2, GC.fold);
  const fx = Math.round(l.f[0]), fy = Math.round(l.f[1]);
  if (toe) {
    p.rect(fx - 2 + (toe < 0 ? -2 : 0), fy - 1, 6, 2, GC.shoe);
    p.set(fx + toe * 2, fy - 1, GC.shoeHi);
  } else {
    p.rect(fx - 2, fy - 1, 4, 2, GC.shoe);
    p.set(fx - 1, fy - 1, GC.shoeHi);
  }
}

// Pics de cheveux qui rayonnent depuis (cx, cy) : [angle en degrés, longueur]
function gojoSpikes(p, cx, cy, spikes) {
  for (const [deg, len] of spikes) {
    const a = (deg * Math.PI) / 180, nx = -Math.sin(a) * 1.7, ny = Math.cos(a) * 1.7;
    p.poly([[cx + nx, cy + ny], [cx + Math.cos(a) * len, cy + Math.sin(a) * len], [cx - nx, cy - ny]], GC.hair);
  }
  // mèches lavande au creux des pics
  spikes.forEach(([deg, len], k) => {
    if (k % 2) return;
    const a = (deg * Math.PI) / 180;
    p.line(cx + Math.cos(a) * 2, cy + Math.sin(a) * 2, cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6, k % 4 ? GC.hairShade : GC.strand);
  });
}

// --- Vue de face / de dos ------------------------------------------------------------
const FRONT_SPIKES = [[-168, 8], [-150, 10], [-132, 11], [-114, 12], [-97, 11], [-80, 12], [-63, 11], [-46, 10], [-29, 9], [-12, 7]];

function gojoTorsoFront(p, dy, back) {
  const y = (v) => v + dy;
  p.poly([[13, y(17)], [27, y(17)], [26, y(30)], [27, y(36)], [13, y(36)], [14, y(30)]], GC.coat);
  p.shade((x, yy) => x >= 22 && yy >= y(17), GC.far, GC.coat);
  // plis violets en diagonale, comme sur l'artwork
  p.line(13, y(18), 18, y(17), GC.foldHi);
  p.line(14, y(19), 14, y(29), GC.fold);
  p.line(15, y(24), 18, y(22), GC.fold);
  p.line(15, y(31), 18, y(29), GC.fold);
  p.line(22, y(25), 24, y(23), GC.fold);
  p.line(21, y(33), 24, y(31), GC.fold);
  p.line(GX, y(17), GX, y(36), back ? GC.coatMid : GC.far);
  if (!back) p.set(GX + 1, y(20), GC.foldHi);
}

function gojoHeadFront(p, dy) {
  const y = (v) => v + dy;
  p.ellipse(15, y(10), 1.2, 1.8, GC.skinShade); // oreilles
  p.ellipse(25, y(10), 1.2, 1.8, GC.skinShade);
  p.poly([[15, y(5)], [25, y(5)], [25, y(11)], [22, y(15)], [18, y(15)], [15, y(11)]], GC.skin);
  p.shade((x, yy) => x >= 22 && yy > y(9), GC.skinShade, GC.skin);
  p.set(GX, y(11), GC.skinShade);           // nez
  p.line(GX - 1, y(13), GX + 1, y(13), GC.line); // sourire en coin
  p.set(GX + 2, y(12), GC.line);
  // col montant qui cache le menton
  p.poly([[14, y(13)], [18, y(14)], [GX, y(15)], [22, y(14)], [26, y(13)], [27, y(18)], [13, y(18)]], GC.coatMid);
  p.line(14, y(13), 18, y(14), GC.foldHi);
  p.line(GX, y(15), GX, y(18), GC.far);
  // bandeau
  p.rect(14, y(7), 13, 3, GC.band);
  p.set(16, y(8), GC.bandHi);
  p.set(17, y(7), GC.bandHi);
  p.set(22, y(8), GC.bandHi);
  p.set(23, y(7), GC.bandHi);
  // cheveux en pics, mèches qui retombent sur le bandeau
  p.ellipse(GX, y(4), 6, 3, GC.hair);
  gojoSpikes(p, GX, y(4), FRONT_SPIKES);
  p.poly([[13, y(4)], [16, y(5)], [14, y(10)]], GC.hair);
  p.poly([[27, y(4)], [24, y(5)], [26, y(10)]], GC.hair);
  p.poly([[17, y(5)], [GX, y(5)], [18, y(9)]], GC.hair);
  p.poly([[21, y(5)], [24, y(5)], [23, y(8)]], GC.hair);
  p.shade((x, yy) => yy >= y(6) && yy <= y(10), GC.hairMid, GC.hair);
  p.set(18, y(7), GC.hairShade);
  p.set(23, y(7), GC.strand);
}

function gojoHeadBack(p, dy) {
  const y = (v) => v + dy;
  p.rect(18, y(12), 5, 3, GC.skinShade); // nuque
  p.poly([[14, y(14)], [26, y(14)], [27, y(18)], [13, y(18)]], GC.coatMid);
  p.line(14, y(14), 26, y(14), GC.foldHi);
  p.ellipse(GX, y(7), 6.5, 6, GC.hair);
  gojoSpikes(p, GX, y(5), FRONT_SPIKES);
  for (const x of [15, 18, 22, 25]) p.poly([[x - 1.5, y(10)], [x + 1.5, y(10)], [x + (x < GX ? -0.5 : 0.5), y(14)]], GC.hair);
  p.shade((x, yy) => yy >= y(12), GC.hairMid, GC.hair);
  for (const x of [16, 19, 22, 25]) p.set(x, y(12), GC.hairShade);
  // bandeau noué derrière la tête, deux pans
  p.rect(13, y(7), 15, 3, GC.band);
  p.set(16, y(7), GC.bandHi);
  p.set(24, y(8), GC.bandHi);
  p.rect(GX - 1, y(7), 3, 3, GC.band);
  p.line(GX - 1, y(10), GX - 2, y(13), GC.band);
  p.line(GX + 1, y(10), GX + 2, y(12), GC.band);
}

// pose = { dy, la, ra : bras gauche/droit (à l'écran), ll, rl : jambes }
function gojoFront(p, pose, back) {
  const dy = pose.dy || 0;
  const sL = [13, 19 + dy], sR = [27, 19 + dy];
  // les jambes d'abord, la veste par-dessus
  gojoLeg(p, [17.5, 33 + dy], pose.ll, GC.coat, 0);
  gojoLeg(p, [22.5, 33 + dy], pose.rl, GC.far, 0);
  gojoTorsoFront(p, dy, back);
  const armBehind = (a) => a.h[1] > 15 + dy || a.hand === 'pocket';
  if (armBehind(pose.la)) gojoArm(p, sL, pose.la, GC.coat);
  if (armBehind(pose.ra)) gojoArm(p, sR, pose.ra, GC.far);
  if (back) gojoHeadBack(p, dy);
  else gojoHeadFront(p, dy);
  // une main levée devant le visage (signe du Territoire, pose de l'artwork)
  if (!armBehind(pose.la)) gojoArm(p, sL, pose.la, GC.coat);
  if (!armBehind(pose.ra)) gojoArm(p, sR, pose.ra, GC.far);
}

// --- Vue de profil (tourné vers la droite) ------------------------------------------------
const SIDE_SPIKES = [[-205, 8], [-185, 10], [-165, 11], [-145, 12], [-125, 11], [-105, 10], [-85, 9], [-65, 7], [-45, 5]];

function gojoTorsoSide(p, lean, dy) {
  const y = (v) => v + dy, L = lean;
  p.poly([[16 + L, y(17)], [24 + L, y(17)], [24 + L * 0.5, y(30)], [25, y(36)], [15, y(36)], [16 + L * 0.3, y(30)]], GC.coat);
  p.shade((x, yy) => x < 18 + L * 0.5 && yy >= y(17), GC.far, GC.coat);
  p.line(24 + L, y(18), 25, y(35), GC.fold);
  p.line(19 + L, y(23), 22 + L, y(21), GC.fold);
  p.line(18 + L * 0.5, y(31), 22 + L * 0.5, y(28), GC.fold);
  p.set(23 + L, y(18), GC.foldHi);
}

function gojoHeadSide(p, hx, hy) {
  // crâne et visage de profil, le nez pointe vers la droite
  p.poly([[hx - 4, hy - 4], [hx + 4, hy - 4], [hx + 5, hy], [hx + 6, hy + 1], [hx + 5, hy + 2], [hx + 4, hy + 5], [hx, hy + 6], [hx - 3, hy + 3]], GC.skin);
  p.poly([[hx - 4, hy - 4], [hx - 1, hy - 4], [hx, hy + 6], [hx - 3, hy + 3]], GC.skinShade);
  p.ellipse(hx - 1, hy + 1.5, 1.2, 1.8, GC.skinShade); // oreille
  p.set(hx - 1, hy + 1, GC.skinDeep);
  p.set(hx + 4, hy + 4, GC.line);                   // bouche
  p.set(hx + 5, hy + 1, GC.skinShade);
  // col montant
  p.poly([[hx - 3, hy + 5], [hx + 4, hy + 5], [hx + 5, hy + 9], [hx - 4, hy + 9]], GC.coatMid);
  p.line(hx - 3, hy + 5, hx + 4, hy + 5, GC.foldHi);
  // bandeau, noué derrière avec deux pans qui flottent
  p.rect(hx - 5, hy - 3, 11, 3, GC.band);
  p.set(hx + 2, hy - 2, GC.bandHi);
  p.set(hx + 3, hy - 3, GC.bandHi);
  p.line(hx - 6, hy - 2, hx - 8, hy + 1, GC.band);
  p.line(hx - 6, hy - 1, hx - 7, hy + 3, GC.band);
  // cheveux rejetés en arrière, mèches sur le front
  p.ellipse(hx - 1, hy - 5, 5, 3, GC.hair);
  gojoSpikes(p, hx - 1, hy - 5, SIDE_SPIKES);
  p.poly([[hx + 2, hy - 6], [hx + 6, hy - 5], [hx + 5, hy - 1]], GC.hair);
  p.poly([[hx - 6, hy - 6], [hx - 3, hy - 4], [hx - 6, hy + 1]], GC.hair);
  p.shade((x, y) => y >= hy - 3 && y <= hy, GC.hairMid, GC.hair);
  p.set(hx + 4, hy - 4, GC.strand);
}

// pose = { lean, dy, head: [dx, dy], near, far : bras ; nl, fl : jambes }
function gojoSide(p, pose) {
  const L = pose.lean || 0, dy = pose.dy || 0;
  const sN = [20 + L, 20 + dy], sF = [19 + L, 19 + dy], hip = [20, 33 + dy];
  if (pose.far.hand !== 'pocket') gojoArm(p, sF, pose.far, GC.far);
  gojoLeg(p, [19, hip[1]], pose.fl, GC.far, 1);
  gojoLeg(p, [21, hip[1]], pose.nl, GC.coat, 1);
  gojoTorsoSide(p, L, dy);
  const h = pose.head || [0, 0];
  gojoHeadSide(p, 21 + L + h[0], 9 + dy + h[1]);
  gojoArm(p, sN, pose.near, GC.coat);
}

// --- Les poses -----------------------------------------------------------------------
const POCKET_F = (side) => ({ e: [side < 0 ? 11 : 29, 26], h: [side < 0 ? 14 : 26, 31], hand: 'pocket' });
const LEGS_F = (lift = 0) => ({
  ll: { k: [17.5, 41 - (lift > 0 ? 2 : 0)], f: [17.5, 50 - (lift > 0 ? 2 : 0)] },
  rl: { k: [22.5, 41 - (lift < 0 ? 2 : 0)], f: [22.5, 50 - (lift < 0 ? 2 : 0)] },
});
const POCKET_S = { e: [18, 26], h: [21, 31], hand: 'pocket' };
const STANCE = { nl: { k: [23, 41], f: [25, 50] }, fl: { k: [17, 41], f: [15, 50] } };
const STAND_S = { nl: { k: [21, 41], f: [21, 50] }, fl: { k: [19, 41], f: [18, 50] } };

// Marche nonchalante, les mains dans les poches, comme dans l'anime
const SIDE_WALK = [
  { nl: { k: [23, 41], f: [25, 50] }, fl: { k: [17, 41], f: [15, 50] } },
  { dy: -1, nl: { k: [21, 40], f: [20, 49] }, fl: { k: [20, 41], f: [19, 50] } },
  { nl: { k: [18, 41], f: [16, 50] }, fl: { k: [22, 41], f: [24, 50] } },
  { dy: -1, nl: { k: [20, 41], f: [20, 50] }, fl: { k: [21, 40], f: [20, 49] } },
];

const SIDE_POSES = {
  idle0: { near: POCKET_S, far: POCKET_S, ...STAND_S },
  idle1: { dy: 1, near: POCKET_S, far: POCKET_S, ...STAND_S },
  // Frappe : direct, crochet, coup de pied haut, uppercut… puis le Black Flash
  jab: { lean: 1, near: { e: [25, 20], h: [30, 19], hand: 'fist' }, far: { e: [21, 25], h: [23, 21], hand: 'fist' }, ...STANCE },
  cross: { lean: 2, near: { e: [22, 25], h: [24, 22], hand: 'fist' }, far: { e: [26, 19], h: [31, 19], hand: 'fist' }, ...STANCE },
  kick: {
    lean: -2, head: [-1, 0], near: { e: [17, 25], h: [15, 28], hand: 'fist' }, far: { e: [22, 23], h: [24, 20], hand: 'fist' },
    nl: { k: [26, 29], f: [33, 27] }, fl: { k: [19, 41], f: [18, 50] },
  },
  upper: { dy: 1, near: { e: [24, 25], h: [26, 16], hand: 'fist' }, far: { e: [17, 25], h: [15, 27], hand: 'fist' }, ...STANCE },
  flash: {
    lean: 3, dy: 2, near: { e: [27, 21], h: [33, 21], hand: 'fist' }, far: { e: [15, 24], h: [12, 26], hand: 'fist' },
    nl: { k: [26, 42], f: [29, 50] }, fl: { k: [15, 42], f: [11, 50] },
  },
  // Bleu : index et majeur levés, le bras se tend vers la cible
  blue0: { near: { e: [22, 26], h: [24, 21], hand: 'two' }, far: POCKET_S, ...STAND_S },
  blue1: { lean: 1, near: { e: [25, 21], h: [29, 19], hand: 'two' }, far: POCKET_S, ...STANCE },
  // Rouge : l'index pointé près de l'épaule, puis tendu d'un coup
  red0: { lean: -1, near: { e: [23, 23], h: [23, 17], hand: 'point' }, far: POCKET_S, ...STAND_S },
  red1: { lean: 2, near: { e: [26, 20], h: [31, 19], hand: 'point' }, far: POCKET_S, ...STANCE },
  // Violet : bras écartés (Bleu dans une main, Rouge dans l'autre), puis réunis
  purple0: { near: { e: [24, 23], h: [28, 22], hand: 'open' }, far: { e: [16, 23], h: [12, 21], hand: 'open' }, ...STANCE },
  purple1: { lean: 1, near: { e: [24, 23], h: [27, 21], hand: 'two' }, far: { e: [23, 22], h: [26, 22], hand: 'fist' }, ...STANCE },
  purple2: { lean: 3, dy: 1, near: { e: [27, 20], h: [32, 20], hand: 'open' }, far: { e: [24, 22], h: [28, 22], hand: 'open' }, ...STANCE },
  // Téléportation : penché en avant, bras et jambes qui traînent
  dash: {
    lean: 4, dy: 1, near: { e: [17, 25], h: [14, 28], hand: 'open' }, far: { e: [16, 23], h: [13, 25], hand: 'open' },
    nl: { k: [21, 40], f: [18, 48] }, fl: { k: [18, 41], f: [14, 49] },
  },
  // Touché : il recule sous le choc
  hurt: {
    lean: -3, head: [-1, 1], near: { e: [23, 24], h: [26, 26], hand: 'open' }, far: { e: [16, 22], h: [14, 19], hand: 'open' },
    nl: { k: [22, 41], f: [23, 50] }, fl: { k: [17, 41], f: [14, 50] },
  },
};

const FRONT_POSES = {
  idle0: { la: POCKET_F(-1), ra: POCKET_F(1), ...LEGS_F() },
  idle1: { dy: 1, la: POCKET_F(-1), ra: POCKET_F(1), ...LEGS_F() },
  // la pose de l'artwork : une main levée, index et majeur dressés
  pose: { la: { e: [10, 22], h: [12, 14], hand: 'two' }, ra: POCKET_F(1), ...LEGS_F() },
  // Extension du territoire : le signe des mains devant le visage
  domain: { la: { e: [13, 25], h: [18, 15], hand: 'two' }, ra: { e: [28, 25], h: [22, 17], hand: 'fist' }, ...LEGS_F() },
  hurt: { dy: 1, la: { e: [10, 23], h: [9, 27], hand: 'open' }, ra: { e: [30, 23], h: [31, 27], hand: 'open' }, ...LEGS_F() },
  // à terre (défaite) : un genou au sol
  down: {
    dy: 6, la: { e: [12, 31], h: [12, 37], hand: 'open' }, ra: { e: [28, 31], h: [27, 36], hand: 'fist' },
    ll: { k: [15, 46], f: [16, 50] }, rl: { k: [24, 43], f: [24, 50] },
  },
};
const FRONT_WALK = [0, 1, 0, -1].map((lift) => ({ dy: lift ? -1 : 0, la: POCKET_F(-1), ra: POCKET_F(1), ...LEGS_F(lift) }));

function gojoFrame(view, pose) {
  const p = new Pix(GOJO_W, GOJO_H);
  p.oy = GOJO_TOP;
  if (view === 'side') gojoSide(p, pose);
  else gojoFront(p, pose, view === 'back');
  p.oy = 0;
  return p.selout(0.3).canvas();
}

function buildGojo() {
  GC = {};
  for (const k in GOJO_COLORS) GC[k] = hexToRgb(GOJO_COLORS[k]);
  const side = (pose) => gojoFrame('side', pose);
  const G = {
    // [repos 1, repos 2, marche 1..4] pour chaque direction
    down: [FRONT_POSES.idle0, FRONT_POSES.idle1, ...FRONT_WALK].map((p) => gojoFrame('front', p)),
    up: [FRONT_POSES.idle0, FRONT_POSES.idle1, ...FRONT_WALK].map((p) => gojoFrame('back', p)),
    right: [SIDE_POSES.idle0, SIDE_POSES.idle1, ...SIDE_WALK.map((l) => ({ near: POCKET_S, far: POCKET_S, ...l }))].map(side),
    act: {},
  };
  G.left = G.right.map(flipH);
  for (const k in SIDE_POSES) {
    const r = side(SIDE_POSES[k]);
    G.act[k] = { right: r, left: flipH(r) };
  }
  for (const k of ['pose', 'domain', 'hurt', 'down']) {
    const f = gojoFrame('front', FRONT_POSES[k]);
    G.act['front_' + k] = { right: f, left: f };
  }
  Gfx.gojo = G;
}
