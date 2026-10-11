import { ARENA, skinFor } from './config.js';

const TAU = Math.PI * 2;
// A mesma pintura serve à arena e às prévias. Cada estampa é rasterizada uma
// única vez: sem shadowBlur nem gradiente por ponto do corpo durante a partida.
const stamps = new Map();
function stampFor(skin) {
  if (stamps.has(skin.id)) return stamps.get(skin.id);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'); g.translate(32, 32);
  g.fillStyle = g.strokeStyle = skin.detail; g.lineWidth = 3;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = points => { g.beginPath(); points.forEach(([x,y], i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke(); };
  const dot = (x,y,r) => { g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); };
  switch (skin.pattern) {
    case 'ribbon': g.globalAlpha = .62; g.fillRect(-18,-5,36,4); break;
    case 'rings': g.lineWidth = 4; line([[0,-24],[0,24]]); break;
    case 'chevron': line([[-9,-23],[7,0],[-9,23]]); break;
    case 'wave':
      g.beginPath(); g.moveTo(-18,-8); g.bezierCurveTo(-3,-23,3,23,18,8); g.stroke(); break;
    case 'confetti': dot(-8,-10,4); dot(10,9,3); g.fillRect(-7,6,6,6); break;
    case 'facets':
      g.globalAlpha = .72; g.beginPath(); g.moveTo(-16,-20); g.lineTo(15,0); g.lineTo(-16,20); g.closePath(); g.fill();
      g.strokeStyle = '#3b82ac'; g.lineWidth = 1.5; line([[-16,-20],[15,0],[-16,20]]); break;
    case 'tiger':
      for (const side of [-1,1]) { g.beginPath(); g.moveTo(-12,side*25); g.lineTo(2,side*3); g.lineTo(8,side*25); g.closePath(); g.fill(); } break;
    case 'spots':
      g.beginPath(); g.ellipse(-5,-9,12,10,.5,0,TAU); g.ellipse(9,12,7,8,0,0,TAU); g.fill();
      g.fillStyle = '#4c4348'; dot(13,-17,3); break;
    case 'circuit':
      g.lineWidth = 2.5; line([[-18,0],[-6,0],[2,-12],[18,-12]]); line([[0,4],[7,14],[17,14]]);
      dot(3,-12,3); dot(7,14,3); break;
    case 'pixels': g.fillRect(-11,-17,11,11); g.fillRect(0,-6,11,11); g.fillStyle='#e0b7ff'; g.fillRect(-11,5,11,11); break;
    case 'cracks': line([[-10,-25],[0,-11],[-5,2],[10,13],[6,25]]); g.lineWidth = 2; line([[-5,2],[-18,9]]); break;
    case 'scales':
      g.lineWidth = 2; for (const y of [-14,0,14]) line([[-9,y-7],[0,y],[9,y-7]]); break;
    case 'stars':
      line([[-7,-16],[-7,-4]]); line([[-13,-10],[-1,-10]]); dot(10,10,2.8); dot(-12,17,1.8); break;
    case 'diamonds':
      g.beginPath(); g.moveTo(0,-11); g.lineTo(8,0); g.lineTo(0,11); g.lineTo(-8,0); g.closePath(); g.fill();
      dot(0,-21,2); dot(0,21,2); break;
    case 'runas':
      g.lineWidth = 2.5;
      line([[-10,-20],[-10,-4],[-2,-12]]); line([[-10,-12],[-18,-20]]);
      line([[6,20],[6,2],[14,10]]); line([[6,10],[-2,2]]);
      dot(-14,10,2.6); break;
    case 'favo':
      g.lineWidth = 2; g.globalAlpha = .8;
      for (const [cx,cy] of [[0,-14],[0,14],[-14,0],[14,0]]) {
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * TAU / 6 + Math.PI / 6, x = cx + Math.cos(a) * 9, y = cy + Math.sin(a) * 9;
          k ? g.lineTo(x,y) : g.moveTo(x,y);
        }
        g.closePath(); g.stroke();
      } break;
    case 'olhos':
      // Ocelo: o desenho de olho que serpente de verdade usa para assustar.
      for (const [cx,cy] of [[-3,-13],[5,13]]) {
        g.globalAlpha = .85; dot(cx,cy,10);
        g.globalAlpha = 1; g.fillStyle = '#0d1420'; dot(cx,cy,5.2);
        g.fillStyle = skin.detail;
      } break;
  }
  stamps.set(skin.id, canvas); return canvas;
}

