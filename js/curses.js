'use strict';

// ---------------------------------------------------------------------------
// Les fléaux : trois espèces, qui arrivent par vagues
// ---------------------------------------------------------------------------
const curses = [];
const cshots = []; // projectiles maudits tirés par les Œils

const CURSE_TYPES = {
  // Larve (4e grade) : petite, rapide, mord au contact
  larva: { name: 'Larve', hp: 4, speed: 3.0, rad: 0.3, dmg: 8, range: 1.5, cd: 1.0, gauge: 6, float: 0, shadow: 6 },
  // Œil (3e grade) : flotte et tire à distance
  eye: { name: 'Œil', hp: 6, speed: 2.4, rad: 0.3, dmg: 7, range: 10, cd: 2.4, gauge: 9, float: 1.6, shadow: 5 },
  // Colosse (2e grade) : lent, écrase tout sur son passage, frappe le sol
  brute: { name: 'Colosse', hp: 40, speed: 1.5, rad: 0.6, dmg: 22, range: 2.2, cd: 3, gauge: 25, float: 0, shadow: 14 },
};

function spawnCurse(type, x, y) {
  const def = CURSE_TYPES[type];
  curses.push({
    kind: 'curse', type, x, y, z: groundAt(x, y) + def.float, vx: 0, vy: 0, vz: 0,
    air: false, held: false, hp: def.hp, max: def.hp, atkT: rnd(0.5, def.cd), wind: 0,
    hitT: 0, frozen: false, stunT: 0, t: Math.random() * 10, spawnT: 0.7, dead: false,
  });
  for (let k = 0; k < 24; k++) {
    spawnSpark(x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), groundAt(x, y), 0, 0, rnd(1, 4), pick(CURSE_SPARKS), rnd(0.4, 0.9), 2);
  }
  effects.push(new Shockwave(x, y, groundAt(x, y), '#8a2a9a', 1.4, 0.6));
  Sfx.spawn();
}

function damageCurse(c, dmg, kx = 0, ky = 0, kz = 0) {
  if (c.dead) return;
  c.hp -= dmg;
  c.hitT = Math.max(c.hitT, 0.1);
  if (kx || ky || kz) {
    const m = c.type === 'brute' ? 0.35 : 1;
    c.vx += kx * m;
    c.vy += ky * m;
    c.vz += kz * m;
    if (kz * m > 1) c.air = true;
  }
  if (c.hp <= 0) killCurse(c);
}

function killCurse(c, vaporized = false) {
  if (c.dead) return;
  c.dead = true;
  Waves.kills++;
  Domain.gauge = Math.min(100, Domain.gauge + CURSE_TYPES[c.type].gauge);
  const big = c.type === 'brute' ? 3 : 1;
  const cols = vaporized ? PURPLE_SPARKS : CURSE_SPARKS;
  for (let k = 0; k < 30 * big; k++) {
    spawnSpark(c.x + rnd(-0.4, 0.4) * big, c.y + rnd(-0.4, 0.4) * big, c.z + rnd(0, 1.5 * big), rnd(-2, 2), rnd(-2, 2), rnd(1, 5), pick(cols), rnd(0.4, 1.1), 2);
  }
  if (!vaporized) spawnDebris(c.x, c.y, c.z + 0.5, 12 * big, ['#1e1626', '#33263f', '#120c18'], 4);
  Sfx.squish();
}

// true : bloqué par le bord, l'eau ou une falaise. Objet : bloqué par lui.
function curseBlocked(c, x, y) {
  if (x < 1 || y < 1 || x > MAP_W - 1 || y > MAP_H - 1) return true;
  const def = CURSE_TYPES[c.type];
  if (def.float) return false;
  if (typeAt(x, y) === T_WATER) return true;
  const i0 = Math.floor(x), j0 = Math.floor(y);
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      const o = objectAt(i, j);
      if (!o || o.dead || !o.rad) continue;
      const r = o.rad + def.rad;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 < r * r) return o;
    }
  }
  return false;
}

