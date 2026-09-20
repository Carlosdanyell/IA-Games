import { LEVELS, LAST, dailyLevel } from './levels.js';
import { createSession, RULES, ruleOf, parMoves, timeLimit } from './model.js';
import { figure } from './figures.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';
import { hashSeed, todaySeedLabel } from '../../core/rng.js';

export const meta = {
  id: 'neon-memo', title: 'NEON<span>MEMO</span>', subtitle: 'FIGURAS DE VERDADE / 25 FASES',
  arenaLabel: 'Jogo da memória: vire as cartas e encontre as figuras que combinam.',
  logicalSize: aspect => ({ w: 400, h: Math.max(300, Math.round(400 / aspect)) }),
  stats: [{ id: 'level', label: 'Fase' }, { id: 'sets', label: 'Achados', accent: true }, { id: 'score', label: 'Pontos' }]
};

const MISS_DELAY = 0.85;   // tempo que o par errado fica à mostra
const HINT_DELAY = 1.6;    // tempo que a dica revela o conjunto
const pad = value => String(value).padStart(2, '0');
const clock = seconds => `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;
const stars = count => '★★★'.slice(0, count) + '☆☆☆'.slice(0, 3 - count);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function create({ hud, input, theme, audio, haptics, store }) {
  input.setEnabled(false);
  const lifecycle = new AbortController(), signal = lifecycle.signal;
  if (!document.getElementById('nm-style')) {
    const style = el('link'); style.id = 'nm-style'; style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    style.addEventListener('load', () => sizeBoard(), { signal });
    document.head.append(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('nm-app');
  hud.canvas.setAttribute('aria-hidden', 'true');
  hud.el.settings.innerHTML = 'Fases &amp; ajustes <span aria-hidden="true">↗</span>';

  // ------------------------------------------------------------- persistência
  const saved = store.get('campaign-v1', {});
  const campaign = {
    current: Number.isInteger(saved?.current) ? Math.max(0, Math.min(LAST, saved.current)) : 0,
    unlocked: Number.isInteger(saved?.unlocked) ? Math.max(0, Math.min(LAST, saved.unlocked)) : 0,
    results: saved?.results && typeof saved.results === 'object' && !Array.isArray(saved.results) ? saved.results : {},
    board: saved?.board && typeof saved.board === 'object' ? saved.board : null,
    daily: saved?.daily && typeof saved.daily === 'object' ? saved.daily : {}
  };
  campaign.current = Math.min(campaign.current, campaign.unlocked);
  let storageAvailable = true;
  let effects = store.get('effects', 'full') === 'low' ? 'low' : 'full';
  let names = ['sempre', 'achadas', 'nunca'].includes(store.get('names', 'achadas')) ? store.get('names', 'achadas') : 'achadas';
  app.dataset.effects = effects;
  app.dataset.names = names;

  // ------------------------------------------------------------------ estado
  let level = LEVELS[campaign.current], levelIndex = campaign.current, daily = false;
  let session = null, status = 'peek', seed = 1;
  let peekLeft = 0, missLeft = 0, hintLeft = 0, hintCards = [], messageLeft = 0;
  let nodes = [], focused = 0, destroyed = false;
  const sparks = [];

  // --------------------------------------------------------------------- DOM
  const view = el('div', 'nm-surface');
  view.innerHTML = `
    <div class="nm-topline"><span class="nm-stage"></span><span class="nm-rule"></span><span class="nm-timer"></span></div>
    <div class="nm-progress" aria-hidden="true"><i></i></div>
    <div class="nm-board-wrap">
      <div class="nm-board" role="grid" aria-label="Tabuleiro de cartas"></div>
      <div class="nm-sparks" aria-hidden="true"></div>
    </div>
    <p class="nm-message" role="status" aria-live="polite"></p>
    <div class="nm-actions">
      <button class="nm-hint" type="button"><b></b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4M8 14c-5-5-2-12 4-12s9 7 4 12c-1 1-1 2-1 2H9s0-1-1-2z"/></svg><span>Dica</span></button>
      <button class="nm-restart" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></svg><span>Recomeçar</span></button>
    </div>`;
  hud.arena.append(view);
  const $ = selector => view.querySelector(selector);
  const board = $('.nm-board'), boardWrap = $('.nm-board-wrap'), sparkLayer = $('.nm-sparks');
  const message = $('.nm-message'), hintButton = $('.nm-hint'), restartButton = $('.nm-restart');

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = () => effects === 'full' && !motion.matches;
  const playable = () => status === 'playing' && !hud.dialogOpen && !destroyed;

  function save() {
    campaign.board = session && status !== 'win' && !daily
      ? { level: levelIndex, seed, status, snapshot: session.snapshot() }
      : null;
    storageAvailable = store.set('campaign-v1', campaign);
  }
  function tell(text, tone = '', seconds = 3) {
    message.textContent = text;
    message.dataset.tone = tone;
    messageLeft = seconds;
  }
  function defaultMessage() {
    const rule = ruleOf(level);
    tell(status === 'peek' ? 'Memorize as figuras…' : rule.how, '', 0);
  }

  // ------------------------------------------------------------------ cartas
  function faceMarkup(card) {
    const item = figure(card.figure);
    return `<span class="nm-inner">
      <span class="nm-face nm-back"></span>
      <span class="nm-face nm-front">
        <svg class="nm-art" viewBox="0 0 64 64" aria-hidden="true">${item.art}</svg>
        <em class="nm-name">${item.name}</em>
      </span></span>`;
  }
  function renderBoard() {
    board.style.setProperty('--cols', level.cols);
    board.style.setProperty('--rows', level.rows);
    board.setAttribute('aria-rowcount', level.rows);
    board.setAttribute('aria-colcount', level.cols);
    board.replaceChildren();
    nodes = session.cards.map((card, index) => {
      const node = el('button', 'nm-card');
      node.type = 'button';
      node.dataset.index = index;
      node.style.setProperty('--i', index);
      node.setAttribute('role', 'gridcell');
      paint(node, card);
      node.addEventListener('click', () => flip(index), { signal });
      board.append(node);
      return node;
    });
    focused = 0;
    sizeBoard();
  }
  function paint(node, card) {
    node.dataset.family = card.family;
    node.dataset.wild = String(!!card.wild);
    node.dataset.figure = card.figure;
    node.innerHTML = faceMarkup(card);
  }
  function syncCards(fresh = []) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i], card = session.cards[i];
      if (node.dataset.figure !== card.figure) paint(node, card);
      const matched = session.isMatched(i);
      const state = matched ? 'matched'
        : hintCards.includes(i) ? 'hint'
        : session.pending.includes(i) ? 'miss'
        : session.isFaceUp(i) || status === 'peek' ? 'up' : 'down';
      if (node.dataset.state !== state) node.dataset.state = state;
      node.dataset.fresh = String(fresh.includes(i) && animated());
      // O shell apaga `button:disabled` (opacity .3) e a carta encontrada
      // precisa continuar legível: o bloqueio é por aria-disabled.
      node.setAttribute('aria-disabled', String(matched || !playable()));
      node.tabIndex = i === focused ? 0 : -1;
      const item = figure(card.figure);
      node.setAttribute('aria-label', state === 'down'
        ? `Carta ${i + 1}, virada para baixo`
        : `Carta ${i + 1}: ${item.name}${matched ? ', encontrada' : ''}`);
    }
  }
  function sizeBoard() {
    const box = boardWrap.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const gap = level.cols > 4 || level.rows > 5 ? 5 : 7;
    const size = Math.floor(Math.min(
      (box.width - gap * (level.cols - 1)) / level.cols,
      (box.height - gap * (level.rows - 1)) / level.rows));
    board.style.setProperty('--nm-gap', gap + 'px');
    board.style.setProperty('--nm-card', Math.max(28, Math.min(120, size)) + 'px');
  }
  function burst(index, count = 7) {
    if (!animated()) return;
    const node = nodes[index];
    if (!node) return;
    const area = boardWrap.getBoundingClientRect(), rect = node.getBoundingClientRect();
    const x = rect.left - area.left + rect.width / 2, y = rect.top - area.top + rect.height / 2;
    for (let i = 0; i < count && sparks.length < 60; i++) {
      const spark = el('i', 'nm-spark');
      const angle = Math.PI * 2 * i / count + Math.random() * .4;
      const distance = 18 + Math.random() * 30;
      spark.style.left = x + 'px'; spark.style.top = y + 'px';
      spark.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      spark.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      sparkLayer.append(spark);
      sparks.push({ node: spark, life: .75 });
    }
  }

  // ------------------------------------------------------------------- áudio
  function sound(kind) {
    audio.resume();
    if (kind === 'flip') audio.tone({ freq: 420, dur: .05, type: 'triangle', vol: .03, slide: 1.3 });
    else if (kind === 'match') audio.tone({ freq: 620, dur: .14, vol: .05, slide: 1.5 });
    else if (kind === 'wild') audio.tone({ freq: 700, dur: .2, type: 'triangle', vol: .05, slide: 1.6 });
    else if (kind === 'miss') audio.tone({ freq: 240, dur: .12, type: 'sawtooth', vol: .025, slide: .7 });
    else if (kind === 'level') audio.tone({ freq: 880, dur: .24, vol: .05, slide: 1.4 });
    else if (kind === 'over') audio.tone({ freq: 300, dur: .3, type: 'triangle', vol: .04, slide: .5 });
  }

  // ----------------------------------------------------------------- jogadas
  function flip(index) {
    if (status === 'peek') { endPeek(); return; }
    if (!playable()) return;
    const before = session.pending;
    const result = session.flip(index);
    if (result.status === 'blocked') return;
    focused = index;
    if (before.length) missLeft = 0;
    if (result.status === 'up') {
      sound('flip'); haptics.buzz(5); syncCards();
      return;
    }
    if (result.status === 'miss') {
      missLeft = MISS_DELAY;
      sound('miss'); haptics.buzz(12);
      if (result.swaps.length) tell('Duas cartas trocaram de lugar.', 'warn', 2.4);
      else tell('Não combinam. Guarde onde elas estão.', '', 1.8);
      syncCards();
      save();
      return;
    }
    sound(result.wild ? 'wild' : 'match');
    haptics.buzz(result.wild ? [10, 30, 14] : 14);
    for (const index of result.cards) burst(index, result.wild ? 10 : 7);
    tell(result.wild ? 'O camaleão imitou a figura e levou o par!'
      : result.combo > 1 ? `Boa! ${result.combo} seguidos · +${result.points}`
      : `Certo! +${result.points}`, 'ok', 2);
    syncCards(result.cards);
    syncHud();
    save();
    if (result.complete) finish();
  }
  function endPeek() {
    if (status !== 'peek') return;
    peekLeft = 0;
    status = 'playing';
    defaultMessage();
    syncCards();
    syncHud();
  }
  function finish() {
    status = levelIndex >= LAST && !daily ? 'win' : 'between';
    const earned = session.stars();
    if (daily) {
      campaign.daily = { date: todaySeedLabel(), stars: earned, score: session.score, moves: session.moves };
    } else {
      const previous = campaign.results[levelIndex] || { stars: 0, score: 0, moves: Infinity };
      campaign.results[levelIndex] = {
        stars: Math.max(previous.stars || 0, earned),
        score: Math.max(previous.score || 0, session.score),
        moves: Math.min(previous.moves ?? Infinity, session.moves),
        time: Math.round(session.elapsed)
      };
      campaign.unlocked = Math.max(campaign.unlocked, Math.min(LAST, levelIndex + 1));
    }
    save();
    sound('level'); haptics.buzz([14, 40, 20]);
    const last = status === 'win';
    hud.showOverlay({
      tag: daily ? 'Desafio do dia' : last ? '25 fases completas' : `Fase ${pad(levelIndex + 1)} completa`,
      title: last ? 'Você fechou o álbum inteiro.' : daily ? 'Desafio do dia concluído!' : `${stars(earned)}`,
      text: last ? 'As 25 fases estão resolvidas. Volte quando quiser para melhorar as estrelas.'
        : `${session.moves} jogadas · ${session.score} pontos · melhor sequência ${session.bestCombo}.`,
      action: last ? 'Escolher uma fase' : daily ? 'Voltar às fases' : 'Próxima fase',
      secondary: 'Repetir esta fase',
      note: daily ? 'O tabuleiro do dia é o mesmo para todo mundo.'
        : `Três estrelas até ${parMoves(level)} jogadas.`
    });
    syncCards(); syncHud();
  }
  function failTime() {
    status = 'timeout';
    sound('over'); haptics.buzz([20, 60]);
    save();
    hud.showOverlay({
      tag: 'Relâmpago', title: 'O tempo acabou.',
      text: `Faltaram ${session.total - session.found} conjuntos. O tabuleiro volta embaralhado.`,
      action: 'Tentar de novo', secondary: 'Voltar para a fase anterior',
      note: `${session.moves} jogadas · ${session.found} de ${session.total} encontrados`
    });
    syncCards(); syncHud();
  }
  function useHint() {
    if (!playable()) return;
    const hint = session.hint();
    if (!hint) { tell(session.hintsLeft ? 'Nada para revelar agora.' : 'As dicas desta fase acabaram.', 'warn', 2); syncHud(); return; }
    hintCards = hint.cards;
    hintLeft = HINT_DELAY;
    tell('Guarde bem: essas cartas combinam.', 'ok', HINT_DELAY);
    sound('flip');
    syncCards(); syncHud(); save();
  }

  // ------------------------------------------------------------------- fases
  function loadLevel(index, { fresh = true, asDaily = false, restore = null } = {}) {
    hintCards = []; hintLeft = 0; missLeft = 0;
    daily = asDaily;
    if (asDaily) {
      const label = todaySeedLabel();
      seed = hashSeed('neon-memo:' + label);
      level = dailyLevel(seed, label.split('-').reverse().slice(0, 2).join('/'));
      levelIndex = 0;
    } else {
      levelIndex = Math.max(0, Math.min(LAST, index));
      level = LEVELS[levelIndex];
      campaign.current = levelIndex;
      seed = restore?.seed ?? (fresh ? Math.floor(Math.random() * 1e9) : seed);
    }
    session = createSession(level, { seed, saved: restore?.snapshot || null });
    theme.setAuto(level.palette);
    status = session.complete ? 'between' : 'peek';
    peekLeft = session.complete ? 0 : (level.peek || 2);
    if (session.moves > 0 && !session.complete) peekLeft = Math.min(peekLeft, 1.2);
    hud.hideOverlay();
    renderBoard(); syncCards(); defaultMessage(); syncHud(); save();
    if (session.complete) finish();
    hud.announce(`Fase ${pad(levelIndex + 1)}: ${level.name}. ${ruleOf(level).how}`);
  }

  function syncHud() {
    const rule = ruleOf(level);
    const limit = timeLimit(level);
    hud.setStat('level', daily ? 'DIA' : `${pad(levelIndex + 1)}<small> / ${LEVELS.length}</small>`);
    hud.setStat('sets', `${session.found}<small> / ${session.total}</small>`, `${session.found} de ${session.total} conjuntos`);
    hud.setStat('score', String(session.score).padStart(3, '0'));
    hud.setChips([
      { text: rule.label, tone: 'accent' },
      { text: `${session.moves} jogada${session.moves === 1 ? '' : 's'}` },
      { text: session.combo > 1 ? `${session.combo}x seguidos` : `${session.mistakes} erro${session.mistakes === 1 ? '' : 's'}`, tone: 'flow' }
    ]);
    hud.setPause(status === 'paused', status === 'playing' || status === 'paused' || status === 'peek');
    hud.setHint(status === 'peek' ? 'Espiada inicial · <strong>memorize</strong>' : 'Toque nas cartas · <strong>ache os conjuntos</strong>');
    hud.setSubtitle(daily ? 'DESAFIO DO DIA' : `${LEVELS.length} FASES / FIGURAS DE VERDADE`);
    $('.nm-stage').textContent = daily ? level.name : `${pad(levelIndex + 1)} / ${level.name}`;
    $('.nm-rule').textContent = rule.label;
    const timer = $('.nm-timer');
    timer.textContent = status === 'peek' ? `espiada ${Math.ceil(peekLeft)}s`
      : limit ? clock(session.timeLeft) : clock(session.elapsed);
    timer.dataset.low = String(!!limit && session.timeLeft <= 15);
    $('.nm-progress i').style.width = (session.found / session.total * 100) + '%';
    hintButton.querySelector('b').textContent = session.hintsLeft;
    hintButton.disabled = !playable() || session.hintsLeft <= 0;
    hintButton.setAttribute('aria-label', `Dica: ${session.hintsLeft} restantes`);
    restartButton.disabled = destroyed;
    app.dataset.paused = String(status === 'paused');
    hud.flush();
  }

  // ----------------------------------------------------------------- controle
  function pause() {
    if (!['playing', 'peek'].includes(status)) return;
    status = 'paused';
    save();
    hud.showOverlay({
      tag: 'No seu tempo', title: 'Cartas em pausa.',
      text: 'O tabuleiro fica guardado neste aparelho. Continue quando quiser.',
      action: 'Continuar', secondary: 'Recomeçar esta fase',
      note: `${daily ? level.name : 'Fase ' + pad(levelIndex + 1) + ' · ' + level.name} · ${ruleOf(level).label}`
    });
    syncCards(); syncHud();
  }
  function resume() {
    if (status !== 'paused' || hud.dialogOpen) return;
    status = peekLeft > 0 ? 'peek' : 'playing';
    hud.hideOverlay(); audio.resume();
    syncCards(); syncHud();
  }
  function primaryAction() {
    if (hud.dialogOpen) return;
    if (status === 'paused') resume();
    else if (status === 'timeout') loadLevel(levelIndex, { asDaily: daily });
    else if (status === 'between') daily ? loadLevel(campaign.current, {}) : loadLevel(levelIndex + 1, {});
    else if (status === 'win') openSettings();
  }
  function secondaryAction() {
    if (hud.dialogOpen) return;
    if (status === 'timeout' && !daily) loadLevel(Math.max(0, levelIndex - 1), {});
    else loadLevel(levelIndex, { asDaily: daily });
  }

  restartButton.addEventListener('click', () => { if (!hud.dialogOpen) loadLevel(levelIndex, { asDaily: daily }); }, { signal });
  hintButton.addEventListener('click', useHint, { signal });
  board.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-index]');
    if (!cell) return;
    const index = Number(cell.dataset.index), row = Math.floor(index / level.cols), col = index % level.cols;
    const last = nodes.length - 1;
    const targets = {
      ArrowLeft: row * level.cols + (col + level.cols - 1) % level.cols,
      ArrowRight: row * level.cols + (col + 1) % level.cols,
      ArrowUp: Math.max(0, index - level.cols),
      ArrowDown: Math.min(last, index + level.cols),
      Home: 0, End: last
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    focused = Math.min(last, targets[event.key]);
    nodes.forEach((node, i) => { node.tabIndex = i === focused ? 0 : -1; });
    nodes[focused].focus();
  }, { signal });
  window.addEventListener('keydown', event => {
    if (hud.dialogOpen || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape' || key === 'p') { event.preventDefault(); status === 'paused' ? resume() : pause(); }
    else if (key === 'h') { event.preventDefault(); useHint(); }
    else if (key === 'r') { event.preventDefault(); loadLevel(levelIndex, { asDaily: daily }); }
  }, { signal });
  motion.addEventListener?.('change', () => syncCards(), { signal });

  // ------------------------------------------------------------------ ajustes
  function radioGroup(label, name, options, current, onChange) {
    const field = el('fieldset'), group = el('div', 'choices');
    field.append(el('legend', '', label), group);
    for (const [value, text] of options) {
      const wrap = el('label', 'choice'), radio = el('input');
      radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = current === value;
      radio.addEventListener('change', () => onChange(value), { signal });
      wrap.append(radio, el('span', '', text));
      group.append(wrap);
    }
    return field;
  }
  function openSettings() {
    pause();
    const panel = el('div', 'nm-settings');
    const dailyDone = campaign.daily?.date === todaySeedLabel();
    const dailyButton = el('button', 'nm-daily');
    dailyButton.type = 'button';
    dailyButton.innerHTML = `<span><b>Desafio do dia</b><small>${dailyDone
      ? `Hoje você fez ${campaign.daily.score} pontos ${stars(campaign.daily.stars)}`
      : 'Um tabuleiro novo por dia, igual para todo mundo.'}</small></span><span aria-hidden="true">▶</span>`;
    dailyButton.addEventListener('click', () => { hud.closeDialog(); loadLevel(0, { asDaily: true }); }, { signal });
    panel.append(el('h3', 'guide-title', 'Suas fases'), dailyButton);

    const grid = el('div', 'nm-levels');
    LEVELS.forEach((item, index) => {
      const result = campaign.results[index];
      const button = el('button', 'nm-level');
      button.type = 'button';
      button.append(el('span', '', pad(index + 1)), el('i', '', result ? stars(result.stars) : ''));
      button.disabled = index > campaign.unlocked;
      button.setAttribute('aria-label', `Fase ${index + 1}: ${item.name}${result ? `, ${result.stars} estrelas` : index > campaign.unlocked ? ', bloqueada' : ''}`);
      if (index === levelIndex && !daily) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => { hud.closeDialog(); loadLevel(index, {}); }, { signal });
      grid.append(button);
    });
    panel.append(grid);

    panel.append(radioGroup('Nomes das figuras', 'nm-names',
      [['achadas', 'Ao encontrar'], ['sempre', 'Sempre'], ['nunca', 'Nunca']], names, value => {
        names = value; app.dataset.names = value; store.set('names', value);
      }));
    panel.append(radioGroup('Aparência', 'nm-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, value => theme.setMode(value)));
    panel.append(radioGroup('Cor neon', 'nm-palette', PALETTE_OPTIONS.map(option => [option.value, option.label]), theme.choice, value => theme.setChoice(value)));
    panel.append(radioGroup('Efeitos visuais', 'nm-effects', [['full', 'Completos'], ['low', 'Mínimos']], effects, value => {
      effects = value; app.dataset.effects = value; store.set('effects', value);
    }));
    panel.append(radioGroup('Som', 'nm-sound', [['off', 'Desligado'], ['on', 'Ligado']], audio.enabled ? 'on' : 'off', value => {
      audio.setEnabled(value === 'on'); hud.setSound(audio.enabled); audio.resume(); hud.flush();
    }));
    if (haptics.supported) {
      panel.append(radioGroup('Vibração', 'nm-haptics', [['off', 'Desligada'], ['on', 'Ligada']], haptics.enabled ? 'on' : 'off',
        value => haptics.setEnabled(value === 'on')));
    }

    panel.append(el('h3', 'guide-title', 'As regras que aparecem'));
    const rules = el('ul', 'nm-rules-list');
    for (const [id, rule] of Object.entries(RULES)) {
      const item = el('li');
      item.append(el('b', '', rule.label.toUpperCase()), el('span', '', rule.how));
      rules.append(item);
    }
    panel.append(rules);

    panel.append(el('h3', 'guide-title', 'Como jogar'));
    const how = el('ul');
    for (const text of [
      'Toda fase começa com uma espiada: as cartas aparecem por alguns segundos antes de virarem. Toque na tela para cortar a espiada.',
      'Vire as cartas e encontre os conjuntos. Acertos seguidos valem mais pontos; errar zera a sequência.',
      'As figuras são coisas de verdade — gato, banana, bicicleta — e cada tema tem sua cor.',
      'Cada fase dá três estrelas se você fechar o tabuleiro dentro do número de jogadas indicado.',
      'A dica revela um conjunto por alguns instantes e custa 30 pontos. Atalhos: H dica, R recomeça, P ou Esc pausa.',
      'O progresso fica salvo neste aparelho. Dá para reabrir uma fase antiga para melhorar as estrelas.'
    ]) how.append(el('li', '', text));
    panel.append(how);

    const totalStars = Object.values(campaign.results).reduce((sum, result) => sum + (result.stars || 0), 0);
    panel.append(el('p', '', `Estrelas: ${totalStars} de ${LEVELS.length * 3}.`));
    if (!storageAvailable) panel.append(el('p', 'nm-storage-note', 'Este navegador bloqueou o salvamento. A partida funciona, mas o progresso pode se perder ao fechar.'));
    hud.setDialogContent(panel, 'Neon Memo · fases & ajustes');
    hud.openDialog();
  }

  // -------------------------------------------------------------------- ciclo
  const restore = campaign.board && Number.isInteger(campaign.board.level) ? campaign.board : null;
  loadLevel(restore ? restore.level : campaign.current, { fresh: !restore, restore });

  return {
    meta,
    update(dt) {
      if (destroyed || hud.dialogOpen || ['paused', 'between', 'win', 'timeout'].includes(status)) return;
      for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].life -= dt;
        if (sparks[i].life <= 0) { sparks[i].node.remove(); sparks.splice(i, 1); }
      }
      if (messageLeft > 0) {
        messageLeft -= dt;
        if (messageLeft <= 0) defaultMessage();
      }
      if (status === 'peek') {
        peekLeft -= dt;
        if (peekLeft <= 0) endPeek(); else syncHud();
        return;
      }
      if (hintLeft > 0) {
        hintLeft -= dt;
        if (hintLeft <= 0) { hintCards = []; syncCards(); }
      }
      if (missLeft > 0) {
        missLeft -= dt;
        if (missLeft <= 0) { session.settle(); syncCards(); }
      }
      if (session.tick(dt) === 'timeout') { failTime(); return; }
      syncHud();
    },
    render(dt) { hud.tickToast(dt); hud.flush(); },
    resize() { sizeBoard(); },
    primaryAction, secondaryAction, pause, resume,
    pauseToggle() { status === 'paused' ? resume() : pause(); },
    openSettings, onHidden: pause,
    onThemeChange() {},
    getState: () => ({
      state: status, game: meta.id, level: daily ? 'diario' : levelIndex + 1, title: level.name,
      rule: level.rule, sets: session.found, total: session.total, moves: session.moves,
      mistakes: session.mistakes, score: session.score, combo: session.combo,
      hintsLeft: session.hintsLeft, timeLeft: session.timeLeft, unlockedLevels: campaign.unlocked + 1
    }),
    destroy() {
      destroyed = true;
      lifecycle.abort();
      sparks.splice(0).forEach(spark => spark.node.remove());
      view.remove();
      input.destroy();
      app.classList.remove('nm-app');
      delete app.dataset.effects; delete app.dataset.names; delete app.dataset.paused;
    }
  };
}
