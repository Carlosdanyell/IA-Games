import { MODES, DIFFICULTIES, MAPS, SKINS, ACHIEVEMENTS, SNAKE, turnRate } from './config.js';

// Simulação contínua da cobra, sem DOM. A cabeça anda sempre para a frente num
// ângulo livre e gira até a direção pedida; o corpo segue o caminho que a
// cabeça deixou, gravado em pontos a cada `SNAKE.spacing` unidades.

const TAU = Math.PI * 2;
const C = SNAKE.cell;
const RANDOM = new WeakMap();
const RECORDED = new WeakSet();
const BONUS_TYPES = ['special', 'special', 'special', 'multiplier', 'shield', 'shrink', 'slow', 'turbo'];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const choice = (values, id, fallback) => values.find(value => value.id === id) || values.find(value => value.id === fallback) || values[0];
const number = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : fallback;
const integer = value => Math.floor(number(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const wraps = state => state.mode === 'wrap' || state.mode === 'zen';
const random = state => Math.max(0, Math.min(0.999999999, number(RANDOM.get(state)?.(), 0.5)));

export const wrapAngle = angle => {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
export const cellsLong = state => Math.round(state.length / C);
// O tabuleiro tem sempre 20 linhas e ganha colunas para ocupar a tela deitada;
// cada partida guarda as próprias dimensões.
export const boardCols = cols => clamp(Math.floor(number(cols, SNAKE.cols)), SNAKE.cols, SNAKE.maxCols);

// Diferença entre dois pontos; no modo sem paredes, pelo lado mais curto.
function gap(state, a, b) {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (wraps(state)) {
    const { w, h } = state;
    if (dx > w / 2) dx -= w; else if (dx < -w / 2) dx += w;
    if (dy > h / 2) dy -= h; else if (dy < -h / 2) dy += h;
  }
  return Math.hypot(dx, dy);
}

function circleRect(point, radius, rect) {
  const cx = clamp(point.x, rect.x, rect.x + rect.w), cy = clamp(point.y, rect.y, rect.y + rect.h);
  return (point.x - cx) ** 2 + (point.y - cy) ** 2 < radius * radius;
}

// Peças de cada arena em casas [x, y, largura, altura], desenhadas para 24
// colunas. Num tabuleiro mais largo cada peça anda na proporção da largura e as
// paredes horizontais esticam junto; as outras mantêm o formato. A faixa do
// meio fica sempre livre: é de lá que a cobra sai.
const PIECES = {
  grid: [[5, 4, 1, 1], [5, 15, 1, 1], [18, 4, 1, 1], [18, 15, 1, 1]],
  circuit: [[5, 4, 1, 4], [5, 15, 4, 1], [18, 12, 1, 4], [15, 4, 4, 1]],
  maze: [[6, 3, 1, 5], [6, 11, 1, 5], [17, 4, 1, 5], [17, 12, 1, 5], [8, 3, 3, 1], [13, 3, 3, 1], [8, 16, 3, 1], [13, 16, 3, 1]],
  hex: [[5, 6], [5, 13], [10, 3], [10, 16], [15, 3], [15, 16], [19, 6], [19, 13]].map(([x, y]) => [x, y, 1, 2]),
  city: [3, 8, 14].flatMap(y => [[4, y, 2, 2], [18, y, 2, 2]]),
  void: [[4, 4, 1, 1], [4, 15, 1, 1], [12, 3, 1, 1], [12, 16, 1, 1], [19, 4, 1, 1], [19, 15, 1, 1]]
};

function mapObstacles(map, cols) {
  const scale = cols / SNAKE.cols, rects = [];
  for (const [x, y, w, h] of PIECES[map] || []) {
    const wide = w > h ? Math.round(w * scale) : w;
    const left = Math.round((x + w / 2) * scale - wide / 2);
    for (let i = 0; i < wide; i++) for (let j = 0; j < h; j++) rects.push({ x: (left + i) * C, y: (y + j) * C, w: C, h: C });
  }
  return rects;
}

function blocked(state, point) {
  if (state.obstacles.some(r => circleRect(point, 16, r)) || state.hazards.some(r => circleRect(point, 16, r))) return true;
  if (gap(state, point, state.head) < 60) return true;
  if (state.path.some(p => gap(state, point, p) < 18)) return true;
  return [state.food, state.bonus].some(item => item && gap(state, point, item) < 30);
}

// Sorteia um ponto livre; se o sorteio insistir em lugares ocupados, varre a
// grade a partir de um deslocamento sorteado e fica com o primeiro livre.
function freePoint(state) {
  const margin = 18;
  for (let attempt = 0; attempt < 40; attempt++) {
    const point = { x: margin + random(state) * (state.w - margin * 2), y: margin + random(state) * (state.h - margin * 2) };
    if (!blocked(state, point)) return point;
  }
  const total = state.cols * state.rows, offset = Math.floor(random(state) * total);
  for (let i = 0; i < total; i++) {
    const index = (offset + i) % total;
    const point = { x: (index % state.cols + 0.5) * C, y: (Math.floor(index / state.cols) + 0.5) * C };
    if (!blocked(state, point)) return point;
  }
  return null;
}

function spawnFood(state) {
  const point = freePoint(state);
  state.food = point ? { ...point, type: 'food' } : null;
}

function updateSpeed(state) {
  const d = choice(DIFFICULTIES, state.difficulty, 'normal');
  const base = state.mode === 'zen' ? d.speed * SNAKE.zenSpeed : Math.min(d.maxSpeed, d.speed * SNAKE.levelSpeedup ** (state.level - 1));
  state.speed = base * (state.effects.slow > 0 ? SNAKE.slow : 1) * (state.effects.turbo > 0 ? SNAKE.turbo : 1);
}

export function createRun(options = {}, rng = Math.random) {
  options = object(options);
  const cols = boardCols(options.cols);
  const state = {
    mode: choice(MODES, options.mode, 'classic').id,
    difficulty: choice(DIFFICULTIES, options.difficulty, 'normal').id,
    map: choice(MAPS, options.map, 'grid').id,
    cols, rows: SNAKE.rows, w: cols * C, h: SNAKE.rows * C,
    status: 'running', waiting: true,
    head: { x: (Math.floor(cols / 2) + 0.5) * C, y: (Math.floor(SNAKE.rows / 2) + 0.5) * C }, angle: 0, target: 0,
    path: [], travel: 0, length: SNAKE.startLength * C, speed: 0,
    food: null, bonus: null, obstacles: [], hazards: [],
    score: 0, foods: 0, maxLength: SNAKE.startLength, combo: 0, bestCombo: 0, comboRemaining: 0,
    level: 1, elapsed: 0,
    effects: { multiplier: 0, shield: false, slow: 0, turbo: 0, invuln: 0 },
    objective: { label: 'Colete 8 alimentos', current: 0, target: 8 },
    deathReason: '', nextBonus: 5, objectiveStage: 0, nextHazard: 16
  };
  RANDOM.set(state, typeof rng === 'function' ? rng : Math.random);
  for (let i = 1; i <= Math.ceil(state.length / SNAKE.spacing); i++) {
    state.path.push({ x: state.head.x - i * SNAKE.spacing, y: state.head.y });
  }
  if (state.mode === 'challenge') state.obstacles = mapObstacles(state.map, cols);
  updateSpeed(state);
  spawnFood(state);
  return state;
}

// Direção pedida pelo jogador, em radianos. O primeiro pedido começa a partida.
export function steer(state, angle) {
  if (state.status !== 'running' || !Number.isFinite(angle)) return false;
  state.target = wrapAngle(angle);
  state.waiting = false;
  return true;
}

function finish(state, events, reason) {
  state.status = 'over';
  state.deathReason = reason;
  events.push({ type: 'over', x: state.head.x, y: state.head.y, points: state.score });
}

function addDanger(state, permanent) {
  if (state.obstacles.length + state.hazards.length >= 62) return;
  const free = [];
  for (let cy = 1; cy < state.rows - 1; cy++) for (let cx = 1; cx < state.cols - 1; cx++) {
    const rect = { x: cx * C, y: cy * C, w: C, h: C };
    if (gap(state, { x: rect.x + C / 2, y: rect.y + C / 2 }, state.head) < 100) continue;
    if ([...state.obstacles, ...state.hazards].some(r => r.x === rect.x && r.y === rect.y)) continue;
    if (state.path.some(p => circleRect(p, SNAKE.bodyRadius + 2, rect))) continue;
    if ([state.food, state.bonus].some(item => item && circleRect(item, 14, rect))) continue;
    free.push(rect);
  }
  if (!free.length) return;
  const rect = free[Math.floor(random(state) * free.length)];
  state.hazards.push({ ...rect, active: false, warning: 2, permanent, remaining: permanent ? Infinity : 4.5 });
}

function updateDangers(state, dt) {
  for (const hazard of state.hazards) {
    if (hazard.active) { hazard.remaining -= dt; continue; }
    hazard.warning = Math.max(0, hazard.warning - dt);
    if (hazard.warning > 0) continue;
    // Nunca ativa em cima da cobra ou de um item: espera ela se afastar.
    const center = { x: hazard.x + C / 2, y: hazard.y + C / 2 };
    if (gap(state, center, state.head) < 50 || state.path.some(p => circleRect(p, SNAKE.bodyRadius, hazard)) ||
        [state.food, state.bonus].some(item => item && circleRect(item, 10, hazard))) {
      hazard.warning = 1.8;
      continue;
    }
    if (hazard.permanent) {
      state.obstacles.push({ x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h });
      hazard.remaining = 0;
    } else hazard.active = true;
  }
  state.hazards = state.hazards.filter(hazard => hazard.remaining > 0);
}

function advanceTimers(state, dt) {
  state.elapsed += dt;
  state.comboRemaining = Math.max(0, state.comboRemaining - dt);
  if (!state.comboRemaining) state.combo = 0;
  for (const name of ['multiplier', 'slow', 'turbo', 'invuln']) state.effects[name] = Math.max(0, state.effects[name] - dt);
  if (state.bonus) {
    state.bonus.remaining -= dt;
    if (state.bonus.remaining <= 0) state.bonus = null;
  }
  state.nextBonus -= dt;
  if (state.nextBonus <= 0 && !state.bonus) {
    const point = freePoint(state);
    const duration = choice(DIFFICULTIES, state.difficulty, 'normal').bonusDuration;
    if (point) state.bonus = { ...point, type: BONUS_TYPES[Math.floor(random(state) * BONUS_TYPES.length)], remaining: duration, duration };
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

function grow(state) {
  state.length += C;
  state.maxLength = Math.max(state.maxLength, cellsLong(state));
}

function collectFood(state, type, events) {
  state.foods++;
  grow(state);
  state.combo = Math.min(12, state.comboRemaining > 0 ? state.combo + 1 : 1);
  state.comboRemaining = 5;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const points = addScore(state, type === 'special' ? 50 : 10);
  const at = { x: state.head.x, y: state.head.y };
  events.push({ type: 'eat', ...at, points, item: type });
  if (state.combo > 1) events.push({ type: 'combo', ...at, points: 0 });
  const level = 1 + Math.floor(state.foods / SNAKE.levelEvery);
  if (level > state.level) {
    state.level = level;
    events.push({ type: 'level', ...at, points: 0 });
  }
  if (state.mode === 'challenge') {
    const difficulty = choice(DIFFICULTIES, state.difficulty, 'normal');
    if (state.foods % difficulty.obstacleEvery === 0) addDanger(state, true);
    state.objective.current = state.foods;
    if (state.foods >= state.objective.target) {
      const reward = 200 + state.objectiveStage * 100;
      state.score += reward;
      events.push({ type: 'objective', ...at, points: reward });
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
  if (item === 'shrink') {
    state.length = Math.max(SNAKE.startLength * C, Math.round(state.length * 0.65 / C) * C);
    state.path.length = Math.min(state.path.length, Math.ceil(state.length / SNAKE.spacing));
  }
  if (item === 'slow') { state.effects.slow = duration; state.effects.turbo = 0; }
  if (item === 'turbo') { points = addScore(state, 100); state.effects.turbo = duration * 0.75; state.effects.slow = 0; }
  events.push({ type: 'bonus', x: state.head.x, y: state.head.y, points, item });
}

function collision(state) {
  const head = state.head, r = SNAKE.headRadius;
  if (!wraps(state) && (head.x < r || head.y < r || head.x > state.w - r || head.y > state.h - r)) return ['wall', 'Você encontrou a borda da arena.'];
  if (state.obstacles.some(rect => circleRect(head, r - 1, rect))) return ['obstacle', 'Um obstáculo interrompeu seu caminho.'];
  if (state.hazards.some(h => h.active && circleRect(head, r - 1, h))) return ['hazard', 'Você entrou em uma zona de perigo ativa.'];
  if (state.mode !== 'zen') {
    // Os pontos logo atrás da cabeça não contam: uma curva fechada não mata.
    const reach = SNAKE.headRadius + SNAKE.bodyRadius - 3;
    const skip = Math.ceil((SNAKE.headRadius + SNAKE.bodyRadius) * 1.8 / SNAKE.spacing);
    for (let i = skip; i < state.path.length; i++) {
      if (gap(state, head, state.path[i]) < reach) return ['body', 'Sua cabeça encontrou o próprio corpo.'];
    }
  }
  return null;
}

function useShield(state, events, cause) {
  state.effects.shield = false;
  state.effects.invuln = SNAKE.invuln;
  if (cause !== 'body') {
    // Bateu em parede ou bloco: vira para o centro da arena e ganha fôlego.
    state.angle = state.target = Math.atan2(state.h / 2 - state.head.y, state.w / 2 - state.head.x);
  }
  events.push({ type: 'shield', x: state.head.x, y: state.head.y, points: 0 });
}

function move(state, dt, events) {
  const diff = wrapAngle(state.target - state.angle);
  const maxTurn = turnRate(state.speed) * dt;
  state.angle = wrapAngle(state.angle + clamp(diff, -maxTurn, maxTurn));
  const head = state.head, S = SNAKE.spacing;
  const dx = Math.cos(state.angle), dy = Math.sin(state.angle);
  let remaining = state.speed * dt;
  while (remaining > 1e-9) {
    const step = Math.min(remaining, S - state.travel);
    head.x += dx * step;
    head.y += dy * step;
    if (wraps(state)) { head.x = (head.x + state.w) % state.w; head.y = (head.y + state.h) % state.h; }
    state.travel += step;
    remaining -= step;
    if (state.travel >= S - 1e-9) { state.travel = 0; state.path.unshift({ x: head.x, y: head.y }); }
  }
  const max = Math.ceil(state.length / S);
  if (state.path.length > max) state.path.length = max;

  if (state.effects.invuln > 0) {
    if (!wraps(state)) {
      const r = SNAKE.headRadius + 1;
      head.x = clamp(head.x, r, state.w - r);
      head.y = clamp(head.y, r, state.h - r);
    }
  } else {
    const hit = collision(state);
    if (hit) {
      if (state.effects.shield) useShield(state, events, hit[0]);
      else { finish(state, events, hit[1]); return; }
    }
  }

  if (state.food && gap(state, head, state.food) < SNAKE.headRadius + SNAKE.foodRadius + 5) {
    state.food = null;
    collectFood(state, 'food', events);
    spawnFood(state);
  }
  if (state.bonus && gap(state, head, state.bonus) < SNAKE.headRadius + SNAKE.foodRadius + 7) {
    const type = state.bonus.type;
    state.bonus = null;
    collectBonus(state, type, events);
  }
  if (!state.food) spawnFood(state);
}

export function updateRun(state, dt) {
  const events = [];
  if (state.status !== 'running' || state.waiting || !Number.isFinite(dt) || dt <= 0) return events;
  let remaining = Math.min(dt, 60);
  while (remaining > 1e-9 && state.status === 'running') {
    const slice = Math.min(remaining, 1 / 60);
    advanceTimers(state, slice);
    updateSpeed(state);
    move(state, slice, events);
    remaining -= slice;
  }
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
  // Cada aparência abre com uma marca diferente do histórico.
  const reached = { best, ...Object.fromEntries(['games', 'maxLength', 'bestCombo', 'foods'].map(id => [id, integer(stats[id])])) };
  const keptSkins = Array.isArray(raw.unlockedSkins) ? raw.unlockedSkins : [];
  const unlockedSkins = SKINS.filter(skin => skin.unlock <= reached[skin.unlockBy] || keptSkins.includes(skin.id)).map(skin => skin.id);
  const skin = choice(SKINS, settings.skin, 'lima').id;
  return {
    settings: {
      mode: choice(MODES, settings.mode, 'classic').id,
      difficulty: choice(DIFFICULTIES, settings.difficulty, 'normal').id,
      map: unlockedMaps.includes(map) ? map : 'grid',
      skin: unlockedSkins.includes(skin) ? skin : 'lima',
      ...Object.fromEntries(Object.entries({ effects: true, music: false, haptics: true, reducedMotion: false })
        .map(([id, fallback]) => [id, typeof settings[id] === 'boolean' ? settings[id] : fallback]))
    },
    best,
    bestByMode: Object.fromEntries(MODES.map(({ id }) => [id, integer(object(raw.bestByMode)[id])])),
    bestByDifficulty: Object.fromEntries(DIFFICULTIES.map(({ id }) => [id, integer(object(raw.bestByDifficulty)[id])])),
    unlockedMaps,
    unlockedSkins,
    achievements: ACHIEVEMENTS.filter(({ id }) => Array.isArray(raw.achievements) && raw.achievements.includes(id)).map(({ id }) => id),
    stats: { games: integer(stats.games), maxLength: integer(stats.maxLength), bestCombo: integer(stats.bestCombo), foods: integer(stats.foods), time: number(stats.time), best }
  };
}

export function recordRun(rawProfile, state) {
  const profile = createProfile(rawProfile);
  if (!state || RECORDED.has(state)) return { profile, unlockedMaps: [], newSkins: [], newAchievements: [] };
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
  const newSkins = SKINS.filter(skin => skin.unlock <= profile.stats[skin.unlockBy] && !profile.unlockedSkins.includes(skin.id)).map(skin => skin.id);
  profile.unlockedSkins.push(...newSkins);
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
  return { profile, unlockedMaps, newSkins, newAchievements };
}
