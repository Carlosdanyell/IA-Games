import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, radiusOf, lengthOf, turnRadiusOf, turnsAround, angleDelta, segmentDistance, spawnFits, foresightOf, SpatialGrid } from '../games/neon-slither/model.js';
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
  // dela, que também abriu com o zoom. O limite sai do campo de visão daquela
  // massa, não de um número solto: assim ele acompanha a espessura se ela mudar.
  const campoGrande = campoPara(ARENA.maxMass);
  assert.ok(largo / campoGrande <= .05, `a curva ocupa ${(largo / campoGrande * 100).toFixed(1)}% da tela da cobra grande`);
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

  // A arena tem de comportar a maior cobra e ainda sobrar mapa para fugir. A
  // conta é de área ocupada, não de comprimento contra diâmetro: uma cobra mais
  // comprida que a arena cabe enrolada sem atrapalhar ninguém, e era o
  // comprimento que fazia este teste reprovar um teto de massa saudável.
  const areaCobra = m => lengthOf({ mass: m }) * radiusOf({ mass: m }) * 2;
  const ocupa = areaCobra(ARENA.maxMass) / (Math.PI * ARENA.radius ** 2);
  assert.ok(ocupa < .05, `a maior cobra ocupa ${(ocupa * 100).toFixed(1)}% da arena`);
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
    // Cada rival cabe ou na faixa de novato ou numa faixa da pirâmide: ninguém
    // nasce num tamanho que a configuração não declara.
    const faixas = [[level.mass[0], level.mass[1]], ...level.population.map(f => [f.min, f.max])];
    assert.ok(bots.every(s => faixas.some(([a, b]) => s.mass >= a && s.mass <= b)), `${id}: massa fora da faixa declarada`);
    // Ninguém entra na arena já pronto: o menor rival começa perto do jogador.
    assert.ok(Math.min(...bots.map(s => s.mass)) <= ARENA.startMass * 1.2, `${id}: nenhum rival pequeno na arena`);
    assert.ok(bots.every(s => Math.hypot(s.x - world.player.x, s.y - world.player.y) > 500),
      `${id}: rival nasceu em cima do jogador`);
  }
});

// Como num servidor online: quando você entra, o placar já tem gente grande.
// A regra anterior fazia todo rival nascer pequeno, e com 82% deles morrendo em
// 23 s a arena levava dez minutos para ter um rival de 15 mil.
test('a arena já começa com gente grande, como um servidor online', () => {
  for (const [id, level] of Object.entries(DIFFICULTIES)) {
    const world = createWorld({ difficulty: id, seed: 5 });
    world.started = true;
    // Um segundo e meio basta para a fila de quem não achou lugar de primeira.
    for (let i = 0; i < 60 * 1.5; i++) { world.player.invulnerable = 1e9; world.update(1 / 60, {}); }
    const massas = world.snakes.filter(s => s.alive && !s.player).map(s => s.mass);
    let meta = 0;
    for (const faixa of level.population) {
      meta += faixa.count;
      const acima = massas.filter(m => m >= faixa.min).length;
      assert.ok(acima >= meta, `${id}: ${acima} rivais acima de ${faixa.min}, a pirâmide pede ${meta}`);
    }
    assert.ok(massas.length >= level.bots - 1, `${id}: a largada ficou com ${massas.length} de ${level.bots} rivais`);
  }
});

