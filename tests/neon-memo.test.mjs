import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, dailyLevel } from '../games/neon-memo/levels.js';
import { FIGURES, FAMILIES, familyFigures, WILD } from '../games/neon-memo/figures.js';
import { buildDeck, createSession, cardCount, setSize, wildCount, ruleOf, parMoves, timeLimit } from '../games/neon-memo/model.js';

// Joga a fase inteira com conhecimento do baralho: é o piso do jogo — se um
// roteiro que sabe onde está cada carta não fecha o tabuleiro, a regra está
// quebrada e nenhum jogador fecharia também.
function solve(session) {
  let guard = 0;
  while (!session.complete && guard++ < 400) {
    const open = session.cards.filter(card => !session.isMatched(card.index));
    const wild = open.find(card => card.wild);
    const partner = open.find(card => !card.wild);
    let set;
    if (wild && partner) set = [wild.index, partner.index];
    else if (wild) set = open.filter(card => card.wild).slice(0, session.size).map(card => card.index);
    else {
      const first = open[0];
      const key = ruleOf(session.level).byFamily ? 'family' : 'figure';
      set = open.filter(card => card[key] === first[key]).slice(0, session.size).map(card => card.index);
    }
    let result;
    for (const index of set) result = session.flip(index);
    assert.equal(result.status, 'match', 'jogada certa devolveu ' + result.status);
  }
  return session;
}

test('figuras: ids únicos, nome e desenho em todas', () => {
  const ids = FIGURES.map(item => item.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'id repetido em figures.js');
  for (const item of FIGURES) {
    assert.ok(item.name && item.name.trim(), `${item.id} sem nome`);
    assert.ok(item.art.includes('<path') || item.art.includes('<circle') || item.art.includes('<rect'), `${item.id} sem desenho`);
    assert.ok(item.family === 'coringa' || FAMILIES.some(family => family.id === item.family), `${item.id} em família desconhecida`);
  }
  assert.ok(FIGURES.some(item => item.id === WILD), 'o camaleão (coringa) precisa existir');
  for (const family of FAMILIES) {
    assert.ok(familyFigures(family.id).length >= 3, `família ${family.id} precisa de ao menos 3 figuras`);
  }
});

test('as 25 fases cabem no tabuleiro que declaram', () => {
  assert.equal(LEVELS.length, 25);
  for (const level of LEVELS) {
    assert.equal(cardCount(level), level.cols * level.rows,
      `${level.name}: ${cardCount(level)} cartas em grade ${level.cols}x${level.rows}`);
    assert.ok(level.peek > 0, `${level.name} sem espiada inicial`);
    assert.ok(level.hints >= 1, `${level.name} sem dica`);
    assert.ok(parMoves(level) >= level.groups, `${level.name}: par de jogadas impossível`);
    if (ruleOf(level).timed) assert.ok(timeLimit(level) > 0, `${level.name} sem limite de tempo`);
  }
  const ids = LEVELS.map(level => level.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'fases fora de ordem');
});

test('o baralho de cada fase sai completo e igual para o mesmo seed', () => {
  for (const level of LEVELS) {
    const deck = buildDeck(level, level.id * 31 + 7);
    assert.equal(deck.length, cardCount(level), `${level.name}: baralho do tamanho errado`);
    const groups = new Map();
    for (const card of deck) groups.set(card.group, (groups.get(card.group) || 0) + 1);
    const wilds = deck.filter(card => card.wild);
    assert.equal(wilds.length, wildCount(level), `${level.name}: coringas a mais ou a menos`);
    for (const [group, count] of groups) {
      if (group.startsWith('coringa:')) { assert.equal(count, 1); continue; }
      assert.equal(count, setSize(level), `${level.name}: conjunto ${group} com ${count} cartas`);
    }
    const again = buildDeck(level, level.id * 31 + 7);
    assert.deepEqual(again.map(card => card.figure), deck.map(card => card.figure), `${level.name}: seed não é determinístico`);
  }
});

test('toda fase fecha quando as jogadas estão certas', () => {
  for (const level of LEVELS) {
    const session = solve(createSession(level, { seed: level.id * 13 + 5 }));
    assert.ok(session.complete, `${level.name} não fechou`);
    assert.equal(session.status, 'done');
    assert.equal(session.moves, level.groups, `${level.name}: jogadas demais`);
    assert.equal(session.stars(), 3, `${level.name}: partida perfeita sem três estrelas`);
    assert.ok(session.score > 0);
  }
});

