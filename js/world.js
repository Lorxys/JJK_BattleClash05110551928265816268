'use strict';

// ---------------------------------------------------------------------------
// Le terrain (hauteurs + types de sol) et les objets posés dessus
// ---------------------------------------------------------------------------
const N_TILES = MAP_W * MAP_H;
const World = {
  H: new Int8Array(N_TILES),    // hauteur de chaque tuile
  T: new Uint8Array(N_TILES),   // type de sol
  V: new Uint8Array(N_TILES),   // variante de texture
  grid: new Int32Array(N_TILES), // objet posé sur chaque tuile (index + 1)
  objects: [],
  seed: 0,
};

// Couleurs des débris projetés, par type de sol et par objet
const DEBRIS = [
  ['#62a838', '#4a8a2c', '#7cc04c', '#8a5a32', '#9a6a3e'],
  ['#9a6a3e', '#8a5a32', '#a47244', '#764c2b'],
  ['#3a2e2a', '#4d3d34', '#241c18', '#6a5a50'],
  ['#251a33', '#3a2358', '#191223', '#4b2a75'],
  ['#3c62a8', '#a8c8ff', '#24457f'],
  ['#e2c088', '#c8a06a', '#f2dcae'],
  ['#a09a94', '#7e7872', '#bab4ae'],
  ['#62a838', '#4a8a2c', '#f2a6c8', '#ffd84a', '#fff6e0'],
];
const WATER_DROPS = DEBRIS[T_WATER];
const CHUNKS = {
  oak: ['#4e321e', '#74492a', '#94633a', '#2a6630', '#3a8238', '#52a044', '#78c058'],
  sakura: ['#4e321e', '#74492a', '#c85a88', '#e47ea6', '#f4a8c4', '#ffd4e4'],
  tuft: ['#24501e', '#336a26', '#457f2e'],
  reed: ['#3a5e22', '#55782c', '#5a3a1e'],
  lily: ['#2f7a3a', '#4aa04a', '#6cc060'],
  pine: ['#4a3220', '#6b4a2f', '#143628', '#1f5040', '#2c6a4f'],
  rock: ['#4e5260', '#6b7080', '#8d93a3', '#b4b9c6'],
  bush: ['#2a6630', '#3a8238', '#52a044', '#78c058', '#f2a6c8'],
  torii: ['#c8322a', '#8f1f1a', '#1c1416', '#e05a48'],
  lantern: ['#8d93a3', '#6b7080', '#b4b9c6', '#ffd36a'],
};
const CHARRED = ['#1a1512', '#2f2622', '#453830', '#6a5a50'];
const OBJ_STATS = {
  oak: { hp: 1.6, rad: 0.3, shw: 12 },
  sakura: { hp: 1.6, rad: 0.3, shw: 12 },
  tuft: { hp: 0.2, rad: 0, shw: 0 },
  reed: { hp: 0.2, rad: 0, shw: 0 },
  lily: { hp: 0.2, rad: 0, shw: 0 },
  pine: { hp: 1.2, rad: 0.25, shw: 9 },
  rock: { hp: 2.5, rad: 0.38, shw: 9 },
  bush: { hp: 0.3, rad: 0, shw: 7 },
  torii: { hp: 3, rad: 0, shw: 16 },
  lantern: { hp: 1.2, rad: 0.2, shw: 5 },
};

const inMap = (i, j) => i >= 0 && j >= 0 && i < MAP_W && j < MAP_H;

// Hauteur du sol sous un point (très bas hors de l'île : on tombe dans le vide)
function groundAt(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  return inMap(i, j) ? World.H[j * MAP_W + i] : -100;
}

function typeAt(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  return inMap(i, j) ? World.T[j * MAP_W + i] : -1;
}

function objectAt(i, j) {
  if (!inMap(i, j)) return null;
  const k = World.grid[j * MAP_W + i];
  return k ? World.objects[k - 1] : null;
}

function addObject(kind, sp, x, y, art) {
  const s = OBJ_STATS[sp];
  World.objects.push({
    kind, sp, x, y, spr: art.c, ax: art.ax, ay: art.ay, hp: s.hp, rad: s.rad, shw: s.shw * WS,
    shake: 0, burn: 0, charred: false, dead: false,
  });
}

