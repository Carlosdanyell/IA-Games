import { ARENA, DIFFICULTIES, SKINS, NAMES } from './config.js';
import { createRng } from '../../core/rng.js';

const TAU = Math.PI * 2;
export const angleDelta = a => Math.atan2(Math.sin(a), Math.cos(a));
export const radiusOf = s => 7 + Math.min(9, Math.sqrt(s.mass) * .17);
export const lengthOf = s => 65 + Math.sqrt(s.mass) * 22;
// Raio da curva em unidades do mundo. Não depende da velocidade: acelerar não
// abre a curva e, quanto mais rápida a cobra, menos tempo leva a meia-volta.
// O valor é largo o bastante para a cabeça deslizar em arco em vez de pivotar.
export const turnRadiusOf = s => 24 + radiusOf(s);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
// Cada trecho é indexado nas células que cruza. As consultas não dependem do
// tamanho total das cobras e não deixam buracos entre pontos do corpo.
export class SpatialGrid {
  constructor(size = 90) { this.size = size; this.cells = new Map(); this.query = 0; }
  clear() { this.cells.clear(); }
  insert(item, x1, y1, x2 = x1, y2 = y1) {
    const z = this.size;
    for (let x = Math.floor(Math.min(x1, x2) / z); x <= Math.floor(Math.max(x1, x2) / z); x++)
      for (let y = Math.floor(Math.min(y1, y2) / z); y <= Math.floor(Math.max(y1, y2) / z); y++) {
        const key = x * 16384 + y, cell = this.cells.get(key);
        if (cell) cell.push(item); else this.cells.set(key, [item]);
      }
  }
  // Enche `out` sem alocar: cada item guarda o número da consulta, então quem
  // aparece em várias células entra uma vez só. Chamado a cada passo do mundo,
  // um Set novo por consulta viraria coleta de lixo no meio da partida.
  collect(x, y, r, out = []) {
    out.length = 0;
    const z = this.size, mark = ++this.query;
    for (let i = Math.floor((x - r) / z); i <= Math.floor((x + r) / z); i++)
      for (let j = Math.floor((y - r) / z); j <= Math.floor((y + r) / z); j++) {
        const cell = this.cells.get(i * 16384 + j);
        if (!cell) continue;
        for (const item of cell) if (item.mark !== mark) { item.mark = mark; out.push(item); }
      }
    return out;
  }
  near(x, y, r) { return new Set(this.collect(x, y, r, [])); }
}

// Leque de rumos que a IA considera, de -90° a +90° em passos de 18°.
const RAYS = 11, RAY_STEP = Math.PI / 10, RAY_MID = (RAYS - 1) / 2;

