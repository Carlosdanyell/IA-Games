import { ENEMIES, WAVES, BOSSES, BOSS, PATTERNS } from './config.js';

// Inimigos, formação das ondas e comportamento dos chefes. Funções puras sobre
// o objeto do mundo (sem DOM): o mesmo código roda no navegador e nos testes.

const TAU = Math.PI * 2;
const COST = { drone: 1, dart: 1, weaver: 1, gunner: 2, tank: 3, splitter: 2, hunter: 1, spinner: 3 };
const NUMERALS = ['', ' II', ' III', ' IV', ' V'];

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

export function weightedPick(rng, list) {
  let total = 0;
  for (const item of list) total += item.w;
  let roll = rng.next() * total;
  for (const item of list) {
    roll -= item.w;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

const waveSpeed = wave => Math.min(WAVES.speedMax, 1 + (wave - 1) * WAVES.speedPerWave);
const waveHp = wave => 1 + (wave - 1) * WAVES.hpPerWave;
const fireInterval = (W, every) => every / W.diff.fire / (1 + (Math.max(1, W.wave) - 1) * WAVES.firePerWave);

export function enemyShot(W, x, y, angle, speed, color, r = 4.5) {
  if (W.shots.length >= 260) return;
  const s = speed * Math.sqrt(W.diff.speed);
  W.shots.push({ x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, r, color, t: 0 });
}

// ------------------------------------------------------------------ inimigos
export function makeEnemy(W, type, x, y, opts = {}) {
  const def = ENEMIES[type];
  const wave = Math.max(1, W.wave);
  const small = !!opts.small;
  const hp = small ? 1 : Math.max(1, Math.round(def.hp * W.diff.hp * waveHp(wave)));
  const e = {
    type, def, x, y, baseX: x, r: small ? 8 : def.radius, hp, maxHp: hp,
    speed: def.speed * W.diff.speed * waveSpeed(wave),
    vx: 0, vy: 0, t: 0, t0: 0, phase: opts.phase ?? W.rng.next() * TAU,
    state: 'enter', timer: 0, fireTimer: 0, charge: 0, flash: 0, angle: Math.PI / 2,
    targetY: 0, stay: def.stay || 0, entered: y > 0,
    score: small ? 60 : def.score, xp: small ? 0 : def.xp, drop: small ? 0 : def.drop,
    color: def.color, contact: def.contact || 1, small, dead: false
  };
  if (type === 'dart') aim(W, e, opts.angle);
  if (def.fireEvery) e.fireTimer = def.fireEvery * (0.45 + W.rng.next() * 0.5);
  if (type === 'gunner' || type === 'spinner' || type === 'hunter') {
    e.targetY = opts.targetY ?? W.h * (0.13 + W.rng.next() * 0.16);
  }
  return e;
}

function aim(W, e, angle) {
  const a = angle ?? clamp(angleTo(e.x, e.y, W.player.x, W.player.y), Math.PI * 0.22, Math.PI * 0.78);
  e.angle = a;
  e.vx = Math.cos(a) * e.speed;
  e.vy = Math.sin(a) * e.speed;
}

// Devolve false quando o inimigo saiu do campo e deve ser descartado.
export function updateEnemy(W, e, dt) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const def = e.def;
  switch (e.type) {
    case 'drone':
      e.y += e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * 1.8 + e.phase) * 14;
      break;
    case 'dart':
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      break;
    case 'weaver':
      e.y += e.speed * dt;
      e.x = clamp(e.baseX + Math.sin(e.t * def.freq + e.phase) * W.w * def.amp, e.r, W.w - e.r);
      break;
    case 'tank':
      e.y += e.speed * dt;
      e.x += clamp(W.player.x - e.x, -1, 1) * 10 * dt;
      break;
    case 'splitter':
      e.y += e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * 1.1 + e.phase) * 26;
      break;
    case 'gunner':
    case 'spinner':
      hover(W, e, dt);
      break;
    case 'hunter':
      hunt(W, e, dt);
      break;
  }
  if (e.y > 0) e.entered = true;
  const margin = 64;
  if (e.y > W.h + margin || e.x < -margin || e.x > W.w + margin) return false;
  return !(e.entered && e.y < -margin);
}