function generateWorld(seed) {
  World.seed = seed;
  const r = mulberry32(seed);
  const nh = makeNoise(seed ^ 0x1234), nf = makeNoise(seed ^ 0x5678), nt = makeNoise(seed ^ 0x9abc);
  const nl = makeNoise(seed ^ 0x2468), nfl = makeNoise(seed ^ 0x1357);
  const { H, T, V } = World;
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const each = (fn) => {
    for (let j = 0; j < MAP_H; j++) for (let i = 0; i < MAP_W; i++) fn(i, j, j * MAP_W + i);
  };

  // relief, lacs, champs de fleurs
  each((i, j, idx) => {
    const dc = Math.hypot(i - cx, j - cy);
    let h = Math.floor((fbm(nh, i / 20, j / 20, 3) - 0.47) * 8);
    if (dc < 9) h = Math.min(h, 0);
    H[idx] = clamp(h, 0, 3);
    T[idx] = T_GRASS;
    V[idx] = (r() * 255) | 0;
    // l'île est bordée par la mer, avec une côte découpée
    const coast = Math.min(i, j, MAP_W - 1 - i, MAP_H - 1 - j) + (fbm(nl, i / 9, j / 9, 2) - 0.5) * 10;
    if (coast < 4 || (dc > 14 && fbm(nl, i / 18, j / 18, 3) > 0.63)) {
      T[idx] = T_WATER;
      H[idx] = WATER_H;
    } else if (fbm(nfl, i / 12, j / 12, 2) > 0.62) {
      T[idx] = T_FLOWER;
    }
  });
  // plages de sable autour de l'eau (deux tuiles de large)
  each((i, j, idx) => {
    if (T[idx] === T_WATER) return;
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        if (inMap(i + di, j + dj) && T[(j + dj) * MAP_W + i + di] === T_WATER) {
          T[idx] = T_SAND;
          H[idx] = Math.min(H[idx], Math.abs(di) + Math.abs(dj) > 2 ? 1 : 0);
          return;
        }
      }
    }
  });
  // adoucit le relief : jamais plus d'une marche entre deux tuiles voisines
  for (let pass = 0; pass < 5; pass++) {
    each((i, j, idx) => {
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inMap(i + di, j + dj)) continue;
        const n = H[(j + dj) * MAP_W + i + di];
        if (H[idx] > n + 1) H[idx] = n + 1;
      }
    });
  }

  World.objects = [];
  const occ = new Uint8Array(N_TILES);

  // petits sanctuaires : torii, allée de pierre et lanternes
  for (let placed = 0, tries = 0; placed < 7 && tries < 600; tries++) {
    const i = 8 + ((r() * (MAP_W - 16)) | 0), j = 8 + ((r() * (MAP_H - 16)) | 0);
    if (Math.hypot(i - cx, j - cy) < 12) continue;
    const h0 = H[j * MAP_W + i];
    let ok = true;
    for (let a = -3; a <= 3 && ok; a++) {
      for (let b = -2; b <= 2; b++) {
        const idx = (j + a - b) * MAP_W + i + a + b;
        if (T[idx] === T_WATER || T[idx] === T_SAND || H[idx] !== h0 || occ[idx]) { ok = false; break; }
      }
    }
    if (!ok) continue;
    for (let a = -3; a <= 3; a++) {
      for (let b = -2; b <= 2; b++) occ[(j + a - b) * MAP_W + i + a + b] = 1;
      T[(j + a) * MAP_W + i + a] = T_STONE;
      T[(j + a) * MAP_W + i + a + 1] = T_STONE;
    }
    addObject('struct', 'torii', i + 1, j + 0.5, Gfx.torii);
    for (const k of [-2, 2]) {
      for (const s of [-1, 1]) addObject('struct', 'lantern', i + 1 + k + s * 1.3, j + 0.5 + k - s * 1.3, Gfx.lantern);
    }
    placed++;
  }

  // arbres, buissons et rochers
  each((i, j, idx) => {
    if (i < 2 || j < 2 || i >= MAP_W - 2 || j >= MAP_H - 2 || occ[idx]) return;
    if (T[idx] === T_WATER || T[idx] === T_SAND || Math.hypot(i - cx, j - cy) < 5) return;
    const forest = fbm(nf, i / 14, j / 14, 2) > 0.55;
    const roll = r();
    const x = i + 0.3 + r() * 0.4, y = j + 0.3 + r() * 0.4;
    if (roll < (forest ? 0.24 : 0.018)) {
      const kind = fbm(nt, i / 25, j / 25, 2);
      if (kind > 0.6) addObject('tree', 'pine', x, y, pick(Gfx.pines, r));
      else if (kind < 0.42 && r() < 0.6) addObject('tree', 'sakura', x, y, pick(Gfx.sakuras, r));
      else addObject('tree', 'oak', x, y, pick(Gfx.oaks, r));
    } else if (roll < (forest ? 0.3 : 0.03)) {
      addObject('bush', 'bush', x, y, pick(Gfx.bushes, r));
    } else if (roll < (forest ? 0.31 : 0.036)) {
      addObject('rock', 'rock', x, y, pick(Gfx.rocks, r));
    } else if (roll < (forest ? 0.36 : 0.1)) {
      addObject('bush', 'tuft', x, y, pick(Gfx.tufts, r));
    }
  });
  // roseaux sur les rives, nénuphars sur les lacs (décor fragile, sans collision)
  each((i, j, idx) => {
    if (occ[idx]) return;
    const x = i + 0.3 + r() * 0.4, y = j + 0.3 + r() * 0.4;
    if (T[idx] === T_SAND && r() < 0.16) addObject('bush', 'reed', x, y, pick(Gfx.reeds, r));
    else if (T[idx] === T_WATER && r() < 0.035) addObject('bush', 'lily', x, y, pick(Gfx.lilies, r));
  });
  floodQ.clear();
  updateObjects(0);
}

