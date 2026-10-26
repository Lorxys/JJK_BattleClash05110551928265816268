'use strict';

// ---------------------------------------------------------------------------
// Entrées, boucle de jeu, interface
// ---------------------------------------------------------------------------
const keys = new Set();
const mouse = { x: 0, y: 0, wx: MAP_W / 2, wy: MAP_H / 2, inside: false };
const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const Game = { started: false, over: false, paused: false, noEnergyT: 0 };
const TAP = IS_TOUCH ? 'Touchez l\'écran' : 'Cliquez ou appuyez sur une touche';
let last = 0;

function newWorld(seed) {
  particles.length = 0;
  sparks.length = 0;
  smokes.length = 0;
  flyers.length = 0;
  effects.length = 0;
  resetFire();
  generateWorld(seed);
  resetPlayer();
  resetWaves();
  resetDomain();
  Object.assign(CD, { blue: 0, red: 0, purple: 0, dash: 0 });
  snapCamera();
}

function gameOver() {
  Game.over = true;
  Player.charging = false;
  if (IS_TOUCH) releaseAllTouches();
  Sfx.gameover();
  showOverlay('Gojo est tombé…', `Vague ${Waves.n} · ${Waves.kills} fléaux exorcisés`,
    IS_TOUCH ? 'Touchez pour recommencer' : 'Entrée : recommencer');
}

function restart() {
  Game.over = false;
  hideOverlay();
  newWorld((Math.random() * 1e9) | 0);
  Sfx.music('main');
}

// Premier geste du joueur : débloque le son et, sur mobile, passe en plein écran
function startGame() {
  if (Game.started) return;
  Game.started = true;
  hideOverlay();
  Sfx.init();
  Sfx.music('main');
  if (IS_TOUCH) goLandscapeFullscreen();
}

function onOverlayTap(e) {
  e.preventDefault();
  if (!Game.started) startGame();
  else if (Game.over) restart();
  else if (Game.paused) togglePause();
}

// --- Bleu + Rouge -----------------------------------------------------------------
// Appuyer sur les deux presque en même temps (ou sur l'un en tenant l'autre)
// prépare le Violet. Sinon, chaque touche lance son sort après un court délai.
const combo = { blue: false, red: false, pending: null, t: 0 };

function pressSpell(which) {
  if (Game.over || Game.paused) return;
  combo[which] = true;
  if (combo[which === 'blue' ? 'red' : 'blue']) {
    combo.pending = null;
    startPurple();
    return;
  }
  combo.pending = which;
  combo.t = 0.13;
}

function releaseSpell(which) {
  combo[which] = false;
  if (Player.charging) releasePurple(mouse.wx, mouse.wy);
}

function updateCombo(dt) {
  if (!combo.pending) return;
  combo.t -= dt;
  if (combo.t > 0) return;
  const which = combo.pending;
  combo.pending = null;
  if (which === 'blue') castBlue(mouse.wx, mouse.wy);
  else castRed(mouse.wx, mouse.wy);
}

// --- Entrées (codes physiques : ZQSD en AZERTY = WASD en QWERTY) ---------------
const PREVENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

addEventListener('keydown', (e) => {
  Sfx.init();
  if (PREVENT.has(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (!Game.started) {
    startGame();
    return;
  }
  if (Game.over) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') restart();
    return;
  }
  switch (e.code) {
    case 'KeyQ': pressSpell('blue'); break;      // touche A en AZERTY
    case 'KeyE': pressSpell('red'); break;
    case 'KeyF': activateDomain(); break;
    case 'Space':
    case 'ShiftLeft':
    case 'ShiftRight': if (!Game.paused) dash(mouse.wx, mouse.wy); break;
    case 'Escape': togglePause(); break;
    case 'KeyH': document.getElementById('help').classList.toggle('hidden'); break;
    case 'KeyM': document.getElementById('mute').textContent = Sfx.toggleMute() ? 'Son coupé (M)' : ''; break;
    case 'KeyN': newWorld((Math.random() * 1e9) | 0); break;
  }
});

addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyQ') releaseSpell('blue');
  else if (e.code === 'KeyE') releaseSpell('red');
});

addEventListener('blur', () => {
  keys.clear();
  combo.blue = combo.red = false;
  Player.charging = false;
});

