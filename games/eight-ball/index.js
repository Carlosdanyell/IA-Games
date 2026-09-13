import { createRng } from '../../core/rng.js';
import { TABLE, SHOT, PANEL, AI, logicalSize } from './config.js';
import { createRack, evaluateShot, remainingOf, GROUP_LABEL } from './rules.js';
import { step, anyMoving } from './physics.js';
import { chooseShot, firstBlocker, railHit } from './ai.js';
import { nearestFreeSpot, isFreeSpot } from './table.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';
import { LanTransport } from './lan-transport.js';
import { createLanLobby } from './lan-ui.js';
import { cleanName, escapeHtml, validAim, validCommand, validSnapshot, decodeSignal } from './lan-protocol.js';

export const meta = {
  id: 'eight-ball',
  title: 'NEON<span>POOL</span>',
  subtitle: 'SINUCA 8-BALL / HORIZONTAL',
  arenaLabel: 'Mesa de sinuca. Arraste no pano para mirar e use a barra de força para tacar.',
  logicalSize,
  stats: [
    { id: 'turn', label: 'Vez', accent: true, flex: '1fr' },
    { id: 'group', label: 'Grupo', flex: '1fr' },
    { id: 'left', label: 'Faltam', flex: '.8fr' }
  ]
};

const MODES = {
  cpu: { label: 'Contra a máquina', ai: true },
  local: { label: 'Mesmo aparelho', ai: false },
  lan: { label: 'Multiplayer · mesma rede', ai: false }
};

