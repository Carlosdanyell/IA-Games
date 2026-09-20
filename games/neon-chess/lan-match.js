// Estado autoritativo de uma sala, sem DOM e sem rede.
//
// Só o anfitrião decide: ele aplica os lances (os dele e os pedidos do
// convidado) e transmite a lista resultante. O convidado nunca aplica um lance
// por conta própria — envia a intenção e espera o pacote. Em rede local a
// espera é de milissegundos, e em troca não existe estado local para
// reconciliar depois.
//
// Este módulo é puro de propósito: é ele que os testes exercitam, com as
// regras de verdade dos dois lados e sem navegador.
import {
  WHITE, BLACK, createPosition, legalMoves, makeMove, status, sanOf, positionKey, findMove, other
} from './model.js';
import { validCommand, validSnapshot, validMoveList, cleanName, MAX_MOVES } from './lan-protocol.js';

export const HOST = 0, GUEST = 1;

// O anfitrião começa de brancas; cada revanche troca as cores, como numa mesa.
export const colorsFor = match => match % 2 === 0 ? [WHITE, BLACK] : [BLACK, WHITE];

function rebuild(moves) {
  const pos = createPosition();
  const keys = [positionKey(pos)];
  const sans = [];
  for (const move of moves) {
    const legal = legalMoves(pos);
    if (!legal.includes(move)) return null;
    sans.push(sanOf(pos, move, legal));
    makeMove(pos, move);
    keys.push(positionKey(pos));
  }
  return { pos, keys, sans };
}

