// Transporte WebRTC de uma sala: um RTCPeerConnection e um DataChannel
// confiável e ordenado. Mesma estratégia do Neon Pool — convite e resposta
// manuais no lugar de servidor de sinalização, `iceServers: []`, sem STUN,
// TURN, descoberta de IP, microfone ou câmera.
//
// Está duplicado aqui de propósito: o Neon Pool é a funcionalidade mais
// delicada do repositório e um jogo novo não deve exigir mexer nele. Se um dia
// um terceiro jogo precisar do mesmo transporte, aí sim vale promovê-lo a
// core/ — com os testes do Pool como rede de segurança.
import { PROTOCOL, MAX_PACKET, encodeSignal, decodeSignal } from './lan-protocol.js';

export class LanTransport {
  constructor({ onStatus = () => {}, onOpen = () => {}, onMessage = () => {} } = {}) {
    this.onStatus = onStatus;
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.status = 'idle';
    this.pc = null;
    this.channel = null;
    this.closed = false;
    this.timers = new Set();
    this.abort = new AbortController();
  }

  setStatus(status, message) {
    if (this.closed) return;
    this.status = status;
    this.onStatus(status, message);
  }

  init() {
    if (this.pc || this.closed) throw new Error('Crie uma nova sala para tentar novamente.');
    if (!globalThis.RTCPeerConnection) throw new Error('Este navegador não oferece conexão entre aparelhos. Use Chrome, Edge, Firefox ou Safari atualizado.');
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => {
      if (this.closed) return;
      const state = this.pc.connectionState;
      if (state === 'failed' || state === 'closed') this.fail('A conexão caiu. Crie uma nova sala.');
      else if (state === 'disconnected') this.setStatus('interrupted', 'Rede interrompida. A partida foi pausada.');
      else if (state === 'connected' && this.channel?.readyState === 'open') this.setStatus('connected', 'Conectados pela rede local.');
    };
    return this.pc;
  }

  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.closed) fn(); }, ms);
    this.timers.add(id);
    return id;
  }

  // Esperar o gathering chegar a "complete" trava em várias situações reais
  // (interfaces virtuais, VPN, mDNS lento) mesmo já havendo candidato local
  // utilizável. Então: segue 1,2s depois do último candidato, ou no limite de
  // 10s, com o que houver — e só falha se não vier candidato nenhum.
  async gather() {
    const pc = this.pc;
    if (pc.iceGatheringState !== 'complete') {
      await new Promise((resolve, reject) => {
        let settle = null;
        let limit = null;
        const drop = id => { if (id !== null) { clearTimeout(id); this.timers.delete(id); } };
        const finish = error => {
          drop(settle); drop(limit);
          pc.removeEventListener('icegatheringstatechange', check);
          pc.removeEventListener('icecandidate', gathered);
          this.abort.signal.removeEventListener('abort', cancel);
          error ? reject(error) : resolve();
        };
        const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
        const gathered = event => {
          if (!event.candidate) { finish(); return; }
          drop(settle);
          settle = this.later(() => finish(), 1200);
        };
        const cancel = () => finish(new Error('Sala cancelada.'));
        pc.addEventListener('icegatheringstatechange', check);
        pc.addEventListener('icecandidate', gathered);
        this.abort.signal.addEventListener('abort', cancel, { once: true });
        limit = this.later(() => finish(), 10000);
        check();
      });
    }
    if (this.closed) throw new Error('Sala cancelada.');
    const sdp = pc.localDescription?.sdp;
    if (!sdp?.includes('a=candidate:')) {
      throw new Error('Não foi possível obter um endereço local. Confira o Wi-Fi e as permissões de rede do navegador.');
    }
    return sdp;
  }

  bind(channel) {
    if (this.channel) { channel.close(); return; }
    this.channel = channel;
    channel.onopen = () => {
      if (this.closed) return;
      this.lastSeen = Date.now();
      this.setStatus('connected', 'Conectados pela rede local.');
      this.onOpen();
      const heartbeat = () => {
        const elapsed = Date.now() - this.lastSeen;
        if (elapsed > 45000) { this.fail('O outro aparelho não respondeu. Crie uma nova sala.'); return; }
        if (elapsed > 12000) this.setStatus('interrupted', 'Aguardando o outro aparelho. A partida foi pausada.');
        this.send({ type: 'ping' });
        this.later(heartbeat, 2000);
      };
      this.later(heartbeat, 2000);
    };
    channel.onmessage = event => {
      if (this.closed || typeof event.data !== 'string' || event.data.length > MAX_PACKET) return;
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!msg || msg.v !== PROTOCOL || msg.room !== this.room || !msg.payload || typeof msg.payload !== 'object') return;
      this.lastSeen = Date.now();
      if (this.status === 'interrupted') this.setStatus('connected', 'Conexão recuperada. Toque em Continuar nos dois aparelhos.');
      if (msg.payload.type === 'ping') { this.send({ type: 'pong' }); return; }
      if (msg.payload.type === 'pong') return;
      this.onMessage(msg.payload);
    };
    channel.onclose = () => this.fail('O outro jogador saiu da sala.');
    channel.onerror = () => this.fail('Falha na conexão entre os aparelhos. Crie uma nova sala.');
  }

  async createOffer() {
    const pc = this.init();
    this.room = crypto.randomUUID();
    this.setStatus('gathering', 'Preparando convite…');
    this.bind(pc.createDataChannel('neon-chess-v1', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    const sdp = await this.gather();
    this.setStatus('waiting', 'Envie o convite e cole aqui a resposta do outro jogador.');
    this.later(() => { if (this.channel?.readyState !== 'open') this.fail('O convite expirou. Crie uma nova sala.'); }, 30 * 60 * 1000);
    return encodeSignal('offer', this.room, sdp);
  }

  async acceptOffer(token) {
    const offer = decodeSignal(token, 'offer');
    const pc = this.init();
    this.room = offer.room;
    this.setStatus('gathering', 'Preparando resposta…');
    pc.ondatachannel = event => this.bind(event.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    const sdp = await this.gather();
    this.setStatus('waiting', 'Envie esta resposta para quem criou a sala. Mantenha o jogo aberto.');
    this.later(() => { if (this.status !== 'connected') this.fail('A resposta expirou. Peça um novo convite.'); }, 30 * 60 * 1000);
    return encodeSignal('answer', this.room, sdp);
  }

  async acceptAnswer(token) {
    const answer = decodeSignal(token, 'answer');
    if (!this.pc || this.closed || answer.room !== this.room) throw new Error('Esta resposta pertence a outra sala. Copie a resposta do convite atual.');
    if (this.pc.signalingState !== 'have-local-offer') throw new Error('Esta resposta já foi usada. Aguarde a conexão ou crie outra sala.');
    this.setStatus('connecting', 'Conectando os aparelhos…');
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    this.later(() => {
      if (this.channel?.readyState !== 'open') this.fail('Não conectou. Usem o mesmo Wi-Fi; redes de convidados, VPN ou isolamento de aparelhos podem bloquear a partida.');
    }, 30000);
  }

  send(payload) {
    if (this.closed || this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 65536) return false;
    const data = JSON.stringify({ v: PROTOCOL, room: this.room, payload });
    if (data.length > MAX_PACKET) return false;
    try { this.channel.send(data); return true; } catch { return false; }
  }

  fail(message) {
    if (this.closed) return;
    this.setStatus('closed', message);
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.channel) { this.channel.onclose = null; this.channel.onerror = null; this.channel.close(); }
    this.pc?.close();
  }
}
