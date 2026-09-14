import { EMPTY, BLOCK, drop, undo, legalMoves, landing, other, at } from './model.js';

// Busca com poda alfa-beta e aprofundamento iterativo com prazo. O prazo é o
// que mantém a jogada rápida em qualquer aparelho e em qualquer tabuleiro: em
// vez de fixar uma profundidade que trava num celular antigo, a busca desce o
// quanto der dentro do tempo e usa o melhor resultado completo que conseguiu.

const WIN = 1e6;
// Quanto uma ameaça perde de valor por cada peça que ainda falta cair embaixo
// dela. Calibrado por torneio entre os níveis.
export const TUNE = { reach: 0.7 };
export const LAST = { depth: 0, ms: 0 };

// Todas as janelas de `connect` casas em linha que ainda podem ser fechadas.
// Janela que contém bloqueio nunca fecha, então sai da conta — é isso que faz
// a avaliação entender a geometria das fases com obstáculo.
function windowsFor(board) {
  if (board.windows) return board.windows;
  const list = [];
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      for (const [dc, dr] of dirs) {
        const cells = [];
        let ok = true;
        for (let i = 0; i < board.connect; i++) {
          const c = col + dc * i, r = row + dr * i;
          if (c < 0 || c >= board.cols || r < 0 || r >= board.rows) { ok = false; break; }
          const index = r * board.cols + c;
          if (board.cells[index] === BLOCK) { ok = false; break; }
          cells.push(index);
        }
        if (ok) {
          const janela = Int16Array.from(cells);
          // Coluna (dr=1, dc=0) é a ameaça mais fácil de bloquear: o
          // adversário só precisa jogar por cima. Vale menos que linha e
          // diagonal, que exigem vigiar duas pontas.
          janela.peso = (dc === 0 && dr === 1) ? 0.75 : 1;
          list.push(janela);
        }
      }
    }
  }
  Object.defineProperty(board, 'windows', { value: list, enumerable: false, configurable: true });
  return list;
}

// Pontuação posicional: janelas quase fechadas valem muito mais que peças
// soltas, e ameaça do adversário pesa um pouco mais que a própria — bloquear
// antes de atacar é o que evita perder por descuido.
function evaluate(board, me) {
  const foe = other(me);
  const windows = windowsFor(board);
  const need = board.connect;

  // Altura atual de cada coluna: uma ameaça só vale o que custa para virar
  // realidade. Três peças com a casa livre no alto de uma coluna vazia não
  // ameaçam nada agora — e sem essa correção a busca profunda persegue
  // ameaças impossíveis, que foi o que fez o nível mestre jogar pior que o
  // médio em tabuleiro alto.
  const alcance = board.cols;
  const pousos = new Int16Array(alcance);
  for (let col = 0; col < alcance; col++) pousos[col] = landing(board, col);

  let score = 0;
  for (const w of windows) {
    let mine = 0, theirs = 0, custo = 0;
    for (let i = 0; i < w.length; i++) {
      const index = w[i];
      const v = board.cells[index];
      if (v === me) mine++;
      else if (v === foe) theirs++;
      else {
        const col = index % board.cols, row = (index - col) / board.cols;
        const pouso = pousos[col];
        // pouso < 0: coluna fechada. row > pouso: casa vazia num bolso morto,
        // debaixo de um bloqueio — nunca será preenchida, então a janela
        // inteira é inútil. Sem esta distinção a busca contava como ameaça
        // linhas que passam por baixo dos pilares.
        const d = pouso - row;
        custo += (pouso < 0 || d < 0) ? 99 : d;
      }
    }
    if (mine && theirs) continue;
    if (!mine && !theirs) continue;
    if (custo >= 99) continue;
    const perto = (1 / (1 + custo * TUNE.reach)) * w.peso;
    if (mine) score += Math.pow(mine, 3) * (mine === need - 1 ? 6 : 1) * perto;
    else score -= Math.pow(theirs, 3) * (theirs === need - 1 ? 8 : 1.1) * perto;
  }

  // Centro: participa de mais janelas, então vale um empurrãozinho.
  const pesos = centerWeights(board);
  for (let i = 0; i < board.cells.length; i++) {
    const v = board.cells[i];
    if (v === me) score += pesos[i % board.cols];
    else if (v === foe) score -= pesos[i % board.cols];
  }
  return score;
}

// Peso por coluna medido no próprio tabuleiro: quantas linhas possíveis
// passam por ali. Em tabuleiro limpo isso reproduz o velho "o centro vale
// mais"; nas fases com bloqueio no meio ele diz a verdade — a coluna central
// da fase CRUZ quase não participa de linha nenhuma, e premiá-la só porque
// fica no meio era o que fazia a busca profunda jogar pior que a rasa ali.
function centerWeights(board) {
  if (board.weights) return board.weights;
  const pesos = new Float32Array(board.cols);
  for (const janela of windowsFor(board)) {
    for (let i = 0; i < janela.length; i++) pesos[janela[i] % board.cols] += janela.peso;
  }
  let max = 0;
  for (const v of pesos) if (v > max) max = v;
  if (max > 0) for (let c = 0; c < board.cols; c++) pesos[c] = (pesos[c] / max) * 3;
  Object.defineProperty(board, 'weights', { value: pesos, enumerable: false, configurable: true });
  return pesos;
}

const orderMoves = board => {
  const mid = (board.cols - 1) / 2;
  return legalMoves(board).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
};

