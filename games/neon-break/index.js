import { sweepCircleRect, overlapCircleRect, clamp } from '../../core/collide.js';
import { hashSeed, todaySeedLabel } from '../../core/rng.js';
import { FIELD, BALL, PADDLE, SPEED, BRICK, DROP, LASER, EFFECTS, SCORE, LIVES, MAX_BALLS, logicalSize }
  from './config.js';
import { BRICKS, POWERS, brickDef } from './content.js';
import { PHASES, generatePhase, phaseSpeed } from './levels.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';

export const meta = {
  id: 'neon-break',
  title: 'NEON<span>BREAK</span>',
  subtitle: 'LIBRARY EDITION / 03',
  arenaLabel: 'Área de jogo. Deslize o dedo para mover a plataforma.',
  logicalSize,
  stats: [
    { id: 'score', label: 'Pontos', accent: true, flex: '1.05fr' },
    { id: 'level', label: 'Fase', flex: '.95fr' },
    { id: 'lives', label: 'Vidas', type: 'hearts', flex: '1fr' }
  ]
};

const MODES = {
  campaign: { label: 'Campanha', phases: PHASES.length },
  endless:  { label: 'Infinito', phases: Infinity },
  daily:    { label: 'Desafio diário', phases: 5 }
};

export function create(services) {
  const { viewport, input, audio, haptics, theme, store, hud, debug } = services;
  const loopStats = services.stats || {};
  const view = viewport.view;
  const renderer = createRenderer(viewport, theme, debug);

  // ---------------------------------------------------------------- estado
  const S = {
    state: 'intro',           // intro | ready | playing | paused | life | between | over | win
    mode: store.get('mode', 'campaign'),
    seed: 1,
    levelIndex: 0,
    phase: PHASES[0],
    score: 0,
    lives: LIVES.start,
    nextLifeScore: LIVES.scoreStep,
    fromStart: true,        // a partida começou na arena 1?
    levelStartScore: 0,     // pontuação ao entrar na arena atual
    remaining: 0,
    broken: 0,
    combo: 0,
    maxCombo: 0,
    ceilingGain: 1,
    stallTimer: 0,
    levelDeaths: 0,
    clock: 0,
    shake: 0,
    freeze: 0,
    bricks: [],
    balls: [],
    drops: [],
    shots: [],
    particles: [],
    floats: [],
    rings: [],
    effects: { wide: 0, slow: 0, fast: 0, laser: 0, magnet: 0, pierce: 0, narrow: 0, invert: 0, shield: 0 },
    laserCooldown: 0,
    bounds: { left: FIELD.wallX, right: FIELD.w - FIELD.wallX, top: FIELD.hudBand, bottom: 600 },
    layout: { cell: BRICK.cellMax, h: BRICK.h, top: BRICK.top, bw: 42 },
    paddle: { x: 200, y: 500, w: PADDLE.wBase, h: PADDLE.h, dx: 0, vx: 0, target: 200 },
    hintShown: store.get('hintShown', false)
  };

  const settings = {
    control: store.get('control', 'absolute'),
    assist: store.get('assist', false),
    effectsLevel: store.get('effectsLevel', 'full'),
    sensitivity: store.get('sensitivity', 1.6)
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowEffects = () => settings.effectsLevel === 'low' || reducedMotion;

  let ballId = 0;
  let pendingRun = null;
  let hudDirty = true;
  let levelCleared = false;
  let pendingLifeLoss = false;

  // ------------------------------------------------------------- geometria
  function applyBounds() {
    S.bounds.bottom = view.h;
    S.paddle.y = view.h - PADDLE.bottom;
  }

  const brickWidth = () =>
    (FIELD.w - BRICK.marginX * 2 - (BRICK.cols - 1) * BRICK.gapX) / BRICK.cols;

  // A grade é calculada UMA VEZ por fase e congelada. Mudar a altura do campo
  // no meio da partida (barra de endereço do celular, rotação, teclado) move a
  // plataforma e o fundo, mas nunca desloca um bloco em relação à bola — que
  // era a origem das colisões aparentemente sem contato.
  function computeLayout(rows) {
    const paddleY = view.h - PADDLE.bottom;
    const room = paddleY - BRICK.top - BRICK.clearance;
    const cell = clamp(room / Math.max(1, rows), BRICK.cellMin, BRICK.cellMax);
    // O vão vertical precisa ser maior que o diâmetro da bola, senão um
    // corredor que parece aberto na tela é intransponível de fato.
    const h = clamp(cell - BRICK.gapYMin, BRICK.hMin, BRICK.h);
    return { cell, h, top: BRICK.top, bw: brickWidth() };
  }

  function layoutBrick(b) {
    const L = S.layout;
    b.w = L.bw;
    b.h = L.h;
    b.baseX = BRICK.marginX + b.col * (L.bw + BRICK.gapX);
    b.y = L.top + b.row * L.cell;
    b.x = b.baseX + (b.moving ? Math.sin(b.phase) * L.bw * BRICK.moveAmplitude : 0);
  }


  // ------------------------------------------------------------ velocidade
  const paddleWidth = () => {
    if (S.effects.narrow > 0) return PADDLE.wNarrow;
    if (S.effects.wide > 0) return PADDLE.wWide;
    const base = Math.max(PADDLE.wMin, PADDLE.wBase - S.levelIndex * PADDLE.wPerLevel);
    return settings.assist ? base + 18 : base;
  };
  const ballRadius = () => (settings.assist ? BALL.rAssist : BALL.r);

  function baseSpeed() {
    const phase = phaseSpeed(S.phase, S.levelIndex);
    return phase + Math.min(S.broken * SPEED.perBrick, SPEED.perBrickMax);
  }
  function speedFactor() {
    let f = S.ceilingGain;
    if (S.effects.slow > 0) f *= SPEED.slow;
    else if (S.effects.fast > 0) f *= SPEED.fast;
    if (settings.assist) f *= SPEED.assist;
    if (S.stallTimer > SPEED.stallAfter) {
      f *= Math.min(SPEED.stallMax, 1 + (S.stallTimer - SPEED.stallAfter) * SPEED.stallRate);
    }
    return f;
  }
  const currentSpeed = () => Math.min(BALL.maxSpeed, baseSpeed() * speedFactor());
  const speedRatio = () => currentSpeed() / SPEED.phase[0];

  function normalizeSpeed(b) {
    const m = Math.hypot(b.vx, b.vy);
    if (m < 1e-6) return;
    const s = currentSpeed();
    b.vx = b.vx / m * s;
    b.vy = b.vy / m * s;
  }

  // Impede a trajetória rasante que trava a bola raspando o teto. A correção é
  // de no máximo 12° e só atua no caso degenerado — não é um empurrão aleatório.
  function enforceAngle(b) {
    const s = Math.hypot(b.vx, b.vy);
    if (s < 1e-6) return;
    const minVy = Math.sin(BALL.minAngleDeg * Math.PI / 180) * s;
    if (Math.abs(b.vy) < minVy) {
      const sign = b.vy < 0 ? -1 : 1;
      b.vy = sign * minVy;
      const vxMag = Math.sqrt(Math.max(0, s * s - b.vy * b.vy));
      b.vx = (b.vx < 0 ? -1 : 1) * vxMag;
      debug.event('ângulo mínimo aplicado');
    }
  }

  // ---------------------------------------------------------------- blocos
  function makeBrick(row, col, kind) {
    const def = brickDef(kind);
    const b = {
      row, col, kind,
      hp: def.hp, maxHp: def.hp,
      flash: 0, x: 0, y: 0, w: 0, h: 0, baseX: 0,
      moving: !!def.moving,
      phase: (row * 3 + col) * 0.9,
      regen: 0, spawn: def.spawner ? BRICK.spawnTime : 0,
      twinOf: null
    };
    layoutBrick(b);
    return b;
  }

  function currentPhaseData(index) {
    if (S.mode === 'campaign') return PHASES[Math.min(index, PHASES.length - 1)];
    if (S.mode === 'daily') {
      return index < PHASES.length
        ? PHASES[index]
        : generatePhase(index, S.seed);
    }
    return generatePhase(index, S.seed);
  }

  function setupLevel() {
    S.phase = currentPhaseData(S.levelIndex);
    S.layout = computeLayout(S.phase.map.length);
    S.bricks = [];
    S.particles = []; S.floats = []; S.rings = []; S.shots = [];
    S.combo = 0; S.maxCombo = 0; S.broken = 0; S.ceilingGain = 1;
    S.stallTimer = 0; S.levelDeaths = 0;
    resetEffects();
    hud.clearToast();

    const twins = [];
    S.phase.map.forEach((row, r) => {
      [...row].forEach((kind, c) => {
        if (kind === '.' || !BRICKS[kind]) return;
        const brick = makeBrick(r, c, kind);
        if (brickDef(kind).twin) twins.push(brick);
        S.bricks.push(brick);
      });
    });
    for (let i = 0; i + 1 < twins.length; i += 2) {
      twins[i].twinOf = twins[i + 1];
      twins[i + 1].twinOf = twins[i];
    }

    S.remaining = countRemaining();
    S.levelStartScore = S.score;
    markUnlocked(S.levelIndex);
    theme.setAuto(S.phase.palette);
    renderer.invalidate();
    S.paddle.x = S.paddle.target = FIELD.w / 2;
    S.paddle.w = paddleWidth();
    attachBall();
    hudDirty = true;
  }

  const countRemaining = () => S.bricks.filter(b => b.hp > 0 && !brickDef(b.kind).steel).length;

  // ----------------------------------------------------------------- bolas
  function makeBall(x, y, vx = 0, vy = 0) {
    return { id: ++ballId, x, y, vx, vy, r: ballRadius(), trail: [], held: null,
             prevX: x, prevY: y, flat: 0 };
  }

  function attachBall() {
    const b = makeBall(S.paddle.x, S.paddle.y - ballRadius() - 1);
    b.held = { offset: 0, timer: 0 };
    S.balls = [b];
  }

  function launchHeld(b) {
    if (!b.held) return;
    const speed = currentSpeed();
    const spread = PADDLE.spreadDeg * Math.PI / 180;
    const angle = clamp(b.held.offset, -1, 1) * spread;
    b.vx = Math.sin(angle) * speed;
    b.vy = -Math.cos(angle) * speed;
    b.held = null;
    enforceAngle(b);
    audio.tone({ freq: 460, dur: 0.1, type: 'triangle', vol: 0.05 });
    haptics.buzz(10);
  }

  // --------------------------------------------------------------- efeitos
  function resetEffects() {
    S.effects = { wide: 0, slow: 0, fast: 0, laser: 0, magnet: 0, pierce: 0, narrow: 0, invert: 0, shield: 0 };
    S.drops = [];
    S.shots = [];
    S.laserCooldown = 0;
    input.setInverted(false);
    S.paddle.w = paddleWidth();
    S.paddle.x = clamp(S.paddle.x, S.paddle.w / 2 + FIELD.wallX, FIELD.w - S.paddle.w / 2 - FIELD.wallX);
    S.paddle.target = S.paddle.x;
  }

  function collect(kind) {
    const power = POWERS[kind];
    if (!power) return;
    const tone = power.bad ? 'warn' : '';
    switch (kind) {
      case 'M': {
        const source = S.balls.find(b => !b.held) || S.balls[0];
        let added = 0;
        if (source) {
          const heading = source.held ? -Math.PI / 2 : Math.atan2(source.vy, source.vx);
          for (const offset of [-0.47, 0.47]) {
            if (S.balls.length >= MAX_BALLS) break;
            const a = heading + offset;
            const nb = makeBall(source.x, source.y, Math.cos(a), Math.sin(a));
            normalizeSpeed(nb); enforceAngle(nb);
            S.balls.push(nb);
            added++;
          }
        }
        if (added) hud.toast(`MULTIBOLA · ${S.balls.length} bolinhas`, { priority: 2 });
        else { addPoints(100); hud.toast('Bolinhas no máximo · bônus extra', { priority: 2 }); }
        break;
      }
      case 'W':
        S.effects.wide = EFFECTS.wide; S.effects.narrow = 0;
        hud.toast('EXPANSÃO · 12 segundos', { priority: 2 }); break;
      case 'N':
        S.effects.narrow = EFFECTS.narrow; S.effects.wide = 0;
        hud.toast('ENCOLHER · 8 segundos', { priority: 2, tone }); break;
      case 'S':
        S.effects.slow = EFFECTS.slow; S.effects.fast = 0;
        hud.toast('CÂMERA LENTA · 10 segundos', { priority: 2 }); break;
      case 'F':
        S.effects.fast = EFFECTS.fast; S.effects.slow = 0;
        hud.toast('TURBO · 8s com pontos em dobro', { priority: 2 }); break;
      case 'H':
        S.effects.shield = EFFECTS.shieldCharges;
        hud.toast('ESCUDO · 2 quedas protegidas', { priority: 2 }); break;
      case 'P': {
        const n = addPoints(SCORE.bonusCapsule);
        hud.toast(`BÔNUS · +${n} pontos`, { priority: 2 }); break;
      }
      case 'L':
        S.effects.laser = EFFECTS.laser;
        hud.toast('LASER · toque para atirar', { priority: 2 }); break;
      case 'K':
        S.effects.magnet = EFFECTS.magnet;
        hud.toast('ÍMÃ · a plataforma segura a bola', { priority: 2 }); break;
      case 'B':
        S.effects.pierce = EFFECTS.pierce;
        hud.toast('PERFURANTE · 8 segundos', { priority: 2 }); break;
      case 'I':
        S.effects.invert = EFFECTS.invert; input.setInverted(true);
        hud.toast('CONTROLES INVERTIDOS · 5s', { priority: 2, tone }); break;
      case 'E':
        grantLife('cápsula ♥'); break;
    }
    S.paddle.w = paddleWidth();
    burst(S.paddle.x, S.paddle.y, power.bad ? theme.tokens.warn : theme.tokens.accent, 14);
    audio.tone({ freq: power.bad ? 240 : 740, dur: 0.14, type: 'triangle', vol: 0.055 });
    haptics.buzz(power.bad ? [12, 40, 12] : 14);
    hudDirty = true;
  }

  // -------------------------------------------------------------- pontuação
  function addPoints(n) {
    const amount = Math.round(n * (S.effects.fast > 0 ? 2 : 1));
    S.score += amount;
    hudDirty = true;
    checkLifeMilestone();
    return amount;
  }

  // Marco de pontos: uma vida a cada LIVES.scoreStep. O alvo avança antes de
  // conceder, então o bônus de vidas cheias nunca realimenta o laço.
  function checkLifeMilestone() {
    while (S.score >= S.nextLifeScore) {
      S.nextLifeScore += LIVES.scoreStep;
      grantLife('marco de ' + S.nextLifeScore.toLocaleString('pt-BR') + ' pontos');
    }
  }

  function grantLife(reason) {
    if (S.lives >= LIVES.max) {
      S.score += LIVES.maxBonus;
      hud.toast(`Vidas no máximo · +${LIVES.maxBonus} pontos`, { priority: 2 });
      hudDirty = true;
      return false;
    }
    S.lives++;
    burst(S.paddle.x, S.paddle.y, theme.tokens.accent, 16);
    audio.tone({ freq: 620, dur: 0.14, type: 'triangle', vol: 0.055 });
    audio.tone({ freq: 930, dur: 0.16, type: 'triangle', vol: 0.045 });
    haptics.buzz([12, 30, 12]);
    hud.toast(`VIDA EXTRA · ${S.lives} vidas`, { priority: 2 });
    hud.announce('Vida extra por ' + reason + '. Agora com ' + S.lives + ' vidas.');
    hudDirty = true;
    return true;
  }

  function burst(x, y, color, count = 10) {
    if (lowEffects()) return;
    const max = settings.effectsLevel === 'medium' ? 90 : 200;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 35 + Math.random() * 110;
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                         life: 0.3 + Math.random() * 0.3, color, size: 1.4 + Math.random() * 2 });
    }
    if (S.particles.length > max) S.particles.splice(0, S.particles.length - max);
  }

  function float(x, y, text) {
    if (lowEffects()) return;
    S.floats.push({ x, y, text, life: 0.7 });
  }

  // ------------------------------------------------------------ dano/blocos
  function cellFree(row, col) {
    if (row < 0 || col < 0 || col >= BRICK.cols || row >= BRICK.rows) return false;
    return !S.bricks.some(b => b.hp > 0 && b.row === row && b.col === col);
  }

  function spawnDrop(brick) {
    const def = brickDef(brick.kind);
    if (!def.power) return;
    S.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, kind: def.power,
                   w: DROP.w, h: DROP.h,
                   vy: Math.min(DROP.vyMax, DROP.vy + S.levelIndex * DROP.vyPerLevel) });
    if (!S.hintShown) {
      S.hintShown = true;
      store.set('hintShown', true);
      hud.toast(`Capture a cápsula ${POWERS[def.power].symbol}`, { priority: 2 });
    }
  }

  function damageBrick(first, amount = 1) {
    if (S.state !== 'playing' || first.hp <= 0) return;
    const def = brickDef(first.kind);
    if (def.steel) {
      first.flash = 0.1;
      audio.tone({ freq: 190, dur: 0.03, type: 'triangle', vol: 0.025 });
      return;
    }

    const queue = [[first, amount]];
    const seen = new Set();
    let destroyed = 0;

    while (queue.length) {
      const [b, hits] = queue.shift();
      if (seen.has(b) || b.hp <= 0 || brickDef(b.kind).steel) continue;
      seen.add(b);
      b.hp -= hits;
      b.flash = 0.13;
      burst(b.x + b.w / 2, b.y + b.h / 2, renderer.brickColor(b, S.levelIndex), b.hp > 0 ? 5 : 10);

      if (b.hp > 0) {
        audio.tone({ freq: 260, dur: 0.045, type: 'square', vol: 0.025 });
        continue;
      }

      // Destruído.
      S.broken++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.remaining = Math.max(0, S.remaining - 1);
      destroyed++;
      const points = addPoints(SCORE.brick * Math.min(S.combo, SCORE.comboCap));
      float(b.x + b.w / 2, b.y, '+' + points);
      spawnDrop(b);

      const bd = brickDef(b.kind);
      if (bd.regen) b.regen = BRICK.regenTime;
      if (bd.twin && b.twinOf && b.twinOf.hp > 0) queue.push([b.twinOf, b.twinOf.hp]);
      if (bd.explosive) {
        if (!lowEffects()) S.rings.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: 8, life: 0.42 });
        for (const n of S.bricks) {
          if (n === b || n.hp <= 0 || brickDef(n.kind).steel) continue;
          if (Math.abs(n.row - b.row) <= 1 && Math.abs(n.col - b.col) <= 1) queue.push([n, 1]);
        }
        audio.tone({ freq: 130, dur: 0.15, type: 'sawtooth', vol: 0.03 });
        S.shake = Math.min(1, S.shake + 0.5);
      }
    }

    if (destroyed) {
      S.stallTimer = 0;
      S.freeze = lowEffects() ? 0 : Math.min(0.045, 0.018 * destroyed);
      audio.tone({ freq: 400 + Math.min(S.combo, 8) * 65, dur: 0.05, type: 'triangle', vol: 0.04 });
      haptics.buzz(8);
      if (S.combo >= 5 && S.combo % 5 === 0) hud.toast(`COMBO ×${S.combo}`);
      else if (S.combo === 3) hud.toast('COMBO ×3');
      if (S.remaining === 0) levelCleared = true;
    }
    hudDirty = true;
  }

  function updateBricks(dt) {
    for (const b of S.bricks) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);

      if (b.hp <= 0) {
        if (b.regen > 0) {
          b.regen -= dt;
          if (b.regen <= 0 && cellFree(b.row, b.col)) {
            b.hp = b.maxHp;
            b.flash = 0.2;
            S.remaining++;
            audio.tone({ freq: 320, dur: 0.09, type: 'sine', vol: 0.03 });
            hudDirty = true;
          }
        }
        continue;
      }

      if (b.moving) {
        b.phase += dt * BRICK.moveSpeed * Math.PI * 2;
        const bw = brickWidth();
        const next = b.baseX + Math.sin(b.phase) * bw * BRICK.moveAmplitude;
        // Só desliza enquanto houver espaço livre nas células vizinhas.
        const dir = next > b.baseX ? 1 : -1;
        if (cellFree(b.row, b.col + dir) || Math.abs(next - b.baseX) < Math.abs(b.x - b.baseX)) b.x = next;
      }

      if (brickDef(b.kind).spawner) {
        b.spawn -= dt;
        if (b.spawn <= 0) {
          b.spawn = BRICK.spawnTime;
          const spots = [[b.row, b.col - 1], [b.row, b.col + 1], [b.row - 1, b.col], [b.row + 1, b.col]]
            .filter(([r, c]) => cellFree(r, c));
          if (spots.length) {
            const [r, c] = spots[Math.floor(Math.random() * spots.length)];
            const nb = makeBrick(r, c, 'o');
            nb.flash = 0.25;
            S.bricks.push(nb);
            S.remaining++;
            audio.tone({ freq: 210, dur: 0.1, type: 'sine', vol: 0.028 });
            hudDirty = true;
          }
        }
      }
    }
  }

  // --------------------------------------------------------------- colisão
  //
  // Um passo de física = varredura contínua. Para cada trecho do movimento
  // procuramos o PRIMEIRO contato no tempo entre paredes, plataforma, escudo e
  // blocos. Resolver na ordem correta é o que elimina o ângulo errado e o
  // quique duplo que pareciam colisão fantasma.
  function findHit(b, dx, dy, frac) {
    let best = null;
    const consider = (h, type, payload) => {
      if (!h || h.t < 0 || h.t >= 1) return;
      if (!best || h.t < best.t) best = { t: h.t, nx: h.nx, ny: h.ny, corner: h.corner, type, payload };
    };

    const r = b.r, B = S.bounds;
    if (dx < 0) { const t = (B.left + r - b.x) / dx; consider({ t, nx: 1, ny: 0 }, 'wall'); }
    if (dx > 0) { const t = (B.right - r - b.x) / dx; consider({ t, nx: -1, ny: 0 }, 'wall'); }
    if (dy < 0) { const t = (B.top + r - b.y) / dy; consider({ t, nx: 0, ny: 1 }, 'ceiling'); }

    // Plataforma tratada como CÁPSULA: é exatamente a forma desenhada
    // (retângulo de cantos redondos com raio = altura/2).
    const ph = S.paddle.h / 2;
    const coreW = Math.max(0, S.paddle.w - S.paddle.h);
    const px = S.paddle.x - coreW / 2;
    const py = S.paddle.y + ph;
    // O movimento da plataforma entra na conta: sem isso ela "aparece" sob a
    // bola em arrancadas rápidas.
    const relDx = dx - S.paddle.dx * frac;
    consider(sweepCircleRect(b.x, b.y, r + ph, relDx, dy, px, py, coreW, 0), 'paddle');

    if (S.effects.shield > 0 && dy > 0) {
      const shieldY = S.paddle.y + PADDLE.shieldGap;
      const t = (shieldY - r - b.y) / dy;
      consider({ t, nx: 0, ny: -1 }, 'shield');
    }

    // Fase larga simples: descarta blocos fora do envelope do movimento.
    const minX = Math.min(b.x, b.x + dx) - r, maxX = Math.max(b.x, b.x + dx) + r;
    const minY = Math.min(b.y, b.y + dy) - r, maxY = Math.max(b.y, b.y + dy) + r;
    for (const brick of S.bricks) {
      if (brick.hp <= 0) continue;
      if (brick.x > maxX || brick.x + brick.w < minX || brick.y > maxY || brick.y + brick.h < minY) continue;
      const over = overlapCircleRect(b.x, b.y, r, brick.x, brick.y, brick.w, brick.h);
      if (over) {
        // Já sobreposto no início do passo (bloco móvel encostou na bola):
        // separa primeiro, sem inventar reflexão.
        return { t: 0, nx: over.nx, ny: over.ny, depth: over.depth, type: 'brick', payload: brick, overlap: true };
      }
      consider(sweepCircleRect(b.x, b.y, r, dx, dy, brick.x, brick.y, brick.w, brick.h), 'brick', brick);
    }
    return best;
  }

  function bounceOffPaddle(b, hit) {
    const halfW = S.paddle.w / 2;
    const offset = clamp((b.x - S.paddle.x) / halfW, -1, 1);
    const topHit = hit.ny < -0.25;

    if (!topHit) {
      // Contato pela lateral/base: reflexão honesta sobre a normal.
      const dot = b.vx * hit.nx + b.vy * hit.ny;
      b.vx -= 2 * dot * hit.nx;
      b.vy -= 2 * dot * hit.ny;
      normalizeSpeed(b); enforceAngle(b);
      return;
    }

    if (S.effects.magnet > 0) {
      b.held = { offset, timer: 0 };
      b.vx = b.vy = 0;
      audio.tone({ freq: 300, dur: 0.08, type: 'sine', vol: 0.04 });
      return;
    }

    const speed = currentSpeed();
    const spread = PADDLE.spreadDeg * Math.PI / 180;
    const angle = offset * spread;
    b.vx = Math.sin(angle) * speed + S.paddle.vx * PADDLE.english;
    b.vy = -Math.abs(Math.cos(angle) * speed);
    normalizeSpeed(b);
    enforceAngle(b);
    S.combo = 0;
    if (Math.abs(offset) > SCORE.precisionZone) {
      const n = addPoints(SCORE.precision);
      float(b.x, S.paddle.y - 10, '+' + n);
    }
    burst(b.x, b.y, theme.tokens.accent, 4);
    audio.tone({ freq: 330, dur: 0.04, type: 'sine', vol: 0.045 });
    haptics.buzz(6);
  }

  function stepBall(b, dt) {
    b.prevX = b.x; b.prevY = b.y;
    if (b.held) return;

    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-7 && guard++ < 6) {
      const dx = b.vx * remaining, dy = b.vy * remaining;
      const hit = findHit(b, dx, dy, remaining / dt);
      if (!hit) { b.x += dx; b.y += dy; break; }

      if (hit.overlap) {
        b.x += hit.nx * (hit.depth + 0.05);
        b.y += hit.ny * (hit.depth + 0.05);
        const into = b.vx * hit.nx + b.vy * hit.ny;
        if (into < 0) { b.vx -= 2 * into * hit.nx; b.vy -= 2 * into * hit.ny; }
        // Sem dano: a sobreposição vem de um bloco móvel encostando na bola,
        // não de um impacto do jogador. Só separa e devolve.
        debug.event('sobreposição separada');
        continue;
      }

      b.x += dx * hit.t;
      b.y += dy * hit.t;
      remaining -= remaining * hit.t;
      b.x += hit.nx * 0.02;
      b.y += hit.ny * 0.02;

      if (hit.type === 'brick') {
        const brick = hit.payload;
        const def = brickDef(brick.kind);
        if (S.effects.pierce > 0 && !def.steel) {
          damageBrick(brick, brick.hp);       // atravessa: destrói e segue reto
          debug.event('perfurou bloco');
          if (levelCleared) return;
          continue;
        }
        if (def.mirror) {
          // Espelho: devolve numa diagonal exata de 45°, mantendo o sentido geral.
          const speed = currentSpeed() / Math.SQRT2;
          b.vx = (b.vx >= 0 ? 1 : -1) * speed;
          b.vy = (hit.ny < 0 ? -1 : hit.ny > 0 ? 1 : (b.vy >= 0 ? 1 : -1)) * speed;
          audio.tone({ freq: 620, dur: 0.08, type: 'square', vol: 0.035 });
        } else {
          const dot = b.vx * hit.nx + b.vy * hit.ny;
          b.vx -= 2 * dot * hit.nx;
          b.vy -= 2 * dot * hit.ny;
        }
        damageBrick(brick);
        normalizeSpeed(b); enforceAngle(b);
        debug.event(`bloco ${brick.kind} ${hit.corner ? 'quina' : 'face'}`);
        if (levelCleared) return;
        continue;
      }

      if (hit.type === 'paddle') { bounceOffPaddle(b, hit); debug.event('plataforma'); continue; }

      if (hit.type === 'shield') {
        b.vy = -Math.abs(b.vy);
        S.effects.shield--;
        burst(b.x, S.paddle.y + PADDLE.shieldGap, theme.tokens.accent, 12);
        hud.toast(`ESCUDO · ${S.effects.shield} carga${S.effects.shield === 1 ? '' : 's'}`, { priority: 2 });
        audio.tone({ freq: 570, dur: 0.12, type: 'sine', vol: 0.05 });
        hudDirty = true;
        debug.event('escudo');
        continue;
      }

      // Parede ou teto.
      const dot = b.vx * hit.nx + b.vy * hit.ny;
      b.vx -= 2 * dot * hit.nx;
      b.vy -= 2 * dot * hit.ny;
      if (hit.type === 'ceiling') {
        S.ceilingGain = Math.min(SPEED.ceilingMax, S.ceilingGain * SPEED.ceilingGain);
        hudDirty = true;
      }
      normalizeSpeed(b); enforceAngle(b);
      burst(b.x, b.y, theme.tokens.accent, 2);
      audio.tone({ freq: hit.type === 'ceiling' ? 520 : 460, dur: 0.03, type: 'sine', vol: 0.03 });
      debug.event(hit.type === 'ceiling' ? 'teto' : 'parede');
    }
  }

  // ------------------------------------------------------- plataforma/itens
  function updatePaddle(dt) {
    S.paddle.w = paddleWidth();
    const half = S.paddle.w / 2;
    const minX = half + FIELD.wallX, maxX = FIELD.w - half - FIELD.wallX;

    const axis = input.poll();
    if (axis !== 0) S.paddle.target += axis * PADDLE.keySpeed * dt;
    else if (input.state.tracking) S.paddle.target = input.state.x;

    S.paddle.target = clamp(S.paddle.target, minX, maxX);
    const prev = S.paddle.x;
    const step = clamp(S.paddle.target - S.paddle.x, -PADDLE.follow * dt, PADDLE.follow * dt);
    S.paddle.x = clamp(S.paddle.x + step, minX, maxX);
    S.paddle.dx = S.paddle.x - prev;
    S.paddle.vx = S.paddle.dx / dt;

    for (const b of S.balls) {
      if (!b.held) continue;
      b.r = ballRadius();
      b.x = S.paddle.x + b.held.offset * half;
      b.y = S.paddle.y - b.r - 1;
      b.held.timer += dt;
      const limit = S.effects.magnet > 0 ? EFFECTS.magnetHold : 3.5;
      if (b.held.timer >= limit) launchHeld(b);
    }
  }

  function updateEffects(dt) {
    const before = S.effects.invert;
    for (const key of ['wide', 'slow', 'fast', 'laser', 'magnet', 'pierce', 'narrow', 'invert']) {
      if (S.effects[key] > 0) {
        S.effects[key] = Math.max(0, S.effects[key] - dt);
        if (S.effects[key] === 0) hudDirty = true;
      }
    }
    if (before > 0 && S.effects.invert === 0) input.setInverted(false);
    if (S.laserCooldown > 0) S.laserCooldown -= dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 3.2);
    S.stallTimer += dt;
  }

  function updateDrops(dt) {
    const half = S.paddle.w / 2;
    for (let i = S.drops.length - 1; i >= 0; i--) {
      const d = S.drops[i];
      d.y += d.vy * dt;
      const overlapY = d.y + d.h / 2 >= S.paddle.y && d.y - d.h / 2 <= S.paddle.y + S.paddle.h;
      const overlapX = d.x + d.w / 2 >= S.paddle.x - half && d.x - d.w / 2 <= S.paddle.x + half;
      if (overlapY && overlapX) { S.drops.splice(i, 1); collect(d.kind); }
      else if (d.y - d.h / 2 > S.bounds.bottom) S.drops.splice(i, 1);
    }
  }

  function fireLaser() {
    if (S.effects.laser <= 0 || S.laserCooldown > 0 || S.state !== 'playing') return;
    S.laserCooldown = LASER.cooldown;
    const off = S.paddle.w / 2 - 6;
    for (const dx of [-off, off]) {
      S.shots.push({ x: S.paddle.x + dx, y: S.paddle.y - 4 });
    }
    audio.tone({ freq: 900, dur: 0.06, type: 'square', vol: 0.03, slide: 0.35 });
    haptics.buzz(5);
  }

  function updateShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.y -= LASER.speed * dt;
      if (s.y < S.bounds.top) { S.shots.splice(i, 1); continue; }
      let hitBrick = null;
      for (const brick of S.bricks) {
        if (brick.hp <= 0) continue;
        if (s.x >= brick.x && s.x <= brick.x + brick.w &&
            s.y - LASER.h <= brick.y + brick.h && s.y >= brick.y) { hitBrick = brick; break; }
      }
      if (hitBrick) {
        S.shots.splice(i, 1);
        damageBrick(hitBrick);
        if (levelCleared) return;
      }
    }
  }

  // Rede de segurança para trajetória rasante persistente. Diferente do
  // empurrão antigo, só age depois de 1,4s no ângulo ruim, corrige 6° e deixa
  // um rastro visível — o jogador vê que algo agiu.
  function guardFlatAngle(b, dt) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 1e-6) return;
    const flat = Math.abs(b.vy) / speed < Math.sin(20 * Math.PI / 180);
    b.flat = flat ? (b.flat || 0) + dt : 0;
    if (b.flat > SPEED.flatAfter) {
      b.flat = 0;
      const a = Math.atan2(b.vy, b.vx) + (b.vy < 0 ? -1 : 1) * SPEED.flatNudgeDeg * Math.PI / 180;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      enforceAngle(b);
      burst(b.x, b.y, theme.tokens.warn, 6);
      audio.tone({ freq: 700, dur: 0.06, type: 'sine', vol: 0.03 });
      hud.toast('TRAJETÓRIA CORRIGIDA', { duration: 0.9 });
      debug.event('correção de ângulo raso');
    }
  }

  // ------------------------------------------------------------ ciclo/fases
  function update(dt) {
    S.clock += dt;
    if (S.state !== 'playing') return;
    if (S.freeze > 0) { S.freeze -= dt; return; }

    updateEffects(dt);
    updatePaddle(dt);
    updateBricks(dt);

    for (const b of S.balls) {
      b.r = ballRadius();
      if (!b.held) { normalizeSpeed(b); guardFlatAngle(b, dt); }
      stepBall(b, dt);
      if (levelCleared) break;
    }

    if (!levelCleared) {
      const before = S.balls.length;
      S.balls = S.balls.filter(b => b.y - b.r <= S.bounds.bottom);
      if (S.balls.length !== before) { hudDirty = true; haptics.buzz(18); }
      if (!S.balls.length) pendingLifeLoss = true;
      updateDrops(dt);
      updateShots(dt);
    }

    if (levelCleared) finishLevel();
    else if (pendingLifeLoss) loseLife();
  }

  // --------------------------------------------------- partida em andamento
  //
  // O ponto de gravação é a virada de arena, nunca o meio dela: restaurar
  // bolas em voo, cápsulas caindo e cronômetros de efeito seria frágil e
  // devolveria o jogador a uma situação que não é a que ele deixou.
  const RUN_KEY = 'run-v1';

  function saveRunAt(levelIndex) {
    store.set(RUN_KEY, {
      mode: S.mode, levelIndex, score: S.score, lives: S.lives,
      nextLifeScore: S.nextLifeScore, seed: S.seed, fromStart: S.fromStart,
      day: S.mode === 'daily' ? todaySeedLabel() : null
    });
  }
  const saveRun = () => saveRunAt(S.levelIndex);
  const clearRun = () => store.remove(RUN_KEY);

  function loadRun() {
    const r = store.get(RUN_KEY, null);
    if (!r || typeof r !== 'object' || !MODES[r.mode]) return null;
    // O desafio diário de ontem não continua hoje: a semente é outra.
    if (r.mode === 'daily' && r.day !== todaySeedLabel()) return null;
    const total = MODES[r.mode].phases;
    const last = Number.isFinite(total) ? total - 1 : Number.MAX_SAFE_INTEGER;
    if (!Number.isInteger(r.levelIndex) || r.levelIndex < 0 || r.levelIndex > last) return null;
    if (!Number.isFinite(r.score) || r.score < 0) return null;
    if (!Number.isInteger(r.lives) || r.lives < 1 || r.lives > LIVES.max) return null;
    if (!Number.isInteger(r.seed)) return null;
    return r;
  }

  const unlockedIndex = () => Math.min(PHASES.length - 1, Math.max(0, store.get('unlocked', 0)));

  function markUnlocked(index) {
    if (S.mode !== 'campaign') return;
    if (index > store.get('unlocked', 0)) store.set('unlocked', Math.min(PHASES.length - 1, index));
  }

  function recordKey() { return 'best:' + S.mode; }

  // O recorde do modo só conta partida iniciada na arena 1. Sem isso, poder
  // começar na arena 20 esvaziaria o placar.
  function saveRecord() {
    if (!S.fromStart) return false;
    const best = store.get(recordKey(), { score: 0, level: 0 });
    if (S.score > best.score || S.levelIndex + 1 > best.level) {
      store.set(recordKey(), {
        score: Math.max(best.score, S.score),
        level: Math.max(best.level, S.levelIndex + 1)
      });
      return true;
    }
    return false;
  }

  // Já a melhor pontuação DENTRO de uma arena vale sempre: é o número que dá
  // sentido a treinar uma arena isolada.
  function saveArenaBest() {
    if (S.mode !== 'campaign') return;
    const earned = S.score - S.levelStartScore;
    const map = store.get('arenaBest', {});
    const key = String(S.levelIndex);
    if ((map[key] || 0) < earned) { map[key] = earned; store.set('arenaBest', map); }
  }

  function saveStars(stars) {
    if (S.mode !== 'campaign') return;
    const map = store.get('stars', {});
    const key = String(S.levelIndex);
    if ((map[key] || 0) < stars) { map[key] = stars; store.set('stars', map); }
  }

  function finishLevel() {
    levelCleared = false;
    pendingLifeLoss = false;
    const bonus = SCORE.levelBonus * (S.levelIndex + 1);
    const chain = S.maxCombo * SCORE.chainPerCombo;
    const flawless = S.levelDeaths === 0 ? SCORE.flawless : 0;
    S.score += bonus + chain + flawless;
    const stars = S.levelDeaths === 0 ? (S.maxCombo >= 8 ? 3 : 2) : 1;
    saveStars(stars);
    saveArenaBest();
    // Recuperação: terminar a fase sem falhar devolve uma vida, mas só até
    // o número inicial. Ajuda quem está atrás sem inflar quem vai bem.
    const recovered = S.levelDeaths === 0 && S.lives < LIVES.start && grantLife('fase sem falhas');
    checkLifeMilestone();

    const total = MODES[S.mode].phases;
    const last = Number.isFinite(total) && S.levelIndex + 1 >= total;
    resetEffects();
    audio.tone({ freq: 880, dur: 0.25, type: 'sine', vol: 0.06 });
    haptics.buzz([14, 50, 22]);
    hudDirty = true;

    const detail = `+${bonus} de fase` + (chain ? ` · +${chain} de sequência` : '') +
                   (flawless ? ` · +${flawless} sem falhas` : '') +
                   (recovered ? ' · +1 vida' : '');

    if (last) {
      S.state = 'win';
      saveRecord();
      clearRun();
      hud.showOverlay({
        tag: 'Missão completa', title: 'Você é uma supernova!',
        text: `${S.score.toLocaleString('pt-BR')} pontos. Você venceu as ${total} arenas.`,
        action: 'Jogar de novo', note: detail + ' · ' + starLabel(stars)
      });
    } else {
      S.state = 'between';
      markUnlocked(S.levelIndex + 1);
      saveRunAt(S.levelIndex + 1);
      const next = currentPhaseData(S.levelIndex + 1);
      hud.showOverlay({
        tag: detail, title: 'Próxima: ' + next.name, text: next.hint,
        action: 'Entrar na próxima fase',
        note: `${S.score.toLocaleString('pt-BR')} pontos · ${S.lives} ${S.lives === 1 ? 'vida' : 'vidas'} · ${starLabel(stars)}`
      });
    }
  }

  const starLabel = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function loseLife() {
    pendingLifeLoss = false;
    S.lives--;
    S.levelDeaths++;
    S.combo = 0;
    burst(S.paddle.x, S.paddle.y, theme.tokens.warn, 18);
    audio.tone({ freq: 130, dur: 0.26, type: 'sawtooth', vol: 0.05 });
    S.shake = 1;
    resetEffects();
    attachBall();
    hudDirty = true;

    if (S.lives > 0) {
      S.state = 'life';
      hud.showOverlay({
        tag: 'Ainda dá jogo', title: 'Mais uma chance',
        text: `${S.lives} ${S.lives === 1 ? 'vida restante' : 'vidas restantes'}. Os blocos destruídos continuam valendo.`,
        action: 'Lançar bolinha',
        note: `${S.score.toLocaleString('pt-BR')} pontos · fase ${S.levelIndex + 1}`
      });
    } else {
      S.state = 'over';
      const isRecord = saveRecord();
      clearRun();
      hud.showOverlay({
        tag: isRecord ? 'Novo recorde' : 'Fim de jogo', title: 'Só mais uma?',
        text: `Você fez ${S.score.toLocaleString('pt-BR')} pontos e chegou à arena ${S.phase.name}.`,
        action: 'Tentar de novo',
        note: `Modo ${MODES[S.mode].label}. Recorde: ${store.get(recordKey(), { score: 0 }).score.toLocaleString('pt-BR')} pontos.`
      });
    }
  }

  // ----------------------------------------------------------- controle/UI
  function freshSeed() {
    return S.mode === 'daily'
      ? hashSeed('neon-break:' + todaySeedLabel())
      : (Math.random() * 0xffffffff) >>> 0;
  }

  function newGame(fromIndex = 0) {
    S.score = 0;
    S.lives = LIVES.start;
    S.nextLifeScore = LIVES.scoreStep;
    S.levelIndex = fromIndex;
    S.fromStart = fromIndex === 0;
    S.seed = freshSeed();
    levelCleared = false;
    pendingLifeLoss = false;
    clearRun();
    setupLevel();
    startPlaying(`Arena ${fromIndex + 1}. ${S.phase.name}. Jogo iniciado.`);
  }

  // Retoma a partida guardada no começo da arena em que ela parou. Vidas e
  // pontuação voltam como estavam; continuar não perdoa nada.
  function continueRun(run) {
    if (run.mode !== S.mode) { S.mode = run.mode; store.set('mode', run.mode); }
    S.score = run.score;
    S.lives = run.lives;
    S.nextLifeScore = Number.isFinite(run.nextLifeScore) ? run.nextLifeScore : LIVES.scoreStep;
    S.seed = run.seed;
    S.levelIndex = run.levelIndex;
    S.fromStart = !!run.fromStart;
    levelCleared = false;
    pendingLifeLoss = false;
    setupLevel();
    startPlaying(`Partida retomada na arena ${S.levelIndex + 1}. ${S.phase.name}.`);
  }

  function startPlaying(announcement) {
    audio.resume();
    input.reset();
    S.state = 'playing';
    // Grava aqui, e não ao montar a arena: assim a montagem do boot não
    // sobrescreve a partida guardada, e um relançamento após perder vida
    // atualiza o checkpoint com as vidas que sobraram.
    saveRun();
    hud.hideOverlay();
    hudDirty = true;
    if (announcement) hud.announce(announcement);
  }

  // Tela inicial: oferece retomar quando existe partida guardada do modo atual.
  function showIntro() {
    S.state = 'intro';
    pendingRun = loadRun();
    const run = pendingRun && pendingRun.mode === S.mode ? pendingRun : null;
    pendingRun = run;
    if (run) {
      const phase = run.mode === 'campaign'
        ? PHASES[Math.min(run.levelIndex, PHASES.length - 1)]
        : currentPhaseData(run.levelIndex);
      hud.showOverlay({
        tag: 'Partida em andamento', title: 'Continuar de onde<br>você parou',
        text: `Arena ${run.levelIndex + 1} — ${phase.name}. ${run.score.toLocaleString('pt-BR')} pontos e ` +
              `${run.lives} ${run.lives === 1 ? 'vida' : 'vidas'} guardadas.`,
        action: 'Continuar',
        secondary: 'Começar do zero',
        note: `Modo ${MODES[run.mode].label} · a partida é guardada a cada arena`
      });
      return;
    }
    hud.showOverlay({
      tag: 'Pronto para jogar', title: 'Mire. Rebata.<br>Quebre tudo.',
      text: 'Deslize para rebater. Capture as cápsulas que caem e transforme o jogo.',
      action: 'Jogar agora',
      note: `Modo ${MODES[S.mode].label} · 25 arenas · 12 bônus · ajustes no rodapé`
    });
  }

  function primaryAction() {
    if (hud.dialogOpen) return;
    if (S.state === 'intro') { pendingRun ? continueRun(pendingRun) : newGame(); pendingRun = null; }
    else if (S.state === 'over' || S.state === 'win') newGame();
    else if (S.state === 'paused') resume();
    else if (S.state === 'life') startPlaying();
    else if (S.state === 'between') {
      S.levelIndex++;
      setupLevel();
      startPlaying('Fase ' + (S.levelIndex + 1) + '. ' + S.phase.name + '.');
    }
  }

  function pause() {
    if (S.state !== 'playing') return;
    S.state = 'paused';
    input.reset();
    hud.showOverlay({
      tag: 'No seu tempo', title: 'Jogo pausado',
      text: 'Bolinhas, cápsulas e bônus congelados. Continue quando quiser.',
      action: 'Continuar', note: 'Sua partida continua daqui.',
      secondary: 'Recomeçar do zero'
    });
    hudDirty = true;
  }

  function resume() {
    if (S.state !== 'paused' || hud.dialogOpen) return;
    audio.resume();
    startPlaying();
  }

  function tap() {
    if (S.state !== 'playing') return;
    const held = S.balls.find(b => b.held);
    if (held) { launchHeld(held); return; }
    fireLaser();
  }

  // ------------------------------------------------------------------- HUD
  let hudTimer = 0;
  function syncHud(dt) {
    hudTimer += dt;
    if (!hudDirty && hudTimer < 0.1) return;
    hudTimer = 0;
    hudDirty = false;

    const total = MODES[S.mode].phases;
    hud.setStat('score', String(S.score).padStart(5, '0'));
    hud.setStat('level',
      `${String(S.levelIndex + 1).padStart(2, '0')}<small> / ${Number.isFinite(total) ? String(total).padStart(2, '0') : '∞'}</small>`,
      `Fase ${S.levelIndex + 1}`);
    hud.setHearts('lives', LIVES.max, S.lives);

    const chips = [
      { text: `${S.balls.length} bolinha${S.balls.length === 1 ? '' : 's'}` },
      { text: `Vel. ${speedRatio().toFixed(2).replace('.', ',')}×`,
        tone: S.stallTimer > SPEED.stallAfter ? 'warn' : '' }
    ];
    const tags = [];
    const t = v => Math.ceil(v) + 's';
    if (S.effects.wide > 0) tags.push('↔ ' + t(S.effects.wide));
    if (S.effects.narrow > 0) tags.push('▭ ' + t(S.effects.narrow));
    if (S.effects.slow > 0) tags.push('↓ ' + t(S.effects.slow));
    if (S.effects.fast > 0) tags.push('↑ ' + t(S.effects.fast) + ' · 2×');
    if (S.effects.laser > 0) tags.push('⌁ ' + t(S.effects.laser));
    if (S.effects.magnet > 0) tags.push('⊂ ' + t(S.effects.magnet));
    if (S.effects.pierce > 0) tags.push('⊚ ' + t(S.effects.pierce));
    if (S.effects.invert > 0) tags.push('⇄ ' + t(S.effects.invert));
    if (S.effects.shield > 0) tags.push('◇ ' + S.effects.shield);
    chips.push({ text: tags.join(' · ') || 'Capture os bônus', tone: 'flow' });
    hud.setChips(chips, `${S.balls.length} bolinhas. Velocidade ${speedRatio().toFixed(2)} vezes. ${tags.join('. ')}`);
    hud.setPause(S.state === 'paused', S.state === 'playing' || S.state === 'paused');
  }

  // --------------------------------------------------------------- diálogo
  function openSettings() {
    const wasPlaying = S.state === 'playing';
    if (wasPlaying) pause();
    const node = buildDialog({
      settings, theme, audio, haptics, store,
      mode: S.mode,
      records: {
        campaign: store.get('best:campaign', { score: 0, level: 0 }),
        endless: store.get('best:endless', { score: 0, level: 0 }),
        daily: store.get('best:daily', { score: 0, level: 0 }),
        stars: store.get('stars', {})
      },
      arenas: S.mode !== 'campaign' ? null : (() => {
        const stars = store.get('stars', {});
        const best = store.get('arenaBest', {});
        const limit = unlockedIndex();
        return PHASES.map((phase, index) => ({
          index, name: phase.name, unlocked: index <= limit,
          stars: stars[String(index)] || 0, best: best[String(index)] || 0
        }));
      })(),
      currentArena: S.levelIndex,
      onPickArena: index => { hud.closeDialog(); newGame(index); },
      onMode: value => {
        S.mode = value;
        store.set('mode', value);
        hudDirty = true;
        // Na tela inicial a oferta de continuar é por modo, então refaz.
        if (S.state === 'intro') showIntro();
        else hud.toast('O modo vale a partir da próxima partida', { priority: 2 });
      },
      onControl: value => { settings.control = value; store.set('control', value); input.setMode(value); },
      onAssist: value => { settings.assist = value; store.set('assist', value); hudDirty = true; },
      onEffects: value => { settings.effectsLevel = value; store.set('effectsLevel', value); },
      onSensitivity: value => { settings.sensitivity = value; store.set('sensitivity', value); input.state.sensitivity = value; }
    });
    hud.setDialogContent(node, 'Ajustes & bônus');
    hud.openDialog();
  }

  // ---------------------------------------------------------------- render
  function render(dt, alpha) {
    const frozen = S.state !== 'playing' || S.freeze > 0;
    renderer.draw(S, {
      alpha: frozen ? 1 : alpha,
      dt: frozen ? 0 : dt,
      levelIndex: S.levelIndex,
      phaseName: `${String(S.levelIndex + 1).padStart(2, '0')} — ${S.phase.name}`,
      lowEffects: lowEffects(),
      showAim: S.balls.some(b => b.held),
      stats: loopStats
    });
    if (!frozen) hud.tickToast(dt);
    syncHud(dt);
    hud.flush();
  }

  function resize() {
    applyBounds();
    renderer.invalidate();
    const half = S.paddle.w / 2;
    S.paddle.x = clamp(S.paddle.x, half + FIELD.wallX, FIELD.w - half - FIELD.wallX);
    S.paddle.target = S.paddle.x;
    // Blocos têm métrica fixa a partir do topo; a bola em jogo não é
    // reposicionada — por isso nenhuma mudança de altura desloca uma em
    // relação à outra. Só quem está preso à plataforma acompanha.
    for (const b of S.balls) {
      if (b.held) { b.x = S.paddle.x; b.y = S.paddle.y - b.r - 1; b.trail.length = 0; }
      else b.y = Math.min(b.y, S.bounds.bottom - b.r);
    }
    hudDirty = true;
  }

  // -------------------------------------------------------------- interface
  applyBounds();
  setupLevel();
  S.state = 'intro';
  input.setMode(settings.control);
  input.state.sensitivity = settings.sensitivity;

  showIntro();

  input.on('tap', tap);
  input.on('key', e => {
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (S.state === 'playing') { if (S.balls.some(b => b.held) || S.effects.laser > 0) tap(); else pause(); }
      else primaryAction();
    }
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      e.preventDefault();
      S.state === 'playing' ? pause() : resume();
    }
  });

  return {
    meta,
    update, render, resize,
    primaryAction, pause, resume, openSettings,
    secondaryAction: () => {
      if (S.state === 'paused') newGame();
      else if (S.state === 'intro') { pendingRun = null; clearRun(); newGame(); }
    },
    pauseToggle: () => (S.state === 'paused' ? resume() : pause()),
    onHidden: pause,
    onThemeChange: () => renderer.invalidate(),
    getState: () => ({
      state: S.state, mode: S.mode, level: S.levelIndex + 1, arena: S.phase.name,
      score: S.score, lives: S.lives, blocksRemaining: S.remaining,
      balls: S.balls.length, speedMultiplier: Number(speedRatio().toFixed(2)),
      effects: { ...S.effects }
    }),
    // Acesso interno para o overlay de diagnóstico e testes automatizados.
    inspect: () => S,
    destroy: () => { input.destroy(); }
  };
}
