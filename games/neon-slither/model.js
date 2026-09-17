import { ARENA, DIFFICULTIES, SKINS, NAMES } from './config.js';
import { createRng } from '../../core/rng.js';

const TAU = Math.PI * 2;
export const angleDelta = a => Math.atan2(Math.sin(a), Math.cos(a));
export const radiusOf = s => 7 + Math.min(9, Math.sqrt(s.mass) * .17);
export const lengthOf = s => 65 + Math.sqrt(s.mass) * 22;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
// Cada trecho é indexado nas células que cruza. As consultas não dependem do
// tamanho total das cobras e não deixam buracos entre pontos do corpo.
export class SpatialGrid {
  constructor(size = 90) { this.size = size; this.cells = new Map(); }
  insert(item, x1, y1, x2 = x1, y2 = y1) {
    const z = this.size;
    for (let x = Math.floor(Math.min(x1, x2) / z); x <= Math.floor(Math.max(x1, x2) / z); x++)
      for (let y = Math.floor(Math.min(y1, y2) / z); y <= Math.floor(Math.max(y1, y2) / z); y++) {
        const key = `${x},${y}`; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(item);
      }
  }
  near(x, y, r) {
    const found = new Set(), z = this.size;
    for (let i = Math.floor((x - r) / z); i <= Math.floor((x + r) / z); i++)
      for (let j = Math.floor((y - r) / z); j <= Math.floor((y + r) / z); j++)
        for (const item of this.cells.get(`${i},${j}`) || []) found.add(item);
    return found;
  }
}

