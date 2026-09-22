import { createWorld } from './model.js';
import { ARENA, DIFFICULTIES, SKINS, skinFor, cleanProfile } from './config.js';
import { createRenderer } from './render.js';
import { drawSkinPreview } from './skins.js';

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
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previewClock = 0, previewTime = 0, settingsPreview = null, inspectedSkin = profile.skin;
  const lobby = document.createElement('div'); lobby.className = 'nl-lobby';
  lobby.innerHTML = '<div class="nl-preview-stage"><span class="nl-preview-label">SUA SKIN</span><canvas width="720" height="320" aria-label="Prévia da skin"></canvas></div><div class="nl-skin-switch"><button type="button" data-cycle="-1" aria-label="Skin anterior">‹</button><div><strong></strong><span></span></div><button type="button" data-cycle="1" aria-label="Próxima skin">›</button></div>';
  hud.el.action.before(lobby);
  hud.el.settings.innerHTML = 'Skins e ajustes <span aria-hidden="true">↗</span>';
  function paintLobby() {
    const skin = skinFor(profile.skin);
    lobby.querySelector('strong').textContent = skin.name;
    lobby.querySelector('.nl-skin-switch span').textContent = skin.note;
    lobby.querySelector('canvas').setAttribute('aria-label', `Prévia da skin ${skin.name}`);
    drawSkinPreview(lobby.querySelector('canvas'), skin.id);
  }
  function equip(id) {
    const skin = skinFor(id); if (profile.best < skin.goal) return;
    profile.skin = skin.id; world.player.skin = skin.id; save(); paintLobby();
    hud.announce(`Skin ${skin.name} equipada.`);
  }
  for (const button of lobby.querySelectorAll('[data-cycle]')) on(button, 'click', () => {
    const unlocked = SKINS.filter(s => s.goal <= profile.best);
    equip(unlocked[(unlocked.findIndex(s => s.id === profile.skin) + Number(button.dataset.cycle) + unlocked.length) % unlocked.length].id);
  });
  const joy = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
  let pointer = null, boostPointer = null, keyBoost = false, mouseBoost = false;
  const layer = document.createElement('div'); layer.className = 'nl-hud'; layer.hidden = true;
  layer.innerHTML = '<div class="nl-score">MASSA<b>32</b><span></span></div><div class="nl-ranking"><strong>TOP 5 <small>RIVAIS IA</small></strong><ol></ol></div><canvas class="nl-map" width="180" height="180" aria-label="Minimapa: sua posição na arena"></canvas><button class="nl-boost" aria-label="Segure para acelerar, consumindo massa" aria-pressed="false"><span aria-hidden="true">↯</span><b>ACELERAR</b></button><div class="nl-help"><strong>Seu próximo movimento?</strong>Arraste para guiar. Colete luz e desvie dos rivais.</div><div class="nl-warning" hidden role="status">Você está perto da borda</div>';
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
    app.dataset.screen = 'menu'; lobby.hidden = false; paintLobby();
    hud.showOverlay({ tag: 'ARENA OFFLINE / RIVAIS IA', title: 'NEON<span>SLITHER</span>',
      text: 'Colete luz. Cresça. Domine a arena.',
      action: 'Entrar na arena', secondary: `Coleção de skins · ${SKINS.filter(s => s.goal <= profile.best).length}/${SKINS.length}`, note: `RECORDE ${Math.floor(profile.best)} · ${DIFFICULTIES[profile.difficulty].name.toUpperCase()}` });
  }
  function start() {
    audio.resume(); release(); world = createWorld(profile); base = { ...profile }; renderer.reset(world);
    state = 'playing'; layer.hidden = false; help.hidden = false; app.dataset.playing = 'true'; app.dataset.screen = 'playing'; lobby.hidden = true; hud.hideOverlay(); hud.setPause(false, true); clock = 1;
    if (profile.fullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function steer(angle) { world.player.target = angle; world.started = true; help.hidden = true; }
  function pause() {
    if (state !== 'playing') return;
    checkpoint(); release(); state = 'paused'; app.dataset.playing = 'false'; app.dataset.screen = 'paused'; lobby.hidden = true; hud.setPause(true, true);
    hud.showOverlay({ tag: 'TEMPO PARADO', title: 'Pausa', text: 'A arena espera por você.', action: 'Continuar', secondary: 'Encerrar partida', note: 'Acelerar consome massa. Solte para conservar seu tamanho.' });
  }
  function resume() { if (state !== 'paused' || hud.dialogOpen) return; release(); state = 'playing'; app.dataset.playing = 'true'; app.dataset.screen = 'playing'; hud.hideOverlay(); hud.setPause(false, true); }
  function settings() {
    pause(); inspectedSkin = profile.skin;
    const body = document.createElement('div'); body.className = 'nl-customize';
    body.innerHTML = `<nav class="nl-settings-nav" aria-label="Painéis de ajustes"><button type="button" data-view="skins" aria-pressed="true">Coleção de skins</button><button type="button" data-view="game" aria-pressed="false">Partida</button></nav>
      <section data-panel="skins"><div class="nl-collection-head"><span>${SKINS.filter(s => s.goal <= profile.best).length} de ${SKINS.length} disponíveis</span><span>Recorde <b>${Math.floor(profile.best)}</b></span></div>
      <div class="nl-inspect"><canvas width="720" height="320" aria-label="Prévia da skin"></canvas><div class="nl-inspect-copy"><div><h3></h3><p></p></div><button type="button" class="nl-equip"></button></div><p class="nl-unlock" role="status"></p><progress class="nl-unlock-progress" aria-label="Progresso para desbloquear a skin" max="1" value="0"></progress></div>
      <div class="nl-skins" role="group" aria-label="Escolha uma skin para visualizar"></div><p class="nl-cosmetic-note">Todas têm a mesma velocidade e força. O recorde libera novos visuais.</p></section>
      <section data-panel="game" hidden><label class="nl-field">Dificuldade das IAs<select data-setting="difficulty">${Object.entries(DIFFICULTIES).map(([id,d]) => `<option value="${id}">${d.name} · ${d.bots} rivais</option>`).join('')}</select></label><p class="nl-difficulty"></p><label class="nl-field">Controle por toque<select data-setting="control"><option value="joystick">Joystick flutuante</option><option value="direct">Seguir o dedo na tela</option></select></label><label class="nl-field nl-check"><input type="checkbox">Pedir tela cheia ao jogar</label><p>A dificuldade vale na próxima partida. A skin e o controle mudam na hora.</p><h3>Como jogar</h3><ul class="nl-guide"><li>Arraste para guiar. Seu próprio corpo é passagem livre.</li><li>Evite tocar outros corpos ou a borda com a cabeça. Cabeça contra cabeça pode eliminar as duas.</li><li>Segure ↯ para acelerar, gastando massa. Rivais eliminados viram alimento.</li><li>O anel ao redor da cabeça protege por três segundos ao entrar.</li></ul><p>No computador: mouse ou setas/WASD para guiar; clique ou Espaço para acelerar; P ou Esc para pausar.</p><p class="nl-history">${profile.games} partidas · ${profile.kills} eliminações · ${Math.floor(profile.time / 60)} min jogados</p></section>`;
    const panels = body.querySelectorAll('[data-panel]');
    for (const button of body.querySelectorAll('[data-view]')) button.onclick = () => {
      for (const b of body.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b === button));
      for (const panel of panels) panel.hidden = panel.dataset.panel !== button.dataset.view;
      settingsPreview = button.dataset.view === 'skins' ? body.querySelector('.nl-inspect canvas') : null;
    };
    for (const field of body.querySelectorAll('select')) {
      const key = field.dataset.setting; field.value = profile[key];
      field.onchange = () => { release(); profile[key] = field.value; body.querySelector('.nl-difficulty').textContent = DIFFICULTIES[profile.difficulty].note; save(); };
    }
    body.querySelector('.nl-difficulty').textContent = DIFFICULTIES[profile.difficulty].note;
    const full = body.querySelector('input'); full.checked = profile.fullscreen;
    full.onchange = () => { profile.fullscreen = full.checked; save(); };
    settingsPreview = body.querySelector('.nl-inspect canvas');
    const use = body.querySelector('.nl-equip');
    function inspect(id) {
      inspectedSkin = id; const skin = skinFor(id), locked = profile.best < skin.goal, selected = profile.skin === id;
      const preview = body.querySelector('.nl-inspect canvas');
      preview.setAttribute('aria-label', `Prévia da skin ${skin.name}`); drawSkinPreview(preview, id);
      body.querySelector('.nl-inspect h3').textContent = skin.legend ? `${skin.name} ✦` : skin.name;
      body.querySelector('.nl-inspect-copy p').textContent = skin.note;
      use.disabled = locked || selected; use.textContent = locked ? 'Bloqueada' : selected ? 'Equipada ✓' : 'Usar skin';
      const status = body.querySelector('.nl-unlock');
      status.textContent = locked ? `Faltam ${Math.ceil(skin.goal - profile.best)} de massa no recorde para liberar.` : selected ? 'Sua escolha já está salva neste aparelho.' : 'Disponível para usar agora.';
      const progress = body.querySelector('progress'); progress.hidden = !locked; progress.max = skin.goal || 1; progress.value = Math.min(profile.best,skin.goal);
      for (const b of body.querySelectorAll('.nl-skin')) {
        b.setAttribute('aria-pressed', String(b.dataset.skin === id));
        const item = skinFor(b.dataset.skin);
        b.querySelector('small').textContent = profile.skin === item.id ? 'Equipada ✓'
          : profile.best < item.goal ? `${item.goal} de massa` : item.legend ? 'Lendária ✦' : 'Disponível';
      }
    }
    for (const skin of SKINS) {
      const button = document.createElement('button'); button.className = 'nl-skin'; button.type = 'button'; button.dataset.skin = skin.id;
      button.dataset.locked = String(profile.best < skin.goal);
      if (skin.legend) button.dataset.legend = 'true';
      button.setAttribute('aria-label', `${skin.name}${skin.legend ? ', lendária' : ''}. ${skin.note} ${profile.best < skin.goal ? `Libera com ${skin.goal} de massa.` : 'Disponível.'}`);
      button.innerHTML = `<canvas width="360" height="160" aria-hidden="true"></canvas><span>${skin.name}</span><small></small>`;
      drawSkinPreview(button.querySelector('canvas'), skin.id);
      button.onclick = () => inspect(skin.id); body.querySelector('.nl-skins').append(button);
    }
    use.onclick = () => { equip(inspectedSkin); inspect(inspectedSkin); };
    inspect(profile.skin); hud.setDialogContent(body, 'Seu estilo na arena'); hud.openDialog();
  }
  on(hud.el.dialog, 'close', () => { settingsPreview = null; if (state === 'menu') menu(); });
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
    if (hud.dialogOpen || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (/BUTTON|A/.test(document.activeElement?.tagName) && ['Space','Enter'].includes(e.code)) return;
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
        checkpoint(); state = 'over'; release(); app.dataset.playing = 'false'; app.dataset.screen = 'over'; lobby.hidden = true; hud.setPause(false, false); audio.tone({ freq: 130, dur: .2 }); haptics.buzz(35);
        hud.showOverlay({ tag: 'FIM DE PARTIDA', title: 'Boa trajetória', text: `${world.reason} Maior massa: ${Math.floor(world.best)} · ${world.kills} eliminações · ${Math.floor(world.time)} s`, action: 'Jogar novamente', secondary: 'Menu', note: SKINS.some(s => s.goal > base.best && s.goal <= profile.best) ? `Novas skins: ${SKINS.filter(s => s.goal > base.best && s.goal <= profile.best).map(s => s.name).join(', ')}. Veja sua coleção!` : `Recorde: ${Math.floor(profile.best)} de massa. Sua próxima trajetória espera.` });
      }
      clock += dt;
      if (clock >= .2) {
        clock = 0; const ranking = world.ranking(); $('.nl-score b').textContent = Math.floor(world.player.mass);
        $('.nl-score span').textContent = `#${ranking.indexOf(world.player) + 1} · ${world.kills} eliminações`;
        $('.nl-ranking ol').innerHTML = ranking.slice(0, 5).map((s, i) => `<li data-player="${s.player}"><span>${i + 1}. ${s.name}</span><span>${Math.floor(s.mass)}</span></li>`).join('');
        renderer.minimap($('.nl-map'), world);
        const low = world.player.mass <= ARENA.minMass + 1;
        boost.dataset.empty = String(low); boost.querySelector('b').textContent = low ? 'SEM MASSA' : 'ACELERAR';
        boost.setAttribute('aria-label', low ? 'Colete mais luz para acelerar' : 'Segure para acelerar, consumindo massa');
        $('.nl-warning').hidden = Math.hypot(world.player.x,world.player.y) < ARENA.radius - 180 || world.over;
      }
    },
    render(dt, alpha) {
      renderer.draw(world, dt, joy, alpha); hud.flush();
      previewClock += dt;
      if (previewClock >= 1/24 && !reduced.matches) {
        previewTime += previewClock; previewClock = 0;
        if (hud.dialogOpen && settingsPreview) drawSkinPreview(settingsPreview, inspectedSkin, previewTime);
        else if (state === 'menu') drawSkinPreview(lobby.querySelector('canvas'), profile.skin, previewTime);
      }
    },
    resize() { release(); hud.setHint('Arraste para guiar · Segure ↯ para acelerar'); },
    primaryAction() { state === 'paused' ? resume() : start(); document.activeElement?.blur(); },
    secondaryAction() { state === 'menu' ? settings() : menu(); },
    pause, resume, pauseToggle() { state === 'playing' ? pause() : resume(); }, openSettings: settings,
    onHidden: pause, onThemeChange() {},
    getState() { return { state, started: world.started, mass: world.player.mass, alive: world.player.alive, bots: world.snakes.length - 1, difficulty: profile.difficulty, skin: profile.skin, unlockedSkins: SKINS.filter(s => s.goal <= profile.best).map(s => s.id), boost: world.player.boost, time: world.time }; },
    destroy() { checkpoint(); lifecycle.abort(); layer.remove(); lobby.remove(); style.remove(); app.classList.remove('nl-app'); document.body.classList.remove('nl-body'); }
  };
}