function hover(W, e, dt) {
  const def = e.def;
  if (e.state === 'enter') {
    e.y += clamp((e.targetY - e.y) * 2.4, 30, e.speed) * dt;
    if (e.y >= e.targetY - 1) { e.y = e.targetY; e.state = 'hover'; e.t0 = e.t; }
    return;
  }
  if (e.state === 'leave') { e.y -= e.speed * 1.3 * dt; return; }
  const gunner = e.type === 'gunner';
  const range = W.w * (gunner ? 0.2 : 0.13);
  const k = gunner ? 0.9 : 0.55;
  const tt = e.t - e.t0;
  e.x = clamp(e.baseX + (Math.sin(tt * k + e.phase) - Math.sin(e.phase)) * range, e.r + 4, W.w - e.r - 4);
  if (!gunner) e.angle += dt * 1.8;
  e.stay -= dt;
  if (e.charge > 0) {
    e.charge -= dt;
    if (e.charge <= 0) shoot(W, e);
    return;
  }
  if (e.stay <= 0) { e.state = 'leave'; return; }
  e.fireTimer -= dt;
  if (e.fireTimer <= 0) {
    // Aviso visual antes de cada disparo: o brilho carrega, depois sai o tiro.
    e.charge = gunner ? 0.34 : 0.5;
    e.fireTimer = fireInterval(W, def.fireEvery);
  }
}

function shoot(W, e) {
  const def = e.def, p = W.player;
  const x = e.x, y = e.y + e.r * 0.6;
  if (e.type === 'gunner') {
    const a = angleTo(x, y, p.x, p.y);
    if (W.wave >= 10) {
      enemyShot(W, x, y, a - 0.13, def.bulletSpeed, e.color);
      enemyShot(W, x, y, a + 0.13, def.bulletSpeed, e.color);
    } else {
      enemyShot(W, x, y, a, def.bulletSpeed, e.color);
    }
  } else {
    const n = def.ring + (W.wave >= 14 ? 4 : 0);
    for (let i = 0; i < n; i++) enemyShot(W, e.x, e.y, e.angle + i * TAU / n, def.bulletSpeed, e.color, 4);
  }
  W.events.push({ type: 'enemyShot', x, y });
}

