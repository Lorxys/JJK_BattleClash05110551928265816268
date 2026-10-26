'use strict';

// ---------------------------------------------------------------------------
// Ambiance : tout ce qui fait vivre l'île sans toucher au jeu. Pétales de
// sakura portés par le vent, papillons, oiseaux qui s'envolent quand ça
// explose, énergie maudite qui suinte des fléaux. Tout tombe sur des pixels entiers.
// Tout est en coordonnées du monde (x, y en tuiles, z en unités de hauteur).
// ---------------------------------------------------------------------------
const Amb = {
  petals: [],
  motes: [],      // énergie maudite (violette) et éclats de l'Infini (cyan)
  wisps: [],      // fumée sombre qui monte des fléaux
  flies: [],      // papillons
  birds: [],
  t: 0,
};
const WIND_X = 0.55, WIND_Y = -0.3; // le vent pousse vers la droite de l'écran
const PETAL_COLS = ['#ffd0e4', '#ffb3d1', '#ff9cc4', '#fff0f6'];
const FLY_COLS = ['#fff6e0', '#ffe27a', '#9fd8ff'];

function initAmbience() {
  Amb.petals.length = Amb.motes.length = Amb.wisps.length = Amb.flies.length = Amb.birds.length = 0;
}

// Les oiseaux perchés dans les arbres proches s'enfuient
function scareBirds(x, y, r = 9) {
  let n = 0;
  for (const o of World.objects) {
    if (o.dead || o.kind !== 'tree' || Amb.birds.length > 24 || n > 8) continue;
    const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
    if (d > r || Math.random() < 0.5) continue;
    const z = groundAt(o.x, o.y) + o.ay / HS - 1;
    for (let k = 0; k < 1 + (Math.random() < 0.5); k++, n++) {
      const l = d || 1;
      Amb.birds.push({
        x: o.x, y: o.y, z, vx: (dx / l) * rnd(3, 5), vy: (dy / l) * rnd(3, 5), vz: rnd(1.5, 2.5),
        ph: Math.random() * 6, life: 4,
      });
    }
  }
}

function updateAmbience(dt) {
  Amb.t += dt;
  const px = Player.x, py = Player.y;
  const far = (o, r) => Math.abs(o.x - px) > r || Math.abs(o.y - py) > r;

  // pétales : plus nombreux près des sakuras
  if (Math.random() < dt * 9) {
    const x = px + rnd(-16, 16), y = py + rnd(-16, 16);
    if (inMap(x | 0, y | 0)) {
      Amb.petals.push({ x, y, z: groundAt(x, y) + rnd(5, 10), vz: -rnd(0.5, 0.9), ph: Math.random() * 6, c: pick(PETAL_COLS), land: 0 });
    }
  }
  for (let k = Amb.petals.length - 1; k >= 0; k--) {
    const p = Amb.petals[k];
    if (p.land > 0) {
      p.land -= dt;
      if (p.land <= 0 || far(p, 22)) Amb.petals.splice(k, 1);
      continue;
    }
    p.ph += dt * 5;
    p.x += (WIND_X + Math.sin(p.ph) * 0.4) * dt;
    p.y += (WIND_Y + Math.cos(p.ph * 0.7) * 0.2) * dt;
    p.z += p.vz * dt;
    const g = inMap(p.x | 0, p.y | 0) ? groundAt(p.x, p.y) : EDGE_H;
    if (p.z <= g) {
      p.z = g;
      p.land = 2.5;
    } else if (far(p, 22)) Amb.petals.splice(k, 1);
  }

  // énergie maudite autour des fléaux, éclats bleus autour de Gojo
  for (const c of curses) {
    if (c.dead || c.spawnT > 0 || far(c, 20)) continue;
    const big = c.type === 'brute' ? 2 : 1;
    if (Math.random() < dt * 5 * big) {
      Amb.wisps.push({ x: c.x + rnd(-0.3, 0.3), y: c.y + rnd(-0.3, 0.3), z: c.z + rnd(0, 1.5 * big), r: rnd(2, 3.5) * big, life: 1, max: 1 });
    }
    if (Math.random() < dt * 3 * big) {
      Amb.motes.push({ x: c.x + rnd(-0.5, 0.5), y: c.y + rnd(-0.5, 0.5), z: c.z + rnd(0, 2), vz: rnd(1, 2), life: 1.2, max: 1.2, cyan: false });
    }
  }
  if (Math.random() < dt * 3) {
    Amb.motes.push({ x: px + rnd(-0.7, 0.7), y: py + rnd(-0.7, 0.7), z: Player.z + rnd(0, 5), vz: rnd(0.3, 0.8), life: 0.7, max: 0.7, cyan: true });
  }
  if (Math.random() < dt * 2) {
    const x = px + rnd(-14, 14), y = py + rnd(-14, 14);
    if (inMap(x | 0, y | 0)) Amb.motes.push({ x, y, z: groundAt(x, y), vz: rnd(0.6, 1.2), life: 2.5, max: 2.5, cyan: false });
  }
  for (let k = Amb.motes.length - 1; k >= 0; k--) {
    const m = Amb.motes[k];
    m.life -= dt;
    m.z += m.vz * dt;
    m.x += Math.sin(m.life * 4 + k) * 0.2 * dt;
    if (m.life <= 0) Amb.motes.splice(k, 1);
  }
  for (let k = Amb.wisps.length - 1; k >= 0; k--) {
    const w = Amb.wisps[k];
    w.life -= dt * 1.4;
    w.z += dt * 2.2;
    if (w.life <= 0) Amb.wisps.splice(k, 1);
  }

  // papillons : quelques-uns qui virevoltent autour de Gojo
  while (Amb.flies.length < 5) {
    Amb.flies.push({ x: px + rnd(-12, 12), y: py + rnd(-12, 12), h: Math.random() * 6, ph: Math.random() * 6, c: pick(FLY_COLS), z: 0 });
  }
  for (const f of Amb.flies) {
    f.h += rnd(-3, 3) * dt;
    f.ph += dt;
    f.x += Math.cos(f.h) * 1.2 * dt;
    f.y += Math.sin(f.h) * 1.2 * dt;
    const g = inMap(f.x | 0, f.y | 0) ? groundAt(f.x, f.y) : EDGE_H;
    f.z = g + 1.6 + Math.sin(f.ph * 3) * 0.5;
    // ils fuient le combat
    if (far(f, 18) || FX.shake > 6) {
      f.x = px + rnd(-12, 12);
      f.y = py + rnd(-12, 12);
    }
  }

  for (let k = Amb.birds.length - 1; k >= 0; k--) {
    const b = Amb.birds[k];
    b.life -= dt;
    b.ph += dt * 14;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.life <= 0) Amb.birds.splice(k, 1);
  }
}