// A pirâmide é feita de números fixos. As duas regras anteriores eram
// relativas — ao maior rival, depois à mediana — e a primeira se realimentou
// até a mediana de nascimento ir de 81 a 3214 em 25 minutos. Número fixo não
// olha para o tamanho de ninguém: nem do líder, nem do jogador.
test('a pirâmide de tamanhos não olha para o tamanho de ninguém', () => {
  const level = DIFFICULTIES.normal, teto = Math.max(...level.population.map(f => f.max));
  const world = createWorld({ difficulty: 'normal', seed: 31 });
  world.started = true;
  // Jogador no teto de massa e um líder enorme: pela regra que se realimentava,
  // qualquer um dos dois bastaria para empurrar o nascimento para cima.
  world.player.mass = ARENA.maxMass;
  const campo = world.snakes.filter(s => !s.player);
  campo[0].mass = 90000;
  const conhecidos = new Set(world.snakes);
  let nascidos = 0, maior = 0, novatosComPiramideCheia = 0, comPiramideCheia = 0;
  for (let i = 0; i < 60 * 90; i++) {
    world.player.invulnerable = 1e9;
    world.player.mass = ARENA.maxMass;
    world.update(1 / 60, { angle: Math.sin(i / 300) * 2 });
    // Derruba um rival pequeno de tempos em tempos, para ter nascimento.
    if (i % 90 === 0) {
      const alvo = world.snakes.find(s => s.alive && !s.player && s.mass < 600);
      if (alvo) alvo.x = alvo.y = ARENA.radius * 2;
    }
    for (const s of world.snakes) {
      if (conhecidos.has(s)) continue;
      conhecidos.add(s); nascidos++; maior = Math.max(maior, s.mass);
      // Com todas as faixas cheias, quem nasce é novato: a arena não infla.
      const vivos = world.snakes.filter(v => v.alive && !v.player && v !== s).map(v => v.mass);
      let meta = 0, cheia = true;
      for (const f of level.population) { meta += f.count; if (vivos.filter(m => m >= f.min).length < meta) cheia = false; }
      if (cheia) { comPiramideCheia++; if (s.mass <= level.mass[1]) novatosComPiramideCheia++; }
    }
  }
  assert.ok(nascidos > 20, `o teste precisa ver rivais nascendo para valer (${nascidos})`);
  assert.ok(maior <= teto, `nasceu com ${Math.round(maior)}, acima do topo da pirâmide (${teto})`);
  assert.ok(comPiramideCheia > 5, 'o teste precisa ver nascimento com a pirâmide cheia');
  assert.equal(novatosComPiramideCheia, comPiramideCheia, 'com a pirâmide cheia, todo nascimento tem de ser novato');
});

