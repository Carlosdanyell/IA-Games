import { createRun, steer, updateRun, createProfile, recordRun, cellsLong } from './model.js';
import { MODES, DIFFICULTIES, MAPS, ACHIEVEMENTS, SNAKE } from './config.js';
import { createRenderer } from './render.js';
import { createSnakeAudio } from './audio.js';
import { buildDialog } from './ui.js';

export const meta = {
  id: 'neon-snake', title: 'NEON<span>SNAKE</span>', subtitle: 'COBRINHA / ARRASTE LIVRE',
  arenaLabel: 'Tabuleiro do Neon Snake. Arraste em qualquer direção para guiar a cobra.',
  logicalSize: () => ({ w: 400, h: 480 }),
  stats: [
    { id: 'score', label: 'Pontos', accent: true, flex: '1.2fr' },
    { id: 'length', label: 'Tamanho', flex: '.9fr' },
    { id: 'best', label: 'Recorde', flex: '1fr' }
  ]
};

const SAVE_KEY = 'progress-v1';
const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const number = n => Number(n || 0).toLocaleString('pt-BR');

export function create({ viewport, input, hud, store, debug, theme, audio, haptics, stats }) {
  if (!document.getElementById('snake-style')) {
    const style = document.createElement('link');
    style.id = 'snake-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('ns-app');
  document.body.classList.add('ns-body');
  theme.setAuto('verde');
  input.setMode('absolute');
  input.setInverted(false);
  input.setEnabled(true);

  const lifecycle = new AbortController();
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal: lifecycle.signal });
  const renderer = createRenderer(viewport);
  const sound = createSnakeAudio();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let profile = createProfile(store.get(SAVE_KEY, {}));
  let state = 'home';            // home | running | paused | over
  let run = null, preview = createRun(profile.settings), baseProfile = null;
  let initialBest = profile.best, checkpointTime = 0, storageWarned = false, recordSoundPlayed = false;
  let masterOn = null, hudKey = '';
  const joy = { active: false, x: 0, y: 0, kx: 0, ky: 0, radius: 44 };
  const held = new Set();

  function save() {
    if (!store.set(SAVE_KEY, profile) && !storageWarned) {
      storageWarned = true;
      hud.toast('Este navegador não permitiu salvar o progresso.', { priority: 2, duration: 4 });
    }
  }
  // O botão de som do topo é o mudo geral; música e efeitos ficam nos ajustes.
  function syncSound(force = false) {
    if (!force && audio.enabled === masterOn) return;
    masterOn = audio.enabled;
    sound.setOptions({ effects: profile.settings.effects && masterOn, music: profile.settings.music && masterOn });
  }
  // Cada checkpoint recalcula a mesma partida a partir do perfil anterior a ela.
  // Isso salva ao sair ou ocultar sem somar partidas ou alimentos duas vezes.
  function checkpoint() {
    if (!run || !baseProfile) return null;
    baseProfile.settings = { ...profile.settings };
    const result = recordRun(baseProfile, { ...run });
    profile = result.profile;
    save();
    checkpointTime = 0;
    return result;
  }
  function releaseControls() {
    joy.active = false; joy.kx = joy.ky = 0;
    held.clear();
    input.reset();
  }

  // ------------------------------------------------------------ controles
  input.on('press', ({ x, y }) => {
    sound.unlock();
    if (state !== 'running') return;
    joy.active = true; joy.x = x; joy.y = y; joy.kx = joy.ky = 0;
  });
  input.on('move', ({ x, y, dragging }) => {
    if (state !== 'running' || !run) return;
    if (dragging && joy.active) {
      let dx = x - joy.x, dy = y - joy.y;
      const distance = Math.hypot(dx, dy);
      if (distance > joy.radius) {
        // A base acompanha o dedo: dá para mudar de direção sem soltar.
        joy.x = x - dx / distance * joy.radius;
        joy.y = y - dy / distance * joy.radius;
        dx = x - joy.x; dy = y - joy.y;
      }
      joy.kx = dx; joy.ky = dy;
      if (distance > SNAKE.deadZone) steer(run, Math.atan2(dy, dx));
    } else if (!dragging && !coarse) {
      // Mouse sem clique: a cobra segue o ponteiro, como no slither.io.
      const point = renderer.toBoard(x, y);
      const dx = point.x - run.head.x, dy = point.y - run.head.y;
      if (Math.hypot(dx, dy) > 14) steer(run, Math.atan2(dy, dx));
    }
  });
  input.on('release', () => { joy.active = false; joy.kx = joy.ky = 0; });

  function steerByKeys() {
    let x = 0, y = 0;
    for (const code of held) { x += KEYS[code][0]; y += KEYS[code][1]; }
    if (x || y) steer(run, Math.atan2(y, x));
  }
  listen(window, 'keydown', event => {
    if (hud.dialogOpen || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,select,textarea')) return;
    sound.unlock();
    if (KEYS[event.code] && state === 'running') {
      event.preventDefault();
      held.add(event.code);
      steerByKeys();
      return;
    }
    if (event.repeat) return;
    if ((event.code === 'Space' || event.key === 'Escape' || event.key.toLowerCase() === 'p') && (state === 'running' || state === 'paused')) {
      event.preventDefault();
      pauseToggle();
    } else if (event.key === 'Enter' && (state === 'home' || state === 'over') && !event.target.closest?.('button')) {
      event.preventDefault();
      start();
    }
  });
  listen(window, 'keyup', event => { if (held.delete(event.code) && state === 'running') steerByKeys(); });
  listen(document, 'gesturestart', event => event.preventDefault());
  listen(hud.arena, 'contextmenu', event => event.preventDefault());
  listen(window, 'pagehide', () => { pause(); checkpoint(); });
  // O shell para o loop no pagehide; voltar pelo histórico retoma a tela pausada.
  listen(window, 'pageshow', event => { if (event.persisted) window.__iaGame?.loop.start(); });

  // ------------------------------------------------------------------ HUD
  function syncHud(force = false) {
    const r = run || preview;
    const key = run ? `${run.score}|${cellsLong(run)}|${profile.best}` : `home|${profile.best}`;
    if (force || key !== hudKey) {
      hudKey = key;
      hud.setStat('score', run ? number(run.score) : '0');
      hud.setStat('length', String(cellsLong(r)));
      hud.setStat('best', number(Math.max(profile.best, run ? run.score : 0)));
    }
    const mode = MODES.find(m => m.id === r.mode), map = MAPS.find(m => m.id === r.map);
    const chips = [{ text: mode.name, tone: 'accent' },
      r.mode === 'challenge' ? { text: `Objetivo ${r.objective.current}/${r.objective.target}` } : { text: map.name }];
    if (run) {
      if (run.effects.shield) chips.push({ text: '◇ Escudo', tone: 'accent' });
      for (const [id, label] of [['multiplier', '×2'], ['slow', 'Lento'], ['turbo', 'Turbo']]) {
        if (run.effects[id] > 0) chips.push({ text: `${label} ${Math.ceil(run.effects[id])}s`, tone: id === 'turbo' ? 'warn' : 'accent' });
      }
    }
    chips.push(run && run.combo > 1
      ? { text: `Combo ×${run.combo} · ${Math.ceil(run.comboRemaining)}s`, tone: 'flow' }
      : { text: run ? `Nível ${run.level}` : DIFFICULTIES.find(d => d.id === r.difficulty).name, tone: 'flow' });
    hud.setChips(chips);
  }

  function setHint() {
    hud.setHint(coarse ? 'Arraste para <strong>guiar a cobra</strong>'
      : '<span class="key">Mouse</span> ou <span class="key">WASD</span> · <span class="key">Espaço</span> pausa');
  }

  // --------------------------------------------------------------- telas
  function showHome() {
    const s = profile.settings;
    hud.showOverlay({
      tag: 'Pronto para deslizar',
      title: 'Deslize. Cresça.<br>Não se morda.',
      text: coarse ? 'Arraste em qualquer lugar: a cobra segue a direção do seu dedo.' : 'Mova o mouse ou use as setas: a cobra segue a direção.',
      action: 'Jogar agora',
      secondary: 'Mudar modo',
      note: `${MODES.find(m => m.id === s.mode).name} · ${DIFFICULTIES.find(d => d.id === s.difficulty).name} · ${MAPS.find(m => m.id === s.map).name}${profile.best ? ` · recorde ${number(profile.best)}` : ''}`
    });
  }

  function openSettings() {
    if (state === 'running') pause();
    hud.setDialogContent(buildDialog({
      profile, playing: state === 'paused', theme, haptics, masterOn: audio.enabled,
      onSetting(key, value) {
        profile.settings[key] = value;
        profile = createProfile(profile);
        if (baseProfile) baseProfile.settings = { ...profile.settings };
        save();
        sound.unlock();
        syncSound(true);
        if (['mode', 'difficulty', 'map'].includes(key)) preview = createRun(profile.settings);
        sound.play('ui');
      },
      onMaster(value) {
        audio.setEnabled(value);
        hud.setSound(value);
        sound.unlock();
        syncSound(true);
      }
    }), 'Neon Snake · ajustes & bônus');
    hud.openDialog();
  }
  listen(hud.el.dialog, 'close', () => { if (state === 'home') { showHome(); syncHud(true); } });

  function start() {
    if (hud.dialogOpen) return;
    if (run && baseProfile) checkpoint();
    baseProfile = createProfile(profile);
    initialBest = profile.best;
    recordSoundPlayed = false;
    run = createRun(profile.settings);
    renderer.clear();
    releaseControls();
    state = 'running';
    hud.hideOverlay();
    hud.setPause(false, true);
    sound.unlock();
    sound.play('ui');
    sound.setPlaying(true);
    checkpoint();
    syncHud(true);
  }
  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    releaseControls();
    sound.setPlaying(false);
    checkpoint();
    hud.showOverlay({
      tag: 'Pausa', title: `Tamanho ${cellsLong(run)}`,
      text: `${number(run.score)} pontos · ${run.foods} alimentos · nível ${run.level}`,
      action: 'Continuar', secondary: 'Encerrar partida', note: 'Ajustes & bônus no rodapé'
    });
    hud.setPause(true, true);
  }
  function resume() {
    if (state !== 'paused' || hud.dialogOpen) return;
    state = 'running';
    releaseControls();
    hud.hideOverlay();
    hud.setPause(false, true);
    sound.unlock();
    sound.setPlaying(true);
  }
  function pauseToggle() { if (state === 'paused') resume(); else pause(); }
  function menu() {
    checkpoint();
    baseProfile = null;
    run = null;
    preview = createRun(profile.settings);
    state = 'home';
    releaseControls();
    sound.setPlaying(false);
    hud.setPause(false, false);
    renderer.clear();
    showHome();
    syncHud(true);
  }
  function finish() {
    state = 'over';
    sound.setPlaying(false);
    releaseControls();
    const result = checkpoint();
    baseProfile = null;
    const best = run.score > initialBest;
    const rewards = [
      ...(result?.unlockedMaps || []).map(id => `arena liberada: ${MAPS.find(m => m.id === id)?.name}`),
      ...(result?.newAchievements || []).map(id => `conquista: ${ACHIEVEMENTS.find(a => a.id === id)?.name}`)
    ];
    hud.showOverlay({
      tag: best ? 'Novo recorde' : 'Fim de partida',
      title: `${number(run.score)} pontos`,
      text: `${run.deathReason} Tamanho ${run.maxLength} · ${run.foods} alimentos · combo ×${run.bestCombo}`,
      action: 'Jogar de novo', secondary: 'Menu',
      note: rewards.length ? rewards.join(' · ') : 'Cada curva é uma nova chance.'
    });
    hud.setPause(false, false);
    if (best) sound.play('record');
    haptics.buzz([35, 30, 65]);
    syncHud(true);
  }

  syncSound(true);
  showHome();
  hud.setPause(false, false);
  syncHud(true);

  return {
    meta,
    update(dt) {
      syncSound();
      if (state !== 'running' || hud.dialogOpen) return;
      for (const event of updateRun(run, dt)) {
        renderer.event(event);
        sound.play(event.type);
        if (event.type === 'eat') haptics.buzz(8);
        if (event.type === 'shield') haptics.buzz([20, 30, 20]);
      }
      if (!recordSoundPlayed && initialBest > 0 && run.score > initialBest) { recordSoundPlayed = true; sound.play('record'); }
      checkpointTime += dt;
      if (run.status === 'over') finish();
      else if (checkpointTime >= 5) checkpoint();
    },
    render(dt) {
      renderer.render(run || preview, dt, {
        reducedMotion: profile.settings.reducedMotion || reduced.matches,
        frozen: state !== 'running', joystick: joy, hint: state === 'running'
      });
      syncHud();
      hud.flush();
      if (debug?.active && run) debug.render(viewport.view.ctx, viewport.view, stats);
    },
    resize() {
      viewport.invalidateRect();
      // O shell troca a dica depois de create(); a do jogo entra aqui.
      setHint();
      hud.flush();
    },
    pause, resume, pauseToggle, openSettings,
    primaryAction() { if (state === 'paused') resume(); else if (state === 'home' || state === 'over') start(); },
    secondaryAction() { if (state === 'home') openSettings(); else menu(); },
    onHidden: pause,
    onThemeChange() {},
    getState() {
      return { state, best: profile.best, ...(run ? {
        mode: run.mode, difficulty: run.difficulty, map: run.map, waiting: run.waiting, score: run.score, level: run.level,
        length: cellsLong(run), head: { ...run.head }, angle: run.angle, target: run.target, speed: run.speed,
        food: run.food && { ...run.food }, bonus: run.bonus && { ...run.bonus }, combo: run.combo, effects: { ...run.effects },
        obstacles: run.obstacles.length, hazards: run.hazards.length, objective: { ...run.objective }
      } : {}) };
    },
    destroy() {
      checkpoint();
      lifecycle.abort();
      sound.destroy();
      renderer.destroy();
      input.destroy();
      app.classList.remove('ns-app');
      document.body.classList.remove('ns-body');
    }
  };
}
