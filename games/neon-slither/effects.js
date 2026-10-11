// Partículas das skins. Cada skin solta a partícula do próprio nome: a Oceano
// solta bolhas, a Polar neva, a Brasa cospe fagulhas, o Tigre deixa pegadas.
//
// Tudo aqui é feito para caber no quadro de um celular de entrada:
// - as partículas vivem em vetores de tamanho fixo, sem objeto novo por
//   partícula e sem coleta de lixo no meio da partida;
// - cada desenho é pintado uma única vez por cor num canvas pequeno, e depois
//   só é carimbado com `drawImage`;
// - o total tem teto, e cada cobra solta na proporção do corpo que aparece na
//   tela; cobra fora da tela ou fina demais não solta nada.

const TAU = Math.PI * 2;
const entre = (a, b) => a + Math.random() * (b - a);
const sorteio = lista => lista[Math.floor(Math.random() * lista.length)];
const vidaDe = em => entre(em.vida[0], em.vida[1]);
// Um quarto acima do tamanho de tabela: medido na arena, no zoom de uma cobra
// média a partícula de tabela ficava com dois ou três pixels.
const tamDe = (em, r) => r * entre(em.tam[0], em.tam[1]) * 1.25;
// Tom mais escuro da cor, para a partícula aparecer no tema claro.
function escurecer(cor, k) {
  const v = parseInt(cor.slice(1, 7), 16), canal = s => Math.round(((v >> s) & 255) * (1 - k));
  return '#' + ((1 << 24) | (canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).slice(1);
}

// Desenhos, pintados uma vez por cor num canvas de 32 px centrado em 16.
// `centro` é o miolo das luzes: branco no tema escuro, a própria cor no claro,
// onde branco sobre o fundo claro some.
const PINTURAS = {
  brilho(g, cor, variante, centro) {
    const k = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    k.addColorStop(0, centro); k.addColorStop(.22, cor); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.fillRect(0, 0, 32, 32);
  },
  // Cortina de aurora: um brilho esticado na vertical.
  veu(g, cor) {
    g.translate(16, 16); g.scale(.3, 1);
    const k = g.createRadialGradient(0, 0, 0, 0, 0, 16);
    k.addColorStop(0, cor + 'dd'); k.addColorStop(.45, cor + '66'); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
  },
  // Arco elétrico: três traçados em zigue-zague, um por variante.
  faisca(g, cor, variante, centro) {
    const caminhos = [
      [[2, 16], [9, 10], [13, 19], [19, 9], [24, 18], [30, 14]],
      [[2, 14], [7, 20], [12, 11], [18, 21], [23, 12], [30, 17]],
      [[2, 18], [8, 12], [14, 17], [17, 8], [25, 20], [30, 13]]
    ];
    const pontos = caminhos[variante % caminhos.length];
    g.lineJoin = g.lineCap = 'round';
    for (const [largura, tom] of [[5, cor + '55'], [1.8, centro]]) {
      g.strokeStyle = tom; g.lineWidth = largura; g.beginPath();
      pontos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.stroke();
    }
  },
  // Raio de luz deitado no eixo x: o desenho gira para o rumo da partícula.
  raio(g, cor, variante, centro) {
    g.translate(16, 16); g.scale(1, .22);
    const k = g.createRadialGradient(0, 0, 0, 0, 0, 16);
    k.addColorStop(0, centro); k.addColorStop(.3, cor); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
  },
  bolha(g, cor) {
    g.fillStyle = cor + '24'; g.strokeStyle = cor; g.lineWidth = 2;
    g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#ffffffcc'; g.lineCap = 'round';
    g.beginPath(); g.arc(16, 16, 8, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
  },
  confete(g, cor) { g.fillStyle = cor; g.fillRect(11, 8, 10, 16); },
  cristal(g, cor) {
    g.fillStyle = cor; g.beginPath();
    g.moveTo(16, 3); g.lineTo(24, 16); g.lineTo(16, 29); g.lineTo(8, 16); g.closePath(); g.fill();
    g.strokeStyle = '#ffffffb0'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(16, 3); g.lineTo(8, 16); g.lineTo(16, 29); g.stroke();
  },
  neve(g, cor) {
    g.translate(16, 16); g.strokeStyle = cor; g.lineWidth = 2; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      g.rotate(TAU / 6); g.beginPath();
      g.moveTo(0, 0); g.lineTo(0, -13);
      g.moveTo(0, -8); g.lineTo(-4, -11); g.moveTo(0, -8); g.lineTo(4, -11);
      g.stroke();
    }
  },
  anel(g, cor) { g.strokeStyle = cor; g.lineWidth = 2.2; g.beginPath(); g.arc(16, 16, 13, 0, TAU); g.stroke(); },
  // Pegada com os dedos para cima, no sentido de -y.
  pegada(g, cor) {
    g.fillStyle = cor;
    g.beginPath(); g.ellipse(16, 21, 7.5, 6.5, 0, 0, TAU); g.fill();
    for (const [x, y] of [[7, 12], [12.5, 7], [19.5, 7], [25, 12]]) { g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); }
  },
  bit(g, cor, variante, centro) {
    const k = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    k.addColorStop(0, cor + 'aa'); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.fillRect(0, 0, 32, 32);
    g.fillStyle = centro; g.fillRect(12, 12, 8, 8);
  },
  pixel(g, cor) { g.fillStyle = cor; g.fillRect(6, 6, 20, 20); g.fillStyle = '#ffffff55'; g.fillRect(6, 6, 20, 5); },
  fumaca(g, cor) {
    const k = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    k.addColorStop(0, cor + '88'); k.addColorStop(.6, cor + '33'); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.fillRect(0, 0, 32, 32);
  },
  chama(g, cor, variante, centro) {
    const k = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    k.addColorStop(0, centro === '#ffffff' ? '#fffbe0' : centro); k.addColorStop(.25, cor); k.addColorStop(.6, '#ff5a2a88'); k.addColorStop(1, '#ff5a2a00');
    g.fillStyle = k; g.fillRect(0, 0, 32, 32);
  },
  // Estrela de quatro pontas, a cintilação de um astro.
  estrela(g, cor, variante, centro) {
    g.translate(16, 16);
    const k = g.createRadialGradient(0, 0, 0, 0, 0, 9);
    k.addColorStop(0, cor + 'aa'); k.addColorStop(1, cor + '00');
    g.fillStyle = k; g.fillRect(-16, -16, 32, 32);
    g.fillStyle = cor; g.beginPath(); g.moveTo(0, -15);
    g.quadraticCurveTo(0, 0, 15, 0); g.quadraticCurveTo(0, 0, 0, 15);
    g.quadraticCurveTo(0, 0, -15, 0); g.quadraticCurveTo(0, 0, 0, -15); g.fill();
    g.fillStyle = centro; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
  },
  hexa(g, cor) {
    g.fillStyle = cor + '1c'; g.strokeStyle = cor; g.lineWidth = 2; g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6 + Math.PI / 6;
      k ? g.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12) : g.moveTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12);
    }
    g.closePath(); g.fill(); g.stroke();
  }
};