const ambX = (o, cx) => Math.round(isoX(o.x, o.y) - cx);
const ambY = (o, cy) => Math.round(isoY(o.x, o.y, o.z) - cy);

// Au-dessus du décor, sous les effets lumineux
function drawAmbience(ctx, cx, cy, W, Hh) {
  const on = (x, y) => x > -20 && y > -20 && x < W + 20 && y < Hh + 20;
  // fumée maudite
  for (const w of Amb.wisps) {
    const x = ambX(w, cx), y = ambY(w, cy);
    if (!on(x, y)) continue;
    ctx.fillStyle = `rgba(36,10,52,${(0.45 * w.life).toFixed(2)})`;
    pxDisc(ctx, x, y, w.r * (0.5 + w.life * 0.5));
  }
  // pétales : un pixel qui tourne sur lui-même, posé à plat une fois au sol
  for (const p of Amb.petals) {
    const x = ambX(p, cx), y = ambY(p, cy);
    if (!on(x, y)) continue;
    ctx.globalAlpha = p.land > 0 ? Math.min(1, p.land) : 1;
    ctx.fillStyle = p.c;
    const flat = p.land > 0 || Math.cos(p.ph) > 0;
    ctx.fillRect(x, y, flat ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  // papillons : deux ailes qui battent
  for (const f of Amb.flies) {
    const x = ambX(f, cx), y = ambY(f, cy);
    if (!on(x, y)) continue;
    ctx.fillStyle = 'rgba(12,24,8,0.25)';
    ctx.fillRect(x, Math.round(isoY(f.x, f.y, f.z - 1.6) - cy), 1, 1);
    ctx.fillStyle = f.c;
    if (Math.sin(f.ph * 22) > 0) {
      ctx.fillRect(x - 1, y - 1, 1, 2);
      ctx.fillRect(x + 1, y - 1, 1, 2);
    } else ctx.fillRect(x, y - 1, 1, 1);
    ctx.fillStyle = '#2a1a30';
    ctx.fillRect(x, y, 1, 1);
  }
  // oiseaux : silhouettes en V, ailes hautes ou basses
  ctx.fillStyle = '#1a1426';
  for (const b of Amb.birds) {
    const x = ambX(b, cx), y = ambY(b, cy);
    if (!on(x, y)) continue;
    ctx.globalAlpha = Math.min(1, b.life);
    const up = Math.sin(b.ph) > 0 ? -1 : 1;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, y + (up < 0 ? -1 : 0), 1, 1);
    ctx.fillRect(x + 1, y + (up < 0 ? -1 : 0), 1, 1);
    ctx.fillRect(x - 2, y + up, 1, 1);
    ctx.fillRect(x + 2, y + up, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// Dans la couche additive
function drawAmbienceGlow(ctx, cx, cy, W, Hh) {
  for (const m of Amb.motes) {
    const x = ambX(m, cx), y = ambY(m, cy);
    if (x < -4 || y < -4 || x > W + 4 || y > Hh + 4) continue;
    ctx.globalAlpha = Math.min(1, (m.life / m.max) * 2) * (m.cyan ? 0.9 : 0.75);
    ctx.fillStyle = m.cyan ? '#7fe8ff' : '#9a3cff';
    if (m.cyan && m.life > m.max * 0.5) {
      // petite étoile en croix
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    } else ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
