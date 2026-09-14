import { createRng, hashSeed, todaySeedLabel } from '../../core/rng.js';
import { PHYSICS, AIM, FIGURE, SCORE, LIVES, TIMING, TRAVEL, FALL, DIFFICULTY, BONUS, FACE, logicalSize }
  from './config.js';
import { PHASES, phaseFor } from './levels.js';
import { layout, targetAt, bodyOf, firstHit, segmentCircle, bonusFor, clamp } from './world.js';
import { createBlood } from './blood.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';

export const meta = {
  id: 'neon-arrow',
  title: 'NEON<span>ARROW</span>',
  subtitle: 'TIRO AO ALVO / HORIZONTAL',
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
const SPARK_COLORS = ['#ffd28a', '#ff9d3c', '#ffe9b8', '#ff4d63'];
const GRAVITY_PX = 900;          // queda de maçã e pedaços, em unidades/s²
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function create(services) {
  const { viewport, input, audio, haptics, theme, store, hud, debug } = services;
  const view = viewport.view;
  const loopStats = services.stats || {};
  const renderer = createRenderer(viewport, theme, debug);
  const blood = createBlood(store.get('blood', 'forte'));

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
  document.body.classList.add('arrow-body');

  const validDifficulty = v => (DIFFICULTY[v] ? v : 'normal');
  const settings = {
    mode: store.get('mode', 'campaign'),
    difficulty: validDifficulty(store.get('difficulty', 'normal')),
    guide: store.get('guide', true),
    blood: store.get('blood', 'forte')
  };
  const rules = () => DIFFICULTY[settings.difficulty];

  const S = {
    state: 'intro',    // intro | ready | flying | resolve | travel | paused | over | win
    mode: settings.mode,
    difficulty: settings.difficulty,
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
    // troca de fase
    viewDistance: PHASES[0].distance,
    travelFrom: PHASES[0].distance,
    travelT: 0,
    shift: 0,
    shiftFrom: 0,
    shiftTo: 0,
    entry: 0,
    walk: 0,
    // alvo atingido
    wounded: false,
    lean: 0,
    fallT: 0,
    landed: false,
    woundOffset: null,
    targetArms: 'down',
    flinch: 0,
    bits: [],
    loose: null,
    bonusTaken: false,
    blink: 0,
    blinkIn: 2,
    voiceIn: 0,
    voiceStrong: false,
    arrow: null,
    whooshed: false,
    stuck: []
  };

  const aim = { angle: 0.35, power: 0.6, pulling: false, ready: true, anchorX: 0, anchorY: 0 };
  let scene = layout(view, { distance: S.viewDistance });
  let hudDirty = true;
  let pausedFrom = null;
  let overlayArgs = null;
  let wasPortrait = null;

  const modeInfo = () => MODES[S.mode] || MODES.campaign;
  const phaseCount = () => modeInfo().phases;
  const levelLabel = () => (phaseCount() === Infinity
    ? `${S.levelIndex + 1}`
    : `${S.levelIndex + 1}/${phaseCount()}`);

  // O jogo é só na horizontal: em retrato a cena dá lugar ao aviso de girar.
  const isPortrait = () => view.cssW < view.cssH * 1.1;

  function present(args) {
    overlayArgs = args;
    if (isPortrait()) hud.hideOverlay(); else hud.showOverlay(args);
  }
  function dismiss() { overlayArgs = null; hud.hideOverlay(); }
  function syncOrientation() {
    const portrait = isPortrait();
    if (portrait === wasPortrait) return;
    wasPortrait = portrait;
    if (portrait) { hud.hideOverlay(); pause(); }
    else if (overlayArgs) hud.showOverlay(overlayArgs);
    hudDirty = true;
  }
  function showBanner(text, tone = '', seconds = TIMING.bannerDefault) {
    S.banner = text; S.bannerTone = tone; S.bannerTime = seconds;
  }

  // --------------------------------------------------------------- som
  // Camadas curtas de ruído filtrado e tom: cada evento tem timbre próprio,
  // em vez de variações do mesmo bipe.
  const sfx = {
    draw() {
      audio.tone({ freq: 110, dur: 0.22, type: 'sawtooth', vol: 0.018, slide: 1.7 });
      audio.noise({ dur: 0.24, vol: 0.014, cutoff: 800, cutoffEnd: 2200, filter: 'bandpass', q: 1.3, curve: 'rise' });
    },
    release() {
      audio.noise({ dur: 0.16, vol: 0.06, cutoff: 3400, cutoffEnd: 650, filter: 'bandpass', q: 1.5 });
      audio.tone({ freq: 200, dur: 0.1, type: 'triangle', vol: 0.035, slide: 0.4 });
    },
    whoosh() {
      audio.noise({ dur: 0.3, vol: 0.022, cutoff: 500, cutoffEnd: 1700, filter: 'bandpass', q: 0.8, curve: 'bump' });
    },
    apple() {
      audio.noise({ dur: 0.24, vol: 0.075, cutoff: 1800, cutoffEnd: 260, filter: 'bandpass', q: 0.7 });
      audio.tone({ freq: 430, dur: 0.13, type: 'sine', vol: 0.03, slide: 0.3 });
    },
    flesh() {
      audio.noise({ dur: 0.32, vol: 0.085, cutoff: 560, cutoffEnd: 170, curve: 'fall' });
      audio.tone({ freq: 82, dur: 0.24, type: 'sine', vol: 0.055, slide: 0.5 });
    },
    ground() {
      audio.noise({ dur: 0.13, vol: 0.05, cutoff: 750, cutoffEnd: 220 });
      audio.tone({ freq: 155, dur: 0.09, type: 'triangle', vol: 0.028, slide: 0.4 });
    },
    bodyDrop() {
      audio.noise({ dur: 0.38, vol: 0.06, cutoff: 320, cutoffEnd: 110 });
      audio.tone({ freq: 58, dur: 0.3, type: 'sine', vol: 0.05, slide: 0.62 });
    },
    step() {
      audio.noise({ dur: 0.07, vol: 0.02, cutoff: 900, cutoffEnd: 300 });
    },
    // Grito: dois harmônicos de serra descendo com um sopro por cima. Não é
    // uma voz de verdade, mas lê como dor — e varia a cada acerto.
    scream(strong) {
      const base = (strong ? 420 : 240) + Math.random() * 90;
      const dur = (strong ? 0.5 : 0.3) + Math.random() * 0.18;
      audio.tone({ freq: base, dur, type: 'sawtooth', vol: strong ? 0.05 : 0.034, slide: 0.42 });
      audio.tone({ freq: base * 1.5, dur: dur * 0.8, type: 'square', vol: 0.016, slide: 0.5 });
      audio.noise({ dur: dur * 0.9, vol: 0.03, cutoff: 1500, cutoffEnd: 480, filter: 'bandpass', q: 1.6, curve: 'bump' });
    },
    relief() {
      audio.noise({ dur: 0.4, vol: 0.022, cutoff: 900, cutoffEnd: 300, filter: 'bandpass', q: 0.9, curve: 'bump' });
    },
    bonus() {
      audio.tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.04, slide: 1.5 });
      audio.tone({ freq: 990, dur: 0.22, type: 'sine', vol: 0.035, slide: 1.34 });
      audio.noise({ dur: 0.2, vol: 0.02, cutoff: 2600, cutoffEnd: 900, filter: 'bandpass', q: 1.2 });
    }
  };

  // ------------------------------------------------------------------ cena
  const sceneFor = distance => layout(view, { distance });
  function rebuildScene() { scene = sceneFor(S.viewDistance); }
  const currentTarget = () => {
    const t = targetAt(scene, S.phase, S.clock, rules().motion);
    t.x += S.entry;
    return t;
  };
  const currentBody = (target = currentTarget()) =>
    bodyOf(scene, S.phase, target, { assist: rules().assist, apple: rules().apple });
  const currentBonus = () =>
    (S.bonusTaken ? null : bonusFor(scene, S.phase, S.levelIndex, S.seed, S.clock));

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
    const max = (S.phase.wind || 0) * rules().wind;
    if (!max) { S.wind = 0; return; }
    const rng = createRng((S.seed ^ (S.levelIndex * 7919) ^ (S.arrowsTotal * 104729)) >>> 0);
    S.wind = Math.round((rng.next() * 2 - 1) * max * 10) / 10;
  }

  function resetTarget() {
    // Quem levantar é outra pessoa: as flechas cravadas no corpo vão embora
    // com ele, só as do chão ficam.
    for (let i = S.stuck.length - 1; i >= 0; i--) if (S.stuck[i].onBody) S.stuck.splice(i, 1);
    S.wounded = false;
    S.lean = 0;
    S.fallT = 0;
    S.landed = false;
    S.woundOffset = null;
    S.targetArms = 'down';
    S.flinch = 0;
    S.bits.length = 0;
    S.loose = null;
    blood.healWound();
  }

  function loadLevel(index, travel = false) {
    const from = S.viewDistance;
    S.levelIndex = index;
    S.phase = phaseFor(S.mode, index, S.seed);
    S.arrowsHere = 0;
    S.outcome = '';
    S.bonusTaken = false;
    S.clock = 0;
    S.stuck.length = 0;
    S.arrow = null;
    resetTarget();
    blood.clear();
    theme.setAuto(S.phase.palette);
    aim.power = clamp(0.45 + S.phase.distance / 80, 0.4, 0.95);
    aim.angle = clamp(0.12 + S.phase.distance / 260, 0.1, 0.6);
    aim.pulling = false;
    aim.ready = true;

    if (travel) {
      S.travelFrom = from;
      S.travelT = 0;
      S.entry = TRAVEL.entry;
      S.shiftFrom = S.shift;
      // O cenário desliza e FICA deslizado: a câmera andou para trás, não
      // voltou. Os sprites são mais largos que a tela justamente para isso.
      S.shiftTo = clamp(S.shift + (S.phase.distance - from) * TRAVEL.parallax, 0, view.w * 0.5);
      S.state = 'travel';
    } else {
      S.viewDistance = S.phase.distance;
      S.entry = 0;
      S.walk = 0;
      S.shift = 0;
      S.state = 'ready';
      rebuildScene();
    }
    rollWind();
    hud.setHint(S.phase.hint);
    hudDirty = true;
    saveRun();
  }

  function startRun(mode, resume = null) {
    S.mode = mode;
    S.difficulty = settings.difficulty;
    S.seed = mode === 'daily' ? hashSeed(todaySeedLabel()) : (Math.random() * 2 ** 32) >>> 0;
    S.score = 0;
    S.lives = rules().lives;
    S.nextLifeScore = LIVES.scoreStep;
    S.streak = 0;
    S.bestStreak = 0;
    S.arrowsTotal = 0;
    S.hits = 0;
    S.victims = 0;
    S.shift = 0;
    if (resume) {
      S.difficulty = validDifficulty(resume.difficulty);
      settings.difficulty = S.difficulty;
      S.seed = resume.seed;
      S.score = resume.score;
      S.lives = resume.lives;
      S.nextLifeScore = resume.nextLifeScore ?? LIVES.scoreStep;
      S.streak = resume.streak || 0;
      S.arrowsTotal = resume.arrowsTotal || 0;
      S.hits = resume.hits || 0;
      S.victims = resume.victims || 0;
    }
    S.viewDistance = phaseFor(S.mode, resume ? resume.levelIndex : 0, S.seed).distance;
    dismiss();
    audio.resume();
    loadLevel(resume ? resume.levelIndex : 0);
  }

  function saveRun() {
    if (S.mode === 'daily') return;
    store.set(RUN_KEY, {
      mode: S.mode, difficulty: S.difficulty, seed: S.seed, levelIndex: S.levelIndex,
      score: S.score, lives: S.lives, nextLifeScore: S.nextLifeScore, streak: S.streak,
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
    if (S.state !== 'ready' || hud.dialogOpen || isPortrait()) return;
    const start = toMeters(handPoint());
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
    S.whooshed = false;
    aim.pulling = false;
    aim.ready = false;
    sfx.release();
    haptics.buzz(12);
    hudDirty = true;
  }

  function stickArrow(sx, sy, angle, onBody, bloodied = false) {
    const target = currentTarget();
    const entry = { x: sx, y: sy, angle, bloodied };
    if (onBody) { entry.dx = sx - target.x; entry.dy = sy - target.y; entry.onBody = true; }
    S.stuck.push(entry);
    if (S.stuck.length > 6) S.stuck.shift();
  }

  // Ponto preso ao alvo: o corpo tomba girando em torno dos pés, então a
  // flecha cravada e o ferimento precisam girar junto.
  function attached(offset) {
    const target = currentTarget();
    const cos = Math.cos(S.lean), sin = Math.sin(S.lean);
    return {
      x: target.x + offset.dx * cos - offset.dy * sin,
      y: target.y + offset.dx * sin + offset.dy * cos
    };
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
    const streakBonus = Math.min(SCORE.streakMax, S.streak * SCORE.streakStep);
    const first = S.arrowsHere === 1 ? SCORE.firstArrow : 0;
    const base = SCORE.hit + Math.round(S.phase.distance * SCORE.perMeter) +
                 Math.round(SCORE.precision * precision) + streakBonus + first;
    const total = Math.round(base * rules().bonus);

    S.streak++;
    S.hits++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak > 0 && S.streak % LIVES.streakStep === 0 && S.lives < LIVES.max) {
      S.lives++;
      hud.toast(`VIDA EXTRA · ${S.streak} acertos seguidos`, { priority: 2 });
    }
    addScore(total);

    // A maçã se parte em duas metades que voam para os lados.
    const r = body.apple.r;
    for (const side of [-1, 1]) {
      S.bits.push({
        x: body.apple.x, y: body.apple.y, r,
        vx: dir.vx * 0.12 + side * (FALL.bitsSpeed[0] + Math.random() * (FALL.bitsSpeed[1] - FALL.bitsSpeed[0])) * 0.5,
        vy: -60 - Math.random() * 90,
        rot: side > 0 ? 0 : Math.PI,
        spin: side * (3 + Math.random() * 4)
      });
    }
    blood.splash(point.x, point.y, dir.vx, dir.vy, 1, { colors: APPLE_COLORS, count: 30 });
    S.targetArms = 'up';                    // alívio: levanta os braços
    S.flinch = 1;                           // e ainda leva um susto
    S.flash = 0.3; S.flashTone = 'good';
    S.freeze = TIMING.freezeHit;
    S.shake = 5;
    sfx.apple();
    S.voiceIn = 0.22;
    S.voiceStrong = null;            // null = suspiro de alívio
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
    S.fallT = 0;
    S.landed = false;
    S.woundOffset = { dx: point.x - target.x, dy: point.y - target.y };
    // A maçã cai da cabeça junto com o corpo.
    S.loose = {
      x: body.apple.x, y: body.apple.y, r: body.apple.r,
      vx: dir.vx * 0.06 + 20, vy: -40, rot: 0, spin: FALL.appleSpin * (Math.random() > 0.5 ? 1 : -1)
    };
    blood.splash(point.x, point.y, dir.vx, dir.vy, 1.15);
    blood.setWound(point.x, point.y);
    S.flash = 0.5; S.flashTone = 'bad';
    S.shake = 18 * blood.level.shake;
    S.freeze = TIMING.freezeHit;
    sfx.flesh();
    // O grito entra logo depois do impacto, para não disputar vozes com ele.
    S.voiceIn = 0.1;
    S.voiceStrong = ['cabeça', 'peito', 'ombro'].includes(part);
    haptics.buzz([30, 40, 60]);
    showBanner(`ACERTOU ${part.toUpperCase()}`, 'bad', 1.8);
    S.outcome = 'person';
    S.resolveTime = TIMING.retry + FALL.time * 0.6;
    S.state = 'resolve';
    hudDirty = true;
  }

  function takeBonus(point, dir) {
    S.bonusTaken = true;
    const ganhou = S.lives < LIVES.max;
    if (ganhou) S.lives++;
    else addScore(BONUS.points);
    blood.splash(point.x, point.y, dir.vx, dir.vy, 1, { colors: SPARK_COLORS, count: BONUS.sparks });
    S.flash = 0.3; S.flashTone = 'good';
    sfx.bonus();
    haptics.buzz([10, 24, 10]);
    hud.toast(ganhou ? 'VIDA EXTRA · lanterna' : `LANTERNA · +${BONUS.points} pontos`, { priority: 2 });
    showBanner(ganhou ? 'VIDA EXTRA' : `LANTERNA · +${BONUS.points}`, 'good', 1.3);
    // Gastou a flecha, mas a sequência de acertos continua: pegar a lanterna
    // é uma escolha, não um erro.
    S.outcome = 'bonus';
    S.resolveTime = TIMING.retry * 0.65;
    S.state = 'resolve';
    hudDirty = true;
  }

  function missed(reason) {
    S.streak = 0;
    sfx.ground();
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
      loadLevel(next, true);
      return;
    }
    if (S.lives <= 0) { finish('over'); return; }
    if (S.outcome !== 'bonus') resetTarget();
    S.outcome = '';
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
    const key = `best-${S.mode}-${S.difficulty}`;
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
      tag: kind === 'win'
        ? (S.mode === 'daily' ? 'Desafio diário fechado' : 'Campanha completa')
        : 'Fim de jogo',
      title: kind === 'win' ? `Mão firme.<br>${done} maçãs.` : 'Sem vidas.',
      text: `${S.score} pontos · ${S.hits} maçãs em ${S.arrowsTotal} flechas (${accuracy}% de acerto) · ` +
            `${S.victims} ${S.victims === 1 ? 'pessoa atingida' : 'pessoas atingidas'}.`,
      action: 'Jogar de novo',
      note: `${DIFFICULTY[S.difficulty].label} · recorde ${record.score} pontos · melhor sequência ${record.streak}`
    });
    hudDirty = true;
  }

  // ------------------------------------------------------------------ mira
  function applyPointer() {
    const dx = input.state.x - aim.anchorX;
    const dy = input.state.y - aim.anchorY;
    const pull = Math.hypot(dx, dy);
    if (pull < 0.5) return;
    // Tiro na direção oposta ao arrasto. O y da tela cresce para baixo e o do
    // tiro para cima, e é esse par de inversões que faz o dy entrar positivo.
    aim.angle = clamp(Math.atan2(dy, -dx), PHYSICS.minAngle, PHYSICS.maxAngle);
    const before = aim.power;
    aim.power = clamp(pull / AIM.maxPull, 0, 1);
    if (before < 0.35 && aim.power >= 0.35) sfx.draw();
  }

  // A linha de tiro mostra só a fração que a dificuldade permite: no fácil a
  // trajetória inteira, no mestre nada.
  function guidePoints() {
    const share = rules().guide;
    if (!settings.guide || share <= 0 || S.state !== 'ready') return null;
    const start = toMeters(handPoint());
    const speed = PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * aim.power;
    let x = start.x, y = start.y;
    let vx = Math.cos(aim.angle) * speed, vy = Math.sin(aim.angle) * speed;
    const steps = Math.max(3, Math.round(AIM.guideSteps * share));
    const points = [];
    for (let i = 0; i < steps; i++) {
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
    if (!S.whooshed && a.t > 0.09) { S.whooshed = true; sfx.whoosh(); }
    const after = toScreen(a);

    const target = currentTarget();
    const body = currentBody(target);
    const hit = firstHit(before.x, before.y, after.x, after.y, body);

    // A lanterna disputa o instante do contato com o alvo: quem vier primeiro
    // no trecho é quem a flecha acerta.
    const bonus = currentBonus();
    if (bonus) {
      const tb = segmentCircle(before.x, before.y, after.x, after.y, bonus.x, bonus.y, bonus.hitR);
      if (tb >= 0 && (!hit || tb < hit.t)) {
        const point = {
          x: before.x + (after.x - before.x) * tb,
          y: before.y + (after.y - before.y) * tb
        };
        const dir = { vx: a.vx, vy: -a.vy };
        S.arrow = null;
        takeBonus(point, dir);
        return;
      }
    }

    if (hit) {
      const point = {
        x: before.x + (after.x - before.x) * hit.t,
        y: before.y + (after.y - before.y) * hit.t
      };
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const dir = { vx: a.vx, vy: -a.vy };
      S.arrow = null;
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
      const t = clamp((scene.groundY - before.y) / Math.max(0.0001, after.y - before.y), 0, 1);
      const x = before.x + (after.x - before.x) * t;
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

  // Pedaços de maçã e maçã solta caem com gravidade simples de tela.
  function stepDebris(dt) {
    for (let i = S.bits.length - 1; i >= 0; i--) {
      const b = S.bits[i];
      b.vy += GRAVITY_PX * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.y >= scene.groundY - b.r * 0.4) {
        b.y = scene.groundY - b.r * 0.4;
        b.vy *= -0.28;
        b.vx *= 0.6;
        b.spin *= 0.5;
        if (Math.abs(b.vy) < 12) { b.vy = 0; b.spin = 0; }
      }
    }
    const l = S.loose;
    if (l) {
      l.vy += GRAVITY_PX * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.rot += l.spin * dt;
      if (l.y >= scene.groundY - l.r * 0.8) {
        l.y = scene.groundY - l.r * 0.8;
        if (l.vy > 60) sfx.step();
        l.vy *= -0.3;
        l.vx *= 0.7;
        l.spin *= 0.6;
        if (Math.abs(l.vy) < 14) { l.vy = 0; l.spin = 0; }
      }
    }
  }

  // Queda do alvo: acelera como tombo de verdade e dá um tranco ao bater.
  function stepFall(dt) {
    if (!S.wounded || S.landed) return;
    S.fallT = Math.min(1, S.fallT + dt / FALL.time);
    const t = S.fallT;
    S.lean = FALL.angle * (t * t * (3 - 2 * t));
    if (t >= 1) {
      S.landed = true;
      S.lean = FALL.angle;
      S.shake = Math.max(S.shake, 7 * blood.level.shake);
      sfx.bodyDrop();
    }
  }

  function stepTravel(dt) {
    S.travelT = Math.min(1, S.travelT + dt / TRAVEL.time);
    const e = easeInOut(S.travelT);
    S.viewDistance = S.travelFrom + (S.phase.distance - S.travelFrom) * e;
    S.shift = S.shiftFrom + (S.shiftTo - S.shiftFrom) * e;
    rebuildScene();
    // O alvo novo entra caminhando na primeira parte da transição.
    const w = clamp(S.travelT / TRAVEL.walkIn, 0, 1);
    S.entry = TRAVEL.entry * (1 - easeOut(w));
    S.walk = w < 1 ? S.walk + dt * 13 : 0;
    if (S.travelT >= 1) {
      S.entry = 0;
      S.walk = 0;
      S.shift = S.shiftTo;
      S.state = 'ready';
      hudDirty = true;
    }
  }

  function update(dt) {
    if (['intro', 'paused', 'over', 'win'].includes(S.state)) return;

    if (S.bannerTime > 0) { S.bannerTime -= dt; if (S.bannerTime <= 0) S.banner = ''; }
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 1.8);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
    if (S.flinch > 0) S.flinch = Math.max(0, S.flinch - dt * 2.2);
    if (S.voiceIn > 0) {
      S.voiceIn -= dt;
      if (S.voiceIn <= 0) {
        if (S.voiceStrong === null) sfx.relief(); else sfx.scream(S.voiceStrong);
      }
    }
    if (S.blink > 0) S.blink = Math.max(0, S.blink - dt);
    else {
      S.blinkIn -= dt;
      if (S.blinkIn <= 0) {
        S.blink = FACE.blinkTime;
        S.blinkIn = FACE.blinkEvery[0] + Math.random() * (FACE.blinkEvery[1] - FACE.blinkEvery[0]);
      }
    }
    blood.update(dt, scene.groundY);
    stepDebris(dt);
    stepFall(dt);
    if (S.wounded && S.woundOffset) {
      const p = attached(S.woundOffset);
      blood.setWound(p.x, p.y);
    }

    if (S.freeze > 0) { S.freeze -= dt; return; }

    if (S.state === 'travel') { stepTravel(dt); return; }
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
    syncOrientation();
    if (isPortrait()) {
      renderer.drawRotate();
      hud.tickToast(dt);
      if (hudDirty) { syncHud(); hudDirty = false; }
      hud.flush();
      return;
    }

    const target = currentTarget();
    const body = currentBody(target);
    const arrow = S.arrow ? { ...toScreen(S.arrow), vx: S.arrow.vx, vy: -S.arrow.vy } : null;
    const stuck = S.stuck.map(a => {
      if (!a.onBody) return a;
      const p = attached(a);
      return { ...a, x: p.x, y: p.y, angle: a.angle + S.lean };
    });

    const targetFace = S.wounded ? 'dor'
      : S.outcome === 'apple' ? 'alivio'
      : (aim.pulling && aim.power > 0.22) || S.state === 'flying' ? 'medo'
      : 'neutro';

    renderer.draw({
      scene, phase: S.phase, distance: S.viewDistance, target, body, stuck, arrow,
      bonus: currentBonus(),
      targetFace, archerFace: aim.pulling ? 'mira' : 'neutro', blink: S.blink,
      archer: { x: scene.x0, y: scene.groundY },
      aim, guide: guidePoints(),
      blood, wind: S.wind, clock: S.clock, shift: S.shift, walk: S.walk,
      wounded: S.wounded,
      // Tremor de nervoso enquanto a corda é puxada, e susto ao ver a maçã ir.
      lean: S.lean + (S.flinch > 0 ? Math.sin(S.flinch * 22) * 0.05 : 0) +
            (targetFace === 'medo' ? Math.sin(S.clock * 17) * 0.009 : 0),
      targetArms: S.targetArms,
      showApple: !S.wounded && S.outcome !== 'apple',
      bits: S.bits, loose: S.loose,
      flash: S.flash, flashTone: S.flashTone, shake: S.shake,
      banner: S.banner, bannerTone: S.bannerTone,
      difficulty: S.difficulty,
      stats: loopStats
    });

    hud.tickToast(dt);
    if (hudDirty) { syncHud(); hudDirty = false; }
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
    chips.push({ text: DIFFICULTY[S.difficulty].label, tone: 'accent' });
    if (S.streak > 1) chips.push({ text: `${S.streak} seguidas`, tone: 'accent' });
    if (S.arrowsHere > 0) chips.push({ text: `${S.arrowsHere} flecha${S.arrowsHere === 1 ? '' : 's'} nesta fase` });
    chips.push({ text: modeInfo().label, tone: 'flow' });
    hud.setChips(chips, `Fase ${levelLabel()}, ${S.phase.distance} metros, ${S.lives} vidas`);
    hud.setPause(S.state === 'paused', !['intro', 'over', 'win'].includes(S.state));
  }

  // ------------------------------------------------------------- interface
  input.on('press', p => {
    if (hud.dialogOpen || isPortrait() || S.state !== 'ready') return;
    aim.pulling = true;
    aim.anchorX = p.x;
    aim.anchorY = p.y;
  });

  input.on('release', () => {
    if (!aim.pulling) return;
    const pull = Math.hypot(input.state.x - aim.anchorX, input.state.y - aim.anchorY);
    aim.pulling = false;
    if (S.state !== 'ready' || hud.dialogOpen || isPortrait()) return;
    if (pull < AIM.minPull) { showBanner('TIRO CANCELADO', '', 0.9); return; }
    fire();
  });

  input.on('key', event => {
    if (hud.dialogOpen || isPortrait()) return;
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
      else if (['intro', 'over', 'win'].includes(S.state)) primaryAction();
      else if (S.state === 'paused') resume();
    }
  });

  function primaryAction() {
    if (hud.dialogOpen || isPortrait()) return;
    if (S.state === 'paused') { resume(); return; }
    if (S.state === 'intro') {
      const run = savedRun();
      if (run) { startRun(run.mode, run); return; }
    }
    startRun(settings.mode);
  }

  function secondaryAction() {
    if (hud.dialogOpen || isPortrait()) return;
    if (['intro', 'paused'].includes(S.state)) { clearRun(); startRun(settings.mode); }
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
    if (S.state !== 'paused' || hud.dialogOpen || isPortrait()) return;
    S.state = ['flying', 'travel', 'resolve'].includes(pausedFrom) ? pausedFrom : 'ready';
    pausedFrom = null;
    audio.resume();
    dismiss();
    hudDirty = true;
  }

  function openSettings() {
    const playing = !['intro', 'over', 'win', 'paused'].includes(S.state);
    if (playing) pause();
    const records = {};
    for (const mode of Object.keys(MODES)) {
      records[mode] = store.get(`best-${mode}-${settings.difficulty}`, { score: 0, level: 0, streak: 0 });
    }
    const node = buildDialog({
      settings, theme, audio, haptics, modes: MODES, records,
      onMode: value => {
        settings.mode = value;
        store.set('mode', value);
        hud.toast('O modo vale a partir da próxima partida', { priority: 2 });
      },
      onDifficulty: value => {
        settings.difficulty = validDifficulty(value);
        store.set('difficulty', settings.difficulty);
        hud.toast('A dificuldade vale a partir da próxima partida', { priority: 2 });
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
    wasPortrait = null;
    hudDirty = true;
  }

  rebuildScene();
  hud.setHint('Arraste para trás e solte · <strong>como puxar a corda</strong>');
  function showIntro() {
    const run = savedRun();
    const best = store.get(`best-${settings.mode}-${settings.difficulty}`, { score: 0, level: 0, streak: 0 });
    present({
      tag: 'Tiro ao alvo',
      title: 'A maçã está<br>na cabeça dele.',
      text: run
        ? `Você parou na fase ${run.levelIndex + 1} com ${run.score} pontos.`
        : 'Puxe a corda arrastando para trás e solte. Acertar a pessoa custa uma vida — e sangue.',
      action: run ? 'Continuar' : 'Começar',
      secondary: run ? 'Nova partida' : null,
      note: `${MODES[settings.mode].label} · ${DIFFICULTY[settings.difficulty].label} · recorde ${best.score} pontos`
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
      state: S.state, mode: S.mode, difficulty: S.difficulty, level: S.levelIndex + 1,
      phase: S.phase.name, distance: S.phase.distance, wind: S.wind, score: S.score,
      lives: S.lives, streak: S.streak, arrows: S.arrowsTotal, hits: S.hits,
      victims: S.victims, wounded: S.wounded, blood: settings.blood, particles: blood.count,
      bonus: !!currentBonus(), bonusTaken: S.bonusTaken, portrait: isPortrait()
    }),
    inspect: () => ({ S, aim, scene, settings, blood }),
    applePoint: () => currentBody().apple,
    bonusPoint: () => currentBonus(),
    destroy: () => {
      input.destroy();
      app.classList.remove('arrow-app');
      document.body.classList.remove('arrow-body');
    }
  };
}
