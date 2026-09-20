// Regras puras: nenhuma dependência de DOM, relógio ou conexão de rede.
const normalizeWord = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

function canSpell(word, letters) {
  const pool = [...letters];
  for (const char of normalizeWord(word)) {
    const at = pool.indexOf(char);
    if (at < 0) return false;
    pool.splice(at, 1);
  }
  return true;
}

function wordCells(word) {
  return [...word.text].map((letter, i) => ({
    key: `${word.row + (word.direction === 'down' ? i : 0)},${word.col + (word.direction === 'across' ? i : 0)}`,
    row: word.row + (word.direction === 'down' ? i : 0),
    col: word.col + (word.direction === 'across' ? i : 0), letter
  }));
}

function buildBoard(level) {
  const board = new Map();
  level.words.forEach((word, index) => wordCells(word).forEach(cell => {
    const existing = board.get(cell.key);
    if (existing && existing.letter !== cell.letter) throw new Error('Cruzamento inválido: ' + cell.key);
    if (existing) existing.words.push(index);
    else board.set(cell.key, { ...cell, words: [index] });
  }));
  return board;
}

function createSession(level, saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const board = buildBoard(level);
  const dictionary = new Map(level.words.map(word => [word.text, word]));
  const found = new Set((Array.isArray(saved.found) ? saved.found : []).filter(word => dictionary.has(word)));
  // Palavras bônus: saem das mesmas letras, mas não ocupam casa na grade.
  const bonusList = new Set(Array.isArray(level.bonus) ? level.bonus : []);
  const bonusFound = new Set((Array.isArray(saved.bonus) ? saved.bonus : []).filter(word => bonusList.has(word)));
  const bonusPoints = word => word.length * 5;
  const hints = new Set((Array.isArray(saved.hints) ? saved.hints : []).filter(key => board.has(key)).slice(0, 3));
  let hintsUsed = Math.min(3, Math.max(hints.size, Number.isInteger(saved.hintsUsed) ? saved.hintsUsed : 0));

  const availableLetters = () => level.letters + level.unlocks.filter(unlock => found.size >= unlock.after).map(unlock => unlock.letters).join('');
  const allLetters = level.letters + level.unlocks.map(unlock => unlock.letters).join('');
  function visibleCells() {
    const visible = new Set(hints);
    for (const text of found) for (const cell of wordCells(dictionary.get(text))) visible.add(cell.key);
    return visible;
  }
  function completeCrossings() {
    let changed;
    do {
      changed = false;
      const visible = visibleCells();
      for (const word of level.words) {
        if (!found.has(word.text) && canSpell(word.text, availableLetters()) && wordCells(word).every(cell => visible.has(cell.key))) {
          found.add(word.text); changed = true;
        }
      }
    } while (changed);
  }
  function result(before, oldLetters, extra = {}) {
    const added = [...found].filter(word => !before.has(word));
    return { status: 'correct', added, unlocked: availableLetters().slice(oldLetters.length), complete: found.size === level.words.length, ...extra };
  }
  function submit(value) {
    const text = normalizeWord(value);
    if (text.length < 3) return { status: 'short' };
    if (!canSpell(text, availableLetters())) return { status: 'unavailable' };
    if (found.has(text)) return { status: 'duplicate', word: text };
    if (!dictionary.has(text)) {
      if (!bonusList.has(text)) return { status: 'not-in-board' };
      if (bonusFound.has(text)) return { status: 'bonus-duplicate', word: text };
      bonusFound.add(text);
      return { status: 'bonus', word: text, points: bonusPoints(text) };
    }
    const before = new Set(found), letters = availableLetters();
    found.add(text); completeCrossings();
    return result(before, letters);
  }
  function hint() {
    if (found.size === level.words.length) return { status: 'complete' };
    if (hintsUsed >= 3) return { status: 'no-hints' };
    const visible = visibleCells();
    const options = level.words.filter(word => !found.has(word.text) && canSpell(word.text, availableLetters()))
      .map(word => wordCells(word).filter(cell => !visible.has(cell.key)))
      .filter(cells => cells.length).sort((a, b) => a.length - b.length);
    if (!options.length) return { status: 'no-hint-target' };
    const before = new Set(found), letters = availableLetters(), cell = options[0][0];
    hints.add(cell.key); hintsUsed++; completeCrossings();
    return result(before, letters, { status: 'hint', cell: cell.key, letter: cell.letter });
  }
  completeCrossings();
  return {
    level, board, allLetters, submit, hint, availableLetters, visibleCells,
    get found() { return new Set(found); },
    get hintsLeft() { return 3 - hintsUsed; },
    get complete() { return found.size === level.words.length; },
    get score() { return [...found].reduce((total, word) => total + word.length * 10, 0) + this.bonusScore; },
    get bonusFound() { return new Set(bonusFound); },
    get bonusTotal() { return bonusList.size; },
    get bonusScore() { return [...bonusFound].reduce((total, word) => total + bonusPoints(word), 0); },
    get nextUnlock() { return level.unlocks.find(unlock => found.size < unlock.after) || null; },
    snapshot: () => ({ found: [...found], hints: [...hints], hintsUsed, bonus: [...bonusFound] })
  };
}

export { normalizeWord, canSpell, wordCells, buildBoard, createSession };
