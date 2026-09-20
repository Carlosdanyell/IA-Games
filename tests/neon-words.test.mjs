import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../games/neon-words/levels.js';
import { canSpell, buildBoard, wordCells, normalizeWord, createSession } from '../games/neon-words/model.js';
import { PALETTE_OPTIONS } from '../core/theme.js';

// As fases são dados escritos à mão: um cruzamento errado ou uma palavra que
// não sai das letras da roda só aparece quando o jogador já está na fase.
// Estes testes conferem o catálogo inteiro antes de o jogo chegar ao aparelho.
const PALETTES = PALETTE_OPTIONS.map(option => option.value).filter(value => value !== 'auto');
const lettersOf = level => level.letters + level.unlocks.map(unlock => unlock.letters).join('');
const tagOf = level => `fase ${level.id} (${level.name})`;
// Formas de plural que o português usa nas palavras curtas do jogo.
const pluralsOf = word => [word + 'S', word + 'ES', word.replace(/L$/, 'IS'), word.replace(/M$/, 'NS'),
  word.replace(/R$/, 'RES'), word.replace(/Z$/, 'ZES')].filter(form => form !== word);

test('cada fase tem id em sequência, nome e cor do tema', () => {
  LEVELS.forEach((level, index) => {
    assert.equal(level.id, index + 1, 'id fora de sequência em ' + tagOf(level));
    assert.ok(level.name, 'fase sem nome no índice ' + index);
    assert.ok(PALETTES.includes(level.palette), `${tagOf(level)}: cor "${level.palette}" não existe em core/theme.js`);
  });
});

test('toda palavra sai das letras da roda', () => {
  for (const level of LEVELS) for (const word of level.words) {
    assert.equal(word.text, normalizeWord(word.text), `${tagOf(level)}: "${word.text}" precisa estar em maiúsculas e sem acento`);
    assert.ok(word.text.length >= 3, `${tagOf(level)}: "${word.text}" tem menos de 3 letras`);
    assert.ok(canSpell(word.text, lettersOf(level)), `${tagOf(level)}: "${word.text}" não sai de ${lettersOf(level)}`);
  }
});

test('nenhuma fase repete palavra nem junta singular e plural', () => {
  for (const level of LEVELS) {
    // Bônus e grade dividem a mesma roda de letras, então a regra vale para os dois.
    const texts = [...level.words.map(word => word.text), ...level.bonus];
    assert.equal(new Set(texts).size, texts.length, tagOf(level) + ': palavra repetida');
    for (const [index, word] of texts.entries()) for (const other of texts.slice(index + 1))
      assert.ok(!pluralsOf(word).includes(other) && !pluralsOf(other).includes(word),
        `${tagOf(level)}: "${word}" e "${other}" são a mesma palavra no singular e no plural`);
  }
});

test('as palavras bônus saem das letras da fase e ficam fora da grade', () => {
  for (const level of LEVELS) {
    assert.ok(Array.isArray(level.bonus), tagOf(level) + ': falta a lista de bônus');
    const grade = level.words.map(word => word.text);
    for (const word of level.bonus) {
      assert.equal(word, normalizeWord(word), `${tagOf(level)}: bônus "${word}" precisa estar em maiúsculas e sem acento`);
      assert.ok(word.length >= 3, `${tagOf(level)}: bônus "${word}" tem menos de 3 letras`);
      assert.ok(canSpell(word, lettersOf(level)), `${tagOf(level)}: bônus "${word}" não sai de ${lettersOf(level)}`);
      assert.ok(!grade.includes(word), `${tagOf(level)}: "${word}" está na grade e na lista de bônus`);
    }
  }
});

