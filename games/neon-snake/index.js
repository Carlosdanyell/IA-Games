import { createRun, queueDirection, updateRun, createProfile, recordRun } from './model.js';
import { MAPS, ACHIEVEMENTS, ITEMS } from './config.js';
import { createRenderer } from './render.js';
import { createSnakeAudio } from './audio.js';
import { createUI } from './ui.js';

export const meta = {
  id: 'neon-snake', title: 'NEON <span>SNAKE</span>', subtitle: 'IA GAMES / ARCADE OFFLINE',
  arenaLabel: 'Arena Neon Snake. Deslize em qualquer direção para controlar a cobra.',
  logicalSize: () => ({ w: 400, h: 480 }),
  stats: [{ id: 'score', label: 'Pontos', accent: true }, { id: 'best', label: 'Recorde' },
    { id: 'combo', label: 'Combo' }, { id: 'level', label: 'Nível' }]
};

const SAVE_KEY = 'progress-v1';
const KEY_DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right' };

export function create({ viewport, input, hud, store, debug, stats }) {
  let style = document.getElementById('snake-style');
  if (!style) {
    style = document.createElement('link'); style.id = 'snake-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('ns-app'); document.body.classList.add('ns-body');
  // O Snake captura gestos nas coordenadas da tela, inclusive fora do canvas.
  input.setEnabled(false);
  const lifecycle = new AbortController();
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal: lifecycle.signal });
  const renderer = createRenderer(viewport);
  const sound = createSnakeAudio();
  let profile = createProfile(store.get(SAVE_KEY, {}));
  let phase = 'home', run = null, baseProfile = null, initialBest = profile.best;
  let countdown = 0, countdownLabel = '', checkpointTime = 0, storageWarned = false;
  let pointer = null, destroyed = false, recordSoundPlayed = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ui = createUI(hud, { getProfile: () => profile, onStart: start, onSetting: setSetting,
    onOpen: () => { sound.unlock(); sound.play('ui'); pause(); checkpoint(); } });
  sound.setOptions(profile.settings);

  function save() {
    if (!store.set(SAVE_KEY, profile) && !storageWarned) {
      storageWarned = true;
      hud.toast('Este navegador não permitiu salvar o progresso.', { priority: 2, duration: 4 });
    }
  }
  function setSetting(key, value) {
    profile.settings[key] = value;
    profile = createProfile(profile);
    if (baseProfile) baseProfile.settings = { ...profile.settings };
    save(); sound.unlock(); sound.setOptions(profile.settings); sound.play('ui');
  }
  function buzz(pattern = 8) {
    if (profile.settings.haptics && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) { /* Vibração é opcional. */ }
    }
  }
  // Cada checkpoint recalcula a mesma partida a partir do perfil anterior a ela.
  // Isso salva ao sair/ocultar sem somar partidas ou alimentos duas vezes.
  function checkpoint() {
    if (!run || !baseProfile) return null;
    baseProfile.settings = { ...profile.settings };
    const result = recordRun(baseProfile, { ...run });
    profile = result.profile;
    save(); checkpointTime = 0;
    return result;
  }
  function clearPointer() {
    if (pointer && app.hasPointerCapture?.(pointer.id)) {
      try { app.releasePointerCapture(pointer.id); } catch (_) {}
    }
    pointer = null;
  }
  function prepareCountdown(duration = 2.4) {
    phase = 'countdown'; countdown = duration; countdownLabel = '';
    ui.setScreen('game'); hud.clearToast();
    hud.showOverlay({ tag: 'ENCONTRE SEU RITMO', title: '3', text: 'Deslize para guiar a cobra.', action: 'Jogar' });
    hud.el.action.hidden = true; hud.el.secondary.hidden = true;
    hud.setPause(false, true); hud.flush();
    sound.setPlaying(false);
  }
  function start() {
    if (hud.dialogOpen) return;
    if (run && baseProfile) checkpoint();
    baseProfile = createProfile(profile); initialBest = profile.best; recordSoundPlayed = false;
    run = createRun(profile.settings);
    renderer.clear(); clearPointer(); sound.unlock(); sound.play('ui');
    prepareCountdown(); ui.update(run); resize(); checkpoint();
  }
  function resume() {
    if (phase !== 'paused' || hud.dialogOpen) return;
    sound.unlock(); sound.play('ui'); prepareCountdown(1.5);
  }
  function pause() {
    if (!['running','countdown'].includes(phase)) return;
    phase = 'paused'; clearPointer();
    hud.el.action.hidden = false; ui.setScreen('paused');
    hud.showOverlay({ tag: 'UMA PAUSA NO FLUXO', title: 'Respire.', text: 'Seu próximo movimento pode ser o melhor.', action: 'Continuar', secondary: 'Menu', note: 'O tempo e os bônus ficam congelados.' });
    hud.setPause(true, true); hud.flush(); sound.setPlaying(false); checkpoint();
  }
  function menu() {
    checkpoint(); baseProfile = null; phase = 'home'; clearPointer(); sound.setPlaying(false);
    hud.el.action.hidden = false; hud.hideOverlay(); hud.setPause(false, false);
    ui.setScreen('home'); ui.home(); hud.flush();
  }
  function finish() {
    phase = 'over'; sound.setPlaying(false); clearPointer();
    const result = checkpoint(); baseProfile = null;
    ui.setScreen('over'); hud.el.action.hidden = false;
    const best = run.score > initialBest;
    hud.showOverlay({ tag: run.victory ? 'GRADE CONQUISTADA' : best ? 'VOCÊ FOI ALÉM' : 'FIM DE PARTIDA',
      title: run.victory ? 'Arena dominada.' : best ? 'Novo recorde.' : 'Mais uma rodada?',
      text: run.deathReason, action: 'Jogar novamente', secondary: 'Menu', note: 'Cada curva é uma nova chance.' });
    const rewards = [
      ...(result?.unlockedMaps || []).map(id => `Arena liberada: ${MAPS.find(m => m.id === id)?.name}`),
      ...(result?.newAchievements || []).map(id => `Conquista: ${ACHIEVEMENTS.find(a => a.id === id)?.name}`)
    ];
    ui.showResult(run, best, rewards); ui.update(run); hud.setPause(false, false); hud.flush();
    hud.el.action.focus({ preventScroll: true });
    if (best) sound.play('record');
    buzz([35, 30, 65]);
  }
  function direction(value) {
    if (hud.dialogOpen || !['running', 'countdown'].includes(phase)) return;
    queueDirection(run, value);
  }
  function pointerMove(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.max(Math.abs(dx),Math.abs(dy)) < 12) return;
    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 3) return;
    direction(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    pointer.x = event.clientX; pointer.y = event.clientY;
  }
  listen(app, 'pointerdown', event => {
    const dpad = event.target.closest('[data-direction]');
    if (dpad) { event.preventDefault(); direction(dpad.dataset.direction); return; }
    if (!['running','countdown'].includes(phase) || hud.dialogOpen || pointer ||
        event.target.closest('button,a,input,select,label') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { app.setPointerCapture(event.pointerId); } catch (_) {}
  }, { passive: false });
  listen(app, 'pointermove', pointerMove, { passive: false });
  listen(app, 'pointerup', event => { if (pointer?.id === event.pointerId) { pointerMove(event); clearPointer(); } });
  listen(app, 'pointercancel', clearPointer);
  listen(app, 'lostpointercapture', () => { pointer = null; });
  listen(app, 'click', event => {
    const button = event.target.closest('[data-direction]');
    if (button && event.detail === 0) direction(button.dataset.direction);
  });
  listen(window, 'keydown', event => {
    if (hud.dialogOpen || event.target.closest?.('input,select,textarea')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (KEY_DIRECTIONS[key] && ['running','countdown'].includes(phase)) {
      event.preventDefault(); if (!event.repeat) direction(KEY_DIRECTIONS[key]);
    } else if ([' ', 'p', 'Escape'].includes(key) && phase !== 'home' && phase !== 'over') {
      event.preventDefault(); if (!event.repeat) pauseToggle();
    } else if (key === ' ' && (phase === 'home' || phase === 'over') && event.target.tagName !== 'BUTTON') {
      event.preventDefault(); if (!event.repeat) start();
    }
  });
  listen(window, 'pagehide', () => { pause(); checkpoint(); });
  // O shell para o loop no pagehide; restaurar do histórico retoma apenas a tela pausada.
  listen(window, 'pageshow', event => { if (event.persisted) window.__iaGame?.loop.start(); });
  function pauseToggle() { if (phase === 'paused') resume(); else pause(); }
  function resize() {
    viewport.invalidateRect(); viewport.resize();
    hud.setHint(window.matchMedia('(pointer: coarse)').matches ? 'Um dedo. Quatro direções.' : '<span class="key">WASD</span> ou setas · <span class="key">Espaço</span> pausa');
    hud.flush();
  }
  listen(style, 'load', resize);
  menu();

  return {
    update(dt) {
      if (destroyed) return;
      hud.tickToast(dt);
      if (phase === 'countdown') {
        countdown -= dt;
        const label = String(Math.ceil(countdown / 0.8));
        if (label !== countdownLabel && countdown > 0) { countdownLabel = label; hud.el.title.textContent = label; sound.play('ui'); }
        if (countdown <= 0) {
          phase = 'running'; hud.el.action.hidden = false; hud.hideOverlay(); hud.announce('Vamos jogar!');
          sound.setPlaying(true); hud.setPause(false, true);
        }
      } else if (phase === 'running') {
        const events = updateRun(run,dt);
        for (const event of events) {
          renderer.event(event); sound.play(event.type);
          if (event.type === 'eat') buzz(8);
          if (event.type === 'bonus') hud.toast(ITEMS[event.item]?.name || 'Bônus!', { duration: 1.1 });
          if (event.type === 'shield') hud.toast('Escudo ativado! Uma segunda chance.', { priority: 2 });
          if (event.type === 'level' && run.mode !== 'zen') hud.toast(`Nível ${run.level} · Ritmo acelerado`, { duration: 1.1 });
          if (event.type === 'objective') hud.toast(`Objetivo concluído! +${event.points}`, { priority: 2 });
        }
        if (!recordSoundPlayed && initialBest > 0 && run.score > initialBest) { recordSoundPlayed = true; sound.play('record'); }
        checkpointTime += dt;
        if (run.status === 'over') finish();
        else if (checkpointTime >= 5) checkpoint();
      }
    },
    render(dt) {
      if (destroyed) return;
      if (phase !== 'home' && run) {
        renderer.render(run,dt,{ reducedMotion: profile.settings.reducedMotion || reduced.matches });
        ui.update(run);
      }
      hud.flush();
      if (debug?.active && run) debug.render(viewport.view.ctx, viewport.view, stats);
    },
    resize, pause, resume, pauseToggle,
    primaryAction() { if (phase === 'paused') resume(); else if (phase === 'home' || phase === 'over') start(); },
    secondaryAction: menu, openSettings: ui.showSettings,
    onHidden: pause,
    onThemeChange() {},
    getState() { return { state: phase, ...(run ? { mode: run.mode, difficulty: run.difficulty, map: run.map,
      score: run.score, level: run.level, length: run.snake.length, snake: run.snake.map(p => ({...p})), direction: run.direction,
      food: run.food && {...run.food}, bonus: run.bonus && {...run.bonus}, elapsed: run.elapsed, combo: run.combo,
      effects: {...run.effects}, obstacles: run.obstacles.map(p => ({...p})), hazards: run.hazards.map(p => ({...p})),
      objective: {...run.objective}, stepDuration: run.stepDuration } : {}), best: profile.best }; },
    destroy() {
      checkpoint(); destroyed = true; lifecycle.abort(); clearPointer(); sound.destroy(); renderer.destroy(); ui.destroy();
      input.setEnabled(true); app.classList.remove('ns-app'); document.body.classList.remove('ns-body');
    }
  };
}
