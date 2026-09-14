// Regras puras: o controlador e a IA usam o mesmo tabuleiro imutável.
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];
export const LEVELS = {
  facil: { label: 'Fácil', subtitle: 'Casual', description: 'Jogadas imprevisíveis. Um bom lugar para começar.', delay: .55 },
  medio: { label: 'Médio', subtitle: 'Tático', description: 'Busca a vitória e bloqueia suas ameaças.', delay: .65 },
  dificil: { label: 'Difícil', subtitle: 'Perfeito', description: 'Joga sem erros. Consegue arrancar um empate?', delay: .8 }
};
export const other = mark => mark === 'X' ? 'O' : 'X';
export const available = board => board.flatMap((mark, index) => mark === null ? [index] : []);
export function outcome(board) {
  const lines = LINES.filter(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  return { winner: lines.length ? board[lines[0][0]] : null, lines,
    draw: !lines.length && board.every(mark => mark !== null) };
}
export function createRound() {
  return { board: Array(9).fill(null), turn: 'X', history: [], winner: null, lines: [], draw: false };
}
export function move(round, cell, mark = round.turn) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || round.board[cell] !== null ||
      round.winner || round.draw || mark !== round.turn) return round;
  const board = [...round.board]; board[cell] = mark;
  return { board, turn: other(mark), history: [...round.history, cell], ...outcome(board) };
}
export function restoreRound(history) {
  if (!Array.isArray(history) || history.length > 9) return null;
  let round = createRound();
  for (const cell of history) {
    const next = move(round, cell);
    if (next === round) return null;
    round = next;
  }
  return round;
}
export function cleanRecord(value) {
  const number = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e7 ? n : 0;
  return { wins: number(value?.wins), draws: number(value?.draws), losses: number(value?.losses),
    streak: number(value?.streak), best: number(value?.best) };
}
