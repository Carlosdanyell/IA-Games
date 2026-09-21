import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  START_FEN, createPosition, legalMoves, makeMove, unmakeMove, status, sanOf,
  moveFrom, moveTo, movePromotion, findMove, positionKey,
  typeOf, colorOf, other, fileOf, rankOf, square, algebraic,
  CAPTURE, CASTLE, PROMOTION_CHOICES, SAN_LETTERS
} from './model.js';
import { chooseMove, LEVELS, DEFAULT_LEVEL, levelOf, VALUES } from './ai.js';
import { pieceSvg, describePiece } from './pieces.js';
import { createBoardMotion } from './board-motion.js';
import { LanTransport } from './lan-transport.js';
import { createLanLobby } from './lan-ui.js';
import { createMatch, HOST, GUEST } from './lan-match.js';
import { cleanName } from './lan-protocol.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';

export const meta = {
  id: 'neon-chess', title: 'NEON<span>CHESS</span>', subtitle: 'XADREZ / 5 NÍVEIS',
  arenaLabel: 'Xadrez: mova as peças e dê xeque-mate no rei adversário.',
  logicalSize: () => ({ w: 400, h: 400 }),
  stats: [{ id: 'wins', label: 'Vitórias', accent: true }, { id: 'draws', label: 'Empates' }, { id: 'losses', label: 'Derrotas' }]
};

