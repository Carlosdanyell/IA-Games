import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, radiusOf, lengthOf, angleDelta, segmentDistance, SpatialGrid } from '../games/neon-slither/model.js';
import { ARENA, cleanProfile, SKINS, DIFFICULTIES } from '../games/neon-slither/config.js';

const arena = (options = {}) => {
  const world = createWorld({ difficulty: 'easy', seed: 9, ...options });
  world.started = true;
  return world;
};
// Raio da curva: com o alvo longe do rumo atual, a cobra gira no limite dela.
// O passo é o mesmo do mundo (1/120 s), então o ângulo ganho mede o giro.
const turnRadius = (world, boost = false) => {
  const s = world.player;
  const before = s.angle;
  world.update(1 / 120, { angle: before + Math.PI / 2, boost });
  const rate = Math.abs(angleDelta(s.angle - before)) * 120;
  const speed = boost && s.boost ? ARENA.boost : ARENA.speed;
  return speed / rate;
};

test('a curva fecha em poucas larguras de corpo, no começo e no fim', () => {
  const novo = arena();
  const inicio = turnRadius(novo);
  assert.ok(inicio >= 16 && inicio <= 23, `raio no começo fora da faixa: ${inicio.toFixed(1)}`);
  assert.ok(inicio / radiusOf(novo.player) <= 3, 'a curva precisa caber em até três larguras de corpo');

  const grande = arena();
  grande.player.mass = ARENA.maxMass;
  const largo = turnRadius(grande);
  assert.ok(largo > inicio, 'cobra maior vira um pouco mais largo');
  assert.ok(largo <= 30, `raio da cobra grande fora da faixa: ${largo.toFixed(1)}`);
  assert.ok(largo / radiusOf(grande.player) <= 2.2, 'crescer não pode custar a precisão');
});

test('acelerar não abre a curva', () => {
  const world = arena();
  world.player.mass = 300;
  const normal = turnRadius(world);
  const rapido = turnRadius(world, true);
  assert.equal(world.player.boost, true, 'com massa sobrando a aceleração precisa valer');
  assert.ok(Math.abs(rapido - normal) < 1, `acelerar mudou o raio: ${normal.toFixed(1)} para ${rapido.toFixed(1)}`);
});

test('a meia-volta cabe no dobro do raio', () => {
  const world = arena();
  const s = world.player;
  s.x = s.px = 0; s.y = s.py = 0; s.angle = s.target = 0;
  const raio = turnRadius(world);
  let volta = 0;
  for (let i = 0; i < 240 && Math.abs(angleDelta(s.angle - Math.PI)) > 1e-6; i++) {
    world.update(1 / 120, { angle: Math.PI });
    volta = Math.max(volta, Math.abs(s.y));
  }
  assert.ok(Math.abs(angleDelta(s.angle - Math.PI)) <= 1e-6, 'a meia-volta precisa fechar em dois segundos');
  assert.ok(volta <= raio * 2 + 2, `meia-volta ocupou ${volta.toFixed(1)} unidades para um raio de ${raio.toFixed(1)}`);
});

test('a arena nasce com jogador vivo, rivais e alimento', () => {
  const world = createWorld({ difficulty: 'normal', seed: 4 });
  assert.equal(world.player.player, true);
  assert.equal(world.player.alive, true);
  assert.equal(world.player.mass, ARENA.startMass);
  assert.equal(world.snakes.length, 1 + DIFFICULTIES.normal.bots);
  assert.ok(world.foods.length >= ARENA.food);
  assert.ok(world.snakes.every(s => s.path.length > 1), 'toda cobra nasce com corpo');
  assert.ok(world.snakes.every(s => Math.hypot(s.x, s.y) < ARENA.radius), 'ninguém nasce fora da arena');
  assert.equal(world.player.invulnerable > 0, true, 'a entrada tem proteção');
});

test('a partida só anda depois do primeiro gesto e para no fim', () => {
  const world = createWorld({ difficulty: 'easy', seed: 2 });
  const antes = { x: world.player.x, y: world.player.y };
  world.update(1, { angle: 0 });
  assert.deepEqual({ x: world.player.x, y: world.player.y }, antes, 'sem gesto, ninguém anda');
  world.started = true;
  world.update(1 / 120, { angle: 0 });
  assert.notDeepEqual({ x: world.player.x, y: world.player.y }, antes);
  world.over = true;
  const parado = { x: world.player.x, y: world.player.y };
  world.update(1 / 120, { angle: 0 });
  assert.deepEqual({ x: world.player.x, y: world.player.y }, parado, 'partida encerrada não anda mais');
});

test('a borda encerra a partida', () => {
  const world = arena();
  const s = world.player;
  // A cabeça só cruza quando o corpo passa da borda, daí a margem curta.
  s.x = s.px = ARENA.radius - 10; s.y = s.py = 0; s.angle = s.target = 0; s.invulnerable = 0;
  for (let i = 0; i < 30 && !world.over; i++) world.update(1 / 120, { angle: 0 });
  assert.equal(world.over, true);
  assert.match(world.reason, /borda|limite/);
});

test('medidas de corpo e utilitários de geometria', () => {
  const pequena = { mass: ARENA.startMass }, grande = { mass: ARENA.maxMass };
  assert.ok(radiusOf(pequena) < radiusOf(grande));
  assert.ok(radiusOf(grande) <= 16, 'o corpo tem teto de espessura');
  assert.ok(lengthOf(grande) > lengthOf(pequena));
  assert.equal(Math.round(segmentDistance({ x: 0, y: 10 }, { x: -10, y: 0 }, { x: 10, y: 0 })), 10);
  const grid = new SpatialGrid(50);
  const item = { id: 1 };
  grid.insert(item, 0, 0, 120, 0);
  assert.equal(grid.near(100, 0, 10).has(item), true, 'o trecho entra em todas as células que cruza');
  assert.equal(grid.near(400, 400, 10).size, 0);
});

test('perfil saneia dados corrompidos e trava skin não liberada', () => {
  for (const value of [null, [], 'oi', 42]) {
    const profile = cleanProfile(value);
    assert.equal(profile.best, 0);
    assert.equal(profile.skin, 'aurora');
    assert.equal(profile.difficulty, 'normal');
    assert.equal(profile.control, 'joystick');
  }
  const profile = cleanProfile({ best: -5, games: 3.9, kills: NaN, time: Infinity, difficulty: 'impossível', skin: 'eclipse', control: 'direct' });
  assert.equal(profile.best, 0);
  assert.equal(profile.games, 3);
  assert.equal(profile.kills, 0);
  assert.equal(profile.time, 0);
  assert.equal(profile.difficulty, 'normal');
  assert.equal(profile.skin, 'aurora', 'skin acima do recorde volta para a padrão');
  assert.equal(profile.control, 'direct');
  const veterano = cleanProfile({ best: 3000, skin: 'eclipse' });
  assert.equal(veterano.skin, 'eclipse');
  assert.equal(SKINS.filter(s => s.goal <= 3000).length, SKINS.length);
});
