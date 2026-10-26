'use strict';

// ---------------------------------------------------------------------------
// Rendu : tuiles en diagonales (de l'arrière vers l'avant), objets triés par
// profondeur, puis une couche additive pour les effets lumineux.
// ---------------------------------------------------------------------------
const view = { canvas: null, ctx: null, scale: 3, userScale: 0, w: 0, h: 0, camX: 0, camY: 0, sky: null };
const buckets = [];
let playerSX = 0, playerSY = 0;

function initView() {
  view.canvas = document.getElementById('game');
  view.ctx = view.canvas.getContext('2d');
  addEventListener('resize', resizeView);
  resizeView();
}

function resizeView() {
  view.scale = view.userScale || Math.max(2, Math.round(innerHeight / 330));
  view.w = Math.ceil(innerWidth / view.scale);
  view.h = Math.ceil(innerHeight / view.scale);
  view.canvas.width = view.w;
  view.canvas.height = view.h;
  view.canvas.style.width = view.w * view.scale + 'px';
  view.canvas.style.height = view.h * view.scale + 'px';
  view.ctx.imageSmoothingEnabled = false;
  const g = view.ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, '#7fb6f0');
  g.addColorStop(1, '#d6ebff');
  view.sky = g;
}

function camTarget() {
  return [isoX(Player.x, Player.y) - view.w / 2, isoY(Player.x, Player.y, Player.z + 2) - view.h / 2];
}
function snapCamera() {
  [view.camX, view.camY] = camTarget();
}
function updateCamera(dt) {
  const [tx, ty] = camTarget(), k = 1 - Math.exp(-dt * 7);
  view.camX += (tx - view.camX) * k;
  view.camY += (ty - view.camY) * k;
}

// Pixel écran (résolution interne) -> point du sol visé
function screenToWorld(mx, my) {
  const a = (mx + view.camX) / 16;
  let h = 0, wx = 0, wy = 0;
  for (let it = 0; it < 3; it++) {
    const b = (my + view.camY + h * HS) / 8;
    wx = (a + b) / 2;
    wy = (b - a) / 2;
    h = Math.max(groundAt(wx, wy), MIN_H);
  }
  return [wx, wy];
}

function playerSprite() {
  const fr = Gfx.gojo[Player.dir];
  return Player.moving ? fr[1 + (Math.floor(Player.animT * 9) % 4)] : fr[0];
}

const byDepth = (a, b) => a.x + a.y - (b.x + b.y);

function render() {
  const ctx = view.ctx, W = view.w, Hh = view.h;
  const { H, T, V } = World;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = view.sky;
  ctx.fillRect(0, 0, W, Hh);

  const cx = Math.round(view.camX + (Math.random() - 0.5) * FX.shake);
  const cy = Math.round(view.camY + (Math.random() - 0.5) * FX.shake);
  playerSX = isoX(Player.x, Player.y) - cx;
  playerSY = isoY(Player.x, Player.y, Player.z) - cy;

  const kMin = Math.floor((cy - 140) / 8), kMax = Math.ceil((cy + Hh + 60) / 8);
  const dMin = Math.floor((cx - 40) / 16), dMax = Math.ceil((cx + W + 40) / 16);
  const nb = kMax - kMin + 1;
  while (buckets.length < nb) buckets.push([]);
  for (let b = 0; b < nb; b++) buckets[b].length = 0;
  // chaque élément est dessiné juste après la diagonale devant sa tuile
  const put = (o) => {
    const b = Math.floor(o.x) + Math.floor(o.y) + 1 - kMin;
    if (b >= 0 && b < nb) buckets[b].push(o);
  };
  put(Player);
  for (const o of World.objects) if (!o.dead) put(o);
  for (const f of flyers) put(f);
  for (const p of particles) put(p);

  for (let k = kMin; k <= kMax; k++) {
    let d0 = dMin;
    if ((k + d0) & 1) d0++;
    for (let d = d0; d <= dMax; d += 2) {
      const i = (k + d) >> 1, j = (k - d) >> 1;
      if (i < 0 || j < 0 || i >= MAP_W || j >= MAP_H) continue;
      const idx = j * MAP_W + i, h = H[idx], t = T[idx];
      const sx = (i - j) * 16 - cx, sy = (i + j) * 8 - h * HS - cy;
      if (sx < -16 || sx > W + 16 || sy > Hh + 4) continue;
      const hl = j + 1 < MAP_H ? H[idx + MAP_W] : EDGE_H;
      if (h > hl) ctx.drawImage(Gfx.sideL[t][Math.min(h - hl, MAX_DROP)], sx - 16, sy);
      const hr = i + 1 < MAP_W ? H[idx + 1] : EDGE_H;
      if (h > hr) ctx.drawImage(Gfx.sideR[t][Math.min(h - hr, MAX_DROP)], sx - 16, sy);
      const tops = Gfx.tops[t];
      ctx.drawImage(tops[V[idx] % tops.length], sx - 16, sy - 4);
      if (h !== 0) {
        ctx.globalAlpha = h < 0 ? Math.min(0.55, -h * 0.1) : h * 0.05;
        ctx.drawImage(h < 0 ? Gfx.dark : Gfx.light, sx - 16, sy);
        ctx.globalAlpha = 1;
      }
    }
    const bucket = buckets[k - kMin];
    if (bucket.length) {
      if (bucket.length > 1) bucket.sort(byDepth);
      for (const o of bucket) drawItem(ctx, o, cx, cy, W, Hh);
    }
  }

  for (const e of effects) if (e.drawOverlay) e.drawOverlay(ctx, cx, cy);
  drawReticle(ctx, cx, cy);

  ctx.globalCompositeOperation = 'lighter';
  for (const e of effects) if (e.drawGlow) e.drawGlow(ctx, cx, cy);
  for (const s of sparks) {
    ctx.globalAlpha = s.life / s.max;
    ctx.fillStyle = s.c;
    ctx.fillRect(Math.round(isoX(s.x, s.y) - cx), Math.round(isoY(s.x, s.y, s.z) - cy), s.s, s.s);
  }
  ctx.globalAlpha = 1;
  drawPlayerAura(ctx);
  ctx.globalCompositeOperation = 'source-over';

  if (FX.flash > 0.01) {
    ctx.fillStyle = `rgba(${FX.flashRgb},${FX.flash})`;
    ctx.fillRect(0, 0, W, Hh);
  }
}

