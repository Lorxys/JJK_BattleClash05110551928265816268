'use strict';

// ---------------------------------------------------------------------------
// Les techniques de Gojo : Bleu, Rouge, Violet (Bleu + Rouge), téléportation
// ---------------------------------------------------------------------------
const effects = [];
const FX = { shake: 0, flash: 0, flashRgb: '255,255,255' };
const addShake = (m) => { FX.shake = Math.max(FX.shake, m); };
const addFlash = (rgb, a) => { FX.flash = Math.max(FX.flash, a); FX.flashRgb = rgb; };

const CD = { blue: 0, red: 0, purple: 0, dash: 0, melee: 0 };
const CD_MAX = { blue: 1.2, red: 1.4, purple: 6, dash: 0.8, melee: 0.12 };
const COST = { blue: 12, red: 12, purple: 35, dash: 6, melee: 6 };
const PURPLE_CHARGE = 1.0;
const BLUE_RANGE = 9;

function tickCooldowns(dt) {
  // dans son territoire, Gojo enchaîne ses techniques trois fois plus vite
  const k = Player.inDomain ? 3 : 1;
  for (const key in CD) CD[key] = Math.max(0, CD[key] - dt * k);
  Melee.t += dt;
  if (Melee.queued && CD.melee <= 0) melee();
}

function spendEnergy(cost) {
  if (Player.inDomain) return true;
  if (Player.energy < cost) {
    Game.noEnergyT = 0.5;
    Sfx.fizzle();
    return false;
  }
  Player.energy -= cost;
  Player.energyDelay = 0.6;
  return true;
}

