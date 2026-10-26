'use strict';

// ---------------------------------------------------------------------------
// Extension du territoire : Sphère de l'Infini (Muryōkūsho)
// Les fléaux à l'intérieur sont figés et rongés, Gojo y lance ses techniques
// sans dépenser d'énergie et trois fois plus vite.
// ---------------------------------------------------------------------------
const DOMAIN_CAST = 1.2, DOMAIN_TIME = 10, DOMAIN_CLOSE = 0.7;
const Domain = { state: 'idle', t: 0, x: 0, y: 0, z: 0, R: 11, gauge: 100, stars: [] };
for (let k = 0; k < 260; k++) {
  Domain.stars.push({ a: Math.random() * Math.PI * 2, d0: Math.random(), sp: rnd(0.12, 0.5), c: pick(['#ffffff', '#bfe4ff', '#e8c8ff', '#9fd4ff']) });
}

function resetDomain() {
  Domain.state = 'idle';
  Domain.t = 0;
  Domain.gauge = 100;
}

function domainRadius() {
  const D = Domain;
  if (D.state === 'casting') return D.R * (1 - (1 - Math.min(1, D.t / DOMAIN_CAST)) ** 3);
  if (D.state === 'active') return D.R;
  if (D.state === 'closing') return D.R * Math.max(0, 1 - D.t / DOMAIN_CLOSE);
  return 0;
}

function inDomain(x, y) {
  return Domain.state !== 'idle' && Math.hypot(x - Domain.x, y - Domain.y) < domainRadius();
}

function activateDomain() {
  const D = Domain;
  if (D.state !== 'idle' || D.gauge < 100 || Game.over) return;
  Object.assign(D, { state: 'casting', t: 0, x: Player.x, y: Player.y, z: Player.z, gauge: 0 });
  Player.charging = false;
  addShake(6);
  Sfx.domain();
  showBanner('領域展開', "Extension du territoire : Sphère de l'Infini", 'domain', 3.2);
}

function updateDomain(dt) {
  const D = Domain;
  if (D.state === 'idle') return;
  D.t += dt;
  if (D.state === 'casting' && D.t >= DOMAIN_CAST) {
    D.state = 'active';
    D.t = 0;
    addFlash('255,255,255', 0.7);
    addShake(10);
  } else if (D.state === 'active' && D.t >= DOMAIN_TIME) {
    D.state = 'closing';
    D.t = 0;
    Sfx.boom(0.5);
  } else if (D.state === 'closing' && D.t >= DOMAIN_CLOSE) {
    D.state = 'idle';
  }
}

// Forme du dôme vu en isométrique : demi-ellipse au sol + coupole au-dessus
function domainPath(ctx, sx, sy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
  ctx.ellipse(sx, sy, rx, rx * 0.8, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
}

function drawDomain(ctx, cx, cy, W, Hh) {
  const D = Domain;
  if (D.state === 'idle') return;
  const R = domainRadius();
  if (R < 0.1) return;
  const sx = isoX(D.x, D.y) - cx, sy = isoY(D.x, D.y, D.z) - cy;
  const rx = R * 22.6, ry = R * 11.3, now = performance.now() / 1000;

  ctx.save();
  domainPath(ctx, sx, sy, rx, ry);
  ctx.clip();
  ctx.fillStyle = D.state === 'casting' ? 'rgba(2,3,12,0.9)' : 'rgba(4,6,22,0.74)';
  ctx.fillRect(0, 0, W, Hh);
  ctx.globalCompositeOperation = 'lighter';
  drawGlowOrb(ctx, sx, sy - rx * 0.25, rx * 0.2, rx * 0.7, 'rgba(120,100,255,0.35)', 'rgba(60,40,160,0.18)');
  // flot d'informations infini : des étoiles qui jaillissent du centre
  for (const s of D.stars) {
    const d = (s.d0 + now * s.sp) % 1;
    const px = Math.round(sx + Math.cos(s.a) * d * rx * 1.05);
    const py = Math.round(sy - rx * 0.25 + Math.sin(s.a) * d * rx * 0.85);
    ctx.globalAlpha = Math.min(1, d * 1.5);
    ctx.fillStyle = s.c;
    ctx.fillRect(px, py, d > 0.6 ? 2 : 1, 1);
    ctx.globalAlpha = d * 0.5;
    ctx.fillRect(Math.round(px - Math.cos(s.a) * 3), Math.round(py - Math.sin(s.a) * 3), 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Gojo et les fléaux restent visibles dans le vide
  for (const c of curses) if (!c.dead && inDomain(c.x, c.y)) drawCurse(ctx, c, cx, cy, W, Hh);
  drawPlayer(ctx);
  ctx.restore();

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(200,230,255,0.25)';
  ctx.lineWidth = 5;
  domainPath(ctx, sx, sy, rx, ry);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,245,255,0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}
