import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, steer, updateRun, createProfile, recordRun, cellsLong, wrapAngle } from '../games/neon-snake/model.js';
import { MAPS, SKINS, SNAKE, turnRate } from '../games/neon-snake/config.js';

const plain = value => JSON.parse(JSON.stringify(value));
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const run = options => {
  const state = createRun(options, rng);
  state.nextBonus = 1e9;
  state.nextHazard = 1e9;
  return state;
};
const tick = (state, seconds) => {
  const events = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) events.push(...updateRun(state, 1 / 120));
  return events;
};
const foodAhead = state => {
  state.food = { x: (state.head.x + Math.cos(state.angle) * 10 + state.w) % state.w, y: state.head.y + Math.sin(state.angle) * 10, type: 'food' };
};
// Corpo atravessado na frente da cabeça, longe dos primeiros pontos do caminho.
const bodyAcross = state => {
  state.head = { x: 200, y: 240 };
  state.angle = state.target = 0;
  const behind = Array.from({ length: 8 }, (_, i) => ({ x: 196 - i * 4, y: 240 }));
  const wall = Array.from({ length: 30 }, (_, i) => ({ x: 232, y: 180 + i * 4 }));
  state.path = [...behind, ...wall];
  state.length = state.path.length * SNAKE.spacing;
};

test('estado inicial: cobra parada até o primeiro gesto e alimento livre em todas as arenas', () => {
  for (const map of MAPS) for (const mode of ['classic', 'wrap', 'challenge', 'zen']) {
    const state = run({ map: map.id, mode });
    assert.equal(state.status, 'running');
    assert.equal(state.waiting, true);
    assert.equal(cellsLong(state), SNAKE.startLength);
    assert.ok(state.food, `${map.id}/${mode} sem alimento`);
    assert.equal(Boolean(state.obstacles.length), mode === 'challenge');
    assert.ok(!state.obstacles.some(r => state.food.x > r.x - 6 && state.food.x < r.x + r.w + 6 && state.food.y > r.y - 6 && state.food.y < r.y + r.h + 6));
    const head = plain(state.head);
    assert.deepEqual(updateRun(state, 1), []);
    assert.deepEqual(plain(state.head), head, 'esperando o gesto, a cobra não anda');
  }
  const fallback = createRun({ mode: 'inválido', difficulty: null, map: '__proto__' });
  assert.equal(fallback.mode, 'classic'); assert.equal(fallback.difficulty, 'normal'); assert.equal(fallback.map, 'grid');
});

test('a cabeça gira no máximo na taxa de giro e chega à direção pedida', () => {
  const state = run();
  assert.equal(steer(state, Math.PI / 2), true);
  assert.equal(state.waiting, false);
  const before = state.angle;
  updateRun(state, 0.05);
  assert.ok(Math.abs(wrapAngle(state.angle - before)) <= turnRate(state.speed) * 0.05 + 1e-9);
  assert.ok(state.angle > before);
  tick(state, 1);
  assert.ok(Math.abs(wrapAngle(state.angle - Math.PI / 2)) < 1e-9);
  assert.equal(steer(state, NaN), false);
});

test('anda na velocidade da dificuldade e o corpo guarda só o próprio tamanho', () => {
  const state = run({ mode: 'wrap' });
  steer(state, 0);
  const x0 = state.head.x, speed = state.speed;
  updateRun(state, 0.5);
  assert.ok(Math.abs(state.head.x - x0 - speed * 0.5) < 0.5);
  assert.equal(state.path.length, Math.ceil(state.length / SNAKE.spacing));
});

test('meia-volta não mata; atravessar o próprio corpo mata; no Zen o corpo não conta', () => {
  const turning = run();
  steer(turning, Math.PI);
  tick(turning, 2);
  assert.equal(turning.status, 'running', 'curva fechada de 180° não pode encostar no corpo');

  const classic = run();
  bodyAcross(classic);
  steer(classic, 0);
  tick(classic, 0.6);
  assert.equal(classic.status, 'over');
  assert.match(classic.deathReason, /corpo/);

  const zen = run({ mode: 'zen' });
  bodyAcross(zen);
  steer(zen, 0);
  tick(zen, 0.6);
  assert.equal(zen.status, 'running');
});