function drawGlowOrb(ctx, sx, sy, core, glowR, inner, mid) {
  if (glowR <= 0.5) return;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
  g.addColorStop(0, inner);
  g.addColorStop(clamp(core / glowR, 0.05, 0.95), mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
  ctx.fill();
}

// Onde de choc : anneau qui s'étend au sol
class Shockwave {
  constructor(x, y, z, color, R, dur = 0.45) {
    Object.assign(this, { x, y, z, color, R, dur, t: 0 });
  }
  update(dt) {
    this.t += dt;
    return this.t < this.dur;
  }
  drawOverlay(ctx, cx, cy) {
    const k = this.t / this.dur, r = this.R * (0.2 + 0.8 * Math.sqrt(k));
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(isoX(this.x, this.y) - cx, isoY(this.x, this.y, this.z) - cy, r * 22.6, r * 11.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Image rémanente laissée par la téléportation
class Ghost {
  constructor(spr, x, y, z, delay) {
    Object.assign(this, { spr, x, y, z, t: -delay });
  }
  update(dt) {
    this.t += dt;
    return this.t < 0.35;
  }
  drawOverlay(ctx, cx, cy) {
    if (this.t < 0) return;
    ctx.globalAlpha = (1 - this.t / 0.35) * 0.5;
    drawGojoSprite(ctx, this.spr, Math.round(isoX(this.x, this.y) - cx), Math.round(isoY(this.x, this.y, this.z) - cy));
    ctx.globalAlpha = 1;
  }
}

// --- Bleu (Ao) : attraction puis écrasement ----------------------------------------
class BlueOrb {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.z = groundAt(x, y) + 2;
    this.t = 0;
    this.dur = 2.0;
    this.R = 4.6;
    this.digs = [0.5, 1.2];
    this.done = false;
  }
  update(dt) {
    if (this.done) return false;
    this.t += dt;
    const R = this.R * Math.min(1, this.t / 0.3);
    const { x, y, z } = this;
    const damp = Math.pow(0.15, dt);

    // débris aspirés en spirale
    for (const p of particles) {
      const dx = x - p.x, dy = y - p.y, dz = (z - p.z) * 0.5;
      const d = Math.hypot(dx, dy, dz) + 0.01;
      if (d > R) continue;
      const s = 10 + 40 * (1 - d / R);
      p.vx += ((dx / d) * s - (dy / d) * s * 0.8) * dt;
      p.vy += ((dy / d) * s + (dx / d) * s * 0.8) * dt;
      p.vz += (dz / d) * s * 2 * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.vz *= damp;
      p.float = true;
      if (p.life < 1) p.life = 1;
    }

    // le sol (ou l'eau) est arraché morceau par morceau
    const n = Math.floor(70 * dt + Math.random());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R * 0.8;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      const t = typeAt(px, py);
      if (t < 0) continue;
      spawnParticle(px, py, groundAt(px, py) + 0.1, 0, 0, rnd(2, 6), pick(DEBRIS[t]), Math.random() < 0.4 ? 2 : 1, t === T_WATER ? 2.5 : 4);
    }
    while (this.digs.length && this.t >= this.digs[0]) {
      this.digs.shift();
      damageTerrain(x, y, 1.2 + this.t, 1, T_DIRT, 0.5);
    }
    // les flammes sont aspirées : le feu s'éteint
    extinguishArea(x, y, R * 0.6);

    // arbres, rochers et sanctuaires arrachés
    for (const o of World.objects) {
      if (o.dead) continue;
      const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy) + 0.01;
      if (d > R * 0.9) continue;
      o.shake = 0.25;
      o.hp -= dt * (1.2 + 3 * (1 - d / R));
      if (o.hp <= 0) {
        if (o.kind === 'bush') shatterObject(o, 3);
        else uprootObject(o, (dx / d) * 3, (dy / d) * 3, 6, rnd(-6, 6));
      }
    }

    // ce qui vole est happé et tourne autour du point
    for (const f of flyers) {
      const dx = x - f.x, dy = y - f.y, dz = (z - f.z) * 0.5;
      const d = Math.hypot(dx, dy, dz) + 0.01;
      if (d > R * 1.2) continue;
      const s = 14 + 30 * (1 - d / (R * 1.2));
      f.vx += ((dx / d) * s - (dy / d) * s * 0.6) * dt;
      f.vy += ((dy / d) * s + (dx / d) * s * 0.6) * dt;
      f.vz += (dz / d) * s * 2 * dt;
      f.vx *= Math.pow(0.2, dt);
      f.vy *= Math.pow(0.2, dt);
      f.vz *= Math.pow(0.2, dt);
      f.hold = true;
      f.burning = false;
      f.life = Math.max(f.life, 1);
      f.spin = clamp(f.spin + (f.spin >= 0 ? 1 : -1) * dt * 10, -20, 20);
    }

    // les fléaux aussi
    for (const c of curses) {
      if (c.dead || c.spawnT > 0) continue;
      const dx = x - c.x, dy = y - c.y, dz = (z - c.z - 0.8) * 0.5;
      const d = Math.hypot(dx, dy, dz) + 0.01;
      if (d > R) continue;
      const s = (14 + 30 * (1 - d / R)) * (c.type === 'brute' ? 0.3 : 1);
      c.vx += ((dx / d) * s - (dy / d) * s * 0.6) * dt;
      c.vy += ((dy / d) * s + (dx / d) * s * 0.6) * dt;
      c.vz += (dz / d) * s * 2 * dt;
      c.vx *= Math.pow(0.2, dt);
      c.vy *= Math.pow(0.2, dt);
      c.vz *= Math.pow(0.2, dt);
      c.held = true;
      c.air = true;
      if (d < 1.6) damageCurse(c, 5 * dt);
    }

    addShake(1.5);
    if (this.t >= this.dur) {
      this.implode();
      return false;
    }
    return true;
  }
  implode() {
    const { x, y, z, R } = this;
    scareBirds(x, y);
    damageTerrain(x, y, 2.8, 1, T_DIRT, 0.6);
    for (const f of flyers) if (Math.hypot(x - f.x, y - f.y, (z - f.z) * 0.5) < R * 1.2) breakFlyer(f, 6);
    for (const p of particles) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) + 0.01;
      if (d > R) continue;
      const s = rnd(2, 9);
      p.vx = (dx / d) * s;
      p.vy = (dy / d) * s;
      p.vz = rnd(2, 8);
    }
    for (const c of curses) {
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy, (c.z - z) * 0.5) + 0.01;
      if (c.dead || d > R) continue;
      damageCurse(c, 6 + 14 * (1 - d / R), (dx / d) * 6, (dy / d) * 6, 6);
    }
    for (let k = 0; k < 90; k++) {
      const a = rnd(0, Math.PI * 2), s = rnd(4, 14);
      spawnSpark(x, y, z, Math.cos(a) * s, Math.sin(a) * s, rnd(-4, 4), pick(BLUE_SPARKS), rnd(0.3, 0.7));
    }
    effects.push(new Shockwave(x, y, groundAt(x, y), '#7cc4ff', 3.5));
    addShake(7);
    addFlash('120,190,255', 0.25);
    Sfx.boom(0.6);
  }
  drawGlow(ctx, cx, cy) {
    const k = Math.min(1, this.t / 0.3);
    const sx = isoX(this.x, this.y) - cx, sy = isoY(this.x, this.y, this.z) - cy;
    const pulse = Math.sin(this.t * 25) * 1.2;
    drawGlowOrb(ctx, sx, sy, (5 + pulse) * k, 26 * k, 'rgba(235,248,255,1)', 'rgba(60,150,255,0.85)');
    ctx.fillStyle = '#9fd4ff';
    for (let n = 0; n < 18; n++) {
      const a = -this.t * 9 + (n * Math.PI) / 9, rr = (12 + (n % 3) * 5) * k * (1 - (this.t / this.dur) * 0.4);
      ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr * 0.5), 1, 1);
    }
  }
}

