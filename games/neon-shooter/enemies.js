import { ENEMIES, WAVES, BOSSES, BOSS, PATTERNS, SPACE } from './config.js';

// Inimigos, formação das ondas e comportamento dos chefes. Funções puras sobre
// o objeto do mundo (sem DOM): o mesmo código roda no navegador e nos testes.

const TAU = Math.PI * 2;
const SPAWN = SPACE.spawnZ;
// Peso de cada tipo no orçamento da onda. Os seis novos entram caros porque
// ocupam espaço ou tempo do jogador muito além do que a vida deles sugere.
const COST = { drone: 1, dart: 1, weaver: 1, gunner: 2, tank: 3, splitter: 2, hunter: 1, spinner: 3,
               diver: 2, wall: 2, orbiter: 3, mirror: 3, swarm: 1, lancer: 4 };
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

// Tiro inimigo no espaço: a direção é um vetor de três eixos, normalizado.
export function enemyShot(W, x, y, z, dx, dy, dz, speed, color, r = 5) {
  if (W.shots.length >= 260) return;
  const k = speed * Math.sqrt(W.diff.speed) / (Math.hypot(dx, dy, dz) || 1);
  W.shots.push({ x, y, z, vx: dx * k, vy: dy * k, vz: dz * k, r, color, t: 0 });
}

// Atira no rumo da nave. Como o tiro viaja em três eixos, mirar é só pegar o
// vetor até ela — a dificuldade de desviar vem do tempo de voo, não do ângulo.
function shootAt(W, e, speed, spread = 0, r = 5) {
  const p = W.player;
  const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
  if (!spread) { enemyShot(W, e.x, e.y, e.z, dx, dy, dz, speed, e.color, r); return; }
  // A abertura é no plano x/y, perpendicular ao rumo: é o que lê como leque
  // quando o tiro vem de frente.
  for (const lado of [-1, 1]) {
    enemyShot(W, e.x, e.y, e.z, dx + lado * spread * Math.abs(dz) * .14, dy, dz, speed, e.color, r);
  }
}

// ------------------------------------------------------------------ inimigos
export function makeEnemy(W, type, x, y, z, opts = {}) {
  const def = ENEMIES[type];
  const wave = Math.max(1, W.wave);
  const small = !!opts.small;
  const hp = small ? 1 : Math.max(1, Math.round(def.hp * W.diff.hp * waveHp(wave)));
  const e = {
    type, def, x, y, z, baseX: x, baseY: y, r: small ? 8 : def.radius, hp, maxHp: hp,
    speed: def.speed * W.diff.speed * waveSpeed(wave),
    vx: 0, vy: 0, vz: 0, t: 0, t0: 0, phase: opts.phase ?? W.rng.next() * TAU,
    state: 'enter', timer: 0, fireTimer: 0, charge: 0, flash: 0,
    // Pose de desenho: guinada, arfagem e rolagem que o renderizador usa.
    yaw: 0, pitch: 0, roll: 0, face: 0,
    holdZ: def.holdZ ?? 0, stay: def.stay || 0, entered: false,
    score: small ? 60 : def.score, xp: small ? 0 : def.xp, drop: small ? 0 : def.drop,
    color: def.color, contact: def.contact || 1, small, dead: false,
    reflect: def.reflect || 0, group: opts.group ?? null, slot: opts.slot ?? 0
  };
  if (type === 'dart') aim(W, e, opts.dir);
  if (def.fireEvery) e.fireTimer = def.fireEvery * (0.45 + W.rng.next() * 0.5);
  if (def.beamEvery) e.fireTimer = def.beamEvery * (0.5 + W.rng.next() * 0.5);
  return e;
}

// O Dardo mira uma vez, no nascimento, e segue reto. Mirar continuamente
// tiraria do jogador a chance de sair da frente, que é a defesa contra ele.
function aim(W, e, dir) {
  const p = W.player;
  const dx = dir ? dir[0] : p.x - e.x, dy = dir ? dir[1] : p.y - e.y, dz = dir ? dir[2] : p.z - e.z;
  const k = e.speed / (Math.hypot(dx, dy, dz) || 1);
  e.vx = dx * k; e.vy = dy * k; e.vz = dz * k;
}