// Tabela de transposição: a mesma posição chega por ordens de jogada
// diferentes, e sem isto a busca reavalia tudo de novo. É o que faz a
// diferença entre olhar quatro jogadas à frente e olhar oito.
const table = new Map();
const keyOf = (board, me, maximizing) => board.cells.join('') + me + (maximizing ? '+' : '-');

function search(board, me, depth, alpha, beta, maximizing, stop) {
  if (board.winner) return board.winner === me ? WIN + depth : -WIN - depth;
  if (board.draw) return 0;
  if (depth === 0) return evaluate(board, me);
  if (stop()) return evaluate(board, me);

  const key = keyOf(board, me, maximizing);
  const hit = table.get(key);
  if (hit && hit.depth >= depth) {
    if (hit.flag === 0) return hit.score;
    if (hit.flag < 0 && hit.score <= alpha) return hit.score;
    if (hit.flag > 0 && hit.score >= beta) return hit.score;
  }

  const moves = orderMoves(board);
  if (!moves.length) return 0;
  if (hit && hit.move !== undefined) {
    const i = moves.indexOf(hit.move);
    if (i > 0) { moves.splice(i, 1); moves.unshift(hit.move); }
  }

  const alpha0 = alpha, beta0 = beta;
  let best = maximizing ? -Infinity : Infinity;
  let bestMove = moves[0];
  for (const col of moves) {
    drop(board, col, maximizing ? me : other(me));
    const score = search(board, me, depth - 1, alpha, beta, !maximizing, stop);
    undo(board);
    if (maximizing) {
      if (score > best) { best = score; bestMove = col; }
      if (best > alpha) alpha = best;
    } else {
      if (score < best) { best = score; bestMove = col; }
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  if (!stop()) {
    if (table.size > 160000) table.clear();
    table.set(key, { depth, score: best, move: bestMove, flag: best <= alpha0 ? -1 : best >= beta0 ? 1 : 0 });
  }
  return best;
}

// Vitória imediata ou bloqueio obrigatório, sem gastar busca.
//
// A sonda joga com uma marca escolhida por quem chama — e para descobrir o
// bloqueio ela joga com a marca do ADVERSÁRIO. `undo` devolve a vez a quem fez
// a jogada, que é o certo dentro da busca (lá a jogada é sempre de quem está
// na vez), mas aqui deixava `board.turn` apontando para o adversário. Como
// quem joga de verdade lê `board.turn` para saber a cor da peça, a máquina
// acabava soltando uma peça da cor do humano. A vez é guardada e reposta.
export function urgentMove(board, mark) {
  const vez = board.turn;
  try {
    for (const col of legalMoves(board)) {
      drop(board, col, mark);
      const venceu = board.winner === mark;
      undo(board);
      if (venceu) return col;
    }
    return -1;
  } finally { board.turn = vez; }
}

// A escolha da jogada não pode deixar rastro no tabuleiro, saia ela pelo
// atalho da vitória, pelo bloqueio, pelo erro proposital ou pela busca inteira.
export function chooseMove(board, me, options = {}) {
  const vez = board.turn;
  try { return pickMove(board, me, options); }
  finally { board.turn = vez; }
}

function pickMove(board, me, options = {}) {
  const { depth = 6, noise = 0, budget = 90, random = Math.random } = options;
  const moves = orderMoves(board);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  const win = urgentMove(board, me);
  if (win >= 0) return win;
  const block = urgentMove(board, other(me));
  if (block >= 0 && depth > 1) return block;

  if (noise > 0 && random() < noise) return moves[Math.floor(random() * moves.length)];
  if (depth <= 1) {
    // No nível fácil a busca é rasa de propósito: ele vê a própria vitória e
    // o bloqueio óbvio, e erra o resto.
    return block >= 0 ? block : moves[Math.floor(random() * moves.length)];
  }

  table.clear();
  const limite = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + budget;
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const stop = () => agora() > limite;

  let escolha = moves[0];
  let ordem = moves;
  // De dois em dois: a nota de uma busca que termina logo depois da MINHA
  // jogada é sistematicamente mais otimista que a de uma que termina depois
  // da resposta do adversário. Misturar as duas paridades fazia o nível mais
  // fundo jogar pior que o raso — a busca ficava comparando notas de réguas
  // diferentes.
  for (let d = 2; d <= depth; d += 2) {
    let melhor = -Infinity, candidatos = [];
    let completou = true;
    const notas = new Map();
    // Alfa vai subindo entre as jogadas da raiz: sem propagar isso, cada
    // jogada era buscada com janela aberta e a poda quase não cortava — o
    // nível fundo gastava o tempo todo para chegar à mesma profundidade do
    // nível raso.
    let alfa = -Infinity;
    for (const col of ordem) {
      drop(board, col, me);
      const score = search(board, me, d - 1, alfa, Infinity, false, stop);
      undo(board);
      if (score > alfa) alfa = score;
      notas.set(col, score);
      if (score > melhor) { melhor = score; candidatos = [col]; }
      else if (score === melhor) candidatos.push(col);
      if (stop()) { completou = false; break; }
    }
    // A próxima profundidade começa pela jogada mais promissora desta: a poda
    // corta muito mais cedo assim.
    if (completou) ordem = [...ordem].sort((a, b) => (notas.get(b) ?? -Infinity) - (notas.get(a) ?? -Infinity));
    if (candidatos.length) {
      const pick = candidatos[Math.floor(random() * candidatos.length)];
      if (completou || escolha === undefined) escolha = pick;
      if (melhor >= WIN) return pick;
    }
    if (completou) { LAST.depth = d; }
    if (!completou) break;
  }
  LAST.ms = agora() - (limite - budget);
  return escolha;
}