// --- Rouge (Aka) : projectile qui explose et repousse tout --------------------------
class RedShot {
  constructor(x, y, z, dx, dy) {
    Object.assign(this, { x, y, z, dx, dy, dist: 0, t: 0, speed: 20, range: 14 });
  }
  update(dt) {
    this.t += dt;
    const steps = 3, st = (this.speed * dt) / steps;
    for (let s = 0; s < steps; s++) {
      this.x += this.dx * st;
      this.y += this.dy * st;
      this.dist += st;
      // Rouge qui traverse un Bleu : les deux fusionnent en Violet
      for (const e of effects) {
        if (e instanceof BlueOrb && !e.done && Math.hypot(e.x - this.x, e.y - this.y) < 1.8) {
          fusePurple(e, this);
          return false;
        }
      }
      if (this.hits()) {
        redExplosion(this.x, this.y, this.z);
        return false;
      }
    }
    for (let k = 0; k < 4; k++) spawnSpark(this.x, this.y, this.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), pick(RED_SPARKS), 0.3);
    return true;
  }
  hits() {
    if (this.dist >= this.range) return true;
    if (groundAt(this.x, this.y) > this.z - 0.5) return true;
    for (const o of World.objects) {
      if (!o.dead && o.kind !== 'bush' && (o.x - this.x) ** 2 + (o.y - this.y) ** 2 < 0.36) return true;
    }
    for (const c of curses) {
      if (!c.dead && c.spawnT <= 0 && (c.x - this.x) ** 2 + (c.y - this.y) ** 2 < 0.5 && Math.abs(c.z + 0.8 - this.z) < 2) return true;
    }
    return false;
  }
  drawGlow(ctx, cx, cy) {
    const sx = isoX(this.x, this.y) - cx, sy = isoY(this.x, this.y, this.z) - cy;
    drawGlowOrb(ctx, sx, sy, 4, 14, 'rgba(255,240,220,1)', 'rgba(255,60,40,0.9)');
  }
}