// Passo de amostragem do corpo, ancorado no número de série. Os números são
// consecutivos ao longo do corpo, então `i ≡ base (mod passo)` escolhe sempre
// os mesmos pontos do chão: a silhueta é traçada pelos mesmos vértices em todo
// quadro e não treme quando nasce um ponto novo na cabeça.
function primeiro(path, passo, minimo) {
  const base = path[0]?.n ?? 0;
  let i = (((base % passo) + passo) % passo);
  while (i < minimo) i += passo;
  return i;
}

// Luz da arena, a mesma para toda cobra e para as prévias: vem de cima e um
// pouco da esquerda. É o vetor que aponta do corpo para a lâmpada, na tela.
// Com a câmera olhando de cima, um tubo deitado no chão tem o brilho deslocado
// para o lado da luz e a sombra para o lado oposto. Esse deslocamento pode ser
// uma translação fixa do traço inteiro: o que dela cai ao longo do corpo não se
// vê, e o que cai de través é justamente o que a luz faz num cilindro.
const LUZ_X = -.47, LUZ_Y = -.88;

// Corpo medido da cabeça para a cauda: `CX`/`CY` são os vértices e `CD` a
// distância de cada um até a cabeça, ao longo da carne. É nessa distância que a
// pele fica presa: faixa, escama e estampa ficam a um tanto fixo da cabeça e
// andam com ela. Presas aos pontos do caminho, que ficam parados no chão, elas
// ficavam pintadas por onde a cabeça tinha passado, e o corpo é que deslizava
// por baixo delas — o rastro de pincel. Medida a partir da cabeça, a pele é a
// mesma em todo quadro, e o que o crescimento acrescenta aparece na cauda.
// Os buffers são reaproveitados: uma cobra termina de ser desenhada antes de a
// próxima começar. `XMIN`…`YMAX` é a caixa do corpo.
let CX = new Float64Array(1024), CY = new Float64Array(1024), CD = new Float64Array(1024);
let N = 0, VISTA = null, XMIN = 0, XMAX = 0, YMIN = 0, YMAX = 0;
const PONTO = { x: 0, y: 0, tx: 1, ty: 0 };

function medir(path, hx, hy) {
  if (CX.length < path.length + 1) {
    const n = (path.length + 1) * 2;
    CX = new Float64Array(n); CY = new Float64Array(n); CD = new Float64Array(n);
  }
  CX[0] = hx; CY[0] = hy; CD[0] = 0; N = 1;
  XMIN = XMAX = hx; YMIN = YMAX = hy;
  let d = 0, ax = hx, ay = hy;
  for (let i = 1; i < path.length; i++) {
    const p = path[i], x = p.x, y = p.y;
    d += Math.hypot(x - ax, y - ay);
    CX[N] = x; CY[N] = y; CD[N] = d; N++;
    if (x < XMIN) XMIN = x; else if (x > XMAX) XMAX = x;
    if (y < YMIN) YMIN = y; else if (y > YMAX) YMAX = y;
    ax = x; ay = y;
  }
}
// Último vértice que está a no máximo `d` da cabeça.
function indice(d) {
  let lo = 0, hi = N - 2;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (CD[m] <= d) lo = m; else hi = m - 1; }
  return Math.max(0, lo);
}
// Encurta o corpo medido para `L`, com a ponta interpolada no trecho.
function cortar(L) {
  if (N < 2 || L >= CD[N - 1]) return;
  const k = indice(Math.max(0, L)), seg = CD[k + 1] - CD[k], t = seg > 0 ? Math.max(0, L - CD[k]) / seg : 0;
  CX[k + 1] = CX[k] + (CX[k + 1] - CX[k]) * t; CY[k + 1] = CY[k] + (CY[k + 1] - CY[k]) * t;
  CD[k + 1] = CD[k] + seg * t; N = k + 2;
}
// Ponto da carne a `d` da cabeça e o rumo do corpo ali, apontando para a
// cabeça. O rumo sai das direções dos vértices vizinhos, interpoladas: pela
// direção crua de cada trecho a escama giraria aos saltos ao trocar de trecho
// numa curva — nove graus por vértice na curva mais fechada do jogo.
function em(d) {
  const k = indice(d), seg = CD[k + 1] - CD[k];
  const t = seg > 0 ? Math.min(1, Math.max(0, (d - CD[k]) / seg)) : 0;
  PONTO.x = CX[k] + (CX[k + 1] - CX[k]) * t; PONTO.y = CY[k] + (CY[k + 1] - CY[k]) * t;
  const a0 = Math.max(0, k - 1), b1 = Math.min(N - 1, k + 2);
  const ax = CX[a0] - CX[k + 1], ay = CY[a0] - CY[k + 1], bx = CX[k] - CX[b1], by = CY[k] - CY[b1];
  const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
  const tx = ax / la * (1 - t) + bx / lb * t, ty = ay / la * (1 - t) + by / lb * t, l = Math.hypot(tx, ty) || 1;
  PONTO.tx = tx / l; PONTO.ty = ty / l;
  return PONTO;
}
const visto = (ax, ay, bx, by, m) => !VISTA
  || Math.max(ax, bx) >= VISTA.left - m && Math.min(ax, bx) <= VISTA.right + m
  && Math.max(ay, by) >= VISTA.top - m && Math.min(ay, by) <= VISTA.bottom + m;

