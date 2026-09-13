import { createRng } from '../../core/rng.js';
import { TABLE, SHOT, PANEL, AI, logicalSize } from './config.js';
import { createRack, evaluateShot, remainingOf, GROUP_LABEL } from './rules.js';
import { step, anyMoving } from './physics.js';
import { chooseShot, firstBlocker, railHit } from './ai.js';
import { nearestFreeSpot, isFreeSpot } from './table.js';
import { createRenderer } from './render.js';
import { buildDialog } from './ui.js';

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
  local: { label: 'Dois jogadores', ai: false }
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

  const settings = {
    mode: store.get('mode', 'cpu'),
    level: store.get('level', 'medio'),
    guide: store.get('guide', true)
  };

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
  const playerName = i => MODES[settings.mode].ai
    ? (i === 0 ? 'Você' : 'Máquina')
    : `Jogador ${i + 1}`;

  // ----------------------------------------------------------------- partida
  function newMatch() {
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
  function shoot(power) {
    if (S.flow !== 'aiming' && S.flow !== 'think') return;
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
      S.message = 'Encaçapou e segue na mesa.';
      S.ballInHand = false;
      showBanner(playerName(shooter) + ' segue na mesa', 1.6);
    } else {
      S.ballInHand = false;
      S.turn = 1 - shooter;
      S.message = log.pocketed.length ? 'Bola do adversário caiu.' : 'Vez do outro jogador.';
    }
    shotLog = null;
    aim.power = 0.55;
    beginTurn();
  }

  function finishMatch(reason) {
    const win = S.winner;
    const key = `record-${settings.mode}`;
    const record = store.get(key, { wins: 0, losses: 0 });
    if (MODES[settings.mode].ai) {
      if (win === 0) record.wins++; else record.losses++;
      store.set(key, record);
    }
    audio.tone({ freq: win === 0 ? 760 : 180, dur: 0.28, type: 'sine', vol: 0.06 });
    haptics.buzz(win === 0 ? [14, 40, 22] : [30, 60, 30]);
    present({
      tag: reason,
      title: MODES[settings.mode].ai
        ? (win === 0 ? 'Você venceu!' : 'A máquina levou.')
        : `${playerName(win)} venceu!`,
      text: `${S.shots} tacadas nesta partida.` +
            (MODES[settings.mode].ai ? ` Placar: ${record.wins} a ${record.losses}.` : ''),
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
    if (input.state.pointerActive && dragMode) applyPointer();

    // Teclado: setas laterais giram a mira, verticais ajustam a força.
    const axis = (input.keys.right ? 1 : 0) - (input.keys.left ? 1 : 0);
    if (axis && S.flow === 'aiming') aim.angle += axis * SHOT.aimStep * Math.PI / 180 * (dt * 60);
  }

  function confirmPlacement() {
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
  }

  input.on('press', p => {
    if (isPortrait() || hud.dialogOpen) return;
    if (S.flow === 'placing') { dragMode = 'place'; applyPointer(); return; }
    if (S.flow !== 'aiming') return;
    if (p.x >= PANEL.x - 10) { dragMode = 'power'; charging = true; }
    else dragMode = 'aim';
    applyPointer();
  });

  input.on('release', () => {
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
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
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
    const portrait = isPortrait();
    const showAim = !portrait && (S.flow === 'aiming' || S.flow === 'think') && S.balls[0].active;
    renderer.draw(S, {
      portrait, aim, charging,
      aiming: showAim,
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
    hud.setStat('turn', playerName(S.turn));
    hud.setStat('group', group ? GROUP_LABEL[group] : 'Aberta');
    hud.setStat('left', cleared ? 'Bola 8' : group ? String(remainingOf(S.balls, group)) : '—',
      cleared ? 'Só falta a bola 8' : undefined);

    const chips = [{ text: `Força ${Math.round(aim.power * 100)}%`, tone: charging ? 'accent' : '' }];
    chips.push({ text: `${S.shots} tacada${S.shots === 1 ? '' : 's'}` });
    if (S.ballInHand) chips.push({ text: 'Bola na mão', tone: 'warn' });
    chips.push({ text: S.message || MODES[settings.mode].label, tone: 'flow' });
    hud.setChips(chips, `Vez de ${playerName(S.turn)}. ${S.message}`);
    hud.setPause(S.flow === 'paused', S.flow !== 'intro' && S.flow !== 'over');
  }

  // ------------------------------------------------------------- interface
  function primaryAction() {
    if (hud.dialogOpen || isPortrait()) return;
    if (S.flow === 'intro' || S.flow === 'over') { newMatch(); return; }
    if (S.flow === 'paused') resume();
  }

  let pausedFrom = null;
  function pause() {
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
  }

  function resume() {
    if (S.flow !== 'paused' || hud.dialogOpen) return;
    S.flow = pausedFrom || 'aiming';
    pausedFrom = null;
    audio.resume();
    dismiss();
    hudDirty = true;
  }

  function openSettings() {
    const wasPlaying = !['intro', 'over', 'paused'].includes(S.flow);
    if (wasPlaying) pause();
    const node = buildDialog({
      settings, theme, audio, haptics,
      records: {
        cpu: store.get('record-cpu', { wins: 0, losses: 0 }),
        local: store.get('record-local', { wins: 0, losses: 0 })
      },
      onMode: value => {
        settings.mode = value; store.set('mode', value); hudDirty = true;
        hud.toast('O modo vale a partir da próxima partida', { priority: 2 });
      },
      onLevel: value => { settings.level = value; store.set('level', value); },
      onGuide: value => { settings.guide = value; store.set('guide', value); }
    });
    hud.setDialogContent(node, 'Ajustes & regras');
    hud.openDialog();
  }

  function resize() { renderer.invalidate(); hudDirty = true; }

  // Monta uma mesa só para a tela inicial ter o que mostrar atrás do overlay.
  S.balls = createRack(rng.next);
  hud.setHint('Mire no pano · <strong>arraste a barra</strong> para tacar');
  present({
    tag: 'Sinuca 8-ball', title: 'Lisas ou listradas.<br>Decida na mesa.',
    text: 'Arraste no pano para mirar e puxe a barra de força para tacar. Melhor na horizontal.',
    action: 'Começar partida',
    note: `${MODES[settings.mode].label} · regras completas de 8-ball`
  });

  return {
    meta, update, render, resize,
    primaryAction, pause, resume, openSettings,
    secondaryAction: () => { if (S.flow === 'paused') newMatch(); },
    pauseToggle: () => (S.flow === 'paused' ? resume() : pause()),
    onHidden: pause,
    onThemeChange: () => renderer.invalidate(),
    getState: () => ({
      state: S.flow, stage: S.stage, mode: settings.mode, level: settings.level,
      turn: playerName(S.turn), groups: { ...S.groups }, ballInHand: S.ballInHand,
      shots: S.shots, winner: S.winner === null ? null : playerName(S.winner),
      balls: S.balls.filter(b => b.active).length
    }),
    inspect: () => ({ S, aim, settings }),
    destroy: () => { lifecycle.abort(); input.destroy(); app.classList.remove('pool-app'); }
  };
}
