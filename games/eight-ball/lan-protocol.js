// Protocolo versionado. O convidado envia intenções; só o anfitrião decide a mesa.
import { BALL, TABLE, SHOT } from './config.js';
import { groupOf } from './rules.js';

export const PROTOCOL = 1;
export const MAX_PACKET = 32768;
const integer = (n, max = 1e9) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const finite = (n, max) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max;
const shortText = (s, max) => typeof s === 'string' && s.length <= max;
export const cleanName = (s, index = 0) => String(s ?? '')
  .replace(/[<>\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12) || `Jogador ${index + 1}`;
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function validAim(a) {
  return a && finite(a.angle, 1e6) && finite(a.power, 1) && a.power >= 0;
}
export function validPoint(p) {
  return p && finite(p.x, TABLE.right + 100) && finite(p.y, TABLE.bottom + 100);
}
export function validCommand(c) {
  if (!c || !integer(c.match) || !integer(c.revision) || !integer(c.seq)) return false;
  if (c.action === 'shoot' || c.action === 'aim') return validAim(c.aim);
  if (c.action === 'place' || c.action === 'ghost') return validPoint(c.point);
  return ['pause', 'resume', 'rematch'].includes(c.action);
}

export function validSnapshot(p) {
  if (!p || !integer(p.seq) || !integer(p.match) || !integer(p.revision) || !integer(p.ack)) return false;
  const s = p.state;
  if (!s || !['aiming', 'placing', 'rolling', 'paused', 'over'].includes(s.flow)) return false;
  if (!['break', 'play'].includes(s.stage) || ![0, 1].includes(s.turn)) return false;
  if (![null, 0, 1].includes(s.winner) || typeof s.ballInHand !== 'boolean') return false;
  if (!s.groups || ![null, 'solid', 'stripe'].includes(s.groups[0]) ||
      ![null, 'solid', 'stripe'].includes(s.groups[1])) return false;
  if (!integer(s.shots) || !shortText(s.message, 240) || !shortText(p.reason, 240)) return false;
  if (!Array.isArray(s.fouls) || s.fouls.length !== 2 || !s.fouls.every(n => integer(n))) return false;
  if (!Array.isArray(p.names) || p.names.length !== 2 || !p.names.every(n => shortText(n, 12))) return false;
  if (!Array.isArray(p.wins) || p.wins.length !== 2 || !p.wins.every(n => integer(n))) return false;
  if (!Array.isArray(p.ready) || p.ready.length !== 2 || !p.ready.every(n => typeof n === 'boolean')) return false;
  if (!validAim(p.aim) || (p.ghost !== null && (!validPoint(p.ghost) || typeof p.ghost.valid !== 'boolean'))) return false;
  if (!Array.isArray(s.balls) || s.balls.length !== 16 || s.balls[0]?.number !== 0) return false;
  const ids = new Set();
  for (const b of s.balls) {
    if (!b || !integer(b.number, 15) || b.id !== b.number || ids.has(b.number) ||
        b.group !== groupOf(b.number) || b.r !== BALL.r || typeof b.active !== 'boolean' ||
        !finite(b.x, TABLE.right + 100) || !finite(b.y, TABLE.bottom + 100) ||
        !finite(b.vx, SHOT.maxSpeed * 2) || !finite(b.vy, SHOT.maxSpeed * 2)) return false;
    ids.add(b.number);
  }
  return true;
}

// O convite leva o SDP completo, incluindo candidatos locais. Não usa STUN/TURN.
// O fragmento #pool=... não é enviado ao servidor do GitHub Pages.
export function encodeSignal(type, room, sdp) {
  const text = JSON.stringify({ v: PROTOCOL, game: 'neon-pool', type, room, sdp, at: Date.now() });
  const bytes = new TextEncoder().encode(text);
  return 'NPOOL1.' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSignal(input, expected) {
  if (typeof input !== 'string' || input.length > 65536) throw new Error('Código muito grande ou inválido.');
  let token = input.trim();
  if (/^https?:\/\//i.test(token)) {
    try { token = new URLSearchParams(new URL(token).hash.slice(1)).get('pool') || ''; }
    catch { throw new Error('Link de convite inválido.'); }
  }
  token = token.replace(/\s/g, '');
  if (!/^NPOOL1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Cole o convite ou código completo do Neon Pool.');
  let data;
  try {
    const raw = atob(token.slice(7).replace(/-/g, '+').replace(/_/g, '/'));
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  } catch { throw new Error('Código incompleto ou inválido. Copie novamente.'); }
  if (!data || data.v !== PROTOCOL || data.game !== 'neon-pool') throw new Error('Atualize o jogo nos dois aparelhos.');
  if (data.type !== expected) throw new Error(expected === 'offer' ? 'Aqui deve entrar um convite, não uma resposta.' : 'Cole a resposta do outro jogador, não o convite.');
  if (!shortText(data.room, 80) || !/^[\w-]{16,80}$/.test(data.room) ||
      !shortText(data.sdp, 24000) || !data.sdp.startsWith('v=0') || !data.sdp.includes('a=candidate:')) {
    throw new Error('Convite sem endereço de rede válido. Crie uma nova sala.');
  }
  if (!finite(data.at, 1e15) || Date.now() - data.at > 30 * 60 * 1000 || data.at - Date.now() > 5 * 60 * 1000) {
    throw new Error('Código expirado ou relógios diferentes. Crie uma nova sala e confira a hora dos aparelhos.');
  }
  return data;
}