// Avance vers (mx, my) en contournant les obstacles. Le Colosse, lui, les écrase.
function moveCurse(c, mx, my, speed, dt, crush) {
  const l = Math.hypot(mx, my);
  if (!l) return;
  mx /= l;
  my /= l;
  const step = speed * dt;
  for (const a of [0, 0.7, -0.7, 1.4, -1.4]) {
    const cs = Math.cos(a), sn = Math.sin(a);
    const nx = c.x + (mx * cs - my * sn) * step, ny = c.y + (mx * sn + my * cs) * step;
    const blk = curseBlocked(c, nx, ny);
    if (!blk) {
      c.x = nx;
      c.y = ny;
      return;
    }
    if (crush && blk !== true) {
      shatterObject(blk, 5);
      addShake(3);
      Sfx.boom(0.3);
      return;
    }
  }
}

function bruteSlam(c) {
  const dx = Player.x - c.x, dy = Player.y - c.y, d = Math.hypot(dx, dy) + 0.01;
  const x = c.x + (dx / d) * 1.2, y = c.y + (dy / d) * 1.2;
  damageTerrain(x, y, 2.2, 1, T_DIRT, 0.8);
  scareBirds(x, y);
  for (const o of World.objects) {
    if (o.dead) continue;
    const ox = o.x - x, oy = o.y - y, od = Math.hypot(ox, oy) + 0.01;
    if (od < 2.6) uprootObject(o, (ox / od) * 7, (oy / od) * 7, 7, rnd(-8, 8));
  }
  for (const other of curses) {
    if (other === c || other.dead) continue;
    const od = Math.hypot(other.x - x, other.y - y);
    if (od < 2.4) damageCurse(other, 5, ((other.x - x) / (od + 0.01)) * 5, ((other.y - y) / (od + 0.01)) * 5, 5);
  }
  effects.push(new Shockwave(x, y, groundAt(x, y), '#c8b8a0', 3));
  addShake(8);
  Sfx.slam();
  if (Math.hypot(Player.x - x, Player.y - y) < 2.6) hurtGojo(CURSE_TYPES.brute.dmg);
}

// Cercle rouge au sol qui annonce le coup du Colosse
class SlamWarning {
  constructor(c) {
    this.c = c;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    return !this.c.dead && this.c.wind > 0;
  }
  drawOverlay(ctx, cx, cy) {
    const c = this.c, dx = Player.x - c.x, dy = Player.y - c.y, d = Math.hypot(dx, dy) + 0.01;
    const x = c.x + (dx / d) * 1.2, y = c.y + (dy / d) * 1.2;
    const sx = isoX(x, y) - cx, sy = isoY(x, y, groundAt(x, y)) - cy, k = Math.min(1, this.t / 0.8);
    ctx.globalAlpha = 0.25 + 0.35 * k;
    ctx.fillStyle = '#ff3030';
    pxEllipse(ctx, sx, sy, 2.6 * 22.6 * k, 2.6 * 11.3 * k);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ff6060';
    pxRing(ctx, sx, sy, 2.6 * 22.6, 2.6 * 11.3);
    ctx.globalAlpha = 1;
  }
}

function aiCurse(c, def, dt) {
  const P = Player;
  const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy) + 1e-3;
  c.atkT -= dt;
  if (c.type === 'eye') {
    // garde ses distances en tournant autour de Gojo
    const want = d > 7 ? 1 : d < 5 ? -1 : 0;
    moveCurse(c, (dx / d) * want - (dy / d) * 0.5, (dy / d) * want + (dx / d) * 0.5, def.speed, dt);
    if (c.atkT <= 0 && d < def.range) {
      c.atkT = def.cd;
      cshots.push({ x: c.x, y: c.y, z: c.z + 0.6, dx: dx / d, dy: dy / d, life: 3, stop: 0, dead: false });
      Sfx.curseShot();
    }
  } else if (c.type === 'larva') {
    if (d > def.range) {
      moveCurse(c, dx, dy, def.speed * (0.6 + 0.8 * Math.abs(Math.sin(c.t * 6))), dt);
    } else if (c.atkT <= 0) {
      c.atkT = def.cd;
      hurtGojo(def.dmg);
      // repoussée par l'Infinité
      c.vx -= (dx / d) * 4;
      c.vy -= (dy / d) * 4;
    }
  } else {
    if (c.wind > 0) {
      c.wind -= dt;
      if (c.wind <= 0) bruteSlam(c);
      return;
    }
    if (d > def.range) moveCurse(c, dx, dy, def.speed, dt, true);
    else if (c.atkT <= 0) {
      c.atkT = def.cd;
      c.wind = 0.8;
      effects.push(new SlamWarning(c));
    }
  }
}

