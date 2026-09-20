import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, radiusOf, lengthOf, turnRadiusOf, angleDelta, segmentDistance, SpatialGrid } from '../games/neon-slither/model.js';
import { ARENA, cleanProfile, SKINS, DIFFICULTIES } from '../games/neon-slither/config.js';

const arena = (options = {}) => {
  const world = createWorld({ difficulty: 'easy', seed: 9, ...options });
  world.started = true;
  return world;
};
// Raio da curva: com o alvo longe do rumo atual, a cobra gira no limite dela.
// O passo é o mesmo do mundo, então o ângulo ganho mede o giro.
const turnRadius = (world, boost = false) => {
  const s = world.player;
  const before = s.angle;
  world.update(1 / 120, { angle: before + Math.PI / 2, boost });
  const rate = Math.abs(angleDelta(s.angle - before)) * 120;
  const speed = boost && s.boost ? ARENA.boost : ARENA.speed;
  return speed / rate;
};

// O campo de visão do jogador, em unidades do mundo: a tela lógica tem 600 e o
// zoom inicial do renderizador abre um pouco mais.
const FIELD = 600 / Math.max(.55, 1 - Math.sqrt(ARENA.startMass) * .0085);

test('a cobra desliza rápido o bastante para a arena não parecer travada', () => {
  const travessia = FIELD / ARENA.speed;
  assert.ok(travessia >= 2.8 && travessia <= 4, `a tela leva ${travessia.toFixed(2)} s para ser cruzada`);
  const ganho = ARENA.boost / ARENA.speed;
  assert.ok(ganho >= 1.55 && ganho <= 1.9, `acelerar rende ${ganho.toFixed(2)}x, fora da faixa útil`);
});

test('a curva é um arco de verdade, não um giro no lugar', () => {
  const novo = arena();
  const inicio = turnRadius(novo);
  assert.ok(Math.abs(inicio - turnRadiusOf(novo.player)) < .5, 'o raio medido precisa bater com o previsto');
  // Estreita demais a cobra pivota; larga demais ela não se defende.
  assert.ok(inicio >= 28 && inicio <= 36, `raio no começo fora da faixa: ${inicio.toFixed(1)}`);
  assert.ok(inicio / radiusOf(novo.player) <= 4.3, 'a curva precisa caber em até quatro larguras de corpo');
  assert.ok(inicio / FIELD <= .08, 'a curva não pode ocupar quase a tela inteira');

  const grande = arena();
  grande.player.mass = ARENA.maxMass;
  const largo = turnRadius(grande);
  assert.ok(largo > inicio, 'cobra maior vira um pouco mais largo');
  assert.ok(largo <= 44, `raio da cobra grande fora da faixa: ${largo.toFixed(1)}`);
  assert.ok(largo / radiusOf(grande.player) <= 2.6, 'crescer não pode custar a precisão');
});

test('acelerar não abre a curva', () => {
  const world = arena();
  world.player.mass = 300;
  const normal = turnRadius(world);
  const rapido = turnRadius(world, true);
  assert.equal(world.player.boost, true, 'com massa sobrando a aceleração precisa valer');
  assert.ok(Math.abs(rapido - normal) < 1, `acelerar mudou o raio: ${normal.toFixed(1)} para ${rapido.toFixed(1)}`);
});

