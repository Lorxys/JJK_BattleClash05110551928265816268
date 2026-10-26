'use strict';

// ---------------------------------------------------------------------------
// Le terrain (hauteurs + types de sol) et les objets posés dessus
// ---------------------------------------------------------------------------
const World = {
  H: new Int8Array(MAP_W * MAP_H),   // hauteur de chaque tuile
  T: new Uint8Array(MAP_W * MAP_H),  // type de sol
  V: new Uint8Array(MAP_W * MAP_H),  // variante de texture
  objects: [],
  seed: 0,
};

// Couleurs des débris projetés, par type de sol et par objet
const DEBRIS = [
  ['#4f913d', '#3d7534', '#6db84c', '#6e4b2f', '#7a5535'],
  ['#6e4b2f', '#7a5535', '#86603c', '#5a3d27'],
  ['#2f2622', '#453830', '#1a1512', '#5a4a40'],
  ['#251a33', '#3a2358', '#191223', '#4b2a75'],
];
const CHUNKS = {
  oak: ['#4a3220', '#6b4a2f', '#86603c', '#2a6334', '#387d3b', '#4f9a43', '#78bd52'],
  pine: ['#4a3220', '#6b4a2f', '#143628', '#1f5040', '#2c6a4f'],
  rock: ['#4e5260', '#6b7080', '#8d93a3', '#b4b9c6'],
  bush: ['#2a6334', '#387d3b', '#4f9a43', '#78bd52', '#e98bb5'],
};
const OBJ_STATS = {
  oak: { hp: 1.6, rad: 0.3, shw: 12 },
  pine: { hp: 1.2, rad: 0.25, shw: 9 },
  rock: { hp: 2.5, rad: 0.38, shw: 9 },
  bush: { hp: 0.3, rad: 0, shw: 7 },
};

const inMap = (i, j) => i >= 0 && j >= 0 && i < MAP_W && j < MAP_H;

// Hauteur du sol sous un point (très bas hors de l'île : on tombe dans le vide)
function groundAt(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  return inMap(i, j) ? World.H[j * MAP_W + i] : -100;
}

function addObject(kind, sp, x, y, art) {
  const s = OBJ_STATS[sp];
  World.objects.push({ kind, sp, x, y, spr: art.c, ax: art.ax, ay: art.ay, hp: s.hp, rad: s.rad, shw: s.shw, shake: 0, dead: false });
}

function generateWorld(seed) {
  World.seed = seed;
  const r = mulberry32(seed);
  const nh = makeNoise(seed ^ 0x1234), nf = makeNoise(seed ^ 0x5678), nt = makeNoise(seed ^ 0x9abc);
  const { H, T, V } = World;
  const cx = MAP_W / 2, cy = MAP_H / 2;

  for (let j = 0; j < MAP_H; j++) {
    for (let i = 0; i < MAP_W; i++) {
      const idx = j * MAP_W + i;
      let h = Math.floor((fbm(nh, i / 20, j / 20, 3) - 0.47) * 8);
      if (Math.hypot(i - cx, j - cy) < 9) h = Math.min(h, 0);
      H[idx] = clamp(h, 0, 3);
      T[idx] = T_GRASS;
      V[idx] = (r() * 255) | 0;
    }
  }
  // Adoucit le relief : jamais plus d'une marche entre deux tuiles voisines
  for (let pass = 0; pass < 4; pass++) {
    for (let j = 0; j < MAP_H; j++) {
      for (let i = 0; i < MAP_W; i++) {
        const idx = j * MAP_W + i;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!inMap(i + di, j + dj)) continue;
          const n = H[(j + dj) * MAP_W + i + di];
          if (H[idx] > n + 1) H[idx] = n + 1;
        }
      }
    }
  }

  World.objects = [];
  for (let j = 2; j < MAP_H - 2; j++) {
    for (let i = 2; i < MAP_W - 2; i++) {
      if (Math.hypot(i - cx, j - cy) < 5) continue;
      const forest = fbm(nf, i / 14, j / 14, 2) > 0.55;
      const roll = r();
      const x = i + 0.3 + r() * 0.4, y = j + 0.3 + r() * 0.4;
      if (roll < (forest ? 0.24 : 0.018)) {
        if (fbm(nt, i / 25, j / 25, 2) > 0.5) addObject('tree', 'pine', x, y, pick(Gfx.pines, r));
        else addObject('tree', 'oak', x, y, pick(Gfx.oaks, r));
      } else if (roll < (forest ? 0.3 : 0.03)) {
        addObject('bush', 'bush', x, y, pick(Gfx.bushes, r));
      } else if (roll < (forest ? 0.31 : 0.036)) {
        addObject('rock', 'rock', x, y, pick(Gfx.rocks, r));
      }
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
      const dig = Math.round(depth * (0.2 + 0.8 * f));
      if (dig > 0) H[idx] = Math.max(MIN_H, H[idx] - dig);
      let nt = type;
      if (type === T_BURNT && f < 0.4) nt = old === T_GRASS ? T_DIRT : old;
      T[idx] = nt;
      V[idx] = (Math.random() * 255) | 0;
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

// Violet : efface tout, laisse une tranchée lisse
function carveSphere(x, y, R) {
  const { H, T } = World;
  for (let j = Math.floor(y - R); j <= Math.floor(y + R); j++) {
    for (let i = Math.floor(x - R); i <= Math.floor(x + R); i++) {
      if (!inMap(i, j)) continue;
      const d = Math.hypot(i + 0.5 - x, j + 0.5 - y);
      if (d > R) continue;
      const idx = j * MAP_W + i;
      const target = Math.min(0, -3 + Math.floor((d / R) * 2.6));
      if (H[idx] > target) H[idx] = target;
      T[idx] = T_VOID;
    }
  }
}

// --- Destruction des objets ----------------------------------------------------
function uprootObject(o, vx, vy, vz, spin) {
  if (o.dead) return;
  o.dead = true;
  const g = groundAt(o.x, o.y);
  flyers.push({
    kind: 'f', sp: o.sp, spr: o.spr, x: o.x, y: o.y,
    z: g + (o.ay - o.spr.height / 2) / HS, rz: (o.spr.height / 2 / HS) * 0.6,
    vx, vy, vz, ang: 0, spin, life: 7, hold: false, dead: false,
  });
  const i = Math.floor(o.x), j = Math.floor(o.y);
  if (o.kind === 'tree' && inMap(i, j) && World.T[j * MAP_W + i] === T_GRASS) World.T[j * MAP_W + i] = T_DIRT;
  spawnDebris(o.x, o.y, g, 10, DEBRIS[T_DIRT], 3);
}

function shatterObject(o, power) {
  if (o.dead) return;
  o.dead = true;
  const n = o.kind === 'tree' ? 45 : o.kind === 'rock' ? 30 : 14;
  spawnDebris(o.x, o.y, groundAt(o.x, o.y) + (o.kind === 'tree' ? 2 : 0.5), n, CHUNKS[o.sp], power);
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
  spawnDebris(f.x, f.y, Math.max(f.z, groundAt(f.x, f.y)), f.sp === 'rock' ? 26 : 40, CHUNKS[f.sp], power);
}

function updateObjects(dt) {
  let dead = false;
  for (const o of World.objects) {
    if (o.shake > 0) o.shake -= dt;
    if (o.dead) dead = true;
  }
  if (dead) World.objects = World.objects.filter((o) => !o.dead);
}