// --- Inondation : un creux qui touche un lac se remplit d'eau --------------------
const floodQ = new Set();
let floodT = 0;

function updateFlood(dt) {
  floodT -= dt;
  if (floodT > 0 || !floodQ.size) return;
  floodT = 0.12;
  const { H, T } = World;
  const cur = [...floodQ];
  floodQ.clear();
  for (const idx of cur) {
    if (T[idx] === T_WATER || H[idx] > WATER_H) continue;
    const i = idx % MAP_W, j = (idx / MAP_W) | 0;
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => inMap(a, b));
    if (!nb.some(([a, b]) => T[b * MAP_W + a] === T_WATER)) continue;
    T[idx] = T_WATER;
    H[idx] = WATER_H;
    Fire.F[idx] = 0;
    if (Math.random() < 0.4) spawnParticle(i + 0.5, j + 0.5, WATER_H + 0.1, rnd(-1, 1), rnd(-1, 1), rnd(2, 5), pick(WATER_DROPS), 1, 1);
    for (const [a, b] of nb) {
      const n = b * MAP_W + a;
      if (T[n] !== T_WATER && H[n] <= WATER_H) floodQ.add(n);
    }
  }
}

// Creuse un cratère : abaisse le sol, change sa nature et projette des débris
function damageTerrain(x, y, radius, depth, type, debris = 1) {
  const { H, T, V } = World;
  for (let j = Math.floor(y - radius); j <= Math.floor(y + radius); j++) {
    for (let i = Math.floor(x - radius); i <= Math.floor(x + radius); i++) {
      if (!inMap(i, j)) continue;
      const d = Math.hypot(i + 0.5 - x, j + 0.5 - y);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const idx = j * MAP_W + i;
      const old = T[idx];
      if (old === T_WATER) {
        // l'eau gicle, et s'évapore si c'est une explosion
        for (let k = 0; k < 3 * debris; k++) {
          spawnParticle(i + Math.random(), j + Math.random(), WATER_H + 0.1, rnd(-2, 2), rnd(-2, 2), rnd(5, 12) * (0.4 + f), pick(WATER_DROPS), 1, 1.5);
        }
        if (type === T_BURNT && Math.random() < 0.5) spawnSmoke(i + Math.random(), j + Math.random(), WATER_H + 0.2, true);
        continue;
      }
      const dig = Math.round(depth * (0.2 + 0.8 * f));
      if (dig > 0) H[idx] = Math.max(MIN_H, H[idx] - dig);
      let nt = type;
      if (type === T_BURNT && f < 0.4) nt = old === T_GRASS || old === T_FLOWER ? T_DIRT : old;
      T[idx] = nt;
      V[idx] = (Math.random() * 255) | 0;
      Fire.F[idx] = 0;
      if (H[idx] <= WATER_H) floodQ.add(idx);
      if (debris > 0) {
        const n = Math.round((1 + dig * 3) * debris);
        for (let k = 0; k < n; k++) {
          const px = i + Math.random(), py = j + Math.random();
          const dx = px - x, dy = py - y, dl = Math.hypot(dx, dy) + 0.1;
          const s = rnd(1, 5) * (0.5 + f);
          spawnParticle(px, py, H[idx] + 0.2, (dx / dl) * s, (dy / dl) * s, rnd(4, 11) * (0.4 + f),
            pick(DEBRIS[old]), Math.random() < 0.35 ? 2 : 1, rnd(2.5, 6));
        }
      }
    }
  }
  for (const o of World.objects) {
    if (!o.dead && o.kind === 'bush' && Math.hypot(o.x - x, o.y - y) < radius) shatterObject(o, 3);
  }
}