test('par errado volta para baixo e conta erro', () => {
  const level = LEVELS[4];
  const session = createSession(level, { seed: 99 });
  const first = session.cards[0];
  const wrong = session.cards.find(card => card.figure !== first.figure);
  session.flip(first.index);
  const miss = session.flip(wrong.index);
  assert.equal(miss.status, 'miss');
  assert.equal(session.mistakes, 1);
  assert.deepEqual(session.pending.sort(), [first.index, wrong.index].sort());
  assert.ok(session.isFaceUp(first.index), 'a carta errada fica à mostra até a interface desvirar');
  session.settle();
  assert.equal(session.isFaceUp(first.index), false);
  assert.equal(session.combo, 0);
});

test('camaleão leva o par inteiro da figura que abriu com ele', () => {
  const level = LEVELS.find(item => item.rule === 'coringa');
  const session = createSession(level, { seed: 7 });
  const wild = session.cards.find(card => card.wild);
  const partner = session.cards.find(card => !card.wild);
  session.flip(wild.index);
  const result = session.flip(partner.index);
  assert.equal(result.status, 'match');
  assert.equal(result.wild, true);
  assert.equal(result.cards.length, 3, 'o coringa e as duas cartas da figura saem juntos');
  assert.ok(session.cards.filter(card => card.figure === partner.figure).every(card => session.isMatched(card.index)));
});

test('troca-troca embaralha sem perder carta', () => {
  const level = LEVELS.find(item => item.rule === 'troca');
  const session = createSession(level, { seed: 21 });
  const before = session.cards.map(card => card.figure).sort();
  let swaps = [];
  for (let round = 0; round < 2; round++) {
    const open = session.cards.filter(card => !session.isMatched(card.index));
    const a = open[0], b = open.find(card => card.figure !== a.figure);
    session.flip(a.index);
    swaps = session.flip(b.index).swaps;
  }
  assert.equal(swaps.length, 1, 'dois erros precisam trocar duas cartas de lugar');
  assert.deepEqual(session.cards.map(card => card.figure).sort(), before, 'a troca não pode criar nem sumir com carta');
  assert.deepEqual(session.cards.map(card => card.index), session.cards.map((_, i) => i), 'índices fora de ordem após a troca');
});

test('relâmpago encerra quando o tempo vence', () => {
  const level = LEVELS.find(item => item.rule === 'relampago');
  const session = createSession(level, { seed: 3 });
  assert.equal(session.tick(timeLimit(level) - 1), 'playing');
  assert.equal(session.tick(2), 'timeout');
  assert.equal(session.flip(0).status, 'blocked', 'não dá para jogar depois do tempo');
});

test('dica revela um conjunto fechado e cobra pontos', () => {
  const session = createSession(LEVELS[8], { seed: 5 });
  const hint = session.hint();
  assert.equal(hint.cards.length, setSize(LEVELS[8]));
  assert.equal(session.hintsLeft, LEVELS[8].hints - 1);
  const card = session.cards[hint.cards[0]];
  assert.ok(hint.cards.every(index => session.cards[index].group === card.group));
});

test('o tabuleiro salvo volta como estava', () => {
  const level = LEVELS[6];
  const session = createSession(level, { seed: 17 });
  const first = session.cards[0];
  const twin = session.cards.find(card => card.index !== first.index && card.figure === first.figure);
  session.flip(first.index); session.flip(twin.index);
  const snapshot = session.snapshot();
  const restored = createSession(level, { seed: 17, saved: snapshot });
  assert.equal(restored.found, 1);
  assert.equal(restored.moves, session.moves);
  assert.equal(restored.score, session.score);
  assert.ok(restored.isMatched(first.index) && restored.isMatched(twin.index));
  assert.deepEqual(restored.cards.map(card => card.figure), session.cards.map(card => card.figure));
});

test('desafio do dia é o mesmo tabuleiro o dia inteiro', () => {
  const level = dailyLevel(1234, '20/09');
  assert.equal(cardCount(level), level.cols * level.rows);
  const a = buildDeck(level, 1234), b = buildDeck(level, 1234);
  assert.deepEqual(a.map(card => card.group), b.map(card => card.group));
  assert.notDeepEqual(buildDeck(level, 4321).map(card => card.figure), a.map(card => card.figure));
});
