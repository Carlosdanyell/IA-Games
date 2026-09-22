import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, radiusOf, lengthOf, turnRadiusOf, turnsAround, angleDelta, segmentDistance, SpatialGrid } from '../games/neon-slither/model.js';
import { ARENA, cleanProfile, SKINS, DIFFICULTIES } from '../games/neon-slither/config.js';
import { zoomFor } from '../games/neon-slither/render.js';

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
const campoPara = mass => 600 / zoomFor(mass);
const FIELD = campoPara(ARENA.startMass);

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
  assert.ok(largo > inicio, 'cobra maior vira mais largo');
  // Cobra grande vira largo de propósito, mas a curva tem de caber na tela
  // dela, que também abriu com o zoom.
  assert.ok(largo <= 60, `raio da cobra grande fora da faixa: ${largo.toFixed(1)}`);
  assert.ok(largo / radiusOf(grande.player) <= 2, 'crescer não pode custar a precisão');
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

test('crescer continua visível muito além do teto antigo', () => {
  // O teto que travava o jogo não era a massa: espessura e zoom paravam de
  // mudar na massa 2803, e dali em diante crescer não aparecia na tela.
  const TETO_ANTIGO = 2803;
  assert.ok(ARENA.maxMass > TETO_ANTIGO * 20, 'o teto de massa precisa ficar fora de alcance');

  const espessura = m => radiusOf({ mass: m });
  assert.ok(espessura(TETO_ANTIGO * 4) > espessura(TETO_ANTIGO) * 1.3, 'a cobra precisa engrossar além do teto antigo');
  assert.ok(campoPara(TETO_ANTIGO * 4) > campoPara(TETO_ANTIGO) * 1.3, 'o campo de visão precisa abrir além do teto antigo');
  // Espessura no fim é bem maior que no começo: é o sinal de que você cresceu.
  assert.ok(espessura(ARENA.maxMass) / espessura(ARENA.startMass) >= 3.5, 'a cobra máxima precisa ser bem mais grossa que a inicial');

  // Como no slither.io, a cabeça fica numa fatia parecida da tela enquanto o
  // mundo encolhe: crescer muda o mundo, não o tamanho aparente da cabeça.
  const fatia = m => espessura(m) * 2 / campoPara(m);
  for (const m of [ARENA.startMass, 1000, 10000, ARENA.maxMass])
    assert.ok(fatia(m) > .015 && fatia(m) < .06, `na massa ${m} a cabeça ocupa ${(fatia(m) * 100).toFixed(1)}% da tela`);

  // A arena tem de comportar a maior cobra e ainda sobrar mapa para fugir.
  assert.ok(lengthOf({ mass: ARENA.maxMass }) < ARENA.radius * 2 * 1.2, 'a cobra máxima não pode ser maior que a arena');
  assert.ok(campoPara(ARENA.maxMass) / (ARENA.radius * 2) < .4, 'no tamanho máximo ainda tem de sobrar mapa fora da tela');
});

test('o ponto do corpo guarda um número estável, para a estampa não tremer', () => {
  const world = arena();
  const s = world.player;
  s.mass = 400; s.invulnerable = 1e9;
  for (let i = 0; i < 120; i++) world.update(1 / 60, { angle: 0 });

  // O índice no array desloca a cada ponto novo na cabeça. Quem pinta a skin
  // pelo índice vê o desenho escorregar um espaçamento inteiro trinta vezes por
  // segundo, e é isso que aparece como corpo tremendo.
  assert.ok(world.snakes.every(v => v.path.every(q => Number.isFinite(q.n))),
    'todo ponto do corpo precisa de número de série');
  const numeros = s.path.map(q => q.n);
  assert.equal(new Set(numeros).size, numeros.length, 'número de série repetido no mesmo corpo');
  // Cresce em direção à cabeça: a skin usa isso para saber a ordem da carne.
  for (let i = 1; i < numeros.length; i++)
    assert.ok(numeros[i] < numeros[i - 1], `os números precisam decrescer da cabeça à cauda (índice ${i})`);

  // O ponto identificado pelo número não anda: a carne fica onde foi criada.
  const alvo = s.path[10].n;
  const antes = { ...s.path.find(q => q.n === alvo) };
  let maior = 0;
  for (let i = 0; i < 60; i++) {
    world.update(1 / 60, { angle: 0 });
    const agora = s.path.find(q => q.n === alvo);
    if (!agora) break;
    maior = Math.max(maior, Math.hypot(agora.x - antes.x, agora.y - antes.y));
  }
  assert.equal(maior, 0, `o ponto andou ${maior.toFixed(2)} unidades depois de criado`);
});

const TAU = Math.PI * 2;
// Cena montada à mão: presa enrolada na curva mais fechada que consegue, com um
// caçador de corpo já fechado em volta. É o caso em que o cerco era eterno.
function cerco(seed = 4) {
  const world = createWorld({ difficulty: 'easy', seed });
  world.started = true;
  const presa = world.snakes[1], cacador = world.player;
  for (const s of world.snakes) if (s !== presa && s !== cacador) s.alive = false;
  presa.mass = 200; cacador.mass = 3000;
  presa.invulnerable = 0; cacador.invulnerable = 0;
  const volta = (s, raio, pontos) => {
    s.path.length = 0;
    for (let i = 0; i < pontos; i++) {
      const a = -i / pontos * TAU * (pontos / 80);
      s.path.push({ x: Math.cos(a) * raio, y: Math.sin(a) * raio, n: -i });
    }
    Object.assign(s, { x: raio, y: 0, px: raio, py: 0, angle: Math.PI / 2, target: Math.PI / 2 });
  };
  volta(presa, turnRadiusOf(presa), 80);
  volta(cacador, 140, 260);
  return { world, presa, cacador };
}

