import { LEVELS, createRound, move, restoreRound, other, cleanRecord } from './model.js';
import { chooseMove } from './ai.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';

export const meta = {
  id: 'neon-grid', title: 'NEON<span>GRID</span>', subtitle: 'TRÊS EM LINHA',
  arenaLabel: 'Jogo da velha: alinhe três símbolos para vencer a inteligência artificial.',
  logicalSize: () => ({ w: 400, h: 400 }),
  stats: [{ id: 'wins', label: 'Vitórias', accent: true }, { id: 'draws', label: 'Empates' }, { id: 'losses', label: 'Derrotas' }]
};
const symbol = mark => mark === 'X'
  ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M28 28 72 72M72 28 28 72"/></svg>'
  : '<svg viewBox="0 0 100 100" aria-hidden="true"><circle pathLength="1" cx="50" cy="50" r="29"/></svg>';
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function create({ hud, input, theme, audio, haptics, store }) {
  input.setEnabled(false);
  const lifecycle = new AbortController(), signal = lifecycle.signal;
  if (!document.getElementById('ng-style')) {
    const style = el('link'); style.id = 'ng-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    style.addEventListener('load', () => resize(), { signal }); document.head.append(style);
  }
  const app = hud.arena.closest('.app'); app.classList.add('ng-app');
  // Em tela larga o shell centraliza o #root, que fica do tamanho do conteúdo:
  // sem soltar esse encaixe, o max-width de .ng-app nunca é usado e o
  // tabuleiro encolhe. A marca no body é o que alcança o #root.
  document.body.classList.add('ng-body');
  hud.canvas.setAttribute('aria-hidden', 'true');
  hud.el.settings.textContent = 'Ajustes & regras';
  theme.setAuto('purple');

  const saved = store.get('session-v1', {});
  let level = Object.hasOwn(LEVELS, saved?.level) ? saved.level : 'medio';
  let human = saved?.human === 'O' ? 'O' : 'X';
  let effects = saved?.effects !== false;
  const records = Object.fromEntries(Object.keys(LEVELS).map(key => [key, cleanRecord(saved?.records?.[key])]));
  let round = restoreRound(saved?.history) || createRound();
  let roundNumber = Number.isSafeInteger(saved?.roundNumber) && saved.roundNumber > 0 && saved.roundNumber < 1e7 ? saved.roundNumber : 1;
  let paused = false, destroyed = false, scored = !!(round.winner || round.draw);
  let thinkLeft = LEVELS[level].delay;
  let focused = round.board.findIndex(mark => !mark); if (focused < 0) focused = 0;
  let storageAvailable = true, helpText = '', helpLeft = 0;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = [];
  const visualTimers = new Set();
  const view = el('div', 'ng-surface');
  view.innerHTML = `
    <div class="ng-heading"><span class="ng-online"><i></i> DUELO CONTRA A IA</span><span class="ng-round"></span></div>
    <div class="ng-matchup" aria-label="Jogadores">
      <div class="ng-player" data-player="human"><span class="ng-player-mark"></span><span><b>VOCÊ</b><small class="ng-human-label"></small></span><i></i></div>
      <span class="ng-vs" aria-hidden="true">VS</span>
      <div class="ng-player" data-player="ai"><span class="ng-player-mark"></span><span><b>NEON AI</b><small class="ng-ai-label"></small></span><i></i></div>
    </div>
    <div class="ng-board-zone"><div class="ng-board" role="group" aria-label="Tabuleiro: três linhas e três colunas">
      <div class="ng-cells"></div><svg class="ng-victory" viewBox="0 0 300 300" aria-hidden="true"></svg>
      <div class="ng-particles" aria-hidden="true"></div>
    </div></div>
    <div class="ng-feedback" role="status" aria-live="polite" aria-atomic="true"><strong class="ng-message"></strong><span class="ng-detail"></span></div>
    <div class="ng-controls">
      <div class="ng-levels" role="group" aria-label="Dificuldade da inteligência artificial"></div>
      <p class="ng-level-note">Trocar o nível inicia outra rodada.</p>
      <button class="ng-again" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></svg><span>Reiniciar rodada</span></button>
    </div>`;
  hud.arena.append(view);
  const $ = selector => view.querySelector(selector);
  const board = $('.ng-board'), zone = $('.ng-board-zone'), lines = $('.ng-victory'), particleLayer = $('.ng-particles');
  const cells = Array.from({ length: 9 }, (_, index) => {
    const cell = el('button', 'ng-cell'); cell.type = 'button'; cell.dataset.cell = index;
    cell.addEventListener('click', () => play(index), { signal });
    $('.ng-cells').append(cell); return cell;
  });
  const levelButtons = Object.entries(LEVELS).map(([key, info]) => {
    const button = el('button', 'ng-level'); button.type = 'button';
    button.append(el('b', '', info.label), el('small', '', info.subtitle));
    button.title = info.description; button.setAttribute('aria-label', `Nível ${info.label}`);
    button.addEventListener('click', () => changeLevel(key), { signal });
    $('.ng-levels').append(button); return { key, button };
  });
  const humanPanel = $('[data-player="human"]'), aiPanel = $('[data-player="ai"]');
  const done = () => !!(round.winner || round.draw);
  const aiTurn = () => !done() && round.turn !== human;
  const canPlay = () => !destroyed && !paused && !hud.dialogOpen && !done() && !aiTurn();
  const fullEffects = () => effects && !motion.matches;
  function save() {
    storageAvailable = store.set('session-v1', { level, human, effects, records,
      history: round.history, roundNumber });
  }
  function later(fn, delay) {
    const timer = setTimeout(() => { visualTimers.delete(timer); if (!destroyed) fn(); }, delay);
    visualTimers.add(timer);
  }
  function clearEffects() {
    for (const timer of visualTimers) clearTimeout(timer); visualTimers.clear();
    particles.length = 0; particleLayer.replaceChildren();
    lines.replaceChildren(); board.classList.remove('ng-won', 'ng-draw');
  }
  function burst(cell, mark, count = 8) {
    if (!fullEffects()) return;
    const x = ((cell % 3) + .5) / 3 * 100, y = (Math.floor(cell / 3) + .5) / 3 * 100;
    for (let i = 0; i < count && particles.length < 70; i++) {
      const spark = el('i', 'ng-spark'); spark.dataset.mark = mark;
      const angle = Math.PI * 2 * i / count + Math.random() * .3;
      const distance = 24 + Math.random() * (count > 8 ? 100 : 32);
      spark.style.left = x + '%'; spark.style.top = y + '%';
      spark.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      spark.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      spark.style.setProperty('--spin', Math.round(Math.random() * 360) + 'deg');
      particleLayer.append(spark); particles.push(spark);
      later(() => { spark.remove(); const n = particles.indexOf(spark); if (n >= 0) particles.splice(n, 1); }, 950);
    }
  }
  function drawWinningLines(animate = true) {
    lines.replaceChildren();
    for (const line of round.lines) {
      const first = line[0], last = line[2];
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${first % 3 * 100 + 50} ${Math.floor(first / 3) * 100 + 50}L${last % 3 * 100 + 50} ${Math.floor(last / 3) * 100 + 50}`);
      path.setAttribute('pathLength', '1'); lines.append(path);
    }
    lines.dataset.mark = round.winner || '';
    lines.dataset.animate = String(animate && fullEffects());
    board.classList.toggle('ng-won', !!round.winner); board.classList.toggle('ng-draw', round.draw);
  }
  function sound(mark, victory = false) {
    audio.resume();
    audio.tone({ freq: victory ? 660 : mark === 'X' ? 620 : 380, dur: victory ? .28 : .12,
      type: 'sine', vol: .055, slide: victory ? 1.5 : .8 });
    if (victory) later(() => audio.tone({ freq: 990, dur: .24, type: 'sine', vol: .04, slide: 1.2 }), 130);
  }
  function commit(cell, mark) {
    const next = move(round, cell, mark); if (next === round) return false;
    round = next; helpText = ''; helpLeft = 0;
    sound(mark); haptics.buzz(9);
    if (done() && !scored) {
      scored = true;
      const record = records[level];
      if (round.draw) { record.draws++; record.streak = 0; }
      else if (round.winner === human) { record.wins++; record.streak++; record.best = Math.max(record.best, record.streak); }
      else { record.losses++; record.streak = 0; }
      if (round.winner === human) { sound(mark, true); haptics.buzz([16, 35, 24]); }
      else if (round.draw) audio.tone({ freq: 270, dur: .22, type: 'triangle', vol: .03, slide: 1 });
    }
    thinkLeft = LEVELS[level].delay;
    save(); sync(cell); burst(cell, mark);
    if (done()) { drawWinningLines(); if (round.winner) for (const target of round.lines[0]) burst(target, mark, 14); }
    return true;
  }
  function play(cell) {
    if (!canPlay()) return;
    if (round.board[cell]) {
      helpText = 'Essa casa já está ocupada.'; helpLeft = 1.4; sync(); return;
    }
    focused = cell; commit(cell, human);
  }
  function sync(fresh = -1) {
    const finished = done(), thinking = aiTurn(), record = records[level];
    app.dataset.effects = fullEffects() ? 'full' : 'low';
    app.dataset.paused = String(paused); view.inert = paused;
    board.dataset.turn = round.turn;
    board.setAttribute('aria-busy', String(thinking && !paused));
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i], mark = round.board[i] || '';
      if (cell.dataset.mark !== mark || (!mark && cell.dataset.preview !== human)) {
        cell.dataset.mark = mark; cell.dataset.preview = human;
        cell.innerHTML = mark ? symbol(mark) : `<span class="ng-coordinate" aria-hidden="true">${i + 1}</span><span class="ng-ghost" aria-hidden="true">${symbol(human)}</span>`;
      }
      cell.dataset.fresh = String(i === fresh && fullEffects());
      cell.classList.toggle('ng-winning', round.lines.some(line => line.includes(i)));
      cell.classList.toggle('ng-last', i === round.history.at(-1));
      cell.tabIndex = i === focused ? 0 : -1;
      cell.setAttribute('aria-disabled', String(!!mark || !canPlay()));
      cell.setAttribute('aria-label', `Linha ${Math.floor(i / 3) + 1}, coluna ${i % 3 + 1}: ${mark || 'vazia'}${mark || !canPlay() ? '' : `. Jogar ${human}`}`);
    }
    for (const { key, button } of levelButtons) button.setAttribute('aria-pressed', String(level === key));
    humanPanel.dataset.mark = human; aiPanel.dataset.mark = other(human);
    humanPanel.dataset.active = String(!finished && !thinking && !paused);
    aiPanel.dataset.active = String(thinking && !paused);
    humanPanel.querySelector('.ng-player-mark').innerHTML = symbol(human);
    aiPanel.querySelector('.ng-player-mark').innerHTML = symbol(other(human));
    $('.ng-human-label').textContent = 'Símbolo ' + human;
    $('.ng-ai-label').textContent = LEVELS[level].label + ' · ' + other(human);
    $('.ng-round').textContent = 'RODADA ' + String(roundNumber).padStart(2, '0');
    const message = paused ? 'Rodada pausada' : round.winner === human ? 'Você dominou a grade!' : round.winner ? 'A IA fechou a linha.' : round.draw ? 'Deu velha. Bom duelo!' : thinking ? 'A IA está pensando' : 'Sua vez de brilhar.';
    const detail = round.winner === human ? 'Três em linha. Vitória sua.' : round.winner ? 'Mais uma? Mude a estratégia na próxima rodada.' : round.draw ? 'Nove casas. Ninguém cedeu espaço.' : thinking ? 'Analisando a próxima jogada…' : `Toque em uma casa vazia para jogar ${human}.`;
    $('.ng-message').textContent = helpText || message;
    $('.ng-detail').textContent = detail;
    $('.ng-feedback').dataset.thinking = String(thinking && !paused);
    $('.ng-feedback').dataset.result = round.winner === human ? 'win' : finished ? 'over' : '';
    $('.ng-again span').textContent = finished ? 'Jogar de novo' : 'Reiniciar rodada';
    hud.setStat('wins', String(record.wins)); hud.setStat('draws', String(record.draws)); hud.setStat('losses', String(record.losses));
    hud.setChips([{ text: LEVELS[level].label, tone: 'accent' },
      { text: `Você ${human} · IA ${other(human)}` },
      { text: record.streak > 1 ? `${record.streak} vitórias seguidas` : 'X sempre começa', tone: 'flow' }]);
    hud.setPause(paused, !finished);
    hud.setHint('Toque nas casas · <strong>3 em linha</strong>');
    hud.flush();
  }
  function startRound(keepPaused = false) {
    clearEffects(); round = createRound(); scored = false; paused = keepPaused;
    focused = 0; roundNumber++; thinkLeft = LEVELS[level].delay; helpText = ''; helpLeft = 0;
    if (!paused) hud.hideOverlay();
    save(); sync(); if (paused) pauseOverlay();
  }
  function changeLevel(value) {
    if (!Object.hasOwn(LEVELS, value) || value === level) return;
    level = value; startRound(paused || hud.dialogOpen);
    hud.announce(`${LEVELS[level].label} selecionado. Nova rodada. ${LEVELS[level].description}`);
  }
  function pauseOverlay() {
    hud.showOverlay({ tag: 'No seu tempo', title: 'Duelo em pausa',
      text: 'Sua grade está guardada. Continue quando quiser.', action: 'Continuar',
      secondary: 'Reiniciar rodada', note: `${LEVELS[level].label} · Você joga de ${human}` });
  }
  function pause() {
    if (destroyed || done() || paused) return;
    paused = true; pauseOverlay(); save(); sync();
  }
  function resume() {
    if (destroyed || !paused || hud.dialogOpen) return;
    paused = false; hud.hideOverlay(); audio.resume(); sync();
  }
  $('.ng-again').addEventListener('click', () => startRound(), { signal });
  board.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-cell]'); if (!cell || paused || hud.dialogOpen) return;
    const i = Number(cell.dataset.cell), r = Math.floor(i / 3), c = i % 3;
    const targets = { ArrowLeft: r * 3 + (c + 2) % 3, ArrowRight: r * 3 + (c + 1) % 3,
      ArrowUp: (r + 2) % 3 * 3 + c, ArrowDown: (r + 1) % 3 * 3 + c, Home: 0, End: 8 };
    if (Object.hasOwn(targets, event.key)) {
      event.preventDefault(); focused = targets[event.key];
      cells.forEach((b, n) => { b.tabIndex = n === focused ? 0 : -1; }); cells[focused].focus();
    }
  }, { signal });
  window.addEventListener('keydown', event => {
    if (hud.dialogOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); play(Number(event.key) - 1); }
    else if (event.key === 'Escape' || event.key.toLowerCase() === 'p') { event.preventDefault(); paused ? resume() : pause(); }
  }, { signal });

  function openSettings() {
    pause();
    const panel = el('div', 'ng-settings');
    function choices(title, name, options, selected, onChange) {
      const field = el('fieldset'); field.append(el('legend', '', title)); const group = el('div', 'choices');
      for (const [value, label] of options) {
        const wrap = el('label', 'choice'), radio = el('input'); radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = value === selected;
        radio.addEventListener('change', () => onChange(value), { signal }); wrap.append(radio, el('span', '', label)); group.append(wrap);
      }
      field.append(group); panel.append(field);
    }
    choices('Dificuldade · inicia uma nova rodada', 'ng-difficulty', Object.entries(LEVELS).map(([key, value]) => [key, value.label]), level, changeLevel);
    choices('Seu símbolo · X sempre começa', 'ng-symbol', [['X', 'X · Você começa'], ['O', 'O · IA começa']], human, value => {
      if (human !== value) { human = value; startRound(true); }
    });
    choices('Aparência', 'ng-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, value => theme.setMode(value));
    choices('Cor neon', 'ng-palette', PALETTE_OPTIONS.filter(o => o.value !== 'auto').map(o => [o.value, o.label]), theme.choice === 'auto' ? 'purple' : theme.choice, value => theme.setChoice(value));
    const effectsLabel = el('label', 'ng-effect-setting'); const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = effects;
    checkbox.addEventListener('change', () => { effects = checkbox.checked; clearEffects(); drawWinningLines(false); sync(); save(); }, { signal });
    effectsLabel.append(checkbox, el('span', '', 'Animações, partículas e brilho')); panel.append(effectsLabel);
    panel.append(el('p', '', 'A preferência de movimento reduzido do aparelho é sempre respeitada. Som e tema também podem ser alterados na barra superior.'));
    panel.append(el('h3', 'guide-title', 'Como jogar'));
    const how = el('ul');
    for (const text of ['Alinhe três símbolos na horizontal, vertical ou diagonal. Se a grade encher sem uma linha, dá velha.',
      'X sempre começa. Escolha O para deixar a IA fazer a primeira jogada.',
      'Toque, clique ou use as casas 1–9 (da esquerda para a direita, de cima para baixo). Setas navegam; Enter ou espaço confirmam.',
      'Fácil: jogadas aleatórias. Médio: busca vitórias e bloqueia ameaças. Difícil: joga sem erros; o melhor resultado contra ela é empatar.',
      'A rodada e o placar ficam salvos neste aparelho. Trocar a dificuldade ou o símbolo inicia uma nova rodada.']) how.append(el('li', '', text));
    panel.append(how);
    const record = records[level]; panel.append(el('p', '', `Melhor sequência no ${LEVELS[level].label.toLowerCase()}: ${record.best} vitória(s).`));
    if (!storageAvailable) panel.append(el('p', 'ng-storage-warning', 'Este navegador não está permitindo salvar. O jogo continua funcionando nesta página.'));
    hud.setDialogContent(panel, 'Neon Grid · ajustes & regras'); hud.openDialog();
  }
  function resize() {
    // O shell pode ter enfileirado a dica genérica depois de create().
    hud.flush();
    hud.setHint('Toque nas casas · <strong>3 em linha</strong>');
    hud.flush();
    const rect = zone.getBoundingClientRect();
    const size = Math.max(160, Math.min(380, rect.width - 4, rect.height - 4));
    board.style.setProperty('--board-size', size + 'px');
  }
  motion.addEventListener?.('change', () => { clearEffects(); drawWinningLines(false); sync(); }, { signal });
  hud.hideOverlay(); sync(); drawWinningLines(false); resize();
  return {
    meta,
    update(dt) {
      if (destroyed || paused || hud.dialogOpen) return;
      if (helpLeft > 0) { helpLeft -= dt; if (helpLeft <= 0) { helpText = ''; sync(); } }
      if (aiTurn()) {
        thinkLeft -= dt;
        if (thinkLeft <= 0) {
          const cell = chooseMove(round.board, other(human), level);
          if (cell !== null) commit(cell, other(human));
        }
      }
    },
    render(dt) { hud.tickToast(dt); hud.flush(); }, resize,
    primaryAction: () => paused ? resume() : done() ? startRound() : undefined,
    secondaryAction: () => { if (paused) startRound(); },
    pause, resume, pauseToggle: () => paused ? resume() : pause(), onHidden: pause, openSettings,
    onThemeChange: () => {},
    getState: () => ({ state: paused ? 'paused' : done() ? 'over' : aiTurn() ? 'thinking' : 'playing',
      difficulty: level, human, ai: other(human), turn: round.turn, board: [...round.board],
      winner: round.winner, draw: round.draw, round: roundNumber, moves: round.history.length, record: { ...records[level] } }),
    destroy() {
      destroyed = true; lifecycle.abort(); clearEffects(); view.remove(); input.destroy();
      app.classList.remove('ng-app'); document.body.classList.remove('ng-body');
      delete app.dataset.effects; delete app.dataset.paused;
    }
  };
}
