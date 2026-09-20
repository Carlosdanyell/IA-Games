import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  START_FEN, createPosition, toFen, legalMoves, makeMove, unmakeMove, perft,
  status, sanOf, findMove, parseSquare, algebraic, positionKey,
  moveFrom, moveTo, movePromotion, inCheck, attacked, generate
} from '../games/neon-chess/model.js';
import { chooseMove, LEVELS, evaluate } from '../games/neon-chess/ai.js';

const posicao = fen => createPosition(fen);
const lance = (pos, de, para, promocao = 0) => findMove(pos, parseSquare(de), parseSquare(para), promocao);
const jogar = (pos, de, para, promocao = 0) => {
  const move = lance(pos, de, para, promocao);
  assert.ok(move, `lance ${de}${para} deveria ser legal`);
  makeMove(pos, move);
  return move;
};
const sans = pos => legalMoves(pos).map(move => sanOf(pos, move));

// ---------------------------------------------------------------------- perft
// Contagem de folhas da árvore de lances. É a verificação definitiva: roque,
// en passant, promoção, cravada e xeque duplo entram todos nesses números, e
// qualquer erro muda o total. Os valores são os das posições padrão usadas por
// qualquer motor de xadrez.
const PERFTS = [
  ['posição inicial', START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['final com en passant', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['promoções e cravadas', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['posição fechada', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['meio-jogo equilibrado', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
];
for (const [nome, fen, esperados] of PERFTS) {
  test(`perft bate em ${nome}`, () => {
    const pos = posicao(fen);
    esperados.forEach((esperado, i) => {
      assert.equal(perft(pos, i + 1), esperado, `profundidade ${i + 1}`);
    });
    // A busca precisa devolver a posição exatamente como estava.
    assert.equal(toFen(pos), fen);
  });
}

test('jogar e desfazer restaura a posição, inclusive roque e en passant', () => {
  const pos = posicao('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const antes = toFen(pos);
  for (const move of legalMoves(pos)) {
    makeMove(pos, move);
    unmakeMove(pos);
    assert.equal(toFen(pos), antes, `desfazer ${algebraic(moveFrom(move))}${algebraic(moveTo(move))}`);
  }
});

// ------------------------------------------------------------- regras chave
test('o roque só sai com as casas livres, sem xeque e sem passar por ataque', () => {
  const livre = posicao('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.ok(sans(livre).includes('O-O') && sans(livre).includes('O-O-O'));

  // Torre preta em e8 ataca o rei branco: em xeque não há roque.
  const emXeque = posicao('4r3/8/2k5/8/8/8/8/R3K2R w KQ - 0 1');
  assert.ok(!sans(emXeque).some(texto => texto.startsWith('O-O')));

  // Torre em f8 ataca f1, casa por onde o rei passaria no roque curto.
  const caminho = posicao('5r2/8/2k5/8/8/8/8/R3K2R w KQ - 0 1');
  const comCaminho = sans(caminho);
  assert.ok(!comCaminho.includes('O-O'), 'não pode passar por casa atacada');
  assert.ok(comCaminho.includes('O-O-O'), 'o lado da dama continua livre');

  // b1 atacada não impede o roque longo: quem não pode ser atacado é o rei.
  const b1 = posicao('1r6/8/4k3/8/8/8/8/R3K2R w KQ - 0 1');
  assert.ok(sans(b1).includes('O-O-O'));
});

test('o roque move a torre e desfazer devolve as duas peças', () => {
  const pos = posicao('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  jogar(pos, 'e1', 'g1');
  assert.equal(pos.board[parseSquare('f1')], ROOK | WHITE);
  assert.equal(pos.board[parseSquare('g1')], KING | WHITE);
  assert.equal(pos.board[parseSquare('h1')], 0);
  unmakeMove(pos);
  assert.equal(pos.board[parseSquare('h1')], ROOK | WHITE);
  assert.equal(pos.board[parseSquare('e1')], KING | WHITE);
});

test('en passant captura o peão que passou, e só no lance seguinte', () => {
  const pos = posicao('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const captura = lance(pos, 'e5', 'f6');
  assert.ok(captura, 'a captura en passant precisa existir');
  makeMove(pos, captura);
  assert.equal(pos.board[parseSquare('f5')], 0, 'o peão capturado sai do tabuleiro');
  assert.equal(pos.board[parseSquare('f6')], PAWN | WHITE);
  unmakeMove(pos);
  assert.equal(pos.board[parseSquare('f5')], PAWN | BLACK, 'desfazer devolve o peão capturado');

  // Sem o direito registrado na posição, a mesma captura não existe.
  const tarde = posicao('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3');
  assert.equal(lance(tarde, 'e5', 'f6'), 0);
});

test('a promoção oferece as quatro peças e aplica a escolhida', () => {
  const pos = posicao('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  const destinos = legalMoves(pos).filter(move => moveTo(move) === parseSquare('a8'));
  assert.deepEqual(destinos.map(movePromotion).sort(), [KNIGHT, BISHOP, ROOK, QUEEN].sort());
  jogar(pos, 'a7', 'a8', KNIGHT);
  assert.equal(pos.board[parseSquare('a8')], KNIGHT | WHITE);
  unmakeMove(pos);
  assert.equal(pos.board[parseSquare('a7')], PAWN | WHITE, 'desfazer devolve o peão');
});

test('peça cravada não pode abandonar a coluna do rei', () => {
  // Cavalo em e2 cravado pela torre preta em e8.
  const pos = posicao('4r3/8/2k5/8/8/8/4N3/4K3 w - - 0 1');
  const saidas = legalMoves(pos).filter(move => moveFrom(move) === parseSquare('e2'));
  assert.equal(saidas.length, 0, 'o cavalo cravado não tem lance');
});

// ------------------------------------------------------------- fim de partida
test('reconhece xeque-mate, afogamento e material insuficiente', () => {
  const mate = posicao('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  const fimMate = status(mate);
  assert.equal(fimMate.over, true);
  assert.equal(fimMate.reason, 'mate');
  assert.equal(fimMate.result, 'black');

  const afogado = posicao('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const fimAfogado = status(afogado);
  assert.equal(fimAfogado.reason, 'stalemate');
  assert.equal(fimAfogado.result, 'draw');
  assert.equal(fimAfogado.check, false);

  assert.equal(status(posicao('8/8/4k3/8/8/4K3/8/8 w - - 0 1')).reason, 'material');
  assert.equal(status(posicao('8/8/4k3/8/8/4K1N1/8/8 w - - 0 1')).reason, 'material');
  assert.equal(status(posicao('8/8/4k3/8/8/4K1R1/8/8 w - - 0 1')).over, false, 'torre ainda dá mate');
});

test('empate por 50 lances e por tripla repetição', () => {
  assert.equal(status(posicao('8/8/4k3/8/8/4K1R1/8/8 w - - 100 80')).reason, 'fifty');

  // Cavalos indo e voltando: a terceira vez que a posição aparece é empate.
  const pos = posicao();
  const chaves = [positionKey(pos)];
  for (const [de, para] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
                            ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']]) {
    jogar(pos, de, para);
    chaves.push(positionKey(pos));
  }
  const fim = status(pos, chaves);
  assert.equal(fim.reason, 'repetition');
  assert.equal(fim.result, 'draw');
});

// ---------------------------------------------------------------------- SAN
test('a notação em português desambigua e marca xeque e mate', () => {
  // Cavalos em d2 e g1 disputam f3: a coluna de origem resolve.
  const cavalos = posicao('7k/8/8/8/8/8/3N4/K5N1 w - - 0 1');
  const porColuna = sans(cavalos);
  assert.ok(porColuna.includes('Cdf3') && porColuna.includes('Cgf3'),
    `desambiguação por coluna ausente em ${porColuna.join(' ')}`);

  // Torres em a1 e a8 disputam a4 na mesma coluna: aí só a linha resolve.
  const torres = posicao('R7/8/7k/8/8/8/8/R6K w - - 0 1');
  const porLinha = sans(torres);
  assert.ok(porLinha.includes('T1a4') && porLinha.includes('T8a4'),
    `desambiguação por linha ausente em ${porLinha.join(' ')}`);

  const mate = posicao('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1');
  const mateEmUm = legalMoves(mate).map(move => sanOf(mate, move)).find(texto => texto.endsWith('#'));
  assert.equal(mateEmUm, 'Dxf7#');

  const roque = posicao('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const comRoque = sans(roque);
  assert.ok(comRoque.includes('O-O') && comRoque.includes('O-O-O'));

  const promocao = posicao('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.ok(sans(promocao).includes('a8=D'));
});

test('FEN sobrevive à ida e à volta', () => {
  for (const [, fen] of PERFTS.map(item => [item[0], item[1]])) {
    assert.equal(toFen(createPosition(fen)), fen);
  }
});

// -------------------------------------------------------------------- motor
test('a máquina acha o mate em um em todos os níveis que enxergam um lance', () => {
  for (const nivel of Object.keys(LEVELS)) {
    const pos = posicao('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1');
    const escolha = chooseMove(pos, nivel, { random: () => 0.5 });
    assert.ok(escolha, `${nivel} precisa devolver um lance`);
    assert.equal(sanOf(pos, escolha.move), 'Dxf7#', `${nivel} deixou passar o mate em um`);
  }
});

test('a máquina não devolve lance quando a partida acabou', () => {
  const mate = posicao('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  assert.equal(chooseMove(mate, 'medio'), null);
});

test('os níveis difíceis capturam material de graça e respeitam o prazo', () => {
  for (const nivel of ['medio', 'dificil']) {
    const pos = posicao('4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1');
    const escolha = chooseMove(pos, nivel);
    assert.equal(sanOf(pos, escolha.move), 'Dxd5', `${nivel} deixou a torre passar`);
    // O prazo é o que mantém o lance viável em celular. Uma folga de 3x cobre
    // a granularidade da checagem de tempo sem deixar a busca correr solta.
    assert.ok(escolha.ms < LEVELS[nivel].budget * 3 + 200,
      `${nivel} gastou ${escolha.ms.toFixed(0)}ms para um orçamento de ${LEVELS[nivel].budget}ms`);
  }
});

test('a avaliação enxerga vantagem material pelo lado que tem a vez', () => {
  const brancasAcima = posicao('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
  assert.ok(evaluate(brancasAcima) > 500, 'dama a mais precisa valer muito para quem joga');
  const pretasJogam = posicao('4k3/8/8/8/8/8/8/3QK3 b - - 0 1');
  assert.ok(evaluate(pretasJogam) < -500, 'a mesma posição é ruim para quem está sem a dama');
});

test('a busca deixa a posição intacta depois de escolher', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const pos = posicao(fen);
  chooseMove(pos, 'dificil');
  assert.equal(toFen(pos), fen);
  assert.equal(pos.stack.length, 0, 'a pilha de desfazer precisa terminar vazia');
});

test('níveis fracos continuam jogando lances legais', () => {
  const pos = posicao();
  const legais = new Set(legalMoves(pos));
  for (let i = 0; i < 12; i++) {
    const escolha = chooseMove(pos, 'iniciante', { random: Math.random });
    assert.ok(legais.has(escolha.move), 'lance fora da lista legal');
  }
});
