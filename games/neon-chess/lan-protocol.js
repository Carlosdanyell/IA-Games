// Protocolo versionado do xadrez na mesma rede.
//
// Diferença para o Neon Pool: aqui não há física para sincronizar. Um lance é
// discreto e determinístico, então o anfitrião transmite a LISTA de lances da
// partida e o convidado reconstrói o tabuleiro aplicando-a com as mesmas
// regras. Divergência de estado deixa de ser possível: ou a lista inteira é
// legal nas duas pontas, ou o pacote é recusado.
import { WHITE, BLACK, moveFrom, moveTo, movePromotion, onBoard, PROMOTION_CHOICES } from './model.js';

export const PROTOCOL = 1;
export const MAX_PACKET = 32768;
export const MAX_MOVES = 600;

const integer = (n, max = 1e9) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const finite = (n, max) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max;
const shortText = (s, max) => typeof s === 'string' && s.length <= max;

export const cleanName = (s, index = 0) => String(s ?? '')
  .replace(/[<>\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12) || `Jogador ${index + 1}`;
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Um lance só é aceito como número se as casas couberem no tabuleiro e a peça
// de promoção estiver entre as quatro permitidas. A legalidade em si é
// decidida pelas regras, ao aplicar.
export function validMove(move) {
  if (!Number.isSafeInteger(move) || move < 0 || move > 0x7fffff) return false;
  if (!onBoard(moveFrom(move)) || !onBoard(moveTo(move))) return false;
  const promotion = movePromotion(move);
  return promotion === 0 || PROMOTION_CHOICES.includes(promotion);
}
export const validMoveList = list =>
  Array.isArray(list) && list.length <= MAX_MOVES && list.every(validMove);

export function validCommand(c) {
  if (!c || !integer(c.match) || !integer(c.revision) || !integer(c.seq)) return false;
  if (c.action === 'move') return validMove(c.move);
  return ['pause', 'resume', 'rematch', 'resign'].includes(c.action);
}

export function validSnapshot(p) {
  if (!p || !integer(p.seq) || !integer(p.match) || !integer(p.revision) || !integer(p.ack)) return false;
  if (!validMoveList(p.moves) || p.revision !== p.moves.length) return false;
  if (!['playing', 'over'].includes(p.flow) || typeof p.paused !== 'boolean') return false;
  if (![null, 'white', 'black', 'draw'].includes(p.result)) return false;
  if (!shortText(p.reason ?? '', 40)) return false;
  if (!Array.isArray(p.names) || p.names.length !== 2 || !p.names.every(n => shortText(n, 12))) return false;
  if (!Array.isArray(p.wins) || p.wins.length !== 3 || !p.wins.every(n => integer(n))) return false;
  if (!Array.isArray(p.ready) || p.ready.length !== 2 || !p.ready.every(n => typeof n === 'boolean')) return false;
  if (!Array.isArray(p.colors) || p.colors.length !== 2) return false;
  if (p.colors[0] === p.colors[1] || !p.colors.every(c => c === WHITE || c === BLACK)) return false;
  return true;
}

// O convite leva o SDP completo, com os candidatos locais. Não usa STUN/TURN.
// O fragmento #chess=... não é enviado ao servidor do GitHub Pages.
export function encodeSignal(type, room, sdp) {
  const text = JSON.stringify({ v: PROTOCOL, game: 'neon-chess', type, room, sdp, at: Date.now() });
  const bytes = new TextEncoder().encode(text);
  return 'NCHESS1.' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSignal(input, expected) {
  if (typeof input !== 'string' || input.length > 65536) throw new Error('Código muito grande ou inválido.');
  let token = input.trim();
  if (/^https?:\/\//i.test(token)) {
    try { token = new URLSearchParams(new URL(token).hash.slice(1)).get('chess') || ''; }
    catch { throw new Error('Link de convite inválido.'); }
  }
  token = token.replace(/\s/g, '');
  if (!/^NCHESS1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Cole o convite ou código completo do Neon Chess.');
  let data;
  try {
    const raw = atob(token.slice(8).replace(/-/g, '+').replace(/_/g, '/'));
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  } catch { throw new Error('Código incompleto ou inválido. Copie novamente.'); }
  if (!data || data.v !== PROTOCOL || data.game !== 'neon-chess') throw new Error('Atualize o jogo nos dois aparelhos.');
  if (data.type !== expected) {
    throw new Error(expected === 'offer' ? 'Aqui deve entrar um convite, não uma resposta.'
      : 'Cole a resposta do outro jogador, não o convite.');
  }
  if (!shortText(data.room, 80) || !/^[\w-]{16,80}$/.test(data.room) ||
      !shortText(data.sdp, 24000) || !data.sdp.startsWith('v=0') || !data.sdp.includes('a=candidate:')) {
    throw new Error('Convite sem endereço de rede válido. Crie uma nova sala.');
  }
  if (!finite(data.at, 1e15) || Date.now() - data.at > 30 * 60 * 1000 || data.at - Date.now() > 5 * 60 * 1000) {
    throw new Error('Código expirado ou relógios diferentes. Crie uma nova sala e confira a hora dos aparelhos.');
  }
  return data;
}
