import {LEVELS} from './levels.js';
import {createSession, canSpell, normalizeWord} from './model.js';

const LAST = LEVELS.length - 1;

const meta = {
  id: 'neon-words', title: 'NEON<span>WORDS</span>', subtitle: 'CONECTE / DESCUBRA / COMPLETE',
  arenaLabel: 'Cruzadinha de palavras e roda de letras',
  logicalSize: aspect => ({ w: 400, h: Math.max(300, Math.round(400 / aspect)) }),
  stats: [{ id: 'level', label: 'Fase' }, { id: 'words', label: 'Palavras', accent: true }, { id: 'score', label: 'Pontos' }]
};

function create({ hud, input, theme, audio, haptics, store }) {
  // A interface é atualizada somente quando muda o jogo ou a seleção.
  // O canvas e o loop do shell continuam disponíveis, sem redesenho contínuo.
  input.setEnabled(false);
  const lifecycle = new AbortController(), signal = lifecycle.signal;
  let style = document.getElementById('nw-style');
  if (!style) {
    style = document.createElement('link'); style.id = 'nw-style'; style.rel = 'stylesheet';
    // Resolve contra o próprio módulo, não contra a página: o shell fica na
    // raiz do site e o CSS do jogo mora em games/neon-words/.
    style.href = new URL('./style.css', import.meta.url).href; document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app'); app.classList.add('nw-app');
  hud.canvas.setAttribute('aria-hidden', 'true');
  hud.el.settings.innerHTML = 'Fases &amp; ajustes <span aria-hidden="true">↗</span>';
  const saved = store.get('campaign-v1', {});
  const campaign = {
    // Limites derivados do catálogo: acrescentar fases não exige mexer aqui.
    current: Number.isInteger(saved?.current) ? Math.max(0, Math.min(LAST, saved.current)) : 0,
    unlocked: Number.isInteger(saved?.unlocked) ? Math.max(0, Math.min(LAST, saved.unlocked)) : 0,
    levels: saved?.levels && typeof saved.levels === 'object' && !Array.isArray(saved.levels) ? saved.levels : {}
  };
  campaign.current = Math.min(campaign.current, campaign.unlocked);
  let session, state = 'playing', selection = [], order = [], pointer = null, messageTime = 0, messageReset = false;
  let storageAvailable = true, effects = store.get('effects', 'full') === 'low' ? 'low' : 'full';
  app.dataset.effects = effects;
  const view = document.createElement('div'); view.className = 'nw-surface';
  view.innerHTML = `
    <section class="nw-board-area" aria-label="Cruzadinha">
      <div class="nw-stage"><span class="nw-stage-name"></span><span class="nw-progress" aria-hidden="true"><i></i></span></div>
      <div class="nw-grid-wrap"><div class="nw-grid" role="grid" aria-label="Grade da cruzadinha"></div></div>
    </section>
    <p class="nw-message" role="status" aria-live="polite"></p>
    <div class="nw-composer">
      <button class="nw-clear" aria-label="Apagar última letra" title="Apagar última letra"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5-7 7 7 7h12V5zM12 9l5 6m0-6-5 6"/></svg></button>
      <output class="nw-candidate empty" aria-label="Palavra selecionada">Sua palavra</output>
      <button class="nw-submit" disabled>Formar</button>
    </div>
    <section class="nw-controls" aria-label="Conecte as letras">
      <button class="nw-side nw-shuffle" aria-label="Embaralhar letras"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/></svg><span>Misturar</span></button>
      <div class="nw-wheel" role="group" aria-label="Letras disponíveis">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="nw-orbit" cx="100" cy="100" r="96"/><circle class="nw-inner-orbit" cx="100" cy="100" r="52"/><path class="nw-path"/></svg>
      </div>
      <button class="nw-side nw-hint" aria-label="Revelar uma letra: 3 dicas restantes"><b>3</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6m-5 3h4M8 14c-5-5-2-12 4-12s9 7 4 12c-1 1-1 2-1 2H9s0-1-1-2z"/></svg><span>Dica</span></button>
    </section>`;
  hud.arena.appendChild(view);
  const $ = selector => view.querySelector(selector);
  const grid = $('.nw-grid'), gridWrap = $('.nw-grid-wrap'), wheel = $('.nw-wheel'), path = $('.nw-path');
  const candidate = $('.nw-candidate'), submitButton = $('.nw-submit'), clearButton = $('.nw-clear');
  const hintButton = $('.nw-hint'), shuffleButton = $('.nw-shuffle'), message = $('.nw-message');
  let positions = new Map();

  function save() {
    campaign.levels[campaign.current] = session.snapshot();
    storageAvailable = store.set('campaign-v1', campaign);
  }
  function tell(text, tone = '', seconds = 3) {
    message.textContent = text; message.dataset.tone = tone; messageTime = seconds; messageReset = false;
  }
  function defaultMessage() { tell('Arraste pelas letras ou toque e confirme.', '', 0); }
  function syncHud() {
    const found = session.found.size, total = session.level.words.length, next = session.nextUnlock;
    hud.setStat('level', `${String(campaign.current + 1).padStart(2, '0')}<small> / ${LEVELS.length}</small>`);
    hud.setStat('words', `${found}<small> / ${total}</small>`, `${found} de ${total} palavras`);
    hud.setStat('score', String(session.score).padStart(3, '0'));
    hud.setChips([
      { text: `${session.availableLetters().length} letras` },
      { text: next ? `+ ${next.letters.length} letra${next.letters.length > 1 ? 's' : ''} após ${next.after - found} palavra${next.after - found > 1 ? 's' : ''}` : 'Todas as letras liberadas', tone: 'flow' }
    ], next ? `Nova letra ao encontrar mais ${next.after - found} palavras.` : 'Todas as letras estão disponíveis.');
    hud.setSubtitle(`${LEVELS.length} CONSTELAÇÕES / PALAVRAS EM PORTUGUÊS`);
    hud.setPause(state === 'paused', state === 'playing' || state === 'paused');
    hud.setHint('Sem pressa. <strong>Conecte as letras.</strong>');
    $('.nw-stage-name').textContent = String(campaign.current + 1).padStart(2, '0') + ' / ' + session.level.name;
    $('.nw-progress i').style.width = (found / total * 100) + '%';
    hintButton.querySelector('b').textContent = session.hintsLeft;
    hintButton.disabled = session.hintsLeft === 0 || state !== 'playing';
    hintButton.setAttribute('aria-label', `Revelar uma letra: ${session.hintsLeft} dicas restantes`);
    shuffleButton.disabled = state !== 'playing';
  }
  function sizeBoard() {
    const box = gridWrap.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const gap = window.innerHeight <= 740 ? 2 : 3;
    const tile = Math.max(15, Math.min(40, Math.floor(Math.min((box.width - 4 - gap * (session.level.cols - 1)) / session.level.cols, (box.height - 4 - gap * (session.level.rows - 1)) / session.level.rows))));
    grid.style.setProperty('--tile', tile + 'px');
  }
  function renderBoard(fresh = new Set()) {
    const visible = session.visibleCells();
    const activeWords = session.level.words.map(word => canSpell(word.text, session.availableLetters()));
    const starts = [...new Set(session.level.words.map(word => `${word.row},${word.col}`))].sort((a, b) => {
      const [ar, ac] = a.split(',').map(Number), [br, bc] = b.split(',').map(Number); return ar - br || ac - bc;
    });
    grid.style.setProperty('--rows', session.level.rows); grid.style.setProperty('--cols', session.level.cols);
    grid.setAttribute('aria-rowcount', session.level.rows); grid.setAttribute('aria-colcount', session.level.cols);
    grid.replaceChildren();
    for (const cell of session.board.values()) {
      const tile = document.createElement('div'); const shown = visible.has(cell.key), locked = !cell.words.some(index => activeWords[index]);
      tile.className = 'nw-cell' + (shown ? ' filled' : locked ? ' locked' : '') + (fresh.has(cell.key) ? ' fresh' : '');
      tile.style.gridRow = cell.row + 1; tile.style.gridColumn = cell.col + 1;
      tile.dataset.cell = cell.key; tile.setAttribute('role', 'gridcell'); tile.setAttribute('aria-rowindex', cell.row + 1); tile.setAttribute('aria-colindex', cell.col + 1);
      tile.setAttribute('aria-label', shown ? cell.letter : locked ? 'Letra bloqueada' : 'Letra a descobrir');
      const text = document.createElement('span'); text.textContent = shown ? cell.letter : ''; tile.appendChild(text);
      const number = starts.indexOf(cell.key);
      if (number >= 0) { const badge = document.createElement('small'); badge.className = 'nw-cell-number'; badge.textContent = number + 1; badge.setAttribute('aria-hidden', 'true'); tile.appendChild(badge); }
      grid.appendChild(tile);
    }
    sizeBoard();
  }
  function shuffled(list) {
    const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function renderWheel(newFrom = Infinity) {
    const letters = session.availableLetters();
    order = order.filter(id => id < letters.length);
    for (let id = 0; id < letters.length; id++) if (!order.includes(id)) order.push(id);
    wheel.querySelectorAll('.nw-letter').forEach(button => button.remove()); positions = new Map();
    order.forEach((id, index) => {
      const angle = index * Math.PI * 2 / order.length - Math.PI / 2, x = 100 + Math.cos(angle) * 70, y = 100 + Math.sin(angle) * 70;
      positions.set(id, { x, y }); const button = document.createElement('button'); button.type = 'button';
      button.className = 'nw-letter' + (id >= newFrom ? ' new' : ''); button.dataset.letterId = id; button.textContent = letters[id];
      button.style.left = x / 2 + '%'; button.style.top = y / 2 + '%'; button.setAttribute('aria-pressed', 'false');
      const occurrence = [...letters.slice(0, id + 1)].filter(char => char === letters[id]).length;
      button.setAttribute('aria-label', `Letra ${letters[id]}${letters.split(letters[id]).length > 2 ? ', opção ' + occurrence : ''}`);
      button.addEventListener('click', event => { if (event.detail === 0 && canInteract()) choose(id); }, { signal });
      wheel.appendChild(button);
    });
    showSelection();
  }
  const selectedWord = () => selection.map(id => session.availableLetters()[id]).join('');
  const canInteract = () => state === 'playing' && !hud.dialogOpen;
  function showSelection(cursor) {
    const text = selectedWord(); candidate.textContent = text || 'Sua palavra'; candidate.classList.toggle('empty', !text);
    submitButton.disabled = selection.length < 3 || !canInteract(); clearButton.disabled = !selection.length || !canInteract();
    wheel.querySelectorAll('.nw-letter').forEach(button => { button.setAttribute('aria-pressed', String(selection.includes(Number(button.dataset.letterId)))); button.disabled = !canInteract(); });
    const points = selection.map(id => positions.get(id)); if (cursor && points.length) points.push(cursor);
    path.setAttribute('d', points.map((point, i) => (i ? 'L' : 'M') + point.x + ' ' + point.y).join(' '));
  }
  function clearSelection() { selection = []; showSelection(); }
  function choose(id) {
    if (!canInteract() || !positions.has(id)) return;
    const at = selection.indexOf(id);
    if (at === selection.length - 1 && at >= 0) return;
    if (at >= 0) selection = selection.slice(0, at + 1); else selection.push(id);
    audio.resume(); audio.tone({ freq: 300 + selection.length * 70, dur: .035, vol: .025 }); haptics.buzz(5); showSelection();
  }
  function stopPointer(cancel = false) {
    if (!pointer) return;
    const id = pointer.id; pointer = null;
    if (wheel.hasPointerCapture(id)) wheel.releasePointerCapture(id);
    if (cancel) clearSelection();
  }
  function finishPhase(sound = true) {
    state = campaign.current === LEVELS.length - 1 ? 'win' : 'between';
    campaign.unlocked = Math.max(campaign.unlocked, Math.min(LAST, campaign.current + 1)); save(); stopPointer();
    if (sound) { audio.tone({ freq: 880, dur: .22, vol: .05 }); haptics.buzz([12, 40, 18]); }
    const last = state === 'win';
    hud.showOverlay({ tag: last ? '10 constelações completas' : 'Cruzadinha completa', title: last ? 'Você ligou todas as estrelas.' : 'Mais uma constelação!',
      text: last ? `Todas as ${LEVELS.length} fases foram resolvidas. Você pode voltar às suas favoritas.` : `Você encontrou as ${session.level.words.length} palavras de ${session.level.name}.`,
      action: last ? 'Escolher uma fase' : 'Próxima fase', note: `${session.score} pontos nesta fase · ${session.hintsLeft} dicas restantes` });
    syncHud(); showSelection();
  }
  function applyResult(result, before) {
    if (!['correct', 'hint'].includes(result.status)) {
      const messages = { short: 'Forme uma palavra com pelo menos 3 letras.', unavailable: 'Use somente as letras disponíveis.', duplicate: 'Você já encontrou essa palavra.', 'not-in-board': 'Essa palavra não faz parte desta cruzadinha.', 'no-hints': 'As três dicas desta fase já foram usadas.', 'no-hint-target': 'Encontre mais uma palavra para liberar letras.' };
      tell(messages[result.status] || 'Essa fase já está completa.', result.status === 'duplicate' ? '' : 'warn');
      return;
    }
    const fresh = new Set([...session.visibleCells()].filter(key => !before.has(key)));
    const oldCount = session.availableLetters().length - result.unlocked.length;
    renderBoard(fresh); if (result.unlocked) renderWheel(oldCount); save(); syncHud();
    if (result.complete) { finishPhase(); return; }
    if (result.unlocked) tell(`Letra${result.unlocked.length > 1 ? 's' : ''} ${[...result.unlocked].join(' e ')} liberada${result.unlocked.length > 1 ? 's' : ''}! Novas palavras disponíveis.`, 'success', 4);
    else if (result.status === 'hint') tell('Dica: a letra ' + result.letter + ' apareceu na grade.', 'success');
    else tell(result.added.join(' + ') + ' · muito bem!', 'success');
    audio.tone({ freq: result.unlocked ? 790 : 650, dur: .12, vol: .045 }); haptics.buzz(12);
  }
  function submit() {
    if (!canInteract()) return;
    const before = session.visibleCells(), result = session.submit(selectedWord()); clearSelection(); applyResult(result, before);
  }
  function useHint() {
    if (!canInteract()) return; stopPointer(true); clearSelection();
    const before = session.visibleCells(); applyResult(session.hint(), before);
  }
  submitButton.addEventListener('click', submit, { signal });
  clearButton.addEventListener('click', () => { if (canInteract()) { selection.pop(); showSelection(); } }, { signal });
  hintButton.addEventListener('click', useHint, { signal });
  shuffleButton.addEventListener('click', () => { if (!canInteract()) return; stopPointer(true); clearSelection(); order = shuffled(order); renderWheel(); tell('Um novo olhar para as mesmas letras.'); }, { signal });

  wheel.addEventListener('pointerdown', event => {
    if (!canInteract() || pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const button = event.target.closest('[data-letter-id]'); if (!button) return;
    event.preventDefault(); const box = wheel.getBoundingClientRect();
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, dragged: false, box,
      nodes: [...wheel.querySelectorAll('.nw-letter')].map(node => { const rect = node.getBoundingClientRect(); return { id: Number(node.dataset.letterId), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width / 2 }; }) };
    choose(Number(button.dataset.letterId)); wheel.setPointerCapture(event.pointerId);
  }, { signal });
  wheel.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id || !canInteract()) return;
    event.preventDefault(); const dx = event.clientX - pointer.lastX, dy = event.clientY - pointer.lastY;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8) pointer.dragged = true;
    if (pointer.dragged) {
      const length2 = dx * dx + dy * dy;
      const hits = pointer.nodes.map(node => { const t = length2 ? Math.max(0, Math.min(1, ((node.x - pointer.lastX) * dx + (node.y - pointer.lastY) * dy) / length2)) : 1;
        return { ...node, t, hit: Math.hypot(node.x - pointer.lastX - t * dx, node.y - pointer.lastY - t * dy) <= node.radius }; }).filter(node => node.hit).sort((a, b) => a.t - b.t);
      for (const hit of hits) choose(hit.id);
      showSelection({ x: (event.clientX - pointer.box.left) / pointer.box.width * 200, y: (event.clientY - pointer.box.top) / pointer.box.height * 200 });
    }
    pointer.lastX = event.clientX; pointer.lastY = event.clientY;
  }, { signal });
  wheel.addEventListener('pointerup', event => { if (!pointer || event.pointerId !== pointer.id) return; const dragged = pointer.dragged; stopPointer(); if (dragged) submit(); else showSelection(); }, { signal });
  wheel.addEventListener('pointercancel', event => { if (pointer?.id === event.pointerId) stopPointer(true); }, { signal });
  wheel.addEventListener('lostpointercapture', event => { if (pointer?.id === event.pointerId) stopPointer(true); }, { signal });

  function loadLevel(index, fresh = false) {
    stopPointer(); campaign.current = index; session = createSession(LEVELS[index], fresh ? {} : campaign.levels[index]);
    state = 'playing'; selection = []; order = shuffled([...session.availableLetters()].map((_, i) => i));
    app.dataset.scene = ['grid', 'orbit', 'rays'][index % 3]; theme.setAuto(session.level.palette);
    hud.hideOverlay(); renderBoard(); renderWheel(); defaultMessage(); syncHud(); save();
    if (session.complete) finishPhase(false);
  }
  function pause() {
    if (state !== 'playing') return; state = 'paused'; stopPointer(true); clearSelection(); save();
    hud.showOverlay({ tag: 'No seu tempo', title: 'Palavras em pausa.', text: 'Sua cruzadinha está guardada. Continue quando quiser.', action: 'Continuar', note: 'Fase ' + (campaign.current + 1) + ' / ' + session.level.name, secondary: 'Recomeçar esta fase' });
    syncHud();
  }
  function resume() { if (state !== 'paused' || hud.dialogOpen) return; state = 'playing'; hud.hideOverlay(); syncHud(); showSelection(); }
  function primaryAction() {
    if (hud.dialogOpen) return;
    if (state === 'paused') resume(); else if (state === 'between') loadLevel(campaign.current + 1); else if (state === 'win') openSettings();
  }
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text != null) item.textContent = text; return item; };
  function radioGroup(label, name, options, current, onChange) {
    const field = node('fieldset'), legend = node('legend', '', label), group = node('div', 'choices'); field.append(legend, group);
    options.forEach(([value, text]) => { const wrap = node('label', 'choice'), radio = document.createElement('input'); radio.type = 'radio'; radio.name = name; radio.value = value; radio.checked = current === value; radio.addEventListener('change', () => onChange(value)); wrap.append(radio, node('span', '', text)); group.appendChild(wrap); });
    return field;
  }
  function openSettings() {
    pause(); const content = node('div', 'nw-settings'); content.appendChild(node('h3', 'guide-title', 'Suas constelações'));
    const levels = node('div', 'nw-levels');
    LEVELS.forEach((level, index) => {
      const done = createSession(level, campaign.levels[index]).complete;
      const button = node('button', 'nw-level' + (done ? ' done' : ''), String(index + 1).padStart(2, '0'));
      button.disabled = index > campaign.unlocked; button.setAttribute('aria-label', `Fase ${index + 1}: ${level.name}${done ? ', completa' : index > campaign.unlocked ? ', bloqueada' : ''}`);
      if (index === campaign.current) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => { hud.closeDialog(); loadLevel(index, done); }); levels.appendChild(button);
    });
    content.appendChild(levels);
    content.appendChild(radioGroup('Aparência', 'nw-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, value => theme.setMode(value)));
    content.appendChild(radioGroup('Cor neon', 'nw-palette', [['auto', 'Por fase'], ['purple', 'Roxo'], ['red', 'Vermelho'], ['orange', 'Laranja'], ['cyan', 'Ciano']], theme.choice, value => theme.setChoice(value)));
    content.appendChild(radioGroup('Efeitos visuais', 'nw-effects', [['full', 'Suaves'], ['low', 'Mínimos']], effects, value => { effects = value; app.dataset.effects = value; store.set('effects', value); }));
    content.appendChild(radioGroup('Som', 'nw-sound', [['off', 'Desligado'], ['on', 'Ligado']], audio.enabled ? 'on' : 'off', value => { audio.setEnabled(value === 'on'); hud.setSound(audio.enabled); audio.resume(); }));
    if (haptics.supported) content.appendChild(radioGroup('Vibração', 'nw-haptics', [['off', 'Desligada'], ['on', 'Ligada']], haptics.enabled ? 'on' : 'off', value => haptics.setEnabled(value === 'on')));
    content.appendChild(node('h3', 'guide-title', 'Como jogar'));
    const rules = node('ul');
    ['Arraste pelas letras e solte para formar a palavra. Você também pode tocar uma letra de cada vez e usar Formar.', 'Cada botão de letra pode ser usado uma vez por palavra. Se houver duas letras A, você pode usar as duas.', 'As palavras certas preenchem a cruzadinha. Acentos não fazem diferença ao digitar.', 'Em algumas fases, novas letras aparecem após encontrar palavras. As casas pontilhadas ficam disponíveis depois.', 'Você tem três dicas por fase. Misturar só muda a posição das letras.', 'Não há relógio nem perda de vidas. Seu progresso é salvo neste aparelho.'].forEach(text => rules.appendChild(node('li', '', text)));
    content.appendChild(rules);
    if (!storageAvailable) content.appendChild(node('p', 'nw-storage-note', 'Este navegador bloqueou o salvamento. A partida funciona, mas o progresso pode se perder ao fechar.'));
    hud.setDialogContent(content, 'Fases & ajustes'); hud.openDialog();
  }
  function onKey(event) {
    if (hud.dialogOpen || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); state === 'paused' ? resume() : pause(); return; }
    if (!canInteract()) return;
    if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); submit(); return; }
    if (event.key === 'Backspace') { event.preventDefault(); selection.pop(); showSelection(); return; }
    const char = normalizeWord(event.key);
    if (event.key.length === 1 && /^[A-Z]$/.test(char)) { event.preventDefault(); const id = [...session.availableLetters()].findIndex((letter, i) => letter === char && !selection.includes(i)); if (id >= 0) choose(id); }
  }
  window.addEventListener('keydown', onKey, { signal });
  style.addEventListener('load', sizeBoard, { signal });
  const observer = 'ResizeObserver' in window ? new ResizeObserver(sizeBoard) : null; observer?.observe(gridWrap);
  loadLevel(campaign.current);
  return {
    update(dt) { if (state === 'playing' && messageTime > 0) { messageTime = Math.max(0, messageTime - dt); if (!messageTime) messageReset = true; } },
    render(dt) { if (messageReset) defaultMessage(); hud.setHint('Sem pressa. <strong>Conecte as letras.</strong>'); hud.tickToast(dt); hud.flush(); },
    resize() { stopPointer(true); sizeBoard(); }, primaryAction, pause, resume,
    secondaryAction() { if (state === 'paused') loadLevel(campaign.current, true); },
    pauseToggle() { state === 'paused' ? resume() : pause(); }, openSettings, onHidden: pause,
    onThemeChange() {},
    getState: () => ({ state, game: meta.id, level: campaign.current + 1, title: session.level.name, wordsFound: session.found.size, wordsTotal: session.level.words.length, letters: session.availableLetters(), score: session.score, hintsLeft: session.hintsLeft, unlockedLevels: campaign.unlocked + 1 }),
    destroy() { stopPointer(); observer?.disconnect(); lifecycle.abort(); view.remove(); app.classList.remove('nw-app'); input.destroy(); }
  };
}

export { meta, create };