function updateCurses(dt) {
  for (const c of curses) {
    if (c.dead) continue;
    const def = CURSE_TYPES[c.type];
    c.t += dt;
    c.hitT -= dt;
    if (c.spawnT > 0) {
      c.spawnT -= dt;
      continue;
    }
    // Sphère de l'Infini : submergé d'informations, le fléau ne peut plus rien faire
    c.frozen = inDomain(c.x, c.y);
    if (c.frozen) {
      c.vx = c.vy = c.vz = 0;
      c.wind = 0;
      damageCurse(c, 5 * dt);
      continue;
    }

    // physique
    const g = groundAt(c.x, c.y);
    if (def.float) {
      const target = g + def.float + Math.sin(c.t * 3) * 0.2;
      if (!c.held) c.vz += (target - c.z) * 8 * dt;
      c.vz *= Math.pow(0.05, dt);
      c.air = false;
    } else if (c.air || c.held || c.z > g + 0.05) {
      if (!c.held) c.vz -= GRAVITY * dt;
      c.air = true;
    }
    c.held = false;
    const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (c.air || def.float) {
      c.x = nx;
      c.y = ny;
    } else {
      if (!curseBlocked(c, nx, c.y)) c.x = nx;
      if (!curseBlocked(c, c.x, ny)) c.y = ny;
    }
    c.z += c.vz * dt;
    const g2 = groundAt(c.x, c.y);
    if (!def.float && c.z <= g2) {
      if (c.air && -c.vz > 9) damageCurse(c, (-c.vz - 9) * 1.2); // chute
      c.air = false;
      c.z = g2;
      c.vz = 0;
    }
    const fr = Math.pow(c.air ? 0.6 : 0.004, dt);
    c.vx *= fr;
    c.vy *= fr;
    if (c.z < -20) {
      killCurse(c); // tombé de l'île
      continue;
    }

    // le décor s'en mêle
    if (!def.float && typeAt(c.x, c.y) === T_WATER) {
      damageCurse(c, 18 * dt);
      if (Math.random() < dt * 8) splash(c.x, c.y, 2);
    }
    if (!def.float && isBurning(c.x, c.y)) damageCurse(c, 6 * dt);
    for (const f of flyers) {
      if (f.dead) continue;
      const sp = Math.hypot(f.vx, f.vy, f.vz);
      if (sp < 5 || (c.x - f.x) ** 2 + (c.y - f.y) ** 2 > 0.9 || Math.abs(f.z - c.z - 1) > 2.5) continue;
      damageCurse(c, 6 + sp * 0.6, f.vx * 0.5, f.vy * 0.5, 4);
      breakFlyer(f);
    }
    // les fléaux ne se marchent pas dessus, et l'Infinité les tient à distance
    for (const o of curses) {
      if (o === c || o.dead) continue;
      const ox = c.x - o.x, oy = c.y - o.y, od = Math.hypot(ox, oy);
      const min = def.rad + CURSE_TYPES[o.type].rad;
      if (od > 0.01 && od < min) {
        c.x += (ox / od) * (min - od) * 0.5;
        c.y += (oy / od) * (min - od) * 0.5;
      }
    }
    const px = c.x - Player.x, py = c.y - Player.y, pd = Math.hypot(px, py);
    if (pd > 0.01 && pd < INFINITY_R && !(c.stunT > 0)) {
      c.x += (px / pd) * (INFINITY_R - pd) * 0.3;
      c.y += (py / pd) * (INFINITY_R - pd) * 0.3;
    }
    if (c.dead || c.air) continue;
    // un fléau coincé loin de Gojo finit par resurgir près de lui
    c.far = pd > 22 ? (c.far || 0) + dt : 0;
    if (c.far > 6) {
      const at = findSpawn();
      if (at) {
        c.x = at[0];
        c.y = at[1];
        c.z = groundAt(c.x, c.y) + def.float;
        c.spawnT = 0.7;
      }
      c.far = 0;
      continue;
    }
    // paralysé par les coups de Gojo : il ne bouge plus et n'attaque plus
    if (c.stunT > 0) {
      c.stunT -= dt;
      c.wind = 0;
      continue;
    }
    aiCurse(c, def, dt);
  }
  for (let k = curses.length - 1; k >= 0; k--) if (curses[k].dead) curses.splice(k, 1);
  updateCurseShots(dt);
}