// Gigante não perde tempo cercando recém-chegado. Com gigantes desde o
// começo, sem esta regra a partida do jogador de 32 de massa seria uma fuga.
test('gigante não caça presa que não paga o risco', () => {
  const world = createWorld({ difficulty: 'hard', seed: 8 });
  world.started = true;
  let escolhas = 0;
  for (let i = 0; i < 60 * 60; i++) {
    world.update(1 / 60, { angle: Math.sin(i / 120) * 2 });
    if (world.over) break;
    for (const s of world.snakes) {
      if (!s.prey) continue;
      escolhas++;
      assert.ok(s.prey.mass >= s.mass * ARENA.preyFloor * .9,
        `rival de ${Math.round(s.mass)} caçando presa de ${Math.round(s.prey.mass)}`);
    }
  }
  assert.ok(escolhas > 0, 'o teste precisa ver alguma caçada');
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
  assert.ok(radiusOf(grande) <= 49, 'o corpo tem teto de espessura');
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
// A silhueta que o olho acha é a camada mais visível da skin. São três:
// o corpo (translúcido se a skin for de vidro), o halo da cor `detail`, e as
// listras longitudinais, que são pintadas por cima em alfa cheio.
const visibilidade = (skin, fundo) => Math.max(
  contraste(skin.glass ? sobrepor(fundo, skin.colors[0], skin.glass) : skin.colors[0], fundo),
  contraste(sobrepor(fundo, skin.detail, .4), fundo),
  ...(skin.stripes ?? []).map(([, cor]) => contraste(cor, fundo)));

// Toda skin precisa ser achável contra o fundo da arena. Quem carrega a
// silhueta varia: nas claras é o corpo, nas escuras é o halo, e na Quimera são
// as listras. Este teste já existiu e sumiu numa reescrita minha — a régua
// ficou no arquivo sem ninguém chamando, e nesse meio-tempo Magma e
// Singularidade entraram abaixo do limite sem ninguém notar.
test('nenhuma skin some contra o fundo da arena', () => {
  // O fundo é o da folha de estilo do jogo, onde a arena é pintada.
  const fundo = '#0b1927';
  for (const skin of SKINS) {
    const v = visibilidade(skin, fundo);
    assert.ok(v >= 3, `${skin.id} tem contraste ${v.toFixed(2)}, abaixo dos 3,0 da WCAG para objeto gráfico`);
  }
  // Vidro não pode chegar perto de zero: skin é sorteada para os rivais também,
  // e um rival que mal se vê é injusto. A borda acesa é o que o salva.
  for (const skin of SKINS.filter(s => s.glass)) {
    assert.ok(skin.glass >= .35, `${skin.id} é transparente demais (${skin.glass})`);
    assert.ok(contraste(skin.detail, fundo) >= 3, `${skin.id} precisa de borda acesa para carregar a silhueta`);
  }
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

// A prévia da skin é uma cobra com a cabeça presa na direita. Quem anda é o
// corpo: o rastro escorre para a cauda. Se escorrer para a cabeça, a leitura é
// de uma cobra de ré — foi o primeiro defeito que este teste tranca.
test('a prévia escorre da cabeça para a cauda', () => {
  const { path: inicio } = previewPath(0);
  // A cabeça é o primeiro ponto e é a ponta mais à direita: quem olha vê o
  // focinho apontando para onde a cobra avança.
  assert.equal(inicio[0].x, Math.max(...inicio.map(p => p.x)), 'a cabeça precisa ser a ponta direita');
  assert.ok(inicio[0].x > inicio[2].x, 'a cabeça precisa olhar para +x');
  assert.ok(Math.abs(previewPath(0).angle) < Math.PI / 2, 'o rumo precisa apontar para +x');
  // Índice maior é mais perto da cauda. A crista da onda e a carne (o ponto de
  // número de série fixo) têm de caminhar os dois nesse sentido.
  const crista = path => path.reduce((melhor, p, i) => p.y > path[melhor].y ? i : melhor, 1);
  const carne = (path, n) => path.findIndex(p => p.n === n);
  const alvo = inicio[20].n;
  const { path: depois } = previewPath(.2);
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

// O tremor tinha uma causa só: a estampa presa ao número de série e o corpo
// cravado na tela. A série anda de um em um, então o padrão ficava parado três
// ou quatro quadros e saltava um espaçamento inteiro no seguinte. Agora a
// geometria escorre junto com a série, e o que mede isso não é a distância por
// quadro — é a regularidade dela.
test('a prévia escorre sem degrau', () => {
  // Uma carne perto da cabeça, seguida por um tempo curto: no ritmo do jogo ela
  // chega à cauda em pouco mais de dois segundos.
  const quadro = 1 / 30, passos = 45;
  const alvo = previewPath(0).path[5].n;
  const onde = t => previewPath(t).path.find(p => p.n === alvo);
  let antes = onde(0), menor = Infinity, maior = 0;
  for (let k = 1; k <= passos; k++) {
    const agora = onde(k * quadro);
    assert.ok(agora, 'a carne saiu do corpo antes da hora');
    const andou = Math.hypot(agora.x - antes.x, agora.y - antes.y);
    menor = Math.min(menor, andou); maior = Math.max(maior, andou);
    antes = agora;
  }
  assert.ok(menor > 0, 'a carne precisa andar em todo quadro, não só de vez em quando');
  // Antes disto o mínimo era zero e o máximo, um espaçamento: a razão explodia.
  assert.ok(maior / menor < 1.2, `andar irregular: ${menor.toFixed(2)} a ${maior.toFixed(2)} por quadro`);
  // E a cabeça não sai do lugar enquanto o corpo escorre por baixo dela.
  const cabeca = t => previewPath(t).path[0].x;
  for (let k = 0; k <= passos; k++) assert.ok(Math.abs(cabeca(k * quadro) - cabeca(0)) < 1e-9, 'a cabeça saiu do lugar');
});

// Lento demais também é defeito: a prévia precisa ler como a cobra em cruzeiro,
// não como uma cobra parada tremendo.
test('a prévia anda no ritmo do jogo', () => {
  const andou = previewPath(1).path[1].n - previewPath(0).path[1].n;
  assert.ok(andou >= ARENA.speed / ARENA.spacing - 1, `a carne anda ${andou} pontos por segundo, menos que o cruzeiro`);
  // O corpo inteiro passa em poucos segundos, não em dez: era o que fazia a
  // prévia antiga parecer travada.
  assert.ok(66 / andou < 4, 'a cobra demora demais para passar o corpo todo');
});

// O corpo de quem nasce é criado esticado para trás da cabeça. A folga valia só
// para o ponto da cabeça, então um corpo de 1945 de comprimento apareceu a 49
// unidades do jogador — morte sem aviso, 23 vezes em 2010 nascimentos medidos.
// O caso é montado à mão porque sorteado ele é raro: 2 em 309 nascimentos, o
// que não dá um teste que reprove a regra antiga de forma confiável.
test('a folga de nascimento vale para o corpo, não só para a cabeça', () => {
  // Jogador deitado sobre o eixo x, da origem para a esquerda.
  const jogador = { alive: true, player: true, x: 0, y: 0, mass: 1000,
    path: Array.from({ length: 167 }, (_, i) => ({ x: -i * ARENA.spacing, y: 0, n: -i })) };
  // Massa fixa: o que se testa aqui é a geometria da folga, não a regra de
  // quanto cada um nasce.
  const corpo = lengthOf({ mass: 900 });
  // Cabeça longe do jogador em qualquer leitura: 849 da cabeça dele e 600 do
  // ponto mais próximo do corpo, contra folgas de 520 e 374. Pela regra antiga
  // este nascimento passava. O corpo, porém, atravessa o jogador na origem.
  const cabeca = { x: -600, y: 600 };
  const atravessa = { x: -600, y: 600 - corpo };
  assert.ok(Math.hypot(cabeca.x, cabeca.y) > ARENA.clearPlayer, 'a cabeça precisa estar fora da folga');
  assert.ok(Math.min(...jogador.path.map(v => Math.hypot(v.x - cabeca.x, v.y - cabeca.y))) > ARENA.clearPlayer * .72,
    'a cabeça precisa estar fora da folga do corpo do jogador');
  assert.equal(spawnFits(cabeca, atravessa, [jogador]), false, 'corpo atravessando o jogador foi aceito');
  // Mesma cabeça, corpo para o outro lado: tem de caber, senão a regra só
  // estaria recusando tudo.
  assert.equal(spawnFits(cabeca, { x: -600, y: 600 + corpo }, [jogador]), true, 'corpo longe do jogador foi recusado');
  // E a folga de rival é menor que a do jogador: um corpo a 300 do corpo alheio
  // cabe ao lado de um rival (folga 245) e não cabe ao lado do jogador (375).
  const rival = { ...jogador, player: false };
  assert.ok(ARENA.clearRival < ARENA.clearPlayer);
  const raso = [{ x: -600, y: 300 }, { x: -600, y: 300 + corpo }];
  assert.equal(spawnFits(raso[0], raso[1], [rival]), true, 'rival tem folga menor que o jogador');
  assert.equal(spawnFits(raso[0], raso[1], [jogador]), false, 'a folga do jogador é a maior');
});

// E a regra chega ao jogo. Aqui a cobertura é de ligação, não de geometria: um
// nascimento dentro da folga é raro de sortear (2 em 309 medidos com a regra
// antiga), então quem reprova a regra antiga é o teste acima.
test('na partida nenhum corpo nasce dentro da folga do jogador', () => {
  let nascidos = 0, pior = Infinity, piorComprimento = 0;
  for (const seed of [11, 29, 47]) {
    const world = createWorld({ difficulty: 'hard', seed });
    world.started = true;
    // Rivais crescidos e faixas da pirâmide vazias, para nascer de tudo: novato
    // esticado e grande enrolado. Os dois têm de respeitar a folga.
    for (const s of world.snakes) if (!s.player) s.mass = 900;
    const conhecidos = new Set(world.snakes);
    for (let i = 0; i < 60 * 120; i++) {
      // Imortal por invulnerabilidade, não por ressurreição: assim o jogador
      // não vira parede nem alvo, e o que se mede é só o nascimento.
      world.player.invulnerable = 1e9;
      world.update(1 / 60, { angle: Math.sin(i / 150) * 3 });
      for (const s of world.snakes) {
        if (conhecidos.has(s)) continue;
        conhecidos.add(s); nascidos++;
        for (const q of s.path) {
          const d = Math.hypot(q.x - world.player.x, q.y - world.player.y);
          if (d < pior) { pior = d; piorComprimento = Math.round(lengthOf(s)); }
        }
      }
    }
  }
  assert.ok(nascidos > 30, `o teste precisa ver rivais nascendo para valer (${nascidos})`);
  // Os pontos do corpo caem sobre o segmento conferido, e o último pode passar
  // até um espaçamento da ponta.
  assert.ok(pior >= ARENA.clearPlayer - ARENA.spacing * 2,
    `corpo de ${piorComprimento} nasceu a ${Math.round(pior)} do jogador, abaixo da folga de ${ARENA.clearPlayer}`);
});

// Quem nasce grande nasce fora da vista. Era a queixa original: corpo enorme
// surgindo na frente do jogador. Agora os grandes nascem enrolados, do lado
// mais distante do mapa que ainda cabe.
test('rival grande nasce fora da vista do jogador', () => {
  let grandes = 0, piorRazao = Infinity;
  for (const [seed, massa] of [[13, ARENA.startMass], [41, 6000], [77, 20000]]) {
    const world = createWorld({ difficulty: 'normal', seed });
    world.started = true;
    const conhecidos = new Set(world.snakes);
    for (let i = 0; i < 60 * 80; i++) {
      world.player.invulnerable = 1e9;
      world.player.mass = massa;
      world.update(1 / 60, { angle: Math.sin(i / 150) * 3 });
      // Derruba um grande de tempos em tempos, para a pirâmide pedir reposição.
      if (i % 600 === 300) {
        const alvo = world.snakes.find(s => s.alive && !s.player && s.mass > 1000);
        if (alvo) alvo.x = alvo.y = ARENA.radius * 2;
      }
      for (const s of world.snakes) {
        if (conhecidos.has(s)) continue;
        conhecidos.add(s);
        if (s.mass <= world.level.mass[1]) continue;
        grandes++;
        const vista = ARENA.spawnView / zoomFor(world.player.mass);
        let d = Infinity;
        for (const q of s.path) d = Math.min(d, Math.hypot(q.x - world.player.x, q.y - world.player.y));
        piorRazao = Math.min(piorRazao, d / vista);
      }
    }
  }
  assert.ok(grandes >= 6, `o teste precisa ver grandes nascendo (${grandes})`);
  assert.ok(piorRazao >= 1, `um grande nasceu a ${(piorRazao * 100).toFixed(0)}% do raio da vista`);
});

// Crescer tem de aparecer na tela. O raio travava na massa 21626 e o zoom só
// parava de encolher na 59975: no meio, crescer *diminuía* a cobra — 12,6 px de
// cabeça aos 21626 contra 9 px aos 60000. O jogador parou de crescer aos 24919,
// logo depois do pico, e sentiu um limite que não estava na massa.
test('crescer nunca diminui a cobra na tela', () => {
  const naTela = m => radiusOf({ mass: m }) * zoomFor(m);
  let anterior = 0, quedas = 0, ondeCaiu = 0;
  for (let m = ARENA.minMass; m <= ARENA.maxMass; m += 13) {
    const v = naTela(m);
    if (v < anterior - 1e-12 && !quedas++) ondeCaiu = m;
    anterior = v;
  }
  assert.equal(quedas, 0, `a cabeça começa a encolher na massa ${ondeCaiu}`);
  // E o ganho precisa ser visível, não um platô disfarçado.
  assert.ok(naTela(ARENA.maxMass) / naTela(ARENA.startMass) >= 1.7,
    'crescer da menor à maior massa quase não muda o tamanho na tela');
});

// O teto de massa era alcançável, e um teto alcançável é uma parede. Acima dele
// comer deixava de somar — e o `Math.min` ainda puxava de volta quem estivesse
// acima, o que inutilizou uma bancada antes de eu perceber. O valor novo vem da
// medição de desenho com a CPU seis vezes mais lenta.
test('o teto de massa fica longe do que o quadro aguenta', () => {
  const pontos = m => Math.ceil(lengthOf({ mass: m }) / ARENA.spacing) + 1;
  assert.ok(ARENA.maxMass >= 500000, `teto em ${ARENA.maxMass}, abaixo do medido como suportável`);
  // O que o quadro paga é o número de pontos do corpo, não a massa. 2605
  // pontos custam 28,4 ms de desenho com a CPU seis vezes mais lenta; é o
  // degrau medido e é ele que o teste tranca, para o teto não subir sem medir
  // de novo.
  assert.ok(pontos(ARENA.maxMass) <= 2700,
    `corpo de ${pontos(ARENA.maxMass)} pontos no teto, acima dos 2605 medidos`);
  // E o teto não pode ser confundido com o limite visual: raio, zoom e campo de
  // visão saturam perto de 60000, muito antes. Daí para cima o que sobe é o
  // número e o comprimento do corpo, que continua valendo como obstáculo.
  assert.ok(ARENA.maxMass > 60000 * 3, 'o teto precisa ficar bem acima da saturação visual');
  assert.equal(radiusOf({ mass: ARENA.maxMass / 2 }), radiusOf({ mass: ARENA.maxMass }),
    'a espessura precisa saturar bem antes do teto, senão o teto vira o limite visual');
});

// Rival grande enxerga mais longe, na proporção do que precisa para desviar.
// Com o alcance fixo, os gigantes que agora existem desde a largada morriam
// cinco a sete por minuto, quase sempre batendo no corpo de outro grande.
test('quem é grande enxerga o bastante para fazer a curva', () => {
  for (const level of Object.values(DIFFICULTIES)) {
    // O novato fica exatamente com o alcance da dificuldade: a conta não pode
    // mudar a dificuldade dos pequenos por tabela.
    assert.equal(foresightOf(level, { mass: ARENA.startMass }), level.foresight);
    let anterior = 0;
    for (const mass of [100, 1000, 5000, 15000, 40000, ARENA.maxMass]) {
      const eye = foresightOf(level, { mass });
      assert.ok(eye >= anterior, 'crescer não pode encurtar a vista');
      anterior = eye;
      // O mínimo físico de um desvio de frente: encostar (meu raio + o de um
      // igual) mais o quarto de volta (um raio de curva).
      const minimo = radiusOf({ mass }) * 2 + turnRadiusOf({ mass });
      assert.ok(eye >= minimo, `massa ${mass}: vê ${eye.toFixed(0)}, precisa de ${minimo.toFixed(0)} para desviar`);
    }
  }
});

// Quando o primeiro do placar morre, a vaga fica aberta um tempo, como num
// servidor de verdade. Sem isso, um gigante morria por minuto e outro nascia em
// cinco segundos: o corpo dele virava uma esteira de luz.
test('a vaga de gigante espera o intervalo antes de ser reposta', () => {
  const level = DIFFICULTIES.normal, topo = level.population[0];
  const world = createWorld({ difficulty: 'normal', seed: 19 });
  world.started = true;
  const conhecidos = new Set(world.snakes);
  let derrubadoEm = null, reposto = null;
  for (let i = 0; i < 60 * (topo.refill + 40) && !world.over; i++) {
    world.player.invulnerable = 1e9;
    // Longe da borda: a invulnerabilidade não protege dela, e com o jogador
    // morto o mundo congela antes de o intervalo terminar.
    const p = world.player, perto = Math.hypot(p.x, p.y) > ARENA.radius - 600;
    world.update(1 / 60, { angle: perto ? Math.atan2(-p.y, -p.x) : Math.sin(i / 200) * 2 });
    // Aos dez segundos, derruba um gigante: a pirâmide fica pedindo um.
    if (derrubadoEm === null && world.time > 10) {
      const g = world.snakes.find(s => s.alive && !s.player && s.mass >= topo.min);
      if (g) { g.x = g.y = ARENA.radius * 2; derrubadoEm = world.time; }
    }
    for (const s of world.snakes) {
      if (conhecidos.has(s)) continue;
      conhecidos.add(s);
      if (derrubadoEm !== null && reposto === null && s.mass >= topo.min) reposto = world.time;
    }
  }
  assert.ok(!world.over, 'o jogador do teste morreu e o mundo congelou');
  assert.ok(derrubadoEm !== null, 'o teste precisa derrubar um gigante');
  assert.ok(reposto !== null, 'a vaga de gigante tem de ser reposta depois do intervalo');
  // A vaga abre na morte e fica aberta o intervalo inteiro.
  assert.ok(reposto - derrubadoEm >= topo.refill - .5,
    `gigante reposto ${(reposto - derrubadoEm).toFixed(0)} s depois da morte, antes do intervalo de ${topo.refill} s`);
});