// Souris (les doigts sont gérés dans touch.js)
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  Touch.used = false;
  mouse.x = (e.clientX * view.dpr) / view.scale;
  mouse.y = (e.clientY * view.dpr) / view.scale;
  mouse.inside = true;
});
document.addEventListener('mouseleave', () => { mouse.inside = false; });

addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.target.closest('#overlay')) return;
  Sfx.init();
  if (!Game.started) return startGame();
  if (e.button === 0) pressSpell('blue');
  else if (e.button === 2) pressSpell('red');
});
addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') return;
  if (e.button === 0) releaseSpell('blue');
  else if (e.button === 2) releaseSpell('red');
});
addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('wheel', (e) => {
  e.preventDefault();
  view.userScale = clamp((view.userScale || view.scale) + (e.deltaY > 0 ? -1 : 1), 2, 6);
  resizeView();
}, { passive: false });

function togglePause() {
  if (Game.over || !Game.started) return;
  Game.paused = !Game.paused;
  if (IS_TOUCH) releaseAllTouches();
  if (Game.paused) showOverlay('Pause', '', IS_TOUCH ? 'Touchez pour reprendre' : 'Échap : reprendre');
  else hideOverlay();
}

// --- Mode démo (?demo dans l'URL) : Gojo se balade et combat tout seul ------------
const demoState = { t: 1.2, step: 0, release: -1, tx: 0, ty: 0 };
function demoInput(dt) {
  const D = demoState;
  D.t += dt;
  if (D.t > 1.6) {
    D.t = 0;
    // vise le fléau le plus proche, sinon un point au hasard
    let best = null, bd = 12;
    for (const c of curses) {
      const d = Math.hypot(c.x - Player.x, c.y - Player.y);
      if (!c.dead && c.spawnT <= 0 && d < bd) { best = c; bd = d; }
    }
    const a = Math.random() * Math.PI * 2;
    D.tx = best ? best.x : Player.x + Math.cos(a) * 6;
    D.ty = best ? best.y : Player.y + Math.sin(a) * 6;
    mouse.wx = D.tx;
    mouse.wy = D.ty;
    const s = D.step++ % 5;
    if (s === 0 || s === 3) castBlue(D.tx, D.ty);
    else if (s === 2) {
      startPurple();
      D.release = 1.2;
    } else castRed(D.tx, D.ty);
    if (Domain.gauge >= 100 && curses.length >= 4) activateDomain();
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
let bannerT = 0;

function initHud() {
  for (const k of ['blue', 'red', 'purple', 'dash']) {
    const el = document.querySelector(`.skill[data-k="${k}"]`);
    hud[k] = { el, cd: el.querySelector('.cd') };
  }
  hud.domain = document.querySelector('.skill[data-k="domain"]');
  hud.domainCd = hud.domain.querySelector('.cd');
  hud.charge = document.querySelector('.charge > i');
  hud.hp = document.querySelector('#stats .hp i');
  hud.ce = document.querySelector('#stats .ce i');
  hud.ceBar = document.querySelector('#stats .ce');
  hud.dom = document.querySelector('#stats .dom i');
  hud.wave = document.getElementById('wave');
  hud.banner = document.getElementById('banner');
}

function updateHud() {
  for (const k in CD) {
    const f = CD[k] / CD_MAX[k];
    hud[k].cd.style.transform = `scaleY(${f})`;
    hud[k].el.classList.toggle('ready', f === 0);
  }
  hud.charge.style.width = (Player.charging ? Math.min(1, Player.chargeT / PURPLE_CHARGE) * 100 : 0) + '%';
  const domReady = Domain.state === 'idle' && Domain.gauge >= 100;
  hud.domainCd.style.transform = `scaleY(${Domain.state === 'idle' ? 1 - Domain.gauge / 100 : 1})`;
  hud.domain.classList.toggle('ready', domReady);
  hud.hp.style.width = (Player.hp / Player.maxHp) * 100 + '%';
  hud.ce.style.width = (Player.energy / Player.maxEnergy) * 100 + '%';
  hud.ceBar.classList.toggle('empty', Game.noEnergyT > 0);
  hud.dom.style.width = Domain.gauge + '%';
  const left = curses.length + Waves.queue.length;
  hud.wave.textContent = Waves.n
    ? `Vague ${Waves.n}   Fléaux ${left}   Exorcisés ${Waves.kills}`
    : 'Les fléaux arrivent…';
}

function showBanner(big, small, cls, dur) {
  hud.banner.querySelector('.big').textContent = big;
  hud.banner.querySelector('.small').textContent = small;
  hud.banner.className = 'show ' + cls;
  bannerT = dur;
}

function showOverlay(title, sub, hint) {
  const o = document.getElementById('overlay');
  o.querySelector('.big').textContent = title;
  o.querySelector('.small').textContent = sub;
  o.querySelector('.hint').textContent = hint;
  o.classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// --- Boucle -----------------------------------------------------------------------
function update(dt) {
  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT <= 0) hud.banner.className = '';
  }
  Game.noEnergyT -= dt;
  // le jeu se joue uniquement à l'horizontale sur mobile
  const portrait = IS_TOUCH && innerHeight > innerWidth;
  if (!Game.started || Game.paused || Game.over || portrait) return;

  let ux, uy;
  if (demo) {
    [ux, uy] = demoInput(dt);
  } else {
    ux = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + Touch.ux;
    uy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + Touch.uy;
    // au doigt, la visée vient des boutons (touch.js), pas de la souris
    if (!Touch.used) [mouse.wx, mouse.wy] = screenToWorld(mouse.x, mouse.y);
  }
  updateCombo(dt);
  updateDomain(dt);
  updatePlayer(dt, ux, uy);
  tickCooldowns(dt);
  for (let k = effects.length - 1; k >= 0; k--) if (!effects[k].update(dt)) effects.splice(k, 1);
  updateWaves(dt);
  updateCurses(dt);
  updateParticles(dt);
  updateSparks(dt);
  updateSmokes(dt);
  updateFlyers(dt);
  updateFire(dt);
  updateFlood(dt);
  updateObjects(dt);
  FX.shake *= Math.pow(0.004, dt);
  if (FX.shake < 0.3) FX.shake = 0;
  FX.flash *= Math.pow(0.002, dt);
  updateCamera(dt);
}

// ?debug : affiche les FPS et le nombre d'éléments dans la console
const dbg = { on: params.has('debug'), frames: 0, t: 0, game: 0 };
function debugTick(realDt, dt) {
  dbg.frames++;
  dbg.t += realDt;
  dbg.game += dt;
  if (dbg.t < 2) return;
  console.log(`fps=${(dbg.frames / dbg.t).toFixed(1)} jeu=${dbg.game.toFixed(1)}s vague=${Waves.n} fléaux=${curses.length} ` +
    `débris=${particles.length} étincelles=${sparks.length} feux=${Fire.list.length} pv=${Player.hp | 0} énergie=${Player.energy | 0}`);
  dbg.frames = 0;
  dbg.t = 0;
}

function frame(now) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt);
  last = now;
  update(dt);
  render();
  updateHud();
  if (dbg.on) debugTick(realDt, dt);
  requestAnimationFrame(frame);
}

