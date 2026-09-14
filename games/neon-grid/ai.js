import { available, other, outcome } from './model.js';

const sample = (list, random) => list[Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)))];
function winningMove(board, mark) {
  return available(board).find(cell => {
    const copy = [...board]; copy[cell] = mark;
    return outcome(copy).winner === mark;
  });
}

// Score depende do próprio tabuleiro, não da raiz da busca: o cache pode ser
// reutilizado entre rodadas. Mais casas livres favorecem uma vitória mais rápida.
const cache = new Map();
function minimax(board, turn, ai) {
  const result = outcome(board), empty = available(board);
  if (result.winner) return result.winner === ai ? 10 + empty.length : -10 - empty.length;
  if (result.draw) return 0;
  const key = board.map(mark => mark || '-').join('') + turn + ai;
  if (cache.has(key)) return cache.get(key);
  let best = turn === ai ? -Infinity : Infinity;
  for (const cell of empty) {
    const copy = [...board]; copy[cell] = turn;
    const score = minimax(copy, other(turn), ai);
    best = turn === ai ? Math.max(best, score) : Math.min(best, score);
  }
  cache.set(key, best);
  return best;
}

export function chooseMove(board, ai, difficulty = 'medio', random = Math.random) {
  const empty = available(board);
  if (!empty.length || outcome(board).winner) return null;
  if (difficulty === 'facil') return sample(empty, random);

  const win = winningMove(board, ai);
  if (win !== undefined) return win;
  if (difficulty !== 'dificil') {
    const block = winningMove(board, other(ai));
    if (block !== undefined) return block;
    if (board[4] === null) return 4;
    const corners = empty.filter(cell => [0, 2, 6, 8].includes(cell));
    return sample(corners.length ? corners : empty, random);
  }

  let best = -Infinity, choices = [];
  for (const cell of empty) {
    const copy = [...board]; copy[cell] = ai;
    const score = minimax(copy, other(ai), ai);
    if (score > best) { best = score; choices = [cell]; }
    else if (score === best) choices.push(cell);
  }
  return sample(choices, random);
}