function redExplosion(x, y, z) {
  scareBirds(x, y, 12);
  const R = 4;
  for (const o of World.objects) {
    if (o.dead) continue;
    const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) + 0.01;
    if (d > R) continue;
    const f = 1 - d / R, s = 6 + 16 * f;
    if (o.kind === 'bush' || (o.kind === 'rock' && f > 0.4)) shatterObject(o, 4 + 6 * f);
    else uprootObject(o, (dx / d) * s, (dy / d) * s, 5 + 10 * f, rnd(-10, 10), Math.random() < 0.4);
  }
  for (const fl of flyers) {
    const dx = fl.x - x, dy = fl.y - y, d = Math.hypot(dx, dy) + 0.01;
    if (d > R * 1.5) continue;
    const s = (1 - d / (R * 1.5)) * 18;
    fl.vx += (dx / d) * s;
    fl.vy += (dy / d) * s;
    fl.vz += s * 0.6;
  }
  for (const p of particles) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) + 0.01;
    if (d > R) continue;
    const s = (1 - d / R) * 16;
    p.vx += (dx / d) * s;
    p.vy += (dy / d) * s;
    p.vz += s * 0.8;
  }
  for (const c of curses) {
    if (c.dead || c.spawnT > 0) continue;
    const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy) + 0.01;
    if (d > R + 0.5) continue;
    const f = Math.max(0, 1 - d / (R + 0.5));
    damageCurse(c, 6 + 26 * f, (dx / d) * (6 + 12 * f), (dy / d) * (6 + 12 * f), 6 + 8 * f);
  }
  damageTerrain(x, y, 3.2, 2, T_BURNT, 1.2);
  // la chaleur enflamme l'herbe et les arbres autour du cratère
  igniteRing(x, y, 2.6, R + 1.5, 0.35);
  for (let k = 0; k < 150; k++) {
    const a = rnd(0, Math.PI * 2), s = rnd(3, 16);
    spawnSpark(x, y, z, Math.cos(a) * s, Math.sin(a) * s, rnd(-1, 1) * s * 1.5, pick(RED_SPARKS), rnd(0.3, 0.8), Math.random() < 0.3 ? 2 : 1);
  }
  effects.push(new Shockwave(x, y, Math.max(groundAt(x, y), z - 1.5), '#ff6a4a', 5));
  addShake(10);
  addFlash('255,90,60', 0.3);
  Sfx.boom(1);
}

// --- Violet (Murasaki) : sphère qui efface tout sur son passage --------------------
class PurpleSphere {
  constructor(x, y, z, dx, dy) {
    Object.assign(this, { x, y, z, dx, dy, R: 2.4, t: 0, dist: 0, maxDist: 46, end: -1 });
  }
  update(dt) {
    this.t += dt;
    if (this.end >= 0) {
      this.end += dt;
      return this.end < 0.6;
    }
    const step = Math.min(13, 2 + this.t * 22) * dt;
    this.x += this.dx * step;
    this.y += this.dy * step;
    this.dist += step;
    const { x, y, z, R } = this;
    carveSphere(x, y, R);
    for (const o of World.objects) if (!o.dead && Math.hypot(o.x - x, o.y - y) < R + 0.4) vaporizeObject(o);
    for (const f of flyers) {
      if (f.dead || Math.hypot(f.x - x, f.y - y) > R + 0.6) continue;
      f.dead = true;
      for (let k = 0; k < 10; k++) spawnSpark(f.x, f.y, f.z, rnd(-2, 2), rnd(-2, 2), rnd(-2, 2), pick(PURPLE_SPARKS), rnd(0.4, 0.9));
    }
    for (const c of curses) if (!c.dead && Math.hypot(c.x - x, c.y - y) < R + 0.5) killCurse(c, true);
    for (const p of particles) if (Math.hypot(p.x - x, p.y - y) < R) p.life = 0;
    for (let k = 0; k < 8; k++) {
      const a = rnd(0, Math.PI * 2);
      spawnSpark(x + Math.cos(a) * R, y + Math.sin(a) * R, z + rnd(-1, 1) * R * 1.5, -Math.cos(a) * 2, -Math.sin(a) * 2, 0, pick(PURPLE_SPARKS), rnd(0.3, 0.7));
    }
    addShake(3);
    if (this.dist > this.maxDist) {
      this.end = 0;
      addFlash('200,120,255', 0.35);
      Sfx.boom(0.7);
    }
    return true;
  }
  drawGlow(ctx, cx, cy) {
    let k = Math.min(1, this.t / 0.15);
    if (this.end >= 0) k *= 1 - this.end / 0.6;
    const sx = isoX(this.x, this.y) - cx, sy = isoY(this.x, this.y, this.z) - cy;
    const r = this.R * 16 * k;
    drawGlowOrb(ctx, sx, sy, r * 0.75, r * 1.5, 'rgba(255,235,255,1)', 'rgba(150,60,255,0.9)');
    ctx.fillStyle = '#f0d8ff';
    for (let n = 0; n < 40; n++) {
      const a = this.t * 6 + n * 0.628, rr = r * (0.8 + 0.2 * Math.sin(n * 1.7 + this.t * 10));
      ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr), 1, 1);
    }
  }
}

