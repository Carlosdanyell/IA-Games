import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, HOST, GUEST, colorsFor } from '../games/neon-chess/lan-match.js';
import {
  encodeSignal, decodeSignal, cleanName, escapeHtml,
  validCommand, validSnapshot, validMove, validMoveList, PROTOCOL
} from '../games/neon-chess/lan-protocol.js';
import { WHITE, BLACK, parseSquare, toFen, findMove, legalMoves, sanOf } from '../games/neon-chess/model.js';

// Liga dois lados com a mesma roteação que o jogo usa: o convidado manda
// comandos, o anfitrião aplica e devolve o estado. Nada de DOM nem de WebRTC —
// as regras dos dois lados são as de verdade.
function sala(nomes = ['Ana', 'Beto']) {
  const host = createMatch({ seat: HOST, names: nomes });
  const guest = createMatch({ seat: GUEST, names: nomes });
  const registro = { recusados: [] };
  const transmitir = () => guest.applySnapshot(host.snapshot());
  const comando = payload => {
    const mudou = host.applyCommand(payload, GUEST);
    if (mudou) transmitir(); else registro.recusados.push(payload);
    return mudou;
  };
  return {
    host, guest, registro, transmitir, comando,
    // Lance de quem está com a vez, informando as casas como a interface faria.
    lance(assento, de, para, promocao = 0) {
      const lado = assento === HOST ? host : guest;
      const move = lado.findLocalMove(parseSquare(de), parseSquare(para), promocao);
      if (!move) return false;
      if (assento === HOST) {
        const ok = host.play(move, HOST);
        if (ok) transmitir();
        return ok;
      }
      return comando(guest.command('move', move));
    },
    iguais() {
      return toFen(host.position) === toFen(guest.position) &&
        host.sans.join(' ') === guest.sans.join(' ');
    }
  };
}

test('os dois aparelhos terminam com o mesmo tabuleiro', () => {
  const s = sala();
  assert.equal(s.lance(HOST, 'e2', 'e4'), true);
  assert.equal(s.lance(GUEST, 'e7', 'e5'), true);
  assert.equal(s.lance(HOST, 'g1', 'f3'), true);
  assert.equal(s.lance(GUEST, 'b8', 'c6'), true);
  assert.ok(s.iguais(), 'host e convidado precisam ver a mesma posição');
  assert.deepEqual(s.guest.sans, ['e4', 'e5', 'Cf3', 'Cc6']);
  assert.equal(s.guest.state.moves.length, 4);
  assert.equal(s.host.snapshot().revision, 4, 'o pacote leva a revisão da lista');
});

test('o anfitrião recusa lance fora da vez', () => {
  const s = sala();
  // O convidado joga de pretas: não pode abrir a partida.
  assert.equal(s.lance(GUEST, 'e7', 'e5'), false);
  assert.equal(s.host.state.moves.length, 0);
  assert.equal(s.guest.state.moves.length, 0);
});

test('comando repetido ou com revisão antiga é descartado', () => {
  const s = sala();
  s.lance(HOST, 'e2', 'e4');
  const move = s.guest.findLocalMove(parseSquare('e7'), parseSquare('e5'));
  const pedido = s.guest.command('move', move);
  assert.equal(s.comando(pedido), true);
  // O mesmo pacote chegando de novo (toque duplo, reenvio) não joga duas vezes.
  assert.equal(s.comando(pedido), false);
  assert.equal(s.host.state.moves.length, 2);
  assert.ok(s.iguais());
});

test('o anfitrião recusa lance ilegal e partida de outra sala', () => {
  const s = sala();
  s.lance(HOST, 'e2', 'e4');
  // Cavalo saltando para casa ocupada pela própria peça.
  assert.equal(s.comando({ type: 'command', action: 'move', move: 0, match: 0, revision: 1, seq: 9 }), false);
  assert.equal(s.comando({ ...s.guest.command('move', s.guest.findLocalMove(parseSquare('e7'), parseSquare('e5'))), match: 7 }), false);
  assert.equal(s.host.state.moves.length, 1);
});

