'use strict';

// ---------------------------------------------------------------------------
// Débris physiques (terre, bois, pierre), étincelles d'énergie, fumée
// et objets en vol
// ---------------------------------------------------------------------------
const particles = [];
const sparks = [];
const smokes = [];
const flyers = [];
// plafonds plus bas sur mobile pour garder un jeu fluide
const MAX_PARTICLES = 2500;
const MAX_SPARKS = 1800;
const MAX_SMOKES = 350;

const BLUE_SPARKS = ['#bfe4ff', '#6fb8ff', '#3a7dff', '#ffffff'];
const RED_SPARKS = ['#ffd0a0', '#ff7a3a', '#ff3a2a', '#ffffff'];
const PURPLE_SPARKS = ['#e8c8ff', '#b46cff', '#8a3cff', '#ffffff'];
const CYAN_SPARKS = ['#dff7ff', '#8ee6ff'];
const CURSE_SPARKS = ['#6a2a7a', '#3a1040', '#b03a8a', '#200818'];

function spawnParticle(x, y, z, vx, vy, vz, c, s = 1, life = 4) {
  const p = { kind: 'p', x, y, z, vx, vy, vz, c, s, life, float: false };
  // Plein : on remplace un débris au hasard plutôt que de perdre le nouveau
  if (particles.length >= MAX_PARTICLES) particles[(Math.random() * particles.length) | 0] = p;
  else particles.push(p);
}

function spawnDebris(x, y, z, count, colors, power, up = 1) {
  for (let k = 0; k < count; k++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * power;
    spawnParticle(x + rnd(-0.3, 0.3), y + rnd(-0.3, 0.3), z + rnd(0, 0.5), Math.cos(a) * s, Math.sin(a) * s,
      rnd(0.4, 1) * power * up * 1.6, pick(colors), Math.random() < 0.3 ? 2 : 1, rnd(3, 7));
  }
}

function spawnSpark(x, y, z, vx, vy, vz, c, life = 0.5, s = 1) {
  if (sparks.length >= MAX_SPARKS) return;
  sparks.push({ x, y, z, vx, vy, vz, c, life, max: life, s });
}

// steam = vapeur blanche, sinon fumée sombre
function spawnSmoke(x, y, z, steam = false) {
  if (smokes.length >= MAX_SMOKES) return;
  const life = rnd(1.2, 2.2);
  smokes.push({ x, y, z, r: rnd(1.5, 3), life, max: life, vz: rnd(1, 2), c: steam ? '225,232,240' : '48,44,42' });
}

function updateParticles(dt) {
  const rest = Math.pow(0.002, dt);
  let w = 0;
  for (let k = 0; k < particles.length; k++) {
    const p = particles[k];
    p.life -= dt;
    if (p.life <= 0) continue;
    if (!p.float) p.vz -= GRAVITY * dt;
    p.float = false;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (groundAt(nx, ny) > p.z + 0.5) {
      // rebond contre une paroi
      p.vx *= -0.3;
      p.vy *= -0.3;
    } else {
      p.x = nx;
      p.y = ny;
    }
    p.z += p.vz * dt;
    const g = groundAt(p.x, p.y);
    if (p.z < g) {
      if (typeAt(p.x, p.y) === T_WATER) continue; // coule
      p.z = g;
      if (p.vz < -3) {
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
      } else {
        p.vz = 0;
        p.vx *= rest;
        p.vy *= rest;
      }
    }
    if (p.z < -30) continue; // tombé de l'île
    particles[w++] = p;
  }
  particles.length = w;
}

function updateSparks(dt) {
  const drag = Math.pow(0.08, dt);
  let w = 0;
  for (let k = 0; k < sparks.length; k++) {
    const s = sparks[k];
    s.life -= dt;
    if (s.life <= 0) continue;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.vx *= drag;
    s.vy *= drag;
    s.vz *= drag;
    sparks[w++] = s;
  }
  sparks.length = w;
}

function updateSmokes(dt) {
  let w = 0;
  for (let k = 0; k < smokes.length; k++) {
    const s = smokes[k];
    s.life -= dt;
    if (s.life <= 0) continue;
    s.z += s.vz * dt;
    s.x += 0.3 * dt;
    s.r += dt * 3;
    smokes[w++] = s;
  }
  smokes.length = w;
}

function updateFlyers(dt) {
  const drag = Math.pow(0.7, dt);
  let w = 0;
  for (let k = 0; k < flyers.length; k++) {
    const f = flyers[k];
    if (f.dead) continue;
    f.life -= dt;
    if (!f.hold) f.vz -= GRAVITY * 0.8 * dt;
    f.hold = false;
    f.vx *= drag;
    f.vy *= drag;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
    f.ang += f.spin * dt;
    if (f.burning && Math.random() < dt * 20) {
      spawnSpark(f.x + rnd(-0.5, 0.5), f.y + rnd(-0.5, 0.5), f.z + rnd(-1, 1), 0, 0, rnd(1, 3), pick(FIRE_SPARKS), rnd(0.2, 0.5));
    }
    if ((f.z - f.rz < groundAt(f.x, f.y) && f.vz < 0) || f.life <= 0) {
      breakFlyer(f);
      continue;
    }
    if (f.z < -60) continue;
    flyers[w++] = f;
  }
  flyers.length = w;
}
