import { createRng, hashSeed, todaySeedLabel } from '../../core/rng.js';
import { LEVELS, MODES, DROP, BOARD, DISCS, SCORE, TIMING, logicalSize } from './config.js';
import { STAGES, stageAt, generateStage } from './stages.js';
import { createBoard, restore, drop, landing, legalMoves, finished, other, cloneBoard } from './model.js';
import { chooseMove, LAST } from './ai.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';

export const meta = {
  id: 'neon-drop',
  title: 'NEON<span>DROP</span>',
  subtitle: 'LIG 4 / 9 TABULEIROS',
  arenaLabel: 'Tabuleiro de Lig 4: escolha a coluna e solte a peça para alinhar as suas.',
  logicalSize,
  stats: [
    { id: 'stage', label: 'Fase', accent: true, flex: '1fr' },
    { id: 'you', label: 'Você', flex: '1fr' },
    { id: 'foe', label: 'Oponente', flex: '1fr' }
  ]
};

const PROGRESS_KEY = 'progress-v1';
const MATCH_KEY = 'match-v1';

export function create(services) {
  const { viewport, input, audio, haptics, theme, store, hud, debug } = services;
  const view = viewport.view;
  const loopStats = services.stats || {};
  const renderer = createRenderer(viewport, theme, debug);

  input.setMode('absolute');

  let style = document.getElementById('drop-style');
  if (!style) {
    style = document.createElement('link');
    style.id = 'drop-style';
    style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('nd-app');
  document.body.classList.add('nd-body');

  const validMode = v => (MODES[v] ? v : 'campanha');
  const validLevel = v => (LEVELS[v] ? v : 'medio');
  const settings = {
    mode: validMode(store.get('mode', 'campanha')),
    level: validLevel(store.get('level', 'medio')),
    first: store.get('first', 'voce') === 'ia' ? 'ia' : 'voce'
  };

  const saved = store.get(PROGRESS_KEY, {});
  const progress = {
    unlocked: Number.isInteger(saved?.unlocked) ? Math.max(1, Math.min(STAGES.length, saved.unlocked)) : 1,
    records: (saved && typeof saved.records === 'object' && saved.records) || {},
    score: Number.isSafeInteger(saved?.score) ? saved.score : 0
  };
  const recordKey = () => `${settings.mode}-${S.stageIndex}-${settings.level}`;
  const recordFor = key => {
    const r = progress.records[key];
    const n = v => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
    return { wins: n(r?.wins), losses: n(r?.losses), draws: n(r?.draws) };
  };

  const S = {
    state: 'intro',      // intro | playing | thinking | falling | over | paused
    mode: settings.mode,
    level: settings.level,
    stageIndex: 0,
    stage: stageAt(0),
    board: null,
    human: 1,            // marca do jogador humano (no duo, quem começa)
    cursor: 3,
    preview: -1,
    falling: null,
    thinkLeft: 0,
    clock: 0,
    shake: 0,
    banner: '',
    bannerTone: '',
    bannerTime: 0,
    revealLeft: 0,
    result: null,
    seed: 1,
    freePlays: 0,
    lastMove: null
  };

  let hudDirty = true;
  let pausedFrom = null;
  let overlayArgs = null;

  // Nome da peça: usado no resultado, no aviso de vez e no modo dois jogadores.
  const discName = mark => DISCS[mark].name;
  const discWord = mark => DISCS[mark].word;

  const aiMark = () => other(S.human);
  const isAI = () => MODES[S.mode].ai;
  const myTurn = () => !isAI() || S.board.turn === S.human;
  const rules = () => LEVELS[S.level];

  const present = args => { overlayArgs = args; hud.showOverlay(args); };
  const dismiss = () => { overlayArgs = null; hud.hideOverlay(); };
  const showBanner = (text, tone = '', seconds = TIMING.banner) => {
    S.banner = text; S.bannerTone = tone; S.bannerTime = seconds;
  };

  // --------------------------------------------------------------- som
  const sfx = {
    move() { audio.tone({ freq: 300, dur: 0.05, type: 'triangle', vol: 0.025, slide: 1.2 }); },
    land(mark) {
      audio.noise({ dur: 0.12, vol: 0.045, cutoff: 900, cutoffEnd: 260 });
      audio.tone({ freq: mark === 1 ? 220 : 180, dur: 0.13, type: 'sine', vol: 0.04, slide: 0.55 });
    },
    blocked() { audio.noise({ dur: 0.1, vol: 0.03, cutoff: 420, cutoffEnd: 200 }); },
    win() {
      audio.tone({ freq: 520, dur: 0.16, type: 'triangle', vol: 0.05, slide: 1.5 });
      audio.tone({ freq: 780, dur: 0.3, type: 'sine', vol: 0.04, slide: 1.35 });
    },
    lose() {
      audio.tone({ freq: 260, dur: 0.3, type: 'sawtooth', vol: 0.04, slide: 0.5 });
      audio.noise({ dur: 0.3, vol: 0.03, cutoff: 500, cutoffEnd: 160 });
    },
    draw() { audio.tone({ freq: 300, dur: 0.22, type: 'triangle', vol: 0.03, slide: 1 }); }
  };

  // ------------------------------------------------------------- partida
  function stageFor(index) {
    if (S.mode === 'livre' && index >= STAGES.length) {
      return generateStage(index, createRng((S.seed ^ (index * 2654435761)) >>> 0));
    }
    return stageAt(index);
  }

  function startStage(index, keepScore = true) {
    S.stageIndex = Math.max(0, index);
    S.stage = stageFor(S.stageIndex);
    S.board = createBoard(S.stage);
    S.human = settings.first === 'ia' && isAI() ? 2 : 1;
    S.cursor = Math.floor(S.stage.cols / 2);
    S.falling = null;
    S.result = null;
    S.lastMove = null;
    S.revealLeft = 0;
    S.clock = 0;
    if (!keepScore) progress.score = 0;
    theme.setAuto(S.stage.palette);
    hud.setHint(S.stage.hint);
    dismiss();
    audio.resume();
    S.state = 'playing';
    if (isAI() && S.board.turn === aiMark()) startThinking();
    saveMatch();
    hudDirty = true;
  }

  function saveMatch() {
    store.set(MATCH_KEY, {
      mode: S.mode, level: S.level, stageIndex: S.stageIndex, human: S.human,
      seed: S.seed, moves: [...S.board.moves], at: Date.now()
    });
  }
  const savedMatch = () => {
    const m = store.get(MATCH_KEY, null);
    if (!m || !MODES[m.mode] || !LEVELS[m.level]) return null;
    if (!Array.isArray(m.moves) || !m.moves.length) return null;
    if (!Number.isInteger(m.stageIndex) || m.stageIndex < 0) return null;
    return m;
  };
  const clearMatch = () => store.remove(MATCH_KEY);

  function resumeMatch(m) {
    settings.mode = validMode(m.mode);
    settings.level = validLevel(m.level);
    S.mode = settings.mode;
    S.level = settings.level;
    S.seed = Number.isSafeInteger(m.seed) ? m.seed : 1;
    S.stageIndex = m.stageIndex;
    S.stage = stageFor(S.stageIndex);
    const board = restore(S.stage, m.moves);
    if (!board) { clearMatch(); startStage(0); return; }
    S.board = board;
    S.human = m.human === 2 ? 2 : 1;
    S.cursor = Math.floor(S.stage.cols / 2);
    S.falling = null;
    S.result = null;
    S.lastMove = lastMoveOf(S.board);
    theme.setAuto(S.stage.palette);
    hud.setHint(S.stage.hint);
    dismiss();
    audio.resume();
    if (finished(S.board)) { S.state = 'over'; finishStage(); return; }
    S.state = 'playing';
    if (isAI() && S.board.turn === aiMark()) startThinking();
    hudDirty = true;
  }

  // Numa partida retomada só existe a lista de colunas; a peça de cima da
  // última coluna jogada é, por construção, a última que caiu.
  function lastMoveOf(board) {
    if (!board.moves.length) return null;
    const col = board.moves[board.moves.length - 1];
    for (let row = 0; row < board.rows; row++) {
      const v = board.cells[row * board.cols + col];
      if (v === 1 || v === 2) return { col, row };
    }
    return null;
  }

  function saveProgress() {
    store.set(PROGRESS_KEY, { unlocked: progress.unlocked, records: progress.records, score: progress.score });
  }

  // ---------------------------------------------------------- jogada
  // `quem` é a marca que a chamada acredita estar jogando. Serve de tranca:
  // a cor da peça vem sempre de `S.board.turn`, e uma chamada que discorde
  // disso é erro de quem chamou, não uma jogada válida.
  function play(col, quem = S.board.turn) {
    if (!['playing'].includes(S.state) || S.falling || hud.dialogOpen) return false;
    if (quem !== S.board.turn) return false;
    const row = landing(S.board, col);
    if (row < 0) {
      showBanner('COLUNA CHEIA', 'bad', 1);
      sfx.blocked();
      haptics.buzz(6);
      return false;
    }
    const mark = S.board.turn;
    drop(S.board, col, mark);
    const geo = renderer.layout(S.stage);
    S.falling = { col, row, mark, y: geo.entryY, vy: 0, bounces: 0, target: geo.rowY(row) };
    S.state = 'falling';
    S.cursor = col;
    sfx.move();
    saveMatch();
    hudDirty = true;
    return true;
  }

  function landed() {
    const f = S.falling;
    S.falling = null;
    S.lastMove = { col: f.col, row: f.row };
    sfx.land(f.mark);
    haptics.buzz(8);
    S.shake = 3;
    if (finished(S.board)) {
      S.revealLeft = TIMING.reveal;
      S.state = 'over';
      if (S.board.winner) {
        const venceu = !isAI() || S.board.winner === S.human;
        if (venceu) sfx.win(); else sfx.lose();
        showBanner(resultText(), venceu ? '' : 'bad', TIMING.reveal + 0.6);
      } else {
        sfx.draw();
        showBanner('DEU VELHA', '', TIMING.reveal + 0.6);
      }
      return;
    }
    S.state = 'playing';
    if (isAI() && S.board.turn === aiMark()) startThinking();
    hudDirty = true;
  }

  function resultText() {
    if (!S.board.winner) return 'DEU VELHA';
    if (!isAI()) return `${discName(S.board.winner)} VENCE`;
    return S.board.winner === S.human ? 'VOCÊ VENCEU' : 'A MÁQUINA VENCEU';
  }

  function startThinking() {
    S.state = 'thinking';
    S.thinkLeft = rules().delay;
    hudDirty = true;
  }

  function aiPlay() {
    // A busca joga e desfaz milhares de vezes. Roda numa cópia para não
    // encostar no tabuleiro da partida — assim nenhum descuido dentro dela
    // pode mexer nas peças, no histórico ou na vez da partida de verdade.
    const col = chooseMove(cloneBoard(S.board), aiMark(), {
      depth: rules().depth, noise: rules().noise, budget: rules().budget
    });
    S.state = 'playing';
    if (col === null) return;
    // Se a vez não for da máquina aqui, alguma coisa mexeu no tabuleiro por
    // fora: `play` recusa e a vez fica com o humano, que é o estado coerente.
    if (S.board.turn !== aiMark() && debug.active) {
      debug.info(`ERRO: máquina ia jogar fora da vez (vez ${S.board.turn}, máquina ${aiMark()})`);
    }
    play(col, aiMark());
  }

  function finishStage() {
    const key = recordKey();
    const record = recordFor(key);
    const venceu = S.board.winner && (!isAI() || S.board.winner === S.human);
    const empate = !S.board.winner;
    if (empate) record.draws++;
    else if (venceu) record.wins++;
    else record.losses++;
    progress.records[key] = record;

    let ganho = 0;
    if (venceu && isAI()) {
      const sobrou = S.stage.cols * S.stage.rows - S.board.moves.length;
      ganho = Math.round((SCORE.win + S.stageIndex * SCORE.perStage + sobrou * SCORE.fast) * rules().bonus);
    } else if (empate && isAI()) {
      ganho = Math.round(SCORE.draw * rules().bonus);
    }
    progress.score += ganho;

    const ultima = S.stageIndex >= STAGES.length - 1;
    const liberou = venceu && S.mode === 'campanha' && !ultima && progress.unlocked <= S.stageIndex + 1;
    if (liberou) progress.unlocked = S.stageIndex + 2;
    saveProgress();
    clearMatch();

    const campanhaFechada = venceu && S.mode === 'campanha' && ultima;
    present({
      tag: campanhaFechada ? 'Campanha completa'
        : venceu ? `Fase ${S.stageIndex + 1} vencida`
        : empate ? 'Sem vencedor' : 'Fim da partida',
      title: campanhaFechada ? 'Nove tabuleiros.<br>Todos seus.'
        : venceu ? (isAI() ? 'Você venceu!' : `Venceu o ${discWord(S.board.winner)}!`)
        : empate ? 'Deu velha.' : 'A máquina fechou a linha.',
      text: `${S.stage.name} · ${S.board.moves.length} jogadas` +
        (ganho ? ` · +${ganho} pontos` : '') +
        (liberou ? ` · fase ${S.stageIndex + 2} liberada` : ''),
      action: venceu && S.mode === 'campanha' && !ultima ? 'Próxima fase' : 'Jogar de novo',
      secondary: S.mode === 'campanha' && !ultima && progress.unlocked > S.stageIndex + 1 && !venceu
        ? 'Pular fase' : 'Escolher fase',
      note: `${MODES[S.mode].label} · ${LEVELS[S.level].label} · ${progress.score} pontos`
    });
    hudDirty = true;
  }

  // ----------------------------------------------------------------- ciclo
  function update(dt) {
    if (['intro', 'paused'].includes(S.state)) return;
    S.clock += dt;
    if (S.bannerTime > 0) { S.bannerTime -= dt; if (S.bannerTime <= 0) S.banner = ''; }
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 18);

    if (S.falling) {
      const f = S.falling;
      f.vy += DROP.gravity * dt;
      f.y += f.vy * dt;
      if (f.y >= f.target) {
        f.y = f.target;
        if (f.vy > DROP.settle && f.bounces < DROP.maxBounces) {
          f.vy = -f.vy * DROP.bounce;
          f.bounces++;
        } else {
          landed();
        }
      }
      return;
    }

    if (S.state === 'thinking') {
      S.thinkLeft -= dt;
      if (S.thinkLeft <= 0) aiPlay();
      return;
    }
    if (S.state === 'over') {
      if (S.revealLeft > 0) {
        S.revealLeft -= dt;
        if (S.revealLeft <= 0) finishStage();
      }
      return;
    }
    if (S.state === 'playing' && myTurn()) {
      const axis = input.poll();
      if (axis) moveCursor(axis * dt * 6);
    }
  }

  let cursorFloat = 3;
  function moveCursor(delta) {
    cursorFloat = Math.max(0, Math.min(S.stage.cols - 1, cursorFloat + delta));
    const col = Math.round(cursorFloat);
    if (col !== S.cursor) { S.cursor = col; hudDirty = true; }
  }

  // Texto do aviso de vez, em cima do tabuleiro. É a resposta direta para
  // "de quem é a vez": nome curto e a peça da cor de quem joga, ao lado.
  function turnInfo(board) {
    if (S.state === 'paused') return { label: 'Pausado', mark: 0, waiting: true };
    if (S.state === 'thinking') return { label: 'A máquina pensa', mark: aiMark(), waiting: true };
    if (!board || finished(board)) {
      if (board && board.winner) {
        return { label: isAI()
          ? (board.winner === S.human ? 'Você venceu' : 'A máquina venceu')
          : `Venceu o ${discWord(board.winner)}`, mark: board.winner, waiting: true };
      }
      return { label: board && board.draw ? 'Deu velha' : '', mark: 0, waiting: true };
    }
    if (!isAI()) return { label: `Vez do ${discWord(board.turn)}`, mark: board.turn, waiting: false };
    return board.turn === S.human
      ? { label: 'Sua vez', mark: board.turn, waiting: false }
      : { label: 'Vez da máquina', mark: board.turn, waiting: true };
  }

  function render(dt, alpha) {
    const board = S.board || createBoard(S.stage);
    const jogando = ['playing', 'thinking', 'falling'].includes(S.state);
    S.preview = jogando && !S.falling ? landing(board, S.cursor) : -1;
    const vez = turnInfo(board);
    const cheias = [];
    for (let col = 0; col < S.stage.cols; col++) cheias.push(landing(board, col) < 0);
    renderer.draw({
      stage: S.stage,
      cells: board.cells,
      turn: board.turn,
      winner: board.winner,
      line: board.line,
      cursor: S.cursor,
      preview: S.preview,
      showCursor: S.state === 'playing' && myTurn() && !S.falling,
      falling: S.falling,
      lastMove: S.lastMove,
      full: cheias,
      turnLabel: S.state === 'intro' ? '' : vez.label,
      turnMark: vez.mark,
      waiting: vez.waiting,
      clock: S.clock,
      shake: S.shake,
      banner: S.banner,
      bannerTone: S.bannerTone,
      search: LAST,
      stats: loopStats
    });
    hud.tickToast(dt);
    if (hudDirty) { syncHud(); hudDirty = false; }
    hud.flush();
  }

  function syncHud() {
    const record = recordFor(recordKey());
    const total = S.mode === 'campanha' ? `${S.stageIndex + 1}/${STAGES.length}` : String(S.stageIndex + 1);
    hud.setStat('stage', total, `Fase ${total}: ${S.stage.name}`);
    hud.setStat('you', String(record.wins));
    hud.setStat('foe', String(record.losses));

    const chips = [{ text: S.stage.name, tone: 'accent' }];
    chips.push({ text: `${S.stage.cols}×${S.stage.rows} · conecta ${S.stage.connect}` });
    if (isAI()) chips.push({ text: LEVELS[S.level].label, tone: 'accent' });
    // A cor da sua peça fica dita na barra: no duo as duas alternam, e mesmo
    // contra a máquina dá para começar de âmbar ou de ciano.
    const minha = isAI() ? S.human : null;
    // A bolinha do chip usa a mesma cor da peça no tabuleiro, que muda entre
    // tema claro e escuro — senão a pista de cor apontaria para outra coisa.
    const ponto = mark => `<i style="background:${theme.dark ? DISCS[mark].dark : DISCS[mark].light}"></i>`;
    if (minha) chips.push({ text: `${ponto(minha)}você é ${discWord(minha)}` });
    const vez = turnInfo(S.board);
    chips.push({
      text: vez.mark && vez.label ? `${ponto(vez.mark)}${vez.label}` : vez.label || 'Partida encerrada',
      tone: 'flow'
    });
    if (progress.score) chips.push({ text: `${progress.score} pts` });
    hud.setChips(chips, `Fase ${total}, ${S.stage.name}`);
    hud.setPause(S.state === 'paused', !['intro', 'over'].includes(S.state));
  }

  // ------------------------------------------------------------- entrada
  const columnAt = x => {
    const geo = renderer.layout(S.stage);
    return Math.max(0, Math.min(S.stage.cols - 1, Math.floor((x - geo.x) / geo.cell)));
  };

  const aiming = () => !hud.dialogOpen && S.state === 'playing' && myTurn() && !S.falling;

  function aimAt(x, soar) {
    const col = columnAt(x);
    if (col === S.cursor) return;
    S.cursor = col;
    cursorFloat = col;
    if (soar) sfx.move();
    hudDirty = true;
  }

  input.on('press', p => { if (aiming()) aimAt(p.x, true); });

  // A peça acompanha o dedo enquanto ele desliza (e o ponteiro do mouse mesmo
  // sem clicar): dá para escolher a coluna vendo a prévia antes de soltar. O
  // clique seco do passo de coluna só sai com o ponteiro pressionado — no
  // desktop o mouse passeia sem clicar e ficaria apitando à toa.
  input.on('move', p => { if (aiming()) aimAt(p.x, p.dragging); });

  input.on('release', () => {
    if (hud.dialogOpen || S.state !== 'playing' || !myTurn()) return;
    play(columnAt(input.state.x));
  });

  input.on('key', event => {
    if (hud.dialogOpen) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (/^[1-9]$/.test(event.key) && S.state === 'playing' && myTurn()) {
      event.preventDefault();
      const col = Number(event.key) - 1;
      if (col < S.stage.cols) { S.cursor = col; cursorFloat = col; play(col); }
      return;
    }
    // Um toque na seta anda uma coluna. Sem isto só o segurar movia (o eixo é
    // lido por quadro), e uma batidinha na tecla não saía do lugar.
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && S.state === 'playing' && myTurn()) {
      event.preventDefault();
      const passo = event.key === 'ArrowRight' ? 1 : -1;
      const col = Math.max(0, Math.min(S.stage.cols - 1, S.cursor + passo));
      if (col !== S.cursor) { S.cursor = col; cursorFloat = col; sfx.move(); hudDirty = true; }
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (S.state === 'playing' && myTurn()) play(S.cursor);
      else if (['intro', 'over'].includes(S.state)) primaryAction();
      else if (S.state === 'paused') resume();
    }
  });

  // ------------------------------------------------------------- interface
  function primaryAction() {
    if (hud.dialogOpen) return;
    if (S.state === 'paused') { resume(); return; }
    if (S.state === 'intro') {
      const m = savedMatch();
      if (m) { resumeMatch(m); return; }
      startStage(S.mode === 'campanha' ? Math.min(progress.unlocked - 1, STAGES.length - 1) : S.stageIndex);
      return;
    }
    if (S.state === 'over') {
      const venceu = S.board.winner && (!isAI() || S.board.winner === S.human);
      const proxima = venceu && S.mode === 'campanha' && S.stageIndex < STAGES.length - 1;
      startStage(proxima ? S.stageIndex + 1 : S.stageIndex);
      return;
    }
    startStage(S.stageIndex);
  }

  function secondaryAction() {
    if (hud.dialogOpen) return;
    if (S.state === 'paused') { clearMatch(); startStage(S.stageIndex); return; }
    if (S.state === 'over' || S.state === 'intro') openStagePicker();
  }

  function pause() {
    if (['intro', 'over', 'paused'].includes(S.state)) return;
    pausedFrom = S.state;
    S.state = 'paused';
    input.reset();
    present({
      tag: 'Pausado', title: 'Partida pausada',
      text: `${S.stage.name} · ${S.board.moves.length} jogadas · ${MODES[S.mode].label}.`,
      action: 'Continuar', secondary: 'Reiniciar fase'
    });
    hudDirty = true;
  }

  function resume() {
    if (S.state !== 'paused' || hud.dialogOpen) return;
    S.state = pausedFrom === 'thinking' ? 'thinking' : pausedFrom === 'falling' ? 'falling' : 'playing';
    pausedFrom = null;
    audio.resume();
    dismiss();
    hudDirty = true;
  }

  // O seletor tem marcação própria (nd-stages) porque o `.level-pick` do shell
  // foi feito para um número só: com nome, tamanho e placar dentro, o texto
  // vazava do botão e escrevia por cima do vizinho.
  function openStagePicker() {
    const node = document.createElement('div');
    node.className = 'nd-stages';
    const limite = S.mode === 'campanha' ? progress.unlocked : STAGES.length;
    STAGES.forEach((stage, index) => {
      const liberada = index < limite;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nd-stage';
      button.disabled = !liberada;
      if (index === S.stageIndex) button.setAttribute('aria-current', 'step');
      const rec = recordFor(`${S.mode}-${index}-${settings.level}`);
      const marca = `<b>${index + 1}</b>`;
      if (!liberada) {
        button.innerHTML = `${marca}<span>Bloqueada</span>` +
          `<small>vença a fase ${index}</small><em>—</em>`;
        button.setAttribute('aria-label', `Fase ${index + 1}, bloqueada`);
      } else {
        const blocos = stage.blocked && stage.blocked.length ? ' · blocos' : '';
        const placar = rec.wins || rec.losses ? `${rec.wins}V ${rec.losses}D` : 'nunca jogada';
        button.innerHTML = marca +
          `<span>${stage.name}</span>` +
          `<small>${stage.cols}×${stage.rows} · conecta ${stage.connect}</small>` +
          `<em>${placar}${blocos}</em>`;
      }
      button.addEventListener('click', () => { hud.closeDialog(); clearMatch(); startStage(index); });
      node.appendChild(button);
    });
    hud.setDialogContent(node, 'Escolher fase');
    hud.openDialog();
  }

  function openSettings() {
    const playing = !['intro', 'over', 'paused'].includes(S.state);
    if (playing) pause();
    const node = buildDialog({
      settings, theme, audio, haptics, progress, stages: STAGES,
      recordFor: index => recordFor(`${settings.mode}-${index}-${settings.level}`),
      onMode: value => {
        settings.mode = validMode(value);
        store.set('mode', settings.mode);
        hud.toast('O modo vale na próxima partida', { priority: 2 });
      },
      onLevel: value => {
        settings.level = validLevel(value);
        store.set('level', settings.level);
        hud.toast('A dificuldade vale na próxima partida', { priority: 2 });
      },
      onFirst: value => {
        settings.first = value === 'ia' ? 'ia' : 'voce';
        store.set('first', settings.first);
      },
      onStages: () => { hud.closeDialog(); openStagePicker(); }
    });
    hud.setDialogContent(node, 'Ajustes & regras');
    hud.openDialog();
  }

  function resize() {
    renderer.invalidate();
    hudDirty = true;
  }

  // Tela inicial
  S.seed = hashSeed(todaySeedLabel()) ^ 0x5eed;
  S.stageIndex = Math.min(progress.unlocked - 1, STAGES.length - 1);
  S.stage = stageFor(S.stageIndex);
  S.board = createBoard(S.stage);
  theme.setAuto(S.stage.palette);
  hud.setHint('Arraste pelo tabuleiro · <strong>solte para jogar</strong>');
  function showIntro() {
    const m = savedMatch();
    present({
      tag: 'Lig 4', title: 'Quatro em linha.<br>Nove tabuleiros.',
      text: m
        ? `Você parou na fase ${m.stageIndex + 1} com ${m.moves.length} jogadas.`
        : 'Solte as peças, alinhe as suas e bloqueie as dela. Cada fase muda o tabuleiro.',
      action: m ? 'Continuar' : 'Começar',
      secondary: 'Escolher fase',
      note: `${MODES[settings.mode].label} · ${LEVELS[settings.level].label} · ${progress.unlocked} de ${STAGES.length} fases liberadas`
    });
    S.state = 'intro';
    syncHud();
  }
  showIntro();

  return {
    meta, update, render, resize,
    primaryAction, secondaryAction, pause, resume,
    pauseToggle: () => (S.state === 'paused' ? resume() : pause()),
    openSettings,
    onHidden: pause,
    onThemeChange: () => { renderer.invalidate(); hudDirty = true; },
    getState: () => ({
      state: S.state, mode: S.mode, level: S.level, stage: S.stage.name,
      stageIndex: S.stageIndex, cols: S.stage.cols, rows: S.stage.rows, connect: S.stage.connect,
      turn: S.board?.turn, human: S.human, winner: S.board?.winner || 0,
      draw: !!S.board?.draw, moves: S.board?.moves.length || 0,
      unlocked: progress.unlocked, score: progress.score,
      record: recordFor(recordKey())
    }),
    inspect: () => ({ S, settings, progress, renderer }),
    destroy: () => {
      input.destroy();
      app.classList.remove('nd-app');
      document.body.classList.remove('nd-body');
    }
  };
}
