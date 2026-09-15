import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ console });
const loaded = new Map();
async function load(path) {
  if (loaded.has(path)) return loaded.get(path);
  const mod = new vm.SourceTextModule(await readFile(path, 'utf8'), { context, identifier: path });
  loaded.set(path, mod);
  await mod.link((specifier, parent) => load(resolve(dirname(parent.identifier), specifier)));
  return mod;
}
const mod = await load(resolve(root, 'games/neon-snake/model.js'));
await mod.evaluate();
const { createRun, queueDirection, updateRun, createProfile, recordRun } = mod.namespace;
const { MAPS, ITEMS } = loaded.get(resolve(root, 'games/neon-snake/config.js')).namespace;
const plain = value => JSON.parse(JSON.stringify(value));
const run = options => {
  const state = createRun(options, () => 0.42);
  state.nextBonus = 1000;
  return state;
};
const tick = state => updateRun(state, Math.max(0, state.stepDuration - state.accumulator) + 1e-8);
const foodAhead = state => {
  const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.direction];
  state.food = { x: (state.snake[0].x + vector[0] + 20) % 20, y: (state.snake[0].y + vector[1] + 24) % 24, type: 'food' };
};
const bonusAhead = (state, type) => { state.bonus = { x: state.snake[0].x + 1, y: state.snake[0].y, type, remaining: 10 }; };

test('estado inicial válido e alimentos livres em todas as arenas', () => {
  assert.equal(Object.keys(ITEMS).length, 7);
  for (const map of MAPS) for (const mode of ['classic', 'wrap', 'challenge', 'zen']) {
    const state = run({ map: map.id, mode });
    assert.equal(state.status, 'running');
    assert.equal(state.cols, 20); assert.equal(state.rows, 24);
    assert.equal(state.snake.length, 4);
    assert.deepEqual(plain(state.snake), plain(state.previousSnake));
    assert.ok(state.food);
    assert.ok(![...state.snake, ...state.obstacles].some(p => p.x === state.food.x && p.y === state.food.y));
    assert.equal(Boolean(state.obstacles.length), mode === 'challenge');
    assert.ok(!state.obstacles.some(p => state.snake.some(segment => p.x === segment.x && p.y === segment.y)));
  }
  const fallback = createRun({ mode: 'inválido', difficulty: null, map: '__proto__' });
  assert.equal(fallback.mode, 'classic'); assert.equal(fallback.difficulty, 'normal'); assert.equal(fallback.map, 'grid');
});

test('fila aceita dois gestos rápidos e rejeita reversão, repetição e entradas inválidas', () => {
  const state = run();
  assert.equal(queueDirection(state, 'left'), false);
  assert.equal(queueDirection(state, 'up'), true);
  assert.equal(queueDirection(state, 'down'), false);
  assert.equal(queueDirection(state, 'left'), true);
  assert.equal(queueDirection(state, 'down'), false);
  assert.equal(queueDirection(state, 'constructor'), false);
  assert.equal(queueDirection(state, 'right'), false);
  tick(state); assert.equal(state.direction, 'up'); assert.deepEqual(plain(state.snake[0]), { x: 10, y: 11 });
  tick(state); assert.equal(state.direction, 'left'); assert.deepEqual(plain(state.snake[0]), { x: 9, y: 11 });
  assert.equal(state.turnQueue.length, 0);
});

test('parede encerra Clássico; Sem Paredes e Zen atravessam as duas bordas', () => {
  for (const mode of ['classic', 'wrap', 'zen']) {
    const state = run({ mode });
    state.snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }];
    const events = tick(state);
    if (mode === 'classic') {
      assert.equal(state.status, 'over'); assert.match(state.deathReason, /borda/);
      assert.equal(events.filter(e => e.type === 'over').length, 1);
      assert.equal(updateRun(state, 2).length, 0);
    } else {
      assert.equal(state.status, 'running'); assert.equal(state.snake[0].x, 0);
      state.snake = [{ x: 4, y: 0 }]; state.direction = 'up';
      tick(state); assert.equal(state.snake[0].y, 23);
    }
  }
});

test('entrar na posição que a cauda está deixando é legal; corpo continua sólido', () => {
  const state = run();
  state.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }];
  state.direction = 'left';
  tick(state);
  assert.equal(state.status, 'running'); assert.deepEqual(plain(state.snake[0]), { x: 4, y: 5 });
  state.direction = 'right';
  tick(state);
  assert.equal(state.status, 'over'); assert.match(state.deathReason, /corpo/);
});

test('coletar faz crescer e os combos chegam a ×10; a sequência expira em cinco segundos', () => {
  const state = run({ mode: 'wrap' });
  for (let index = 0; index < 10; index++) { foodAhead(state); tick(state); }
  assert.equal(state.foods, 10); assert.equal(state.snake.length, 14);
  assert.equal(state.maxLength, 14); assert.equal(state.bestCombo, 10);
  assert.equal(state.score, 550); assert.equal(state.combo, 10);
  state.snake = [{ x: 10, y: 12 }]; state.food = { x: 2, y: 2, type: 'food' };
  updateRun(state, 5.1);
  assert.equal(state.status, 'running'); assert.equal(state.combo, 0); assert.equal(state.bestCombo, 10);
  foodAhead(state); tick(state); assert.equal(state.combo, 1); assert.equal(state.score, 560);
});