test('a borda encerra o Clássico; Sem Paredes e Zen atravessam', () => {
  for (const mode of ['classic', 'wrap', 'zen']) {
    const state = run({ mode });
    state.head = { x: state.w - 12, y: 240 };
    steer(state, 0);
    const events = tick(state, 0.3);
    if (mode === 'classic') {
      assert.equal(state.status, 'over'); assert.match(state.deathReason, /borda/);
      assert.equal(events.filter(e => e.type === 'over').length, 1);
      assert.deepEqual(updateRun(state, 1), []);
    } else {
      assert.equal(state.status, 'running');
      assert.ok(state.head.x < 40, `${mode} deveria reaparecer do outro lado`);
    }
  }
});

test('tabuleiro deitado: largura saneada, arenas na proporção e saída livre em qualquer largura', () => {
  assert.equal(createRun({ cols: 'larga' }).cols, SNAKE.cols);
  assert.equal(createRun({ cols: 10 }).cols, SNAKE.cols);
  assert.equal(createRun({ cols: 33.8 }).cols, 33);
  assert.equal(createRun({ cols: 999 }).cols, SNAKE.maxCols);
  const wide = createRun({ cols: 36 });
  assert.equal(wide.h, SNAKE.rows * SNAKE.cell);
  assert.equal(wide.w, 36 * SNAKE.cell);
  assert.equal(wide.head.x, 18.5 * SNAKE.cell);
  assert.equal(wide.head.y, 10.5 * SNAKE.cell);
  const count = (map, cols) => createRun({ mode: 'challenge', map, cols }).obstacles.length;
  assert.equal(count('grid', 36), count('grid', SNAKE.cols), 'peças soltas mantêm o formato');
  assert.ok(count('maze', 36) > count('maze', SNAKE.cols), 'paredes horizontais esticam com a largura');
  for (let cols = SNAKE.cols; cols <= SNAKE.maxCols; cols++) {
    const columns = createRun({ mode: 'challenge', map: 'grid', cols }).obstacles.map(r => r.x / SNAKE.cell);
    assert.equal(Math.min(...columns), cols - 1 - Math.max(...columns), `grid simétrico com ${cols} colunas`);
    for (const map of MAPS) {
      const state = run({ mode: 'challenge', map: map.id, cols });
      assert.ok(state.obstacles.every(r => r.x >= 0 && r.x + r.w <= state.w), `${map.id}/${cols}: peça fora do tabuleiro`);
      steer(state, 0);
      tick(state, 0.4);
      assert.equal(state.status, 'running', `${map.id}/${cols}: a saída precisa estar livre`);
    }
  }
});

test('a meia-volta cabe em pouco mais de uma casa, em qualquer velocidade', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = run({ mode: 'wrap', difficulty });
    steer(state, 0);
    tick(state, 0.2);
    const y0 = state.head.y;
    steer(state, Math.PI);
    let largura = 0, passos = 0;
    while (Math.abs(wrapAngle(state.angle - Math.PI)) > 1e-9 && passos++ < 120) {
      updateRun(state, 1 / 120);
      largura = Math.max(largura, Math.abs(state.head.y - y0));
    }
    assert.ok(passos < 120, `${difficulty}: a meia-volta precisa fechar em menos de um segundo`);
    assert.ok(largura <= SNAKE.turnRadius * 2 + 2, `${difficulty}: meia-volta ocupou ${largura.toFixed(1)} unidades`);
    assert.equal(state.status, 'running', `${difficulty}: a meia-volta não pode encostar no corpo`);
  }
});

test('comer faz crescer e pontua; o combo encadeia até x10 e expira em cinco segundos', () => {
  const state = run({ mode: 'wrap' });
  steer(state, 0);
  for (let i = 0; i < 10; i++) { foodAhead(state); updateRun(state, 1 / 120); }
  assert.equal(state.foods, 10);
  assert.equal(cellsLong(state), 14);
  assert.equal(state.maxLength, 14);
  assert.equal(state.bestCombo, 10);
  assert.equal(state.score, 550);
  state.food = { x: 30, y: 30, type: 'food' };
  state.head = { x: 200, y: 400 };
  tick(state, 5.1);
  assert.equal(state.combo, 0);
  assert.equal(state.bestCombo, 10);
});

