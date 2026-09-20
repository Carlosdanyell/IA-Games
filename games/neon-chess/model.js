// Regras completas do xadrez sobre tabuleiro 0x88.
//
// Por que 0x88 e não uma matriz 8x8: a casa é `linha * 16 + coluna`, então
// sair do tabuleiro é um único teste de bit (`sq & 0x88`). Toda a geração de
// lances é feita com deslocamentos constantes, sem checar limites duas vezes
// por casa — é o que permite a busca da máquina descer alguns lances a mais
// dentro do mesmo prazo num celular.
//
// Linha 0 é a linha "1" (casa das brancas). Coluna 0 é a coluna "a".

export const EMPTY = 0;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const WHITE = 8, BLACK = 16;

export const typeOf = piece => piece & 7;
export const colorOf = piece => piece & 24;
export const other = color => color === WHITE ? BLACK : WHITE;
const side = color => color >> 4;            // WHITE -> 0, BLACK -> 1

export const fileOf = sq => sq & 15;
export const rankOf = sq => sq >> 4;
export const square = (file, rank) => rank * 16 + file;
export const onBoard = sq => (sq & 0x88) === 0;
export const algebraic = sq => 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
export function parseSquare(text) {
  if (typeof text !== 'string' || text.length !== 2) return -1;
  const file = 'abcdefgh'.indexOf(text[0]), rank = '12345678'.indexOf(text[1]);
  return file < 0 || rank < 0 ? -1 : square(file, rank);
}

// --------------------------------------------------------------------- lances
// Um lance cabe num inteiro de 32 bits. Guardar lance como objeto custaria
// milhões de alocações por busca, e o coletor de lixo apareceria como engasgo
// no meio da partida.
const PROMO_SHIFT = 16;
export const CAPTURE = 1 << 19;
export const EN_PASSANT = 1 << 20;
export const CASTLE = 1 << 21;
export const DOUBLE_PUSH = 1 << 22;

export const encodeMove = (from, to, promotion = 0, flags = 0) =>
  (from & 255) | ((to & 255) << 8) | ((promotion & 7) << PROMO_SHIFT) | flags;
export const moveFrom = move => move & 255;
export const moveTo = move => (move >> 8) & 255;
export const movePromotion = move => (move >> PROMO_SHIFT) & 7;
export const sameMove = (a, b) => (a & 0x7fffff) === (b & 0x7fffff);

// Direitos de roque: 1 = brancas no lado do rei, 2 = brancas na dama,
// 4 = pretas no rei, 8 = pretas na dama.
export const WK = 1, WQ = 2, BK = 4, BQ = 8;

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_STEPS = [-17, -15, 15, 17];
const ROOK_STEPS = [-16, -1, 1, 16];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];

// Máscara aplicada aos direitos de roque quando uma casa é origem OU destino
// de um lance. Resolve de uma vez rei que anda, torre que anda e torre que é
// capturada na casa original — os três casos que costumam escapar.
const RIGHTS_MASK = new Int8Array(128).fill(15);
RIGHTS_MASK[parseSquare('a1')] = 15 & ~WQ;
RIGHTS_MASK[parseSquare('h1')] = 15 & ~WK;
RIGHTS_MASK[parseSquare('e1')] = 15 & ~(WK | WQ);
RIGHTS_MASK[parseSquare('a8')] = 15 & ~BQ;
RIGHTS_MASK[parseSquare('h8')] = 15 & ~BK;
RIGHTS_MASK[parseSquare('e8')] = 15 & ~(BK | BQ);

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_PIECES = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
const FEN_LETTERS = { [PAWN]: 'p', [KNIGHT]: 'n', [BISHOP]: 'b', [ROOK]: 'r', [QUEEN]: 'q', [KING]: 'k' };

// Letras da notação em português: Rei, Dama, Torre, Cavalo, Bispo.
export const SAN_LETTERS = { [KNIGHT]: 'C', [BISHOP]: 'B', [ROOK]: 'T', [QUEEN]: 'D', [KING]: 'R' };
export const PROMOTION_CHOICES = [QUEEN, ROOK, BISHOP, KNIGHT];