test('cada bônus aplica seu efeito e alimento especial também alimenta a cobra', () => {
  for (const type of ['special', 'multiplier', 'shield', 'shrink', 'slow', 'turbo']) {
    const state = run();
    state.food = { x: 1, y: 1, type: 'food' };
    state.snake = Array.from({ length: 8 }, (_, index) => ({ x: 10 - index, y: 12 }));
    state.maxLength = 8;
    const speed = state.stepDuration;
    bonusAhead(state, type);
    const events = tick(state);
    assert.equal(state.bonus, null);
    assert.ok(events.some(e => e.type === 'bonus' && e.item === type));
    if (type === 'special') { assert.equal(state.foods, 1); assert.equal(state.score, 50); assert.equal(state.snake.length, 9); }
    if (type === 'multiplier') { assert.ok(state.effects.multiplier > 7.9); foodAhead(state); tick(state); assert.equal(state.score, 20); }
    if (type === 'shield') assert.equal(state.effects.shield, true);
    if (type === 'shrink') { assert.equal(state.snake.length, 6); assert.equal(state.maxLength, 8); }
    if (type === 'slow') { assert.ok(state.effects.slow > 7.9); assert.ok(state.stepDuration > speed); }
    if (type === 'turbo') { assert.equal(state.score, 100); assert.ok(state.effects.turbo > 5.9); assert.ok(state.stepDuration < speed); }
  }
});

test('bônus e efeitos temporários expiram; intervalos inválidos não alteram a partida', () => {
  const state = run({ mode: 'wrap' });
  state.snake = [{ x: 10, y: 12 }]; state.food = { x: 0, y: 0, type: 'food' };
  state.bonus = { x: 1, y: 1, type: 'special', remaining: 0.15 };
  state.effects = { multiplier: 0.15, shield: true, slow: 0.15, turbo: 0 };
  const snapshot = plain(state);
  for (const dt of [0, -1, NaN, Infinity, undefined]) assert.deepEqual(plain(updateRun(state, dt)), []);
  assert.deepEqual(plain(state), snapshot);
  updateRun(state, 0.2);
  assert.equal(state.bonus, null); assert.equal(state.effects.multiplier, 0); assert.equal(state.effects.slow, 0);
  assert.equal(state.effects.shield, true); assert.ok(Math.abs(state.elapsed - 0.2) < 1e-8);
  assert.ok(Math.abs(state.stepDuration - 0.175) < 1e-8);
});

test('escudo absorve parede, corpo, obstáculo e zona ativa e permite o próximo passo', () => {
  for (const cause of ['wall', 'body', 'obstacle', 'hazard']) {
    const state = run();
    state.effects.shield = true;
    state.food = { x: 1, y: 1, type: 'food' };
    if (cause === 'wall') state.snake = [{ x: 19, y: 12 }, { x: 18, y: 12 }, { x: 17, y: 12 }];
    if (cause === 'body') state.snake = [{ x: 10, y: 12 }, { x: 10, y: 13 }, { x: 11, y: 13 }, { x: 11, y: 12 }, { x: 12, y: 12 }];
    if (cause === 'obstacle') state.obstacles = [{ x: 11, y: 12 }];
    if (cause === 'hazard') state.hazards = [{ x: 11, y: 12, active: true, remaining: 3 }];
    const events = tick(state);
    assert.equal(state.status, 'running', cause); assert.equal(state.effects.shield, false, cause);
    assert.ok(events.some(e => e.type === 'shield'), cause);
    tick(state); assert.equal(state.status, 'running', cause);
  }
});

test('escudo abre uma saída quando a cabeça está cercada pelo próprio corpo', () => {
  const state = run();
  state.snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  state.direction = 'up'; state.effects.shield = true; state.food = { x: 15, y: 15, type: 'food' };
  tick(state); assert.equal(state.status, 'running'); assert.ok(state.snake.length < 5);
  tick(state); assert.equal(state.status, 'running');
});

test('a velocidade progride por dificuldade e permanece estável no Zen', () => {
  const speeds = [];
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = run({ difficulty }); const start = state.stepDuration;
    speeds.push(start);
    for (let i = 0; i < 5; i++) { foodAhead(state); tick(state); }
    assert.equal(state.level, 2); assert.ok(state.stepDuration < start);
  }
  assert.ok(speeds[0] > speeds[1] && speeds[1] > speeds[2]);
  const zen = run({ mode: 'zen' }); const start = zen.stepDuration;
  for (let i = 0; i < 5; i++) { foodAhead(zen); tick(zen); }
  assert.equal(zen.stepDuration, start);
});

