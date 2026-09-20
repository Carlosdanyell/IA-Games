// Motor de xadrez: negamax com poda alfa-beta, aprofundamento iterativo e
// prazo em milissegundos.
//
// O prazo é o que mantém a jogada viável em qualquer aparelho. Fixar a
// profundidade faria a máquina pensar 80 ms num computador e 4 s num celular
// antigo; aqui a busca desce o quanto der no tempo disponível e usa o melhor
// resultado de uma profundidade COMPLETA — uma iteração interrompida no meio é
// descartada, porque o melhor lance dela pode ser só o primeiro ainda não
// refutado.
//
// A busca roda de uma vez, e não fatiada entre quadros: o tabuleiro é DOM e
// fica parado enquanto a máquina pensa, então o congelamento acontece dentro
// de um estado sem animação. Em troca, o orçamento por nível tem teto.
import {
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK,
  typeOf, colorOf, other, fileOf, rankOf, square, onBoard,
  generate, makeMove, unmakeMove, attacked, moveFrom, moveTo, movePromotion,
  CAPTURE, EN_PASSANT
} from './model.js';

export const LEVELS = {
  iniciante: {
    label: 'Iniciante', subtitle: 'Enxerga um lance',
    description: 'Olha só o próprio lance. Deixa peças em jogo e perdoa erros.',
    depth: 1, budget: 30, noise: 130, quiescence: false, delay: .55
  },
  facil: {
    label: 'Fácil', subtitle: 'Vê a resposta',
    description: 'Percebe a recaptura imediata, mas não planeja além disso.',
    depth: 2, budget: 70, noise: 70, quiescence: true, delay: .5
  },
  medio: {
    label: 'Médio', subtitle: 'Tático',
    description: 'Calcula pequenas combinações e cobra descuidos de material.',
    depth: 4, budget: 160, noise: 25, quiescence: true, delay: .45
  },
  dificil: {
    label: 'Difícil', subtitle: 'Sem descuidos',
    description: 'Não entrega material de graça e castiga peça mal colocada.',
    depth: 6, budget: 320, noise: 0, quiescence: true, delay: .35
  },
  mestre: {
    label: 'Mestre', subtitle: 'Pensa fundo',
    description: 'Usa todo o tempo disponível. Exige plano para ser batida.',
    depth: 9, budget: 550, noise: 0, quiescence: true, delay: .3
  }
};
export const DEFAULT_LEVEL = 'medio';
export const levelOf = key => LEVELS[key] || LEVELS[DEFAULT_LEVEL];

export const VALUES = { [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 0 };
const MATE = 30000;
const INFINITY = 1e6;
const MAX_PLY = 64;

// Tabelas peça-casa escritas como o tabuleiro é visto, da linha 8 para a 1.
// Para as brancas o índice é `(7 - linha) * 8 + coluna`; para as pretas a
// tabela é espelhada na vertical, o que dá `linha * 8 + coluna`.
const table = rows => Int16Array.from(rows.flat());
const PST = {
  [PAWN]: table([
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [ 50, 50, 50, 50, 50, 50, 50, 50],
    [ 10, 10, 20, 30, 30, 20, 10, 10],
    [  5,  5, 10, 25, 25, 10,  5,  5],
    [  0,  0,  0, 20, 20,  0,  0,  0],
    [  5, -5,-10,  0,  0,-10, -5,  5],
    [  5, 10, 10,-20,-20, 10, 10,  5],
    [  0,  0,  0,  0,  0,  0,  0,  0]]),
  [KNIGHT]: table([
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]]),
  [BISHOP]: table([
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]]),
  [ROOK]: table([
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0]]),
  [QUEEN]: table([
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]])
};
const KING_OPENING = table([
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20]]);
const KING_ENDGAME = table([
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]]);

const PASSED_BONUS = [0, 5, 15, 30, 55, 90, 140, 0];
const DOUBLED = -14, ISOLATED = -16, BISHOP_PAIR = 32, ROOK_OPEN = 18, ROOK_HALF = 9;

