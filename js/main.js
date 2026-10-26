'use strict';

// ---------------------------------------------------------------------------
// Entrées, boucle de jeu, interface
// ---------------------------------------------------------------------------
const keys = new Set();
const mouse = { x: 0, y: 0, wx: MAP_W / 2, wy: MAP_H / 2, inside: false };
const params = new URLSearchParams(location.search);
const demo = params.has('demo');
let last = 0;

function newWorld(seed) {
  particles.length = 0;
  sparks.length = 0;
  flyers.length = 0;
  effects.length = 0;
  generateWorld(seed);
  resetPlayer();
  snapCamera();
}

// --- Entrées (codes physiques : ZQSD en AZERTY = WASD en QWERTY) ---------------
const PREVENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

addEventListener('keydown', (e) => {
  Sfx.init();
  if (PREVENT.has(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyQ': castBlue(mouse.wx, mouse.wy); break;      // touche A en AZERTY
    case 'KeyE': castRed(mouse.wx, mouse.wy); break;
    case 'KeyR': startPurple(); break;
    case 'Space':
    case 'ShiftLeft':
    case 'ShiftRight': dash(mouse.wx, mouse.wy); break;
    case 'KeyH': document.getElementById('help').classList.toggle('hidden'); break;
    case 'KeyM': document.getElementById('mute').textContent = Sfx.toggleMute() ? 'Son coupé (M)' : ''; break;
    case 'KeyN': newWorld((Math.random() * 1e9) | 0); break;
  }
});

addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyR') releasePurple(mouse.wx, mouse.wy);
});

addEventListener('blur', () => {
  keys.clear();
  Player.charging = false;
});

addEventListener('mousemove', (e) => {
  mouse.x = e.clientX / view.scale;
  mouse.y = e.clientY / view.scale;
  mouse.inside = true;
});
document.addEventListener('mouseleave', () => { mouse.inside = false; });

addEventListener('mousedown', (e) => {
  Sfx.init();
  if (e.button === 0) castBlue(mouse.wx, mouse.wy);
  else if (e.button === 2) castRed(mouse.wx, mouse.wy);
});
addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('wheel', (e) => {
  e.preventDefault();
  view.userScale = clamp((view.userScale || view.scale) + (e.deltaY > 0 ? -1 : 1), 2, 6);
  resizeView();
}, { passive: false });

// --- Mode démo (?demo dans l'URL) : Gojo se balade et lance ses techniques tout seul
const demoState = { t: 1.2, step: 0, release: -1, tx: 0, ty: 0 };
function demoInput(dt) {
  const D = demoState;
  D.t += dt;
  if (D.t > 1.8) {
    D.t = 0;
    const a = Math.random() * Math.PI * 2;
    D.tx = Player.x + Math.cos(a) * 6;
    D.ty = Player.y + Math.sin(a) * 6;
    mouse.wx = D.tx;
    mouse.wy = D.ty;
    const s = D.step++ % 4;
    if (s === 0) castBlue(D.tx, D.ty);
    else if (s === 2) {
      startPurple();
      D.release = 1.2;
    } else castRed(D.tx, D.ty);
  }
  if (D.release > 0) {
    D.release -= dt;
    if (D.release <= 0) releasePurple(D.tx, D.ty);
  }
  const a = performance.now() / 3000;
  return Player.charging ? [0, 0] : [Math.cos(a), Math.sin(a) * 0.6];
}

// --- Interface ------------------------------------------------------------------
const hud = {};
function initHud() {
  for (const k of ['blue', 'red', 'purple', 'dash']) {
    const el = document.querySelector(`.skill[data-k="${k}"]`);
    hud[k] = { el, cd: el.querySelector('.cd') };
  }
  hud.charge = document.querySelector('.charge > i');
}

function updateHud() {
  for (const k in CD) {
    const f = CD[k] / CD_MAX[k];
    hud[k].cd.style.transform = `scaleY(${f})`;
    hud[k].el.classList.toggle('ready', f === 0);
  }
  hud.charge.style.width = (Player.charging ? Math.min(1, Player.chargeT / PURPLE_CHARGE) * 100 : 0) + '%';
}

// --- Boucle -----------------------------------------------------------------------
function update(dt) {
  let ux, uy;
  if (demo) {
    [ux, uy] = demoInput(dt);
  } else {
    ux = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    uy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    [mouse.wx, mouse.wy] = screenToWorld(mouse.x, mouse.y);
  }
  updatePlayer(dt, ux, uy);
  tickCooldowns(dt);
  for (let k = effects.length - 1; k >= 0; k--) if (!effects[k].update(dt)) effects.splice(k, 1);
  updateParticles(dt);
  updateSparks(dt);
  updateFlyers(dt);
  updateObjects(dt);
  FX.shake *= Math.pow(0.004, dt);
  if (FX.shake < 0.3) FX.shake = 0;
  FX.flash *= Math.pow(0.002, dt);
  updateCamera(dt);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateHud();
  requestAnimationFrame(frame);
}

function init() {
  buildGraphics();
  initView();
  initHud();
  mouse.x = view.w / 2;
  mouse.y = view.h / 2;
  const seed = params.has('seed') ? parseInt(params.get('seed'), 10) : (Math.random() * 1e9) | 0;
  newWorld(seed);
  if (demo) document.getElementById('help').classList.add('hidden');
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

init();
