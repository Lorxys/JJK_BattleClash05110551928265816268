'use strict';

// ---------------------------------------------------------------------------
// Commandes tactiles (Android / iOS) : joystick flottant sur la moitié gauche,
// boutons de techniques à droite. Un bouton touché vise tout seul le fléau le
// plus proche ; glissé, il vise dans la direction du glissement.
// ---------------------------------------------------------------------------
const Touch = {
  used: false,        // la dernière entrée vient d'un doigt (pas de la souris)
  joy: null,          // { id, x0, y0 } doigt qui tient le joystick
  ux: 0,
  uy: 0,
  held: new Map(),    // pointerId -> { which, el, x0, y0, dx, dy, consumed }
};
const JOY_R = 50;     // rayon du joystick en pixels CSS
const AIM_DRAG = 14;  // en dessous, c'est un simple appui : visée automatique

// Fléau le plus proche, sinon droit devant Gojo
function autoTarget(range = 12) {
  let best = null, bd = range;
  for (const c of curses) {
    if (c.dead || c.spawnT > 0) continue;
    const d = Math.hypot(c.x - Player.x, c.y - Player.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (best) return [best.x, best.y];
  return [Player.x + Player.lastMx * 6, Player.y + Player.lastMy * 6];
}

// Glissement à l'écran -> direction dans le monde isométrique
function dragToWorld(dx, dy) {
  const a = dx / 16, b = dy / 8;
  const wx = (a + b) / 2, wy = (b - a) / 2, l = Math.hypot(wx, wy) || 1;
  return [wx / l, wy / l];
}

function aimFor(h) {
  const len = h ? Math.hypot(h.dx, h.dy) : 0;
  if (len > AIM_DRAG) {
    const [wx, wy] = dragToWorld(h.dx, h.dy);
    const dist = h.which === 'blue' ? clamp((len / 70) * BLUE_RANGE, 2, BLUE_RANGE) : 8;
    return [Player.x + wx * dist, Player.y + wy * dist];
  }
  return autoTarget();
}

function setAim([x, y]) {
  mouse.wx = x;
  mouse.wy = y;
}

function heldSpells() {
  return [...Touch.held.values()].filter((h) => h.which === 'blue' || h.which === 'red' || h.which === 'purple');
}

function onButtonDown(e) {
  e.preventDefault();
  e.stopPropagation();
  Touch.used = true;
  Sfx.init();
  if (!Game.started) return startGame();
  if (Game.paused || Game.over) return;
  const el = e.currentTarget, which = el.dataset.k;
  el.classList.add('pressed');
  const h = { which, el, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, consumed: false };
  Touch.held.set(e.pointerId, h);
  el.setPointerCapture(e.pointerId);

  if (which === 'dash') {
    setAim(autoTarget());
    dash(mouse.wx, mouse.wy);
  } else if (which === 'domain') {
    activateDomain();
  } else if (which === 'purple' || heldSpells().some((o) => o !== h && o.which !== which)) {
    // Bleu + Rouge tenus ensemble (ou le bouton Violet) : on prépare le Violet
    for (const o of heldSpells()) o.consumed = true;
    startPurple();
  }
  mouse.inside = which === 'blue' || which === 'red' || which === 'purple';
  setAim(aimFor(h));
}

function onButtonMove(e) {
  const h = Touch.held.get(e.pointerId);
  if (!h) return;
  h.dx = e.clientX - h.x0;
  h.dy = e.clientY - h.y0;
  setAim(aimFor(h));
}

function onButtonUp(e) {
  const h = Touch.held.get(e.pointerId);
  if (!h) return;
  Touch.held.delete(e.pointerId);
  h.el.classList.remove('pressed');
  if (e.type === 'pointercancel') return;
  const target = aimFor(h);
  setAim(target);
  if (Player.charging) releasePurple(target[0], target[1]);
  else if (!h.consumed && h.which === 'blue') castBlue(target[0], target[1]);
  else if (!h.consumed && h.which === 'red') castRed(target[0], target[1]);
  if (!heldSpells().length) mouse.inside = false;
}

// --- Joystick ---------------------------------------------------------------------
function placeJoystick(x, y, kx = 0, ky = 0) {
  const joy = document.getElementById('joy');
  joy.style.left = x + 'px';
  joy.style.top = y + 'px';
  joy.firstElementChild.style.transform = `translate(${kx}px, ${ky}px)`;
}

function restJoystick() {
  const joy = document.getElementById('joy');
  joy.classList.remove('on');
  joy.style.left = '';
  joy.style.top = '';
  joy.firstElementChild.style.transform = '';
}

function onCanvasDown(e) {
  if (e.pointerType === 'mouse') return;
  e.preventDefault();
  Touch.used = true;
  Sfx.init();
  if (!Game.started) return startGame();
  if (e.clientX < innerWidth * 0.5 && !Touch.joy) {
    Touch.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    document.getElementById('joy').classList.add('on');
    placeJoystick(e.clientX, e.clientY);
  }
}

function onCanvasMove(e) {
  const j = Touch.joy;
  if (!j || e.pointerId !== j.id) return;
  let dx = e.clientX - j.x0, dy = e.clientY - j.y0;
  const len = Math.hypot(dx, dy);
  if (len > JOY_R) {
    dx = (dx / len) * JOY_R;
    dy = (dy / len) * JOY_R;
  }
  placeJoystick(j.x0, j.y0, dx, dy);
  const k = Math.min(len, JOY_R) / JOY_R;
  Touch.ux = k > 0.2 ? dx / JOY_R : 0;
  Touch.uy = k > 0.2 ? dy / JOY_R : 0;
}

function onCanvasUp(e) {
  if (!Touch.joy || e.pointerId !== Touch.joy.id) return;
  Touch.joy = null;
  Touch.ux = Touch.uy = 0;
  restJoystick();
}

// Tout relâcher (application en arrière-plan, rotation, pause…)
function releaseAllTouches() {
  Touch.joy = null;
  Touch.ux = Touch.uy = 0;
  restJoystick();
  for (const h of Touch.held.values()) h.el.classList.remove('pressed');
  Touch.held.clear();
  mouse.inside = false;
}

function initTouch() {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');
  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', onCanvasDown);
  addEventListener('pointermove', onCanvasMove);
  addEventListener('pointerup', onCanvasUp);
  addEventListener('pointercancel', onCanvasUp);
  for (const el of document.querySelectorAll('#hud .skill')) {
    el.addEventListener('pointerdown', onButtonDown);
    el.addEventListener('pointermove', onButtonMove);
    el.addEventListener('pointerup', onButtonUp);
    el.addEventListener('pointercancel', onButtonUp);
  }
  document.getElementById('pause-btn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePause();
  });
  // empêche le zoom par pincement et le menu du clic long sur iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAllTouches();
      if (Game.started && !Game.over && !Game.paused) togglePause();
    }
  });
}

// Plein écran + verrouillage à l'horizontale (Android ; iOS ne le permet pas,
// on y affiche simplement un message tant que l'appareil est à la verticale)
function goLandscapeFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}