// Vértices do traço, amostrados uma vez por quadro: a cabeça, um a cada
// `passo` pontos a partir de `k0` e a ponta da cauda, com a visibilidade de
// cada trecho já conferida. Toda camada percorre esta lista curta. Refazer a
// amostragem e a conta da vista ponto a ponto em cada uma das camadas dobrava
// o custo do desenho.
//
// `AG` marca os vértices do traço grosso, um sim e um não, que as camadas
// macias usam: sombra e degradê não têm borda nítida que denuncie a corda mais
// longa, e com metade dos vértices custam metade. A escolha é pelo número de
// série, e não pela posição na lista, para os vértices não trocarem de um
// quadro para o outro quando nasce um ponto na cabeça.
let AX = new Float64Array(512), AY = new Float64Array(512), AD = new Float64Array(512);
let AV = new Uint8Array(512), AG = new Uint8Array(512), M = 0;
function amostrar(path, k0, passo, m) {
  if (AX.length < N + 2) {
    const n = (N + 2) * 2;
    AX = new Float64Array(n); AY = new Float64Array(n); AD = new Float64Array(n); AV = new Uint8Array(n); AG = new Uint8Array(n);
  }
  AX[0] = CX[0]; AY[0] = CY[0]; AD[0] = 0; AG[0] = 1; M = 1;
  for (let j = k0; j < N - 1; j += passo) {
    AX[M] = CX[j]; AY[M] = CY[j]; AD[M] = CD[j];
    AG[M] = (Math.round((path[j].n ?? -j) / passo) & 1) === 0 ? 1 : 0; M++;
  }
  if (N > 1) { AX[M] = CX[N - 1]; AY[M] = CY[N - 1]; AD[M] = CD[N - 1]; AG[M] = 1; M++; }
  for (let s = 0; s < M - 1; s++) AV[s] = visto(AX[s], AY[s], AX[s + 1], AY[s + 1], m) ? 1 : 0;
}
// O corpo inteiro pelo traço grosso, deslocado de `ox`/`oy`. Um trecho grosso
// aparece se algum dos finos que ele cobre aparece.
function grosso(c, ox, oy) {
  let a = 0, pen = false;
  for (let i = 1; i < M; i++) {
    if (!AG[i]) continue;
    let v = 0;
    for (let s = a; s < i; s++) v |= AV[s];
    if (v) { if (!pen) c.moveTo(AX[a] + ox, AY[a] + oy); c.lineTo(AX[i] + ox, AY[i] + oy); pen = true; } else pen = false;
    a = i;
  }
}
// Põe no caminho atual o corpo entre as distâncias `d0` e `d1`, deslocado de
// `ox`/`oy`. As pontas são interpoladas: a borda de uma faixa cai no lugar exato
// da carne, e não no vértice mais próximo, que é o que a faria tremer ao andar.
function trecho(c, d0, d1, ox, oy) {
  if (d1 > AD[M - 1]) d1 = AD[M - 1];
  if (d1 <= d0) return;
  let lo = 0, hi = M - 2;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (AD[m] <= d0) lo = m; else hi = m - 1; }
  let s = lo, t = (d0 - AD[s]) / (AD[s + 1] - AD[s] || 1);
  let ax = AX[s] + (AX[s + 1] - AX[s]) * t, ay = AY[s] + (AY[s + 1] - AY[s]) * t, pen = false;
  for (; s < M - 1; s++) {
    const fim = AD[s + 1] >= d1;
    let bx = AX[s + 1], by = AY[s + 1];
    if (fim) { t = (d1 - AD[s]) / (AD[s + 1] - AD[s] || 1); bx = AX[s] + (AX[s + 1] - AX[s]) * t; by = AY[s] + (AY[s + 1] - AY[s]) * t; }
    if (AV[s]) { if (!pen) c.moveTo(ax + ox, ay + oy); c.lineTo(bx + ox, by + oy); pen = true; } else pen = false;
    if (fim) return;
    ax = bx; ay = by;
  }
}