export function createWorld({ difficulty = 'normal', skin = 'aurora', seed = Date.now() } = {}) {
  const level = DIFFICULTIES[difficulty] || DIFFICULTIES.normal, rng = createRng(seed);
  const world = { snakes: [], foods: [], time: 0, started: false, over: false, best: ARENA.startMass, kills: 0, events: [], level,
    bodyGrid: new SpatialGrid(), foodGrid: new SpatialGrid(), respawns: [], nextId: 0, foodClock: 0 };
  const point = margin => { const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * (ARENA.radius - margin); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; };
  function food(p, value = 1, color = Math.floor(rng.next() * 6)) {
    if (world.foods.length >= ARENA.maxFood) return;
    world.foods.push({ x: p.x, y: p.y, value, color, eaten: false });
  }
  function bodyIndex() {
    world.bodyGrid.cells.clear();
    for (const s of world.snakes) if (s.alive) {
      for (let i = 1; i < s.path.length; i++) {
        const a = s.path[i - 1], b = s.path[i];
        world.bodyGrid.insert({ snake: s, a, b }, a.x, a.y, b.x, b.y);
      }
    }
  }
  function foodIndex() { world.foodGrid.cells.clear(); for (const f of world.foods) if (!f.eaten) world.foodGrid.insert(f, f.x, f.y); }
  function spawn(player = false) {
    let p = { x: 0, y: 0 }, safe = player;
    for (let i = 0; !safe && i < 150; i++) {
      p = point(300);
      safe = world.snakes.every(s => !s.alive || (distance(p, s) > 330 && s.path.every(v => distance(p, v) > 250)));
    }
    if (!safe) return null;
    const a = Math.atan2(-p.y, -p.x) + (rng.next() - .5), id = world.nextId++;
    const mass = player ? ARENA.startMass : 35 + rng.next() * 180;
    const s = { id, name: player ? 'Você' : `${NAMES[id % NAMES.length]} ${id}`, player, x: p.x, y: p.y, px: p.x, py: p.y,
      angle: a, target: a, mass, skin: player ? skin : SKINS[id % SKINS.length].id, alive: true, boost: false,
      think: rng.next() * level.reaction, boostClock: 0, path: [], invulnerable: 2, deaths: 0 };
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
    const near = [...world.bodyGrid.near(s.x, s.y, level.foresight + 70)].filter(v => v.snake !== s);
    let goal = null, value = -Infinity;
    for (const f of world.foodGrid.near(s.x, s.y, 500)) {
      if (f.eaten) continue;
      const v = f.value / (35 + distance(s, f)); if (v > value) { goal = f; value = v; }
    }
    let desired = goal ? Math.atan2(goal.y - s.y, goal.x - s.x) : s.angle + (rng.next() - .5) * .8;
    const victim = world.snakes.find(v => v !== s && v.alive && v.invulnerable <= 0 && distance(s, v) < 280 && distance(s, v) > 90);
    let hunt = false;
    if (victim && rng.next() < level.aggression) {
      const ahead = 95;
      desired = Math.atan2(victim.y + Math.sin(victim.angle) * ahead - s.y, victim.x + Math.cos(victim.angle) * ahead - s.x); hunt = true;
    }
    let best = -Infinity, selected = s.angle, danger = false;
    for (let i = -5; i <= 5; i++) {
      const a = s.angle + i * Math.PI / 10;
      let cost = -Math.abs(angleDelta(a - desired)) * 35;
      for (const d of [35, 75, level.foresight]) {
        const p = { x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d };
        if (Math.hypot(p.x, p.y) > ARENA.radius - 45) cost -= 1600;
        for (const v of near) {
          const gap = segmentDistance(p, v.a, v.b) - radiusOf(s) - radiusOf(v.snake);
          if (gap < 28) cost -= (28 - gap) * 8;
        }
      }
      if (cost > best) { best = cost; selected = a; }
    }
    danger = best < -180;
    s.target = selected;
    s.boost = !danger && hunt && s.mass > 70 && Math.abs(angleDelta(selected - s.angle)) < .5;
  }
  function die(s, killer = null) {
    if (!s.alive) return;
    s.alive = false; s.boost = false;
    const step = Math.max(2, Math.ceil(s.path.length / 100)), drops = Math.ceil(s.path.length / step);
    for (let i = 0; i < s.path.length; i += step) food(s.path[i], Math.max(1, s.mass * .7 / drops), s.id % 6);
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
      if (!s.player && (s.think -= dt) <= 0) { think(s); s.think = level.reaction; }
      s.boost = s.boost && s.mass > ARENA.minMass + 1;
      const speed = s.boost ? ARENA.boost : ARENA.speed;
      const turn = speed / (24 + radiusOf(s) * 1.6);
      s.angle += Math.max(-turn * dt, Math.min(turn * dt, angleDelta(s.target - s.angle)));
      s.px = s.x; s.py = s.y; s.x += Math.cos(s.angle) * speed * dt; s.y += Math.sin(s.angle) * speed * dt;
      const previous = s.path[1];
      if (previous && distance(s, previous) >= ARENA.spacing) s.path.unshift({ x: s.x, y: s.y });
      else s.path[0] = { x: s.x, y: s.y };
      s.path.length = Math.min(s.path.length, Math.ceil(lengthOf(s) / ARENA.spacing) + 1);
      if (s.boost) {
        s.mass = Math.max(ARENA.minMass, s.mass - dt * 6);
        s.boostClock += dt;
        if (s.boostClock >= .2) { s.boostClock -= .2; food(s.path.at(-1), 1); }
      }
    }
    bodyIndex();
    // Decide todas as mortes antes de aplicá-las: ordem do array não salva um rival.
    const deaths = new Map();
    for (const s of world.snakes) if (s.alive) {
      if (Math.hypot(s.x, s.y) + radiusOf(s) > ARENA.radius) { deaths.set(s, null); continue; }
      if (s.invulnerable > 0) continue;
      for (const v of world.bodyGrid.near(s.x, s.y, 45)) {
        if (v.snake === s || v.snake.invulnerable > 0) continue;
        if (segmentDistance(s, v.a, v.b) < radiusOf(s) * .7 + radiusOf(v.snake)) { deaths.set(s, v.snake); break; }
      }
    }
    for (const [s, killer] of deaths) die(s, killer);
    for (const s of world.snakes) if (s.alive) {
      for (const f of world.foodGrid.near(s.x, s.y, radiusOf(s) + 22)) {
        if (f.eaten || distance(s, f) > radiusOf(s) + 9) continue;
        f.eaten = true; s.mass = Math.min(ARENA.maxMass, s.mass + f.value);
        if (s.player) world.events.push({ type: 'eat' });
      }
    }
    world.best = Math.max(world.best, p.mass);
    world.foodClock += dt;
    if (world.foodClock >= .25) {
      world.foodClock = 0; world.foods = world.foods.filter(f => !f.eaten);
      for (let i = 0; i < 12 && world.foods.length < ARENA.food; i++) food(point(30));
      foodIndex();
    }
    world.snakes = world.snakes.filter(s => s.player || s.alive);
    for (let i = world.respawns.length - 1; i >= 0; i--) {
      world.respawns[i] -= dt;
      if (world.respawns[i] <= 0) { if (spawn()) world.respawns.splice(i, 1); else world.respawns[i] = 1; }
    }
  }
  world.update = (dt, controls = {}) => {
    world.events.length = 0;
    if (world.over || !world.started || !Number.isFinite(dt) || dt <= 0) return;
    let left = Math.min(dt, .05);
    while (left > 1e-8 && !world.over) { const d = Math.min(left, 1 / 120); step(d, controls); left -= d; }
  };
  world.ranking = () => world.snakes.filter(s => s.alive).slice().sort((a, b) => b.mass - a.mass || a.id - b.id);
  return world;
}