test('o convidado ignora pacote repetido e recusa lista ilegal', () => {
  const s = sala();
  s.lance(HOST, 'e2', 'e4');
  const pacote = s.host.snapshot();
  assert.equal(s.guest.applySnapshot(pacote).ok, true);
  assert.equal(s.guest.applySnapshot(pacote).ok, false, 'pacote com seq já visto não se aplica duas vezes');

  // Lista adulterada: o segundo "lance" não é legal na posição.
  const falso = s.host.snapshot();
  falso.moves = [falso.moves[0], falso.moves[0]];
  falso.revision = 2;
  const recusa = s.guest.applySnapshot(falso);
  assert.equal(recusa.ok, false);
  assert.equal(recusa.reason, 'lance ilegal no pacote');
  assert.equal(s.guest.state.moves.length, 1, 'o tabuleiro do convidado não muda com pacote recusado');
});

test('pausa vale para os dois e só volta com as duas confirmações', () => {
  const s = sala();
  s.lance(HOST, 'e2', 'e4');
  assert.equal(s.comando(s.guest.command('pause')), true);
  assert.equal(s.host.state.paused, true);
  assert.equal(s.guest.state.paused, true);
  assert.equal(s.guest.myTurn(), false, 'ninguém joga com a sala pausada');

  assert.equal(s.comando(s.guest.command('resume')), true);
  assert.equal(s.host.state.paused, true, 'um lado sozinho não retoma');
  s.host.confirmResume(HOST);
  s.transmitir();
  assert.equal(s.host.state.paused, false);
  assert.equal(s.guest.state.paused, false);
});

test('revanche exige os dois, troca as cores e guarda o placar', () => {
  const s = sala();
  // Mate do bobo, com o convidado dando o mate de pretas.
  s.lance(HOST, 'f2', 'f3');
  s.lance(GUEST, 'e7', 'e5');
  s.lance(HOST, 'g2', 'g4');
  s.lance(GUEST, 'd8', 'h4');
  assert.equal(s.host.state.flow, 'over');
  assert.equal(s.guest.state.flow, 'over');
  assert.equal(s.host.state.result, 'black');
  assert.deepEqual(s.host.state.wins, [0, 1, 0], 'a vitória é do assento do convidado');
  assert.deepEqual(s.guest.state.wins, [0, 1, 0]);
  assert.equal(s.guest.sans.at(-1), 'Dh4#');

  assert.equal(s.comando(s.guest.command('rematch')), true);
  assert.equal(s.host.state.match, 0, 'uma confirmação só não reinicia');
  s.host.confirmRematch(HOST);
  s.transmitir();
  assert.equal(s.host.state.match, 1);
  assert.equal(s.host.state.moves.length, 0);
  assert.deepEqual(s.host.state.colors, colorsFor(1), 'a revanche troca as cores');
  assert.equal(s.host.myColor(), BLACK);
  assert.equal(s.guest.myColor(), WHITE);
  assert.deepEqual(s.guest.state.wins, [0, 1, 0], 'o placar da sala continua');
  assert.equal(s.guest.myTurn(), true, 'agora quem abre é o convidado');
});

test('entregar a partida dá a vitória ao adversário', () => {
  const s = sala();
  s.lance(HOST, 'e2', 'e4');
  assert.equal(s.comando(s.guest.command('resign')), true);
  assert.equal(s.host.state.flow, 'over');
  assert.equal(s.host.state.reason, 'resign');
  assert.equal(s.host.state.result, 'white', 'quem entrega perde');
  assert.deepEqual(s.host.state.wins, [1, 0, 0]);
  assert.equal(s.guest.state.flow, 'over');
  assert.equal(s.guest.state.reason, 'resign');
});