// Chega até `holdZ`, fica, depois recua. É a rotina de quem atira parado.
function hold(W, e, dt, lateral) {
  if (e.state === 'enter') {
    e.z -= Math.max(e.speed * .6, (e.z - e.holdZ) * 2.2) * dt;
    if (e.z <= e.holdZ + 2) { e.z = e.holdZ; e.state = 'hover'; e.t0 = e.t; }
    return;
  }
  if (e.state === 'leave') { e.z += e.speed * 1.4 * dt; return; }
  lateral(e.t - e.t0);
  e.stay -= dt;
  if (e.charge > 0) { e.charge -= dt; if (e.charge <= 0) fireHeld(W, e); return; }
  if (e.stay <= 0) { e.state = 'leave'; return; }
  e.fireTimer -= dt;
  if (e.fireTimer <= 0) {
    // Aviso antes do disparo: o núcleo carrega e só então sai o tiro.
    e.charge = e.type === 'lancer' ? e.def.charge : e.type === 'gunner' ? .34 : .5;
    e.fireTimer = fireInterval(W, e.def.fireEvery || e.def.beamEvery);
  }
}

function fireHeld(W, e) {
  const def = e.def;
  if (e.type === 'gunner') {
    shootAt(W, e, def.bulletSpeed, W.wave >= 10 ? 1 : 0);
  } else if (e.type === 'spinner') {
    // Anel que nasce no plano do inimigo e abre enquanto vem: de frente, lê
    // como um círculo crescendo, que é a leitura que o jogador precisa.
    const n = def.ring + (W.wave >= 14 ? 4 : 0);
    for (let i = 0; i < n; i++) {
      const a = e.yaw + i * TAU / n;
      enemyShot(W, e.x, e.y, e.z, Math.cos(a) * .55, Math.sin(a) * .55, -1, def.bulletSpeed, e.color, 4.5);
    }
  } else if (e.type === 'lancer') {
    // O feixe não é projétil: é uma coluna que fica acesa por um tempo e
    // machuca quem estiver dentro dela. Sair da coluna é a defesa.
    e.beam = def.beam;
    W.events.push({ type: 'beam', x: e.x, y: e.y, z: e.z, color: e.color });
  }
  W.events.push({ type: 'enemyShot', x: e.x, y: e.y, z: e.z });
}