// ------------------------------------------------------------------- posição
export function parseFen(fen = START_FEN) {
  const parts = String(fen).trim().split(/\s+/);
  if (parts.length < 4) throw new Error('FEN incompleta.');
  const [layout, turn, castling, ep] = parts;
  const board = new Int8Array(128);
  const king = [-1, -1];
  const rows = layout.split('/');
  if (rows.length !== 8) throw new Error('FEN com número de linhas inválido.');
  for (let row = 0; row < 8; row++) {
    const rank = 7 - row;
    let file = 0;
    for (const char of rows[row]) {
      if (char >= '1' && char <= '8') { file += Number(char); continue; }
      const type = FEN_PIECES[char.toLowerCase()];
      if (!type || file > 7) throw new Error('FEN com peça inválida.');
      const color = char === char.toUpperCase() ? WHITE : BLACK;
      const sq = square(file, rank);
      board[sq] = type | color;
      if (type === KING) king[side(color)] = sq;
      file++;
    }
    if (file !== 8) throw new Error('FEN com linha de tamanho inválido.');
  }
  if (king[0] < 0 || king[1] < 0) throw new Error('FEN sem os dois reis.');
  let rights = 0;
  if (castling !== '-') for (const char of castling) {
    if (char === 'K') rights |= WK; else if (char === 'Q') rights |= WQ;
    else if (char === 'k') rights |= BK; else if (char === 'q') rights |= BQ;
  }
  const halfmove = Number(parts[4] ?? 0), fullmove = Number(parts[5] ?? 1);
  return {
    board, king,
    turn: turn === 'b' ? BLACK : WHITE,
    castling: rights,
    ep: ep === '-' ? -1 : parseSquare(ep),
    halfmove: Number.isFinite(halfmove) && halfmove >= 0 ? Math.min(halfmove, 999) : 0,
    fullmove: Number.isFinite(fullmove) && fullmove >= 1 ? Math.min(fullmove, 9999) : 1,
    stack: []
  };
}

export function toFen(pos) {
  let layout = '';
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = pos.board[square(file, rank)];
      if (!piece) { empty++; continue; }
      if (empty) { layout += empty; empty = 0; }
      const letter = FEN_LETTERS[typeOf(piece)];
      layout += colorOf(piece) === WHITE ? letter.toUpperCase() : letter;
    }
    if (empty) layout += empty;
    if (rank) layout += '/';
  }
  const rights = (pos.castling & WK ? 'K' : '') + (pos.castling & WQ ? 'Q' : '') +
                 (pos.castling & BK ? 'k' : '') + (pos.castling & BQ ? 'q' : '');
  return `${layout} ${pos.turn === WHITE ? 'w' : 'b'} ${rights || '-'} ` +
         `${pos.ep >= 0 ? algebraic(pos.ep) : '-'} ${pos.halfmove} ${pos.fullmove}`;
}

export const createPosition = (fen = START_FEN) => parseFen(fen);

export function clonePosition(pos) {
  return {
    board: Int8Array.from(pos.board),
    king: [...pos.king],
    turn: pos.turn, castling: pos.castling, ep: pos.ep,
    halfmove: pos.halfmove, fullmove: pos.fullmove,
    stack: []
  };
}

// Assinatura para tripla repetição: posição, vez, roques e en passant — sem os
// contadores, que mudam a cada lance e nunca deixariam duas posições iguais.
export const positionKey = pos => toFen(pos).split(' ').slice(0, 4).join(' ');

// ------------------------------------------------------------------- ataques
// Uma casa está atacada por `by`? Percorre a partir da casa, e não de cada
// peça do adversário: o custo passa a depender das direções, não do material.
export function attacked(pos, sq, by) {
  const b = pos.board;
  const forward = by === WHITE ? 16 : -16;
  for (const step of [-1, 1]) {
    const from = sq - forward + step;
    if (onBoard(from) && b[from] === (PAWN | by)) return true;
  }
  for (const step of KNIGHT_STEPS) {
    const from = sq + step;
    if (onBoard(from) && b[from] === (KNIGHT | by)) return true;
  }
  for (const step of KING_STEPS) {
    const from = sq + step;
    if (onBoard(from) && b[from] === (KING | by)) return true;
  }
  for (const step of BISHOP_STEPS) {
    for (let at = sq + step; onBoard(at); at += step) {
      const piece = b[at];
      if (!piece) continue;
      if (piece === (BISHOP | by) || piece === (QUEEN | by)) return true;
      break;
    }
  }
  for (const step of ROOK_STEPS) {
    for (let at = sq + step; onBoard(at); at += step) {
      const piece = b[at];
      if (!piece) continue;
      if (piece === (ROOK | by) || piece === (QUEEN | by)) return true;
      break;
    }
  }
  return false;
}