function firePurple(x, y, z, dx, dy) {
  effects.push(new PurpleSphere(x, y, z, dx, dy));
  scareBirds(x, y, 16);
  addShake(12);
  addFlash('210,150,255', 0.6);
  Sfx.purple();
  showBanner('虚式「茈」', 'Technique inversée : Violet', 'purple', 1.6);
}

// Fusion dans le monde : un Rouge tiré dans un Bleu actif
function fusePurple(orb, shot) {
  orb.done = true;
  for (let k = 0; k < 60; k++) {
    const a = rnd(0, Math.PI * 2), s = rnd(2, 10);
    spawnSpark(orb.x, orb.y, orb.z, Math.cos(a) * s, Math.sin(a) * s, rnd(-3, 3), pick(k & 1 ? BLUE_SPARKS : RED_SPARKS), rnd(0.3, 0.6));
  }
  firePurple(orb.x, orb.y, orb.z, shot.dx, shot.dy);
}

// --- Lancement des techniques -------------------------------------------------------
function castBlue(tx, ty) {
  if (CD.blue > 0 || Player.charging || !spendEnergy(COST.blue)) return;
  const dx = tx - Player.x, dy = ty - Player.y, d = Math.hypot(dx, dy);
  if (d > BLUE_RANGE) {
    tx = Player.x + (dx / d) * BLUE_RANGE;
    ty = Player.y + (dy / d) * BLUE_RANGE;
  }
  facePoint(tx, ty);
  effects.push(new BlueOrb(tx, ty));
  CD.blue = CD_MAX.blue;
  Sfx.blue();
}

function castRed(tx, ty) {
  if (CD.red > 0 || Player.charging || !spendEnergy(COST.red)) return;
  let dx = tx - Player.x, dy = ty - Player.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  facePoint(tx, ty);
  effects.push(new RedShot(Player.x + dx * 0.6, Player.y + dy * 0.6, Player.z + 1.6, dx, dy));
  CD.red = CD_MAX.red;
  Sfx.red();
}

// Bleu + Rouge en même temps : Gojo réunit les deux dans ses mains
function startPurple() {
  if (CD.purple > 0 || Player.charging) return;
  if (!Player.inDomain && Player.energy < COST.purple) {
    Game.noEnergyT = 0.5;
    Sfx.fizzle();
    return;
  }
  Player.charging = true;
  Player.chargeT = 0;
  Sfx.charge();
}