export function create(services) {
  const { viewport, input, audio, haptics, theme, store, hud, debug } = services;
  const view = viewport.view;
  const loopStats = services.stats || {};
  const renderer = createRenderer(viewport, theme, debug);

  let style = document.getElementById('pool-style');
  if (!style) {
    style = document.createElement('link');
    style.id = 'pool-style';
    style.rel = 'stylesheet';
    style.href = new URL('./style.css', import.meta.url).href;
    document.head.appendChild(style);
  }
  const app = hud.arena.closest('.app');
  app.classList.add('pool-app');

  const DEFAULT_NAMES = ['Jogador 1', 'Jogador 2'];
  // Nome curto de propósito: em paisagem o placar tem 126px de coluna.
  const storedNames = store.get('names', DEFAULT_NAMES);
  const settings = {
    mode: ['cpu', 'local'].includes(store.get('mode')) ? store.get('mode') : 'cpu',
    level: store.get('level', 'medio'),
    guide: store.get('guide', true),
    names: [cleanName(storedNames?.[0], 0), cleanName(storedNames?.[1], 1)]
  };

  // Placar do confronto, guardado por dupla de nomes. Trocar de dupla não
  // apaga o placar anterior: voltar aos mesmos nomes recupera a série.
  const duelKey = names => names.map(n => n.toLowerCase()).join(' \u00d7 ');
  function duelRecord() {
    const history = store.get('duels', {});
    return history[duelKey(settings.names)] || { wins: [0, 0] };
  }
  function saveDuelWin(winner) {
    const history = store.get('duels', {});
    const key = duelKey(settings.names);
    const entry = history[key] || { wins: [0, 0] };
    entry.wins[winner] = (entry.wins[winner] || 0) + 1;
    entry.names = [...settings.names];
    entry.at = Date.now();
    history[key] = entry;
    const keys = Object.keys(history);
    if (keys.length > 24) {
      keys.sort((a, b) => (history[a].at || 0) - (history[b].at || 0));
      delete history[keys[0]];
    }
    store.set('duels', history);
  }
  function clearDuel() {
    const history = store.get('duels', {});
    delete history[duelKey(settings.names)];
    store.set('duels', history);
    hudDirty = true;
  }

  const S = {
    flow: 'intro',          // intro | placing | aiming | rolling | think | over
    stage: 'break',         // break | play  (usado pelas regras)
    balls: [],
    turn: 0,
    groups: { 0: null, 1: null },
    ballInHand: false,
    winner: null,
    message: '',
    shots: 0,
    fouls: [0, 0]
  };

  const aim = { angle: 0, power: 0.55 };
  let rng = createRng(1);
  let shotLog = null;
  let settle = 0;
  let thinkTimer = 0;
  let charging = false;
  let dragMode = null;     // 'aim' | 'power' | 'place'
  let hudDirty = true;
  let banner = '';
  let bannerTime = 0;
  let ghostCue = null;
  let net = null;
  let lobby = null;
  let networkTime = 0;
  let endReason = '';
  let offlineSettings = null;

  const isPortrait = () => view.cssW < view.cssH * 1.1;

  // Em retrato quem fala é o aviso de girar, desenhado no canvas. O overlay do
  // shell sai da frente e volta sozinho quando o aparelho gira.
  let overlayArgs = null;
  let wasPortrait = null;
  function present(args) {
    overlayArgs = args;
    if (isPortrait()) hud.hideOverlay(); else hud.showOverlay(args);
  }
  function dismiss() { overlayArgs = null; hud.hideOverlay(); }
  function syncOrientation() {
    const portrait = isPortrait();
    if (portrait === wasPortrait) return;
    wasPortrait = portrait;
    if (portrait) hud.hideOverlay();
    else if (overlayArgs) hud.showOverlay(overlayArgs);
    hudDirty = true;
  }
  const humanTurn = () => !MODES[settings.mode].ai || S.turn === 0;
  const mySeat = () => net?.role === 'guest' ? 1 : 0;
  const canControl = () => !net || (net.started && net.connected && !net.pending && S.turn === mySeat());
  const playerName = i => MODES[settings.mode].ai
    ? (i === 0 ? 'Você' : 'Máquina')
    : settings.names[i];

  // ----------------------------------------------------------------- partida
  function newMatch() {
    if (net) {
      if (net.role !== 'host' || !net.started || !net.connected) return;
      net.match++; net.revision++; net.ready = [false, false]; net.pending = 0;
    }
    endReason = '';
    // Sai de 'over' ANTES de montar a vez: beginTurn ignora chamadas com a
    // partida encerrada, e sem isto a mesa era refeita mas o overlay ficava.
    S.flow = 'aiming';
    rng = createRng((Math.random() * 0xffffffff) >>> 0);
    S.balls = createRack(rng.next);
    S.turn = 0;
    S.groups = { 0: null, 1: null };
    S.stage = 'break';
    S.ballInHand = false;
    S.winner = null;
    S.shots = 0;
    S.fouls = [0, 0];
    S.message = 'Saída livre.';
    aim.angle = 0;
    aim.power = 0.78;
    beginTurn(true);
    if (net) {
      if (isPortrait() || document.hidden) pause();
      broadcast();
    }
  }

  function beginTurn(silent = false) {
    if (S.flow === 'over') return;
    if (S.ballInHand && humanTurn()) {
      S.flow = 'placing';
      const spot = nearestFreeSpot(TABLE.headX, TABLE.centerY, S.balls, 0);
      ghostCue = { x: spot.x, y: spot.y, valid: true };
      if (!silent) showBanner('Bola na mão: toque no pano');
    } else if (humanTurn()) {
      if (S.ballInHand) placeCueAuto();
      S.flow = 'aiming';
      pointAtSomething();
    } else {
      if (S.ballInHand) placeCueAuto();
      // A jogada da máquina é escolhida AGORA e só executada depois da pausa:
      // assim o taco fica visivelmente apontado enquanto ela "pensa".
      const plan = chooseShot(S, settings.level, rng.next);
      if (plan) { aim.angle = plan.angle; aim.power = plan.power; }
      else { pointAtSomething(); aim.power = 0.45; }
      S.flow = 'think';
      thinkTimer = AI.thinkTime;
    }
    dismiss();
    hudDirty = true;
  }

  function placeCueAuto() {
    const cue = S.balls[0];
    cue.active = true;
    cue.vx = cue.vy = 0;
    const spot = nearestFreeSpot(TABLE.headX, TABLE.centerY, S.balls, 0);
    cue.x = spot.x; cue.y = spot.y;
    S.ballInHand = false;
  }

  // Mira inicial apontada para uma bola legal, para o jogador nunca começar
  // encarando a tabela.
  function pointAtSomething() {
    const cue = S.balls[0];
    const group = S.groups[S.turn];
    const targets = S.balls.filter(b => b.active && b.number !== 0 &&
      (!group ? b.number !== 8 : remainingOf(S.balls, group) ? b.group === group : b.number === 8));
    if (!targets.length) return;
    let pick = targets[0], near = Infinity;
    for (const b of targets) {
      const d = Math.hypot(b.x - cue.x, b.y - cue.y);
      if (d < near) { near = d; pick = b; }
    }
    aim.angle = Math.atan2(pick.y - cue.y, pick.x - cue.x);
  }

  function showBanner(text, seconds = 2.2) { banner = text; bannerTime = seconds; }

  // ------------------------------------------------------------------ tacada
  function shoot(power, remote = false) {
    if (S.flow !== 'aiming' && S.flow !== 'think') return;
    if (!Number.isFinite(power) || !validAim(aim)) return;
    if (net && !remote) {
      if (!canControl()) return;
      if (net.role === 'guest') { sendCommand('shoot', { aim: { ...aim, power } }); return; }
    }
    const cue = S.balls[0];
    const shaped = Math.pow(Math.max(0.05, Math.min(1, power)), SHOT.powerCurve);
    const speed = SHOT.minSpeed + (SHOT.maxSpeed - SHOT.minSpeed) * shaped;
    cue.vx = Math.cos(aim.angle) * speed;
    cue.vy = Math.sin(aim.angle) * speed;
    shotLog = { firstHit: null, pocketed: [], railAfterHit: false, cueScratched: false, railSet: new Set() };
    S.flow = 'rolling';
    S.shots++;
    settle = 0;
    charging = false;
    audio.resume();
    audio.tone({ freq: 150 + power * 120, dur: 0.09, type: 'square', vol: 0.05, slide: 0.4 });
    haptics.buzz(Math.round(6 + power * 14));
    hudDirty = true;
    if (net) { net.revision++; broadcast(); }
  }

  const shotEvents = {
    onBallHit(a, b, speed) {
      if ((a.id === 0 || b.id === 0) && shotLog && shotLog.firstHit === null) {
        shotLog.firstHit = (a.id === 0 ? b : a).number;
      }
      if (speed > 40) {
        audio.tone({ freq: 420 + Math.min(300, speed * 0.25), dur: 0.045, type: 'sine',
                     vol: Math.min(0.05, 0.012 + speed / 9000) });
      }
    },
    onRailHit(ball, speed) {
      if (!shotLog) return;
      shotLog.railSet.add(ball.id);
      if (shotLog.firstHit !== null) shotLog.railAfterHit = true;
      if (speed > 60) audio.tone({ freq: 190, dur: 0.05, type: 'triangle', vol: 0.025 });
    },
    onPocket(ball) {
      if (!shotLog) return;
      shotLog.pocketed.push(ball.number);
      if (ball.number === 0) shotLog.cueScratched = true;
      audio.tone({ freq: 300, dur: 0.16, type: 'sine', vol: 0.05, slide: 0.45 });
      haptics.buzz(14);
      hudDirty = true;
    }
  };

  function endShot() {
    const log = {
      firstHit: shotLog.firstHit,
      pocketed: shotLog.pocketed,
      railAfterHit: shotLog.railAfterHit,
      cueScratched: shotLog.cueScratched,
      railBalls: shotLog.railSet.size
    };
    const shooter = S.turn;
    const wasBreak = S.stage === 'break';
    const outcome = evaluateShot(S, log);

    if (outcome.respotEight) {
      const eight = S.balls.find(b => b.number === 8);
      const spot = nearestFreeSpot(TABLE.footX, TABLE.centerY, S.balls, 8);
      eight.active = true; eight.x = spot.x; eight.y = spot.y; eight.vx = eight.vy = 0;
    }
    if (log.cueScratched) {
      const cue = S.balls[0];
      cue.active = true; cue.vx = cue.vy = 0;
      cue.x = TABLE.headX; cue.y = TABLE.centerY;
    }
    if (S.stage === 'break') S.stage = 'play';

    if (outcome.assigned) {
      showBanner(`${playerName(shooter)}: ${GROUP_LABEL[outcome.assigned]}`, 2.4);
    }

    if (outcome.over) {
      S.winner = outcome.winner;
      S.flow = 'over';
      finishMatch(outcome.reason);
      return;
    }

    if (outcome.foul) {
      S.fouls[shooter]++;
      S.ballInHand = true;
      S.turn = 1 - shooter;
      S.message = outcome.reason;
      showBanner('Falta · ' + playerName(S.turn) + ' com bola na mão', 2.6);
      audio.tone({ freq: 150, dur: 0.2, type: 'sawtooth', vol: 0.04 });
    } else if (outcome.keepTurn) {
      S.ballInHand = false;
      // Encaçapar na saída não define grupo: pela regra a mesa segue aberta e
      // quem decide é a primeira bola da tacada seguinte. Sem dizer isso na
      // hora, parece que o jogo ignorou a bola que acabou de cair.
      if (wasBreak) {
        S.message = 'Saída boa. A mesa segue aberta.';
        showBanner('MESA ABERTA · o grupo sai na próxima encaçapada', 3.2);
      } else {
        S.message = 'Encaçapou e segue na mesa.';
        showBanner(playerName(shooter) + ' segue na mesa', 1.6);
      }
    } else {
      S.ballInHand = false;
      S.turn = 1 - shooter;
      if (wasBreak && log.pocketed.length) {
        S.message = 'A mesa segue aberta depois da saída.';
        showBanner('MESA ABERTA · o grupo sai na próxima encaçapada', 3.2);
      } else {
        S.message = log.pocketed.length ? 'Bola do adversário caiu.' : 'Vez do outro jogador.';
      }
    }
    shotLog = null;
    aim.power = 0.55;
    beginTurn();
    if (net) { net.revision++; broadcast(); }
  }

  function finishMatch(reason) {
    const win = S.winner;
    endReason = reason;
    if (net) {
      if (net.role === 'host') { net.wins[win]++; net.revision++; net.ready = [false, false]; }
      networkOverlay();
      hudDirty = true;
      broadcast();
      return;
    }
    const key = `record-${settings.mode}`;
    const record = store.get(key, { wins: 0, losses: 0 });
    if (MODES[settings.mode].ai) {
      if (win === 0) record.wins++; else record.losses++;
      store.set(key, record);
    } else {
      saveDuelWin(win);
    }
    const duel = duelRecord();
    audio.tone({ freq: win === 0 ? 760 : 180, dur: 0.28, type: 'sine', vol: 0.06 });
    haptics.buzz(win === 0 ? [14, 40, 22] : [30, 60, 30]);
    present({
      tag: reason,
      title: MODES[settings.mode].ai
        ? (win === 0 ? 'Você venceu!' : 'A máquina levou.')
        : `${escapeHtml(playerName(win))} venceu!`,
      text: `${S.shots} tacadas nesta partida.` +
            (MODES[settings.mode].ai
              ? ` Placar: ${record.wins} a ${record.losses}.`
              : ` ${settings.names[0]} ${duel.wins[0]} × ${duel.wins[1]} ${settings.names[1]}.`),
      action: 'Nova partida'
    });
    hudDirty = true;
  }

  // ------------------------------------------------------------------ mira
  function computeGuide() {
    const cue = S.balls[0];
    const hit = firstBlocker(cue, aim.angle, S.balls);
    const dist = hit ? hit.t : railHit(cue, aim.angle);
    const gx = cue.x + Math.cos(aim.angle) * dist;
    const gy = cue.y + Math.sin(aim.angle) * dist;
    let target = null;
    if (hit && settings.guide) {
      const nx = hit.ball.x - gx, ny = hit.ball.y - gy;
      const len = Math.hypot(nx, ny) || 1;
      target = { x: hit.ball.x, y: hit.ball.y, dx: nx / len, dy: ny / len };
    }
    return { x: gx, y: gy, target };
  }

  const powerBar = () => {
    const top = PANEL.y + 36;
    const height = PANEL.h - 82;
    return { top, height, bottom: top + height };
  };

  function applyPointer() {
    const px = input.state.x, py = input.state.y;
    if (dragMode === 'power') {
      const bar = powerBar();
      aim.power = Math.max(0, Math.min(1, (bar.bottom - py) / bar.height));
      hudDirty = true;
    } else if (dragMode === 'aim') {
      const cue = S.balls[0];
      const dx = px - cue.x, dy = py - cue.y;
      if (Math.hypot(dx, dy) > 6) aim.angle = Math.atan2(dy, dx);
    } else if (dragMode === 'place') {
      const spot = { x: px, y: py };
      ghostCue = { ...spot, valid: isFreeSpot(spot.x, spot.y, S.balls, 0) };
    }
  }

  function handleInput(dt) {
    if (!canControl()) return;
    if (input.state.pointerActive && dragMode) applyPointer();

    // Teclado: setas laterais giram a mira, verticais ajustam a força.
    const axis = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0);
    if (axis && S.flow === 'aiming') aim.angle += axis * SHOT.aimStep * Math.PI / 180 * (dt * 60);
  }

  function confirmPlacement(remote = false) {
    if (S.flow !== 'placing') return;
    if (net && !remote) {
      if (!canControl()) return;
      if (net.role === 'guest') {
        if (ghostCue?.valid) sendCommand('place', { point: { x: ghostCue.x, y: ghostCue.y } });
        return;
      }
    }
    if (!ghostCue || !ghostCue.valid) { showBanner('Ponto ocupado', 1.2); return; }
    const cue = S.balls[0];
    cue.active = true;
    cue.x = ghostCue.x; cue.y = ghostCue.y; cue.vx = cue.vy = 0;
    S.ballInHand = false;
    ghostCue = null;
    S.flow = 'aiming';
    pointAtSomething();
    audio.tone({ freq: 520, dur: 0.07, type: 'sine', vol: 0.04 });
    hudDirty = true;
    if (net) { net.revision++; broadcast(); }
  }

  input.on('press', p => {
    if (isPortrait() || hud.dialogOpen || !canControl()) return;
    if (S.flow === 'placing') { dragMode = 'place'; applyPointer(); return; }
    if (S.flow !== 'aiming') return;
    if (p.x >= PANEL.x - 10) { dragMode = 'power'; charging = true; }
    else dragMode = 'aim';
    applyPointer();
  });

  input.on('release', () => {
    if (!canControl() || hud.dialogOpen || isPortrait()) { dragMode = null; charging = false; return; }
    if (dragMode === 'power') {
      charging = false;
      if (aim.power > 0.05) shoot(aim.power);
    } else if (dragMode === 'place') {
      confirmPlacement();
    }
    dragMode = null;
  });

  const lifecycle = new AbortController();
  window.addEventListener('keydown', event => {
    if (hud.dialogOpen || isPortrait()) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (canControl() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      aim.power = Math.max(0, Math.min(1, aim.power + (event.key === 'ArrowUp' ? 1 : -1) * SHOT.powerStep));
      hudDirty = true;
    }
    if (event.code === 'Space' && tag !== 'BUTTON') {
      event.preventDefault();
      if (S.flow === 'aiming') shoot(aim.power);
      else if (S.flow === 'placing') confirmPlacement();
      else if (S.flow === 'intro' || S.flow === 'over') primaryAction();
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      event.preventDefault();
      S.flow === 'paused' ? resume() : pause();
    }
  }, { signal: lifecycle.signal });

  // ------------------------------------------------------------------ ciclo
  function update(dt) {
    if (net && (!net.started || !net.connected)) return;
    if (net?.role === 'guest') {
      if (!isPortrait() && !hud.dialogOpen && ['aiming', 'placing'].includes(S.flow)) handleInput(dt);
      return;
    }
    if (isPortrait() || S.flow === 'intro' || S.flow === 'over' || S.flow === 'paused') return;
    if (bannerTime > 0) { bannerTime -= dt; if (bannerTime <= 0) banner = ''; }

    if (S.flow === 'rolling') {
      // Dois subpassos: o TOI resolve a ordem dos choques, os subpassos
      // mantêm o atrito estável numa tacada de saída muito forte.
      step(S.balls, dt / 2, shotEvents);
      step(S.balls, dt / 2, shotEvents);
      if (anyMoving(S.balls)) settle = 0;
      else { settle += dt; if (settle >= SHOT.settleTime) endShot(); }
      return;
    }
    if (S.flow === 'think') {
      thinkTimer -= dt;
      if (thinkTimer <= 0) shoot(aim.power);
      return;
    }
    handleInput(dt);
  }

  function render(dt, alpha) {
    syncOrientation();
    networkTick(dt);
    const portrait = isPortrait();
    const showAim = !portrait && (S.flow === 'aiming' || S.flow === 'think') && S.balls[0].active;
    renderer.draw(S, {
      portrait, aim, charging,
      aiming: showAim,
      canShoot: showAim && canControl(),
      guide: showAim ? computeGuide() : null,
      ghostCue: S.flow === 'placing' ? ghostCue : null,
      hideCue: S.flow === 'placing',
      banner: banner || null,
      stats: loopStats
    });
    hud.tickToast(dt);
    syncHud(dt);
    hud.flush();
  }

  // -------------------------------------------------------------------- HUD
  let hudTimer = 0;
  function syncHud(dt) {
    hudTimer += dt;
    if (!hudDirty && hudTimer < 0.12) return;
    hudTimer = 0;
    hudDirty = false;

    const group = S.groups[S.turn];
    const cleared = group && remainingOf(S.balls, group) === 0;
    hud.setStat('turn', escapeHtml(playerName(S.turn)));
    hud.setStat('group', group ? GROUP_LABEL[group] : 'Aberta',
      group ? `Seu grupo: ${GROUP_LABEL[group]}` : 'Mesa aberta: o grupo sai na primeira bola encaçapada');
    hud.setStat('left', cleared ? 'Bola 8' : group ? String(remainingOf(S.balls, group)) : '—',
      cleared ? 'Só falta a bola 8' : undefined);

    const chips = [{ text: `Força ${Math.round(aim.power * 100)}%`, tone: charging ? 'accent' : '' }];
    chips.push({ text: `${S.shots} tacada${S.shots === 1 ? '' : 's'}` });
    if (!MODES[settings.mode].ai) {
      const d = net || duelRecord();
      chips.push({ text: `Placar ${d.wins[0]}×${d.wins[1]}`, tone: 'accent' });
    }
    if (S.ballInHand) chips.push({ text: 'Bola na mão', tone: 'warn' });
    if (net) chips.push({ text: !net.connected ? 'Conectando / pausado' :
      S.turn === mySeat() ? 'Sua vez' : 'Vez do adversário', tone: 'accent' });
    chips.push({ text: escapeHtml(S.message || MODES[settings.mode].label), tone: 'flow' });
    hud.setChips(chips, `Vez de ${playerName(S.turn)}. ${S.message}`);
    hud.setPause(S.flow === 'paused', S.flow !== 'intro' && S.flow !== 'over' && (!net || net.connected));
  }

  // ------------------------------------------------------------- interface
  function primaryAction() {
    if (hud.dialogOpen || isPortrait()) return;
    if (net) {
      if (!net.started || !net.connected) { openLan(); return; }
      if (S.flow === 'over') { networkReady('rematch'); return; }
    }
    if (S.flow === 'intro' || S.flow === 'over') { newMatch(); return; }
    if (S.flow === 'paused') resume();
  }

  let pausedFrom = null;
  function pause(remote = false) {
    if (net) {
      if (!net.started || S.flow === 'intro') return;
      if (net.role === 'guest') { if (!remote) sendCommand('pause'); return; }
      net.ready = [false, false];
      if (S.flow === 'over') { broadcast(); networkOverlay(); return; }
      if (S.flow === 'paused') { broadcast(); networkOverlay(); return; }
    }
    if (['intro', 'over', 'paused'].includes(S.flow)) return;
    pausedFrom = S.flow;
    S.flow = 'paused';
    dragMode = null;
    charging = false;
    input.reset();
    present({
      tag: 'No seu tempo', title: 'Partida pausada',
      text: 'A mesa fica exatamente como está. Continue quando quiser.',
      action: 'Continuar', note: `Vez de ${playerName(S.turn)}`,
      secondary: 'Nova partida'
    });
    hudDirty = true;
    if (net) { net.revision++; networkOverlay(); broadcast(); }
  }

  function resume() {
    if (S.flow !== 'paused' || hud.dialogOpen) return;
    if (net) { networkReady('resume'); return; }
    S.flow = pausedFrom || 'aiming';
    pausedFrom = null;
    audio.resume();
    dismiss();
    hudDirty = true;
  }

  function openSettings() {
    if (net) { pause(); openLan(); return; }
    const wasPlaying = !['intro', 'over', 'paused'].includes(S.flow);
    if (wasPlaying) pause();
    const node = buildDialog({
      settings, theme, audio, haptics,
      records: { cpu: store.get('record-cpu', { wins: 0, losses: 0 }) },
      duel: duelRecord(),
      onNames: (index, value) => {
        settings.names[index] = cleanName(value, index);
        store.set('names', settings.names);
        hudDirty = true;
        return settings.names[index];
      },
      onClearDuel: clearDuel,
      duelFor: names => {
        const history = store.get('duels', {});
        return history[names.map(n => n.toLowerCase()).join(' \u00d7 ')] || { wins: [0, 0] };
      },
      onMode: value => {
        settings.mode = value; store.set('mode', value); hudDirty = true;
        hud.toast('O modo vale a partir da próxima partida', { priority: 2 });
      },
      onLevel: value => { settings.level = value; store.set('level', value); },
      onGuide: value => { settings.guide = value; store.set('guide', value); },
      onNetwork: () => openLan()
    });
    hud.setDialogContent(node, 'Ajustes & regras');
    hud.openDialog();
  }

  // ------------------------------------------------------ multiplayer LAN
  // O anfitrião simula. O convidado só aplica snapshots e envia comandos com
  // partida/revisão/seq: uma tacada repetida ou de uma vez anterior é rejeitada.
  function broadcast() {
    if (!net?.started || net.role !== 'host' || !net.connected) return;
    net.transport.send({ type: 'state', seq: ++net.outSeq, ack: net.lastCommand,
      match: net.match, revision: net.revision, state: S, aim, ghost: ghostCue,
      names: settings.names, wins: net.wins, ready: net.ready, reason: endReason });
  }

  function sendCommand(action, data = {}, preview = false) {
    if (!net?.connected || net.role !== 'guest' || !net.started || (!preview && net.pending && action !== 'pause')) return;
    const seq = ++net.outSeq;
    if (net.transport.send({ type: 'command', action, ...data, seq, match: net.match, revision: net.revision })) {
      if (!preview) { net.pending = seq; dragMode = null; charging = false; }
    } else if (!preview) showBanner('Aguardando a conexão', 1.5);
  }

  function networkOverlay() {
    if (!net) return;
    if (!net.connected) {
      present({ tag: 'Multiplayer · mesma rede', title: 'Conexão interrompida',
        text: net.message || 'Aguardando o outro aparelho.', action: 'Ver conexão' });
    } else if (S.flow === 'paused') {
      present({ tag: 'Pausa nos dois aparelhos', title: 'Partida pausada',
        text: 'Os dois jogadores precisam tocar em Continuar. Mantenham o jogo aberto na horizontal.',
        action: net.ready[mySeat()] ? 'Aguardando o outro jogador' : 'Continuar',
        note: `Você: ${settings.names[mySeat()]} · ${net.ready.filter(Boolean).length}/2 prontos` });
    } else if (S.flow === 'over') {
      present({ tag: endReason, title: `${escapeHtml(playerName(S.winner))} venceu!`,
        text: `${S.shots} tacadas. ${settings.names[0]} ${net.wins[0]} × ${net.wins[1]} ${settings.names[1]}.`,
        action: net.ready[mySeat()] ? 'Aguardando o outro jogador' : 'Jogar revanche',
        note: 'A revanche começa quando os dois confirmarem.' });
    } else dismiss();
  }

  function networkReady(action, actor = mySeat()) {
    if (!net?.connected || !net.started) return;
    if ((action === 'resume' && S.flow !== 'paused') || (action === 'rematch' && S.flow !== 'over')) return;
    if (actor === mySeat() && (isPortrait() || document.hidden || hud.dialogOpen)) return;
    if (net.role === 'guest') { sendCommand(action); return; }
    net.ready[actor] = true;
    if (net.ready.every(Boolean)) {
      if (isPortrait() || document.hidden || hud.dialogOpen) {
        net.ready[0] = false; networkOverlay(); broadcast(); return;
      }
      if (action === 'rematch') newMatch();
      else {
        S.flow = pausedFrom || 'aiming'; pausedFrom = null;
        net.ready = [false, false]; net.revision++;
        audio.resume(); dismiss();
      }
    }
    networkOverlay(); broadcast(); hudDirty = true;
  }

  function receiveNetwork(packet) {
    if (!net || !packet || typeof packet !== 'object') return;
    if (packet.type === 'hello' && net.role === 'host' && typeof packet.name === 'string' && packet.name.length <= 12) {
      if (!net.started) {
        settings.names = [net.name, cleanName(packet.name, 1)];
        net.started = true;
        hud.closeDialog();
        newMatch();
      } else broadcast();
      return;
    }
    if (packet.type === 'state' && net.role === 'guest') {
      if (!validSnapshot(packet) || packet.seq <= net.lastSnapshot || packet.match < net.match) return;
      const first = !net.started;
      const preserveAim = !first && canControl() && packet.state.turn === S.turn &&
        packet.state.flow === S.flow && packet.revision === net.revision;
      net.lastSnapshot = packet.seq; net.match = packet.match; net.revision = packet.revision;
      if (packet.ack >= net.pending) net.pending = 0;
      net.ready = packet.ready; net.wins = packet.wins;
      settings.names = packet.names.map(cleanName);
      const changedFlow = S.flow !== packet.state.flow || S.turn !== packet.state.turn;
      Object.assign(S, packet.state);
      if (!preserveAim) {
        Object.assign(aim, packet.aim); ghostCue = packet.ghost;
        dragMode = null; charging = false;
      }
      endReason = packet.reason;
      net.started = true;
      if (first) hud.closeDialog();
      if (changedFlow || first || ['paused', 'over'].includes(S.flow)) networkOverlay();
      // requestAnimationFrame para em segundo plano. A pausa precisa sair
      // também pelo recebimento, inclusive ao conectar enquanto o app está oculto.
      if ((document.hidden || isPortrait()) && !['paused', 'over'].includes(S.flow)) pause();
      hudDirty = true;
      return;
    }
    if (packet.type !== 'command' || net.role !== 'host' || !net.started || !validCommand(packet)) return;
    if (packet.seq <= net.lastCommand) return;
    net.lastCommand = packet.seq;
    if (packet.match !== net.match) { broadcast(); return; }
    if (packet.action === 'pause') pause(true);
    else if (packet.action === 'resume' || packet.action === 'rematch') networkReady(packet.action, 1);
    else if (packet.revision === net.revision && S.turn === 1 && net.connected) {
      if ((packet.action === 'shoot' || packet.action === 'aim') && S.flow === 'aiming') {
        Object.assign(aim, packet.aim);
        if (packet.action === 'shoot') shoot(aim.power, true);
      } else if ((packet.action === 'place' || packet.action === 'ghost') && S.flow === 'placing') {
        ghostCue = { ...packet.point, valid: isFreeSpot(packet.point.x, packet.point.y, S.balls, 0) };
        if (packet.action === 'place' && ghostCue.valid) confirmPlacement(true);
      }
    }
    broadcast();
  }

  function startNetwork(role) {
    net?.transport.close();
    if (!offlineSettings) offlineSettings = { mode: settings.mode, names: [...settings.names] };
    settings.mode = 'lan';
    S.flow = 'intro'; dragMode = null; charging = false; input.reset();
    net = { role, name: cleanName(store.get('lan-name', settings.names[0])), connected: false,
      started: false, match: 0, revision: 0, outSeq: 0, lastCommand: 0, lastSnapshot: 0,
      pending: 0, ready: [false, false], wins: [0, 0], message: '' };
    const session = net;
    session.transport = new LanTransport({
      onStatus: (status, message) => {
        if (net !== session) return;
        net.connected = status === 'connected'; net.message = message;
        lobby?.update(status, message);
        if (net.started) {
          if (!net.connected && net.role === 'host') pause(true);
          if (net.connected) { net.pending = 0; broadcast(); }
          networkOverlay();
        }
        hudDirty = true;
      },
      onOpen: () => {
        session.transport.send({ type: 'hello', name: session.name });
        // Falha explícita se o outro aparelho carrega um protocolo incompatível.
        session.transport.later(() => {
          if (!session.started) session.transport.fail('A partida não iniciou. Atualize o jogo nos dois aparelhos e crie outra sala.');
        }, 15000);
      },
      onMessage: receiveNetwork
    });
    return session.transport;
  }

  function leaveNetwork() {
    net?.transport.close();
    net = null; lobby = null; networkTime = 0;
    if (offlineSettings) { Object.assign(settings, offlineSettings); offlineSettings = null; }
    S.flow = 'intro'; S.winner = null; S.message = ''; S.shots = 0;
    S.groups = { 0: null, 1: null }; S.turn = 0; S.ballInHand = false;
    S.balls = createRack(rng.next); ghostCue = null; pausedFrom = null;
    dragMode = null; charging = false; input.reset(); hud.closeDialog();
    showIntro(); hudDirty = true;
  }

  function openLan(invite = '') {
    if (!net && !['intro', 'over', 'paused'].includes(S.flow)) pause();
    if (!lobby) lobby = createLanLobby({
      name: cleanName(store.get('lan-name', settings.names[0])),
      onName: value => { const name = cleanName(value); store.set('lan-name', name); return name; },
      onCreate: async () => {
        const transport = startNetwork('host');
        try { return await transport.createOffer(); }
        catch (error) { transport.fail(error.message); throw error; }
      },
      onJoin: async token => {
        decodeSignal(token, 'offer');
        const transport = startNetwork('guest');
        try { return await transport.acceptOffer(token); }
        catch (error) { transport.fail(error.message); throw error; }
      },
      onAnswer: token => {
        if (net?.role !== 'host') throw new Error('Crie uma sala primeiro.');
        return net.transport.acceptAnswer(token);
      },
      onLeave: leaveNetwork,
      onBack: () => hud.closeDialog()
    });
    hud.setDialogContent(lobby.root, 'Multiplayer · mesma rede');
    hud.openDialog();
    if (invite) lobby.showJoin(invite);
  }

  function networkTick(dt) {
    if (!net?.connected || !net.started) return;
    if ((isPortrait() || document.hidden) && (!['paused', 'over'].includes(S.flow) || net.ready[mySeat()])) pause();
    networkTime += dt;
    if (networkTime < 1 / 30) return;
    networkTime = 0;
    if (net.role === 'host') broadcast();
    else if (canControl() && !hud.dialogOpen && !isPortrait()) {
      if (S.flow === 'aiming') sendCommand('aim', { aim: { ...aim } }, true);
      else if (S.flow === 'placing' && ghostCue) sendCommand('ghost', { point: { x: ghostCue.x, y: ghostCue.y } }, true);
    }
  }

  const networkButton = document.createElement('button');
  networkButton.className = 'link-button';
  networkButton.textContent = 'Jogar na mesma rede';
  networkButton.id = 'poolNetwork';
  networkButton.addEventListener('click', () => { if (net) pause(); openLan(); });
  hud.el.hint.after(networkButton);
  window.addEventListener('pagehide', () => net?.transport.close(), { signal: lifecycle.signal });

  function resize() { renderer.invalidate(); hudDirty = true; }

  // Monta uma mesa só para a tela inicial ter o que mostrar atrás do overlay.
  S.balls = createRack(rng.next);
  hud.setHint('Mire no pano · <strong>arraste a barra</strong> para tacar');
  function showIntro() { present({
    tag: 'Sinuca 8-ball', title: 'Lisas ou listradas.<br>Decida na mesa.',
    text: 'Arraste no pano para mirar e puxe a barra de força para tacar. Melhor na horizontal.',
    action: 'Começar partida',
    note: `${MODES[settings.mode].label} · regras completas de 8-ball`,
    secondary: 'Jogar na mesma rede'
  }); }
  showIntro();
  const invite = new URLSearchParams(location.hash.slice(1)).get('pool');
  if (invite) {
    history.replaceState(null, '', location.pathname + location.search);
    openLan(invite);
  }

  return {
    meta, update, render, resize,
    primaryAction, pause, resume, openSettings,
    secondaryAction: () => { if (S.flow === 'intro') openLan(); else if (S.flow === 'paused' && !net) newMatch(); },
    pauseToggle: () => (S.flow === 'paused' ? resume() : pause()),
    onHidden: pause,
    onThemeChange: () => renderer.invalidate(),
    getState: () => ({
      state: S.flow, stage: S.stage, mode: settings.mode, level: settings.level,
      turn: playerName(S.turn), groups: { ...S.groups }, ballInHand: S.ballInHand,
      shots: S.shots, winner: S.winner === null ? null : playerName(S.winner),
      balls: S.balls.filter(b => b.active).length,
      network: net ? { role: net.role, connected: net.connected, started: net.started,
        match: net.match, revision: net.revision, ready: [...net.ready], wins: [...net.wins], pending: !!net.pending } : null
    }),
    inspect: () => ({ S, aim, settings }),
    destroy: () => { net?.transport.close(); lifecycle.abort(); networkButton.remove(); input.destroy(); app.classList.remove('pool-app'); }
  };
}