// Devolve false quando o inimigo saiu do campo e deve ser descartado.
export function updateEnemy(W, e, dt) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const def = e.def, p = W.player;
  switch (e.type) {
    case 'drone':
      e.z -= e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * def.freq + e.phase) * def.amp;
      e.y = e.baseY + Math.cos(e.t * def.freq * .8 + e.phase) * def.amp * .6;
      break;
    case 'dart':
      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      break;
    case 'weaver':
      e.z -= e.speed * dt;
      e.x = clamp(e.baseX + Math.sin(e.t * def.freq + e.phase) * def.amp, -W.halfW, W.halfW);
      break;
    case 'tank':
      e.z -= e.speed * dt;
      // Corrige devagar para o lado da nave: pressiona sem perseguir.
      e.x += clamp(p.x - e.x, -1, 1) * 22 * dt;
      e.y += clamp(p.y - e.y, -1, 1) * 16 * dt;
      break;
    case 'splitter':
      e.z -= e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * 1.1 + e.phase) * 30;
      break;
    case 'gunner':
      hold(W, e, dt, tt => { e.x = clamp(e.baseX + (Math.sin(tt * .9 + e.phase) - Math.sin(e.phase)) * W.halfW * .5, -W.halfW, W.halfW); });
      break;
    case 'spinner':
      hold(W, e, dt, tt => {
        e.x = clamp(e.baseX + (Math.sin(tt * .55 + e.phase) - Math.sin(e.phase)) * W.halfW * .35, -W.halfW, W.halfW);
        e.yaw += dt * 1.8;
      });
      break;
    case 'hunter':
      hunt(W, e, dt);
      break;

    // --------------------------------------------- nascidos da profundidade
    case 'diver': {
      // Abre em arco para fora e volta cortando o plano da nave. O seno sobre
      // o avanço é o que desenha a curva: longe ele está largo, perto ele
      // fecha — e o jogador precisa ler a curva, não a posição atual.
      e.z -= e.speed * dt;
      const t = 1 - clamp(e.z / SPAWN, 0, 1);
      e.x = e.baseX + Math.sin(t * def.arc * Math.PI) * def.swing * (e.phase > TAU / 2 ? 1 : -1);
      e.y = e.baseY + Math.sin(t * Math.PI) * def.swing * .4;
      e.roll = Math.cos(t * def.arc * Math.PI) * .9;
      break;
    }
    case 'wall':
      // Placa de barreira: desce em bloco, sem desvio. A brecha é a saída, e
      // quem monta a brecha é a formação da onda, não o inimigo.
      e.z -= e.speed * dt;
      break;
    case 'orbiter':
      // Para perto e circula o eixo da nave: obriga a girar a mira em vez de
      // só subir e descer.
      if (e.state === 'enter') {
        e.z -= Math.max(e.speed * .5, (e.z - e.holdZ) * 2) * dt;
        if (e.z <= e.holdZ + 2) { e.state = 'hover'; e.t0 = e.t; }
      } else if (e.state === 'leave') { e.z += e.speed * dt; }
      else {
        const a = e.phase + (e.t - e.t0) * def.spin;
        e.x = clamp(p.x + Math.cos(a) * def.orbit, -W.halfW * 1.4, W.halfW * 1.4);
        e.y = p.y + Math.sin(a) * def.orbit * .7;
        e.roll = a;
        if ((e.stay -= dt) <= 0) e.state = 'leave';
      }
      break;
    case 'mirror':
      // Vem girando devagar. `face` é o quanto a frente dele aponta para a
      // nave: o mundo lê isso para decidir se o tiro volta.
      e.z -= e.speed * dt;
      e.yaw += def.turn * dt * .35;
      e.face = Math.sin(e.yaw);
      break;
    case 'swarm': {
      // Nuvem: cada um persegue o centro do próprio grupo e treme em volta.
      // Agem como um corpo só, e tocar um não desmancha os outros.
      e.z -= e.speed * dt;
      const g = e.group;
      if (g) {
        e.x += ((g.x + Math.cos(e.phase + e.t * def.jitter) * def.cohesion) - e.x) * Math.min(1, dt * 3);
        e.y += ((g.y + Math.sin(e.phase + e.t * def.jitter * 1.3) * def.cohesion) - e.y) * Math.min(1, dt * 3);
        g.x += clamp(p.x - g.x, -1, 1) * 42 * dt;
        g.y += clamp(p.y - g.y, -1, 1) * 30 * dt;
      }
      break;
    }
    case 'lancer':
      hold(W, e, dt, tt => { e.x = clamp(e.baseX + Math.sin(tt * .35 + e.phase) * W.halfW * .6, -W.halfW, W.halfW); });
      // Enquanto o feixe está aceso, quem estiver na coluna leva dano.
      if (e.beam > 0) {
        e.beam -= dt;
        if (Math.hypot(p.x - e.x, p.y - e.y) < def.beamR && p.z < e.z) W.hurtPlayer(1);
      }
      break;
  }
  if (e.z < SPAWN) e.entered = true;
  // Fora dos limites: passou da nave, ficou longe demais ou saiu pelos lados.
  if (e.z < SPACE.killZ || e.z > SPAWN + 600) return false;
  return !(Math.abs(e.x) > W.halfW * 5 || Math.abs(e.y) > W.halfH * 5);
}

function hunt(W, e, dt) {
  const p = W.player;
  if (e.state === 'enter') {
    e.z -= e.def.cruise * dt;
    if (e.z <= SPAWN * .55) { e.state = 'lock'; e.timer = e.def.lock; }
  } else if (e.state === 'lock') {
    e.timer -= dt;
    // Pisca mirando: o jogador vê para onde ele vai antes de ele ir.
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
    if (e.timer <= 0) { e.state = 'dash'; aim(W, e); W.events.push({ type: 'dash', x: e.x, y: e.y, z: e.z }); }
  } else {
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
  }
}

