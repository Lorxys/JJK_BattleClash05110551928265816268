'use strict';

// ---------------------------------------------------------------------------
// Les techniques de Gojo : Bleu, Rouge, Violet, téléportation
// ---------------------------------------------------------------------------
const effects = [];
const FX = { shake: 0, flash: 0, flashRgb: '255,255,255' };
const addShake = (m) => { FX.shake = Math.max(FX.shake, m); };
const addFlash = (rgb, a) => { FX.flash = Math.max(FX.flash, a); FX.flashRgb = rgb; };

const CD = { blue: 0, red: 0, purple: 0, dash: 0 };
const CD_MAX = { blue: 1.2, red: 1.4, purple: 6, dash: 0.8 };
const PURPLE_CHARGE = 1.0;
const BLUE_RANGE = 9;

function tickCooldowns(dt) {
  for (const k in CD) CD[k] = Math.max(0, CD[k] - dt);
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
    ctx.drawImage(this.spr, Math.round(isoX(this.x, this.y) - cx - 9), Math.round(isoY(this.x, this.y, this.z) - cy - 28));
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
  }
  update(dt) {
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

    // le sol est arraché morceau par morceau
    const n = Math.floor(70 * dt + Math.random());
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R * 0.8;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      const i = Math.floor(px), j = Math.floor(py);
      if (!inMap(i, j)) continue;
      spawnParticle(px, py, groundAt(px, py) + 0.1, 0, 0, rnd(2, 6), pick(DEBRIS[World.T[j * MAP_W + i]]), Math.random() < 0.4 ? 2 : 1, 4);
    }
    while (this.digs.length && this.t >= this.digs[0]) {
      this.digs.shift();
      damageTerrain(x, y, 1.2 + this.t, 1, T_DIRT, 0.5);
    }

    // arbres et rochers déracinés
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
      f.life = Math.max(f.life, 1);
      f.spin = clamp(f.spin + (f.spin >= 0 ? 1 : -1) * dt * 10, -20, 20);
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
    const g = groundAt(this.x, this.y);
    if (g > this.z - 0.5) return true;
    for (const o of World.objects) {
      if (!o.dead && o.kind !== 'bush' && (o.x - this.x) ** 2 + (o.y - this.y) ** 2 < 0.36) return true;
    }
    return false;
  }
  drawGlow(ctx, cx, cy) {
    const sx = isoX(this.x, this.y) - cx, sy = isoY(this.x, this.y, this.z) - cy;
    drawGlowOrb(ctx, sx, sy, 4, 14, 'rgba(255,240,220,1)', 'rgba(255,60,40,0.9)');
  }
}

function redExplosion(x, y, z) {
  const R = 4;
  for (const o of World.objects) {
    if (o.dead) continue;
    const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) + 0.01;
    if (d > R) continue;
    const f = 1 - d / R, s = 6 + 16 * f;
    if (o.kind === 'bush' || (o.kind === 'rock' && f > 0.4)) shatterObject(o, 4 + 6 * f);
    else uprootObject(o, (dx / d) * s, (dy / d) * s, 5 + 10 * f, rnd(-10, 10));
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
  damageTerrain(x, y, 3.2, 2, T_BURNT, 1.2);
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
      const a = this.t * 6 + n * 0.157 * 4, rr = r * (0.8 + 0.2 * Math.sin(n * 1.7 + this.t * 10));
      ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(sy + Math.sin(a) * rr), 1, 1);
    }
  }
}

// --- Lancement des techniques -------------------------------------------------------
function castBlue(tx, ty) {
  if (CD.blue > 0 || Player.charging) return;
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
  if (CD.red > 0 || Player.charging) return;
  let dx = tx - Player.x, dy = ty - Player.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  facePoint(tx, ty);
  effects.push(new RedShot(Player.x + dx * 0.6, Player.y + dy * 0.6, Player.z + 1.6, dx, dy));
  CD.red = CD_MAX.red;
  Sfx.red();
}

function startPurple() {
  if (CD.purple > 0 || Player.charging) return;
  Player.charging = true;
  Player.chargeT = 0;
  Sfx.charge();
}

function releasePurple(tx, ty) {
  if (!Player.charging) return;
  Player.charging = false;
  if (Player.chargeT < PURPLE_CHARGE) {
    Sfx.fizzle();
    return;
  }
  let dx = tx - Player.x, dy = ty - Player.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  facePoint(tx, ty);
  effects.push(new PurpleSphere(Player.x + dx * 3, Player.y + dy * 3, Player.z + 1.8, dx, dy));
  CD.purple = CD_MAX.purple;
  addShake(12);
  addFlash('210,150,255', 0.6);
  Sfx.purple();
}

function dash(tx, ty) {
  if (CD.dash > 0) return;
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
