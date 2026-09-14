// Regras puras do Lig 4, independentes de tela e de fase.
//
// O tabuleiro é mutável de propósito: a busca da IA faz milhares de jogadas e
// desfaz cada uma, e clonar matriz a cada nó custaria caro. Quem precisa de
// cópia usa `cloneBoard`.
//
// Índice = linha * colunas + coluna, com a linha 0 no topo. As células
// bloqueadas das fases valem como chão: a peça para em cima delas, e o espaço
// que ficar embaixo é um bolso morto — é assim que as fases com obstáculo
// mudam a geometria do jogo.

export const EMPTY = 0;
export const BLOCK = -1;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];   // →, ↓, ↘, ↗

export function createBoard(stage) {
  const { cols, rows, connect = 4 } = stage;
  const cells = new Int8Array(cols * rows);
  for (const [c, r] of stage.blocked || []) cells[r * cols + c] = BLOCK;
  return {
    cols, rows, connect,
    cells,
    turn: 1,
    moves: [],
    winner: 0,
    line: null,
    draw: false
  };
}

export function cloneBoard(board) {
  return {
    cols: board.cols, rows: board.rows, connect: board.connect,
    cells: Int8Array.from(board.cells),
    turn: board.turn,
    moves: [...board.moves],
    winner: board.winner,
    line: board.line ? [...board.line] : null,
    draw: board.draw
  };
}

export const at = (board, col, row) => board.cells[row * board.cols + col];
export const inside = (board, col, row) =>
  col >= 0 && col < board.cols && row >= 0 && row < board.rows;

// Onde a peça para se cair nesta coluna, ou -1 se a coluna não aceita mais.
export function landing(board, col) {
  if (col < 0 || col >= board.cols) return -1;
  if (at(board, col, 0) !== EMPTY) return -1;
  let row = 0;
  while (row + 1 < board.rows && at(board, col, row + 1) === EMPTY) row++;
  return row;
}

export const legalMoves = board => {
  const list = [];
  for (let col = 0; col < board.cols; col++) if (landing(board, col) >= 0) list.push(col);
  return list;
};

// Linha vencedora que passa pela peça recém-colocada, ou null.
export function lineThrough(board, col, row) {
  const mark = at(board, col, row);
  if (mark <= 0) return null;
  for (const [dc, dr] of DIRS) {
    const cells = [[col, row]];
    for (const sign of [1, -1]) {
      let c = col + dc * sign, r = row + dr * sign;
      while (inside(board, c, r) && at(board, c, r) === mark) {
        cells.push([c, r]);
        c += dc * sign; r += dr * sign;
      }
    }
    if (cells.length >= board.connect) {
      cells.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
      return cells;
    }
  }
  return null;
}

// Aplica a jogada no próprio tabuleiro e devolve o que aconteceu.
export function drop(board, col, mark = board.turn) {
  if (board.winner || board.draw) return null;
  const row = landing(board, col);
  if (row < 0) return null;
  board.cells[row * board.cols + col] = mark;
  board.moves.push(col);
  const line = lineThrough(board, col, row);
  if (line) { board.winner = mark; board.line = line; }
  else if (legalMoves(board).length === 0) board.draw = true;
  else board.turn = mark === 1 ? 2 : 1;
  return { col, row, mark, line, draw: board.draw };
}

// Desfaz a última jogada. Só a busca usa isto.
export function undo(board) {
  const col = board.moves.pop();
  if (col === undefined) return;
  let row = 0;
  while (row < board.rows && at(board, col, row) === EMPTY) row++;
  const mark = at(board, col, row);
  board.cells[row * board.cols + col] = EMPTY;
  board.winner = 0;
  board.line = null;
  board.draw = false;
  board.turn = mark;
}

export function restore(stage, moves) {
  if (!Array.isArray(moves) || moves.length > stage.cols * stage.rows) return null;
  const board = createBoard(stage);
  for (const col of moves) {
    if (!Number.isInteger(col) || drop(board, col) === null) return null;
  }
  return board;
}

export const finished = board => !!board.winner || board.draw;
export const other = mark => (mark === 1 ? 2 : 1);