test('empate por afogamento conta como empate da sala', () => {
  const s = sala();
  // Sequência conhecida que termina em afogamento no lance 10 das pretas.
  const linha = [[HOST, 'e2', 'e3'], [GUEST, 'a7', 'a5'], [HOST, 'd1', 'h5'], [GUEST, 'a8', 'a6'],
                 [HOST, 'h5', 'a5'], [GUEST, 'h7', 'h5'], [HOST, 'a5', 'c7'], [GUEST, 'a6', 'h6'],
                 [HOST, 'h2', 'h4'], [GUEST, 'f7', 'f6'], [HOST, 'c7', 'd7'], [GUEST, 'e8', 'f7'],
                 [HOST, 'd7', 'b7'], [GUEST, 'd8', 'd3'], [HOST, 'b7', 'b8'], [GUEST, 'd3', 'h7'],
                 [HOST, 'b8', 'c8'], [GUEST, 'f7', 'g6'], [HOST, 'c8', 'e6']];
  for (const [assento, de, para] of linha) {
    assert.equal(s.lance(assento, de, para), true, `lance ${de}${para}`);
  }
  assert.equal(s.host.state.flow, 'over');
  assert.equal(s.host.state.reason, 'stalemate');
  assert.deepEqual(s.host.state.wins, [0, 0, 1]);
  assert.ok(s.iguais());
});

test('a sala para de aceitar lance depois do fim', () => {
  const s = sala();
  s.lance(HOST, 'f2', 'f3');
  s.lance(GUEST, 'e7', 'e5');
  s.lance(HOST, 'g2', 'g4');
  s.lance(GUEST, 'd8', 'h4');
  assert.equal(s.lance(HOST, 'g1', 'f3'), false);
  assert.equal(s.host.state.moves.length, 4);
});

// ------------------------------------------------------------------ protocolo
test('convite e resposta sobrevivem à ida e à volta', () => {
  const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=candidate:1 1 udp 1 192.168.0.5 40000 typ host\r\n';
  const room = 'abcdefgh-1234-5678-9012-abcdefabcdef';
  const convite = encodeSignal('offer', room, sdp);
  const lido = decodeSignal(convite, 'offer');
  assert.equal(lido.room, room);
  assert.equal(lido.sdp, sdp);
  assert.equal(lido.v, PROTOCOL);
  // O link com o fragmento também é aceito.
  assert.equal(decodeSignal(`https://exemplo.test/play.html#chess=${convite}`, 'offer').room, room);
});

test('o protocolo recusa código de outro jogo, tipo trocado e sem candidato', () => {
  const sdp = 'v=0\r\na=candidate:1 1 udp 1 192.168.0.5 40000 typ host\r\n';
  const room = 'abcdefgh-1234-5678-9012-abcdefabcdef';
  const convite = encodeSignal('offer', room, sdp);
  assert.throws(() => decodeSignal(convite, 'answer'), /resposta do outro jogador/);
  assert.throws(() => decodeSignal('NPOOL1.abc', 'offer'), /Neon Chess/);
  assert.throws(() => decodeSignal('lixo', 'offer'), /convite ou código completo/);
  assert.throws(() => decodeSignal(encodeSignal('offer', room, 'v=0\r\n'), 'offer'), /endereço de rede/);
});

test('nomes são limpos antes de aparecer na tela', () => {
  assert.equal(cleanName('  Ana   Maria  '), 'Ana Maria');
  assert.equal(cleanName('<script>alert(1)</script>'), 'scriptalert(', 'sinais de tag saem e o nome é cortado em 12');
  assert.equal(cleanName(''), 'Jogador 1');
  assert.equal(cleanName('', 1), 'Jogador 2');
  assert.equal(cleanName('nome muito comprido demais').length, 12);
  assert.equal(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});

test('validadores recusam pacote malformado', () => {
  assert.equal(validMove(-1), false);
  assert.equal(validMove(1.5), false);
  assert.equal(validMoveList(new Array(999).fill(0)), false, 'lista longa demais');
  assert.equal(validCommand({ action: 'move', move: 0, match: 0, revision: 0, seq: 0 }), true);
  assert.equal(validCommand({ action: 'voar', match: 0, revision: 0, seq: 0 }), false);
  assert.equal(validCommand({ action: 'pause', match: -1, revision: 0, seq: 0 }), false);

  const base = createMatch({ seat: HOST }).snapshot();
  assert.equal(validSnapshot(base), true);
  assert.equal(validSnapshot({ ...base, revision: 5 }), false, 'revisão precisa bater com a lista');
  assert.equal(validSnapshot({ ...base, colors: [WHITE, WHITE] }), false, 'os dois não jogam da mesma cor');
  assert.equal(validSnapshot({ ...base, names: ['a'] }), false);
  assert.equal(validSnapshot({ ...base, flow: 'voando' }), false);
});
