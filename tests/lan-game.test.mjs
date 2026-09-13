// Testa duas instâncias isoladas do jogo real. Só DOM/canvas e transporte são
// substituídos; física, regras, serialização e autorização são os de produção.
// Conexão WebRTC real: tests/lan-browser.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { webcrypto } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
    this.classList = { add() {}, remove() {} }; this.textContent = ''; this.value = ''; this.hidden = false; this.isConnected = true; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
  after() {} remove() { this.isConnected = false; } focus() {} select() {}
  setAttribute(k, v) { this[k] = v; }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll(tag) { return this.children.flatMap(c => [ ...(c.tagName?.toLowerCase() === tag ? [c] : []), ...(c.querySelectorAll?.(tag) || []) ]); }
  closest() { return new Element(); }
  getContext() { return context2d; }
}
const context2d = new Proxy({}, { get: (_, key) => key === 'measureText' ? () => ({ width: 40 }) :
  key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
let nextPeer = 0;
const peers = new Map();
class Channel {
  readyState = 'connecting'; bufferedAmount = 0; sent = [];
  send(data) { this.sent.push(JSON.parse(data)); queueMicrotask(() => this.other?.onmessage?.({ data })); }
  close() { this.readyState = 'closed'; if (this.other) { this.other.readyState = 'closed'; this.other.onclose?.(); } }
}
class Peer extends EventTarget {
  constructor() { super(); this.id = ++nextPeer; peers.set(this.id, this); this.iceGatheringState = 'complete'; this.signalingState = 'stable'; }
  createDataChannel() { return this.channel = new Channel(); }
  async createOffer() { return { type: 'offer', sdp: `v=0\r\na=candidate:fake\r\na=peer:${this.id}\r\n` }; }
  async createAnswer() { return { type: 'answer', sdp: `v=0\r\na=candidate:fake\r\na=peer:${this.id}\r\n` }; }
  async setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'; }
  async setRemoteDescription(d) {
    this.remoteDescription = d;
    if (d.type !== 'answer') return;
    this.signalingState = 'stable';
    const guest = peers.get(Number(d.sdp.match(/a=peer:(\d+)/)[1]));
    guest.channel = new Channel(); guest.ondatachannel({ channel: guest.channel });
    this.channel.other = guest.channel; guest.channel.other = this.channel;
    queueMicrotask(() => {
      this.channel.readyState = guest.channel.readyState = 'open';
      this.channel.onopen(); guest.channel.onopen();
    });
  }
  close() { this.connectionState = 'closed'; }
}

async function instance(name) {
  const document = { createElement: tag => new Element(tag), getElementById: () => null, head: new Element(), hidden: false };
  const window = new EventTarget();
  const ownedPeers = [];
  const sandbox = vm.createContext({ document, window, location: new URL('https://example.test/IA-Games/play.html?game=eight-ball'),
    history: { replaceState() {} }, navigator: {}, URL, URLSearchParams, AbortController, Event, TextEncoder, TextDecoder, btoa, atob,
    crypto: webcrypto, setTimeout, clearTimeout, console,
    RTCPeerConnection: class extends Peer { constructor(...args) { super(...args); ownedPeers.push(this); } } });
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    const pending = (async () => {
      const mod = new vm.SourceTextModule(await readFile(file, 'utf8'), { context: sandbox, identifier: file,
        initializeImportMeta(meta) { meta.url = pathToFileURL(file).href; } });
      await mod.link((name, parent) => load(resolve(dirname(parent.identifier), name)));
      return mod;
    })();
    modules.set(file, pending);
    return pending;
  }
  const mod = await load(resolve(root, 'games/eight-ball/index.js'));
  await mod.evaluate();
  const saved = new Map([['mode', 'local'], ['lan-name', name]]);
  const input = { state: { x: 0, y: 0 }, keys: {}, events: {}, on(t, f) { this.events[t] = f; }, reset() {}, destroy() {} };
  const hud = { arena: new Element(), el: { hint: new Element() }, dialogOpen: false,
    setDialogContent(node) { this.dialog = node; }, openDialog() { this.dialogOpen = true; }, closeDialog() { this.dialogOpen = false; },
    showOverlay(args) { this.overlay = args; }, hideOverlay() { this.overlay = null; },
    setHint() {}, setStat() {}, setChips() {}, setPause() {}, toast() {}, tickToast() {}, flush() {} };
  const services = { viewport: { view: { cssW: 1000, cssH: 500, scale: 1, dpr: 1, ctx: context2d }, begin() {} }, input, hud,
    audio: { resume() {}, tone() {} }, haptics: { buzz() {} },
    theme: { mode: 'dark', dark: true, tokens: { accent: '#bf8cff', warn: '#ff8a8a' } },
    store: { get: (k, def) => saved.has(k) ? saved.get(k) : def, set: (k, v) => saved.set(k, v) },
    debug: { frame() {}, circle() {}, info() {}, render() {} } };
  const game = mod.namespace.create(services);
  const click = async label => {
    const b = hud.dialog?.querySelectorAll('button').find(b => b.textContent === label);
    assert.ok(b, 'botão ' + label); b.dispatchEvent(new Event('click')); await drain();
  };
  const key = code => { const e = new Event('keydown'); e.key = code === 'Space' ? ' ' : code; e.code = code; window.dispatchEvent(e); };
  return { game, input, hud, window, document, services, peers: ownedPeers, click, key,
    state: () => JSON.parse(JSON.stringify(game.inspect().S)) };
}

async function pair() {
  const host = await instance('Ana'), guest = await instance('Bruno');
  host.game.secondaryAction(); await host.click('Criar sala');
  const offer = host.hud.dialog.querySelectorAll('textarea')[0].value;
  assert.ok(offer.includes('#pool=NPOOL1.'));
  guest.game.secondaryAction(); await guest.click('Entrar na sala');
  guest.hud.dialog.querySelectorAll('textarea')[0].value = offer;
  await guest.click('Gerar resposta');
  const answer = guest.hud.dialog.querySelectorAll('textarea')[0].value;
  host.hud.dialog.querySelectorAll('textarea')[1].value = answer;
  await host.click('Conectar'); await drain();
  // A plataforma real entrega onopen depois de setRemoteDescription resolver.
  host.game.render(.05); await drain();
  assert.equal(host.game.getState().network.started, true);
  assert.equal(guest.game.getState().network.started, true);
  return { host, guest, close() { host.game.destroy(); guest.game.destroy(); } };
}
async function tick(host, guest, frames = 1) {
  for (let i = 0; i < frames; i++) {
    for (let j = 0; j < 4; j++) { host.game.update(1 / 120); guest.game.update(1 / 120); }
    host.game.render(1 / 30); guest.game.render(1 / 30); await drain();
  }
}

test('duas mesas: saída, bloqueio fora da vez, falta, bola na mão e tacada do convidado', async () => {
  const p = await pair(); const { host, guest } = p;
  try {
    assert.deepEqual(guest.state(), host.state());
    guest.key('Space'); await tick(host, guest); assert.equal(host.state().shots, 0);
    host.game.inspect().aim.angle = Math.PI; host.game.inspect().aim.power = .05;
    host.key('Space'); await tick(host, guest, 170);
    assert.equal(host.state().turn, 1); assert.equal(host.state().flow, 'placing');
    assert.deepEqual(guest.state(), host.state());
    const before = host.state().shots;
    host.key('Space'); await tick(host, guest); assert.equal(host.state().shots, before);
    guest.input.state.x = 240; guest.input.state.y = 200;
    guest.input.events.press({ x: 240, y: 200 }); guest.input.events.release(); await tick(host, guest);
    assert.equal(host.state().flow, 'aiming'); assert.equal(host.state().balls[0].x, 240);
    guest.key('Space'); await tick(host, guest, 170);
    assert.equal(host.state().shots, 2); assert.deepEqual(guest.state(), host.state());
  } finally { p.close(); }
});

test('pausa durante a tacada congela ambas; retomar exige os dois; modo LAN sai sem CPU fantasma', async () => {
  const p = await pair(); const { host, guest } = p;
  try {
    host.key('Space'); await tick(host, guest, 3);
    guest.game.pause(); await tick(host, guest);
    assert.equal(host.state().flow, 'paused'); const frozen = host.state();
    await tick(host, guest, 8); assert.deepEqual(host.state(), frozen);
    guest.game.resume(); await tick(host, guest); assert.equal(host.state().flow, 'paused');
    host.game.resume(); await tick(host, guest); assert.equal(host.state().flow, 'rolling');
    host.game.openSettings(); await host.click('Sair da sala');
    assert.equal(host.game.getState().network, null); assert.equal(host.game.getState().mode, 'local');
    assert.equal(guest.game.getState().network.connected, false);
  } finally { p.close(); }
});

test('sair do app com comando pendente ainda pausa e girar o host invalida a confirmação', async () => {
  const p = await pair(); const { host, guest } = p;
  try {
    host.game.inspect().S.turn = 1; await tick(host, guest);
    guest.key('Space'); // ainda não recebeu confirmação do host
    guest.document.hidden = true; guest.game.onHidden(); await drain();
    assert.equal(host.state().flow, 'paused');
    guest.document.hidden = false;
    host.game.resume(); await tick(host, guest);
    host.services.viewport.view.cssW = 390; host.services.viewport.view.cssH = 844;
    guest.game.resume(); await tick(host, guest);
    assert.equal(host.state().flow, 'paused');
    assert.equal(host.game.getState().network.ready[0], false);
  } finally { p.close(); }
});

test('comandos repetidos, revisão/partida antiga, posição inválida e estado forjado não alteram o host', async () => {
  const p = await pair(); const { host, guest } = p;
  try {
    const h = host.game.inspect().S; h.flow = 'placing'; h.turn = 1; h.ballInHand = true;
    await tick(host, guest);
    const channel = guest.peers[0].channel;
    const envelope = channel.sent[0];
    const n = guest.game.getState().network;
    const send = async payload => { channel.send(JSON.stringify({ ...envelope, payload })); await tick(host, guest); };
    await send({ type: 'state', state: { turn: 1, winner: 1 } });
    const command = { type: 'command', action: 'place', seq: 100, match: n.match, revision: n.revision, point: { x: 656, y: 236 } };
    await send(command); assert.equal(host.state().flow, 'placing'); // ocupado pelo triângulo
    await send({ ...command, seq: 101, point: { x: 240, y: 200 }, match: 0 }); assert.equal(host.state().flow, 'placing');
    await send({ ...command, seq: 102, point: { x: 240, y: 200 } }); assert.equal(host.state().flow, 'aiming');
    await send({ ...command, action: 'shoot', seq: 103, aim: { angle: 0, power: 1 } }); // revisão anterior à colocação
    assert.equal(host.state().shots, 0);
    await send({ ...command, action: 'shoot', seq: 104, revision: host.game.getState().network.revision, aim: { angle: 0, power: .2 } });
    assert.equal(host.state().shots, 1);
    await send({ ...command, action: 'shoot', seq: 104, revision: host.game.getState().network.revision, aim: { angle: 0, power: 1 } });
    assert.equal(host.state().shots, 1);
  } finally { p.close(); }
});

test('bola 8 encerra nos dois, placar só conta uma vez e revanche precisa de duas confirmações', async () => {
  const p = await pair(); const { host, guest } = p;
  try {
    const { S, aim } = host.game.inspect();
    S.stage = 'play'; S.groups = { 0: 'solid', 1: 'stripe' };
    S.balls.forEach(b => { b.active = b.number === 0 || b.number === 8; b.vx = b.vy = 0; });
    const eight = S.balls.find(b => b.number === 8);
    eight.x = 846; eight.y = 236; eight.vx = 0; eight.vy = 0;
    S.balls[0].x = 600; S.balls[0].y = 236;
    aim.angle = 0; aim.power = .3;
    host.key('Space');
    // Fixture da 8 chegando à caçapa durante uma tacada válida em andamento.
    eight.x = 865; eight.y = 445;
    await tick(host, guest, 170);
    assert.equal(host.state().flow, 'over'); assert.equal(guest.state().flow, 'over');
    const wins = [...host.game.getState().network.wins];
    await tick(host, guest, 20); assert.deepEqual([...host.game.getState().network.wins], wins);
    guest.game.primaryAction(); await tick(host, guest); assert.equal(host.state().flow, 'over');
    host.game.primaryAction(); await tick(host, guest);
    assert.equal(host.state().shots, 0); assert.equal(host.state().flow, 'aiming');
    assert.equal(host.game.getState().network.match, 2); assert.deepEqual(guest.state(), host.state());
  } finally { p.close(); }
});
