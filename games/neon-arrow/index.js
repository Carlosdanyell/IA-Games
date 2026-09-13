import { createRng, hashSeed, todaySeedLabel } from '../../core/rng.js';
import { PHYSICS, AIM, FIGURE, SCORE, LIVES, TIMING, logicalSize } from './config.js';
import { PHASES, phaseFor } from './levels.js';
import { layout, targetAt, bodyOf, firstHit, clamp } from './world.js';
import { createBlood } from './blood.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';

export const meta = {
  id: 'neon-arrow',
  title: 'NEON<span>ARROW</span>',
  subtitle: 'TIRO AO ALVO / 25 FASES',
  arenaLabel: 'Campo de tiro. Arraste para trás para puxar a corda e solte para disparar.',
  logicalSize,
  stats: [
    { id: 'score', label: 'Pontos', accent: true, flex: '1.05fr' },
    { id: 'level', label: 'Fase', flex: '.95fr' },
    { id: 'lives', label: 'Vidas', type: 'hearts', flex: '1fr' }
  ]
};

const MODES = {
  campaign: { label: 'Campanha', phases: PHASES.length },
  endless: { label: 'Infinito', phases: Infinity },
  daily: { label: 'Desafio diário', phases: 5 }
};

const RUN_KEY = 'run-v1';
const APPLE_COLORS = ['#7fe06a', '#a8ff8f', '#3f8f34', '#d9ff6b'];

