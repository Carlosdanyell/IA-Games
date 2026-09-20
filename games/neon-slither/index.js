import { createWorld } from './model.js';
import { DIFFICULTIES, SKINS, cleanProfile } from './config.js';
import { createRenderer } from './render.js';

export const meta = {
  id: 'neon-slither', title: 'NEON<span>SLITHER</span>', subtitle: 'ARENA / SOBREVIVA E CRESÇA',
  arenaLabel: 'Arena do Neon Slither. Arraste para guiar e segure acelerar para ganhar velocidade.',
  stats: [], logicalSize: a => a >= 1 ? { w: 600 * a, h: 600 } : { w: 600, h: 600 / a }
};

export function create({ viewport, input, hud, store, theme, audio, haptics }) {
  const style = document.createElement('link'); style.rel = 'stylesheet';
  style.href = new URL('./style.css', import.meta.url).href; document.head.append(style);
  const app = hud.arena.closest('.app'); app.classList.add('nl-app'); document.body.classList.add('nl-body');
  input.setEnabled(false); theme.setAuto('verde');
  const lifecycle = new AbortController();
  const on = (el, event, fn) => el.addEventListener(event, fn, { signal: lifecycle.signal });
  let profile = cleanProfile(store.get('progress-v1', {}));
  let world = createWorld(profile), state = 'menu', base = null, clock = 0, soundClock = 0;
  const renderer = createRenderer(viewport, theme);
  const joy = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
  let pointer = null, boostPointer = null, keyBoost = false, mouseBoost = false;
  const layer = document.createElement('div'); layer.className = 'nl-hud'; layer.hidden = true;
  layer.innerHTML = '<div class="nl-score">MASSA<b>32</b><span></span></div><div class="nl-ranking"><strong>NA ARENA · IAs</strong><ol></ol></div><canvas class="nl-map" width="120" height="120" aria-label="Minimapa"></canvas><button class="nl-boost" aria-label="Segure para acelerar, consumindo massa" aria-pressed="false"><span aria-hidden="true">↯</span>ACELERAR</button><div class="nl-help">Arraste para começar. Guie a cabeça e evite os outros corpos.</div>';
  hud.arena.append(layer);
  const $ = q => layer.querySelector(q), boost = $('.nl-boost'), help = $('.nl-help');
  function save() { store.set('progress-v1', profile); }
  function checkpoint() {
    if (!base || !world.started) return;
    profile.best = Math.max(base.best, world.best); profile.games = base.games + 1;
    profile.kills = base.kills + world.kills; profile.time = base.time + world.time; save();
  }
  function release() { joy.active = false; pointer = boostPointer = null; keyBoost = mouseBoost = false; boost.setAttribute('aria-pressed', 'false'); }
  function menu() {
    checkpoint(); base = null; release(); state = 'menu'; layer.hidden = true; app.dataset.playing = 'false'; hud.setPause(false, false);
    hud.showOverlay({ tag: 'ARENA OFFLINE · RIVAIS CONTROLADOS POR IA', title: 'NEON<span>SLITHER</span>',
      text: 'Colete luz, cresça e cerque seus rivais. Sua cabeça não pode tocar outra cobra nem a borda. Seu próprio corpo é passagem livre.',
      action: 'Entrar na arena', secondary: 'Skins e dificuldade', note: `Recorde: ${Math.floor(profile.best)} de massa · ${DIFFICULTIES[profile.difficulty].name}` });
  }
  function start() {
    audio.resume(); release(); world = createWorld(profile); base = { ...profile }; renderer.reset(world);
    state = 'playing'; layer.hidden = false; help.hidden = false; app.dataset.playing = 'true'; hud.hideOverlay(); hud.setPause(false, true); clock = 1;
    if (profile.fullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function steer(angle) { world.player.target = angle; world.started = true; help.hidden = true; }
  function pause() {
    if (state !== 'playing') return;
    checkpoint(); release(); state = 'paused'; app.dataset.playing = 'false'; hud.setPause(true, true);
    hud.showOverlay({ tag: 'TEMPO PARADO', title: 'Pausa', text: 'A arena espera por você.', action: 'Continuar', secondary: 'Encerrar partida', note: 'Acelerar consome massa. Solte para conservar seu tamanho.' });
  }
  function resume() { if (state !== 'paused' || hud.dialogOpen) return; release(); state = 'playing'; app.dataset.playing = 'true'; hud.hideOverlay(); hud.setPause(false, true); }
  function settings() {
    pause(); const body = document.createElement('div');
    body.innerHTML = `<p>Rivais locais, sem conexão ou outros jogadores. Mudanças valem na próxima partida.</p><label class="nl-field">Dificuldade das IAs<select data-setting="difficulty">${Object.entries(DIFFICULTIES).map(([id,d]) => `<option value="${id}">${d.name} · ${d.bots} rivais</option>`).join('')}</select></label><p class="nl-difficulty"></p><label class="nl-field">Controle por toque<select data-setting="control"><option value="joystick">Joystick flutuante</option><option value="direct">Seguir o dedo na tela</option></select></label><label class="nl-field"><input type="checkbox">Pedir tela cheia ao jogar</label><h3>Skins</h3><p>Visuais não mudam velocidade ou força. Desbloqueie pelo recorde de massa.</p><div class="nl-skins"></div><h3>Como jogar</h3><p>Arraste em qualquer área livre para guiar. Segure ↯ para acelerar, gastando massa. No computador, a cobra segue o mouse; segure clique ou Espaço para acelerar. Setas/WASD também guiam. P ou Esc pausa.</p><p>Cobras eliminadas viram alimento. Cabeça contra cabeça pode eliminar as duas. O brilho transparente inicial indica proteção por três segundos.</p><p>${profile.games} partidas · ${profile.kills} eliminações · ${Math.floor(profile.time / 60)} min jogados</p>`;
    for (const field of body.querySelectorAll('select')) {
      const key = field.dataset.setting; field.value = profile[key];
      field.onchange = () => { profile[key] = field.value; body.querySelector('.nl-difficulty').textContent = DIFFICULTIES[profile.difficulty].note; save(); };
    }
    body.querySelector('.nl-difficulty').textContent = DIFFICULTIES[profile.difficulty].note;
    const full = body.querySelector('input'); full.checked = profile.fullscreen; full.onchange = () => { profile.fullscreen = full.checked; save(); };
    for (const skin of SKINS) {
      const button = document.createElement('button'); button.className = 'nl-skin'; button.disabled = profile.best < skin.goal;
      button.setAttribute('aria-pressed', String(profile.skin === skin.id));
      button.innerHTML = `<i style="background:linear-gradient(90deg,${skin.colors.join(',')})"></i>${skin.name}<small>${button.disabled ? `${skin.goal} de massa` : 'Disponível'}</small>`;
      button.onclick = () => { profile.skin = skin.id; save(); for (const b of body.querySelectorAll('.nl-skin')) b.setAttribute('aria-pressed', String(b === button)); };
      body.querySelector('.nl-skins').append(button);
    }
    hud.setDialogContent(body, 'Neon Slither · Ajustes'); hud.openDialog();
  }
  function point(e) { return viewport.toLogical(e.clientX, e.clientY); }
  function aim(e) {
    const p = point(e), v = viewport.view;
    if (e.pointerType === 'mouse' || profile.control === 'direct') {
      const dx = p.x - (v.w / 2 + (world.player.x - renderer.camera.x) * renderer.camera.zoom);
      const dy = p.y - (v.h / 2 + (world.player.y - renderer.camera.y) * renderer.camera.zoom);
      if (Math.hypot(dx, dy) > 8) steer(Math.atan2(dy, dx)); return;
    }
    let dx = p.x - joy.x, dy = p.y - joy.y, length = Math.hypot(dx, dy);
    if (length > 38) { joy.x = p.x - dx / length * 38; joy.y = p.y - dy / length * 38; dx = p.x - joy.x; dy = p.y - joy.y; }
    joy.dx = dx; joy.dy = dy;
    if (length > 8) steer(Math.atan2(dy, dx));
  }
  on(hud.canvas, 'pointerdown', e => {
    if (state !== 'playing' || pointer !== null) return; e.preventDefault(); audio.resume(); pointer = e.pointerId; hud.canvas.setPointerCapture(pointer);
    const p = point(e); Object.assign(joy, { active: e.pointerType !== 'mouse' && profile.control === 'joystick', x: p.x, y: p.y, dx: 0, dy: 0 });
    mouseBoost = e.pointerType === 'mouse'; aim(e);
  });
  on(hud.canvas, 'pointermove', e => { if (state === 'playing' && (e.pointerId === pointer || e.pointerType === 'mouse')) aim(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    on(hud.canvas, event, e => { if (e.pointerId === pointer) { pointer = null; joy.active = false; mouseBoost = false; } });
    on(boost, event, e => { if (e.pointerId === boostPointer) boostPointer = null; });
  }
  on(boost, 'pointerdown', e => { if (state !== 'playing') return; e.preventDefault(); boostPointer = e.pointerId; boost.setPointerCapture(e.pointerId); });
  on(hud.canvas, 'contextmenu', e => e.preventDefault());
  const directions = { ArrowUp: -Math.PI / 2, KeyW: -Math.PI / 2, ArrowDown: Math.PI / 2, KeyS: Math.PI / 2, ArrowLeft: Math.PI, KeyA: Math.PI, ArrowRight: 0, KeyD: 0 };
  on(window, 'keydown', e => {
    if (hud.dialogOpen || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName)) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) state === 'playing' ? pause() : resume(); }
    if (state !== 'playing') return;
    if (e.code === 'Space') { e.preventDefault(); keyBoost = true; }
    if (Object.hasOwn(directions, e.code)) { e.preventDefault(); steer(directions[e.code]); }
  });
  on(window, 'keyup', e => { if (e.code === 'Space') keyBoost = false; });
  on(document, 'fullscreenchange', () => { if (!document.fullscreenElement) pause(); });
  on(window, 'pagehide', checkpoint);
  menu();
  return {
    update(dt) {
      hud.tickToast(dt); if (state !== 'playing') return;
      soundClock -= dt;
      world.update(dt, { angle: world.player.target, boost: keyBoost || mouseBoost || boostPointer !== null });
      boost.setAttribute('aria-pressed', String(world.player.boost));
      if (world.events.some(e => e.type === 'eat') && soundClock <= 0) { audio.tone({ freq: 600, dur: .04, vol: .025 }); soundClock = .12; }
      if (world.over) {
        checkpoint(); state = 'over'; release(); app.dataset.playing = 'false'; hud.setPause(false, false); audio.tone({ freq: 130, dur: .2 }); haptics.buzz(35);
        hud.showOverlay({ tag: 'FIM DE PARTIDA', title: 'Boa trajetória', text: `Maior massa: ${Math.floor(world.best)} · Eliminações: ${world.kills} · Tempo: ${Math.floor(world.time)} s`, action: 'Jogar novamente', secondary: 'Menu', note: `Recorde: ${Math.floor(profile.best)} de massa. Escolha novas skins nos ajustes.` });
      }
      clock += dt;
      if (clock >= .2) {
        clock = 0; const ranking = world.ranking(); $('.nl-score b').textContent = Math.floor(world.player.mass);
        $('.nl-score span').textContent = `#${ranking.indexOf(world.player) + 1} · ${world.kills} eliminações`;
        $('.nl-ranking ol').innerHTML = ranking.slice(0, 5).map((s, i) => `<li data-player="${s.player}"><span>${i + 1}. ${s.name}</span><span>${Math.floor(s.mass)}</span></li>`).join('');
        renderer.minimap($('.nl-map'), world);
      }
    },
    render(dt, alpha) { renderer.draw(world, dt, joy, alpha); hud.flush(); },
    resize() { release(); hud.setHint('Arraste para guiar · Segure ↯ para acelerar'); },
    primaryAction() { state === 'paused' ? resume() : start(); document.activeElement?.blur(); },
    secondaryAction() { state === 'menu' ? settings() : menu(); },
    pause, resume, pauseToggle() { state === 'playing' ? pause() : resume(); }, openSettings: settings,
    onHidden: pause, onThemeChange() {},
    getState() { return { state, started: world.started, mass: world.player.mass, alive: world.player.alive, bots: world.snakes.length - 1, difficulty: profile.difficulty, boost: world.player.boost, time: world.time }; },
    destroy() { checkpoint(); lifecycle.abort(); layer.remove(); style.remove(); app.classList.remove('nl-app'); document.body.classList.remove('nl-body'); }
  };
}