function updateCurseShots(dt) {
  const P = Player;
  for (const s of cshots) {
    if (s.dead) continue;
    if (s.stop > 0) {
      // arrêté net par l'Infinité, puis il se dissipe
      s.stop -= dt;
      if (s.stop <= 0) {
        s.dead = true;
        for (let k = 0; k < 8; k++) spawnSpark(s.x, s.y, s.z, rnd(-2, 2), rnd(-2, 2), rnd(-2, 2), pick(CYAN_SPARKS), 0.3);
      }
      continue;
    }
    s.x += s.dx * 7 * dt;
    s.y += s.dy * 7 * dt;
    s.life -= dt;
    if (Math.random() < dt * 30) spawnSpark(s.x, s.y, s.z, 0, 0, 0, pick(CURSE_SPARKS), 0.3, 1);
    const d = Math.hypot(s.x - P.x, s.y - P.y, (s.z - P.z - 1.6) * 0.5);
    if (d < INFINITY_R) {
      if (hurtGojo(CURSE_TYPES.eye.dmg)) s.stop = 0.5;
      else s.dead = true;
      continue;
    }
    const o = objectAt(Math.floor(s.x), Math.floor(s.y));
    const hitObj = o && !o.dead && o.kind !== 'bush' && (o.x - s.x) ** 2 + (o.y - s.y) ** 2 < 0.25;
    if (hitObj) {
      o.shake = 0.3;
      o.hp -= 0.6;
      if (o.hp <= 0) shatterObject(o, 3);
    }
    if (hitObj || s.life <= 0 || groundAt(s.x, s.y) > s.z) {
      s.dead = true;
      for (let k = 0; k < 10; k++) spawnSpark(s.x, s.y, s.z, rnd(-2, 2), rnd(-2, 2), rnd(-1, 2), pick(CURSE_SPARKS), 0.4);
    }
  }
  for (let k = cshots.length - 1; k >= 0; k--) if (cshots[k].dead) cshots.splice(k, 1);
}

// --- Vagues -----------------------------------------------------------------------
const Waves = { n: 0, timer: 4, queue: [], spawnT: 0, kills: 0 };

function resetWaves() {
  Object.assign(Waves, { n: 0, timer: 4, queue: [], spawnT: 0, kills: 0 });
  curses.length = 0;
  cshots.length = 0;
}

function findSpawn() {
  for (let tries = 0; tries < 50; tries++) {
    const a = Math.random() * Math.PI * 2, r = rnd(12, 18);
    const x = Player.x + Math.cos(a) * r, y = Player.y + Math.sin(a) * r;
    if (x < 2 || y < 2 || x > MAP_W - 2 || y > MAP_H - 2) continue;
    if (typeAt(x, y) === T_WATER || isBlocked(x, y)) continue;
    return [x, y];
  }
  return null;
}

function startWave() {
  const n = ++Waves.n;
  const q = [];
  for (let k = 0; k < 3 + n * 2; k++) q.push('larva');
  for (let k = 0; k < (n >= 2 ? n - 1 + (n >> 1) : 0); k++) q.push('eye');
  for (let k = 0; k < (n >= 3 ? (n - 1) >> 1 : 0); k++) q.push('brute');
  for (let k = q.length - 1; k > 0; k--) {
    const m = (Math.random() * (k + 1)) | 0;
    [q[k], q[m]] = [q[m], q[k]];
  }
  Waves.queue = q;
  Waves.timer = 5;
  showBanner('呪霊襲来', `Vague ${n} · ${q.length} fléaux approchent`, 'wave', 2.4);
  Sfx.wave();
}

function updateWaves(dt) {
  if (Waves.queue.length) {
    Waves.spawnT -= dt;
    if (Waves.spawnT <= 0) {
      Waves.spawnT = 0.35;
      const at = findSpawn();
      if (at) spawnCurse(Waves.queue.shift(), at[0], at[1]);
    }
    return;
  }
  if (!curses.length) {
    Waves.timer -= dt;
    if (Waves.timer <= 0) startWave();
  }
}