// Violet : efface tout, laisse une tranchée lisse (que l'eau peut envahir)
function carveSphere(x, y, R) {
  const { H, T } = World;
  for (let j = Math.floor(y - R); j <= Math.floor(y + R); j++) {
    for (let i = Math.floor(x - R); i <= Math.floor(x + R); i++) {
      if (!inMap(i, j)) continue;
      const d = Math.hypot(i + 0.5 - x, j + 0.5 - y);
      if (d > R) continue;
      const idx = j * MAP_W + i;
      const target = Math.min(0, -3 + Math.floor((d / R) * 2.6));
      if (H[idx] > target || T[idx] === T_WATER) H[idx] = Math.min(H[idx], target);
      T[idx] = T_VOID;
      Fire.F[idx] = 0;
      floodQ.add(idx);
    }
  }
}

// --- Destruction des objets ----------------------------------------------------
function splash(x, y, n) {
  for (let k = 0; k < n; k++) {
    spawnParticle(x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), WATER_H + 0.1, rnd(-2.5, 2.5), rnd(-2.5, 2.5), rnd(4, 11), pick(WATER_DROPS), 1, 1.5);
  }
  Sfx.splash();
}

function uprootObject(o, vx, vy, vz, spin, burning = false) {
  if (o.dead) return;
  if (o.kind === 'struct') {
    shatterObject(o, Math.hypot(vx, vy) * 0.4 + 3);
    return;
  }
  o.dead = true;
  const g = groundAt(o.x, o.y);
  flyers.push({
    kind: 'f', sp: o.sp, spr: o.spr, x: o.x, y: o.y,
    z: g + (o.ay - o.spr.height / 2) / HS, rz: (o.spr.height / 2 / HS) * 0.6,
    vx, vy, vz, ang: 0, spin, life: 7, hold: false, dead: false,
    burning: burning || o.burn > 0, charred: o.charred,
  });
  const i = Math.floor(o.x), j = Math.floor(o.y);
  if (o.kind === 'tree' && inMap(i, j)) {
    const idx = j * MAP_W + i;
    if (World.T[idx] === T_GRASS || World.T[idx] === T_FLOWER) World.T[idx] = T_DIRT;
  }
  spawnDebris(o.x, o.y, g, 10, DEBRIS[T_DIRT], 3);
}

function shatterObject(o, power) {
  if (o.dead) return;
  o.dead = true;
  const n = { tree: 45, rock: 30, bush: 14 }[o.kind] || (o.sp === 'torii' ? 60 : 20);
  const lift = o.kind === 'tree' ? 2 : o.sp === 'torii' ? 3 : 0.5;
  spawnDebris(o.x, o.y, groundAt(o.x, o.y) + lift, n, o.charred ? CHARRED : CHUNKS[o.sp], power);
  if (o.sp === 'lantern') igniteArea(o.x, o.y, 1.3, 0.8);
  if (o.burn > 0) igniteArea(o.x, o.y, 1, 0.5);
}

function vaporizeObject(o) {
  if (o.dead) return;
  o.dead = true;
  const g = groundAt(o.x, o.y);
  for (let k = 0; k < 16; k++) {
    spawnSpark(o.x + rnd(-0.4, 0.4), o.y + rnd(-0.4, 0.4), g + rnd(0, o.ay / HS), rnd(-1, 1), rnd(-1, 1), rnd(1, 4), pick(PURPLE_SPARKS), rnd(0.4, 1));
  }
}

function breakFlyer(f, power = 4) {
  if (f.dead) return;
  f.dead = true;
  if (typeAt(f.x, f.y) === T_WATER && f.z < WATER_H + 3) {
    splash(f.x, f.y, 30);
    if (f.burning) for (let k = 0; k < 10; k++) spawnSmoke(f.x + rnd(-0.5, 0.5), f.y + rnd(-0.5, 0.5), WATER_H + 0.3, true);
    return;
  }
  spawnDebris(f.x, f.y, Math.max(f.z, groundAt(f.x, f.y)), f.sp === 'rock' ? 26 : 40, f.charred ? CHARRED : CHUNKS[f.sp], power);
  if (f.burning) igniteArea(f.x, f.y, 1.4, 0.7);
}

function updateObjects(dt) {
  let dead = false;
  for (const o of World.objects) {
    if (o.shake > 0) o.shake -= dt;
    if (o.dead) dead = true;
  }
  if (dead) World.objects = World.objects.filter((o) => !o.dead);
  const g = World.grid;
  g.fill(0);
  World.objects.forEach((o, k) => {
    const i = Math.floor(o.x), j = Math.floor(o.y);
    if (inMap(i, j)) g[j * MAP_W + i] = k + 1;
  });
}