// Como cada partícula se move e some. `luz` soma luz ao fundo (no tema claro
// isso some, então lá ela é desenhada normal); `chao` fica embaixo das cobras;
// `relativo` acompanha a cabeça de quem soltou; `arrasto` freia a cada
// segundo; `cresce` é o tamanho no fim da vida; `curva` dá o brilho ao longo
// da vida.
const TIPOS = [
  { nome: 'veu', desenho: 'veu', luz: true, arrasto: .8, cresce: 1.3, curva: 'entra' },
  { nome: 'faisca', desenho: 'faisca', variantes: 3, luz: true, gira: true, curva: 'pisca' },
  { nome: 'raio', desenho: 'raio', luz: true, alinha: true, estica: 2.2, arrasto: 1.6, curva: 'some' },
  { nome: 'bolha', desenho: 'bolha', arrasto: 1.2, oscila: true, cresce: 1.3, curva: 'estala' },
  { nome: 'confete', desenho: 'confete', arrasto: 2.2, gira: true, vira: true, curva: 'fim' },
  { nome: 'cristal', desenho: 'cristal', luz: true, gira: true, arrasto: 1.8, curva: 'pisca' },
  { nome: 'neve', desenho: 'neve', gira: true, arrasto: .7, oscila: true, curva: 'entra' },
  { nome: 'onda', desenho: 'anel', chao: true, cresce: 3.4, curva: 'some', alfa: .8 },
  { nome: 'pegada', desenho: 'pegada', chao: true, gira: true, curva: 'fim', alfa: .7 },
  { nome: 'bit', desenho: 'bit', luz: true, quina: true, curva: 'some' },
  { nome: 'pixel', desenho: 'pixel', grade: true, arrasto: .5, curva: 'degrau' },
  { nome: 'gota', desenho: 'brilho', luz: true, arrasto: 3, cresce: .35, curva: 'some' },
  { nome: 'fumaca', desenho: 'fumaca', arrasto: 1.2, cresce: 2.6, curva: 'entra', alfa: .8 },
  { nome: 'chama', desenho: 'chama', luz: true, arrasto: 2.2, cresce: 1.9, curva: 'some' },
  { nome: 'estrela', desenho: 'estrela', luz: true, curva: 'cintila' },
  { nome: 'brasa', desenho: 'brilho', luz: true, oscila: true, curva: 'tremula' },
  { nome: 'hexa', desenho: 'hexa', luz: true, gira: true, curva: 'entra', alfa: .8 },
  { nome: 'espiral', desenho: 'raio', luz: true, relativo: true, espiral: true, alinha: true, estica: 1.8, curva: 'entra' },
  { nome: 'corona', desenho: 'anel', luz: true, relativo: true, cresce: 3, curva: 'some', alfa: .9 },
  { nome: 'cometa', desenho: 'raio', luz: true, alinha: true, estica: 1.6, curva: 'entra' }
];
const TIPO = Object.fromEntries(TIPOS.map((t, i) => [t.nome, i]));