export const inCheck = (pos, color = pos.turn) => attacked(pos, pos.king[side(color)], other(color));

// ------------------------------------------------------------ geração
// Gera lances pseudo-legais: o rei pode acabar em xeque. A legalidade é
// resolvida depois, jogando e desfazendo — caminho mais lento que detectar
// cravadas, mas o único que nunca erra em posição estranha.
export function generate(pos, out = [], capturesOnly = false) {
  out.length = 0;
  const b = pos.board, color = pos.turn, enemy = other(color);
  const forward = color === WHITE ? 16 : -16;
  const startRank = color === WHITE ? 1 : 6;
  const promoRank = color === WHITE ? 7 : 0;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const from = square(file, rank);
      const piece = b[from];
      if (!piece || colorOf(piece) !== color) continue;
      const type = typeOf(piece);

      if (type === PAWN) {
        const one = from + forward;
        if (onBoard(one) && !b[one]) {
          if (!capturesOnly || rankOf(one) === promoRank) pushPawn(out, from, one, promoRank, 0);
          if (!capturesOnly && rank === startRank) {
            const two = one + forward;
            if (!b[two]) out.push(encodeMove(from, two, 0, DOUBLE_PUSH));
          }
        }
        for (const step of [forward - 1, forward + 1]) {
          const to = from + step;
          if (!onBoard(to)) continue;
          if (b[to] && colorOf(b[to]) === enemy) pushPawn(out, from, to, promoRank, CAPTURE);
          else if (to === pos.ep && !b[to]) out.push(encodeMove(from, to, 0, CAPTURE | EN_PASSANT));
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        const steps = type === KNIGHT ? KNIGHT_STEPS : KING_STEPS;
        for (const step of steps) {
          const to = from + step;
          if (!onBoard(to)) continue;
          const target = b[to];
          if (target && colorOf(target) === color) continue;
          if (target) out.push(encodeMove(from, to, 0, CAPTURE));
          else if (!capturesOnly) out.push(encodeMove(from, to));
        }
        continue;
      }

      const steps = type === BISHOP ? BISHOP_STEPS : type === ROOK ? ROOK_STEPS : KING_STEPS;
      for (const step of steps) {
        for (let to = from + step; onBoard(to); to += step) {
          const target = b[to];
          if (target && colorOf(target) === color) break;
          if (target) { out.push(encodeMove(from, to, 0, CAPTURE)); break; }
          if (!capturesOnly) out.push(encodeMove(from, to));
        }
      }
    }
  }

  if (!capturesOnly) generateCastles(pos, out, color, enemy);
  return out;
}

function pushPawn(out, from, to, promoRank, flags) {
  if (rankOf(to) === promoRank) {
    for (const type of PROMOTION_CHOICES) out.push(encodeMove(from, to, type, flags));
  } else out.push(encodeMove(from, to, 0, flags));
}

function generateCastles(pos, out, color, enemy) {
  const b = pos.board, home = color === WHITE ? 0 : 7;
  const kingSq = square(4, home);
  if (b[kingSq] !== (KING | color)) return;
  const kingSide = color === WHITE ? WK : BK, queenSide = color === WHITE ? WQ : BQ;
  // O rei não pode sair do xeque, passar por casa atacada nem chegar em uma.
  // A casa de chegada é conferida aqui para o roque não depender do filtro
  // genérico de legalidade, que só olha a casa final do rei.
  if ((pos.castling & kingSide) && b[square(7, home)] === (ROOK | color) &&
      !b[square(5, home)] && !b[square(6, home)] &&
      !attacked(pos, kingSq, enemy) && !attacked(pos, square(5, home), enemy) &&
      !attacked(pos, square(6, home), enemy)) {
    out.push(encodeMove(kingSq, square(6, home), 0, CASTLE));
  }
  if ((pos.castling & queenSide) && b[square(0, home)] === (ROOK | color) &&
      !b[square(1, home)] && !b[square(2, home)] && !b[square(3, home)] &&
      !attacked(pos, kingSq, enemy) && !attacked(pos, square(3, home), enemy) &&
      !attacked(pos, square(2, home), enemy)) {
    out.push(encodeMove(kingSq, square(2, home), 0, CASTLE));
  }
}