test('bônus: especial cresce e vale 50, multiplicador dobra, redutor encurta, slow e turbo mudam a velocidade', () => {
  for (const type of ['special', 'multiplier', 'shield', 'shrink', 'slow', 'turbo']) {
    const state = run({ mode: 'wrap' });
    steer(state, 0);
    state.length = 8 * SNAKE.cell;
    state.maxLength = 8;
    state.food = { x: 30, y: 30, type: 'food' };
    state.bonus = { x: state.head.x + 10, y: state.head.y, type, remaining: 10, duration: 10 };
    const speed = state.speed;
    const events = updateRun(state, 1 / 120);
    assert.equal(state.bonus, null, type);
    assert.ok(events.some(e => e.type === 'bonus' && e.item === type), type);
    updateRun(state, 1 / 120);
    if (type === 'special') { assert.equal(state.foods, 1); assert.equal(state.score, 50); assert.equal(cellsLong(state), 9); }
    if (type === 'multiplier') { assert.ok(state.effects.multiplier > 7.9); foodAhead(state); updateRun(state, 1 / 120); assert.equal(state.score, 20); }
    if (type === 'shield') assert.equal(state.effects.shield, true);
    if (type === 'shrink') { assert.equal(cellsLong(state), 5); assert.equal(state.maxLength, 8); }
    if (type === 'slow') { assert.ok(state.effects.slow > 7.9); assert.ok(state.speed < speed); }
    if (type === 'turbo') { assert.equal(state.score, 100); assert.ok(state.effects.turbo > 5.9); assert.ok(state.speed > speed); }
  }
});

test('escudo absorve borda, corpo, obstáculo e zona ativa, e a partida continua', () => {
  for (const cause of ['wall', 'body', 'obstacle', 'hazard']) {
    const state = run();
    if (cause === 'wall') state.head = { x: state.w - 12, y: 240 };
    if (cause === 'body') bodyAcross(state);
    const block = { x: state.head.x + 8, y: state.head.y - 10, w: 20, h: 20 };
    if (cause === 'obstacle') state.obstacles = [block];
    if (cause === 'hazard') state.hazards = [{ ...block, active: true, permanent: false, warning: 0, remaining: 3 }];
    state.effects.shield = true;
    steer(state, 0);
    const events = tick(state, 0.3);
    assert.equal(state.status, 'running', cause);
    assert.equal(state.effects.shield, false, cause);
    assert.ok(events.some(e => e.type === 'shield'), cause);
    tick(state, 1.5);
    assert.equal(state.status, 'running', `${cause}: depois do escudo a cobra precisa seguir viva`);
  }
});

test('a velocidade sobe por nível conforme a dificuldade e fica estável no Zen', () => {
  const speeds = [];
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = run({ difficulty, mode: 'wrap' });
    steer(state, 0);
    const start = state.speed;
    speeds.push(start);
    for (let i = 0; i < SNAKE.levelEvery; i++) { foodAhead(state); updateRun(state, 1 / 120); }
    updateRun(state, 1 / 120);
    assert.equal(state.level, 2);
    assert.ok(state.speed > start);
  }
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  const zen = run({ mode: 'zen' });
  steer(zen, 0);
  const start = zen.speed;
  for (let i = 0; i < SNAKE.levelEvery; i++) { foodAhead(zen); updateRun(zen, 1 / 120); }
  updateRun(zen, 1 / 120);
  assert.equal(zen.speed, start);
});

test('Desafio: aviso vira obstáculo, perigo temporário some e objetivo dá recompensa', () => {
  const state = run({ mode: 'challenge' });
  state.head = { x: 100, y: 200 };
  state.path = Array.from({ length: 20 }, (_, i) => ({ x: 96 - i * 4, y: 200 }));
  steer(state, 0);
  state.hazards = [{ x: 20, y: 20, w: 20, h: 20, active: false, permanent: true, warning: 2, remaining: Infinity }];
  tick(state, 2.1);
  assert.equal(state.status, 'running');
  assert.ok(state.obstacles.some(r => r.x === 20 && r.y === 20));
  state.hazards = [{ x: 20, y: 60, w: 20, h: 20, active: true, permanent: false, remaining: 0.01 }];
  updateRun(state, 0.02);
  assert.equal(state.hazards.length, 0);

  state.foods = 7;
  state.score = 0;
  state.combo = 0; state.comboRemaining = 0;
  foodAhead(state);
  const events = updateRun(state, 1 / 120);
  assert.ok(events.some(e => e.type === 'objective' && e.points === 200));
  assert.equal(state.score, 210);
  assert.equal(state.objective.target, 20);
});

test('intervalos inválidos não alteram a partida', () => {
  const state = run({ mode: 'wrap' });
  steer(state, 0);
  const snapshot = plain(state);
  for (const dt of [0, -1, NaN, Infinity, undefined]) assert.deepEqual(updateRun(state, dt), []);
  assert.deepEqual(plain(state), snapshot);
});