test('o número de giro distingue cercar de passar ao lado', () => {
  const reto = [];
  for (let i = 0; i < 100; i++) reto.push({ x: -300 + i * 6, y: 0, n: -i });
  assert.ok(turnsAround(reto, { x: 0, y: 40 }) < .9, 'corpo reto passando ao lado não é cerco');

  const meia = [], inteira = [], dupla = [];
  for (let i = 0; i < 100; i++) {
    const t = i / 100;
    meia.push({ x: Math.cos(-t * Math.PI) * 80, y: Math.sin(-t * Math.PI) * 80 });
    inteira.push({ x: Math.cos(-t * TAU) * 80, y: Math.sin(-t * TAU) * 80 });
    dupla.push({ x: Math.cos(-t * TAU * 2) * 80, y: Math.sin(-t * TAU * 2) * 80 });
  }
  assert.ok(turnsAround(meia, { x: 0, y: 0 }) < .9, 'meio cerco ainda não fecha');
  assert.ok(Math.abs(turnsAround(inteira, { x: 0, y: 0 }) - 1) < .05, 'uma volta fechada vale 1');
  assert.ok(Math.abs(turnsAround(dupla, { x: 0, y: 0 }) - 2) < .05, 'duas voltas valem 2');
  assert.equal(turnsAround([], { x: 0, y: 0 }), 0);
});

test('o laço aperta o cerco, e sem ele o círculo perfeito é invencível', () => {
  const guardado = ARENA.lassoRate;
  try {
    // Sem deslocamento do corpo, a presa no raio mínimo nunca é alcançada: a
    // volta do caçador não fecha mais que o próprio raio de curva dele.
    ARENA.lassoRate = 0;
    const parado = cerco();
    assert.ok(turnsAround(parado.cacador.path, parado.presa) > 1, 'a cena precisa ser um cerco de verdade');
    for (let i = 0; i < 60 * 20 && parado.presa.alive; i++) {
      parado.presa.target = parado.presa.angle + 1;
      parado.world.update(1 / 60, { angle: parado.cacador.angle + 1 });
    }
    assert.equal(parado.presa.alive, true, 'sem laço o cerco não deveria vencer');

    ARENA.lassoRate = guardado;
    const laco = cerco();
    let t = 0;
    for (; t < 20 && laco.presa.alive; t += 1 / 60) {
      laco.presa.target = laco.presa.angle + 1;
      laco.world.update(1 / 60, { angle: laco.cacador.angle + 1 });
    }
    assert.equal(laco.presa.alive, false, `o laço precisa fechar o cerco (durou ${t.toFixed(1)} s)`);
    // "Suavemente": o aperto leva segundos, não é morte no instante do cerco.
    assert.ok(t > .8, `o laço fechou em ${t.toFixed(2)} s, rápido demais para ser suave`);
  } finally { ARENA.lassoRate = guardado; }
});

test('o laço não mexe no corpo de quem não cercou ninguém', () => {
  const world = arena();
  const s = world.player;
  s.mass = 3000; s.invulnerable = 1e9;
  for (let i = 0; i < 120; i++) world.update(1 / 60, { angle: 0 });
  const antes = s.path.map(q => ({ x: q.x, y: q.y, n: q.n }));
  for (let i = 0; i < 120; i++) world.update(1 / 60, { angle: 0 });
  // Os pontos antigos que sobraram não podem ter sido deslocados.
  let conferidos = 0;
  for (const velho of antes) {
    const agora = s.path.find(q => q.n === velho.n);
    if (!agora) continue;
    conferidos++;
    assert.equal(Math.hypot(agora.x - velho.x, agora.y - velho.y), 0, 'corpo deslocado sem cerco');
  }
  assert.ok(conferidos > 20, 'o teste precisa conferir pontos de verdade');
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
        // A escolha exige presa com no máximo 0,72 da massa do caçador, mas a
        // presa continua comendo entre a escolha e esta leitura — medindo, a
        // pior razão observada foi 0,733. A folga cobre essa deriva sem deixar
        // passar uma caçada contra alguém do mesmo tamanho.
        assert.ok(s.prey.mass <= s.mass * .78, `rival de ${Math.round(s.mass)} escolheu presa de ${Math.round(s.prey.mass)}`);
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
  assert.ok(radiusOf(grande) <= 32, 'o corpo tem teto de espessura');
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
  // As lendárias ficam fora de alcance de um recorde de 3000 de propósito: é o
  // que dá o que perseguir depois que a coleção comum acaba.
  const lendarias = SKINS.filter(s => s.legend);
  assert.ok(lendarias.length >= 4, 'a coleção precisa ter lendárias');
  assert.ok(lendarias.every(s => s.goal > 3000), 'lendária liberada cedo demais');
  assert.equal(SKINS.filter(s => s.goal <= 3000).length, SKINS.length - lendarias.length);
  assert.equal(cleanProfile({ best: 3000, skin: 'ouroboros' }).skin, 'aurora', 'lendária bloqueada volta para a padrão');
  assert.equal(cleanProfile({ best: 60000, skin: 'singularidade' }).skin, 'singularidade');
  // As metas sobem sem buraco nem empate, para a coleção ter degraus claros.
  const metas = SKINS.map(s => s.goal).sort((a, b) => a - b);
  assert.equal(new Set(lendarias.map(s => s.goal)).size, lendarias.length, 'duas lendárias com a mesma meta');
  assert.ok(Math.max(...metas) >= 25000, 'a maior meta precisa passar de uma sessão longa');
});