// ------------------------------------------------------------- jogar/desfazer
export function makeMove(pos, move) {
  const b = pos.board;
  const from = moveFrom(move), to = moveTo(move);
  const piece = b[from], color = colorOf(piece), type = typeOf(piece);
  const record = {
    move, captured: b[to], capturedSquare: to,
    castling: pos.castling, ep: pos.ep,
    halfmove: pos.halfmove, fullmove: pos.fullmove,
    king: [pos.king[0], pos.king[1]]
  };

  b[to] = piece;
  b[from] = EMPTY;

  if (move & EN_PASSANT) {
    const victim = to - (color === WHITE ? 16 : -16);
    record.captured = b[victim];
    record.capturedSquare = victim;
    b[victim] = EMPTY;
  }
  const promotion = movePromotion(move);
  if (promotion) b[to] = promotion | color;
  if (move & CASTLE) {
    const home = color === WHITE ? 0 : 7;
    const kingSide = fileOf(to) === 6;
    const rookFrom = square(kingSide ? 7 : 0, home), rookTo = square(kingSide ? 5 : 3, home);
    b[rookTo] = b[rookFrom];
    b[rookFrom] = EMPTY;
  }
  if (type === KING) pos.king[side(color)] = to;

  pos.castling &= RIGHTS_MASK[from] & RIGHTS_MASK[to];
  pos.ep = (move & DOUBLE_PUSH) ? from + (color === WHITE ? 16 : -16) : -1;
  pos.halfmove = (type === PAWN || record.captured) ? 0 : pos.halfmove + 1;
  if (color === BLACK) pos.fullmove++;
  pos.turn = other(color);
  pos.stack.push(record);
  return record;
}

export function unmakeMove(pos) {
  const record = pos.stack.pop();
  if (!record) return null;
  const b = pos.board;
  const move = record.move;
  const from = moveFrom(move), to = moveTo(move);
  const piece = b[to];
  const color = colorOf(piece);

  b[from] = movePromotion(move) ? (PAWN | color) : piece;
  b[to] = EMPTY;
  if (record.captured) b[record.capturedSquare] = record.captured;
  if (move & CASTLE) {
    const home = color === WHITE ? 0 : 7;
    const kingSide = fileOf(to) === 6;
    const rookFrom = square(kingSide ? 7 : 0, home), rookTo = square(kingSide ? 5 : 3, home);
    b[rookFrom] = b[rookTo];
    b[rookTo] = EMPTY;
  }
  pos.king[0] = record.king[0];
  pos.king[1] = record.king[1];
  pos.castling = record.castling;
  pos.ep = record.ep;
  pos.halfmove = record.halfmove;
  pos.fullmove = record.fullmove;
  pos.turn = color;
  return record;
}

export function legalMoves(pos, out = []) {
  const pseudo = generate(pos, []);
  out.length = 0;
  const color = pos.turn;
  for (const move of pseudo) {
    makeMove(pos, move);
    if (!attacked(pos, pos.king[side(color)], other(color))) out.push(move);
    unmakeMove(pos);
  }
  return out;
}

export function isLegal(pos, move) {
  return legalMoves(pos).some(candidate => candidate === move);
}

// Encontra o lance legal que liga duas casas. É o que a interface usa: ela
// conhece origem, destino e a peça escolhida na promoção, não a codificação.
export function findMove(pos, from, to, promotion = 0) {
  const moves = legalMoves(pos);
  const matches = moves.filter(move => moveFrom(move) === from && moveTo(move) === to);
  if (!matches.length) return 0;
  if (matches.length > 1 && promotion) {
    return matches.find(move => movePromotion(move) === promotion) || 0;
  }
  return matches[0];
}

