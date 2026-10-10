import { ARENA, DIFFICULTIES, SKINS, NAMES } from './config.js';
import { createRng } from '../../core/rng.js';

const TAU = Math.PI * 2;
export const angleDelta = a => Math.atan2(Math.sin(a), Math.cos(a));
// Espessura: engordar é o sinal visível de que a cobra está grande, como no
// slither.io. O limite tem de cair depois do piso do zoom, não antes: com o
// antigo (25, massa 21626) a espessura travava enquanto o mundo continuava
// encolhendo, e a partir dali crescer *diminuía* a cobra na tela — 12,6 px de
// cabeça na massa 21626 contra 9 px na 60000. 42 faz os dois saturarem juntos,
// na massa 61038, então o tamanho na tela nunca anda para trás.
export const radiusOf = s => 7 + Math.min(42, Math.sqrt(s.mass) * .17);
export const lengthOf = s => 65 + Math.sqrt(s.mass) * 22;
// O zoom acompanha a espessura, então a cabeça ocupa sempre mais ou menos a
// mesma fatia da tela e quem encolhe é o mundo em volta — é assim que o
// slither.io mostra que você cresceu. A curva é assintótica: o antigo
// `1 - raiz(massa)` batia no piso já na massa 2800 e a partir dali crescer não
// mudava mais nada na tela.
export const zoomFor = mass => Math.max(.28, 1 / (1 + Math.sqrt(mass) * .0105));
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

// Rival nenhum nasce em cima do jogador: quem volta à arena entra longe. A
// conta é entre o corpo inteiro de quem nasce — o segmento da cabeça à cauda —
// e todo mundo que já está na arena. Era só o ponto da cabeça, e o corpo, que é
// criado depois esticado para trás, não era conferido: um corpo de 1945 de
// comprimento chegou a nascer a 49 unidades do jogador, sem aviso nenhum.
export function spawnFits(head, tail, snakes) {
  const corpo = distance(head, tail);
  return snakes.every(s => {
    if (!s.alive) return true;
    const clear = s.player ? ARENA.clearPlayer : ARENA.clearRival;
    if (segmentDistance(s, head, tail) <= clear) return false;
    // Os dois corpos longe demais: não vale varrer ponto a ponto, o que ficou
    // caro depois que uma cobra grande passou a ter mais de mil pontos. O
    // alcance soma os dois comprimentos porque o que entra na conta agora é um
    // segmento, não um ponto.
    if (distance(head, s) > clear + lengthOf(s) + corpo) return true;
    return s.path.every(v => segmentDistance(v, head, tail) > clear * .72);
  });
}

// Leque de rumos que a IA considera, de -90° a +90° em passos de 18°.
const RAYS = 11, RAY_STEP = Math.PI / 10, RAY_MID = (RAYS - 1) / 2;

// Quantas voltas o corpo dá em torno de um ponto. Somar as variações de ângulo
// ao longo do caminho é o número de giro: uma volta fechada dá 2π, um corpo que
// só passa ao lado dá quase zero. É o que distingue cercar de encostar.
export function turnsAround(path, p) {
  if (!path || path.length < 3) return 0;
  let total = 0, anterior = Math.atan2(path[0].y - p.y, path[0].x - p.x);
  for (let i = 1; i < path.length; i++) {
    const atual = Math.atan2(path[i].y - p.y, path[i].x - p.x);
    total += angleDelta(atual - anterior); anterior = atual;
  }
  return Math.abs(total) / (Math.PI * 2);
}

// Quanto à frente um rival precisa enxergar para conseguir desviar. Desviar de
// frente exige um quarto de volta, que avança um raio de curva; antes disso ele
// já encosta a `meu raio + raio do outro`. Para uma cobra pequena o alcance da
// dificuldade sobra, e nada muda. Para um gigante não: com o alcance fixo ele
// encostava num corpo grande a 120 e sobravam 35 unidades para uma curva que
// pede 73. Medido: 55 a 62% das mortes de rivais acima de 5000 eram batidas em
// corpo maior, cinco a sete por minuto; com o alcance proporcional, metade.
//
// Soma só o que o tamanho pede a mais que uma cobra recém-nascida, para o
// alcance de cada dificuldade continuar valendo inteiro para os pequenos — a
// conta não pode deixar o novato do Fácil mais esperto por tabela.
const desvio = s => turnRadiusOf(s) + radiusOf(s) * 2;
export const foresightOf = (level, s) =>
  level.foresight + Math.max(0, desvio(s) - desvio({ mass: ARENA.startMass }));