// Avaliação em centipeões, sempre do ponto de vista de quem tem a vez.
export function evaluate(pos) {
  const b = pos.board;
  let material = [0, 0], positional = [0, 0], bishops = [0, 0], heavy = 0;
  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const kings = [-1, -1];
  const squares = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = square(file, rank), piece = b[sq];
      if (!piece) continue;
      const type = typeOf(piece), white = colorOf(piece) === WHITE, index = white ? 0 : 1;
      if (type === KING) { kings[index] = sq; continue; }
      material[index] += VALUES[type];
      positional[index] += PST[type][white ? (7 - rank) * 8 + file : rank * 8 + file];
      if (type === PAWN) pawnFiles[index][file]++;
      else { squares.push({ type, index, file, rank }); if (type !== KNIGHT && type !== BISHOP) heavy += VALUES[type]; }
      if (type === BISHOP) bishops[index]++;
    }
  }

  // Fase da partida pelo material pesado restante: com as damas e torres fora,
  // o rei deixa de se esconder e passa a valer no centro.
  const phase = Math.max(0, Math.min(1, heavy / 5000));
  for (let index = 0; index < 2; index++) {
    const sq = kings[index];
    if (sq < 0) continue;
    const file = fileOf(sq), rank = rankOf(sq);
    const cell = index === 0 ? (7 - rank) * 8 + file : rank * 8 + file;
    positional[index] += Math.round(KING_OPENING[cell] * phase + KING_ENDGAME[cell] * (1 - phase));
    if (bishops[index] >= 2) positional[index] += BISHOP_PAIR;
  }

  for (let index = 0; index < 2; index++) {
    const own = pawnFiles[index], rival = pawnFiles[1 - index];
    for (let file = 0; file < 8; file++) {
      if (!own[file]) continue;
      if (own[file] > 1) positional[index] += DOUBLED * (own[file] - 1);
      const left = file > 0 ? own[file - 1] : 0, right = file < 7 ? own[file + 1] : 0;
      if (!left && !right) positional[index] += ISOLATED;
      const blocked = rival[file] || (file > 0 && rival[file - 1]) || (file < 7 && rival[file + 1]);
      if (!blocked) {
        // Peão passado: o valor cresce com a proximidade da promoção.
        for (let rank = 0; rank < 8; rank++) {
          const sq = square(file, rank);
          if (b[sq] === (PAWN | (index === 0 ? WHITE : BLACK))) {
            positional[index] += PASSED_BONUS[index === 0 ? rank : 7 - rank];
          }
        }
      }
    }
  }
  for (const { type, index, file } of squares) {
    if (type !== ROOK) continue;
    if (!pawnFiles[index][file]) positional[index] += pawnFiles[1 - index][file] ? ROOK_HALF : ROOK_OPEN;
  }

  const score = (material[0] + positional[0]) - (material[1] + positional[1]);
  return pos.turn === WHITE ? score : -score;
}

// ------------------------------------------------------------------ ordenação
// Ordenar bem é o que dá profundidade: a poda alfa-beta corta muito mais cedo
// quando o lance bom aparece primeiro. Capturas vêm por MVV-LVA (vítima mais
// valiosa, agressor mais barato), depois os matadores do nível.
const CAPTURE_BASE = 1_000_000;
const PROMOTION_BASE = 900_000;
const KILLER_BASE = 800_000;

function orderScore(pos, move, killers, ply, first) {
  if (first && (move & 0x7fffff) === (first & 0x7fffff)) return 2_000_000;
  const promotion = movePromotion(move);
  if (move & CAPTURE) {
    const victim = (move & EN_PASSANT) ? PAWN : typeOf(pos.board[moveTo(move)]);
    const attacker = typeOf(pos.board[moveFrom(move)]);
    return CAPTURE_BASE + VALUES[victim] * 16 - VALUES[attacker] + (promotion ? VALUES[promotion] : 0);
  }
  if (promotion) return PROMOTION_BASE + VALUES[promotion];
  if (killers[ply * 2] === move) return KILLER_BASE + 1;
  if (killers[ply * 2 + 1] === move) return KILLER_BASE;
  return 0;
}

function sortMoves(pos, moves, killers, ply, first) {
  const scores = new Map();
  for (const move of moves) scores.set(move, orderScore(pos, move, killers, ply, first));
  moves.sort((a, b) => scores.get(b) - scores.get(a));
  return moves;
}