function drawItem(ctx, o, cx, cy, W, Hh) {
  switch (o.kind) {
    case 'p': {
      const sx = Math.round(isoX(o.x, o.y) - cx), sy = Math.round(isoY(o.x, o.y, o.z) - cy);
      if (sx < -2 || sy < -2 || sx > W || sy > Hh) return;
      if (o.life < 1) ctx.globalAlpha = o.life;
      ctx.fillStyle = o.c;
      ctx.fillRect(sx, sy, o.s, o.s);
      ctx.globalAlpha = 1;
      return;
    }
    case 'player':
      drawPlayer(ctx);
      return;
    case 'f':
      drawFlyer(ctx, o, cx, cy, W, Hh);
      return;
    default:
      drawObject(ctx, o, cx, cy, W, Hh);
  }
}

function drawShadow(ctx, x, y, rx, a = 0.22) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawObject(ctx, o, cx, cy, W, Hh) {
  const sx = Math.round(isoX(o.x, o.y) - cx), sy = Math.round(isoY(o.x, o.y, groundAt(o.x, o.y)) - cy);
  if (sx < -40 || sx > W + 40 || sy < -2 || sy > Hh + 70) return;
  drawShadow(ctx, sx, sy, o.shw);
  const ox = o.shake > 0 ? Math.round(Math.sin(performance.now() / 16) * 2) : 0;
  // un arbre devant Gojo devient transparent pour qu'on le voie toujours
  if (o.kind === 'tree' && o.x + o.y > Player.x + Player.y && Math.abs(playerSX - sx) < 16 && playerSY < sy && playerSY > sy - o.ay - 4) {
    ctx.globalAlpha = 0.45;
  }
  ctx.drawImage(o.spr, sx - o.ax + ox, sy - o.ay);
  ctx.globalAlpha = 1;
}

function drawFlyer(ctx, f, cx, cy, W, Hh) {
  const sx = isoX(f.x, f.y) - cx, sy = isoY(f.x, f.y, f.z) - cy;
  if (sx < -60 || sx > W + 60 || sy < -60 || sy > Hh + 60) return;
  const g = groundAt(f.x, f.y);
  if (g > -50) drawShadow(ctx, Math.round(sx), Math.round(isoY(f.x, f.y, g) - cy), 8, 0.15);
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy));
  ctx.rotate(f.ang);
  ctx.drawImage(f.spr, -(f.spr.width >> 1), -(f.spr.height >> 1));
  ctx.restore();
}

function drawPlayer(ctx) {
  const sx = Math.round(playerSX), sy = Math.round(playerSY);
  drawShadow(ctx, sx, sy, 7, 0.3);
  const spr = playerSprite();
  const bob = Player.moving ? Math.floor(Player.animT * 9) % 2 : 0;
  ctx.drawImage(spr, sx - 9, sy - 28 + bob);
}

// Infinité + charge du Violet, dessinés en lumière additive
function drawPlayerAura(ctx) {
  const sx = playerSX, sy = playerSY - 13;
  if (Player.inf > 0.03) {
    ctx.strokeStyle = `rgba(160,215,255,${0.35 * Player.inf})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 22, 24 + Math.sin(performance.now() / 120), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (Player.charging) {
    const t = performance.now() / 1000;
    const k = Math.min(1, Player.chargeT / PURPLE_CHARGE), off = 18 * (1 - k);
    if (k < 1) {
      drawGlowOrb(ctx, sx - off, sy - 4, 3, 10, 'rgba(230,245,255,1)', 'rgba(60,140,255,0.9)');
      drawGlowOrb(ctx, sx + off, sy - 4, 3, 10, 'rgba(255,235,225,1)', 'rgba(255,60,40,0.9)');
    } else {
      const p = Math.sin(t * 30) * 2;
      drawGlowOrb(ctx, sx, sy - 4, 6 + p, 20 + p, 'rgba(255,240,255,1)', 'rgba(160,70,255,0.9)');
    }
  }
}

function drawReticle(ctx, cx, cy) {
  if (!mouse.inside) return;
  const i = Math.floor(mouse.wx), j = Math.floor(mouse.wy);
  if (!inMap(i, j)) return;
  const h = World.H[j * MAP_W + i];
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(performance.now() / 160);
  ctx.drawImage(Gfx.reticle, (i - j) * 16 - cx - 16, (i + j) * 8 - h * HS - cy);
  ctx.globalAlpha = 1;
}