test('novos obstáculos recebem aviso e nunca aparecem sobre a cobra ou sobre itens', () => {
  const state = run({ mode: 'challenge', difficulty: 'hard' });
  state.foods = 3;
  foodAhead(state); tick(state);
  const warning = state.hazards.find(h => h.permanent);
  assert.ok(warning); assert.equal(warning.active, false); assert.ok(warning.warning >= 1.99);
  assert.ok(![...state.snake, state.food, state.bonus].filter(Boolean).some(p => p.x === warning.x && p.y === warning.y));
  assert.ok(Math.abs(warning.x - state.snake[0].x) + Math.abs(warning.y - state.snake[0].y) >= 5);
  const obstacles = state.obstacles.length;
  state.hazards = [{ x: state.snake[0].x, y: state.snake[0].y, active: false, permanent: true, warning: 0.01, remaining: Infinity }];
  updateRun(state, 0.02);
  assert.equal(state.obstacles.length, obstacles); assert.ok(state.hazards[0].warning >= 1.79);
});

test('avisos tornam-se obstáculos após tempo seguro e perigos temporários desaparecem', () => {
  const state = run({ mode: 'challenge' });
  state.snake = [{ x: 10, y: 20 }]; state.direction = 'up'; state.food = { x: 0, y: 0, type: 'food' };
  state.hazards = [{ x: 2, y: 3, active: false, permanent: true, warning: 2, remaining: Infinity }];
  updateRun(state, 2.1);
  assert.equal(state.status, 'running'); assert.ok(state.obstacles.some(p => p.x === 2 && p.y === 3));
  assert.equal(state.hazards.length, 0);
  state.hazards = [{ x: 2, y: 4, active: true, permanent: false, remaining: 0.01 }];
  updateRun(state, 0.02); assert.equal(state.hazards.length, 0);
});

test('objetivos concedem recompensa e avançam no Desafio', () => {
  const state = run({ mode: 'challenge' });
  state.foods = 7; foodAhead(state);
  const events = tick(state);
  assert.ok(events.some(e => e.type === 'objective' && e.points === 200));
  assert.equal(state.score, 210); assert.equal(state.objective.current, 8); assert.equal(state.objective.target, 20);
});

test('alimentos são colocados no componente acessível e sorteio constante termina', () => {
  const state = createRun({}, () => 0);
  state.nextBonus = 1000;
  state.obstacles = Array.from({ length: 24 }, (_, y) => ({ x: 11, y }));
  state.direction = 'down'; foodAhead(state); tick(state);
  assert.equal(state.status, 'running'); assert.ok(state.food.x < 11);
  assert.ok(!state.snake.some(p => p.x === state.food.x && p.y === state.food.y));
});

test('ocupar a última célula termina com vitória sem repetir sorteios', () => {
  const state = createRun({}, () => 0);
  const body = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 20; x++) if (!(y === 0 && (x === 0 || x === 1))) body.push({ x, y });
  state.snake = [{ x: 0, y: 0 }, ...body]; state.previousSnake = plain(state.snake);
  state.direction = 'right'; state.food = { x: 1, y: 0, type: 'food' }; state.nextBonus = 1000;
  const events = tick(state);
  assert.equal(state.snake.length, 480); assert.equal(state.food, null);
  assert.equal(state.status, 'over'); assert.equal(state.victory, true);
  assert.equal(events.filter(e => e.type === 'over').length, 1);
});

test('perfil saneia dados corrompidos e permite apenas configurações conhecidas', () => {
  for (const value of [null, [], 'inválido', 42]) {
    const profile = createProfile(value);
    assert.equal(profile.best, 0); assert.deepEqual(plain(profile.unlockedMaps), ['grid']);
    assert.equal(profile.settings.effects, true); assert.equal(profile.settings.music, false);
  }
  const profile = createProfile({ best: Infinity, settings: { mode: 'oops', map: 'void', effects: 'false', music: true },
    bestByMode: { classic: -8, wrap: 54.9, __proto__: { hacked: true } },
    stats: { games: -1, foods: 45, best: 400, time: NaN }, unlockedMaps: ['bad', 'grid', 'grid'], achievements: ['bad', 'length25', 'length25'] });
  assert.equal(profile.best, 400); assert.equal(profile.settings.mode, 'classic'); assert.equal(profile.settings.map, 'grid');
  assert.equal(profile.settings.effects, true); assert.equal(profile.settings.music, true);
  assert.equal(profile.bestByMode.classic, 0); assert.equal(profile.bestByMode.wrap, 54);
  assert.equal(profile.stats.games, 0); assert.equal(profile.stats.time, 0);
  assert.deepEqual(plain(profile.unlockedMaps), ['grid', 'circuit', 'maze']);
  assert.deepEqual(plain(profile.achievements), ['length25']);
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
  assert.equal(recordRun(result.profile, state).profile.stats.games, 1);
  const abandoned = run(); Object.assign(abandoned, { foods: 2, elapsed: 1.5 });
  const next = recordRun(result.profile, abandoned);
  assert.equal(next.profile.stats.games, 2); assert.equal(next.profile.stats.foods, 232);
  assert.equal(next.profile.stats.time, 191.5); assert.equal(next.profile.best, 2400);
  assert.equal(next.unlockedMaps.length, 0); assert.equal(next.newAchievements.length, 0);
});
