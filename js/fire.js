'use strict';

// ---------------------------------------------------------------------------
// Le feu : l'herbe et les fleurs brûlent et propagent les flammes, les arbres
// s'embrasent puis finissent carbonisés. L'eau, la terre et la pierre l'arrêtent.
// ---------------------------------------------------------------------------
const Fire = { F: new Float32Array(N_TILES), list: [] };
const FIRE_TILE_DUR = 3;
const FIRE_TREE_DUR = 7;
const MAX_FIRES = 500;
const FIRE_SPARKS = ['#ffe08a', '#ffb040', '#ff6a20', '#ff3a10'];
// Probabilité par seconde d'embraser chaque voisine (herbe : sous le seuil de
// percolation, donc l'incendie finit par s'éteindre seul ; fleurs : plus vif)
const SPREAD_RATE = { [T_GRASS]: 0.13, [T_FLOWER]: 0.2 };

const isFlammable = (idx) => World.T[idx] === T_GRASS || World.T[idx] === T_FLOWER;

function resetFire() {
  Fire.F.fill(0);
  Fire.list.length = 0;
}

function igniteTile(i, j) {
  if (!inMap(i, j)) return;
  const idx = j * MAP_W + i;
  if (Fire.F[idx] > 0 || !isFlammable(idx) || Fire.list.length >= MAX_FIRES) return;
  Fire.F[idx] = FIRE_TILE_DUR * rnd(0.8, 1.2);
  Fire.list.push(idx);
}

function igniteObject(o) {
  if (o.dead || o.kind !== 'tree' || o.charred || o.burn > 0) return;
  o.burn = FIRE_TREE_DUR * rnd(0.8, 1.2);
}

function igniteArea(x, y, R, chance = 1) {
  igniteRing(x, y, 0, R, chance);
}

// Allume le sol et les arbres entre les rayons r0 et r1
function igniteRing(x, y, r0, r1, chance) {
  for (let j = Math.floor(y - r1); j <= Math.floor(y + r1); j++) {
    for (let i = Math.floor(x - r1); i <= Math.floor(x + r1); i++) {
      const d = Math.hypot(i + 0.5 - x, j + 0.5 - y);
      if (d < r0 || d > r1 || Math.random() > chance) continue;
      igniteTile(i, j);
      const o = objectAt(i, j);
      if (o) igniteObject(o);
    }
  }
}

function extinguishArea(x, y, R) {
  for (let j = Math.floor(y - R); j <= Math.floor(y + R); j++) {
    for (let i = Math.floor(x - R); i <= Math.floor(x + R); i++) {
      if (!inMap(i, j) || Math.hypot(i + 0.5 - x, j + 0.5 - y) > R) continue;
      Fire.F[j * MAP_W + i] = 0;
      const o = objectAt(i, j);
      if (o && o.burn > 0) o.burn = 0;
    }
  }
}

const isBurning = (x, y) => {
  const i = Math.floor(x), j = Math.floor(y);
  return inMap(i, j) && Fire.F[j * MAP_W + i] > 0;
};

function updateFire(dt) {
  const { F, list } = Fire;
  let w = 0;
  for (let k = 0; k < list.length; k++) {
    const idx = list[k];
    if (F[idx] <= 0) continue; // éteint
    if (!isFlammable(idx)) {
      F[idx] = 0;
      continue;
    }
    F[idx] -= dt;
    const i = idx % MAP_W, j = (idx / MAP_W) | 0, h = World.H[idx];
    if (Math.random() < dt * 7) {
      spawnSpark(i + Math.random(), j + Math.random(), h + 0.2, rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(2, 4), pick(FIRE_SPARKS), rnd(0.3, 0.7));
    }
    if (Math.random() < dt * 1.2) spawnSmoke(i + Math.random(), j + Math.random(), h + 1);
    const rate = SPREAD_RATE[World.T[idx]] * dt;
    if (Math.random() < rate) igniteTile(i + 1, j);
    if (Math.random() < rate) igniteTile(i - 1, j);
    if (Math.random() < rate) igniteTile(i, j + 1);
    if (Math.random() < rate) igniteTile(i, j - 1);
    if (Math.random() < dt * 0.6) {
      const o = objectAt(i, j);
      if (o) igniteObject(o);
    }
    if (F[idx] <= 0) {
      F[idx] = 0;
      World.T[idx] = T_BURNT;
      World.V[idx] = (Math.random() * 255) | 0;
      continue;
    }
    list[w++] = idx;
  }
  list.length = w;

  // arbres en feu
  for (const o of World.objects) {
    if (!(o.burn > 0) || o.dead) continue;
    o.burn -= dt;
    const g = groundAt(o.x, o.y);
    if (Math.random() < dt * 14) {
      spawnSpark(o.x + rnd(-0.5, 0.5), o.y + rnd(-0.5, 0.5), g + rnd(1.5, o.ay / HS), rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(2, 5), pick(FIRE_SPARKS), rnd(0.3, 0.8));
    }
    if (Math.random() < dt * 2) spawnSmoke(o.x + rnd(-0.4, 0.4), o.y + rnd(-0.4, 0.4), g + o.ay / HS);
    if (Math.random() < dt * 0.8) igniteTile(Math.floor(o.x) + ((Math.random() * 3) | 0) - 1, Math.floor(o.y) + ((Math.random() * 3) | 0) - 1);
    if (Math.random() < dt * 0.9) {
      // gagne un arbre voisin au hasard
      const i = Math.floor(o.x) + ((Math.random() * 5) | 0) - 2, j = Math.floor(o.y) + ((Math.random() * 5) | 0) - 2;
      const n = objectAt(i, j);
      if (n && n !== o) igniteObject(n);
    }
    if (o.burn <= 0) {
      o.burn = 0;
      o.charred = true;
      o.spr = charredSprite(o.spr);
      o.hp = Math.min(o.hp, 0.5);
    }
  }
}