function hunt(W, e, dt) {
  const p = W.player;
  if (e.state === 'enter') {
    e.y += clamp((e.targetY - e.y) * 2.6, 40, 240) * dt;
    if (e.y >= e.targetY - 1) { e.state = 'lock'; e.timer = e.def.lock; }
  } else if (e.state === 'lock') {
    e.timer -= dt;
    e.angle = angleTo(e.x, e.y, p.x, p.y);
    if (e.timer <= 0) {
      e.state = 'dash';
      e.vx = Math.cos(e.angle) * e.speed;
      e.vy = Math.sin(e.angle) * e.speed;
      W.events.push({ type: 'dash', x: e.x, y: e.y });
    }
  } else {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
}

export function splitEnemy(W, e) {
  const n = e.def.splits || 0;
  for (let i = 0; i < n; i++) {
    const angle = Math.PI / 2 + (i - (n - 1) / 2) * 0.45;
    W.enemies.push(makeEnemy(W, 'dart', e.x, e.y, { small: true, angle }));
  }
}

// --------------------------------------------------------------------- ondas
const spawn = (type, fx, dy = 0, opts = {}) => ({ type, fx, dy, opts });
const group = spawns => ({ spawns, cost: spawns.reduce((sum, s) => sum + COST[s.type], 0) });

function formation(W, wave, available) {
  const r = W.rng;
  const has = type => available.includes(type);
  const list = [
    { w: 5, make: () => {
      const n = 3 + Math.min(2, Math.floor(wave / 4));
      return group(Array.from({ length: n }, (_, i) => spawn('drone', (i + 1) / (n + 1))));
    } },
    { w: 3, make: () => group([0, 1, 2, 3, 4].map(i => spawn('drone', 0.2 + i * 0.15, Math.abs(i - 2) * 26))) }
  ];
  if (has('dart')) list.push(
    { w: 3 + wave * 0.12, make: () => {
      const fx = 0.2 + r.next() * 0.6;
      return group([0, 1, 2].map(i => spawn('dart', fx, i * 42)));
    } },
    { w: 2, make: () => group([spawn('dart', 0.1), spawn('dart', 0.9)]) });
  if (has('weaver')) list.push({ w: 3, make: () => {
    const phase = r.next() * TAU;
    return group([spawn('weaver', 0.5, 0, { phase }), spawn('weaver', 0.5, 50, { phase: phase + Math.PI })]);
  } });
  // Os pesos dos que atiram sobem mais rápido que os dos que só descem: é o
  // tiro que faz a onda tardia pesar, senão a partida inteira se decide no chefe.
  if (has('gunner')) list.push({ w: 2.4 + wave * 0.17, make: () => (wave >= 9
    ? group([spawn('gunner', 0.28), spawn('gunner', 0.72)])
    : group([spawn('gunner', 0.25 + r.next() * 0.5)])) });
  if (has('tank')) list.push({ w: 1.6 + wave * 0.06, make: () => {
    const fx = 0.3 + r.next() * 0.4;
    return group([spawn('tank', fx), spawn('drone', fx - 0.18, 30), spawn('drone', fx + 0.18, 30)]);
  } });
  if (has('splitter')) list.push({ w: 1.5, make: () => group([spawn('splitter', 0.25 + r.next() * 0.5)]) });
  if (has('hunter')) list.push({ w: 1.4 + wave * 0.07, make: () => (wave >= 12
    ? group([spawn('hunter', 0.2), spawn('hunter', 0.8, 20)])
    : group([spawn('hunter', 0.2 + r.next() * 0.6)])) });
  if (has('spinner')) list.push({ w: 1.1 + wave * 0.09, make: () => group([spawn('spinner', 0.3 + r.next() * 0.4)]) });
  return weightedPick(r, list).make();
}

// Uma onda é uma fila de grupos com o intervalo antes de cada um.
export function buildWave(W, wave) {
  const budget = Math.min(WAVES.maxCount, Math.round((WAVES.baseCount + (wave - 1) * WAVES.perWave) * W.diff.count));
  const gap = Math.max(WAVES.gapMin, WAVES.gapStart - (wave - 1) * WAVES.gapStep) / Math.sqrt(W.diff.count);
  const available = Object.keys(ENEMIES).filter(type => ENEMIES[type].minWave <= wave);
  const groups = [];
  let left = budget;
  // Tipo novo nesta onda entra primeiro e sozinho, para o jogador conhecê-lo.
  const debut = available.find(type => ENEMIES[type].minWave === wave && wave > 1);
  if (debut) {
    const g = group([spawn(debut, 0.5)]);
    groups.push({ delay: 0.6, ...g });
    left -= g.cost;
  }
  while (left > 0) {
    const g = formation(W, wave, available);
    groups.push({ delay: groups.length ? gap * (0.75 + W.rng.next() * 0.5) : 0.6, ...g });
    left -= g.cost;
  }
  return groups;
}

export function spawnGroup(W, g) {
  for (const s of g.spawns) {
    if (W.enemies.length >= WAVES.maxEnemies) break;
    const def = ENEMIES[s.type];
    const x = clamp(s.fx * W.w, def.radius, W.w - def.radius);
    W.enemies.push(makeEnemy(W, s.type, x, -def.radius - 8 - s.dy, s.opts));
  }
}

// -------------------------------------------------------------------- chefes
export function makeBoss(W, index) {
  const def = BOSSES[index % BOSSES.length];
  const cycle = Math.floor(index / BOSSES.length);
  const hp = Math.round(def.hp * (1 + cycle * BOSS.hpPerCycle) * W.diff.bossHp);
  return {
    def, index, cycle, name: def.name + (NUMERALS[cycle] ?? ` ${cycle + 1}`),
    x: W.w / 2, y: -def.radius * 1.8, r: def.radius, homeY: W.h * BOSS.enterY,
    hp, maxHp: hp, phase: 0, state: 'enter', t: 0, flash: 0, dir: 1,
    queue: 0, key: '', pattern: null, telegraph: 0, rest: 1.4, repeat: 0, gapTimer: 0,
    spin: 0, emit: 0, duration: 0, hole: 0.5, row: 0, charge: null
  };
}

export function updateBoss(W, b, dt) {
  b.t += dt;
  if (b.flash > 0) b.flash -= dt;
  b.homeY = W.h * BOSS.enterY;
  if (b.state === 'enter') {
    b.y += Math.max(40, (b.homeY - b.y) * 1.6) * dt;
    if (b.y >= b.homeY - 1) { b.y = b.homeY; b.state = 'fight'; }
    return;
  }
  const ratio = b.hp / b.maxHp;
  const want = ratio <= BOSS.phaseAt[1] ? 2 : ratio <= BOSS.phaseAt[0] ? 1 : 0;
  if (want > b.phase) {
    b.phase = want;
    b.pattern = null; b.telegraph = 0; b.charge = null; b.queue = 0; b.rest = 1.1;
    W.events.push({ type: 'bossPhase', phase: want, x: b.x, y: b.y });
  }
  const def = b.def.phases[b.phase];
  move(W, b, def, dt);
  if (b.rest > 0) { b.rest -= dt; return; }
  if (!b.pattern) {
    b.key = def.patterns[b.queue % def.patterns.length];
    b.queue++;
    b.pattern = PATTERNS[b.key];
    b.telegraph = b.pattern.telegraph;
    startPattern(W, b);
    W.events.push({ type: 'bossTelegraph', kind: b.pattern.kind, x: b.x, y: b.y });
  }
  if (b.telegraph > 0) {
    b.telegraph -= dt;
    if (b.telegraph > 0) return;
  }
  runPattern(W, b, def, dt);
}

function move(W, b, def, dt) {
  if (b.charge) {
    // Mirando a investida: acompanha o jogador devagar, depois trava.
    if (b.charge.stage === 'aim') b.x += clamp(W.player.x - b.x, -1, 1) * def.speed * 1.6 * dt;
    return;
  }
  const margin = b.r + 12;
  b.x += b.dir * def.speed * Math.sqrt(W.diff.speed) * dt;
  if (b.x < margin) { b.x = margin; b.dir = 1; }
  if (b.x > W.w - margin) { b.x = W.w - margin; b.dir = -1; }
  b.y += (b.homeY + Math.sin(b.t * 0.9) * 10 - b.y) * Math.min(1, dt * 3);
}

function startPattern(W, b) {
  const p = b.pattern;
  b.repeat = p.repeat || 1;
  b.gapTimer = 0;
  if (p.kind === 'spiral') { b.duration = p.duration; b.emit = 0; }
  if (p.kind === 'curtain') {
    b.row = 0;
    b.hole = clamp(W.player.x / W.w + (W.rng.next() - 0.5) * 0.3, 0.18, 0.82);
  }
  if (p.kind === 'charge') b.charge = { stage: 'aim', targetY: 0 };
}

function runPattern(W, b, def, dt) {
  const p = b.pattern, player = W.player;
  const ox = b.x, oy = b.y + b.r * 0.55;
  const color = b.def.color;
  // A pausa entre padrões é a janela em que o jogador devolve dano. A cadência
  // da dificuldade encurta essa janela, mas só em parte: no Difícil a diferença
  // tem de estar nas ondas, senão o primeiro chefe vira um muro em vez de prova.
  const done = () => { b.pattern = null; b.rest = def.rest / (1 + (W.diff.fire - 1) * 0.3); };

  switch (p.kind) {
    case 'aimed':
    case 'fan':
    case 'ring': {
      b.gapTimer -= dt;
      if (b.gapTimer > 0) return;
      const shot = (p.repeat || 1) - b.repeat;
      if (p.kind === 'ring') {
        const base = shot * (p.twist || 0) * TAU + b.t * 0.3;
        for (let i = 0; i < p.count; i++) enemyShot(W, b.x, b.y, base + i * TAU / p.count, p.speed, color, 5);
      } else {
        const center = p.kind === 'aimed' ? angleTo(ox, oy, player.x, player.y) : Math.PI / 2;
        for (let i = 0; i < p.count; i++) {
          const a = p.count === 1 ? center : center - p.spread / 2 + p.spread * i / (p.count - 1);
          enemyShot(W, ox, oy, a, p.speed, color, 5);
        }
      }
      W.events.push({ type: 'bossShot', x: ox, y: oy });
      b.repeat--;
      b.gapTimer = p.gap;
      if (b.repeat <= 0) done();
      return;
    }
    case 'spiral': {
      b.duration -= dt;
      b.spin += p.spin * dt;
      b.emit += dt * p.rate;
      while (b.emit >= 1) {
        b.emit -= 1;
        for (let k = 0; k < p.arms; k++) enemyShot(W, b.x, b.y, b.spin + k * TAU / p.arms, p.speed, color, 4.5);
      }
      if (b.duration <= 0) done();
      return;
    }
    case 'curtain': {
      b.gapTimer -= dt;
      if (b.gapTimer > 0) return;
      const holeX = b.hole * W.w, half = p.hole / 2;
      for (let x = 10; x < W.w - 4; x += 22) {
        if (Math.abs(x - holeX) >= half) enemyShot(W, x, b.y + b.r, Math.PI / 2, p.speed, color, 5);
      }
      W.events.push({ type: 'bossShot', x: b.x, y: b.y });
      b.row++;
      b.gapTimer = p.gap;
      b.hole = clamp(b.hole + (W.rng.next() - 0.5) * 0.28, 0.16, 0.84);
      if (b.row >= p.rows) done();
      return;
    }
    case 'charge': {
      const c = b.charge;
      if (!c) { done(); return; }
      if (c.stage === 'aim') {
        c.stage = 'dash';
        c.targetY = W.h * 0.64;
        W.events.push({ type: 'dash', x: b.x, y: b.y });
      }
      if (c.stage === 'dash') {
        b.y += p.speed * Math.sqrt(W.diff.speed) * dt;
        if (b.y >= c.targetY) {
          b.y = c.targetY;
          c.stage = 'back';
          W.events.push({ type: 'bossSlam', x: b.x, y: b.y });
          if (b.phase === 2) for (let i = 0; i < 10; i++) enemyShot(W, b.x, b.y, i * TAU / 10, 150, color, 5);
        }
      } else if (c.stage === 'back') {
        b.y -= 170 * dt;
        if (b.y <= b.homeY) { b.y = b.homeY; b.charge = null; done(); }
      }
      return;
    }
    case 'summon': {
      for (let i = 0; i < p.count; i++) {
        if (W.enemies.length >= WAVES.maxEnemies) break;
        const x = clamp(b.x + ((i + 1) / (p.count + 1) - 0.5) * b.r * 3.2, 20, W.w - 20);
        W.enemies.push(makeEnemy(W, p.type, x, b.y + b.r * 0.4));
      }
      W.events.push({ type: 'summon', x: b.x, y: b.y });
      done();
    }
  }
}