const CURVAS = {
  some: t => 1 - t,
  entra: t => Math.sin(Math.PI * t),
  pisca: (t, f) => (.6 + .4 * Math.sin(f + t * 40)) * (1 - t),
  estala: t => t < .85 ? 1 : (1 - t) / .15,
  fim: t => t < .7 ? 1 : (1 - t) / .3,
  degrau: t => (Math.floor(t * 8) % 2 ? .55 : 1) * (1 - t * .6),
  cintila: (t, f) => Math.sin(Math.PI * t) * (.55 + .45 * Math.sin(f + t * 18)),
  tremula: (t, f) => (.65 + .35 * Math.sin(f + t * 34)) * (1 - t)
};
const curvas = TIPOS.map(t => CURVAS[t.curva]);

// Quem solta o quê. Tamanho, distância e velocidade vêm em raios da cobra,
// para a partícula crescer junto com ela; `taxa` é por segundo num corpo de 400
// unidades à vista. `onde`: `corpo` é um ponto qualquer da carne, a uma
// distância `lado` do eixo, para um dos dois lados; `cauda` é a ponta da cauda;
// `cabeca` é o focinho e `narinas` os dois lados dele; `passo` solta pela
// distância andada; `ciclo` a cada tanto de tempo; `pulso` no pico do brilho da
// skin; `orbita` num anel em volta da cabeça. Quase tudo nasce na borda do
// corpo ou fora dela: em cima da pele a partícula se perde na estampa.
const fogo = ['#fffbe0', '#ffd166', '#ff8a3d'];
export const EFEITOS = {
  aurora: [{ tipo: 'veu', onde: 'corpo', cores: ['#75ffd0', '#d6fff0', '#27bf9e'], taxa: 16, vida: [1, 1.6], tam: [.7, 1.1], lado: [.6, 1.3], vel: .3, sobe: 3 }],
  plasma: [{ tipo: 'faisca', onde: 'corpo', cores: ['#c887ff', '#efd5ff'], taxa: 26, vida: [.12, .22], tam: [.7, 1.1], lado: [.85, 1.25] }],
  solar: [{ tipo: 'raio', onde: 'corpo', cores: ['#fff0ae', '#ffc75a', '#ff8650'], taxa: 20, vida: [.35, .6], tam: [.55, .9], lado: [.9, 1.1], vel: 4.5 }],
  oceano: [{ tipo: 'bolha', onde: 'corpo', cores: ['#c4f6ff', '#54d4ff'], taxa: 14, vida: [.9, 1.6], tam: [.22, .45], lado: [.6, 1.4], vel: .5, sobe: 3 }],
  sintese: [{ tipo: 'confete', onde: 'corpo', cores: ['#ff82bc', '#b99dff', '#71e9e0', '#fff1fd'], taxa: 18, vida: [.8, 1.3], tam: [.28, .4], lado: [.8, 1.1], vel: 2.6 }],
  prisma: [{ tipo: 'cristal', onde: 'corpo', cores: ['#ff7d88', '#ffd166', '#abeb77', '#67ddd8', '#8eaaff', '#d69aff'], taxa: 24, vida: [.5, .9], tam: [.26, .4], lado: [.8, 1.2], vel: 1.6 }],
  polar: [{ tipo: 'neve', onde: 'corpo', cores: ['#ffffff', '#cfeaff'], taxa: 14, vida: [1.2, 2], tam: [.3, .5], lado: [.8, 1.8], vel: .3, sobe: -1 }],
  eclipse: [
    { tipo: 'corona', onde: 'ciclo', cores: ['#ffd77c'], periodo: .9, vida: [.9, .9], tam: [.75, .75] },
    { tipo: 'gota', onde: 'corpo', cores: ['#ffd77c', '#fff0c0'], taxa: 10, vida: [.6, 1], tam: [.2, .3], lado: [.9, 1.3], vel: .5 }
  ],
  // As pegadas ficam ao lado do corpo: no rastro da cabeça o próprio corpo
  // passaria por cima delas e elas sumiriam antes de a cauda passar.
  tigre: [{ tipo: 'pegada', onde: 'passo', cores: ['#f7812f'], passo: 1.9, afasta: 1.45, vida: [1.6, 1.6], tam: [.5, .5] }],
  koi: [{ tipo: 'onda', onde: 'corpo', cores: ['#fff5e8', '#f45859'], taxa: 7, vida: [1, 1.4], tam: [.5, .7], lado: [0, .3] }],
  circuito: [{ tipo: 'bit', onde: 'corpo', cores: ['#60ffe2'], taxa: 18, vida: [.5, .8], tam: [.18, .26], lado: [.8, 1.2], vel: 2.8, eixo: true }],
  pixel: [{ tipo: 'pixel', onde: 'corpo', cores: ['#9eff65', '#b39cff'], taxa: 18, vida: [.6, 1], tam: [.18, .26], lado: [.8, 1.3], vel: 1, sobe: -2 }],
  magma: [
    { tipo: 'gota', onde: 'corpo', cores: ['#ffcf6b', '#ff9958'], taxa: 16, vida: [.5, .9], tam: [.28, .42], lado: [.85, 1.1], vel: 2.4 },
    { tipo: 'fumaca', onde: 'corpo', cores: ['#4a3236'], taxa: 6, vida: [1, 1.6], tam: [.45, .7], lado: [.3, .9], vel: .3, sobe: 1.5 }
  ],
  // O dragão solta labaredas curtas pelas narinas o tempo todo, e cospe fogo
  // de verdade quando acelera.
  draco: [
    { tipo: 'chama', onde: 'narinas', cores: fogo, taxa: 12, vida: [.15, .25], tam: [.32, .46], vel: 3, espalha: .25 },
    { tipo: 'chama', onde: 'cabeca', cores: fogo, taxa: 42, vida: [.18, .32], tam: [.3, .5], vel: 7, espalha: .35, so: 'boost' },
    { tipo: 'fumaca', onde: 'narinas', cores: ['#c8f5d8', '#d4ef8a'], taxa: 6, vida: [.8, 1.2], tam: [.3, .45], vel: .8 }
  ],
  galaxia: [{ tipo: 'estrela', onde: 'corpo', cores: ['#aff1ff', '#ffffff', '#c9a6ff'], taxa: 16, vida: [.8, 1.6], tam: [.24, .4], lado: [.7, 1.8], vel: .15 }],
  imperial: [
    { tipo: 'estrela', onde: 'corpo', cores: ['#fff3c4', '#ffffff'], taxa: 12, vida: [.35, .6], tam: [.3, .45], lado: [.3, .9] },
    { tipo: 'gota', onde: 'corpo', cores: ['#efd078', '#fff3c4'], taxa: 8, vida: [.6, 1], tam: [.14, .2], lado: [.9, 1.3], vel: .6, sobe: -2 }
  ],
  brasa: [{ tipo: 'brasa', onde: 'corpo', cores: ['#ffd48a', '#ff7a3d', '#ffb15c'], taxa: 28, vida: [.7, 1.3], tam: [.22, .34], lado: [.7, 1.2], vel: .8, sobe: 4 }],
  boreal: [{ tipo: 'veu', onde: 'corpo', cores: ['#7bffce', '#3d8fd6', '#b58cff'], taxa: 18, vida: [1, 1.7], tam: [.75, 1.2], lado: [.6, 1.4], vel: .3, sobe: 3 }],
  // A serpente que come a própria cauda: brilhos correndo pelas bordas do corpo
  // da cauda para a cabeça, mais rápido que ela anda.
  ouroboros: [{ tipo: 'cometa', onde: 'corpo', cores: ['#fff0b8', '#f2c65a'], taxa: 22, vida: [.5, .8], tam: [.3, .4], lado: [1.05, 1.2], segue: 1.4 }],
  singularidade: [{ tipo: 'espiral', onde: 'orbita', cores: ['#c9a6ff', '#ffffff', '#7c46de'], taxa: 26, vida: [.9, 1.3], tam: [.22, .32], raio: 4 }],
  // As três faixas continuam além da cauda, como rastros de três criaturas.
  quimera: [{ tipo: 'gota', onde: 'cauda', cores: ['#ff5d9e', '#5ef2ff', '#ffcf5d'], taxa: 36, vida: [.5, .8], tam: [.2, .26], faixas: [-.52, 0, .52] }],
  miragem: [{ tipo: 'hexa', onde: 'corpo', cores: ['#eafcff', '#9fe8ff'], taxa: 12, vida: [.8, 1.4], tam: [.26, .4], lado: [.9, 1.8], vel: .2 }],
  pulsar: [{ tipo: 'corona', onde: 'pulso', cores: ['#a8f0ff'], vida: [1.2, 1.2], tam: [.85, .85] }]
};