// Sombra no chão, antes de tudo. Uma faixa escura rente ao corpo inteiro, que é
// o que assenta a cobra na arena, e a sombra projetada para o lado oposto ao da
// luz, encostada nele. Juntas, leem como um corpo deitado deslizando sobre o
// piso, em vez de uma tinta aplicada nele.
function sombra(c, { r, L, forca }) {
  c.strokeStyle = '#02060c';
  c.globalAlpha = .16 * forca; c.lineWidth = r * 2 + Math.max(3, r * .45);
  c.beginPath(); grosso(c, -LUZ_X * r * .12, -LUZ_Y * r * .12); c.stroke();
  const longe = r * .34 + 1.5;
  c.globalAlpha = .28 * forca; c.lineWidth = r * 2;
  c.beginPath(); grosso(c, -LUZ_X * longe, -LUZ_Y * longe); c.stroke();
}

// Volume do tubo, por cima da pele: a luz cai sobre a pele toda, estampa
// incluída. Dois traços escuros afastados da luz fazem o degradê do lado na
// sombra; um claro largo e um reflexo fino, o lado aceso. Um traço deslocado de
// `o` com largura `w` não vaza do corpo enquanto `o + w/2` fica abaixo do raio,
// e todos aqui param em 0,97 dele — inclusive nas pontas arredondadas.
function volume(c, { r, L, escala, escuro, claro }) {
  c.strokeStyle = '#02070e';
  c.globalAlpha = .2 * escuro; c.lineWidth = r * .9;
  c.beginPath(); grosso(c, -LUZ_X * r * .52, -LUZ_Y * r * .52); c.stroke();
  c.globalAlpha = .18 * escuro; c.lineWidth = r * .46;
  c.beginPath(); grosso(c, -LUZ_X * r * .74, -LUZ_Y * r * .74); c.stroke();
  c.strokeStyle = '#ffffff';
  // O claro largo só aparece com o corpo grosso na tela; fino, o reflexo basta.
  if (r * escala >= 6) {
    c.globalAlpha = .1 * claro; c.lineWidth = r * .8;
    c.beginPath(); grosso(c, LUZ_X * r * .3, LUZ_Y * r * .3); c.stroke();
  }
  c.globalAlpha = .3 * claro; c.lineWidth = Math.max(1, r * .2);
  c.beginPath(); trecho(c, 0, L, LUZ_X * r * .46, LUZ_Y * r * .46); c.stroke();
}

// Fileiras de escamas atravessando o corpo. Cada fileira é desenhada no
// referencial local da carne — `t` ao longo do corpo, `nx`/`ny` cruzando —, por
// isso a escama acompanha a curva em vez de ficar chapada. As fileiras vêm
// alternadas, como na pele de uma cobra de verdade, e ficam a distâncias fixas
// da cabeça: a escama é da cobra, não do chão por onde ela passa.
const SCALE_ROWS = [-.62, 0, .62];
function scales(c, { r, L, scale }) {
  // Escama menor que uns poucos pixels na tela não aparece, só custa. Uma cobra
  // pequena ao longe pula a textura inteira sem diferença visível.
  const naTela = r * scale;
  if (naTela < 5) return;
  // Uma fileira a cada meio raio: mais espaçado vira listra, mais junto vira borrão.
  const step = r * .55, largura = r * .34, fundo = r * .3;
  // Sulco e brilho saem em dois traços só, um para cada tom do relevo.
  const camadas = [['#0a141e40', Math.max(.8, r * .13), 0]];
  if (naTela >= 11) camadas.push(['#ffffff20', Math.max(.6, r * .09), -r * .1]);
  // A última fileira para antes da ponta, onde o corpo já arredonda.
  const ultima = L - r * .7;
  for (const [tom, espessura, recuo] of camadas) {
    c.strokeStyle = tom; c.lineWidth = espessura; c.beginPath();
    // As fileiras andam em ordem da cabeça para a cauda, e o trecho amostrado
    // que contém cada uma diz se ela está na tela antes de qualquer conta.
    for (let k = 1, s = 0; k * step < ultima; k++) {
      const d = k * step;
      while (s < M - 2 && AD[s + 1] < d) s++;
      if (!AV[s]) continue;
      const p = em(d);
      const tx = p.tx, ty = p.ty, nx = -ty, ny = tx;
      // Fileiras ímpares deslocadas meia escama: o encaixe é o que lê como pele.
      const desloca = k % 2 ? largura : 0;
      for (const linha of SCALE_ROWS) {
        const meio = linha * r + desloca;
        if (Math.abs(meio) > r * .92) continue;
        const ax = meio - largura, bx = meio + largura;
        // Arco abrindo para a cauda: a ponta da escama aponta para trás.
        c.moveTo(p.x + nx * ax + tx * recuo, p.y + ny * ax + ty * recuo);
        c.quadraticCurveTo(
          p.x + nx * meio - tx * (fundo - recuo), p.y + ny * meio - ty * (fundo - recuo),
          p.x + nx * bx + tx * recuo, p.y + ny * bx + ty * recuo);
      }
    }
    c.stroke();
  }
}