export function create(services) {
  const { viewport, input, audio, haptics, theme, store, hud, debug } = services;
  const view = viewport.view;
  const loopStats = services.stats || {};
  const renderer = createRenderer(viewport, theme, debug);
  const blood = createBlood(store.get('blood', 'forte'));

  // A mira é absoluta: o arrasto começa onde o dedo encosta e o tiro sai na
  // direção oposta, como uma corda puxada para trás.
  input.setMode('absolute');

  let style = document.getElementById('arrow-style');
  if (!style) {
    style = document.createElement('link');
    style.id = 'arrow-style';
    style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('arrow-app');
  // A marca no body é o que permite soltar a centralização do shell em telas
  // largas: quem é item da grade é o #root, fora do alcance de .arrow-app.
  document.body.classList.add('arrow-body');

  const settings = {
    mode: store.get('mode', 'campaign'),
    guide: store.get('guide', true),
    blood: store.get('blood', 'forte')
  };

  const S = {
    state: 'intro',       // intro | ready | flying | resolve | paused | over | win
    mode: settings.mode,
    seed: 1,
    levelIndex: 0,
    phase: PHASES[0],
    score: 0,
    lives: LIVES.start,
    nextLifeScore: LIVES.scoreStep,
    streak: 0,
    bestStreak: 0,
    arrowsHere: 0,
    arrowsTotal: 0,
    hits: 0,
    victims: 0,
    clock: 0,
    wind: 0,
    freeze: 0,
    shake: 0,
    flash: 0,
    flashTone: '',
    banner: '',
    bannerTone: '',
    bannerTime: 0,
    resolveTime: 0,
    outcome: '',
    wounded: false,
    woundLean: 0,
    woundOffset: null,
    arrow: null,
    stuck: []
  };

  const aim = { angle: 0.35, power: 0.6, pulling: false, ready: true, anchorX: 0, anchorY: 0 };
  let scene = layout(view, S.phase);
  let hudDirty = true;
  let pausedFrom = null;

  const modeInfo = () => MODES[S.mode] || MODES.campaign;
  const phaseCount = () => modeInfo().phases;
  const levelLabel = () => (phaseCount() === Infinity
    ? `${S.levelIndex + 1}`
    : `${S.levelIndex + 1}/${phaseCount()}`);

  // ------------------------------------------------------------ apresentação
  const present = args => hud.showOverlay(args);
  const dismiss = () => hud.hideOverlay();
  function showBanner(text, tone = '', seconds = TIMING.bannerDefault) {
    S.banner = text; S.bannerTone = tone; S.bannerTime = seconds;
  }

  // ------------------------------------------------------------------ cena
  function rebuildScene() { scene = layout(view, S.phase); }

  function currentTarget() { return targetAt(scene, S.phase, S.clock); }
  function currentBody(target = currentTarget()) { return bodyOf(scene, S.phase, target); }

  // Mão do arqueiro: a flecha sai exatamente de onde o arco é desenhado, com
  // braço estendido — por isso o ponto acompanha o ângulo da mira.
  function handPoint() {
    const h = FIGURE.height * scene.scale;
    const reach = 0.3 * h;
    return {
      x: scene.x0 + Math.cos(-aim.angle) * reach,
      y: scene.groundY - 0.72 * h + Math.sin(-aim.angle) * reach
    };
  }
  const toMeters = p => ({ x: (p.x - scene.x0) / scene.u, y: (scene.groundY - p.y) / scene.u });
  const toScreen = p => ({ x: scene.x0 + p.x * scene.u, y: scene.groundY - p.y * scene.u });

  // --------------------------------------------------------------- partida
  function rollWind() {
    const max = S.phase.wind || 0;
    if (!max) { S.wind = 0; return; }
    const rng = createRng((S.seed ^ (S.levelIndex * 7919) ^ (S.arrowsTotal * 104729)) >>> 0);
    S.wind = Math.round((rng.next() * 2 - 1) * max * 10) / 10;
  }

  function loadLevel(index) {
    S.levelIndex = index;
    S.phase = phaseFor(S.mode, index, S.seed);
    S.arrowsHere = 0;
    S.outcome = '';
    S.clock = 0;
    S.wounded = false;
    S.woundOffset = null;
    S.woundLean = 0;
    S.stuck.length = 0;
    S.arrow = null;
    blood.clear();
    rebuildScene();
    rollWind();
    theme.setAuto(S.phase.palette);
    aim.power = clamp(0.45 + S.phase.distance / 80, 0.4, 0.95);
    aim.angle = clamp(0.12 + S.phase.distance / 260, 0.1, 0.6);
    aim.pulling = false;
    aim.ready = true;
    S.state = 'ready';
    hud.setHint(S.phase.hint);
    hudDirty = true;
    saveRun();
  }

  function startRun(mode, resume = null) {
    S.mode = mode;
    S.seed = mode === 'daily' ? hashSeed(todaySeedLabel()) : (Math.random() * 2 ** 32) >>> 0;
    S.score = 0;
    S.lives = LIVES.start;
    S.nextLifeScore = LIVES.scoreStep;
    S.streak = 0;
    S.bestStreak = 0;
    S.arrowsTotal = 0;
    S.hits = 0;
    S.victims = 0;
    if (resume) {
      S.seed = resume.seed;
      S.score = resume.score;
      S.lives = resume.lives;
      S.nextLifeScore = resume.nextLifeScore ?? LIVES.scoreStep;
      S.streak = resume.streak || 0;
      S.arrowsTotal = resume.arrowsTotal || 0;
      S.hits = resume.hits || 0;
      S.victims = resume.victims || 0;
    }
    dismiss();
    audio.resume();
    loadLevel(resume ? resume.levelIndex : 0);
  }

  // O desafio diário não guarda progresso: a graça é a rodada única do dia.
  function saveRun() {
    if (S.mode === 'daily') return;
    store.set(RUN_KEY, {
      mode: S.mode, seed: S.seed, levelIndex: S.levelIndex, score: S.score,
      lives: S.lives, nextLifeScore: S.nextLifeScore, streak: S.streak,
      arrowsTotal: S.arrowsTotal, hits: S.hits, victims: S.victims, at: Date.now()
    });
  }
  const savedRun = () => {
    const run = store.get(RUN_KEY, null);
    if (!run || !MODES[run.mode] || run.mode === 'daily') return null;
    if (!Number.isInteger(run.levelIndex) || run.levelIndex <= 0) return null;
    if (run.mode === 'campaign' && run.levelIndex >= PHASES.length) return null;
    return run;
  };
  const clearRun = () => store.remove(RUN_KEY);

  // --------------------------------------------------------------- disparo
  function fire() {
    if (S.state !== 'ready' || hud.dialogOpen) return;
    const hand = handPoint();
    const start = toMeters(hand);
    const speed = PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * clamp(aim.power, 0, 1);
    S.arrow = {
      x: start.x, y: start.y,
      vx: Math.cos(aim.angle) * speed,
      vy: Math.sin(aim.angle) * speed,
      t: 0
    };
    S.arrowsHere++;
    S.arrowsTotal++;
    S.state = 'flying';
    aim.pulling = false;
    aim.ready = false;
    audio.tone({ freq: 320, dur: 0.09, type: 'triangle', vol: 0.05, slide: 0.35 });
    haptics.buzz(10);
    hudDirty = true;
  }

  // Ponto preso ao alvo: o corpo tomba girando em torno dos pés, então a
  // flecha cravada e o ferimento precisam girar junto — senão o sangue passa
  // a escorrer do ar ao lado da pessoa.
  function attached(offset) {
    const target = currentTarget();
    const lean = S.wounded ? S.woundLean : 0;
    const cos = Math.cos(lean), sin = Math.sin(lean);
    return {
      x: target.x + offset.dx * cos - offset.dy * sin,
      y: target.y + offset.dx * sin + offset.dy * cos,
      lean
    };
  }

  function stickArrow(sx, sy, angle, onBody, bloodied = false) {
    const target = currentTarget();
    const entry = { x: sx, y: sy, angle, bloodied };
    if (onBody) { entry.dx = sx - target.x; entry.dy = sy - target.y; entry.onBody = true; }
    S.stuck.push(entry);
    if (S.stuck.length > 6) S.stuck.shift();
  }

  function addScore(points) {
    S.score += points;
    while (S.score >= S.nextLifeScore) {
      S.nextLifeScore += LIVES.scoreStep;
      if (S.lives < LIVES.max) {
        S.lives++;
        hud.toast('VIDA EXTRA · pontuação', { priority: 2 });
      }
    }
  }

  function hitApple(point, body, dir) {
    const dist = Math.hypot(point.x - body.apple.x, point.y - body.apple.y);
    const precision = clamp(1 - dist / Math.max(1, body.appleHit.r), 0, 1);
    const bonus = Math.round(SCORE.precision * precision);
    const streakBonus = Math.min(SCORE.streakMax, S.streak * SCORE.streakStep);
    const first = S.arrowsHere === 1 ? SCORE.firstArrow : 0;
    const total = SCORE.hit + Math.round(S.phase.distance * SCORE.perMeter) + bonus + streakBonus + first;

    S.streak++;
    S.hits++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak > 0 && S.streak % LIVES.streakStep === 0 && S.lives < LIVES.max) {
      S.lives++;
      hud.toast(`VIDA EXTRA · ${S.streak} acertos seguidos`, { priority: 2 });
    }
    addScore(total);

    blood.splash(point.x, point.y, dir.vx, dir.vy, 1, { colors: APPLE_COLORS, count: 26 });
    S.flash = 0.35; S.flashTone = 'good';
    S.freeze = TIMING.freezeHit;
    audio.tone({ freq: 880, dur: 0.12, type: 'square', vol: 0.05, slide: 1.6 });
    haptics.buzz([12, 30, 18]);
    showBanner(precision > 0.75 ? `NO CENTRO · +${total}` : `MAÇÃ · +${total}`, 'good', 1.4);
    S.outcome = 'apple';
    S.resolveTime = TIMING.nextLevel;
    S.state = 'resolve';
    hudDirty = true;
  }

  function hitPerson(point, body, part, dir) {
    const target = currentTarget();
    S.lives--;
    S.victims++;
    S.streak = 0;
    S.wounded = true;
    S.woundLean = 0;
    S.woundOffset = { dx: point.x - target.x, dy: point.y - target.y };
    blood.splash(point.x, point.y, dir.vx, dir.vy, 1);
    blood.setWound(point.x, point.y);
    S.flash = 0.5; S.flashTone = 'bad';
    S.shake = 16 * blood.level.shake;
    S.freeze = TIMING.freezeHit;
    audio.noise({ dur: 0.22, vol: 0.06, cutoff: 700 });
    haptics.buzz([30, 40, 60]);
    showBanner(`ACERTOU ${part.toUpperCase()}`, 'bad', 1.8);
    S.outcome = 'person';
    S.resolveTime = TIMING.retry;
    S.state = 'resolve';
    hudDirty = true;
  }

  function missed(reason) {
    S.streak = 0;
    audio.tone({ freq: 150, dur: 0.1, type: 'sine', vol: 0.03, slide: 0.6 });
    showBanner(reason, '', 1.2);
    S.outcome = 'miss';
    S.resolveTime = TIMING.retry * 0.7;
    S.state = 'resolve';
    hudDirty = true;
  }

  function resolveDone() {
    if (S.outcome === 'apple') {
      const next = S.levelIndex + 1;
      if (next >= phaseCount()) { finish('win'); return; }
      loadLevel(next);
      return;
    }
    if (S.lives <= 0) { finish('over'); return; }
    // Nova tentativa na mesma fase: alvo novo de pé, sangue do chão permanece.
    S.wounded = false;
    S.woundOffset = null;
    S.woundLean = 0;
    blood.healWound();
    S.arrow = null;
    S.state = 'ready';
    aim.ready = true;
    rollWind();
    hudDirty = true;
  }

  function finish(kind) {
    S.state = kind;
    S.arrow = null;
    aim.ready = false;
    clearRun();
    const key = `best-${S.mode}`;
    const best = store.get(key, { score: 0, level: 0, streak: 0 });
    const record = {
      score: Math.max(best.score || 0, S.score),
      level: Math.max(best.level || 0, S.levelIndex + (kind === 'win' ? 1 : 0)),
      streak: Math.max(best.streak || 0, S.bestStreak)
    };
    store.set(key, record);
    const accuracy = S.arrowsTotal ? Math.round((S.hits / S.arrowsTotal) * 100) : 0;
    const done = phaseCount() === Infinity ? S.levelIndex : phaseCount();
    present({
      tag: kind === 'win' ? (S.mode === 'daily' ? 'Desafio diário fechado' : 'Campanha completa') : 'Fim de jogo',
      title: kind === 'win' ? `Mão firme.<br>${done} maçãs.` : 'Sem vidas.',
      text: `${S.score} pontos · ${S.hits} maçãs em ${S.arrowsTotal} flechas (${accuracy}% de acerto) · ` +
            `${S.victims} ${S.victims === 1 ? 'pessoa atingida' : 'pessoas atingidas'}.`,
      action: 'Jogar de novo',
      note: `Recorde: ${record.score} pontos · melhor sequência ${record.streak} · ${modeInfo().label}`
    });
    hudDirty = true;
  }

  // ------------------------------------------------------------------ mira
  function applyPointer() {
    const dx = input.state.x - aim.anchorX;
    const dy = input.state.y - aim.anchorY;
    const pull = Math.hypot(dx, dy);
    if (pull < 0.5) return;
    // Tiro na direção oposta ao arrasto: puxar a corda para trás e para baixo
    // lança para frente e para cima. O y da tela cresce para baixo e o do tiro
    // para cima, e é esse par de inversões que faz o sinal do dy ficar positivo.
    aim.angle = clamp(Math.atan2(dy, -dx), PHYSICS.minAngle, PHYSICS.maxAngle);
    aim.power = clamp(pull / AIM.maxPull, 0, 1);
  }

  function guidePoints() {
    if (!settings.guide || S.state !== 'ready') return null;
    const hand = handPoint();
    const start = toMeters(hand);
    const speed = PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * aim.power;
    let x = start.x, y = start.y;
    let vx = Math.cos(aim.angle) * speed, vy = Math.sin(aim.angle) * speed;
    const points = [];
    for (let i = 0; i < AIM.guideSteps; i++) {
      const dt = AIM.guideDt;
      vy -= PHYSICS.gravity * dt;
      vx += S.wind * dt;
      const damp = Math.max(0, 1 - PHYSICS.drag * dt);
      vx *= damp; vy *= damp;
      x += vx * dt; y += vy * dt;
      if (y < 0) break;
      points.push(toScreen({ x, y }));
    }
    return points;
  }

  // ----------------------------------------------------------------- ciclo
  function stepArrow(dt) {
    const a = S.arrow;
    if (!a) return;
    const before = toScreen(a);
    a.vy -= PHYSICS.gravity * dt;
    a.vx += S.wind * dt;
    const damp = Math.max(0, 1 - PHYSICS.drag * dt);
    a.vx *= damp; a.vy *= damp;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.t += dt;
    const after = toScreen(a);

    const target = currentTarget();
    const body = bodyOf(scene, S.phase, target);
    const hit = firstHit(before.x, before.y, after.x, after.y, body);
    if (hit) {
      const point = {
        x: before.x + (after.x - before.x) * hit.t,
        y: before.y + (after.y - before.y) * hit.t
      };
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const dir = { vx: a.vx, vy: -a.vy };   // sentido do impacto, em tela
      S.arrow = null;                        // a flecha cravada assume o desenho
      if (hit.kind === 'apple') {
        stickArrow(point.x, point.y, angle, false);
        hitApple(point, body, dir);
      } else {
        stickArrow(point.x, point.y, angle, true, true);
        hitPerson(point, body, hit.part, dir);
      }
      return;
    }

    if (after.y >= scene.groundY) {
      const t = (scene.groundY - before.y) / Math.max(0.0001, after.y - before.y);
      const x = before.x + (after.x - before.x) * clamp(t, 0, 1);
      stickArrow(x, scene.groundY, Math.atan2(after.y - before.y, after.x - before.x), false);
      S.arrow = null;
      missed(x > scene.x1 ? 'PASSOU DIRETO' : 'CURTA DEMAIS');
      return;
    }
    if (after.x > view.w + 60 || a.t > PHYSICS.maxFlight || after.x < -60) {
      S.arrow = null;
      missed('FORA DO CAMPO');
    }
  }

  function update(dt) {
    if (S.state === 'intro' || S.state === 'paused' || S.state === 'over' || S.state === 'win') return;

    if (S.bannerTime > 0) { S.bannerTime -= dt; if (S.bannerTime <= 0) S.banner = ''; }
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 1.8);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
    blood.update(dt, scene.groundY);

    if (S.wounded) {
      S.woundLean = Math.min(0.42, S.woundLean + dt * 1.1);
      if (S.woundOffset) {
        const p = attached(S.woundOffset);
        blood.setWound(p.x, p.y);
      }
    }

    if (S.freeze > 0) { S.freeze -= dt; return; }

    if (S.state === 'resolve') {
      S.resolveTime -= dt;
      if (S.resolveTime <= 0) resolveDone();
      return;
    }

    S.clock += dt;

    if (S.state === 'ready') {
      if (input.state.pointerActive && aim.pulling) applyPointer();
      const axis = input.poll();
      if (axis) aim.angle = clamp(aim.angle - axis * AIM.keyAngle * dt, PHYSICS.minAngle, PHYSICS.maxAngle);
      return;
    }
    if (S.state === 'flying') stepArrow(dt);
  }

  function render(dt, alpha) {
    const target = currentTarget();
    const body = bodyOf(scene, S.phase, target);
    const arrow = S.arrow ? { ...toScreen(S.arrow), vx: S.arrow.vx, vy: -S.arrow.vy } : null;
    const stuck = S.stuck.map(a => {
      if (!a.onBody) return a;
      const p = attached(a);
      return { ...a, x: p.x, y: p.y, angle: a.angle + p.lean };
    });

    renderer.draw({
      scene, phase: S.phase, target, body, stuck, arrow,
      archer: { x: scene.x0, y: scene.groundY },
      aim, guide: guidePoints(),
      blood, wind: S.wind, clock: S.clock,
      wounded: S.wounded, woundLean: S.woundLean,
      appleHit: S.outcome === 'apple' && S.state !== 'ready',
      flash: S.flash, flashTone: S.flashTone, shake: S.shake,
      banner: S.banner, bannerTone: S.bannerTone,
      stats: loopStats
    });

    hud.tickToast(dt);
    if (hudDirty) { syncHud(); hudDirty = false; }
    // O HUD acumula as escritas e aplica uma vez por quadro: sem o flush nada
    // do que syncHud enfileirou chega ao DOM.
    hud.flush();
  }

  function syncHud() {
    hud.setStat('score', String(S.score));
    hud.setStat('level', levelLabel(), `Fase ${levelLabel()}: ${S.phase.name}`);
    hud.setHearts('lives', LIVES.max, S.lives);

    const chips = [{ text: S.phase.name, tone: 'accent' }];
    chips.push({ text: `${S.phase.distance} m` });
    chips.push({
      text: S.wind === 0 ? 'Sem vento' : `Vento ${S.wind > 0 ? '→' : '←'} ${Math.abs(S.wind).toFixed(1)}`,
      tone: Math.abs(S.wind) >= 4 ? 'warn' : ''
    });
    if (window.innerWidth < window.innerHeight) chips.push({ text: 'Melhor na horizontal', tone: 'warn' });
    if (S.streak > 1) chips.push({ text: `${S.streak} seguidas`, tone: 'accent' });
    if (S.arrowsHere > 0) chips.push({ text: `${S.arrowsHere} flecha${S.arrowsHere === 1 ? '' : 's'} nesta fase` });
    chips.push({ text: modeInfo().label, tone: 'flow' });
    hud.setChips(chips, `Fase ${levelLabel()}, ${S.phase.distance} metros, ${S.lives} vidas`);
    hud.setPause(S.state === 'paused', S.state !== 'intro' && S.state !== 'over' && S.state !== 'win');
  }

  // ------------------------------------------------------------- interface
  input.on('press', p => {
    if (hud.dialogOpen || S.state !== 'ready') return;
    aim.pulling = true;
    aim.anchorX = p.x;
    aim.anchorY = p.y;
  });

  input.on('release', () => {
    if (!aim.pulling) return;
    const pull = Math.hypot(input.state.x - aim.anchorX, input.state.y - aim.anchorY);
    aim.pulling = false;
    if (S.state !== 'ready' || hud.dialogOpen) return;
    if (pull < AIM.minPull) { showBanner('TIRO CANCELADO', '', 0.9); return; }
    fire();
  });

  input.on('key', event => {
    if (hud.dialogOpen) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      aim.power = clamp(aim.power + (event.key === 'ArrowUp' ? 1 : -1) * AIM.keyPower * 0.12, 0, 1);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (S.state === 'ready') fire();
      else if (S.state === 'intro' || S.state === 'over' || S.state === 'win') primaryAction();
      else if (S.state === 'paused') resume();
    }
  });

  function primaryAction() {
    if (hud.dialogOpen) return;
    if (S.state === 'paused') { resume(); return; }
    if (S.state === 'intro') {
      const run = savedRun();
      if (run) { startRun(run.mode, run); return; }
      startRun(settings.mode);
      return;
    }
    startRun(settings.mode);
  }

  function secondaryAction() {
    if (hud.dialogOpen) return;
    if (S.state === 'intro') { clearRun(); startRun(settings.mode); return; }
    if (S.state === 'paused') { clearRun(); startRun(settings.mode); }
  }

  function pause() {
    if (['intro', 'over', 'win', 'paused'].includes(S.state)) return;
    pausedFrom = S.state;
    S.state = 'paused';
    aim.pulling = false;
    input.reset();
    present({
      tag: 'Pausado',
      title: 'Partida pausada',
      text: `Fase ${levelLabel()} · ${S.phase.name} · ${S.score} pontos.`,
      action: 'Continuar',
      secondary: 'Nova partida'
    });
    hudDirty = true;
  }

  function resume() {
    if (S.state !== 'paused' || hud.dialogOpen) return;
    S.state = pausedFrom === 'flying' ? 'flying' : 'ready';
    pausedFrom = null;
    audio.resume();
    dismiss();
    hudDirty = true;
  }

  function openSettings() {
    const playing = !['intro', 'over', 'win', 'paused'].includes(S.state);
    if (playing) pause();
    const node = buildDialog({
      settings, theme, audio, haptics,
      modes: MODES,
      records: {
        campaign: store.get('best-campaign', { score: 0, level: 0, streak: 0 }),
        endless: store.get('best-endless', { score: 0, level: 0, streak: 0 }),
        daily: store.get('best-daily', { score: 0, level: 0, streak: 0 })
      },
      onMode: value => {
        settings.mode = value;
        store.set('mode', value);
        hud.toast('O modo vale a partir da próxima partida', { priority: 2 });
      },
      onGuide: value => { settings.guide = value; store.set('guide', value); },
      onBlood: value => {
        settings.blood = value;
        store.set('blood', value);
        blood.setLevel(value);
        if (value === 'off') blood.clear();
      }
    });
    hud.setDialogContent(node, 'Ajustes & regras');
    hud.openDialog();
  }

  function resize() {
    rebuildScene();
    renderer.invalidate();
    hudDirty = true;
  }

  // Tela inicial: mostra a cena atrás do overlay.
  rebuildScene();
  hud.setHint('Arraste para trás e solte · <strong>como puxar a corda</strong>');
  function showIntro() {
    const run = savedRun();
    const best = store.get(`best-${settings.mode}`, { score: 0, level: 0, streak: 0 });
    present({
      tag: 'Tiro ao alvo',
      title: 'A maçã está<br>na cabeça dele.',
      text: run
        ? `Você parou na fase ${run.levelIndex + 1} com ${run.score} pontos.`
        : 'Puxe a corda arrastando para trás e solte. Acertar a pessoa custa uma vida — e sangue.',
      action: run ? 'Continuar' : 'Começar',
      secondary: run ? 'Nova partida' : null,
      note: `${MODES[settings.mode].label} · recorde ${best.score} pontos`
    });
    S.state = 'intro';
    syncHud();
  }
  showIntro();

  return {
    meta, update, render, resize,
    primaryAction, secondaryAction, pause, resume,
    pauseToggle: () => (S.state === 'paused' ? resume() : pause()),
    openSettings,
    onHidden: pause,
    onThemeChange: () => renderer.invalidate(),
    getState: () => ({
      state: S.state, mode: S.mode, level: S.levelIndex + 1, phase: S.phase.name,
      distance: S.phase.distance, wind: S.wind, score: S.score, lives: S.lives,
      streak: S.streak, arrows: S.arrowsTotal, hits: S.hits, victims: S.victims,
      wounded: S.wounded, blood: settings.blood, particles: blood.count
    }),
    inspect: () => ({ S, aim, scene, settings, blood }),
    applePoint: () => currentBody().apple,
    destroy: () => {
      input.destroy();
      app.classList.remove('arrow-app');
      document.body.classList.remove('arrow-body');
    }
  };
}