export function createEffects(capacidade = 300) {
  const X = new Float32Array(capacidade), Y = new Float32Array(capacidade);
  const VX = new Float32Array(capacidade), VY = new Float32Array(capacidade);
  const AY = new Float32Array(capacidade), VIDA = new Float32Array(capacidade), TOTAL = new Float32Array(capacidade);
  const TAM = new Float32Array(capacidade), ROT = new Float32Array(capacidade), VROT = new Float32Array(capacidade);
  const FASE = new Float32Array(capacidade), K = new Uint8Array(capacidade), VAR = new Uint8Array(capacidade);
  const COR = new Uint16Array(capacidade), VIROU = new Uint8Array(capacidade), DONO = new Float64Array(capacidade);
  let n = 0, agora = 0;
  // Cores viram índice: a partícula guarda um número, e o desenho é buscado
  // num cache por desenho, cor e variante.
  const cores = [], indiceDa = new Map(), desenhos = new Map();
  const corDe = cor => { let i = indiceDa.get(cor); if (i === undefined) { i = cores.length; cores.push(cor); indiceDa.set(cor, i); } return i; };
  // Estado de quem solta: a cabeça (as partículas relativas andam com ela), o
  // resto fracionário de cada taxa, a distância das pegadas e os relógios.
  const donos = new Map();
  function donoDe(chave, emissores) {
    let d = donos.get(chave);
    if (!d) { d = { x: 0, y: 0, resto: new Float32Array(emissores), andou: 0, lado: 1, relogio: 0, fase: NaN, visto: 0 }; donos.set(chave, d); }
    return d;
  }

  function soltar(tipo, x, y, vx, vy, vida, tam, cor, dono = NaN, rot = 0, ay = 0) {
    if (n >= capacidade) return false;
    const i = n++;
    X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy; AY[i] = ay; VIDA[i] = TOTAL[i] = vida; TAM[i] = tam;
    ROT[i] = rot; VROT[i] = (Math.random() - .5) * 6; FASE[i] = Math.random() * TAU; K[i] = tipo;
    VAR[i] = Math.floor(Math.random() * (TIPOS[tipo].variantes ?? 1)); COR[i] = cor; VIROU[i] = 0; DONO[i] = dono;
    return true;
  }

  // `corpo` é a cobra medida pelo desenho: raio, comprimento, cabeça, rumo, o
  // ponto a uma distância da cabeça (`em`) e se ele está na tela (`aparece`).
  // `vel` é quanto a cobra anda por segundo, e `tempo` o relógio do desenho.
  function emitir(chave, skinId, corpo, dt) {
    const lista = EFEITOS[skinId];
    if (!lista || dt <= 0) return;
    const { r, L, hx, hy, angle, vel, tempo, boost, fracao } = corpo;
    const dono = donoDe(chave, lista.length);
    dono.x = hx; dono.y = hy; dono.visto = agora;
    const fx = Math.cos(angle), fy = Math.sin(angle);
    for (let e = 0; e < lista.length; e++) {
      const em = lista[e], tipo = TIPO[em.tipo];
      if (em.so === 'boost' && !boost) continue;
      if (em.onde === 'passo') {
        dono.andou += vel * dt;
        while (dono.andou >= em.passo * r) {
          dono.andou -= em.passo * r; dono.lado = -dono.lado;
          const nx = -fy * dono.lado * r * em.afasta, ny = fx * dono.lado * r * em.afasta;
          soltar(tipo, hx - fx * r * .3 + nx, hy - fy * r * .3 + ny, 0, 0, vidaDe(em), tamDe(em, r), corDe(sorteio(em.cores)), NaN, angle + Math.PI / 2);
        }
        continue;
      }
      if (em.onde === 'ciclo') {
        dono.relogio += dt;
        if (dono.relogio >= em.periodo) {
          dono.relogio %= em.periodo;
          soltar(tipo, 0, 0, 0, 0, vidaDe(em), tamDe(em, r), corDe(sorteio(em.cores)), chave);
        }
        continue;
      }
      if (em.onde === 'pulso') {
        // No pico do brilho da skin de pulso, que respira com sen(2,4·t). A
        // primeira passada só acerta a fase, para não soltar um anel fora do pico.
        const fase = Math.floor((tempo * 2.4 - Math.PI / 2) / TAU);
        if (fase !== dono.fase) {
          if (!Number.isNaN(dono.fase)) soltar(tipo, 0, 0, 0, 0, vidaDe(em), tamDe(em, r), corDe(sorteio(em.cores)), chave);
          dono.fase = fase;
        }
        continue;
      }
      // Emissão contínua: o resto fracionário fica guardado, então uma taxa
      // baixa solta no ritmo certo em vez de piscar ao acaso.
      const fator = em.onde === 'corpo' ? Math.min(3, Math.max(.35, L * fracao / 400)) : 1;
      dono.resto[e] += em.taxa * fator * dt;
      let quantas = Math.min(8, Math.floor(dono.resto[e]));
      dono.resto[e] -= Math.floor(dono.resto[e]);
      while (quantas-- > 0) {
        if (em.onde === 'orbita') {
          const a = Math.random() * TAU, raio = r * em.raio * entre(.8, 1.15);
          soltar(tipo, Math.cos(a) * raio, Math.sin(a) * raio, 0, 0, vidaDe(em), tamDe(em, r), corDe(sorteio(em.cores)), chave);
          continue;
        }
        if (em.onde === 'cabeca' || em.onde === 'narinas') {
          let px = hx + fx * r * .9, py = hy + fy * r * .9;
          if (em.onde === 'narinas') { const lado = Math.random() < .5 ? -1 : 1; px += -fy * lado * r * .35; py += fx * lado * r * .35; }
          const a = angle + (Math.random() - .5) * 2 * (em.espalha ?? .3), v = (em.vel ?? 0) * r;
          soltar(tipo, px, py, Math.cos(a) * v + fx * vel * .6, Math.sin(a) * v + fy * vel * .6, vidaDe(em), tamDe(em, r), corDe(sorteio(em.cores)));
          continue;
        }
        // Ponto da carne à vista: até três tentativas de cair num trecho na tela.
        let d = Math.max(0, L - r * .2), achou = em.onde === 'cauda' && corpo.aparece(d);
        if (em.onde === 'corpo') for (let t = 0; t < 3 && !achou; t++) { d = entre(r * .8, Math.max(r, L - r * .3)); achou = corpo.aparece(d); }
        if (!achou) continue;
        const p = corpo.em(d), nx = -p.ty, ny = p.tx;
        let lado, corFixa = -1;
        if (em.faixas) { const k = Math.floor(Math.random() * em.faixas.length); lado = em.faixas[k] * r; corFixa = corDe(em.cores[k]); }
        else lado = (em.lado ? entre(em.lado[0], em.lado[1]) : 0) * r * (Math.random() < .5 ? -1 : 1);
        const sinal = lado >= 0 ? 1 : -1, v = (em.vel ?? 0) * r * entre(.6, 1.2);
        let vx = nx * sinal * v + (Math.random() - .5) * r * .4, vy = ny * sinal * v + (Math.random() - .5) * r * .4;
        // `segue`: anda ao longo do corpo, para a cabeça, mais rápido que a cobra.
        if (em.segue) { vx = p.tx * vel * em.segue; vy = p.ty * vel * em.segue; }
        if (em.eixo) {
          // Trilha de circuito: sai num dos quatro rumos retos.
          const q = Math.floor(Math.random() * 4) * Math.PI / 2;
          vx = Math.cos(q) * v; vy = Math.sin(q) * v;
        }
        const ay = -(em.sobe ?? 0) * r;
        soltar(tipo, p.x + nx * lado, p.y + ny * lado, vx, vy, vidaDe(em), tamDe(em, r), corFixa >= 0 ? corFixa : corDe(sorteio(em.cores)), NaN, Math.random() * TAU, ay);
      }
    }
  }

  // `vento` é o chão andando: na prévia a câmera segue a cobra e o chão
  // escorre para trás, então a partícula solta no chão escorre junto.
  function atualizar(dt, ventoX = 0, ventoY = 0) {
    if (!(dt > 0)) return;
    agora += dt;
    for (let i = 0; i < n; i++) {
      VIDA[i] -= dt;
      if (VIDA[i] <= 0) {
        // Troca com a última: o vetor fica sempre compacto, sem buracos.
        n--;
        if (i < n) {
          X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n]; AY[i] = AY[n]; VIDA[i] = VIDA[n]; TOTAL[i] = TOTAL[n];
          TAM[i] = TAM[n]; ROT[i] = ROT[n]; VROT[i] = VROT[n]; FASE[i] = FASE[n]; K[i] = K[n]; VAR[i] = VAR[n];
          COR[i] = COR[n]; VIROU[i] = VIROU[n]; DONO[i] = DONO[n];
          i--;
        }
        continue;
      }
      const tipo = TIPOS[K[i]];
      if (tipo.espiral) {
        // Matéria caindo no horizonte: gira cada vez mais rápido e se aproxima.
        // O tamanho da partícula é proporcional ao raio de quem a soltou, e
        // serve de régua: o giro é de 2,75 rad/s no anel de quatro raios e
        // cresce na razão inversa da distância.
        const d = Math.hypot(X[i], Y[i]) || 1, w = Math.min(14, 55 * TAM[i] / d);
        const c = Math.cos(w * dt), s = Math.sin(w * dt), k = 1 - Math.min(.5, 1.7 * dt);
        const x = (X[i] * c - Y[i] * s) * k, y = (X[i] * s + Y[i] * c) * k;
        VX[i] = (x - X[i]) / dt; VY[i] = (y - Y[i]) / dt; X[i] = x; Y[i] = y;
        continue;
      }
      if (tipo.relativo) continue;
      if (tipo.quina && !VIROU[i] && VIDA[i] < TOTAL[i] / 2) {
        // A trilha do circuito dobra em ângulo reto no meio do caminho.
        const lado = FASE[i] > Math.PI ? 1 : -1, vx = VX[i];
        VX[i] = -VY[i] * lado; VY[i] = vx * lado; VIROU[i] = 1;
      }
      if (tipo.arrasto) { const f = Math.exp(-tipo.arrasto * dt); VX[i] *= f; VY[i] *= f; }
      VY[i] += AY[i] * dt;
      X[i] += (VX[i] + ventoX) * dt; Y[i] += (VY[i] + ventoY) * dt;
      if (tipo.oscila) X[i] += Math.sin(FASE[i] + agora * 6) * TAM[i] * 1.6 * dt;
      ROT[i] += VROT[i] * dt;
    }
    // Quem não aparece há três segundos sai da lista de donos.
    if (donos.size > 64 || Math.floor(agora) !== Math.floor(agora - dt)) {
      for (const [chave, d] of donos) if (agora - d.visto > 3) donos.delete(chave);
    }
  }

  function desenho(t, cor, variante, escuro) {
    const chave = t.desenho + '|' + cor + '|' + variante + '|' + escuro;
    let tela = desenhos.get(chave);
    if (!tela) {
      tela = document.createElement('canvas'); tela.width = tela.height = 32;
      const tom = escuro ? cores[cor] : escurecer(cores[cor], .38);
      PINTURAS[t.desenho](tela.getContext('2d'), tom, variante, escuro ? '#ffffff' : tom);
      desenhos.set(chave, tela);
    }
    return tela;
  }

  // Desenha uma camada: `chao` vai antes das cobras, `ar` depois. As que somam
  // luz saem numa passada só em modo `lighter`; no tema claro somar luz num
  // fundo claro não aparece, e todas saem na passada normal.
  function desenhar(c, camada, { escuro = true, vista = null } = {}) {
    if (!n) return;
    const chao = camada === 'chao', base = c.getTransform();
    for (const luz of escuro ? [false, true] : [false]) {
      c.globalCompositeOperation = luz ? 'lighter' : 'source-over';
      let girou = false;
      for (let i = 0; i < n; i++) {
        const t = TIPOS[K[i]];
        if (!!t.chao !== chao || (escuro && !!t.luz) !== luz) continue;
        const vida = 1 - VIDA[i] / TOTAL[i], alfa = curvas[K[i]](vida, FASE[i]) * (t.alfa ?? 1);
        if (alfa <= .02) continue;
        const tam = TAM[i] * (1 + ((t.cresce ?? 1) - 1) * vida);
        let x = X[i], y = Y[i];
        if (t.relativo) { const d = donos.get(DONO[i]); if (!d) continue; x += d.x; y += d.y; }
        if (vista && (x < vista.left - tam * 3 || x > vista.right + tam * 3 || y < vista.top - tam * 3 || y > vista.bottom + tam * 3)) continue;
        if (t.grade) { x = Math.round(x / tam) * tam; y = Math.round(y / tam) * tam; }
        c.globalAlpha = Math.min(1, alfa);
        const tela = desenho(t, COR[i], VAR[i], escuro);
        if (t.gira || t.alinha) {
          // Matriz da partícula composta com a da câmera, sem save/restore.
          const a = t.alinha ? Math.atan2(VY[i], VX[i]) : ROT[i];
          const sx = t.vira ? Math.cos(ROT[i] * 1.7) : (t.estica ?? 1);
          const cs = Math.cos(a), sn = Math.sin(a);
          const la = cs * sx, lb = sn * sx, lc = -sn, ld = cs;
          c.setTransform(base.a * la + base.c * lb, base.b * la + base.d * lb, base.a * lc + base.c * ld, base.b * lc + base.d * ld,
            base.a * x + base.c * y + base.e, base.b * x + base.d * y + base.f);
          c.drawImage(tela, -tam, -tam, tam * 2, tam * 2);
          girou = true;
        } else {
          if (girou) { c.setTransform(base); girou = false; }
          c.drawImage(tela, x - tam, y - tam, tam * 2, tam * 2);
        }
      }
      if (girou) c.setTransform(base);
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }

  return {
    emitir, atualizar, desenhar,
    limpar() { n = 0; donos.clear(); },
    get total() { return n; },
    capacidade
  };
}
