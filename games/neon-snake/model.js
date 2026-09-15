import { MODES, DIFFICULTIES, MAPS, ACHIEVEMENTS } from './config.js';

const VECTORS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIRECTIONS = ['up', 'right', 'down', 'left'];
const RANDOM = new WeakMap();
const RECORDED = new WeakSet();
const BONUS_TYPES = ['special', 'special', 'special', 'multiplier', 'shield', 'shrink', 'slow', 'turbo'];
const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y);
const key = p => p.y * 20 + p.x;
const copy = snake => snake.map(p => ({ x: p.x, y: p.y }));
const choice = (values, id, fallback) => values.find(value => value.id === id) || values.find(value => value.id === fallback) || values[0];
const number = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : fallback;
const integer = value => Math.floor(number(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const wraps = state => state.mode === 'wrap' || state.mode === 'zen';
const random = state => Math.max(0, Math.min(0.999999999, number(RANDOM.get(state)?.(), 0.5)));

function nextCell(state, direction, point = state.snake[0]) {
  const delta = VECTORS[direction];
  const next = { x: point.x + delta.x, y: point.y + delta.y };
  if (wraps(state)) {
    next.x = (next.x + state.cols) % state.cols;
    next.y = (next.y + state.rows) % state.rows;
  }
  return next;
}

function inside(state, point) {
  return point.x >= 0 && point.x < state.cols && point.y >= 0 && point.y < state.rows;
}

function solid(state, point) {
  return state.obstacles.some(p => same(p, point)) || state.hazards.some(p => p.active && same(p, point));
}

function blockedCells(state, includeSnake = true, extra = null) {
  const blocked = new Set(state.obstacles.map(key));
  // Reservar também os avisos impede que um item apareça sobre um futuro perigo.
  state.hazards.forEach(p => blocked.add(key(p)));
  if (includeSnake) state.snake.slice(1, -1).forEach(p => blocked.add(key(p)));
  if (extra) blocked.add(key(extra));
  return blocked;
}

function reachable(state, includeSnake = true, extra = null) {
  const blocked = blockedCells(state, includeSnake, extra);
  const seen = new Set([key(state.snake[0])]);
  const pending = [state.snake[0]];
  for (let index = 0; index < pending.length; index++) {
    for (const direction of DIRECTIONS) {
      const point = nextCell(state, direction, pending[index]);
      const id = key(point);
      if (!inside(state, point) || blocked.has(id) || seen.has(id)) continue;
      seen.add(id);
      pending.push(point);
    }
  }
  return seen;
}

function freeCells(state, includeFood = true, includeBonus = true) {
  const blocked = new Set([...state.snake, ...state.obstacles, ...state.hazards].map(key));
  if (includeFood && state.food) blocked.add(key(state.food));
  if (includeBonus && state.bonus) blocked.add(key(state.bonus));
  const cells = [];
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const point = { x, y };
    if (!blocked.has(key(point))) cells.push(point);
  }
  return cells;
}

function spawnCell(state) {
  const seen = reachable(state);
  const cells = freeCells(state).filter(p => seen.has(key(p)));
  return cells.length ? cells[Math.floor(random(state) * cells.length)] : null;
}

function finish(state, events, reason, victory = false) {
  state.status = 'over';
  state.deathReason = reason;
  state.victory = victory;
  state.accumulator = 0;
  events.push({ type: 'over', ...state.snake[0], points: state.score });
}

function spawnFood(state, events) {
  const point = spawnCell(state);
  state.food = point ? { ...point, type: 'food' } : null;
  if (!point && !freeCells(state, false, false).length) {
    finish(state, events, 'Arena completa! Você dominou toda a grade.', true);
  }
}

function mapObstacles(map) {
  const points = [];
  const add = (x, y) => points.push({ x, y });
  if (map === 'grid') [[4, 5], [15, 5], [4, 18], [15, 18]].forEach(([x, y]) => add(x, y));
  if (map === 'circuit') {
    for (let x = 4; x <= 7; x++) { add(x, 5); add(19 - x, 18); }
    for (let y = 5; y <= 8; y++) { add(15, y); add(4, 23 - y); }
  }
  if (map === 'maze') {
    for (let x = 3; x <= 15; x++) if (x < 8 || x > 10) { add(x, 6); add(19 - x, 17); }
    for (let y = 8; y <= 15; y++) if (y < 11 || y > 12) { add(3, y); add(16, y); }
  }
  if (map === 'hex') {
    [[6, 5], [13, 5], [3, 10], [16, 10], [3, 15], [16, 15], [6, 19], [13, 19]].forEach(([x, y]) => { add(x, y); add(x + 1, y); });
  }
  if (map === 'city') {
    for (const x of [3, 8, 14]) for (const y of [4, 18]) {
      add(x, y); add(x + 1, y); add(x, y + 1); add(x + 1, y + 1);
    }
  }
  if (map === 'void') [[4, 4], [15, 4], [3, 12], [16, 12], [4, 19], [15, 19]].forEach(([x, y]) => add(x, y));
  return points;
}

function updateSpeed(state) {
  const difficulty = choice(DIFFICULTIES, state.difficulty, 'normal');
  const base = state.mode === 'zen' ? Math.max(0.23, difficulty.step * 1.3) : Math.max(difficulty.maxSpeed, difficulty.step * Math.pow(0.94, state.level - 1));
  state.stepDuration = base * (state.effects.slow > 0 ? 1.65 : 1) * (state.effects.turbo > 0 ? 0.68 : 1);
}

export function createRun(options = {}, rng = Math.random) {
  options = object(options);
  const state = {
    mode: choice(MODES, options.mode, 'classic').id,
    difficulty: choice(DIFFICULTIES, options.difficulty, 'normal').id,
    map: choice(MAPS, options.map, 'grid').id,
    status: 'running', cols: 20, rows: 24,
    snake: [{ x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }, { x: 7, y: 12 }],
    previousSnake: [], direction: 'right', turnQueue: [], accumulator: 0, stepDuration: 0.175,
    food: null, bonus: null, obstacles: [], hazards: [],
    score: 0, foods: 0, maxLength: 4, combo: 0, bestCombo: 0, comboRemaining: 0,
    level: 1, elapsed: 0, effects: { multiplier: 0, shield: false, slow: 0, turbo: 0 },
    objective: { label: 'Colete 8 alimentos', current: 0, target: 8 },
    deathReason: '', victory: false, nextBonus: 5, objectiveStage: 0, nextHazard: 16
  };
  RANDOM.set(state, typeof rng === 'function' ? rng : Math.random);
  state.previousSnake = copy(state.snake);
  if (state.mode === 'challenge') state.obstacles = mapObstacles(state.map);
  updateSpeed(state);
  spawnFood(state, []);
  return state;
}

export function queueDirection(state, direction) {
  if (state.status !== 'running' || !Object.hasOwn(VECTORS, direction)) return false;
  const previous = state.turnQueue.at(-1) || state.direction;
  if (direction === previous || (state.snake.length > 1 && direction === OPPOSITE[previous]) || state.turnQueue.length >= 2) return false;
  state.turnQueue.push(direction);
  return true;
}

function addDanger(state, permanent) {
  // A vizinhança da cabeça e os próximos dois passos ficam sempre livres.
  const head = state.snake[0];
  const candidates = freeCells(state).filter(p => Math.abs(p.x - head.x) + Math.abs(p.y - head.y) >= 5);
  if (!candidates.length || state.obstacles.length + state.hazards.length >= 62) return;
  const offset = Math.floor(random(state) * candidates.length);
  const currentSpace = reachable(state, false).size;
  for (let attempt = 0; attempt < Math.min(candidates.length, 32); attempt++) {
    const point = candidates[(offset + attempt) % candidates.length];
    // Não fechar corredores nem isolar o alimento que já está no tabuleiro.
    const seen = reachable(state, false, point);
    if (seen.size < currentSpace - 1 || (state.food && !seen.has(key(state.food)))) continue;
    state.hazards.push({ ...point, active: false, warning: 2, permanent, remaining: permanent ? Infinity : 4.5 });
    return;
  }
}

function updateDangers(state, dt) {
  for (const hazard of state.hazards) {
    if (hazard.active) { hazard.remaining -= dt; continue; }
    hazard.warning = Math.max(0, hazard.warning - dt);
    if (hazard.warning > 0) continue;
    const head = state.snake[0];
    const close = Math.abs(head.x - hazard.x) + Math.abs(head.y - hazard.y) <= 2;
    if (close || state.snake.some(p => same(p, hazard)) || same(state.food, hazard) || same(state.bonus, hazard)) {
      hazard.warning = 1.8;
      continue;
    }
    if (hazard.permanent) {
      state.obstacles.push({ x: hazard.x, y: hazard.y });
      hazard.remaining = 0;
    } else hazard.active = true;
  }
  state.hazards = state.hazards.filter(hazard => hazard.remaining > 0);
}

function advanceTimers(state, dt) {
  state.elapsed += dt;
  state.comboRemaining = Math.max(0, state.comboRemaining - dt);
  if (!state.comboRemaining) state.combo = 0;
  for (const name of ['multiplier', 'slow', 'turbo']) state.effects[name] = Math.max(0, state.effects[name] - dt);
  if (state.bonus) {
    state.bonus.remaining -= dt;
    if (state.bonus.remaining <= 0) state.bonus = null;
  }
  state.nextBonus -= dt;
  if (state.nextBonus <= 0 && !state.bonus) {
    const point = spawnCell(state);
    const difficulty = choice(DIFFICULTIES, state.difficulty, 'normal');
    if (point) state.bonus = { ...point, type: BONUS_TYPES[Math.floor(random(state) * BONUS_TYPES.length)], remaining: difficulty.bonusDuration };
    state.nextBonus = Math.max(5, 13 - state.level * 0.7) + random(state) * 3;
  }
  if (state.mode === 'challenge') {
    updateDangers(state, dt);
    state.nextHazard -= dt;
    if (state.nextHazard <= 0) {
      addDanger(state, false);
      state.nextHazard = Math.max(6, 17 - state.level);
    }
  }
}

function addScore(state, base) {
  const points = base * Math.max(1, state.combo) * (state.effects.multiplier > 0 ? 2 : 1);
  state.score += points;
  return points;
}

function collectFood(state, type, events) {
  state.foods++;
  state.combo = Math.min(12, state.comboRemaining > 0 ? state.combo + 1 : 1);
  state.comboRemaining = 5;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const points = addScore(state, type === 'special' ? 50 : 10);
  events.push({ type: 'eat', ...state.snake[0], points, item: type });
  if (state.combo > 1) events.push({ type: 'combo', ...state.snake[0], points: 0 });
  const level = 1 + Math.floor(state.foods / 5);
  if (level > state.level) {
    state.level = level;
    events.push({ type: 'level', ...state.snake[0], points: 0 });
  }
  if (state.mode === 'challenge') {
    const difficulty = choice(DIFFICULTIES, state.difficulty, 'normal');
    if (state.foods % difficulty.obstacleEvery === 0) addDanger(state, true);
    state.objective.current = state.foods;
    if (state.foods >= state.objective.target) {
      const reward = 200 + state.objectiveStage * 100;
      state.score += reward;
      events.push({ type: 'objective', ...state.snake[0], points: reward });
      state.objectiveStage++;
      const target = state.objective.target + 8 + state.objectiveStage * 4;
      state.objective = { label: `Colete ${target} alimentos`, current: state.foods, target };
      addDanger(state, true);
    }
  }
}

function collectBonus(state, item, events) {
  const duration = choice(DIFFICULTIES, state.difficulty, 'normal').bonusDuration;
  let points = 0;
  if (item === 'special') collectFood(state, item, events);
  if (item === 'multiplier') state.effects.multiplier = duration;
  if (item === 'shield') state.effects.shield = true;
  if (item === 'shrink') state.snake.splice(Math.max(3, Math.ceil(state.snake.length * 0.65)));
  if (item === 'slow') { state.effects.slow = duration; state.effects.turbo = 0; }
  if (item === 'turbo') { points = addScore(state, 100); state.effects.turbo = duration * 0.75; state.effects.slow = 0; }
  events.push({ type: 'bonus', ...state.snake[0], points, item });
}

function collision(state, next, grow = false) {
  if (!inside(state, next)) return 'Você encontrou a borda da arena.';
  if (state.obstacles.some(p => same(next, p))) return 'Um obstáculo interrompeu seu caminho.';
  if (state.hazards.some(p => p.active && same(next, p))) return 'Você entrou em uma zona de perigo ativa.';
  const body = grow ? state.snake : state.snake.slice(0, -1);
  if (body.some(p => same(next, p))) return 'Sua cabeça encontrou o próprio corpo.';
  return '';
}

function useShield(state, events) {
  state.effects.shield = false;
  state.turnQueue.length = 0;
  const candidates = [state.direction, ...DIRECTIONS.filter(direction => direction !== state.direction)];
  // Manter a cabeça no lugar dá um passo de respiro. Em um nó fechado, reduzir
  // apenas a cauda necessária abre uma saída e garante que o escudo funcione.
  let escape;
  while (!escape && state.snake.length) {
    escape = candidates.find(direction => !collision(state, nextCell(state, direction), false));
    if (!escape && state.snake.length > 1) state.snake.pop();
    else break;
  }
  if (!escape) {
    // Uma arena externamente alterada pode cercar a cabeça por quatro paredes.
    escape = candidates.find(direction => inside(state, nextCell(state, direction)));
    const point = nextCell(state, escape);
    state.obstacles = state.obstacles.filter(p => !same(p, point));
    state.hazards = state.hazards.filter(p => !same(p, point));
  }
  state.direction = escape;
  state.previousSnake = copy(state.snake);
  events.push({ type: 'shield', ...state.snake[0], points: 0 });
}

function step(state, events) {
  if (state.turnQueue.length) state.direction = state.turnQueue.shift();
  const next = nextCell(state, state.direction);
  const eat = same(next, state.food);
  const item = same(next, state.bonus) ? state.bonus.type : null;
  const grow = eat || item === 'special';
  const reason = collision(state, next, grow);
  if (reason) {
    if (state.effects.shield) useShield(state, events);
    else finish(state, events, reason);
    return;
  }
  state.previousSnake = copy(state.snake);
  state.snake.unshift(next);
  if (!grow) state.snake.pop();
  state.maxLength = Math.max(state.maxLength, state.snake.length);
  if (eat) {
    state.food = null;
    collectFood(state, 'food', events);
  }
  if (item) {
    state.bonus = null;
    collectBonus(state, item, events);
  }
  if (!state.food && state.status === 'running') spawnFood(state, events);
}

export function updateRun(state, dt) {
  const events = [];
  if (state.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return events;
  // O controlador pausa sem chamar esta função; o limite protege chamadas
  // acidentais com intervalos de horas sem alterar o relógio normal da partida.
  let remaining = Math.min(dt, 60);
  while (remaining > 1e-9 && state.status === 'running') {
    updateSpeed(state);
    const duration = state.stepDuration;
    const slice = Math.min(remaining, 1 / 30, Math.max(0, duration - state.accumulator));
    advanceTimers(state, slice);
    state.accumulator += slice;
    remaining -= slice;
    if (state.accumulator + 1e-9 >= duration) {
      state.accumulator = Math.max(0, state.accumulator - duration);
      step(state, events);
    }
  }
  updateSpeed(state);
  return events;
}

export function createProfile(raw = {}) {
  raw = object(raw);
  const settings = object(raw.settings);
  const stats = object(raw.stats);
  const unlocked = Array.isArray(raw.unlockedMaps) ? raw.unlockedMaps : [];
  const unlockedMaps = MAPS.filter(map => map.unlock <= integer(stats.foods) || unlocked.includes(map.id)).map(map => map.id);
  const map = choice(MAPS, settings.map, 'grid').id;
  const best = Math.max(integer(raw.best), integer(stats.best));
  return {
    settings: {
      mode: choice(MODES, settings.mode, 'classic').id,
      difficulty: choice(DIFFICULTIES, settings.difficulty, 'normal').id,
      map: unlockedMaps.includes(map) ? map : 'grid',
      ...Object.fromEntries(Object.entries({ effects: true, music: false, haptics: true, dpad: false, reducedMotion: false }).map(([id, fallback]) => [id, typeof settings[id] === 'boolean' ? settings[id] : fallback]))
    },
    best,
    bestByMode: Object.fromEntries(MODES.map(({ id }) => [id, integer(object(raw.bestByMode)[id])])),
    bestByDifficulty: Object.fromEntries(DIFFICULTIES.map(({ id }) => [id, integer(object(raw.bestByDifficulty)[id])])),
    unlockedMaps,
    achievements: ACHIEVEMENTS.filter(({ id }) => Array.isArray(raw.achievements) && raw.achievements.includes(id)).map(({ id }) => id),
    stats: { games: integer(stats.games), maxLength: integer(stats.maxLength), bestCombo: integer(stats.bestCombo), foods: integer(stats.foods), time: number(stats.time), best }
  };
}

export function recordRun(rawProfile, state) {
  const profile = createProfile(rawProfile);
  if (!state || RECORDED.has(state)) return { profile, unlockedMaps: [], newAchievements: [] };
  RECORDED.add(state);
  const score = integer(state.score);
  profile.best = Math.max(profile.best, score);
  if (Object.hasOwn(profile.bestByMode, state.mode)) profile.bestByMode[state.mode] = Math.max(profile.bestByMode[state.mode], score);
  if (Object.hasOwn(profile.bestByDifficulty, state.difficulty)) profile.bestByDifficulty[state.difficulty] = Math.max(profile.bestByDifficulty[state.difficulty], score);
  profile.stats.games++;
  profile.stats.maxLength = Math.max(profile.stats.maxLength, integer(state.maxLength));
  profile.stats.bestCombo = Math.max(profile.stats.bestCombo, integer(state.bestCombo));
  profile.stats.foods += integer(state.foods);
  profile.stats.time += number(state.elapsed);
  profile.stats.best = profile.best;
  const unlockedMaps = MAPS.filter(map => map.unlock <= profile.stats.foods && !profile.unlockedMaps.includes(map.id)).map(map => map.id);
  profile.unlockedMaps.push(...unlockedMaps);
  const conditions = {
    length25: profile.stats.maxLength >= 25,
    length50: profile.stats.maxLength >= 50,
    length100: profile.stats.maxLength >= 100,
    combo10: profile.stats.bestCombo >= 10,
    score2000: profile.best >= 2000,
    allmaps: profile.unlockedMaps.length === MAPS.length,
    survivor: number(state.elapsed) >= 180
  };
  const newAchievements = ACHIEVEMENTS.filter(({ id }) => conditions[id] && !profile.achievements.includes(id)).map(({ id }) => id);
  profile.achievements.push(...newAchievements);
  return { profile, unlockedMaps, newAchievements };
}
