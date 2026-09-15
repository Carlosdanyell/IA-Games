import { logicalSize, DIFFICULTIES, PLAYER, comboMultiplier } from './config.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createSoundEngine } from './audio.js';
import { createUpgradeLayer, buildDialog, duration } from './ui.js';
import { cleanSettings, cleanStats, cleanAchievements, liveStats, checkAchievements, recordRun, ACHIEVEMENTS }
  from './progress.js';

export const meta = {
  id: 'neon-shooter',
  title: 'NEON<span>SHOOTER</span>',
  subtitle: 'ARCADE ESPACIAL / ONDAS',
  arenaLabel: 'Área de jogo. Arraste para mover a nave; o tiro é automático.',
  logicalSize,
  stats: [
    { id: 'score', label: 'Pontos', accent: true, flex: '1.2fr' },
    { id: 'wave', label: 'Onda', flex: '.8fr' },
    { id: 'hp', label: 'Vida', type: 'hearts', flex: '1.1fr' }
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

  if (!document.getElementById('sh-style')) {
    const link = document.createElement('link');
    link.id = 'sh-style';
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    document.head.append(link);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('sh-app');
  document.body.classList.add('sh-body');
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
  let offer = [], runUnlocked = [], runRecorded = false, lastRecord = { score: false, wave: false };
  let levelDelay = 0, dyingTimer = 0, progressDirty = false, hudKey = '', upgradeWave = 0;
  let bonus = { text: '', time: 0 };

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

  // Sem zoom de pinça nem menu de toque longo durante a partida.
  document.addEventListener('gesturestart', e => e.preventDefault(), { signal });
  hud.arena.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  reducedMotion.addEventListener?.('change', applyVisual, { signal });

  // ------------------------------------------------------------------ HUD
  function syncHud(force = false) {
    const w = world;
    const hp = w ? w.player.hp : PLAYER.maxHp, maxHp = w ? w.player.maxHp : PLAYER.maxHp;
    const key = w ? `${w.score}|${w.wave}|${hp}|${maxHp}` : 'menu';
    if (force || key !== hudKey) {
      hudKey = key;
      hud.setStat('score', w ? fmt(w.score) : '0');
      // Trocar o texto recria o elemento: a animação .sh-flash marca a onda nova.
      hud.setStat('wave', w ? `<span class="sh-flash">${w.wave}</span>` : '—');
      if (maxHp <= 6) hud.setHearts('hp', maxHp, hp);
      else hud.setStat('hp', `♥ ${hp}<small>/${maxHp}</small>`, `${hp} de ${maxHp} vidas`);
    }
    const chips = [{ text: DIFFICULTIES[settings.difficulty].label, tone: 'accent' }];
    if (!w) {
      chips.push({ text: 'Chefe a cada 5 ondas' }, { text: 'Arraste e sobreviva', tone: 'flow' });
    } else {
      chips.push(w.pendingLevels > 0 ? { text: '+1 melhoria', tone: 'accent' } : { text: `Nível ${w.level}` });
      if (bonus.time > 0) chips.push({ text: bonus.text });
      const mult = comboMultiplier(w.combo);
      chips.push({ text: w.combo > 1 ? `Combo x${w.combo}${mult > 1 ? ` · ×${mult.toLocaleString('pt-BR')}` : ''}` : 'Sem dano = combo', tone: 'flow' });
    }
    hud.setChips(chips);
  }

  function setHint() {
    hud.setHint(coarse ? 'Arraste para pilotar · <strong>tiro automático</strong>'
      : '<span class="key">WASD</span> move · <span class="key">Esc</span> pausa');
  }

  // --------------------------------------------------------------- telas
  const upgrades = createUpgradeLayer(hud.arena, id => pick(id));
  const unlockedNames = () => runUnlocked.map(a => a.name).join(', ');

  function showIntro() {
    const d = DIFFICULTIES[settings.difficulty], best = stats.best[settings.difficulty];
    hud.showOverlay({
      tag: 'Pronto para decolar',
      title: 'Desvie. Atire.<br>Evolua.',
      text: `${coarse ? 'Arraste em qualquer lugar para pilotar.' : 'Use WASD ou as setas para pilotar.'} O tiro é automático e cada onda deixa a nave mais forte.`,
      action: 'Jogar agora',
      secondary: 'Mudar dificuldade',
      note: `${d.label} · ${best.score ? `recorde ${fmt(best.score)} · onda ${best.wave}` : 'sem recorde ainda'} · ajustes no rodapé`
    });
  }

  function openSettings() {
    if (state === 'playing') pause();
    hud.setDialogContent(buildDialog({
      settings, stats, unlocked, masterOn: audio.enabled, haptics, theme,
      playing: state === 'paused' || state === 'upgrade',
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
    }), 'Neon Shooter · ajustes & bônus');
    hud.openDialog();
  }

  hud.el.dialog.addEventListener('close', () => { if (state === 'menu') { showIntro(); syncHud(true); } }, { signal });

  // ------------------------------------------------------------- partida
  const runData = () => ({
    difficulty: world.difficulty, score: world.score, wave: world.wave, kills: world.kills, bosses: world.bosses,
    powerups: world.powerups, flawless: world.flawless, maxCombo: world.maxCombo, time: world.time
  });

  // Conquistas são gravadas na hora, mas só aparecem na pausa e no fim de jogo.
  function checkRun() {
    if (!world) return;
    const fresh = checkAchievements(liveStats(stats, runData()), unlocked);
    if (!fresh.length) return;
    runUnlocked.push(...fresh);
    store.set('achievements-v1', unlocked);
  }

  function finishRun() {
    if (!world || runRecorded) return lastRecord;
    runRecorded = true;
    checkRun();
    lastRecord = recordRun(stats, runData());
    store.set('stats-v1', stats);
    store.set('achievements-v1', unlocked);
    return lastRecord;
  }

  function startGame() {
    if (state === 'playing' || hud.dialogOpen) return;
    if (world && !runRecorded) finishRun();
    sound.unlock();
    sound.play('select');
    world = createWorld({ w: view.w, h: view.h, difficulty: settings.difficulty, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    renderer.reset();
    offer = []; runUnlocked = []; runRecorded = false;
    levelDelay = 0; progressDirty = false; upgradeWave = 0; bonus = { text: '', time: 0 };
    resetControls();
    state = 'playing';
    upgrades.hide();
    hud.hideOverlay();
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
    hud.showOverlay({
      tag: 'Pausa', title: `Onda ${world.wave}`,
      text: `${fmt(world.score)} pontos · ${fmt(world.kills)} abates · nível ${world.level}`,
      action: 'Continuar', secondary: 'Encerrar partida',
      note: runUnlocked.length ? `Conquistas nesta partida: ${unlockedNames()}` : 'Ajustes & bônus no rodapé'
    });
    hud.setPause(true, true);
  }

  function resume() {
    if (state !== 'paused' || hud.dialogOpen) return;
    state = 'playing';
    hud.hideOverlay();
    resetControls();
    sound.duck(false);
    hud.setPause(false, true);
  }

  function toMenu() {
    if (world && !runRecorded) finishRun();
    world = null;
    state = 'menu';
    resetControls();
    upgrades.hide();
    sound.duck(false);
    sound.setMusic('menu');
    hud.setPause(false, false);
    renderer.reset();
    showIntro();
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
    upgrades.show({ level: world.level - world.pendingLevels + 1, wave: world.wave, options: offer, levels: world.up });
  }

  // Uma escolha por onda. Níveis a mais ficam guardados para o próximo intervalo.
  function pick(id) {
    if (state !== 'upgrade' || !world.applyUpgrade(id)) return;
    sound.play('upgrade');
    state = 'playing';
    upgrades.hide();
    resetControls();
    sound.duck(false);
    hud.setPause(false, true);
    syncHud(true);
  }

  function gameOver() {
    const record = finishRun();
    const data = runData();
    state = 'over';
    sound.setMusic('menu');
    hud.setPause(false, false);
    hud.showOverlay({
      tag: record.score ? 'Novo recorde' : record.wave ? 'Maior onda' : 'Nave destruída',
      title: `${fmt(data.score)} pontos`,
      text: `Onda ${data.wave} · ${fmt(data.kills)} abates · combo máx. x${data.maxCombo} · ${data.bosses} ${data.bosses === 1 ? 'chefe' : 'chefes'} · ${duration(data.time)}`,
      action: 'Jogar de novo', secondary: 'Menu',
      note: runUnlocked.length ? `Conquistas: ${unlockedNames()}` : 'Cada onda deixa a nave mais forte.'
    });
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
        case 'waveClear':
          sound.play('waveClear');
          bonus = { text: `${e.flawless ? 'Sem dano ' : ''}+${fmt(e.bonus)}`, time: 2.5 };
          break;
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

  showIntro();
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
      if (bonus.time > 0) bonus.time -= dt;
      // Melhoria só no intervalo entre ondas, nunca no meio do combate.
      if (state === 'playing' && world.stage === 'rest' && world.pendingLevels > 0 && upgradeWave !== world.wave) {
        levelDelay += dt;
        if (levelDelay >= 0.35) { levelDelay = 0; upgradeWave = world.wave; openUpgrade(); }
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
      // O shell troca a dica depois de create(); a do jogo entra aqui.
      setHint();
      hud.flush();
    },
    primaryAction: () => (state === 'menu' || state === 'over' ? startGame() : state === 'paused' ? resume() : undefined),
    secondaryAction: () => {
      if (state === 'menu') openSettings();
      else if (state === 'paused' || state === 'over') toMenu();
    },
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
      upgrades.destroy();
      input.destroy();
      app.classList.remove('sh-app');
      document.body.classList.remove('sh-body');
    }
  };
}
