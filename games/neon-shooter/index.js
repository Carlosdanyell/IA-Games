import { logicalSize, DIFFICULTIES, PLAYER, comboMultiplier } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createSoundEngine } from './audio.js';
import { createScreens, buildSettings, buildAchievements } from './ui.js';
import { cleanSettings, cleanStats, cleanAchievements, liveStats, checkAchievements, recordRun, ACHIEVEMENTS }
  from './progress.js';

export const meta = {
  id: 'neon-shooter',
  title: 'NEON<span>SHOOTER</span>',
  subtitle: 'ARCADE ESPACIAL',
  arenaLabel: 'Área de jogo. Arraste para mover a nave; o tiro é automático.',
  logicalSize,
  stats: [
    { id: 'score', label: 'Pontos', accent: true, flex: '1.35fr' },
    { id: 'wave', label: 'Onda', flex: '.7fr' },
    { id: 'combo', label: 'Combo', flex: '.9fr' },
    { id: 'hp', label: 'Vida', flex: '1.2fr' }
  ]
};

const fmt = n => Math.round(n).toLocaleString('pt-BR');
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const IDLE = { dx: 0, dy: 0, vx: 0, vy: 0, autofire: false, firing: false };
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire'
};
// Eventos que podem liberar conquista: só neles vale a pena conferir.
const PROGRESS_EVENTS = new Set(['kill', 'bossDown', 'waveClear', 'waveStart', 'bossWarning', 'pickup', 'bomb']);