export function createWorld({ difficulty = 'normal', skin = 'aurora', seed = Date.now() } = {}) {
  const level = DIFFICULTIES[difficulty] || DIFFICULTIES.normal, rng = createRng(seed);
  const world = { snakes: [], foods: [], time: 0, started: false, over: false, best: ARENA.startMass, kills: 0, events: [], level,
    bodyGrid: new SpatialGrid(), foodGrid: new SpatialGrid(), respawns: [], nextId: 0, foodClock: 0, tierClock: [] };
  // Buffers reaproveitados pelas consultas do passo: nada é alocado por quadro.
  const risk = new Float64Array(RAYS), seenBody = [], seenFood = [], seenHit = [], seenBite = [], seenSpawn = [];
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
  // Massa de quem renasce. Percorre a pirâmide da dificuldade do topo para a
  // base e devolve a primeira faixa com gente faltando; sem falta, nasce
  // novato. A contagem é cumulativa: um gigante também conta como "acima de
  // 5000", então um rival que cresceu sozinho até lá ocupa a vaga e ninguém
  // precisa nascer grande para preenchê-la.
  //
  // Cada faixa tem um relógio: depois de um nascimento nela, a próxima vaga só
  // é preenchida passado `refill`. Na largada os relógios estão zerados, então
  // a pirâmide sai inteira; o intervalo vale para a reposição.
  function birthMass() {
    let meta = 0;
    const faixas = level.population ?? [];
    for (let i = 0; i < faixas.length; i++) {
      const faixa = faixas[i];
      meta += faixa.count;
      let acima = 0;
      for (const v of world.snakes) if (v.alive && !v.player && v.mass >= faixa.min) acima++;
      if (acima >= meta || world.time < (world.tierClock[i] ?? 0)) continue;
      return { mass: Math.round(faixa.min + rng.next() ** 1.7 * (faixa.max - faixa.min)), tier: i };
    }
    return { mass: Math.round(level.mass[0] + rng.next() ** 2.2 * (level.mass[1] - level.mass[0])), tier: -1 };
  }

  // Rival grande nasce enrolado num círculo, longe do jogador. Esticado ele não
  // caberia: um corpo de 4000 nascido fora da vista atravessaria a borda da
  // arena. Enrolado ele ocupa um disco de raio `comprimento / 2π`, e o que se
  // vê é uma cobra circulando do outro lado do mapa — como quem já estava
  // jogando antes de você chegar.
  function coiledSpot(corpo) {
    const rho = Math.max(140, corpo / TAU);
    const limite = ARENA.radius - rho - 160;
    if (limite <= 0) return null;
    const p = world.player;
    // Piso de distância e alvo. O alvo é estar fora da vista; o piso é o
    // mínimo aceitável quando isso não for possível. Com o jogador pequeno a
    // vista (742) fica abaixo do piso (1120), então o laço não pode parar na
    // vista: parava no primeiro lugar a 742, que o piso depois recusava, e a
    // largada perdia até nove rivais.
    const piso = ARENA.clearPlayer + 600;
    const alvo = Math.max(piso, p ? ARENA.spawnView / zoomFor(p.mass) : 0);
    // Distância de um ponto à linha do círculo: o corpo é um anel, não um
    // disco cheio, então quem está no meio dele não encosta em nada.
    const anel = (c, q) => Math.abs(Math.hypot(q.x - c.x, q.y - c.y) - rho);
    let melhor = null, folga = -Infinity;
    // Os corpos são consultados pelo índice espacial, em pontos ao longo do
    // círculo. Varrer todos os pontos de todos os corpos para cada lugar
    // candidato custava até 122 ms num único passo — um travamento de sete
    // quadros no computador, e várias vezes isso num celular. Os pontos ficam
    // a 60 de distância: entre dois deles a linha do círculo se afasta no
    // máximo 30, o que mexe menos de 1% na folga de 245 de um rival.
    if (!world.started) bodyIndex();
    const passo = Math.max(1, Math.ceil(TAU * rho / 60));
    const raioBusca = ARENA.clearPlayer * .72;
    for (let t = 0; t < 60; t++) {
      const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * limite;
      const c = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      // A distância até o jogador é conta de uma linha; a folga contra os
      // corpos é a parte cara. Lugar que não supera o melhor já achado, ou que
      // nem chega ao piso, não precisa passar pelo teste caro.
      const longe = p ? Math.hypot(p.x - c.x, p.y - c.y) - rho : Infinity;
      if (longe <= folga || (p && longe < piso)) continue;
      let cabe = world.snakes.every(v => !v.alive || anel(c, v) > (v.player ? ARENA.clearPlayer : ARENA.clearRival));
      for (let k = 0; cabe && k < passo; k++) {
        const ang = k / passo * TAU, q = { x: c.x + Math.cos(ang) * rho, y: c.y + Math.sin(ang) * rho };
        for (const seg of world.bodyGrid.collect(q.x, q.y, raioBusca, seenSpawn)) {
          if (!seg.snake.alive) continue;
          const lim = (seg.snake.player ? ARENA.clearPlayer : ARENA.clearRival) * .72;
          if (segmentDistance(q, seg.a, seg.b) <= lim) { cabe = false; break; }
        }
      }
      if (!cabe) continue;
      // Entre os lugares que cabem, fica o mais longe do jogador. Quase sempre
      // ele já está fora da vista; quando o jogador é enorme e está no meio do
      // mapa, a vista cobre quase tudo, e o mais longe possível é o que resta.
      folga = longe; melhor = c;
      if (longe >= alvo) break;
    }
    if (!melhor || (p && folga < piso)) return null;
    return { c: melhor, rho };
  }

  function spawn(player = false) {
    const nascimento = player ? { mass: ARENA.startMass, tier: -1 } : birthMass();
    const mass = nascimento.mass;
    const corpo = lengthOf({ mass });
    let p = { x: 0, y: 0 }, a = 0, safe = player, espiral = null;
    // O jogador entra no centro; o rumo dele sai da mesma conta, só sem busca.
    if (player) a = Math.atan2(-p.y, -p.x) + (rng.next() - .5);
    // Novato nasce esticado e pode aparecer por perto, como jogador entrando
    // no servidor. Quem nasce acima da faixa de novato nasce enrolado e longe.
    if (!player && mass > level.mass[1]) {
      espiral = coiledSpot(corpo);
      if (!espiral) return null;
      const t0 = rng.next() * TAU;
      p = { x: espiral.c.x + Math.cos(t0) * espiral.rho, y: espiral.c.y + Math.sin(t0) * espiral.rho };
      a = t0 + Math.PI / 2;
      espiral.t0 = t0;
      safe = true;
    }
    // O corpo nasce esticado para trás da cabeça, então a folga tem de valer
    // para ele inteiro. Conferir só o ponto da cabeça deixava passar um corpo
    // de 1945 de comprimento a 49 unidades do jogador — morte sem aviso.
    for (let i = 0; !safe && i < 80; i++) {
      p = point(320);
      a = Math.atan2(-p.y, -p.x) + (rng.next() - .5);
      const cauda = { x: p.x - Math.cos(a) * corpo, y: p.y - Math.sin(a) * corpo };
      safe = spawnFits(p, cauda, world.snakes);
    }
    if (!safe) return null;
    // Nascer também marca o relógio, para dois grandes não nascerem colados
    // quando duas vagas abrem juntas. Só marca quando o nascimento acontece:
    // marcado antes, uma espiral sem lugar bloqueava a vaga por 90 s e quem
    // nascia no lugar era um novato.
    if (nascimento.tier >= 0 && world.time > 0) {
      world.tierClock[nascimento.tier] = Math.max(world.tierClock[nascimento.tier] ?? 0,
        world.time + (level.population[nascimento.tier].refill ?? 0));
    }
    const id = world.nextId++;
    const s = { id, name: player ? 'Você' : `${NAMES[id % NAMES.length]} ${id}`, player, x: p.x, y: p.y, px: p.x, py: p.y,
      angle: a, target: a, mass, skin: player ? skin : SKINS[id % SKINS.length].id, alive: true, boost: false,
      think: rng.next() * level.reaction, boostClock: 0, path: [], segments: [], invulnerable: 3, deaths: 0, headSeq: 0,
      // Cada rival tem sua mão: precisão do rumo e disposição para caçar.
      skill: player ? 1 : Math.min(1, level.skill * (.72 + rng.next() * .5)),
      temper: player ? 0 : .45 + rng.next() * 1.1, huntClock: 0, prey: null };
    const n = Math.ceil(lengthOf(s) / ARENA.spacing);
    // `n` numera o ponto na ordem em que a carne foi criada e nunca muda. O
    // índice no array, esse sim, desloca a cada ponto novo na cabeça — e quem
    // pinta a estampa pelo índice vê o desenho saltar 30 vezes por segundo.
    if (espiral) {
      // Pontos ao longo do círculo, da cabeça para trás: o ângulo recua um
      // espaçamento por ponto, então o corpo segue a curva que ela já fez.
      const { c, rho, t0 } = espiral;
      for (let i = 0; i <= n; i++) {
        const t = t0 - i * ARENA.spacing / rho;
        s.path.push({ x: c.x + Math.cos(t) * rho, y: c.y + Math.sin(t) * rho, n: -i });
      }
    } else {
      for (let i = 0; i <= n; i++) s.path.push({ x: p.x - Math.cos(a) * i * ARENA.spacing, y: p.y - Math.sin(a) * i * ARENA.spacing, n: -i });
    }
    world.snakes.push(s); return s;
  }
  world.player = spawn(true);
  // Nascimento que não acha lugar na largada vai para a fila de renascer, em
  // vez de sumir: com os grandes nascendo enrolados e longe, a arena às vezes
  // fica sem espaço livre de primeira, e a partida começava com rival a menos.
  for (let i = 0; i < level.bots; i++) if (!spawn()) world.respawns.push(.5 + i * .05);
  for (let i = 0; i < ARENA.food; i++) food(point(30));
  // Alimento próximo facilita o primeiro contato sem colocar rivais em cima do jogador.
  for (let i = 0; i < 35; i++) { const a = rng.next() * TAU, r = 80 + rng.next() * 300; food({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
  bodyIndex(); foodIndex();

  function think(s) {
    const eye = foresightOf(level, s), myR = radiusOf(s);
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
        // Presa que não paga o risco não é caçada: gigante não cerca novato.
        if (v.mass < s.mass * ARENA.preyFloor) continue;
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
      const weight = (1 - d / eye) ** 2 * ARENA.avoidWeight;
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
    // A morte de um grande abre a vaga dele, e a vaga fica aberta `refill`
    // segundos. Contar só a partir do último nascimento deixava a primeira
    // morte da partida ser reposta na hora, porque na largada o relógio está
    // zerado.
    if (!s.player) {
      const faixas = level.population ?? [];
      const i = faixas.findIndex(f => s.mass >= f.min);
      if (i >= 0) world.tierClock[i] = Math.max(world.tierClock[i] ?? 0, world.time + (faixas[i].refill ?? 0));
    }
    // Uma cobra grande vira um rastro de luz. Com o teto antigo de 100 pontos,
    // quanto maior a cobra mais absurdo o valor de cada pelota solta.
    const step = Math.max(1, Math.ceil(s.path.length / 420)), drops = Math.ceil(s.path.length / step);
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
      if (previous && distance(s, previous) >= ARENA.spacing) s.path.unshift({ x: s.x, y: s.y, n: ++s.headSeq });
      else { s.path[0].x = s.x; s.path[0].y = s.y; }
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
      for (let i = 0; i < ARENA.refill && world.foods.length < ARENA.food; i++) food(point(30));
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