export function createMatch({ seat, names = ['', ''], onChange = () => {} } = {}) {
  const state = {
    seat,
    match: 0,
    moves: [],
    names: [cleanName(names[0], 0), cleanName(names[1], 1)],
    wins: [0, 0, 0],            // vitórias do assento 0, do assento 1, empates
    ready: [false, false],
    paused: false,
    flow: 'playing',
    result: null,
    reason: '',
    seq: 0,
    ack: 0,
    colors: colorsFor(0)
  };
  let built = rebuild([]);
  const isHost = () => state.seat === HOST;

  function refresh() {
    const outcome = status(built.pos, built.keys);
    state.flow = outcome.over ? 'over' : 'playing';
    state.result = outcome.result;
    state.reason = outcome.reason || '';
    if (outcome.over) state.paused = false;
    return outcome;
  }
  refresh();

  const api = {
    get state() { return state; },
    get position() { return built.pos; },
    get sans() { return built.sans; },
    get keys() { return built.keys; },
    get outcome() { return status(built.pos, built.keys); },
    colorOf: assento => state.colors[assento],
    seatOf: cor => state.colors[0] === cor ? HOST : GUEST,
    // De quem é a vez, em assento.
    turnSeat: () => api.seatOf(built.pos.turn),
    myColor: () => state.colors[state.seat],
    myTurn: () => !state.paused && state.flow === 'playing' && built.pos.turn === api.myColor(),

    snapshot() {
      return {
        type: 'state', seq: ++state.seq, match: state.match, revision: state.moves.length,
        ack: state.ack, moves: [...state.moves], flow: state.flow, result: state.result,
        reason: state.reason, paused: state.paused, names: [...state.names],
        wins: [...state.wins], ready: [...state.ready], colors: [...state.colors]
      };
    },

    // ------------------------------------------------------- lado do anfitrião
    // Devolve true quando o estado mudou e vale transmitir.
    applyCommand(command, fromSeat) {
      if (!isHost() || !validCommand(command)) return false;
      if (command.match !== state.match) return false;
      if (command.action === 'move') {
        // Revisão errada significa comando antigo ou repetido: descarta em
        // silêncio, senão um toque duplo joga duas vezes.
        if (command.revision !== state.moves.length) return false;
        return api.play(command.move, fromSeat);
      }
      if (command.action === 'pause') return api.setPaused(true, fromSeat);
      if (command.action === 'resume') return api.confirmResume(fromSeat);
      if (command.action === 'rematch') return api.confirmRematch(fromSeat);
      if (command.action === 'resign') return api.resign(fromSeat);
      return false;
    },

    // Aplica um lance de `fromSeat`. Vale para o anfitrião e para o lance dele
    // mesmo: é o único ponto em que a lista cresce.
    play(move, fromSeat) {
      if (!isHost() || state.flow !== 'playing' || state.paused) return false;
      if (state.moves.length >= MAX_MOVES) return false;
      if (built.pos.turn !== state.colors[fromSeat]) return false;
      const legal = legalMoves(built.pos);
      if (!legal.includes(move)) return false;
      built.sans.push(sanOf(built.pos, move, legal));
      makeMove(built.pos, move);
      built.keys.push(positionKey(built.pos));
      state.moves.push(move);
      const outcome = refresh();
      if (outcome.over) api.score(outcome);
      onChange();
      return true;
    },

    // Tradução da intenção da interface (casas) para um lance legal.
    findLocalMove(from, to, promotion = 0) {
      return findMove(built.pos, from, to, promotion);
    },

    score(outcome) {
      if (outcome.result === 'draw') state.wins[2]++;
      else state.wins[api.seatOf(outcome.result === 'white' ? WHITE : BLACK)]++;
    },

    resign(fromSeat) {
      if (!isHost() || state.flow !== 'playing') return false;
      state.flow = 'over';
      state.result = state.colors[fromSeat] === WHITE ? 'black' : 'white';
      state.reason = 'resign';
      state.paused = false;
      state.wins[fromSeat === HOST ? GUEST : HOST]++;
      onChange();
      return true;
    },

    setPaused(value, fromSeat) {
      if (!isHost() || state.flow !== 'playing') return false;
      if (value === state.paused) return false;
      state.paused = value;
      state.ready = [false, false];
      onChange();
      return true;
    },

    // Pausa e revanche valem para os dois: um lado sozinho não retoma nem
    // reinicia a partida do outro.
    confirmResume(fromSeat) {
      if (!isHost() || !state.paused) return false;
      state.ready[fromSeat] = true;
      if (state.ready[HOST] && state.ready[GUEST]) {
        state.paused = false;
        state.ready = [false, false];
      }
      onChange();
      return true;
    },

    confirmRematch(fromSeat) {
      if (!isHost() || state.flow !== 'over') return false;
      state.ready[fromSeat] = true;
      if (state.ready[HOST] && state.ready[GUEST]) {
        state.match++;
        state.colors = colorsFor(state.match);
        state.moves = [];
        built = rebuild([]);
        state.ready = [false, false];
        state.paused = false;
        refresh();
      }
      onChange();
      return true;
    },

    // ------------------------------------------------------ lado do convidado
    // Aceitar um pacote é reconstruir a partida do zero com as regras locais.
    // Se um único lance da lista não for legal aqui, o pacote inteiro cai.
    applySnapshot(payload) {
      if (isHost() || !validSnapshot(payload)) return { ok: false, reason: 'inválido' };
      if (payload.match < state.match) return { ok: false, reason: 'antigo' };
      if (payload.match === state.match && payload.seq <= state.ack) return { ok: false, reason: 'repetido' };
      const rebuilt = rebuild(payload.moves);
      if (!rebuilt) return { ok: false, reason: 'lance ilegal no pacote' };
      built = rebuilt;
      state.match = payload.match;
      state.moves = [...payload.moves];
      state.names = payload.names.map((name, index) => cleanName(name, index));
      state.wins = [...payload.wins];
      state.ready = [...payload.ready];
      state.paused = payload.paused;
      state.colors = [...payload.colors];
      state.ack = payload.seq;
      const outcome = refresh();
      // O anfitrião manda o resultado, mas quem confere é a regra local.
      if ((outcome.over ? 'over' : 'playing') !== payload.flow && payload.reason !== 'resign') {
        return { ok: false, reason: 'estado incompatível' };
      }
      if (payload.reason === 'resign') {
        state.flow = 'over';
        state.result = payload.result;
        state.reason = 'resign';
      }
      onChange();
      return { ok: true };
    },

    // Comando que o convidado envia; o anfitrião nunca precisa disso.
    command(action, move = 0) {
      return { type: 'command', action, move, match: state.match,
        revision: state.moves.length, seq: ++state.seq };
    },

    setName(index, value) {
      state.names[index] = cleanName(value, index);
      onChange();
    },

    // Usado só pelos testes e pela restauração: valida a lista antes de aceitar.
    load(moves) {
      if (!validMoveList(moves)) return false;
      const rebuilt = rebuild(moves);
      if (!rebuilt) return false;
      built = rebuilt;
      state.moves = [...moves];
      refresh();
      return true;
    }
  };
  return api;
}