test('bônus pontua, não repete e não conta para completar a fase', () => {
  const level = LEVELS.find(candidate => candidate.bonus.length && !candidate.unlocks.length);
  const session = createSession(level);
  const [word] = level.bonus;
  const first = session.submit(word);
  assert.equal(first.status, 'bonus', 'a primeira tentativa devia ser aceita como bônus');
  assert.equal(first.points, word.length * 5, 'bônus vale 5 pontos por letra');
  assert.equal(session.score, first.points, 'o placar da fase soma o bônus');
  assert.equal(session.submit(word.toLowerCase()).status, 'bonus-duplicate', 'bônus repetido devia ser recusado');
  assert.equal(session.found.size, 0, 'bônus não entra na contagem de palavras da grade');
  assert.equal(session.complete, false, 'bônus não completa a fase');
  const listadas = new Set([...level.words.map(word => word.text), ...level.bonus]);
  const letras = [...level.letters];
  const intrusa = letras.flatMap(a => letras.flatMap(b => letras.map(c => a + b + c)))
    .find(tentativa => new Set(tentativa).size === 3 && !listadas.has(tentativa));
  assert.equal(session.submit(intrusa).status, 'not-in-board', `"${intrusa}" sai das letras mas não é palavra da fase`);
  // O bônus tem de sobreviver ao salvamento, como as palavras da grade.
  const revivida = createSession(level, session.snapshot());
  assert.deepEqual([...revivida.bonusFound], [word], 'o bônus encontrado devia voltar do save');
  assert.equal(revivida.score, first.points, 'os pontos do bônus voltam com o save');
});

test('as letras liberadas chegam depois de palavras suficientes', () => {
  for (const level of LEVELS) {
    let previous = 0, available = level.letters;
    for (const unlock of level.unlocks) {
      assert.ok(unlock.letters, tagOf(level) + ': desbloqueio sem letras');
      assert.ok(unlock.after > previous, tagOf(level) + ': desbloqueios fora de ordem');
      const reachable = level.words.filter(word => canSpell(word.text, available)).length;
      assert.ok(reachable >= unlock.after,
        `${tagOf(level)}: só ${reachable} palavras antes de liberar ${unlock.letters}, que pede ${unlock.after}`);
      assert.ok(level.words.some(word => !canSpell(word.text, available) && canSpell(word.text, available + unlock.letters)),
        `${tagOf(level)}: nenhuma palavra depende de ${unlock.letters}`);
      previous = unlock.after; available += unlock.letters;
    }
  }
});

test('a grade cabe na fase e os cruzamentos batem', () => {
  for (const level of LEVELS) {
    assert.doesNotThrow(() => buildBoard(level), tagOf(level) + ': cruzamento com letras diferentes');
    for (const word of level.words) for (const cell of wordCells(word))
      assert.ok(cell.row >= 0 && cell.col >= 0 && cell.row < level.rows && cell.col < level.cols,
        `${tagOf(level)}: "${word.text}" sai da grade ${level.rows}x${level.cols}`);
  }
});

// Duas palavras lado a lado formariam na grade uma terceira palavra que o jogo
// recusa: toda sequência de letras vizinhas tem de ser uma palavra da fase.
test('a grade não forma palavras que a fase não aceita', () => {
  for (const level of LEVELS) {
    const board = buildBoard(level);
    const letterAt = (row, col) => board.get(`${row},${col}`)?.letter;
    for (const [down, lines, length] of [[false, level.rows, level.cols], [true, level.cols, level.rows]]) {
      for (let line = 0; line < lines; line++) {
        let run = '', start = 0;
        for (let step = 0; step <= length; step++) {
          const letter = step === length ? undefined : (down ? letterAt(step, line) : letterAt(line, step));
          if (letter) { if (!run) start = step; run += letter; continue; }
          if (run.length > 1) assert.ok(level.words.some(word => word.text === run && (word.direction === 'down') === down &&
            (down ? word.col === line && word.row === start : word.row === line && word.col === start)),
            `${tagOf(level)}: a grade forma "${run}" sem ser uma palavra da fase`);
          run = '';
        }
      }
    }
  }
});

test('toda palavra cruza com outra', () => {
  for (const level of LEVELS) {
    const board = buildBoard(level);
    const groups = level.words.map((_, index) => index);
    const find = index => groups[index] === index ? index : (groups[index] = find(groups[index]));
    for (const cell of board.values()) for (const other of cell.words.slice(1)) groups[find(other)] = find(cell.words[0]);
    assert.equal(new Set(level.words.map((_, index) => find(index))).size, 1, tagOf(level) + ': palavra solta, sem cruzamento');
  }
});

test('cada fase é vencível formando as palavras na ordem do catálogo', () => {
  for (const level of LEVELS) {
    const session = createSession(level);
    // Repete as passadas porque uma palavra pode depender de letras que só
    // aparecem depois de outra ser encontrada.
    for (let pass = 0; pass < level.words.length && !session.complete; pass++)
      for (const word of level.words) session.submit(word.text);
    assert.ok(session.complete, tagOf(level) + ': não dá para completar formando as palavras da própria fase');
  }
});