// Traço que corre ao longo do corpo, deslocado para o lado. Toda estampa da
// coleção ou atravessa a cobra (escama, galão, anel) ou divide o comprimento em
// faixas de cor; nenhuma corria da cabeça à cauda. O deslocamento sai da normal
// de cada trecho, então a listra acompanha a curva em vez de ficar reta. Não
// forma bico nas curvas fechadas porque o deslocamento é no máximo o raio e o
// raio de curva é sempre `24 + raio`, maior que ele.
function longitudinal(c, offset) {
  c.beginPath();
  let pen = false;
  for (let s = 0; s < M - 1; s++) {
    const ax = AX[s], ay = AY[s], bx = AX[s + 1], by = AY[s + 1];
    let tx = bx - ax, ty = by - ay;
    const comp = Math.hypot(tx, ty) || 1; tx /= comp; ty /= comp;
    const nx = -ty * offset, ny = tx * offset;
    if (AV[s]) {
      if (!pen) c.moveTo(ax + nx, ay + ny);
      c.lineTo(bx + nx, by + ny); pen = true;
    } else pen = false;
  }
  c.stroke();
}

// Halo neon somado por cima do corpo. `shadowBlur` daria o borrão de graça mas
// custa caro demais por quadro, então o brilho sai de traços largos e fracos em
// modo `lighter`: cada camada soma luz e o degrau entre elas lê como difusão.
// Duas camadas bastam; a terceira não muda nada que o olho note.
function halo(c, { r, L, cor, forca, boost }) {
  const camadas = boost
    ? [[r * 2 + 26, .1 * forca], [r * 2 + 12, .17 * forca]]
    : [[r * 2 + 13, .07 * forca], [r * 2 + 6, .12 * forca]];
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = cor;
  for (const [largura, alfa] of camadas) {
    c.globalAlpha = alfa; c.lineWidth = largura;
    c.beginPath(); trecho(c, 0, L, 0, 0); c.stroke();
  }
  c.restore();
}