function releasePurple(tx, ty) {
  if (!Player.charging) return;
  Player.charging = false;
  if (Player.chargeT < PURPLE_CHARGE || !spendEnergy(COST.purple)) {
    Sfx.fizzle();
    return;
  }
  let dx = tx - Player.x, dy = ty - Player.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  facePoint(tx, ty);
  firePurple(Player.x + dx * 3, Player.y + dy * 3, Player.z + 1.8, dx, dy);
  CD.purple = CD_MAX.purple;
  CD.blue = Math.max(CD.blue, CD_MAX.blue);
  CD.red = Math.max(CD.red, CD_MAX.red);
}

function dash(tx, ty) {
  if (CD.dash > 0 || !spendEnergy(COST.dash)) return;
  let dx = Player.lastMx, dy = Player.lastMy;
  if (!Player.moving) {
    dx = tx - Player.x;
    dy = ty - Player.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
  }
  const D = 4, spr = playerSprite();
  for (let k = 0; k < 5; k++) {
    effects.push(new Ghost(spr, Player.x + (dx * D * k) / 5, Player.y + (dy * D * k) / 5, Player.z, k * 0.03));
  }
  for (let k = 0; k < 30; k++) {
    spawnSpark(Player.x, Player.y, Player.z + rnd(0, 3), rnd(-3, 3), rnd(-3, 3), rnd(-2, 2), pick(CYAN_SPARKS), rnd(0.2, 0.5));
  }
  Player.x = clamp(Player.x + dx * D, 0.5, MAP_W - 0.5);
  Player.y = clamp(Player.y + dy * D, 0.5, MAP_H - 0.5);
  CD.dash = CD_MAX.dash;
  Sfx.whoosh();
}

// --- Frappe : Gojo se téléporte sur le fléau le plus proche et le roue de coups ----
// Chaque appui enchaîne un coup qui le paralyse ; le 5e est un Black Flash (黒閃).
const MELEE_RANGE = 10;    // portée de la téléportation
const MELEE_REACH = 2.2;   // au-delà, il faut se téléporter de nouveau
const COMBO_WINDOW = 0.9;  // délai max entre deux appuis pour garder le combo
const COMBO_FINISH = 5;
const Melee = { target: null, hits: 0, t: 99, queued: false };
const BLACK_FLASH_SPARKS = ['#ff2030', '#ff5060', '#c00818', '#ffd0d8'];

