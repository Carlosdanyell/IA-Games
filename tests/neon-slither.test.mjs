import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, radiusOf, lengthOf, turnRadiusOf, turnsAround, angleDelta, segmentDistance, SpatialGrid } from '../games/neon-slither/model.js';
import { ARENA, cleanProfile, SKINS, DIFFICULTIES } from '../games/neon-slither/config.js';
import { zoomFor } from '../games/neon-slither/render.js';
import { previewPath } from '../games/neon-slither/skins.js';

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
// Cena com a geometria do jogo: pontos espaçados como o modelo espaça, presa
// enrolada na curva mais fechada que consegue e caçador num círculo em volta.
function cerco(raioCacador, seed = 4) {
  const world = createWorld({ difficulty: 'easy', seed });
  world.started = true;
  const presa = world.snakes[1], cacador = world.player;
  for (const s of world.snakes) if (s !== presa && s !== cacador) s.alive = false;
  presa.mass = 200; cacador.mass = 3000;
  presa.invulnerable = 0; cacador.invulnerable = 0;
  const circulo = (s, raio) => {
    const pontos = Math.min(Math.ceil(TAU * raio / ARENA.spacing) * 2,
      Math.ceil(lengthOf(s) / ARENA.spacing));
    s.path.length = 0;
    for (let i = 0; i < pontos; i++) {
      const a = -i * ARENA.spacing / raio;
      s.path.push({ x: Math.cos(a) * raio, y: Math.sin(a) * raio, n: -i });
    }
    Object.assign(s, { x: raio, y: 0, px: raio, py: 0, angle: Math.PI / 2, target: Math.PI / 2 });
  };
  circulo(presa, turnRadiusOf(presa));
  circulo(cacador, raioCacador);
  return { world, presa, cacador };
}
// Cada um segue o próprio círculo: a tangente no ponto onde está.
const tangente = s => Math.atan2(s.y, s.x) + Math.PI / 2;
// Roda a cena e devolve quando a presa caiu e o quanto o corpo do caçador
// cedeu por segundo, que é o que se enxerga na tela.
function rodar(cena, segundos) {
  const { world, presa, cacador } = cena;
  let t = 0, maior = 0, prox = 1;
  let marco = new Map(cacador.path.map(q => [q.n, { x: q.x, y: q.y }]));
  while (t < segundos && presa.alive) {
    presa.target = tangente(presa);
    // A presa é um bot: sem travar o relógio de decisão, a IA dela assume o
    // rumo e ela sai vagando, o que mede outra coisa que não o cerco.
    presa.think = 1e9;
    world.update(1 / 60, { angle: tangente(cacador) });
    // Trava a presa no eixo: é o caso "girando para sempre no mesmo círculo".
    // Solta, ela espirala para fora e encosta no caçador sozinha, o que mediria
    // a deriva da bancada em vez do laço.
    const raio = turnRadiusOf(presa), k = raio / (Math.hypot(presa.x, presa.y) || 1);
    presa.x *= k; presa.y *= k;
    t += 1 / 60;
    if (t < prox) continue;
    prox += 1;
    // A cabeça anda sozinha; medir o corpo é que diz quanto o laço cedeu.
    for (const q of cacador.path.slice(40)) {
      const a = marco.get(q.n);
      if (a) maior = Math.max(maior, Math.hypot(q.x - a.x, q.y - a.y));
    }
    marco = new Map(cacador.path.map(q => [q.n, { x: q.x, y: q.y }]));
  }
  return { viva: presa.alive, t, cedeu: maior };
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

test('cercar não tem física própria: só a geometria decide', () => {
  // Registro de uma decisão de projeto, para ninguém reintroduzir a regra
  // invisível sem perceber. No slither.io os corpos se atravessam e só a cabeça
  // mata, então cercar não desloca ninguém. Uma presa girando no próprio eixo é
  // de fato inalcançável, e isso é aceito lá e aqui: tirar esse empate custaria
  // uma regra que o jogador não tem como ver nem aprender.
  for (const aperto of [95, 75, 60]) {
    const { viva, cedeu } = rodar(cerco(aperto), 20);
    assert.equal(cedeu, 0, `o corpo de quem cerca não pode ceder (cerco ${aperto})`);
    assert.equal(viva, true, `sem regra própria, a presa travada no eixo sobrevive (cerco ${aperto})`);
  }
});

test('o corpo de uma cobra sozinha nunca é deslocado', () => {
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

test('quem renasce acompanha a arena, mas nunca o tamanho do jogador', () => {
  const level = DIFFICULTIES.normal;
  // No começo não há líder, então a partida abre como disputa entre iguais.
  const novo = createWorld({ difficulty: 'normal', seed: 5 });
  assert.ok(novo.snakes.filter(s => !s.player).every(s => s.mass <= level.mass[1]),
    'sem líder na arena, ninguém deveria nascer grande');

  // Um jogador enorme não pode puxar o teto: seria um elástico punindo crescer.
  const gordo = createWorld({ difficulty: 'normal', seed: 5 });
  gordo.started = true;
  gordo.player.mass = ARENA.maxMass;
  for (const s of gordo.snakes) if (!s.player) s.mass = level.mass[0];
  // Confere cada rival no instante em que nasce: os que já estavam na arena
  // engordam comendo, e olhar a massa deles depois não diz nada sobre o teto.
  const conhecidos = new Set(gordo.snakes);
  let nascidos = 0;
  for (let i = 0; i < 60 * 40; i++) {
    gordo.player.invulnerable = 1e9;
    gordo.update(1 / 60, { angle: Math.sin(i / 200) * 2 });
    for (const s of gordo.snakes) {
      if (conhecidos.has(s)) continue;
      conhecidos.add(s); nascidos++;
      assert.ok(s.mass <= level.mass[1],
        `rival nasceu com ${Math.round(s.mass)} tendo o jogador em ${Math.round(gordo.player.mass)}`);
    }
  }
  assert.ok(nascidos > 0, 'o teste precisa ver alguém renascer para valer');

  // Com um rival grande vivo, o teto sobe: é daí que sai a classe média.
  const teto = Math.max(level.mass[1], 20000 * ARENA.respawnShare);
  assert.ok(teto > level.mass[1], 'a fração precisa levantar o teto de renascimento');
  assert.ok(ARENA.respawnShare > 0 && ARENA.respawnShare < .4,
    `fração de renascimento fora da faixa medida como saudável: ${ARENA.respawnShare}`);
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

// Luminância relativa pela WCAG, usada para conferir que o halo de uma skin é
// mais claro que o corpo dela. Morava no core enquanto a arena vestia a paleta;
// com a arena de volta à cor fixa, só o teste precisa da régua.
const luminance = hex => {
  const canal = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * canal[0] + .7152 * canal[1] + .0722 * canal[2];
};
// Contraste de objeto gráfico pela WCAG: (L+0.05)/(L+0.05), limite 3.0.
const contraste = (a, b) => {
  const [alto, baixo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (alto + .05) / (baixo + .05);
};
// O alfa do canvas compõe em sRGB, então o halo é medido assim.
const sobrepor = (fundo, cor, alfa) => '#' + [1, 3, 5].map(i => {
  const f = parseInt(fundo.slice(i, i + 2), 16), c = parseInt(cor.slice(i, i + 2), 16);
  return Math.round(f * (1 - alfa) + c * alfa).toString(16).padStart(2, '0');
}).join('');
// A silhueta que o olho acha é o melhor entre o corpo e o halo da cor `detail`.
const visibilidade = (skin, fundo) =>
  Math.max(contraste(skin.colors[0], fundo), contraste(sobrepor(fundo, skin.detail, .4), fundo));

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

// A prévia da skin é uma cobra com a cabeça presa na direita. Quem anda é o
// corpo: o rastro escorre para a cauda. Se escorrer para a cabeça, a leitura é
// de uma cobra de ré — foi o defeito que este teste tranca.
test('a prévia escorre da cabeça para a cauda', () => {
  const inicio = previewPath(0);
  // A cabeça é o primeiro ponto e é a ponta mais à direita: quem olha vê o
  // focinho apontando para onde a cobra avança.
  assert.equal(inicio[0].x, Math.max(...inicio.map(p => p.x)), 'a cabeça precisa ser a ponta direita');
  assert.ok(inicio[0].x > inicio[1].x, 'a cabeça precisa olhar para +x');
  // Índice maior é mais perto da cauda. A crista da onda e a carne (o ponto de
  // número de série fixo) têm de caminhar os dois nesse sentido.
  const crista = path => path.reduce((melhor, p, i) => p.y > path[melhor].y ? i : melhor, 0);
  const carne = (path, n) => path.findIndex(p => p.n === n);
  const alvo = inicio[20].n;
  const depois = previewPath(1);
  const andouCrista = crista(depois) - crista(inicio);
  const andouCarne = carne(depois, alvo) - carne(inicio, alvo);
  assert.ok(andouCrista > 0, `a onda foi para a cabeça (${andouCrista} pontos)`);
  assert.ok(andouCarne > 0, `a estampa foi para a cabeça (${andouCarne} pontos)`);
  // E no mesmo ritmo: onda mais rápida que a carne faria a pele deslizar sobre
  // o corpo. Um ponto de folga é o arredondamento do número de série.
  assert.ok(Math.abs(andouCrista - andouCarne) <= 1, `onda e estampa em ritmos diferentes (${andouCrista} vs ${andouCarne})`);
  // O número de série da cabeça cresce, como no jogo: é o que faz a estampa
  // nascer na cabeça e morrer na cauda em vez de ficar congelada.
  assert.ok(depois[0].n > inicio[0].n, 'a cabeça precisa gerar série nova');
});