export function splitEnemy(W, e) {
  const n = e.def.splits || 0;
  for (let i = 0; i < n; i++) {
    // Os cacos abrem num leque em x e y, mas todos continuam vindo em -z: o
    // divisor multiplica a ameaça sem mandar nada para fora do campo de visão.
    const a = (i - (n - 1) / 2) * 0.6;
    W.enemies.push(makeEnemy(W, 'dart', e.x, e.y, e.z, { small: true, dir: [Math.sin(a), Math.sin(a * .6) * .5, -1] }));
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
  // Enxame nasce com um centro comum: é o que faz a nuvem andar junta em vez
  // de virar um punhado de inimigos pequenos indo cada um para um lado.
  const grupo = g.spawns.some(s => s.type === 'swarm')
    ? { x: (g.spawns[0].fx - .5) * 2 * W.halfW, y: 0 } : null;
  for (const s of g.spawns) {
    if (W.enemies.length >= WAVES.maxEnemies) break;
    // `fx` é fração da largura; vira coordenada do mundo centrada na origem.
    const x = clamp((s.fx - .5) * 2 * W.halfW, -W.halfW, W.halfW);
    const y = clamp((s.fy ?? .5 + (W.rng.next() - .5) * .7) * 2 * W.halfH - W.halfH, -W.halfH, W.halfH);
    const z = SPACE.spawnZ + (s.dy || 0) * 2.4;
    W.enemies.push(makeEnemy(W, s.type, x, y, z, { ...s.opts, group: grupo }));
  }
}

// -------------------------------------------------------------------- chefes
export function makeBoss(W, index) {
  const def = BOSSES[index % BOSSES.length];
  const cycle = Math.floor(index / BOSSES.length);
  const hp = Math.round(def.hp * (1 + cycle * BOSS.hpPerCycle) * W.diff.bossHp);
  return {
    def, index, cycle, name: def.name + (NUMERALS[cycle] ?? ` ${cycle + 1}`),
    x: 0, y: 0, z: SPACE.spawnZ * .9, r: def.radius * 2.4, homeZ: SPACE.spawnZ * .28,
    yaw: 0, pitch: 0, roll: 0,
    hp, maxHp: hp, phase: 0, state: 'enter', t: 0, flash: 0, dir: 1,
    queue: 0, key: '', pattern: null, telegraph: 0, rest: 1.4, repeat: 0, gapTimer: 0,
    spin: 0, emit: 0, duration: 0, hole: 0.5, row: 0, charge: null
  };
}

export function updateBoss(W, b, dt) {
  b.t += dt;
  if (b.flash > 0) b.flash -= dt;
  // O chefe entra vindo da profundidade, não de cima da tela: ele cresce no
  // campo de visão até parar à meia distância.
  if (b.state === 'enter') {
    b.z -= Math.max(120, (b.z - b.homeZ) * 1.4) * dt;
    if (b.z <= b.homeZ + 2) { b.z = b.homeZ; b.state = 'fight'; }
    return;
  }
  const ratio = b.hp / b.maxHp;
  const want = ratio <= BOSS.phaseAt[1] ? 2 : ratio <= BOSS.phaseAt[0] ? 1 : 0;
  if (want > b.phase) {
    b.phase = want;
    b.pattern = null; b.telegraph = 0; b.charge = null; b.queue = 0; b.rest = 1.1;
    W.events.push({ type: 'bossPhase', phase: want, x: b.x, y: b.y, z: b.z });
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
    W.events.push({ type: 'bossTelegraph', kind: b.pattern.kind, x: b.x, y: b.y, z: b.z });
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
  // Varre o plano de um lado ao outro e flutua em y, mantendo a profundidade.
  // A guinada acompanha o sentido da varredura, que é o que dá a leitura de
  // para onde ele está indo agora que o corpo tem volume.
  const limite = W.halfW * 1.15 - b.r * .4;
  b.x += b.dir * def.speed * Math.sqrt(W.diff.speed) * dt;
  if (b.x < -limite) { b.x = -limite; b.dir = 1; }
  if (b.x > limite) { b.x = limite; b.dir = -1; }
  b.y += (Math.sin(b.t * 0.9) * W.halfH * .22 - b.y) * Math.min(1, dt * 3);
  b.z += (b.homeZ + Math.sin(b.t * .55) * 90 - b.z) * Math.min(1, dt * 1.6);
  b.yaw += (b.dir * .35 - b.yaw) * Math.min(1, dt * 3);
  b.roll += (-b.dir * .22 - b.roll) * Math.min(1, dt * 2.4);
}

function startPattern(W, b) {
  const p = b.pattern;
  b.repeat = p.repeat || 1;
  b.gapTimer = 0;
  if (p.kind === 'spiral') { b.duration = p.duration; b.emit = 0; }
  if (p.kind === 'curtain') {
    b.row = 0;
    b.hole = clamp((W.player.x / W.halfW + 1) / 2 + (W.rng.next() - 0.5) * 0.3, 0.18, 0.82);
  }
  if (p.kind === 'charge') b.charge = { stage: 'aim', targetY: 0 };
}

function runPattern(W, b, def, dt) {
  const p = b.pattern, player = W.player;
  const ox = b.x, oy = b.y - b.r * 0.4, oz = b.z - b.r * .5;
  // Um tiro do chefe abre no plano x/y e vem em -z. `abertura` é o quanto ele
  // escapa do eixo: zero vem reto na coluna, um vem bem de lado. É a tradução
  // do ângulo do padrão antigo para a profundidade.
  const leque = (x, y, z, a, raio, vel, r = 5) =>
    enemyShot(W, x, y, z, Math.cos(a) * raio, Math.sin(a) * raio, -1, vel, color, r);
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
        for (let i = 0; i < p.count; i++) leque(ox, oy, oz, base + i * TAU / p.count, .62, p.speed);
      } else {
        // Mirado: aponta para a nave e abre o leque em torno desse rumo.
        const center = p.kind === 'aimed' ? angleTo(ox, oy, player.x, player.y) : -Math.PI / 2;
        for (let i = 0; i < p.count; i++) {
          const a = p.count === 1 ? center : center - p.spread / 2 + p.spread * i / (p.count - 1);
          const raio = p.kind === 'aimed' ? Math.hypot(player.x - ox, player.y - oy) / Math.max(1, oz - player.z) : .5;
          leque(ox, oy, oz, a, clamp(raio, .12, 1.3), p.speed);
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
        for (let k = 0; k < p.arms; k++) leque(ox, oy, oz, b.spin + k * TAU / p.arms, .55, p.speed, 4.5);
      }
      if (b.duration <= 0) done();
      return;
    }
    case 'curtain': {
      b.gapTimer -= dt;
      if (b.gapTimer > 0) return;
      // Cortina com brecha: uma fileira que atravessa o plano todo menos um
      // trecho. A brecha é a saída, e ela anda a cada fileira.
      const holeX = (b.hole * 2 - 1) * W.halfW, half = p.hole / 2 * W.halfW / 180 * 2;
      const passo = W.halfW / 7;
      for (let x = -W.halfW; x <= W.halfW + 1; x += passo) {
        if (Math.abs(x - holeX) >= half) enemyShot(W, x, oy, oz, 0, 0, -1, p.speed, color, 5);
      }
      W.events.push({ type: 'bossShot', x: b.x, y: b.y, z: b.z });
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
        // A investida agora é em profundidade: ele vem para cima da nave e
        // recua. É a manobra que a câmera atrás da nave torna assustadora.
        c.stage = 'dash';
        c.targetZ = W.player.z + b.r * 1.5;
        W.events.push({ type: 'dash', x: b.x, y: b.y, z: b.z });
      }
      if (c.stage === 'dash') {
        b.z -= p.speed * 3.2 * Math.sqrt(W.diff.speed) * dt;
        if (b.z <= c.targetZ) {
          b.z = c.targetZ;
          c.stage = 'back';
          W.events.push({ type: 'bossSlam', x: b.x, y: b.y, z: b.z });
          if (b.phase === 2) for (let i = 0; i < 10; i++) leque(b.x, b.y, b.z, i * TAU / 10, .9, 150);
        }
      } else if (c.stage === 'back') {
        b.z += 520 * dt;
        if (b.z >= b.homeZ) { b.z = b.homeZ; b.charge = null; done(); }
      }
      return;
    }
    case 'summon': {
      for (let i = 0; i < p.count; i++) {
        if (W.enemies.length >= WAVES.maxEnemies) break;
        const x = clamp(b.x + ((i + 1) / (p.count + 1) - 0.5) * b.r * 2.6, -W.halfW, W.halfW);
        W.enemies.push(makeEnemy(W, p.type, x, b.y, b.z - b.r * .5));
      }
      W.events.push({ type: 'summon', x: b.x, y: b.y, z: b.z });
      done();
    }
  }
}