// ------------------------------------------------------------------- a busca
export function createSearch({ quiescence = true, now = () => performance.now() } = {}) {
  const buffers = Array.from({ length: MAX_PLY }, () => []);
  const killers = new Int32Array(MAX_PLY * 2);
  let nodes = 0, deadline = Infinity, stopped = false;

  const outOfTime = () => {
    if (stopped) return true;
    if ((++nodes & 1023) === 0 && now() >= deadline) stopped = true;
    return stopped;
  };

  function quiesce(pos, alpha, beta, ply) {
    if (outOfTime() || ply >= MAX_PLY - 1) return evaluate(pos);
    const standPat = evaluate(pos);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    const moves = sortMoves(pos, generate(pos, buffers[ply], true), killers, ply, 0);
    const color = pos.turn, enemy = other(color);
    for (const move of moves) {
      makeMove(pos, move);
      if (attacked(pos, pos.king[color >> 4], enemy)) { unmakeMove(pos); continue; }
      const score = -quiesce(pos, -beta, -alpha, ply + 1);
      unmakeMove(pos);
      if (stopped) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(pos, depth, alpha, beta, ply) {
    if (outOfTime()) return 0;
    const color = pos.turn, enemy = other(color);
    const check = attacked(pos, pos.king[color >> 4], enemy);
    // Extensão de xeque: parar a contagem dentro de um xeque esconde o mate
    // logo depois do horizonte da busca.
    if (check && ply < MAX_PLY - 2) depth++;
    if (depth <= 0) return quiescence ? quiesce(pos, alpha, beta, ply) : evaluate(pos);

    const moves = sortMoves(pos, generate(pos, buffers[ply], false), killers, ply, 0);
    let best = -INFINITY, legal = 0;
    for (const move of moves) {
      makeMove(pos, move);
      if (attacked(pos, pos.king[color >> 4], enemy)) { unmakeMove(pos); continue; }
      legal++;
      const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(pos);
      if (stopped) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!(move & CAPTURE)) {
          killers[ply * 2 + 1] = killers[ply * 2];
          killers[ply * 2] = move;
        }
        break;
      }
    }
    // Sem lance legal: mate se estiver em xeque, afogamento se não. A distância
    // em plies entra no valor para a máquina preferir o mate mais curto.
    if (!legal) return check ? -MATE + ply : 0;
    return best;
  }

  return {
    get nodes() { return nodes; },
    // Pontua cada lance da raiz até o prazo. `exact` refaz a janela cheia por
    // lance: sem isso, os lances piores só recebem um limite superior, e os
    // níveis fracos — que escolhem com ruído — sorteariam entre valores falsos.
    run(pos, { depth: maxDepth, budget, exact = false }) {
      nodes = 0; stopped = false;
      killers.fill(0);
      deadline = now() + Math.max(1, budget);
      const root = generate(pos, [], false).filter(move => {
        makeMove(pos, move);
        const ok = !attacked(pos, pos.king[other(pos.turn) >> 4], pos.turn);
        unmakeMove(pos);
        return ok;
      });
      if (!root.length) return { scored: [], depth: 0, nodes: 0 };

      let scored = root.map(move => ({ move, score: 0 }));
      let reached = 0;
      for (let depth = 1; depth <= maxDepth; depth++) {
        const first = scored[0].move;
        const ordered = sortMoves(pos, [...root], killers, 0, first);
        const round = [];
        let alpha = -INFINITY;
        const color = pos.turn, enemy = other(color);
        for (const move of ordered) {
          makeMove(pos, move);
          if (attacked(pos, pos.king[color >> 4], enemy)) { unmakeMove(pos); continue; }
          const score = -negamax(pos, depth - 1, -INFINITY, exact ? INFINITY : -alpha, 1);
          unmakeMove(pos);
          if (stopped) break;
          round.push({ move, score });
          if (!exact && score > alpha) alpha = score;
        }
        if (stopped || round.length !== root.length) break;
        round.sort((a, b) => b.score - a.score);
        scored = round;
        reached = depth;
        // Mate encontrado: descer mais não muda a decisão.
        if (Math.abs(scored[0].score) > MATE - MAX_PLY) break;
      }
      return { scored, depth: reached, nodes };
    }
  };
}

// Escolhe o lance da máquina. Devolve `null` quando não há lance legal — quem
// chama decide se é mate ou afogamento.
export function chooseMove(pos, levelKey = DEFAULT_LEVEL, options = {}) {
  const level = levelOf(levelKey);
  const { random = Math.random, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) } = options;
  const search = createSearch({ quiescence: level.quiescence, now });
  const started = now();
  const { scored, depth, nodes } = search.run(pos, {
    depth: options.depth ?? level.depth,
    budget: options.budget ?? level.budget,
    exact: level.noise > 0
  });
  if (!scored.length) return null;

  const noise = options.noise ?? level.noise;
  let chosen = scored[0];
  if (noise > 0) {
    // O ruído é somado à nota, não sorteado entre lances: o nível fraco erra a
    // escolha entre lances parecidos, mas continua enxergando o mate na cara e
    // a captura grande de graça.
    let bestScore = -INFINITY;
    for (const entry of scored) {
      const score = entry.score + (random() * 2 - 1) * noise;
      if (score > bestScore) { bestScore = score; chosen = entry; }
    }
  }
  return { move: chosen.move, score: chosen.score, depth, nodes, ms: now() - started };
}