function nearestCurse(x, y, range) {
  let best = null, bd = range;
  for (const c of curses) {
    if (c.dead || c.spawnT > 0) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// Éclairs noirs et rouges autour de l'impact
class BlackFlash {
  constructor(x, y, z) {
    Object.assign(this, { x, y, z, t: 0 });
  }
  update(dt) {
    this.t += dt;
    return this.t < 0.35;
  }
  drawOverlay(ctx, cx, cy) {
    const sx = isoX(this.x, this.y) - cx, sy = isoY(this.x, this.y, this.z) - cy, k = 1 - this.t / 0.35;
    for (let b = 0; b < 7; b++) {
      const a = rnd(0, Math.PI * 2), len = rnd(16, 40) * k;
      let x = sx, y = sy;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 1; s <= 5; s++) {
        x = sx + Math.cos(a) * (len * s) / 5 + rnd(-4, 4);
        y = sy + Math.sin(a) * (len * s) / 10 + rnd(-4, 4);
        ctx.lineTo(x, y);
      }
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#08000a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#ff2a3a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function blinkTo(c) {
  const P = Player;
  let dx = P.x - c.x, dy = P.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const spr = playerSprite(), tx = c.x + dx * 0.9, ty = c.y + dy * 0.9;
  for (let k = 0; k < 4; k++) {
    effects.push(new Ghost(spr, lerp(P.x, tx, k / 4), lerp(P.y, ty, k / 4), P.z, k * 0.025));
  }
  for (let k = 0; k < 24; k++) {
    spawnSpark(P.x, P.y, P.z + rnd(0, 3), rnd(-3, 3), rnd(-3, 3), rnd(-2, 2), pick(CYAN_SPARKS), rnd(0.2, 0.4));
  }
  P.x = clamp(tx, 0.5, MAP_W - 0.5);
  P.y = clamp(ty, 0.5, MAP_H - 0.5);
  P.z = groundAt(P.x, P.y);
  Sfx.whoosh();
}

function melee() {
  if (Player.charging) return;
  // appui trop rapide : mémorisé et joué dès que possible, aucun coup n'est perdu
  if (CD.melee > 0) {
    Melee.queued = true;
    return;
  }
  Melee.queued = false;
  const M = Melee;
  if (M.t > COMBO_WINDOW) M.hits = 0;
  let c = M.target;
  if (!c || c.dead || Math.hypot(c.x - Player.x, c.y - Player.y) > MELEE_REACH) {
    c = nearestCurse(Player.x, Player.y, MELEE_RANGE);
    if (!c) {
      Sfx.fizzle();
      return;
    }
    if (!spendEnergy(COST.melee)) return;
    blinkTo(c);
  }
  M.target = c;
  M.t = 0;
  M.hits++;
  strike(c, M.hits % COMBO_FINISH === 0);
  CD.melee = M.hits % COMBO_FINISH === 0 ? 0.45 : CD_MAX.melee;
}

function strike(c, finisher) {
  const P = Player;
  const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx, dy) || 1;
  facePoint(c.x, c.y);
  P.punchT = finisher ? 0.3 : 0.16;
  P.punchDir = dx - dy >= 0 ? 'right' : 'left';
  const hx = c.x - (dx / d) * 0.3, hy = c.y - (dy / d) * 0.3, hz = c.z + (CURSE_TYPES[c.type].float ? 0.6 : 1.2);
  if (finisher) {
    // Black Flash : l'énergie occulte frappe dans le même millionième de seconde que le poing
    c.stunT = 0.5;
    damageCurse(c, 18, (dx / d) * 14, (dy / d) * 14, 9);
    for (const o of curses) {
      const od = Math.hypot(o.x - c.x, o.y - c.y);
      if (o !== c && !o.dead && od < 2) damageCurse(o, 6, ((o.x - c.x) / (od + 0.01)) * 8, ((o.y - c.y) / (od + 0.01)) * 8, 5);
    }
    for (let k = 0; k < 70; k++) {
      const a = rnd(0, Math.PI * 2), s = rnd(3, 13);
      spawnSpark(hx, hy, hz, Math.cos(a) * s, Math.sin(a) * s, rnd(-3, 6), pick(BLACK_FLASH_SPARKS), rnd(0.25, 0.6), Math.random() < 0.3 ? 2 : 1);
    }
    effects.push(new BlackFlash(hx, hy, hz));
    effects.push(new Shockwave(c.x, c.y, groundAt(c.x, c.y), '#ff2a3a', 2.4, 0.35));
    addShake(9);
    addFlash('40,0,8', 0.45);
    Game.hitStop = 0.09;
    Sfx.punch(true);
    showBanner('黒閃', 'Black Flash', 'flash', 0.9);
    if (navigator.vibrate) navigator.vibrate(40);
  } else {
    // coup normal : le fléau reste paralysé tant que le combo continue
    c.stunT = Math.max(c.stunT || 0, 1.2);
    damageCurse(c, 3 + Math.min(Melee.hits, 10) * 0.25, (dx / d) * 0.8, (dy / d) * 0.8, 0);
    for (let k = 0; k < 14; k++) {
      const a = rnd(0, Math.PI * 2), s = rnd(2, 7);
      spawnSpark(hx, hy, hz, Math.cos(a) * s, Math.sin(a) * s, rnd(-2, 3), pick(k & 1 ? CYAN_SPARKS : ['#ffffff', '#e8f6ff']), rnd(0.15, 0.3));
    }
    effects.push(new Shockwave(hx, hy, hz - 0.8, '#ffffff', 0.7, 0.18));
    addShake(3);
    Game.hitStop = 0.035;
    Sfx.punch(false);
  }
}