test('perfil saneia dados corrompidos e permite apenas configurações conhecidas', () => {
  for (const value of [null, [], 'inválido', 42]) {
    const profile = createProfile(value);
    assert.equal(profile.best, 0); assert.deepEqual(plain(profile.unlockedMaps), ['grid']);
    assert.equal(profile.settings.effects, true); assert.equal(profile.settings.music, false);
  }
  const profile = createProfile({ best: Infinity, settings: { mode: 'oops', map: 'void', effects: 'false', music: true, dpad: true },
    bestByMode: { classic: -8, wrap: 54.9 },
    stats: { games: -1, foods: 45, best: 400, time: NaN }, unlockedMaps: ['bad', 'grid', 'grid'], achievements: ['bad', 'length25', 'length25'] });
  assert.equal(profile.best, 400); assert.equal(profile.settings.mode, 'classic'); assert.equal(profile.settings.map, 'grid');
  assert.equal(profile.settings.effects, true); assert.equal(profile.settings.music, true);
  assert.equal('dpad' in profile.settings, false);
  assert.equal(profile.bestByMode.classic, 0); assert.equal(profile.bestByMode.wrap, 54);
  assert.equal(profile.stats.games, 0); assert.equal(profile.stats.time, 0);
  assert.deepEqual(plain(profile.unlockedMaps), ['grid', 'circuit', 'maze']);
  assert.deepEqual(plain(profile.achievements), ['length25']);
});

test('aparências: liberam por marcas do histórico e a escolhida precisa estar liberada', () => {
  const novato = createProfile();
  assert.deepEqual(plain(novato.unlockedSkins), ['lima']);
  assert.equal(novato.settings.skin, 'lima');
  assert.equal(createProfile({ settings: { skin: 'arco' } }).settings.skin, 'lima', 'visual bloqueado volta ao padrão');
  assert.equal(createProfile({ settings: { skin: 'arco' }, stats: { foods: 200 } }).settings.skin, 'arco');
  const veterano = createProfile({ stats: { games: 9, maxLength: 40, bestCombo: 9, foods: 200, best: 1500 } });
  assert.deepEqual(plain(veterano.unlockedSkins), SKINS.map(skin => skin.id));

  const state = run();
  Object.assign(state, { score: 1200, foods: 3, maxLength: 30, bestCombo: 4, elapsed: 20, status: 'over' });
  const result = recordRun(createProfile(), state);
  assert.deepEqual(plain(result.newSkins), ['rosa', 'ambar']);
  assert.ok(result.profile.unlockedSkins.includes('rosa'));
  assert.deepEqual(plain(recordRun(result.profile, state).newSkins), [], 'a mesma partida não libera duas vezes');
});

test('registro acumula estatísticas, recordes e desbloqueios uma única vez por partida', () => {
  const initial = createProfile();
  const state = run({ mode: 'challenge', difficulty: 'hard' });
  Object.assign(state, { score: 2400, foods: 230, maxLength: 100, bestCombo: 12, elapsed: 190, status: 'over' });
  const result = recordRun(initial, state);
  assert.equal(initial.stats.games, 0);
  assert.equal(result.profile.best, 2400); assert.equal(result.profile.bestByMode.challenge, 2400);
  assert.equal(result.profile.bestByDifficulty.hard, 2400); assert.equal(result.profile.stats.time, 190);
  assert.equal(result.profile.stats.games, 1); assert.equal(result.profile.stats.foods, 230);
  assert.equal(result.unlockedMaps.length, 5); assert.equal(result.newAchievements.length, 7);
  assert.deepEqual(plain(result.newSkins), ['rosa', 'ambar', 'gelo', 'arco'], 'só o Ciano continua preso, por exigir 5 partidas');
  assert.equal(recordRun(result.profile, state).profile.stats.games, 1);
  const abandoned = run(); Object.assign(abandoned, { foods: 2, elapsed: 1.5 });
  const next = recordRun(result.profile, abandoned);
  assert.equal(next.profile.stats.games, 2); assert.equal(next.profile.stats.foods, 232);
  assert.equal(next.profile.stats.time, 191.5); assert.equal(next.profile.best, 2400);
  assert.equal(next.unlockedMaps.length, 0); assert.equal(next.newAchievements.length, 0);
});
