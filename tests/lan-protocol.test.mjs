import test from 'node:test';
import assert from 'node:assert/strict';
import { createRack } from '../games/eight-ball/rules.js';
import { createRng } from '../core/rng.js';
import { encodeSignal, decodeSignal, validSnapshot, validCommand, escapeHtml } from '../games/eight-ball/lan-protocol.js';

const room = '12345678-1234-1234-1234-123456789abc';
const sdp = 'v=0\r\na=candidate:1 1 UDP 2122260223 192.168.1.10 5000 typ host\r\n';
const snapshot = () => ({
  seq: 1, ack: 0, match: 1, revision: 1, names: ['Ana', 'João'], wins: [0, 0], ready: [false, false], reason: '',
  aim: { angle: 0, power: .5 }, ghost: null,
  state: { flow: 'aiming', stage: 'break', turn: 0, groups: { 0: null, 1: null }, winner: null,
    ballInHand: false, shots: 0, fouls: [0, 0], message: '', balls: createRack(createRng(1).next) }
});

test('convite e resposta preservam SDP e sala; link funciona no subdiretório do Pages', () => {
  for (const type of ['offer', 'answer']) {
    const token = encodeSignal(type, room, sdp);
    const result = decodeSignal(`https://carlosdanyell.github.io/IA-Games/play.html?game=eight-ball#pool=${token}`, type);
    assert.equal(result.sdp, sdp); assert.equal(result.room, room);
  }
});
test('rejeita código truncado, tipo trocado, payload excessivo e versão incompatível', () => {
  assert.throws(() => decodeSignal('texto solto', 'offer'));
  assert.throws(() => decodeSignal('x'.repeat(65537), 'offer'));
  assert.throws(() => decodeSignal(encodeSignal('answer', room, sdp), 'offer'), /convite/);
  assert.throws(() => decodeSignal('NPOOL1.' + btoa('null'), 'offer'));
  assert.throws(() => decodeSignal('NPOOL1.' + btoa(JSON.stringify({ v: 999 })), 'offer'), /Atualize/);
});
test('rejeita convite expirado e convite sem candidatos locais', () => {
  const token = encodeSignal('offer', room, sdp);
  const data = JSON.parse(atob(token.slice(7).replace(/-/g, '+').replace(/_/g, '/')));
  data.at -= 31 * 60 * 1000;
  assert.throws(() => decodeSignal('NPOOL1.' + btoa(JSON.stringify(data)).replace(/=+$/, ''), 'offer'), /expirado/);
  assert.throws(() => decodeSignal(encodeSignal('offer', room, 'v=0'), 'offer'), /endereço/);
});
test('snapshot exige mesa inteira, números únicos, valores finitos e fluxos válidos', () => {
  assert.equal(validSnapshot(snapshot()), true);
  for (const mutate of [p => p.state.balls.pop(), p => p.state.balls[0] = null,
    p => p.state.balls[1] = p.state.balls[2], p => p.state.balls[0].vx = NaN,
    p => p.state.balls[0].x = Infinity, p => p.state.flow = 'think',
    p => p.names[0] = 'nome longo demais', p => p.ghost = { x: 1, y: 1 }, p => p.ready = [true]]) {
    const p = snapshot(); mutate(p); assert.equal(validSnapshot(p), false);
  }
  for (const value of [null, {}, [], false, 3, 'state']) assert.equal(validSnapshot(value), false);
});
test('comandos aceitam só intenções conhecidas e valores dentro do limite', () => {
  const cmd = { match: 1, revision: 2, seq: 1, action: 'shoot', aim: { angle: 0, power: .5 } };
  assert.equal(validCommand(cmd), true);
  for (const patch of [{ seq: -1 }, { action: 'setState' }, { aim: { angle: NaN, power: 1 } },
    { aim: { angle: 0, power: 2 } }, { action: 'place', point: { x: -1e9, y: 5 } }]) {
    assert.equal(validCommand({ ...cmd, ...patch }), false);
  }
});
test('nomes/mensagens interpolados no HUD são escapados', () => {
  assert.equal(escapeHtml('<svg/onload=alert(1)> &'), '&lt;svg/onload=alert(1)&gt; &amp;');
});