export function create(services) {
  const { viewport, input, audio, haptics, theme, hud, store, debug } = services;
  const view = viewport.view;
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;

  if (!document.getElementById('ns-style')) {
    const link = document.createElement('link');
    link.id = 'ns-style';
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.append(link);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('ns-app');
  document.body.classList.add('ns-body');
  hud.el.settings.textContent = 'Configurações';
  hud.hideOverlay();
  theme.setAuto('rosa');
  input.setMode('absolute');
  input.setInverted(false);

  const settings = cleanSettings(store.get('settings-v1'));
  const stats = cleanStats(store.get('stats-v1'));
  const unlocked = cleanAchievements(store.get('achievements-v1'));
  const saveSettings = () => store.set('settings-v1', settings);

  const renderer = createRenderer(viewport, debug);
  const sound = createSoundEngine(audio);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const applyVisual = () => renderer.setOptions({ effects: settings.effects, shake: settings.shake && !reducedMotion.matches });
  applyVisual();
  sound.configure(settings);

  let state = 'menu';            // menu | playing | upgrade | paused | dying | over
  let world = null;
  let offer = [], runUnlocked = [], runRecorded = false;
  let levelDelay = 0, dyingTimer = 0, progressDirty = false, hudKey = '';

  // -------------------------------------------------------------- controles
  const keys = { up: false, down: false, left: false, right: false, fire: false };
  const drag = { active: false, dx: 0, dy: 0, lastX: 0, lastY: 0 };
  const joy = { active: false, x: 0, y: 0, kx: 0, ky: 0, radius: 46 };
  let pointerFire = false;

  function resetControls() {
    for (const k of Object.keys(keys)) keys[k] = false;
    drag.active = false; drag.dx = drag.dy = 0;
    joy.active = false; joy.kx = joy.ky = 0;
    pointerFire = false;
    input.reset();
  }

  input.on('press', ({ x, y }) => {
    sound.unlock();
    if (state !== 'playing') return;
    pointerFire = true;
    if (settings.control === 'joystick') {
      joy.active = true;
      joy.x = clamp(x, joy.radius, view.w - joy.radius);
      joy.y = clamp(y, joy.radius, view.h - joy.radius);
      joy.kx = joy.ky = 0;
    } else {
      drag.active = true;
      drag.lastX = x;
      drag.lastY = y;
    }
  });
  input.on('move', ({ x, y, dragging }) => {
    if (!dragging || state !== 'playing') return;
    if (joy.active) {
      let dx = x - joy.x, dy = y - joy.y;
      const d = Math.hypot(dx, dy);
      if (d > joy.radius) { dx *= joy.radius / d; dy *= joy.radius / d; }
      joy.kx = dx;
      joy.ky = dy;
    } else if (drag.active) {
      // Movimento relativo: a nave anda o quanto o dedo andou, então o dedo
      // pode ficar abaixo dela sem cobrir a nave nem os tiros.
      drag.dx += (x - drag.lastX) * settings.sensitivity;
      drag.dy += (y - drag.lastY) * settings.sensitivity;
      drag.lastX = x;
      drag.lastY = y;
    }
  });
  input.on('release', () => {
    drag.active = false;
    joy.active = false; joy.kx = joy.ky = 0;
    pointerFire = false;
  });

  function controls() {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
    if (joy.active) { vx = joy.kx / joy.radius; vy = joy.ky / joy.radius; }
    const c = { dx: drag.dx, dy: drag.dy, vx, vy, autofire: settings.autofire,
                firing: keys.fire || (!settings.autofire && pointerFire) };
    drag.dx = drag.dy = 0;
    return c;
  }

  window.addEventListener('keydown', e => {
    if (hud.dialogOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return;
    sound.unlock();
    const key = KEYMAP[e.code];
    if (key && state === 'playing') { keys[key] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      if (state === 'playing') { e.preventDefault(); pause(); } else if (state === 'paused') { e.preventDefault(); resume(); }
      return;
    }
    if (state === 'upgrade' && /^[1-3]$/.test(e.key) && offer[Number(e.key) - 1]) {
      e.preventDefault();
      pick(offer[Number(e.key) - 1]);
      return;
    }
    if (e.key === 'Enter' && !e.target?.closest?.('button') && (state === 'menu' || state === 'over')) {
      e.preventDefault();
      startGame();
    }
  }, { signal });
  window.addEventListener('keyup', e => { const key = KEYMAP[e.code]; if (key) keys[key] = false; }, { signal });

  // Sem zoom de pinça, menu de toque longo ou duplo toque durante a partida.
  document.addEventListener('gesturestart', e => e.preventDefault(), { signal });
  hud.arena.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  app.addEventListener('dblclick', e => e.preventDefault(), { signal });
  reducedMotion.addEventListener?.('change', applyVisual, { signal });

  // ------------------------------------------------------------------ HUD
  // Até 10 pontos de vida, um segmento por ponto; acima disso, barra contínua.
  const hpBar = (hp, max) => (max > 10
    ? `<div class="ns-hp ns-hp-bar${hp <= 1 ? ' low' : ''}"><i class="on" style="width:${Math.round(hp / max * 100)}%"></i></div>`
    : `<div class="ns-hp${hp <= 1 ? ' low' : ''}">${
      Array.from({ length: max }, (_, i) => `<i${i < hp ? ' class="on"' : ''}></i>`).join('')}</div>`);

  function syncHud(force = false) {
    const w = world;
    const key = w ? `${w.score}|${w.wave}|${w.combo}|${w.player.hp}|${w.player.maxHp}` : 'menu';
    if (!force && key === hudKey) return;
    hudKey = key;
    if (!w) {
      hud.setStat('score', '0');
      hud.setStat('wave', '—');
      hud.setStat('combo', 'x0');
      hud.setStat('hp', hpBar(PLAYER.maxHp, PLAYER.maxHp), `Vida ${PLAYER.maxHp} de ${PLAYER.maxHp}`);
      return;
    }
    const mult = comboMultiplier(w.combo);
    hud.setStat('score', fmt(w.score));
    hud.setStat('wave', String(w.wave));
    hud.setStat('combo', `x${w.combo}${mult > 1 ? `<small>×${mult.toLocaleString('pt-BR')}</small>` : ''}`,
      `Combo ${w.combo}, multiplicador ${mult.toLocaleString('pt-BR')}`);
    hud.setStat('hp', hpBar(w.player.hp, w.player.maxHp), `Vida ${w.player.hp} de ${w.player.maxHp}`);
  }

  // --------------------------------------------------------------- telas
  const screens = createScreens(hud.arena, {
    action(name, value) {
      sound.unlock();
      switch (name) {
        case 'play': startGame(); break;
        case 'difficulty':
          if (DIFFICULTIES[value] && value !== settings.difficulty) {
            settings.difficulty = value;
            saveSettings();
            sound.play('ui');
            showMenu();
          }
          break;
        case 'settings': sound.play('ui'); openSettings(); break;
        case 'achievements': sound.play('ui'); openAchievements(); break;
        case 'resume': resume(); break;
        case 'restart': restart(); break;
        case 'menu': sound.play('ui'); toMenu(); break;
        case 'pick': pick(value); break;
      }
    }
  });

  function showMenu() {
    const move = coarse
      ? (settings.control === 'joystick' ? 'Toque e arraste para usar o joystick.' : 'Arraste em qualquer lugar da tela para mover a nave.')
      : 'WASD ou setas para mover · Esc pausa.';
    const fire = settings.autofire ? ' O tiro é automático.' : coarse ? ' Segure o dedo na tela para atirar.' : ' Espaço ou clique para atirar.';
    screens.showMenu({ difficulty: settings.difficulty, best: stats.best[settings.difficulty],
                       unlocked: Object.keys(unlocked).length, hint: move + fire });
  }

  function openSettings() {
    if (state === 'playing') pause();
    hud.setDialogContent(buildSettings({
      settings, masterOn: audio.enabled, haptics, theme,
      onChange(key, value) {
        settings[key] = value;
        saveSettings();
        if (key === 'effects' || key === 'shake') applyVisual();
        if (key === 'control') resetControls();
        if (['sfx', 'music', 'sfxVolume', 'musicVolume'].includes(key)) {
          if ((key === 'sfx' || key === 'music') && value && !audio.enabled) { audio.setEnabled(true); hud.setSound(true); }
          sound.unlock();
          sound.configure(settings);
          if (key === 'sfxVolume') sound.play('ui');
        }
      },
      onMaster(value) {
        audio.setEnabled(value);
        hud.setSound(value);
        sound.unlock();
        sound.configure(settings);
      }
    }), 'Neon Shooter · configurações');
    hud.openDialog();
  }

  function openAchievements() {
    hud.setDialogContent(buildAchievements({ unlocked, stats }), 'Conquistas e estatísticas');
    hud.openDialog();
  }

  hud.el.dialog.addEventListener('close', () => { if (state === 'menu') showMenu(); }, { signal });

  // ------------------------------------------------------------- partida
  const runData = () => ({
    difficulty: world.difficulty, score: world.score, wave: world.wave, kills: world.kills, bosses: world.bosses,
    powerups: world.powerups, flawless: world.flawless, maxCombo: world.maxCombo, time: world.time
  });

  function checkRun() {
    if (!world) return;
    const fresh = checkAchievements(liveStats(stats, runData()), unlocked);
    for (const def of fresh) {
      runUnlocked.push(def);
      renderer.achievement(def);
      sound.play('achievement');
    }
    if (fresh.length) store.set('achievements-v1', unlocked);
  }

  function finishRun() {
    if (!world || runRecorded) return { score: false, wave: false };
    runRecorded = true;
    checkRun();
    const record = recordRun(stats, runData());
    store.set('stats-v1', stats);
    store.set('achievements-v1', unlocked);
    return record;
  }

  function startGame() {
    if (state === 'playing') return;
    if (world && !runRecorded) finishRun();
    sound.unlock();
    sound.play('select');
    world = createWorld({ w: view.w, h: view.h, difficulty: settings.difficulty, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    renderer.reset();
    offer = []; runUnlocked = []; runRecorded = false; levelDelay = 0; progressDirty = false;
    resetControls();
    state = 'playing';
    screens.hide();
    sound.duck(false);
    sound.setMusic('play');
    hud.setPause(false, true);
    syncHud(true);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    resetControls();
    sound.duck(true);
    sound.play('ui');
    screens.showPause({ wave: world.wave, score: world.score, kills: world.kills, level: world.level });
    hud.setPause(true, true);
  }

  function resume() {
    if (state !== 'paused' || hud.dialogOpen) return;
    state = 'playing';
    screens.hide();
    resetControls();
    sound.duck(false);
    sound.play('ui');
    hud.setPause(false, true);
  }

  function restart() {
    if (world && !runRecorded) finishRun();
    state = 'menu';
    startGame();
  }

  function toMenu() {
    if (world && !runRecorded) finishRun();
    world = null;
    state = 'menu';
    resetControls();
    sound.duck(false);
    sound.setMusic('menu');
    hud.setPause(false, false);
    renderer.reset();
    showMenu();
    syncHud(true);
  }

  function openUpgrade() {
    offer = world.offerUpgrades(3);
    if (!offer.length) { world.pendingLevels = 0; return; }
    state = 'upgrade';
    resetControls();
    sound.play('levelUp');
    sound.duck(true);
    haptics.buzz(12);
    hud.setPause(false, false);
    screens.showUpgrade({ level: world.level - world.pendingLevels + 1, options: offer, levels: world.up });
  }

  function pick(id) {
    if (state !== 'upgrade' || !world.applyUpgrade(id)) return;
    sound.play('upgrade');
    if (world.pendingLevels > 0) { openUpgrade(); return; }
    state = 'playing';
    screens.hide();
    resetControls();
    sound.duck(false);
    hud.setPause(false, true);
    syncHud(true);
  }

  function gameOver() {
    const record = finishRun();
    state = 'over';
    sound.setMusic('menu');
    hud.setPause(false, false);
    screens.showOver({ ...runData(), record, unlocked: runUnlocked });
  }

  function handleEvents() {
    for (const e of world.events) {
      renderer.event(e, world);
      if (PROGRESS_EVENTS.has(e.type)) progressDirty = true;
      switch (e.type) {
        case 'shoot': sound.play('shoot'); break;
        case 'hit': sound.play(e.crit ? 'crit' : 'hit'); break;
        case 'kill': sound.play('kill', e); if (e.r >= 20) haptics.buzz(14); break;
        case 'playerHit': sound.play('playerHit'); haptics.buzz([30, 40, 30]); break;
        case 'bossWarning': sound.play('bossWarning'); sound.setMusic('boss'); break;
        case 'bossDown': sound.play('bossDown'); haptics.buzz([40, 30, 90]); sound.setMusic('play'); break;
        case 'gameOver':
          sound.play('gameOver');
          haptics.buzz([60, 50, 140]);
          state = 'dying';
          dyingTimer = 1.6;
          resetControls();
          hud.setPause(false, false);
          break;
        case 'levelUp': case 'upgrade': break;
        default: sound.play(e.type);
      }
    }
    world.events.length = 0;
  }

  showMenu();
  sound.setMusic('menu');
  hud.setPause(false, false);
  syncHud(true);

  return {
    meta,
    update(dt) {
      sound.tick();
      if ((state !== 'playing' && state !== 'dying') || hud.dialogOpen) return;
      world.update(dt, state === 'playing' ? controls() : IDLE);
      handleEvents();
      if (progressDirty) { progressDirty = false; checkRun(); }
      if (state === 'playing' && world.pendingLevels > 0) {
        levelDelay += dt;
        if (levelDelay >= 0.45) { levelDelay = 0; openUpgrade(); }
      }
      if (state === 'dying' && (dyingTimer -= dt) <= 0) gameOver();
    },
    render(dt) {
      renderer.draw(world, { dt, hud: !!world && state !== 'over', frozen: state === 'paused' || state === 'upgrade',
                             joystick: joy, stats: services.stats });
      syncHud();
      hud.flush();
    },
    resize() {
      if (world) world.resize(view.w, view.h);
      renderer.invalidate();
      hud.flush();
    },
    primaryAction: () => (state === 'menu' || state === 'over' ? startGame() : state === 'paused' ? resume() : undefined),
    secondaryAction: () => { if (state === 'paused') restart(); },
    pause,
    resume,
    pauseToggle: () => (state === 'playing' ? pause() : state === 'paused' ? resume() : undefined),
    onHidden: () => { if (state === 'playing') pause(); else resetControls(); },
    openSettings,
    onThemeChange() {},
    // Só com ?debug=1: acesso à simulação para diagnóstico no console.
    get world() { return debug.active ? world : null; },
    getState: () => ({
      state, difficulty: settings.difficulty, ...(world ? world.summary() : {}),
      best: { ...stats.best[settings.difficulty] }, achievements: `${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`
    }),
    destroy() {
      lifecycle.abort();
      sound.destroy();
      screens.destroy();
      input.destroy();
      app.classList.remove('ns-app');
      document.body.classList.remove('ns-body');
    }
  };
}