function init() {
  buildGraphics();
  initView();
  initHud();
  initTouch();
  Sfx.preload();
  document.getElementById('overlay').addEventListener('pointerdown', onOverlayTap);
  mouse.x = view.w / 2;
  mouse.y = view.h / 2;
  const seed = params.has('seed') ? parseInt(params.get('seed'), 10) : (Math.random() * 1e9) | 0;
  newWorld(seed);
  if (demo || params.has('sim')) {
    Game.started = true;
    document.getElementById('help').classList.add('hidden');
  } else {
    showOverlay('JJK BATTLE CLASH', 'Satoru Gojo contre les fléaux', `${TAP} pour commencer`);
  }
  // ?sim=30 : avance de 30 s de jeu d'un coup (tests), puis mesure le rendu
  if (params.has('sim')) {
    const t0 = performance.now();
    for (let s = 0; s < (parseFloat(params.get('sim')) || 10) * 60; s++) update(1 / 60);
    const t1 = performance.now();
    for (let k = 0; k < 20; k++) render();
    console.log(`sim: update=${((t1 - t0) / (parseFloat(params.get('sim')) * 60)).toFixed(2)}ms render=${((performance.now() - t1) / 20).toFixed(2)}ms ` +
      `vague=${Waves.n} fléaux=${curses.length} tués=${Waves.kills} débris=${particles.length} feux=${Fire.list.length} pv=${Player.hp | 0} énergie=${Player.energy | 0} territoire=${Domain.state}`);
  }
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

init();