// --------------------------------------------------------------- fim de jogo
function materialIsDead(pos) {
  const pieces = [];
  for (let rank = 0; rank < 8; rank++) for (let file = 0; file < 8; file++) {
    const sq = square(file, rank), piece = pos.board[sq];
    if (!piece || typeOf(piece) === KING) continue;
    const type = typeOf(piece);
    if (type === PAWN || type === ROOK || type === QUEEN) return false;
    pieces.push({ type, color: colorOf(piece), dark: (file + rank) % 2 === 0 });
  }
  if (pieces.length <= 1) return true;                       // rei só, rei e bispo, rei e cavalo
  if (pieces.length === 2 && pieces.every(p => p.type === BISHOP) &&
      pieces[0].color !== pieces[1].color && pieces[0].dark === pieces[1].dark) return true;
  return false;
}

// `history` são as assinaturas das posições já ocorridas, incluindo a atual.
export function status(pos, history = []) {
  const moves = legalMoves(pos);
  const check = inCheck(pos);
  if (!moves.length) {
    return check
      ? { over: true, result: other(pos.turn) === WHITE ? 'white' : 'black', reason: 'mate', check, moves }
      : { over: true, result: 'draw', reason: 'stalemate', check, moves };
  }
  if (pos.halfmove >= 100) return { over: true, result: 'draw', reason: 'fifty', check, moves };
  if (materialIsDead(pos)) return { over: true, result: 'draw', reason: 'material', check, moves };
  const key = history.length ? history[history.length - 1] : null;
  if (key && history.filter(entry => entry === key).length >= 3) {
    return { over: true, result: 'draw', reason: 'repetition', check, moves };
  }
  return { over: false, result: null, reason: null, check, moves };
}

// ---------------------------------------------------------------------- SAN
// Notação algébrica em português (R, D, T, C, B). A desambiguação segue a
// regra padrão: coluna, depois linha, e as duas só quando nenhuma basta.
export function sanOf(pos, move, moves = legalMoves(pos)) {
  const from = moveFrom(move), to = moveTo(move);
  const piece = pos.board[from];
  const type = typeOf(piece);
  let text;
  if (move & CASTLE) {
    text = fileOf(to) === 6 ? 'O-O' : 'O-O-O';
  } else if (type === PAWN) {
    text = (move & CAPTURE) ? 'abcdefgh'[fileOf(from)] + 'x' + algebraic(to) : algebraic(to);
    const promotion = movePromotion(move);
    if (promotion) text += '=' + SAN_LETTERS[promotion];
  } else {
    const rivals = moves.filter(candidate => candidate !== move && moveTo(candidate) === to &&
      typeOf(pos.board[moveFrom(candidate)]) === type);
    let marker = '';
    if (rivals.length) {
      const sameFile = rivals.some(candidate => fileOf(moveFrom(candidate)) === fileOf(from));
      const sameRank = rivals.some(candidate => rankOf(moveFrom(candidate)) === rankOf(from));
      if (!sameFile) marker = 'abcdefgh'[fileOf(from)];
      else if (!sameRank) marker = String(rankOf(from) + 1);
      else marker = algebraic(from);
    }
    text = SAN_LETTERS[type] + marker + ((move & CAPTURE) ? 'x' : '') + algebraic(to);
  }
  makeMove(pos, move);
  const reply = legalMoves(pos);
  if (inCheck(pos)) text += reply.length ? '+' : '#';
  unmakeMove(pos);
  return text;
}

// -------------------------------------------------------------------- perft
// Conta as folhas da árvore de lances. É a verificação definitiva da geração:
// qualquer erro em roque, en passant ou promoção muda o total.
export function perft(pos, depth) {
  if (depth <= 0) return 1;
  const moves = generate(pos, []);
  const color = pos.turn, enemy = other(color);
  let total = 0;
  for (const move of moves) {
    makeMove(pos, move);
    if (!attacked(pos, pos.king[side(color)], enemy)) {
      total += depth === 1 ? 1 : perft(pos, depth - 1);
    }
    unmakeMove(pos);
  }
  return total;
}