const MODES = {
  maquina: { label: 'Contra a máquina', hint: 'Escolha o nível nos ajustes.' },
  local: { label: 'Dois jogadores', hint: 'Os dois jogam neste aparelho.' },
  rede: { label: 'Na mesma rede', hint: 'Dois aparelhos no mesmo Wi-Fi.' }
};
const COLOR_NAMES = { [WHITE]: 'brancas', [BLACK]: 'pretas' };
const INITIAL_COUNT = { [PAWN]: 8, [KNIGHT]: 2, [BISHOP]: 2, [ROOK]: 2, [QUEEN]: 1 };
const REASONS = {
  mate: 'Xeque-mate', stalemate: 'Afogamento (rei sem lance legal, mas sem xeque)',
  fifty: 'Empate pela regra dos 50 lances', repetition: 'Empate por tripla repetição',
  material: 'Empate por material insuficiente', resign: 'Partida entregue'
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const cleanRecord = value => {
  const number = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e7 ? n : 0;
  return { wins: number(value?.wins), draws: number(value?.draws), losses: number(value?.losses) };
};

export function create({ hud, input, theme, audio, haptics, store }) {
  input.setEnabled(false);
  const lifecycle = new AbortController(), signal = lifecycle.signal;
  if (!document.getElementById('nx-style')) {
    const style = el('link'); style.id = 'nx-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    style.addEventListener('load', () => resize(), { signal });
    document.head.append(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('nx-app');
  document.body.classList.add('nx-body');
  hud.canvas.setAttribute('aria-hidden', 'true');
  hud.el.settings.textContent = 'Ajustes & regras';
  theme.setAuto('azul');

  // ------------------------------------------------------------ persistência
  const saved = store.get('session-v1', {});
  let mode = Object.hasOwn(MODES, saved?.mode) ? saved.mode : 'maquina';
  let level = Object.hasOwn(LEVELS, saved?.level) ? saved.level : DEFAULT_LEVEL;
  let humanColor = saved?.humanColor === 'black' ? BLACK : WHITE;
  let flip = typeof saved?.flip === 'boolean' ? saved.flip : null;   // null = segue o lado do jogador
  let showHints = saved?.showHints !== false;
  // O padrão é o acabamento da biblioteca; a madeira clássica é opcional.
  let boardStyle = saved?.boardStyle === 'madeira' ? 'madeira' : 'neon';
  let playerName = cleanName(saved?.playerName, 0);
  const records = Object.fromEntries(Object.keys(LEVELS).map(key => [key, cleanRecord(saved?.records?.[key])]));
  let storageAvailable = true;

  // -------------------------------------------------------------------estado
  let pos = createPosition();
  let moveLog = [], sanLog = [], keyLog = [positionKey(pos)];
  let current = status(pos, keyLog);
  let selected = -1, targets = [], lastMove = 0, pendingPromotion = null;
  let thinkLeft = 0, paused = false, destroyed = false, scored = false;
  let focused = -1, message = '', messageTone = '';
  let net = null;              // sala na mesma rede; null fora do modo 'rede'
  let confirmingResign = false;

  // --------------------------------------------------------------------- DOM
  const view = el('div', 'nx-surface');
  view.innerHTML = `
    <div class="nx-heading"><span class="nx-mode"><i></i><b></b></span><span class="nx-ply"></span></div>
    <div class="nx-player" data-seat="top"><span class="nx-player-name"></span><span class="nx-taken"></span><span class="nx-edge"></span></div>
    <div class="nx-board-zone">
      <div class="nx-board-frame">
        <div class="nx-coordinates nx-files" data-edge="top" aria-hidden="true"></div>
        <div class="nx-coordinates nx-ranks" data-edge="left" aria-hidden="true"></div>
        <div class="nx-board" role="group" aria-label="Tabuleiro de xadrez, oito linhas por oito colunas"></div>
        <div class="nx-coordinates nx-ranks" data-edge="right" aria-hidden="true"></div>
        <div class="nx-coordinates nx-files" data-edge="bottom" aria-hidden="true"></div>
      </div>
      <div class="nx-promotion" role="dialog" aria-modal="true" aria-labelledby="nx-promotion-title" hidden><p id="nx-promotion-title">Promover o peão para:</p><div class="nx-promotion-list"></div></div>
      <div class="nx-lan-panel" hidden></div>
    </div>
    <div class="nx-player" data-seat="bottom"><span class="nx-player-name"></span><span class="nx-taken"></span><span class="nx-edge"></span></div>
    <div class="nx-feedback" role="status" aria-live="polite" aria-atomic="true"><strong class="nx-message"></strong><span class="nx-detail"></span></div>
    <div class="nx-history"><ol class="nx-moves" aria-label="Lances da partida"></ol></div>
    <div class="nx-controls">
      <button class="nx-new" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></svg><span>Nova partida</span></button>
      <button class="nx-undo" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg><span>Voltar lance</span></button>
      <button class="nx-flip" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/></svg><span>Girar</span></button>
      <button class="nx-resign" type="button" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h9l-1 3h6l-2 4 2 4h-8l-1-3H5"/></svg><span>Entregar</span></button>
    </div>`;
  hud.arena.append(view);
  const $ = selector => view.querySelector(selector);
  const board = $('.nx-board'), zone = $('.nx-board-zone');
  const frame = $('.nx-board-frame');
  const coordinateStrips = [...view.querySelectorAll('.nx-coordinates')];
  for (const strip of coordinateStrips) for (let i = 0; i < 8; i++) strip.append(el('span'));
  const promotionBox = $('.nx-promotion'), promotionList = $('.nx-promotion-list');
  const movesList = $('.nx-moves'), historyBox = $('.nx-history');
  const seats = { top: $('[data-seat="top"]'), bottom: $('[data-seat="bottom"]') };
  const lanPanel = $('.nx-lan-panel');

  const squares = [];
  for (let i = 0; i < 64; i++) {
    const cell = el('button', 'nx-square');
    cell.type = 'button';
    // `i` é a posição no DOM, não a casa: quem traduz é squareAt(), que
    // conhece o lado que está embaixo.
    cell.addEventListener('click', () => touch(i), { signal });
    board.append(cell);
    squares.push(cell);
  }

  // Ordem de desenho: da linha 8 para a 1 com as brancas embaixo; invertida
  // quando o jogador está do lado das pretas ou pediu para girar.
  // Quem está embaixo: minhas peças. Na rede quem manda é a cor do assento.
  const myColor = () => net?.match ? net.match.myColor() : humanColor;
  const flipped = () => flip === null ? (mode !== 'local' && myColor() === BLACK) : flip;
  const squareAt = index => {
    const row = Math.floor(index / 8), column = index % 8;
    return flipped() ? square(7 - column, row) : square(column, 7 - row);
  };

  const netOn = () => mode === 'rede' && !!net?.match;
  const netReady = () => netOn() && net.status === 'connected';
  const over = () => netOn() ? net.match.state.flow === 'over' : current.over;
  const machineColor = () => other(humanColor);
  const machineTurn = () => mode === 'maquina' && !over() && pos.turn === machineColor();
  const canPlay = () => !destroyed && !paused && !hud.dialogOpen && !hud.overlayVisible && !over() && !machineTurn() &&
    !pendingPromotion && (!netOn() || (netReady() && net.match.myTurn()));
  const motion = createBoardMotion(board, {
    signal,
    canDrag: index => canPlay() && !!pos.board[squareAt(index)] && colorOf(pos.board[squareAt(index)]) === pos.turn,
    select: index => { if (selected !== squareAt(index)) touch(index); },
    drop: touch
  });

  // Isola também o foco: pausa, resultado e confirmação cobrem toda a partida.
  function syncOverlays() {
    const blocked = paused || hud.overlayVisible;
    view.inert = blocked;
    board.inert = blocked || !!pendingPromotion || lobbyOpen();
    if (blocked) {
      motion.cancel();
      if (!hud.dialogOpen && !hud.el.overlay.contains(document.activeElement)) hud.el.action.focus({ preventScroll: true });
    }
  }
  const overlayObserver = new MutationObserver(syncOverlays);
  overlayObserver.observe(hud.el.overlay, { attributes: true, attributeFilter: ['hidden'] });
  // Resultado e motivo: na rede a desistência não está no tabuleiro, só no
  // estado da sala.
  const resultInfo = () => netOn()
    ? { result: net.match.state.result, reason: net.match.state.reason || 'mate' }
    : { result: current.result, reason: current.reason };

  function save() {
    storageAvailable = store.set('session-v1', {
      mode: mode === 'rede' ? 'maquina' : mode,   // sala não sobrevive ao reload
      level, humanColor: humanColor === BLACK ? 'black' : 'white', flip, showHints, boardStyle,
      records, playerName, moves: mode === 'rede' ? [] : moveLog
    });
  }

  // --------------------------------------------------------------- som e tato
  // Peça de madeira batendo na casa, e não bipe de sintetizador. Cada impacto
  // tem duas camadas: o estalo (ruído filtrado, ataque quase instantâneo, que
  // dá o material) e o corpo (tom grave curto em queda, que dá o peso). Sem a
  // primeira o som vira bumbo; sem a segunda, chiado.
  //
  // O orçamento de vozes do core é de quatro por quadro, então nenhum efeito
  // usa mais que três.
  const timers = new Set();
  function later(fn, ms) {
    const timer = setTimeout(() => { timers.delete(timer); if (!destroyed) fn(); }, ms);
    timers.add(timer);
    return timer;
  }
  const clack = ({ vol = .05, cutoff = 2600, cutoffEnd = 700, dur = .05, body = 190, bodyVol = .035 } = {}) => {
    audio.noise({ dur, vol, filter: 'lowpass', cutoff, cutoffEnd, attack: .12, curve: 'fall' });
    if (body) audio.tone({ freq: body, dur: dur + .03, type: 'triangle', vol: bodyVol, slide: .55 });
  };

  function sound(kind) {
    audio.resume();
    switch (kind) {
      case 'move':
        clack();
        break;
      case 'capture':
        // Duas peças se encontrando: estalo mais aberto, corpo mais grave e um
        // segundo toque logo atrás, da peça assentando na casa.
        audio.noise({ dur: .09, vol: .06, filter: 'bandpass', q: 1.3, cutoff: 2000, cutoffEnd: 520, attack: .05, curve: 'fall' });
        audio.tone({ freq: 140, dur: .12, type: 'triangle', vol: .045, slide: .45 });
        later(() => clack({ vol: .03, cutoff: 1800, dur: .04, body: 160, bodyVol: .02 }), 55);
        break;
      case 'castle':
        // Rei e torre: dois toques, o segundo um pouco mais seco.
        clack();
        later(() => clack({ vol: .045, cutoff: 2200, body: 210 }), 115);
        break;
      case 'check':
        clack({ vol: .045 });
        later(() => audio.tone({ freq: 1180, dur: .2, type: 'sine', vol: .04, slide: 1 }), 40);
        break;
      case 'promote':
        clack({ vol: .045, body: 220 });
        later(() => audio.tone({ freq: 700, dur: .12, type: 'sine', vol: .04, slide: 1 }), 70);
        later(() => audio.tone({ freq: 1050, dur: .2, type: 'sine', vol: .04, slide: 1 }), 170);
        break;
      case 'win':
        audio.tone({ freq: 620, dur: .22, type: 'sine', vol: .05, slide: 1 });
        later(() => audio.tone({ freq: 830, dur: .2, type: 'sine', vol: .045, slide: 1 }), 130);
        later(() => audio.tone({ freq: 1240, dur: .32, type: 'sine', vol: .045, slide: 1 }), 260);
        break;
      case 'lose':
        audio.tone({ freq: 330, dur: .3, type: 'triangle', vol: .045, slide: .62 });
        later(() => audio.tone({ freq: 220, dur: .38, type: 'triangle', vol: .04, slide: .6 }), 170);
        break;
      case 'draw':
        audio.tone({ freq: 420, dur: .2, type: 'triangle', vol: .035, slide: 1 });
        later(() => audio.tone({ freq: 420, dur: .26, type: 'triangle', vol: .03, slide: 1 }), 190);
        break;
      case 'select':
        // Encostar na peça: um toque bem curto e agudo, quase um clique.
        audio.noise({ dur: .022, vol: .022, filter: 'highpass', cutoff: 2600, attack: .1, curve: 'fall' });
        break;
      case 'deny':
        audio.tone({ freq: 190, dur: .09, type: 'square', vol: .025, slide: .8 });
        break;
      default:
        break;
    }
  }

  // O tipo de som de um lance sai do próprio lance: é a mesma conta nos modos
  // local e em rede.
  const soundOfMove = (move, check) => check ? 'check'
    : movePromotion(move) ? 'promote'
    : (move & CASTLE) ? 'castle'
    : (move & CAPTURE) ? 'capture' : 'move';

  // ------------------------------------------------------------------- lances
  function tell(text, tone = '') { message = text; messageTone = tone; }

  // Todo lance do jogador passa por aqui: local aplica na hora, rede vai pela
  // autoridade da sala.
  function commit(move) {
    if (netOn()) netCommit(move);
    else applyMove(move);
  }

  function applyMove(move) {
    const before = motion.snapshot();
    const capture = !!(move & CAPTURE);
    const san = sanOf(pos, move, current.moves);
    makeMove(pos, move);
    moveLog.push(move); sanLog.push(san); keyLog.push(positionKey(pos));
    lastMove = move; selected = -1; targets = [];
    current = status(pos, keyLog);
    haptics.buzz(capture ? 14 : 8);
    sound(soundOfMove(move, current.check));
    if (current.over) finish();
    if (!current.over) tell(current.check ? 'Xeque!' : '', current.check ? 'alert' : '');
    thinkLeft = levelOf(level).delay;
    save(); sync();
    if (!hud.overlayVisible) motion.play(before, moveFrom(move), moveTo(move), !!(move & CASTLE));
  }

  function finish() {
    const result = current.result;
    if (!scored && mode === 'maquina') {
      scored = true;
      const record = records[level];
      if (result === 'draw') record.draws++;
      else if ((result === 'white' ? WHITE : BLACK) === humanColor) record.wins++;
      else record.losses++;
    }
    const humanWon = result !== 'draw' && (result === 'white' ? WHITE : BLACK) === humanColor;
    sound(result === 'draw' ? 'draw' : mode === 'local' ? 'win' : humanWon ? 'win' : 'lose');
    haptics.buzz(result === 'draw' ? [12, 30, 12] : [16, 35, 24]);
    showResultOverlay();
  }

  function showResultOverlay() {
    const { result, reason } = resultInfo();
    const winner = result === 'draw' ? null : result === 'white' ? WHITE : BLACK;
    if (netOn()) {
      const { names, wins, ready } = net.match.state;
      const eu = net.match.state.seat;
      const title = result === 'draw' ? 'Empate'
        : winner === net.match.myColor() ? 'Você venceu!' : `${names[eu === HOST ? GUEST : HOST]} venceu`;
      hud.showOverlay({
        tag: 'Fim de partida', title,
        text: (REASONS[reason] || 'Fim de partida') + '.',
        action: ready[eu] ? 'Aguardando o outro jogador' : 'Revanche',
        secondary: 'Rever o tabuleiro',
        note: `Sala: ${names[0]} ${wins[0]} × ${wins[1]} ${names[1]} · ${wins[2]} empate(s)`
      });
      return;
    }
    const title = result === 'draw' ? 'Empate'
      : mode === 'local' ? `Vitória das ${COLOR_NAMES[winner]}`
      : winner === humanColor ? 'Você venceu!' : 'A máquina venceu';
    hud.showOverlay({
      tag: 'Fim de partida', title,
      text: (REASONS[reason] || 'Fim de partida') + '.',
      action: 'Nova partida', secondary: 'Rever o tabuleiro',
      note: mode === 'maquina' ? `${levelOf(level).label} · você joga de ${COLOR_NAMES[humanColor]}` : MODES.local.label
    });
  }

  function touch(index) {
    if (pendingPromotion) return;
    if (!canPlay()) {
      if (over()) tell('Partida encerrada. Comece outra para continuar.', 'alert');
      else if (machineTurn()) tell('A máquina está pensando.', '');
      sync();
      return;
    }
    const sq = squareAt(index);
    focused = index;
    const piece = pos.board[sq];
    if (selected >= 0) {
      const move = targets.find(candidate => moveTo(candidate) === sq);
      if (move) {
        const promotions = targets.filter(candidate => moveTo(candidate) === sq && movePromotion(candidate));
        if (promotions.length) { openPromotion(moveFrom(move), sq, promotions); return; }
        commit(move);
        return;
      }
      if (sq === selected) { selected = -1; targets = []; sync(); return; }
    }
    if (piece && colorOf(piece) === pos.turn) {
      selected = sq;
      targets = current.moves.filter(candidate => moveFrom(candidate) === sq);
      sound(targets.length ? 'select' : 'deny');
      tell(targets.length ? '' : 'Essa peça não tem lance legal agora.', targets.length ? '' : 'alert');
    } else if (selected >= 0) {
      sound('deny');
      tell('Lance ilegal. O rei não pode ficar em xeque.', 'alert');
    } else if (piece) {
      sound('deny');
      tell(`Vez das ${COLOR_NAMES[pos.turn]}.`, 'alert');
    }
    sync();
  }

  function openPromotion(from, to, promotions) {
    pendingPromotion = { from, to };
    promotionList.replaceChildren();
    for (const type of PROMOTION_CHOICES) {
      if (!promotions.some(move => movePromotion(move) === type)) continue;
      const button = el('button', 'nx-promotion-option');
      button.type = 'button';
      button.innerHTML = pieceSvg(type | pos.turn);
      button.append(el('span', '', SAN_LETTERS[type]));
      button.setAttribute('aria-label', describePiece(type | pos.turn));
      button.addEventListener('click', () => {
        const move = findMove(pos, from, to, type);
        pendingPromotion = null;
        promotionBox.hidden = true;
        if (move) commit(move); else sync();
        squares[focused >= 0 ? focused : 0].focus({ preventScroll: true });
      }, { signal });
      promotionList.append(button);
    }
    promotionBox.hidden = false;
    promotionList.firstElementChild?.focus();
    sync();
  }

  function undo() {
    if (destroyed || paused || hud.dialogOpen || hud.overlayVisible || netOn() || !moveLog.length || pendingPromotion) return;
    motion.cancel();
    // Contra a máquina volta o par de lances, senão o jogador só devolveria a
    // vez para ela repetir a mesma resposta.
    const steps = mode === 'maquina' && moveLog.length > 1 && pos.turn === humanColor ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      if (!moveLog.length) break;
      unmakeMove(pos);
      moveLog.pop(); sanLog.pop(); keyLog.pop();
    }
    lastMove = moveLog.length ? moveLog[moveLog.length - 1] : 0;
    selected = -1; targets = []; scored = false;
    current = status(pos, keyLog);
    hud.hideOverlay();
    tell('Lance desfeito.', '');
    thinkLeft = levelOf(level).delay;
    save(); sync();
  }

  function newGame(keepPaused = false) {
    motion.cancel();
    pos = createPosition();
    moveLog = []; sanLog = []; keyLog = [positionKey(pos)];
    current = status(pos, keyLog);
    selected = -1; targets = []; lastMove = 0; pendingPromotion = null;
    promotionBox.hidden = true;
    scored = false; paused = keepPaused;
    thinkLeft = levelOf(level).delay;
    tell('', '');
    if (!paused) hud.hideOverlay();
    save(); sync();
    if (paused) pauseOverlay();
  }

  // Refaz a partida guardada. Qualquer lance que não bata com as regras
  // descarta a sessão inteira: melhor começar limpo do que abrir um tabuleiro
  // impossível.
  function restore(moves) {
    if (!Array.isArray(moves) || moves.length > 600) return false;
    const fresh = createPosition();
    const log = [], sans = [], keys = [positionKey(fresh)];
    for (const move of moves) {
      if (!Number.isSafeInteger(move)) return false;
      const legal = legalMoves(fresh);
      const found = legal.find(candidate => candidate === move);
      if (!found) return false;
      sans.push(sanOf(fresh, found, legal));
      makeMove(fresh, found);
      log.push(found);
      keys.push(positionKey(fresh));
    }
    pos = fresh; moveLog = log; sanLog = sans; keyLog = keys;
    lastMove = log.length ? log[log.length - 1] : 0;
    current = status(pos, keyLog);
    scored = current.over;
    return true;
  }


  // ------------------------------------------------------------- sala na rede
  // O anfitrião é a autoridade: aplica os lances (os dele e os pedidos do
  // convidado) e transmite a lista da partida. O convidado só manda intenções
  // e reconstrói o tabuleiro com o que recebe — por isso não existe estado
  // local para reconciliar depois.
  function netAdopt() {
    if (!net?.match) return;
    pos = net.match.position;
    moveLog = net.match.state.moves;
    sanLog = net.match.sans;
    keyLog = net.match.keys;
    current = net.match.outcome;
    lastMove = moveLog.length ? moveLog[moveLog.length - 1] : 0;
    paused = net.match.state.paused;
    selected = -1; targets = [];
    pendingPromotion = null;
    promotionBox.hidden = true;
  }
  const netBroadcast = () => { if (net?.role === 'host') net.transport?.send(net.match.snapshot()); };

  function netAfterChange(antes) {
    const novoLance = net.match.state.moves.length > antes;
    const before = novoLance ? motion.snapshot() : null;
    const pausadoAntes = paused;
    netAdopt();
    // Entrar ou sair da pausa apaga o aviso pendente ("aguardando o outro
    // jogador confirmar"), que senão fica na tela depois de resolvido.
    if (pausadoAntes !== paused) tell('', '');
    if (novoLance) {
      sound(soundOfMove(lastMove, current.check));
      haptics.buzz((lastMove & CAPTURE) ? 14 : 8);
      tell(current.check && !over() ? 'Xeque!' : '', current.check && !over() ? 'alert' : '');
    }
    if (over()) showResultOverlay();
    else if (paused) pauseOverlay();
    else hud.hideOverlay();
    sync();
    if (before && moveLog.length === antes + 1 && !hud.overlayVisible) {
      motion.play(before, moveFrom(lastMove), moveTo(lastMove), !!(lastMove & CASTLE));
    }
  }

  function netCommit(move) {
    const antes = net.match.state.moves.length;
    if (net.role === 'host') {
      if (net.match.play(move, HOST)) { netAfterChange(antes); netBroadcast(); }
      return;
    }
    if (net.transport?.send(net.match.command('move', move))) {
      selected = -1; targets = [];
      tell('Lance enviado…', '');
      sync();
    } else {
      tell('Sem conexão com o outro aparelho.', 'alert');
      sync();
    }
  }

  function netSend(action) {
    if (!netReady()) return;
    const seat = net.match.state.seat;
    const antes = net.match.state.moves.length;
    if (net.role === 'host') {
      const mudou = action === 'pause' ? net.match.setPaused(true, HOST)
        : action === 'resume' ? net.match.confirmResume(HOST)
        : action === 'rematch' ? net.match.confirmRematch(HOST)
        : action === 'resign' ? net.match.resign(HOST) : false;
      if (mudou) { netAfterChange(antes); netBroadcast(); }
      return;
    }
    net.transport.send(net.match.command(action));
    if (action === 'resume' || action === 'rematch') tell('Aguardando o outro jogador confirmar…', '');
    sync();
  }

  function netMessage(payload) {
    if (!net?.match || !payload || typeof payload !== 'object') return;
    const antes = net.match.state.moves.length;
    if (payload.type === 'hello') {
      net.match.setName(net.match.state.seat === HOST ? GUEST : HOST, payload.name);
      if (net.role === 'host') netBroadcast();
      sync();
      return;
    }
    if (net.role === 'host') {
      if (payload.type !== 'command') return;
      if (net.match.applyCommand(payload, GUEST)) { netAfterChange(antes); netBroadcast(); }
      return;
    }
    if (payload.type !== 'state') return;
    const resultado = net.match.applySnapshot(payload);
    if (resultado.ok) { netAfterChange(antes); return; }
    // Pacote velho ou repetido é normal e se ignora. Já uma lista que não passa
    // pelas regras locais significa versões diferentes: aí a sala não pode
    // continuar fingindo que os dois veem o mesmo tabuleiro.
    if (resultado.reason === 'lance ilegal no pacote' || resultado.reason === 'estado incompatível') {
      net.transport.fail('Os aparelhos ficaram com partidas diferentes. Atualizem o jogo e criem outra sala.');
    }
  }

  function netRoom(role) {
    net.transport?.close();
    net.role = role;
    const seat = role === 'host' ? HOST : GUEST;
    net.match = createMatch({
      seat,
      names: seat === HOST ? [playerName, ''] : ['', playerName]
    });
    net.transport = new LanTransport({
      onStatus: (estado, texto) => {
        net.status = estado;
        net.lobby.update(estado, texto);
        if (estado === 'closed') { net.showBoard = false; selected = -1; targets = []; }
        if (estado === 'interrupted') { selected = -1; targets = []; }
        sync();
      },
      onOpen: () => {
        net.transport.send({ type: 'hello', name: playerName });
        net.showBoard = true;
        netAdopt();
        if (net.role === 'host') netBroadcast();
        hud.hideOverlay();
        tell('Conectados. Boa partida.', '');
        sync();
      },
      onMessage: netMessage
    });
    return net.transport;
  }

  function netStart(token = null) {
    if (net) return;
    net = { transport: null, match: null, lobby: null, role: null, status: 'idle' };
    net.lobby = createLanLobby({
      name: playerName,
      onName: value => { playerName = cleanName(value, 0); save(); return playerName; },
      onCreate: () => netRoom('host').createOffer(),
      onJoin: token => netRoom('guest').acceptOffer(token),
      onAnswer: token => net.transport.acceptAnswer(token),
      onLeave: () => { netClose(false); sync(); },
      onBack: () => { net.showBoard = true; sync(); }
    });
    lanPanel.replaceChildren(net.lobby.root);
    net.showBoard = false;
    if (token) net.lobby.showJoin(token);
    sync();
  }

  function netClose(full = true) {
    if (!net) return;
    net.transport?.close();
    net.transport = null;
    net.match = null;
    net.role = null;
    net.status = 'idle';
    net.showBoard = false;
    if (full) { net.lobby = null; lanPanel.replaceChildren(); net = null; }
  }

  // ------------------------------------------------------------------ desenho
  function capturedList(color) {
    // Conta o que sumiu do adversário. Promoção pode gerar mais dama do que a
    // inicial, então o saldo nunca fica negativo.
    const counts = {};
    for (let rank = 0; rank < 8; rank++) for (let file = 0; file < 8; file++) {
      const piece = pos.board[square(file, rank)];
      if (piece && colorOf(piece) === other(color)) counts[typeOf(piece)] = (counts[typeOf(piece)] || 0) + 1;
    }
    const taken = [];
    for (const type of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
      const missing = Math.max(0, INITIAL_COUNT[type] - (counts[type] || 0));
      for (let i = 0; i < missing; i++) taken.push(type | other(color));
    }
    return taken;
  }
  const materialOf = taken => taken.reduce((total, piece) => total + VALUES[typeOf(piece)], 0);

  function seatFor(color) {
    const bottomColor = flipped() ? BLACK : WHITE;
    return color === bottomColor ? seats.bottom : seats.top;
  }

  function syncSeats() {
    for (const color of [WHITE, BLACK]) {
      const seat = seatFor(color);
      const taken = capturedList(color);
      const edge = materialOf(taken) - materialOf(capturedList(other(color)));
      const machine = mode === 'maquina' && color === machineColor();
      const name = netOn()
        ? `${net.match.state.names[net.match.seatOf(color)]}` +
          `${net.match.seatOf(color) === net.match.state.seat ? ' (você)' : ''} · ${COLOR_NAMES[color]}`
        : mode === 'local' ? `Jogador das ${COLOR_NAMES[color]}`
        : machine ? `Máquina · ${levelOf(level).label} (${COLOR_NAMES[color]})`
        : `Você (${COLOR_NAMES[color]})`;
      seat.dataset.color = color === WHITE ? 'white' : 'black';
      seat.dataset.active = String(pos.turn === color && !over() && !paused);
      seat.querySelector('.nx-player-name').textContent = name;
      seat.querySelector('.nx-taken').innerHTML = taken.map(piece => pieceSvg(piece)).join('');
      // Saldo em peões, arredondado: quem está à frente por pouco ainda vê "+1".
      seat.querySelector('.nx-edge').textContent = edge > 0 ? `+${Math.max(1, Math.round(edge / 100))}` : '';
      seat.querySelector('.nx-edge').hidden = edge <= 0;
    }
  }

  function syncMoves() {
    const pairs = Math.ceil(sanLog.length / 2);
    movesList.replaceChildren();
    for (let i = 0; i < pairs; i++) {
      const item = el('li', 'nx-move-pair');
      item.append(el('b', '', `${i + 1}.`), el('span', '', sanLog[i * 2] || ''), el('span', '', sanLog[i * 2 + 1] || ''));
      if (i === pairs - 1) item.dataset.last = 'true';
      movesList.append(item);
    }
    historyBox.hidden = !sanLog.length;
    historyBox.scrollTop = historyBox.scrollHeight;
  }

  const lobbyOpen = () => mode === 'rede' && !!net && !(netReady() && net.showBoard);

  function sync() {
    const thinking = machineTurn() && !paused;
    const lobby = lobbyOpen();
    lanPanel.hidden = !lobby;
    app.dataset.lobby = String(lobby);
    app.dataset.paused = String(paused);
    app.dataset.boardStyle = boardStyle;
    syncOverlays();
    for (const strip of coordinateStrips) {
      const files = strip.classList.contains('nx-files');
      [...strip.children].forEach((node, i) => {
        node.textContent = files ? 'ABCDEFGH'[flipped() ? 7 - i : i] : String(flipped() ? i + 1 : 8 - i);
      });
    }
    board.dataset.turn = pos.turn === WHITE ? 'white' : 'black';
    board.setAttribute('aria-busy', String(thinking));
    const checkedKing = current.check ? pos.king[pos.turn >> 4] : -1;
    const from = lastMove ? moveFrom(lastMove) : -1, to = lastMove ? moveTo(lastMove) : -1;

    for (let index = 0; index < 64; index++) {
      const cell = squares[index], sq = squareAt(index);
      const piece = pos.board[sq];
      cell.dataset.square = String(sq);
      cell.dataset.coordinate = algebraic(sq);
      cell.dataset.shade = (fileOf(sq) + rankOf(sq)) % 2 === 0 ? 'dark' : 'light';
      if (cell.dataset.piece !== String(piece)) {
        cell.dataset.piece = String(piece);
        cell.innerHTML = piece ? pieceSvg(piece) : '';
      }
      const target = targets.find(move => moveTo(move) === sq);
      cell.classList.toggle('nx-selected', sq === selected);
      cell.classList.toggle('nx-target', showHints && !!target && !(target & CAPTURE));
      cell.classList.toggle('nx-capture', showHints && !!target && !!(target & CAPTURE));
      cell.classList.toggle('nx-from', sq === from);
      cell.classList.toggle('nx-to', sq === to);
      cell.classList.toggle('nx-check', sq === checkedKing);
      cell.tabIndex = index === focused || (focused < 0 && index === 0) ? 0 : -1;
      const label = `${algebraic(sq)}: ${describePiece(piece)}`;
      cell.setAttribute('aria-label', target ? `${label}. Lance disponível` : label);
      cell.setAttribute('aria-disabled', String(!canPlay()));
      cell.setAttribute('aria-pressed', String(sq === selected));
    }

    syncSeats();
    syncMoves();
    $('.nx-mode b').textContent = MODES[mode].label.toUpperCase();
    $('.nx-ply').textContent = `LANCE ${String(pos.fullmove).padStart(2, '0')}`;
    const outroNome = netOn() ? net.match.state.names[net.match.state.seat === HOST ? GUEST : HOST] : '';
    const headline = lobby ? 'Sala na mesma rede'
      : netOn() && !netReady() ? 'Sem conexão com o outro aparelho'
      : paused ? 'Partida em pausa'
      : over() ? (REASONS[resultInfo().reason] || 'Fim de partida')
      : thinking ? 'A máquina está pensando'
      : current.check ? 'Xeque!'
      : netOn() ? (net.match.myTurn() ? 'Sua vez' : `Vez de ${outroNome}`)
      : mode === 'local' ? `Vez das ${COLOR_NAMES[pos.turn]}`
      : pos.turn === humanColor ? 'Sua vez' : 'Vez da máquina';
    const { result: resultadoFinal } = resultInfo();
    const detail = lobby ? 'Criem a sala num aparelho e abram o convite no outro.'
      : over()
      ? (resultadoFinal === 'draw' ? 'Ninguém venceu.' : `Vitória das ${COLOR_NAMES[resultadoFinal === 'white' ? WHITE : BLACK]}.`)
      : selected >= 0 ? `Peça em ${algebraic(selected)} selecionada. Toque no destino.`
      : thinking ? 'Calculando a resposta…'
      : 'Toque na peça e no destino, ou arraste para mover.';
    $('.nx-message').textContent = message || headline;
    $('.nx-message').dataset.tone = messageTone;
    $('.nx-detail').textContent = detail;
    $('.nx-feedback').dataset.thinking = String(thinking);
    $('.nx-undo').hidden = netOn();
    $('.nx-undo').disabled = !moveLog.length || !!pendingPromotion || thinking;
    $('.nx-resign').hidden = !netOn();
    $('.nx-resign').disabled = !netReady() || over();
    $('.nx-new').disabled = netOn() && !over();
    $('.nx-new span').textContent = netOn() ? 'Revanche' : over() ? 'Jogar de novo' : 'Nova partida';

    if (mode === 'rede') {
      // O placar da sala vale enquanto a conexão existir e não mexe nos
      // retrospectos dos modos locais. Sem sala criada ainda, tudo é zero.
      const sala = net?.match?.state;
      const assento = sala ? sala.seat : HOST;
      hud.setStat('wins', String(sala ? sala.wins[assento] : 0));
      hud.setStat('draws', String(sala ? sala.wins[2] : 0));
      hud.setStat('losses', String(sala ? sala.wins[assento === HOST ? GUEST : HOST] : 0));
      hud.setChips([
        { text: 'Na mesma rede', tone: 'accent' },
        { text: netReady() ? `Você de ${COLOR_NAMES[myColor()]}` : 'Sala não conectada' },
        { text: netReady() ? `${moveLog.length} lance${moveLog.length === 1 ? '' : 's'}` : 'Aguardando pareamento', tone: 'flow' }
      ]);
    } else {
      const record = records[level];
      hud.setStat('wins', String(record.wins));
      hud.setStat('draws', String(record.draws));
      hud.setStat('losses', String(record.losses));
      hud.setChips([
        { text: mode === 'maquina' ? levelOf(level).label : 'Dois jogadores', tone: 'accent' },
        { text: mode === 'maquina' ? `Você de ${COLOR_NAMES[humanColor]}` : `Vez das ${COLOR_NAMES[pos.turn]}` },
        { text: `${moveLog.length} lance${moveLog.length === 1 ? '' : 's'}`, tone: 'flow' }
      ]);
    }
    hud.setPause(paused, !over());
    hud.setHint('Toque e escolha o destino · <strong>ou arraste</strong>');
    hud.flush();
  }

  // ----------------------------------------------------------------- controle
  function changeLevel(value) {
    if (!Object.hasOwn(LEVELS, value) || value === level) return;
    level = value;
    tell(`Nível ${levelOf(level).label}.`, '');
    save(); sync();
    hud.announce(`${levelOf(level).label}. ${levelOf(level).description}`);
  }
  function changeMode(value) {
    if (!Object.hasOwn(MODES, value) || value === mode) return;
    if (mode === 'rede') netClose(true);
    mode = value;
    newGame(false);
    if (mode === 'rede') netStart();
    sync();
  }
  function changeSide(value) {
    const color = value === 'black' ? BLACK : WHITE;
    if (color === humanColor) return;
    humanColor = color;
    newGame(paused || hud.dialogOpen);
  }
  function toggleFlip() {
    if (paused || hud.dialogOpen || hud.overlayVisible || pendingPromotion) return;
    motion.cancel();
    flip = !flipped();
    focused = -1;
    save(); sync();
  }

  function pauseOverlay() {
    if (netOn()) {
      const eu = net.match.state.seat;
      hud.showOverlay({
        tag: 'Sala pausada', title: 'Partida em pausa',
        text: 'A pausa vale para os dois aparelhos. Para retomar, os dois precisam confirmar.',
        action: net.match.state.ready[eu] ? 'Aguardando o outro jogador' : 'Continuar',
        secondary: 'Entregar a partida',
        note: net.match.state.names.join(' × ')
      });
      return;
    }
    hud.showOverlay({
      tag: 'No seu tempo', title: 'Partida em pausa',
      text: 'O tabuleiro fica guardado neste aparelho. Continue quando quiser.',
      action: 'Continuar', secondary: 'Nova partida',
      note: mode === 'maquina' ? `${levelOf(level).label} · você joga de ${COLOR_NAMES[humanColor]}` : MODES.local.label
    });
  }
  function pause() {
    if (destroyed || over() || paused) return;
    if (netOn()) { if (netReady()) netSend('pause'); return; }
    paused = true; pauseOverlay(); save(); sync();
  }
  function resume() {
    if (destroyed || !paused || hud.dialogOpen) return;
    if (netOn()) { audio.resume(); netSend('resume'); return; }
    paused = false; hud.hideOverlay(); audio.resume(); sync();
    const target = pendingPromotion ? promotionList.firstElementChild : squares[focused >= 0 ? focused : 0];
    target?.focus({ preventScroll: true });
  }

  $('.nx-new').addEventListener('click', () => { if (netOn()) netSend('rematch'); else newGame(); }, { signal });
  $('.nx-resign').addEventListener('click', () => {
    if (!netReady() || over()) return;
    confirmingResign = true;
    hud.showOverlay({
      tag: 'Confirmar', title: 'Entregar a partida?',
      text: 'A vitória vai para o outro jogador. A revanche continua disponível.',
      action: 'Continuar jogando', secondary: 'Entregar',
      note: net.match.state.names.join(' × ')
    });
  }, { signal });
  $('.nx-undo').addEventListener('click', undo, { signal });
  $('.nx-flip').addEventListener('click', toggleFlip, { signal });

  board.addEventListener('keydown', event => {
    const cell = event.target.closest('.nx-square');
    if (!cell || paused || hud.dialogOpen) return;
    const index = squares.indexOf(cell);
    const row = Math.floor(index / 8), column = index % 8;
    const targetsByKey = {
      ArrowLeft: row * 8 + Math.max(0, column - 1), ArrowRight: row * 8 + Math.min(7, column + 1),
      ArrowUp: Math.max(0, row - 1) * 8 + column, ArrowDown: Math.min(7, row + 1) * 8 + column,
      Home: row * 8, End: row * 8 + 7
    };
    if (Object.hasOwn(targetsByKey, event.key)) {
      event.preventDefault();
      focused = targetsByKey[event.key];
      squares.forEach((node, i) => { node.tabIndex = i === focused ? 0 : -1; });
      squares[focused].focus();
    }
  }, { signal });

  promotionBox.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const options = [...promotionList.children];
    const index = options.indexOf(document.activeElement);
    event.preventDefault();
    options[(index + (event.shiftKey ? -1 : 1) + options.length) % options.length]?.focus();
  }, { signal });

  window.addEventListener('keydown', event => {
    if (hud.dialogOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (paused) resume();
      else if (pendingPromotion) {
        pendingPromotion = null; promotionBox.hidden = true; sync();
        squares[focused >= 0 ? focused : 0].focus({ preventScroll: true });
      }
      else if (selected >= 0) { selected = -1; targets = []; sync(); }
      else paused ? resume() : pause();
    } else if (key === 'p') { event.preventDefault(); paused ? resume() : pause(); }
    else if (key === 'z') { event.preventDefault(); undo(); }
    else if (key === 'g') { event.preventDefault(); toggleFlip(); }
  }, { signal });

  // ------------------------------------------------------------------ ajustes
  function openSettings() {
    pause();
    const panel = el('div', 'nx-settings');
    function choices(title, name, options, selectedValue, onChange) {
      const field = el('fieldset');
      field.append(el('legend', '', title));
      const group = el('div', 'choices');
      for (const [value, label] of options) {
        const wrap = el('label', 'choice'), radio = el('input');
        radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = value === selectedValue;
        radio.addEventListener('change', () => onChange(value), { signal });
        wrap.append(radio, el('span', '', label));
        group.append(wrap);
      }
      field.append(group);
      panel.append(field);
    }
    choices('Modo · inicia uma nova partida', 'nx-mode', Object.entries(MODES).map(([key, value]) => [key, value.label]), mode, changeMode);
    choices('Nível da máquina', 'nx-level', Object.entries(LEVELS).map(([key, value]) => [key, `${value.label} · ${value.subtitle}`]), level, changeLevel);
    choices('Suas peças · inicia uma nova partida', 'nx-side', [['white', 'Brancas · você começa'], ['black', 'Pretas · a máquina começa']], humanColor === BLACK ? 'black' : 'white', changeSide);
    choices('Aparência', 'nx-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, value => theme.setMode(value));
    choices('Cor neon', 'nx-palette', PALETTE_OPTIONS.filter(option => option.value !== 'auto').map(option => [option.value, option.label]), theme.choice === 'auto' ? 'azul' : theme.choice, value => theme.setChoice(value));
    choices('Acabamento do tabuleiro', 'nx-board-style', [['neon', 'Neon · cor da biblioteca'], ['madeira', 'Madeira clássica']], boardStyle, value => {
      boardStyle = value; save(); sync();
    });

    const hintsLabel = el('label', 'nx-hint-setting');
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.checked = showHints;
    checkbox.addEventListener('change', () => { showHints = checkbox.checked; save(); sync(); }, { signal });
    hintsLabel.append(checkbox, el('span', '', 'Marcar as casas de destino da peça selecionada'));
    panel.append(hintsLabel);

    panel.append(el('h3', 'guide-title', 'Como jogar'));
    const how = el('ul');
    for (const text of [
      'Toque na peça e depois na casa de destino, ou arraste. Só aparecem lances legais: o rei nunca pode ficar em xeque.',
      'A moldura mostra as coordenadas e acompanha o giro. O acabamento Cor da biblioteca usa a cor neon escolhida, mantendo o contraste das peças.',
      'Roque, en passant e promoção estão implementados. Ao promover, escolha a peça na janela que abre sobre o tabuleiro.',
      'Empate por afogamento, tripla repetição, regra dos 50 lances e material insuficiente são reconhecidos automaticamente.',
      'Voltar lance desfaz o par (seu lance e o da máquina). Girar troca o lado que fica embaixo.',
      'Na mesma rede: dois aparelhos no mesmo Wi-Fi, um cria a sala e envia o convite. Quem cria joga de brancas; a revanche troca as cores.',
      'O som das peças liga no alto-falante da barra superior — ele vem desligado por padrão em todos os jogos.',
      'Atalhos: Z volta o lance, G gira o tabuleiro, P pausa, Esc cancela a seleção.',
      'O placar é contado por nível e só nas partidas contra a máquina.'
    ]) how.append(el('li', '', text));
    panel.append(how);

    panel.append(el('h3', 'guide-title', 'Níveis'));
    const levels = el('ul');
    for (const [key, info] of Object.entries(LEVELS)) {
      levels.append(el('li', '', `${info.label}: ${info.description}`));
    }
    panel.append(levels);
    const record = records[level];
    panel.append(el('p', '', `No ${levelOf(level).label.toLowerCase()}: ${record.wins} vitória(s), ${record.draws} empate(s), ${record.losses} derrota(s).`));
    if (!storageAvailable) panel.append(el('p', 'nx-storage-warning', 'Este navegador não está permitindo salvar. A partida continua funcionando nesta página.'));
    hud.setDialogContent(panel, 'Neon Chess · ajustes & regras');
    hud.openDialog();
  }

  function resize() {
    hud.flush();
    hud.setHint('Toque e escolha o destino · <strong>ou arraste</strong>');
    hud.flush();
    const rect = zone.getBoundingClientRect();
    // Referência: grid 736, casas 92, margem 46 de cada lado = moldura 828.
    // Uma única escala limita largura E altura; conteúdo das casas não mede o grid.
    const size = Math.max(0, Math.min(736, rect.width * 8 / 9, rect.height * 8 / 9));
    if (Math.abs(parseFloat(frame.style.getPropertyValue('--nx-board-size')) - size) < .1) return;
    motion.cancel();
    frame.style.setProperty('--nx-board-size', size + 'px');
    frame.style.setProperty('--nx-cell', size / 8 + 'px');
    frame.style.setProperty('--nx-unit', size / 736 + 'px');
  }

  // O histórico e as faixas mudam de altura sem redimensionar a arena.
  // Observar a zona evita sobras, recortes e dimensões antigas depois do lance.
  const boardObserver = new ResizeObserver(resize);
  boardObserver.observe(zone);

  if (!restore(saved?.moves)) newGame();
  // Convite aberto pelo link: o fragmento #chess=... nunca chega ao servidor,
  // e some da barra de endereço assim que é lido.
  const convite = new URLSearchParams(location.hash.slice(1)).get('chess');
  if (convite) {
    history.replaceState(null, '', location.pathname + location.search);
    mode = 'rede';
    netStart(convite);
  }
  hud.hideOverlay();
  sync();
  resize();
  if (current.over) showResultOverlay();

  return {
    meta,
    update(dt) {
      if (destroyed || paused || hud.dialogOpen || pendingPromotion) return;
      if (!machineTurn()) return;
      thinkLeft -= dt;
      if (thinkLeft > 0) return;
      const decision = chooseMove(pos, level);
      if (decision) applyMove(decision.move);
    },
    render(dt) { hud.tickToast(dt); hud.flush(); },
    resize,
    primaryAction: () => {
      if (confirmingResign) { confirmingResign = false; hud.hideOverlay(); sync(); return; }
      if (netOn()) { if (paused) resume(); else if (over()) netSend('rematch'); return; }
      if (paused) resume(); else if (over()) newGame();
    },
    secondaryAction: () => {
      if (confirmingResign) { confirmingResign = false; netSend('resign'); return; }
      if (netOn()) { if (paused) netSend('resign'); else if (over()) hud.hideOverlay(); return; }
      if (paused) newGame(); else if (over()) hud.hideOverlay();
    },
    pause, resume,
    pauseToggle: () => paused ? resume() : pause(),
    onHidden: pause,
    openSettings,
    onThemeChange: () => {},
    getState: () => ({
      state: paused ? 'paused' : over() ? 'over' : machineTurn() ? 'thinking' : 'playing',
      mode, difficulty: level, human: COLOR_NAMES[myColor()], turn: COLOR_NAMES[pos.turn],
      room: netOn() ? { role: net.role, status: net.status, names: [...net.match.state.names],
                        wins: [...net.match.state.wins], match: net.match.state.match } : null,
      fen: positionKey(pos), moves: sanLog.length, check: current.check,
      result: resultInfo().result, reason: resultInfo().reason, record: { ...records[level] }
    }),
    destroy() {
      destroyed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      netClose(true);
      lifecycle.abort();
      boardObserver.disconnect();
      overlayObserver.disconnect();
      view.remove();
      input.destroy();
      app.classList.remove('nx-app');
      document.body.classList.remove('nx-body');
      delete app.dataset.paused;
      delete app.dataset.boardStyle;
      delete app.dataset.lobby;
    }
  };
}