export function createWorld({ difficulty = 'normal', skin = 'aurora', seed = Date.now() } = {}) {
  const level = DIFFICULTIES[difficulty] || DIFFICULTIES.normal, rng = createRng(seed);
  const world = { snakes: [], foods: [], time: 0, started: false, over: false, best: ARENA.startMass, kills: 0, events: [], level,
    bodyGrid: new SpatialGrid(), foodGrid: new SpatialGrid(), respawns: [], nextId: 0, foodClock: 0 };
  // Buffers reaproveitados pelas consultas do passo: nada é alocado por quadro.
  const risk = new Float64Array(RAYS), seenBody = [], seenFood = [], seenHit = [], seenBite = [];
  const point = margin => { const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * (ARENA.radius - margin); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; };
  function food(p, value = ARENA.foodValue, color = Math.floor(rng.next() * 6)) {
    if (world.foods.length >= ARENA.maxFood) return;
    world.foods.push({ x: p.x, y: p.y, value, color, eaten: false, mark: 0 });
  }
  function bodyIndex() {
    world.bodyGrid.clear();
    for (const s of world.snakes) {
      if (!s.alive) continue;
      for (let i = 1; i < s.path.length; i++) {
        const a = s.path[i - 1], b = s.path[i];
        // Os trechos são reaproveitados entre quadros; só os extremos mudam.
        let seg = s.segments[i - 1];
        if (seg) { seg.a = a; seg.b = b; } else s.segments[i - 1] = seg = { snake: s, a, b, mark: 0 };
        world.bodyGrid.insert(seg, a.x, a.y, b.x, b.y);
      }
    }
  }
  function foodIndex() { world.foodGrid.clear(); for (const f of world.foods) if (!f.eaten) world.foodGrid.insert(f, f.x, f.y); }
  function spawn(player = false) {
    let p = { x: 0, y: 0 }, safe = player;
    for (let i = 0; !safe && i < 80; i++) {
      p = point(320);
      // Rival nenhum nasce em cima do jogador: quem volta à arena entra longe.
      safe = world.snakes.every(s => {
        if (!s.alive) return true;
        const clear = s.player ? 520 : 340;
        return distance(p, s) > clear && s.path.every(v => distance(p, v) > clear * .72);
      });
    }
    if (!safe) return null;
    const a = Math.atan2(-p.y, -p.x) + (rng.next() - .5), id = world.nextId++;
    // Rivais nascem na mesma escala do jogador, a maioria pequena: a arena é
    // uma disputa desde o início, não uma corrida atrás de gigantes prontos.
    const mass = player ? ARENA.startMass
      : Math.round(level.mass[0] + rng.next() ** 2.2 * (level.mass[1] - level.mass[0]));
    const s = { id, name: player ? 'Você' : `${NAMES[id % NAMES.length]} ${id}`, player, x: p.x, y: p.y, px: p.x, py: p.y,
      angle: a, target: a, mass, skin: player ? skin : SKINS[id % SKINS.length].id, alive: true, boost: false,
      think: rng.next() * level.reaction, boostClock: 0, path: [], segments: [], invulnerable: 3, deaths: 0,
      // Cada rival tem sua mão: precisão do rumo e disposição para caçar.
      skill: player ? 1 : Math.min(1, level.skill * (.72 + rng.next() * .5)),
      temper: player ? 0 : .45 + rng.next() * 1.1, huntClock: 0, prey: null };
    const n = Math.ceil(lengthOf(s) / ARENA.spacing);
    for (let i = 0; i <= n; i++) s.path.push({ x: p.x - Math.cos(a) * i * ARENA.spacing, y: p.y - Math.sin(a) * i * ARENA.spacing });
    world.snakes.push(s); return s;
  }
  world.player = spawn(true);
  for (let i = 0; i < level.bots; i++) spawn();
  for (let i = 0; i < ARENA.food; i++) food(point(30));
  // Alimento próximo facilita o primeiro contato sem colocar rivais em cima do jogador.
  for (let i = 0; i < 35; i++) { const a = rng.next() * TAU, r = 80 + rng.next() * 300; food({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
  bodyIndex(); foodIndex();

  function think(s) {
    const eye = level.foresight, myR = radiusOf(s);
    world.bodyGrid.collect(s.x, s.y, eye, seenBody);
    let goal = null, score = -Infinity;
    for (const f of world.foodGrid.collect(s.x, s.y, 460, seenFood)) {
      if (f.eaten) continue;
      const v = f.value / (40 + distance(s, f)); if (v > score) { score = v; goal = f; }
    }
    let desired = goal ? Math.atan2(goal.y - s.y, goal.x - s.x) : s.angle + (rng.next() - .5) * .8;

    // Caça só quem já está em desvantagem clara, e escolhe o alvo mais próximo.
    // Antes o alvo saía de uma busca sem critério de tamanho: em duas de cada
    // três escolhas o rival perseguia alguém maior que ele. Contra o jogador
    // isso virava um cerco de cobras grandes que ele não tinha como revidar.
    // A ordem do array também pesava, e o jogador é o primeiro dela.
    s.huntClock -= level.reaction;
    if (s.huntClock <= 0 || !s.prey?.alive || distance(s, s.prey) > 340) { s.prey = null; s.huntClock = 0; }
    if (!s.prey) {
      let victim = null, gap = Infinity;
      for (const v of world.snakes) {
        if (v === s || !v.alive || v.invulnerable > 0 || v.mass > s.mass * .72) continue;
        const d = distance(s, v);
        if (d > 260 || d < 60 || d >= gap) continue;
        victim = v; gap = d;
      }
      // O jogador está sozinho contra todos: os rivais o cercam menos do que
      // cercam uns aos outros, senão a arena inteira converge para ele.
      if (victim && rng.next() < level.aggression * s.temper * (victim.player ? .55 : 1)) {
        s.prey = victim; s.huntClock = 1.2 + rng.next() * 1.4;
      }
    }
    const hunt = !!s.prey;
    if (hunt) {
      const ahead = 60 + distance(s, s.prey) * .45 * s.skill;
      desired = Math.atan2(s.prey.y + Math.sin(s.prey.angle) * ahead - s.y, s.prey.x + Math.cos(s.prey.angle) * ahead - s.x);
    }
    // Mão trêmula: quanto menor a habilidade, mais o rumo escolhido erra.
    desired += (rng.next() - .5) * (1 - s.skill) * 1.4;

    // Perigo por rumo em uma passada pelos trechos vizinhos. Sondar cada rumo
    // contra cada trecho custava dezenas de milhares de contas por segundo.
    risk.fill(0);
    for (const seg of seenBody) {
      if (seg.snake === s) continue;
      const mx = (seg.a.x + seg.b.x) * .5, my = (seg.a.y + seg.b.y) * .5;
      const dx = mx - s.x, dy = my - s.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > eye) continue;
      const rel = angleDelta(Math.atan2(dy, dx) - s.angle);
      const clear = myR + radiusOf(seg.snake) + 22;
      const half = Math.atan2(clear, Math.max(clear, d));
      const weight = (1 - d / eye) ** 2 * 320;
      for (let i = 0; i < RAYS; i++) {
        const off = Math.abs(angleDelta((i - RAY_MID) * RAY_STEP - rel));
        if (off < half) risk[i] += weight * (1 - off / half);
      }
    }
    const margin = ARENA.radius - Math.hypot(s.x, s.y);
    if (margin < eye + 140) {
      const outward = Math.atan2(s.y, s.x), push = (eye + 140 - margin) * 3;
      for (let i = 0; i < RAYS; i++) {
        const toward = Math.cos(angleDelta(s.angle + (i - RAY_MID) * RAY_STEP - outward));
        if (toward > 0) risk[i] += push * toward * toward;
      }
    }
    let best = -Infinity, selected = s.angle, chosenRisk = 0;
    for (let i = 0; i < RAYS; i++) {
      const a = s.angle + (i - RAY_MID) * RAY_STEP;
      const cost = -risk[i] - Math.abs(angleDelta(a - desired)) * 45;
      if (cost > best) { best = cost; selected = a; chosenRisk = risk[i]; }
    }
    s.target = selected;
    s.boost = chosenRisk < 60 && hunt && s.mass > 90 && Math.abs(angleDelta(selected - s.angle)) < .45;
  }
  function die(s, killer = null) {
    if (!s.alive) return;
    s.alive = false; s.boost = false; s.prey = null;
    const step = Math.max(2, Math.ceil(s.path.length / 100)), drops = Math.ceil(s.path.length / step);
    for (let i = 0; i < s.path.length; i += step) food(s.path[i], Math.max(1, s.mass * .75 / drops), s.id % 6);
    world.events.push({ type: 'death', x: s.x, y: s.y, player: s.player });
    if (killer?.player) world.kills++;
    if (s.player) { world.over = true; world.reason = killer ? `Sua cabeça encostou em ${killer.name}.` : 'Você cruzou o limite da arena.'; }
    else world.respawns.push(3 + rng.next() * 4);
  }
  function step(dt, controls) {
    world.time += dt;
    const p = world.player;
    if (Number.isFinite(controls.angle)) p.target = controls.angle;
    p.boost = !!controls.boost;
    for (const s of world.snakes) if (s.alive) {
      s.invulnerable = Math.max(0, s.invulnerable - dt);
      if (!s.player && (s.think -= dt) <= 0) { think(s); s.think = level.reaction * (.75 + rng.next() * .5); }
      s.boost = s.boost && s.mass > ARENA.minMass + 1;
      const speed = s.boost ? ARENA.boost : ARENA.speed;
      const turn = speed / turnRadiusOf(s);
      s.angle += Math.max(-turn * dt, Math.min(turn * dt, angleDelta(s.target - s.angle)));
      s.px = s.x; s.py = s.y; s.x += Math.cos(s.angle) * speed * dt; s.y += Math.sin(s.angle) * speed * dt;
      const previous = s.path[1];
      if (previous && distance(s, previous) >= ARENA.spacing) s.path.unshift({ x: s.x, y: s.y });
      else s.path[0] = { x: s.x, y: s.y };
      s.path.length = Math.min(s.path.length, Math.ceil(lengthOf(s) / ARENA.spacing) + 1);
      if (s.boost) {
        // Acelerar custa proporcional ao tamanho: a cobra pequena não fica sem
        // gás em meio segundo e a gigante não corre de graça.
        s.mass = Math.max(ARENA.minMass, s.mass - dt * Math.max(ARENA.boostFloor, s.mass * ARENA.boostDrain));
        s.boostClock += dt;
        if (s.boostClock >= .22) { s.boostClock -= .22; food(s.path.at(-1), 1.2, s.id % 6); }
      }
    }
    bodyIndex();
    // Decide todas as mortes antes de aplicá-las: ordem do array não salva um rival.
    const deaths = new Map();
    for (const s of world.snakes) if (s.alive) {
      if (Math.hypot(s.x, s.y) + radiusOf(s) > ARENA.radius) { deaths.set(s, null); continue; }
      if (s.invulnerable > 0) continue;
      const reach = radiusOf(s) + 26;
      for (const v of world.bodyGrid.collect(s.x, s.y, reach, seenHit)) {
        if (v.snake === s || v.snake.invulnerable > 0) continue;
        // Cabeça com folga: raspar de lado não mata, só o encontro de fato.
        if (segmentDistance(s, v.a, v.b) < radiusOf(s) * .55 + radiusOf(v.snake)) { deaths.set(s, v.snake); break; }
      }
    }
    for (const [s, killer] of deaths) die(s, killer);
    for (const s of world.snakes) if (s.alive) {
      const reach = radiusOf(s) + 11;
      for (const f of world.foodGrid.collect(s.x, s.y, reach + ARENA.magnet + 8, seenBite)) {
        if (f.eaten) continue;
        const dx = s.x - f.x, dy = s.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d <= reach) {
          f.eaten = true; s.mass = Math.min(ARENA.maxMass, s.mass + f.value);
          if (s.player) world.events.push({ type: 'eat' });
        } else if (d <= reach + ARENA.magnet) {
          // A luz é puxada para a cabeça: comer vira um movimento contínuo em
          // vez de exigir passar por cima do ponto exato.
          const move = Math.min(d - reach * .4, 300 * dt);
          f.x += dx / d * move; f.y += dy / d * move;
        }
      }
    }
    world.best = Math.max(world.best, p.mass);
    world.foodClock += dt;
    if (world.foodClock >= .25) {
      world.foodClock = 0; world.foods = world.foods.filter(f => !f.eaten);
      for (let i = 0; i < 12 && world.foods.length < ARENA.food; i++) food(point(30));
      foodIndex();
    }
    if (deaths.size) world.snakes = world.snakes.filter(s => s.player || s.alive);
    for (let i = world.respawns.length - 1; i >= 0; i--) {
      world.respawns[i] -= dt;
      if (world.respawns[i] <= 0) { if (spawn()) world.respawns.splice(i, 1); else world.respawns[i] = 1; }
    }
  }
  world.update = (dt, controls = {}) => {
    world.events.length = 0;
    if (world.over || !world.started || !Number.isFinite(dt) || dt <= 0) return;
    let left = Math.min(dt, .05);
    while (left > 1e-8 && !world.over) { const d = Math.min(left, 1 / 90); step(d, controls); left -= d; }
  };
  world.ranking = () => world.snakes.filter(s => s.alive).slice().sort((a, b) => b.mass - a.mass || a.id - b.id);
  return world;
}
