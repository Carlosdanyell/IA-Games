import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  START_FEN, createPosition, legalMoves, makeMove, unmakeMove, status, sanOf,
  moveFrom, moveTo, movePromotion, findMove, positionKey,
  typeOf, colorOf, other, fileOf, rankOf, square, algebraic,
  CAPTURE, CASTLE, PROMOTION_CHOICES, SAN_LETTERS
} from './model.js';
import { chooseMove, LEVELS, DEFAULT_LEVEL, levelOf, VALUES } from './ai.js';
import { pieceSvg, describePiece } from './pieces.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';

export const meta = {
  id: 'neon-chess', title: 'NEON<span>CHESS</span>', subtitle: 'XADREZ / 5 NÍVEIS',
  arenaLabel: 'Xadrez: mova as peças e dê xeque-mate no rei adversário.',
  logicalSize: () => ({ w: 400, h: 400 }),
  stats: [{ id: 'wins', label: 'Vitórias', accent: true }, { id: 'draws', label: 'Empates' }, { id: 'losses', label: 'Derrotas' }]
};

const MODES = {
  maquina: { label: 'Contra a máquina', hint: 'Escolha o nível nos ajustes.' },
  local: { label: 'Dois jogadores', hint: 'Os dois jogam neste aparelho.' }
};
const COLOR_NAMES = { [WHITE]: 'brancas', [BLACK]: 'pretas' };
const INITIAL_COUNT = { [PAWN]: 8, [KNIGHT]: 2, [BISHOP]: 2, [ROOK]: 2, [QUEEN]: 1 };
const REASONS = {
  mate: 'Xeque-mate', stalemate: 'Afogamento (rei sem lance legal, mas sem xeque)',
  fifty: 'Empate pela regra dos 50 lances', repetition: 'Empate por tripla repetição',
  material: 'Empate por material insuficiente'
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
  const records = Object.fromEntries(Object.keys(LEVELS).map(key => [key, cleanRecord(saved?.records?.[key])]));
  let storageAvailable = true;

  // -------------------------------------------------------------------estado
  let pos = createPosition();
  let moveLog = [], sanLog = [], keyLog = [positionKey(pos)];
  let current = status(pos, keyLog);
  let selected = -1, targets = [], lastMove = 0, pendingPromotion = null;
  let thinkLeft = 0, paused = false, destroyed = false, scored = false;
  let focused = -1, message = '', messageTone = '';

  // --------------------------------------------------------------------- DOM
  const view = el('div', 'nx-surface');
  view.innerHTML = `
    <div class="nx-heading"><span class="nx-mode"><i></i><b></b></span><span class="nx-ply"></span></div>
    <div class="nx-player" data-seat="top"><span class="nx-player-name"></span><span class="nx-taken"></span><span class="nx-edge"></span></div>
    <div class="nx-board-zone">
      <div class="nx-board" role="group" aria-label="Tabuleiro de xadrez, oito linhas por oito colunas"></div>
      <div class="nx-promotion" hidden><p>Promover o peão para:</p><div class="nx-promotion-list"></div></div>
    </div>
    <div class="nx-player" data-seat="bottom"><span class="nx-player-name"></span><span class="nx-taken"></span><span class="nx-edge"></span></div>
    <div class="nx-feedback" role="status" aria-live="polite" aria-atomic="true"><strong class="nx-message"></strong><span class="nx-detail"></span></div>
    <div class="nx-history"><ol class="nx-moves" aria-label="Lances da partida"></ol></div>
    <div class="nx-controls">
      <button class="nx-new" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></svg><span>Nova partida</span></button>
      <button class="nx-undo" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg><span>Voltar lance</span></button>
      <button class="nx-flip" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/></svg><span>Girar</span></button>
    </div>`;
  hud.arena.append(view);
  const $ = selector => view.querySelector(selector);
  const board = $('.nx-board'), zone = $('.nx-board-zone');
  const promotionBox = $('.nx-promotion'), promotionList = $('.nx-promotion-list');
  const movesList = $('.nx-moves'), historyBox = $('.nx-history');
  const seats = { top: $('[data-seat="top"]'), bottom: $('[data-seat="bottom"]') };

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
  const flipped = () => flip === null ? humanColor === BLACK : flip;
  const squareAt = index => {
    const row = Math.floor(index / 8), column = index % 8;
    return flipped() ? square(7 - column, row) : square(column, 7 - row);
  };

  const over = () => current.over;
  const machineColor = () => other(humanColor);
  const machineTurn = () => mode === 'maquina' && !over() && pos.turn === machineColor();
  const canPlay = () => !destroyed && !paused && !hud.dialogOpen && !over() && !machineTurn() && !pendingPromotion;

  function save() {
    storageAvailable = store.set('session-v1', {
      mode, level, humanColor: humanColor === BLACK ? 'black' : 'white', flip, showHints,
      records, moves: moveLog
    });
  }

  // --------------------------------------------------------------- som e tato
  function sound(kind) {
    audio.resume();
    if (kind === 'move') audio.tone({ freq: 430, dur: .07, type: 'triangle', vol: .04, slide: 1 });
    else if (kind === 'capture') audio.tone({ freq: 250, dur: .12, type: 'square', vol: .035, slide: .85 });
    else if (kind === 'castle') audio.tone({ freq: 520, dur: .12, type: 'triangle', vol: .04, slide: 1.15 });
    else if (kind === 'check') audio.tone({ freq: 880, dur: .16, type: 'sine', vol: .05, slide: 1.1 });
    else if (kind === 'win') audio.tone({ freq: 660, dur: .3, type: 'sine', vol: .055, slide: 1.5 });
    else if (kind === 'lose') audio.tone({ freq: 300, dur: .34, type: 'triangle', vol: .045, slide: .6 });
    else if (kind === 'draw') audio.tone({ freq: 330, dur: .26, type: 'triangle', vol: .035, slide: 1 });
  }

  // ------------------------------------------------------------------- lances
  function tell(text, tone = '') { message = text; messageTone = tone; }

  function applyMove(move) {
    const capture = !!(move & CAPTURE);
    const castle = !!(move & CASTLE);
    const san = sanOf(pos, move, current.moves);
    makeMove(pos, move);
    moveLog.push(move); sanLog.push(san); keyLog.push(positionKey(pos));
    lastMove = move; selected = -1; targets = [];
    current = status(pos, keyLog);
    haptics.buzz(capture ? 14 : 8);
    if (current.over) finish();
    else if (current.check) sound('check');
    else sound(castle ? 'castle' : capture ? 'capture' : 'move');
    if (!current.over) tell(current.check ? 'Xeque!' : '', current.check ? 'alert' : '');
    thinkLeft = levelOf(level).delay;
    save(); sync();
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
    const result = current.result;
    const winner = result === 'draw' ? null : result === 'white' ? WHITE : BLACK;
    const title = result === 'draw' ? 'Empate'
      : mode === 'local' ? `Vitória das ${COLOR_NAMES[winner]}`
      : winner === humanColor ? 'Você venceu!' : 'A máquina venceu';
    hud.showOverlay({
      tag: 'Fim de partida', title,
      text: REASONS[current.reason] + '.',
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
        applyMove(move);
        return;
      }
      if (sq === selected) { selected = -1; targets = []; sync(); return; }
    }
    if (piece && colorOf(piece) === pos.turn) {
      selected = sq;
      targets = current.moves.filter(candidate => moveFrom(candidate) === sq);
      tell(targets.length ? '' : 'Essa peça não tem lance legal agora.', targets.length ? '' : 'alert');
    } else if (selected >= 0) {
      tell('Lance ilegal. O rei não pode ficar em xeque.', 'alert');
    } else if (piece) {
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
        if (move) applyMove(move); else sync();
      }, { signal });
      promotionList.append(button);
    }
    promotionBox.hidden = false;
    promotionList.firstElementChild?.focus();
    sync();
  }

  function undo() {
    if (destroyed || !moveLog.length || pendingPromotion) return;
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
      const name = mode === 'local' ? `Jogador das ${COLOR_NAMES[color]}`
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

  function sync() {
    const thinking = machineTurn() && !paused;
    app.dataset.paused = String(paused);
    view.inert = paused;
    board.dataset.turn = pos.turn === WHITE ? 'white' : 'black';
    board.setAttribute('aria-busy', String(thinking));
    const checkedKing = current.check ? pos.king[pos.turn >> 4] : -1;
    const from = lastMove ? moveFrom(lastMove) : -1, to = lastMove ? moveTo(lastMove) : -1;

    for (let index = 0; index < 64; index++) {
      const cell = squares[index], sq = squareAt(index);
      const piece = pos.board[sq];
      cell.dataset.square = String(sq);
      cell.dataset.shade = (fileOf(sq) + rankOf(sq)) % 2 === 0 ? 'dark' : 'light';
      if (cell.dataset.piece !== String(piece)) {
        cell.dataset.piece = String(piece);
        cell.innerHTML = piece ? pieceSvg(piece) : '';
      }
      const target = targets.find(move => moveTo(move) === sq);
      cell.classList.toggle('nx-selected', sq === selected);
      cell.classList.toggle('nx-target', showHints && !!target && !piece);
      cell.classList.toggle('nx-capture', showHints && !!target && !!piece);
      cell.classList.toggle('nx-from', sq === from);
      cell.classList.toggle('nx-to', sq === to);
      cell.classList.toggle('nx-check', sq === checkedKing);
      cell.tabIndex = index === focused || (focused < 0 && index === 0) ? 0 : -1;
      const label = `${algebraic(sq)}: ${describePiece(piece)}`;
      cell.setAttribute('aria-label', target ? `${label}. Lance disponível` : label);
      cell.setAttribute('aria-disabled', String(!canPlay()));
    }

    syncSeats();
    syncMoves();
    $('.nx-mode b').textContent = MODES[mode].label.toUpperCase();
    $('.nx-ply').textContent = `LANCE ${String(pos.fullmove).padStart(2, '0')}`;
    const headline = paused ? 'Partida em pausa'
      : over() ? REASONS[current.reason]
      : thinking ? 'A máquina está pensando'
      : current.check ? 'Xeque!'
      : mode === 'local' ? `Vez das ${COLOR_NAMES[pos.turn]}`
      : pos.turn === humanColor ? 'Sua vez' : 'Vez da máquina';
    const detail = over()
      ? (current.result === 'draw' ? 'Ninguém venceu.' : `Vitória das ${COLOR_NAMES[current.result === 'white' ? WHITE : BLACK]}.`)
      : selected >= 0 ? `Peça em ${algebraic(selected)} selecionada. Toque no destino.`
      : thinking ? 'Calculando a resposta…'
      : 'Toque na peça e depois na casa de destino.';
    $('.nx-message').textContent = message || headline;
    $('.nx-message').dataset.tone = messageTone;
    $('.nx-detail').textContent = detail;
    $('.nx-feedback').dataset.thinking = String(thinking);
    $('.nx-undo').disabled = !moveLog.length || !!pendingPromotion || thinking;
    $('.nx-new span').textContent = over() ? 'Jogar de novo' : 'Nova partida';

    const record = records[level];
    hud.setStat('wins', String(record.wins));
    hud.setStat('draws', String(record.draws));
    hud.setStat('losses', String(record.losses));
    hud.setChips([
      { text: mode === 'maquina' ? levelOf(level).label : 'Dois jogadores', tone: 'accent' },
      { text: mode === 'maquina' ? `Você de ${COLOR_NAMES[humanColor]}` : `Vez das ${COLOR_NAMES[pos.turn]}` },
      { text: `${moveLog.length} lance${moveLog.length === 1 ? '' : 's'}`, tone: 'flow' }
    ]);
    hud.setPause(paused, !over());
    hud.setHint('Toque na peça · <strong>depois no destino</strong>');
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
    mode = value;
    newGame(paused || hud.dialogOpen);
  }
  function changeSide(value) {
    const color = value === 'black' ? BLACK : WHITE;
    if (color === humanColor) return;
    humanColor = color;
    newGame(paused || hud.dialogOpen);
  }
  function toggleFlip() {
    flip = !flipped();
    focused = -1;
    save(); sync();
  }

  function pauseOverlay() {
    hud.showOverlay({
      tag: 'No seu tempo', title: 'Partida em pausa',
      text: 'O tabuleiro fica guardado neste aparelho. Continue quando quiser.',
      action: 'Continuar', secondary: 'Nova partida',
      note: mode === 'maquina' ? `${levelOf(level).label} · você joga de ${COLOR_NAMES[humanColor]}` : MODES.local.label
    });
  }
  function pause() {
    if (destroyed || over() || paused) return;
    paused = true; pauseOverlay(); save(); sync();
  }
  function resume() {
    if (destroyed || !paused || hud.dialogOpen) return;
    paused = false; hud.hideOverlay(); audio.resume(); sync();
  }

  $('.nx-new').addEventListener('click', () => newGame(), { signal });
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

  window.addEventListener('keydown', event => {
    if (hud.dialogOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (pendingPromotion) { pendingPromotion = null; promotionBox.hidden = true; sync(); }
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
      'Toque na peça e depois na casa de destino. Só aparecem lances legais: o rei nunca pode ficar em xeque.',
      'Roque, en passant e promoção estão implementados. Ao promover, escolha a peça na janela que abre sobre o tabuleiro.',
      'Empate por afogamento, tripla repetição, regra dos 50 lances e material insuficiente são reconhecidos automaticamente.',
      'Voltar lance desfaz o par (seu lance e o da máquina). Girar troca o lado que fica embaixo.',
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
    hud.setHint('Toque na peça · <strong>depois no destino</strong>');
    hud.flush();
    const rect = zone.getBoundingClientRect();
    const size = Math.max(180, Math.min(420, rect.width - 4, rect.height - 4));
    board.style.setProperty('--nx-board-size', size + 'px');
  }

  if (!restore(saved?.moves)) newGame();
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
    primaryAction: () => paused ? resume() : over() ? newGame() : undefined,
    secondaryAction: () => { if (paused) newGame(); else if (over()) hud.hideOverlay(); },
    pause, resume,
    pauseToggle: () => paused ? resume() : pause(),
    onHidden: pause,
    openSettings,
    onThemeChange: () => {},
    getState: () => ({
      state: paused ? 'paused' : over() ? 'over' : machineTurn() ? 'thinking' : 'playing',
      mode, difficulty: level, human: COLOR_NAMES[humanColor], turn: COLOR_NAMES[pos.turn],
      fen: positionKey(pos), moves: sanLog.length, check: current.check,
      result: current.result, reason: current.reason, record: { ...records[level] }
    }),
    destroy() {
      destroyed = true;
      lifecycle.abort();
      view.remove();
      input.destroy();
      app.classList.remove('nx-app');
      document.body.classList.remove('nx-body');
      delete app.dataset.paused;
    }
  };
}