// Borrão da aceleração: um rastro curto e claro logo atrás da cabeça, que vai
// sumindo. É o que dá a leitura de velocidade sem mexer no corpo inteiro.
function rastro(c, path, { r, cor }) {
  const quanto = Math.min(path.length - 1, 16);
  if (quanto < 5) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = cor; c.lineCap = 'round';
  let a = path[1];
  for (let i = 2; i <= quanto; i++) {
    const b = path[i], t = (i - 2) / (quanto - 2);
    // O brilho acende logo atrás da cabeça e some na cauda. Começar nela lavava
    // a cabeça de branco e engolia os olhos.
    if (visto(a.x, a.y, b.x, b.y, r * 3)) {
      c.globalAlpha = .26 * Math.min(1, t * 4) * (1 - t) ** 1.6;
      c.lineWidth = r * (1.9 + (1 - t) * 1.2);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    a = b;
  }
  c.restore();
}

// Mistura de duas cores `#rrggbb` na fração `k`, guardada: a cabeça pede três
// tons por quadro e a skin não muda.
const tons = new Map();
function tom(cor, alvo, k) {
  const chave = cor + alvo + k;
  let pronto = tons.get(chave);
  if (pronto) return pronto;
  const a = parseInt(cor.slice(1, 7), 16), b = parseInt(alvo.slice(1, 7), 16);
  const canal = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  pronto = '#' + ((1 << 24) | (canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).slice(1);
  tons.set(chave, pronto);
  return pronto;
}

// `length` encurta o corpo desenhado. `points` é quantos pontos o modelo guarda
// com o corpo cheio, e serve para a ponta da cauda andar lisa: o modelo solta o
// último ponto de uma vez quando nasce um na cabeça, e a cauda desenhada até ele
// andava aos saltos de um espaçamento, trinta vezes por segundo. Com o corpo
// cheio, o comprimento desenhado é o dos trechos já assentados — sem o trecho da
// cabeça, que cresce e zera a cada ponto novo —, e a ponta escorre junto com a
// cabeça. Crescendo, o corpo ainda não chegou a esse tanto: a cauda fica parada
// onde está e a carne nova aparece por ela.
export function drawSnake(c, snake, { radius = 10, alpha = 1, bounds = null, details = true, pointSpacing = ARENA.spacing, scale = 1, time = 0, length = Infinity, points = 0 } = {}) {
  const skin = skinFor(snake.skin), path = snake.path;
  if (!path?.length) return;
  const hx = (snake.px ?? snake.x) + (snake.x - (snake.px ?? snake.x)) * alpha;
  const hy = (snake.py ?? snake.y) + (snake.y - (snake.py ?? snake.y)) * alpha;
  const r = radius, colors = skin.colors;
  VISTA = bounds;
  // Cobra fora da tela não custa nada. Primeiro pela cabeça: o corpo nunca vai
  // além de um ponto por espaçamento dela. Depois pela caixa do corpo medido.
  // Folga de três raios, que cobre halo, sombra e cabeça.
  const folga = r * 3 + 30;
  if (bounds && points) {
    const alcance = (points + 1) * pointSpacing + folga;
    if (hx < bounds.left - alcance || hx > bounds.right + alcance || hy < bounds.top - alcance || hy > bounds.bottom + alcance) return;
  }
  medir(path, hx, hy);
  if (bounds && (XMAX < bounds.left - folga || XMIN > bounds.right + folga || YMAX < bounds.top - folga || YMIN > bounds.bottom + folga)) return;
  if (points > 2 && N > 2) cortar(Math.min(length, (points - 2) * (CD[N - 1] - CD[1]) / (N - 2)));
  else cortar(length);
  const L = CD[N - 1], corpo = N > 1 && L > 0;
  // Quantos pontos do corpo o traço precisa de fato. No piso do zoom os pontos
  // ficam a 1,7 px um do outro, e vértice mais junto que isso não muda a
  // silhueta: o desvio de uma corda de `d` px num arco de raio `R` é d²/8R, o
  // que aqui dá fração de pixel. É o que mantém a cobra gigante dentro do
  // quadro — o corpo dela tem milhares de pontos e o traço passa por ele
  // várias vezes, uma por faixa de cor e uma por camada de luz.
  const passo = Math.max(1, Math.round(5 / Math.max(.001, pointSpacing * scale)));
  // A folga da vista de cada trecho cobre a camada mais larga: halo aceso.
  amostrar(path, primeiro(path, passo, 1), passo, r * 1.5 + 16);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // Brilho abaixo de uns poucos pixels na tela não aparece, só custa.
  const aceso = details && r * scale >= 4;
  // Proteção mantém a skin legível; o anel na cabeça explica seu estado.
  const opaco = snake.invulnerable > 0 ? .8 : 1;
  // Vidro: o corpo fica translúcido e a arena aparece através dele. Nenhuma
  // outra skin faz isso. O valor nunca chega perto de zero de propósito: skin
  // é sorteada para os rivais também, e um rival que mal se vê é injusto.
  const vidro = details && skin.glass ? skin.glass : 1;
  // Sombra e volume somem numa cobra de dois ou três pixels de espessura na
  // tela: ali eles só custariam. O vidro deixa passar parte da luz, e a sombra
  // dele no chão é mais fraca.
  const relevo = details && r * scale >= 2.5;
  if (corpo && relevo) sombra(c, { r, L, forca: opaco * (skin.glass ? .55 : 1) });
  if (corpo && aceso && (skin.glow || snake.boost)) {
    // Acelerar acende qualquer skin; as de identidade neon já vêm acesas.
    let forca = Math.max(skin.glow ?? 0, snake.boost ? .85 : 0);
    // Pulso: o brilho respira. É a única coisa na coleção que muda sozinha com
    // o tempo — as estampas são todas presas à carne e ficam paradas nela.
    if (skin.pulse) forca *= 1 - skin.pulse + skin.pulse * (.5 + .5 * Math.sin(time * 2.4));
    halo(c, { r, L, cor: skin.detail, forca, boost: snake.boost });
  }
  if (corpo) {
    c.globalAlpha = opaco * vidro;
    // Faixas de cor a distâncias fixas da cabeça. A largura acompanha o raio.
    const faixa = r * (colors.length > 3 ? 2.5 : 4);
    for (let band = -2; band < colors.length; band++) {
      if (band === -2) { c.strokeStyle = skin.detail + '66'; c.lineWidth = r * 2 + (snake.boost ? 10 : 2); }
      else if (band === -1) { c.strokeStyle = colors[1]; c.lineWidth = r * 2; }
      else { c.strokeStyle = colors[band]; c.lineWidth = r * 1.82; }
      c.beginPath();
      if (band < 0) trecho(c, 0, L, 0, 0);
      else for (let j = band; j * faixa < L; j += colors.length) trecho(c, j * faixa, (j + 1) * faixa, 0, 0);
      c.stroke();
    }
    if (details) scales(c, { r, L, scale });
    if (details && skin.pattern) {
      const stamp = stampFor(skin), gap = r * (skin.pattern === 'ribbon' ? 1.4 : 2);
      for (let k = 1, s = 0; k * gap < L - r * .8; k++) {
        const d = k * gap;
        while (s < M - 2 && AD[s + 1] < d) s++;
        if (!AV[s]) continue;
        const p = em(d);
        c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.ty, p.tx));
        c.drawImage(stamp, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4); c.restore();
      }
    }
    // Listras ao longo do corpo e bordas acesas do vidro, as duas do mesmo traço
    // longitudinal. Vêm depois de escama e estampa de propósito: no vidro essas
    // camadas também são translúcidas, senão elas tapam a transparência e o corpo
    // volta a parecer sólido. A borda é o que carrega a silhueta ali.
    c.globalAlpha = opaco;
    if (details && (skin.stripes || skin.glass)) {
      const faixas = skin.stripes ? skin.stripes.slice() : [];
      if (skin.glass) for (const lado of [-1, 1]) faixas.push([lado * .86, skin.detail, .17]);
      for (const [frac, cor, largura] of faixas) {
        c.strokeStyle = cor; c.lineWidth = Math.max(1, r * largura);
        longitudinal(c, r * frac);
      }
    }
    // No vidro o lado escuro também é translúcido; o reflexo, não: vidro brilha.
    if (relevo) volume(c, { r, L, escala: scale, escuro: opaco * vidro, claro: opaco });
    if (aceso && snake.boost) rastro(c, path, { r, cor: skin.detail });
  }
  if (visto(hx, hy, hx, hy, r * 3)) {
    // A cabeça nunca é translúcida: é por ela que se lê para onde a cobra vai,
    // e é ela que mata. Mesmo no vidro, ela fica cheia.
    c.globalAlpha = opaco;
    c.save(); c.translate(hx, hy); c.rotate(snake.angle);
    // A luz no referencial da cabeça, que gira com o rumo: o lado aceso fica
    // sempre para o mesmo lado da tela, como no corpo.
    const cs = Math.cos(snake.angle), sn = Math.sin(snake.angle);
    const lx = LUZ_X * cs + LUZ_Y * sn, ly = LUZ_Y * cs - LUZ_X * sn;
    const shine = c.createRadialGradient(lx * r * .42, ly * r * .42, r * .08, 0, 0, r * 1.22);
    shine.addColorStop(0, tom(colors[0], '#ffffff', .45));
    shine.addColorStop(.42, colors[0]);
    shine.addColorStop(1, tom(colors[0], '#000000', .45));
    c.fillStyle = shine; c.beginPath(); c.ellipse(0, 0, r * 1.17, r, 0, 0, TAU); c.fill();
    c.globalAlpha = opaco * .45; c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(lx * r * .5, ly * r * .5, r * .17, 0, TAU); c.fill();
    c.globalAlpha = opaco;
    if (skin.pattern === 'circuit' || skin.pattern === 'pixels') {
      c.fillStyle = '#071e2a'; c.fillRect(-r * .05, -r * .8, r * .82, r * 1.6);
      c.fillStyle = skin.detail; c.fillRect(r * .28, -r * .6, r * .3, r * .36); c.fillRect(r * .28, r * .24, r * .3, r * .36);
    } else for (const side of [-1, 1]) {
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(r * .32, side * r * .52, r * .4, r * .37, 0, 0, TAU); c.fill();
      c.fillStyle = '#13233b'; c.beginPath(); c.arc(r * .48, side * r * .52, r * .21, 0, TAU); c.fill();
      // O reflexo do olho também vem da lâmpada da arena.
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(r * .48 + lx * r * .1, side * r * .52 + ly * r * .1, r * .065, 0, TAU); c.fill();
    }
    if (snake.invulnerable > 0) {
      c.strokeStyle = skin.detail; c.lineWidth = 1.6; c.setLineDash([5, 5]);
      c.beginPath(); c.arc(0, 0, r + 7, 0, TAU); c.stroke();
    }
    c.restore();
  }
  c.restore();
}

