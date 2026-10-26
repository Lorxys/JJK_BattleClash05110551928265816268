'use strict';

// ---------------------------------------------------------------------------
// Satoru Gojo : déplacements, vie, énergie occulte et l'Infinité (passive)
// ---------------------------------------------------------------------------
const Player = {
  kind: 'player', x: 0, y: 0, z: 0, dir: 'down', moving: false, animT: 0,
  speed: 5.5, castT: 0, charging: false, chargeT: 0, inf: 0, lastMx: 0.707, lastMy: 0.707,
  hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, energyDelay: 0, hurtT: 0, sinceHurt: 99, inDomain: false,
  punchT: 0, punchDir: 'right',
};
const INFINITY_R = 1.3;

function resetPlayer() {
  Object.assign(Player, {
    x: MAP_W / 2 + 0.5, y: MAP_H / 2 + 0.5, dir: 'down', charging: false, chargeT: 0, castT: 0, inf: 0,
    hp: Player.maxHp, energy: Player.maxEnergy, energyDelay: 0, hurtT: 0, sinceHurt: 99, inDomain: false, punchT: 0,
  });
  Player.z = groundAt(Player.x, Player.y);
}

function isBlocked(x, y) {
  if (x < 0.4 || y < 0.4 || x > MAP_W - 0.4 || y > MAP_H - 0.4) return true;
  const i0 = Math.floor(x), j0 = Math.floor(y);
  for (let j = j0 - 1; j <= j0 + 1; j++) {
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      const o = objectAt(i, j);
      if (!o || o.dead || !o.rad) continue;
      const r = o.rad + 0.25;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 < r * r) return true;
    }
  }
  return false;
}

// Un coup qui touche Gojo : l'Infinité l'arrête tant qu'il reste de l'énergie.
// Renvoie true si le coup a été bloqué.
function hurtGojo(dmg) {
  const P = Player;
  if (Game.over) return true;
  if (P.inDomain || P.energy >= dmg * 0.6) {
    if (!P.inDomain) P.energy -= dmg * 0.6;
    P.energyDelay = 0.8;
    P.inf = 1;
    for (let k = 0; k < 8; k++) spawnSpark(P.x + rnd(-1, 1), P.y + rnd(-1, 1), P.z + rnd(0.5, 2.5), 0, 0, 0, pick(CYAN_SPARKS), 0.3);
    Sfx.block();
    return true;
  }
  P.energy = 0;
  P.hp -= dmg;
  P.hurtT = 0.4;
  P.sinceHurt = 0;
  addShake(6);
  addFlash('255,40,40', 0.25);
  Sfx.hurt();
  if (navigator.vibrate) navigator.vibrate(60);
  if (P.hp <= 0) {
    P.hp = 0;
    gameOver();
  }
  return false;
}

// Tourne Gojo vers un point du monde (le temps de lancer une technique)
function facePoint(tx, ty) {
  const dx = tx - Player.x, dy = ty - Player.y;
  const sx = dx - dy, sy = (dx + dy) * 0.5;
  Player.dir = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up';
  Player.castT = 0.45;
}

// ux, uy : direction demandée à l'écran (-1..1)
function updatePlayer(dt, ux, uy) {
  const P = Player;
  P.castT = Math.max(0, P.castT - dt);
  P.hurtT = Math.max(0, P.hurtT - dt);
  P.punchT = Math.max(0, P.punchT - dt);
  P.sinceHurt += dt;
  P.inDomain = Domain.state === 'active' && inDomain(P.x, P.y);

  // énergie occulte et vie
  if (P.energyDelay > 0) P.energyDelay -= dt;
  else P.energy = Math.min(P.maxEnergy, P.energy + 16 * dt);
  if (P.sinceHurt > 5) P.hp = Math.min(P.maxHp, P.hp + 3 * dt);

  // direction écran -> direction dans le monde isométrique
  let wx = ux * 0.5 + uy, wy = -ux * 0.5 + uy;
  const len = Math.hypot(wx, wy);
  P.moving = len > 0;
  if (P.moving) {
    wx /= len;
    wy /= len;
    P.lastMx = wx;
    P.lastMy = wy;
    const sp = P.speed * (P.charging ? 0.3 : 1) * dt;
    const stuck = isBlocked(P.x, P.y);
    const nx = P.x + wx * sp, ny = P.y + wy * sp;
    if (stuck || !isBlocked(nx, P.y)) P.x = nx;
    if (stuck || !isBlocked(P.x, ny)) P.y = ny;
    P.x = clamp(P.x, 0.4, MAP_W - 0.4);
    P.y = clamp(P.y, 0.4, MAP_H - 0.4);
    if (P.castT <= 0) P.dir = Math.abs(ux) > Math.abs(uy) ? (ux > 0 ? 'right' : 'left') : uy > 0 ? 'down' : 'up';
    P.animT += dt;
    // Gojo marche sur l'eau : petits remous
    if (typeAt(P.x, P.y) === T_WATER && Math.random() < dt * 10) {
      spawnSpark(P.x + rnd(-0.4, 0.4), P.y + rnd(-0.4, 0.4), WATER_H + 0.05, rnd(-1, 1), rnd(-1, 1), 0, '#bfe2ff', 0.4);
    }
  } else {
    P.animT = 0;
  }
  P.z += (groundAt(P.x, P.y) - P.z) * Math.min(1, dt * 14);

  // Infinité : tout ce qui approche ralentit jusqu'à s'arrêter, en suspension
  const cz = P.z + 1.6, damp = Math.pow(1e-6, dt);
  let held = 0;
  for (const p of particles) {
    const dx = p.x - P.x, dy = p.y - P.y, dz = (p.z - cz) * 0.5;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > INFINITY_R * INFINITY_R) continue;
    const dot = (dx * p.vx + dy * p.vy) / (dx * dx + dy * dy + 1e-3);
    if (dot < 0) {
      p.vx -= dx * dot;
      p.vy -= dy * dot;
    }
    p.vx *= damp;
    p.vy *= damp;
    p.vz *= damp;
    p.float = true;
    if (p.z > P.z + 0.3) held++;
  }
  for (const f of flyers) {
    const dx = f.x - P.x, dy = f.y - P.y, dz = (f.z - cz) * 0.5;
    if (dx * dx + dy * dy + dz * dz > 4) continue;
    f.vx *= damp;
    f.vy *= damp;
    f.vz *= damp;
    f.spin *= Math.pow(0.05, dt);
    f.hold = true;
    f.life = Math.max(f.life, 1);
    held++;
  }
  P.inf = lerp(P.inf, held > 0 ? 1 : 0, Math.min(1, dt * 6));

  // Violet en préparation : Bleu et Rouge convergent
  if (P.charging) {
    P.chargeT += dt;
    const k = Math.min(1, P.chargeT / PURPLE_CHARGE);
    for (let n = 0; n < 2; n++) {
      const a = rnd(0, Math.PI * 2), r = rnd(1.5, 2.5) * (1 - k * 0.5);
      spawnSpark(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, cz + rnd(-1, 1), -Math.cos(a) * r * 3, -Math.sin(a) * r * 3, 0,
        pick(k < 1 ? (n ? RED_SPARKS : BLUE_SPARKS) : PURPLE_SPARKS), 0.3);
    }
    if (k >= 1) addShake(1.5);
  }
}