test('a meia-volta é curta em tempo e cabe no dobro do raio', () => {
  const world = arena();
  const s = world.player;
  s.x = s.px = 0; s.y = s.py = 0; s.angle = s.target = 0;
  const raio = turnRadius(world);
  let volta = 0, passos = 0;
  for (; passos < 240 && Math.abs(angleDelta(s.angle - Math.PI)) > 1e-6; passos++) {
    world.update(1 / 120, { angle: Math.PI });
    volta = Math.max(volta, Math.abs(s.y));
  }
  assert.ok(Math.abs(angleDelta(s.angle - Math.PI)) <= 1e-6, 'a meia-volta precisa fechar em dois segundos');
  // O que o dedo sente é o tempo, não o raio: mesmo com a curva mais aberta a
  // cobra tem de dar meia-volta em menos de 0,7 s.
  assert.ok(passos / 120 <= .7, `meia-volta levou ${(passos / 120).toFixed(2)} s`);
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

test('rivais nascem na escala do jogador e longe dele', () => {
  for (const [id, level] of Object.entries(DIFFICULTIES)) {
    const world = createWorld({ difficulty: id, seed: 12 });
    const bots = world.snakes.filter(s => !s.player);
    assert.equal(bots.length, level.bots);
    assert.ok(bots.every(s => s.mass >= level.mass[0] && s.mass <= level.mass[1]), `${id}: massa fora da faixa declarada`);
    // Ninguém entra na arena já pronto: o menor rival começa perto do jogador.
    assert.ok(Math.min(...bots.map(s => s.mass)) <= ARENA.startMass * 1.2, `${id}: nenhum rival pequeno na arena`);
    assert.ok(bots.every(s => Math.hypot(s.x - world.player.x, s.y - world.player.y) > 500),
      `${id}: rival nasceu em cima do jogador`);
  }
});

test('rival só caça quem está em desvantagem e o jogador não é o alvo preferido', () => {
  let cacadas = 0, contraJogador = 0;
  // Várias partidas: uma só não junta caçadas suficientes para a conta valer.
  for (let seed = 0; seed < 10; seed++) {
    const world = createWorld({ difficulty: 'hard', seed: seed * 17 + 5 });
    world.started = true;
    const anterior = new Map();
    for (let i = 0; i < 60 * 30 && !world.over; i++) {
      world.update(1 / 60, { angle: Math.sin(i / 400) * 2 });
      for (const s of world.snakes) {
        if (!s.prey) { anterior.delete(s); continue; }
        if (anterior.get(s) === s.prey) continue;
        anterior.set(s, s.prey);
        cacadas++;
        // A presa é escolhida menor; a massa muda durante a perseguição, então
        // a folga confere o instante da escolha.
        assert.ok(s.prey.mass <= s.mass * .73, `rival de ${Math.round(s.mass)} escolheu presa de ${Math.round(s.prey.mass)}`);
        if (s.prey.player) contraJogador++;
      }
    }
  }
  assert.ok(cacadas > 20, `a arena precisa ter caçadas para o teste valer: ${cacadas}`);
  // O jogador é um entre muitos: com a regra de tamanho e o alvo mais próximo,
  // ele não pode concentrar as caçadas da arena.
  assert.ok(contraJogador / cacadas < .35, `${Math.round(contraJogador / cacadas * 100)}% das caçadas miraram o jogador`);
});

test('a luz é puxada para a cabeça em vez de exigir o ponto exato', () => {
  const world = arena();
  const s = world.player;
  s.x = s.px = 900; s.y = s.py = 0; s.angle = s.target = 0; s.invulnerable = 0;
  const alvo = { x: s.x + radiusOf(s) + 24, y: 0, value: 5, color: 0, eaten: false, mark: 0 };
  world.foods.push(alvo); world.foodGrid.insert(alvo, alvo.x, alvo.y);
  const antes = alvo.x - s.x;
  world.update(1 / 90, { angle: 0 });
  assert.ok(alvo.eaten || alvo.x - s.x < antes, 'a luz precisa encurtar a distância até a cabeça');
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
  assert.ok(turnRadiusOf(pequena) < turnRadiusOf(grande));
  assert.equal(Math.round(segmentDistance({ x: 0, y: 10 }, { x: -10, y: 0 }, { x: 10, y: 0 })), 10);
  const grid = new SpatialGrid(50);
  const item = { id: 1 };
  grid.insert(item, 0, 0, 120, 0);
  assert.equal(grid.near(100, 0, 10).has(item), true, 'o trecho entra em todas as células que cruza');
  assert.equal(grid.near(400, 400, 10).size, 0);
  // Consultas seguidas não podem reaproveitar a marca da anterior.
  const out = [];
  assert.equal(grid.collect(100, 0, 10, out).length, 1);
  assert.equal(grid.collect(100, 0, 10, out).length, 1);
  assert.equal(grid.collect(400, 400, 10, out).length, 0);
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