// Corpo da prévia: a cobra nada por uma pista senoidal parada e a câmera só
// acompanha a cabeça na horizontal. Cada ponto vive numa posição `u` da pista;
// os assentados ficam em `u` inteiro e a cabeça em `u` contínuo, como o modelo
// faz na partida. A pista é o chão: ela escorre da cabeça para a cauda, e a
// pele, presa à cabeça como na arena, vai junto com a cobra.
const ONDAS = 1.04, PONTOS = 66, AMPLITUDE = 30, PASSO_X = 249 / PONTOS;
const ONDA = TAU * ONDAS / PONTOS;
// Ritmo da carne em pontos por segundo, tirado do cruzeiro do jogo: uma cobra
// deste porte anda `speed` por segundo e larga um ponto a cada `spacing`.
const RITMO = ARENA.speed / ARENA.spacing;

export function previewPath(time = 0) {
  const cabeca = time * RITMO, assentado = Math.floor(cabeca);
  // X acompanha a câmera e escorre sem degrau; Y é a pista, que não se mexe.
  // Quando a cabeça cruza um inteiro nasce um ponto e todos os índices andam
  // um, mas nenhum ponto muda de lugar na tela.
  const ponto = u => ({ x: 304 + (u - cabeca) * PASSO_X, y: 80 + Math.sin(u * ONDA) * AMPLITUDE, n: u });
  // `path[0]` fica na cabeça, como no modelo: o traço do corpo começa no 1.
  const path = [{ ...ponto(cabeca), n: assentado + 1 }];
  for (let i = 0; i <= PONTOS; i++) path.push(ponto(assentado - i));
  // Rumo pela tangente da pista. Pelo vetor até `path[1]` ele giraria: esse
  // ponto encosta na cabeça toda vez que um ponto novo está para nascer.
  const angle = Math.atan2(AMPLITUDE * ONDA * Math.cos(cabeca * ONDA), PASSO_X);
  // Comprimento da carne: da cabeça até a posição `cabeca - PONTOS` da pista,
  // pelos mesmos trechos retos que o desenho mede. Medido assim a ponta anda
  // com a cabeça, sem saltar um ponto inteiro quando a pista solta o último.
  let length = 0;
  for (let i = 1; i < path.length; i++) length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  const ultimo = path.at(-1), penultimo = path.at(-2);
  length -= Math.hypot(ultimo.x - penultimo.x, ultimo.y - penultimo.y) * (cabeca - assentado);
  return { path, angle, length };
}

export function drawSkinPreview(canvas, id, time = 0) {
  const c=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  c.clearRect(0,0,w,h); c.save(); c.scale(w/360,h/160);
  const skin=skinFor(id), halo=c.createRadialGradient(180,90,4,180,90,175);
  halo.addColorStop(0,skin.colors[0]+'22'); halo.addColorStop(1,skin.colors[0]+'00');
  c.fillStyle=halo; c.fillRect(0,0,360,160);
  // Chão: pontos presos à pista, escorrendo para trás no ritmo da cobra. Com a
  // pele presa ao corpo, é o chão que mostra que ela anda para a frente.
  const recuo = (time * RITMO * PASSO_X) % 40;
  c.fillStyle = '#6fd2c430';
  for (let x = 340 - recuo; x > 0; x -= 40) for (let y = 20; y < 160; y += 40) c.fillRect(x - 1, y - 1, 2, 2);
  const { path, angle, length } = previewPath(time), head = path[0];
  drawSnake(c,{...head,px:head.x,py:head.y,path,skin:id,angle}, {radius:14,pointSpacing:5,length});
  c.restore();
}
