import { BALL, SHOT, AI, TABLE, POCKETS } from './config.js';
import { remainingOf } from './rules.js';

// Distância de um centro de bola ao segmento percorrido — é assim que se
// descobre se o caminho está limpo.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function pathClear(ax, ay, bx, by, balls, ignore) {
  const need = BALL.r * 2 * AI.clearance;
  for (const b of balls) {
    if (!b.active || ignore.includes(b.id)) continue;
    if (distToSegment(b.x, b.y, ax, ay, bx, by) < need) return false;
  }
  return true;
}

function legalTargets(state) {
  const group = state.groups[state.turn];
  const live = state.balls.filter(b => b.active && b.number !== 0);
  if (!group) return live.filter(b => b.number !== 8);
  if (remainingOf(state.balls, group) === 0) return live.filter(b => b.number === 8);
  return live.filter(b => b.group === group);
}

// Avalia cada par (bola, caçapa) e devolve a melhor tacada encontrada.
function bestPot(state) {
  const cue = state.balls[0];
  const targets = legalTargets(state);
  let best = null;

  for (const ball of targets) {
    for (const pocket of POCKETS) {
      const toPocket = Math.hypot(pocket.x - ball.x, pocket.y - ball.y);
      if (toPocket < 1) continue;
      const px = (pocket.x - ball.x) / toPocket, py = (pocket.y - ball.y) / toPocket;
      // Bola fantasma: onde a branca precisa estar no instante do contato.
      const gx = ball.x - px * BALL.r * 2, gy = ball.y - py * BALL.r * 2;
      const toGhost = Math.hypot(gx - cue.x, gy - cue.y);
      if (toGhost < 1) continue;
      const ax = (gx - cue.x) / toGhost, ay = (gy - cue.y) / toGhost;

      const cut = Math.acos(Math.max(-1, Math.min(1, ax * px + ay * py))) * 180 / Math.PI;
      if (cut > AI.maxCutDeg) continue;
      if (!pathClear(cue.x, cue.y, gx, gy, state.balls, [0, ball.id])) continue;
      if (!pathClear(ball.x, ball.y, pocket.x, pocket.y, state.balls, [0, ball.id])) continue;

      // Quanto mais reto e mais perto, melhor. Caçapa de canto vale um pouco
      // mais que a do meio por ter boca efetiva maior no ângulo certo.
      const score = 1000 - cut * 7 - toPocket * 0.55 - toGhost * 0.3 + (pocket.corner ? 18 : 0);
      if (!best || score > best.score) {
        best = { score, ball, pocket, angle: Math.atan2(ay, ax), toGhost, toPocket, cut };
      }
    }
  }
  return best;
}

// Sem tacada boa: empurra a branca contra a bola legal mais distante, devagar,
// para deixar o adversário longe.
// Sem tacada boa: empurra a branca contra a bola legal mais distante. O ângulo
// e a força variam de propósito — repetir a mesma defesa deixaria os dois lados
// trocando tacadas idênticas para sempre quando só resta a 8 encoberta.
function safety(state, rng) {
  const cue = state.balls[0];
  const targets = legalTargets(state);
  if (!targets.length) return null;
  let pick = targets[0], far = -1;
  for (const b of targets) {
    const d = Math.hypot(b.x - cue.x, b.y - cue.y);
    if (d > far) { far = d; pick = b; }
  }
  const base = Math.atan2(pick.y - cue.y, pick.x - cue.x);
  return {
    angle: base + (rng() * 2 - 1) * 0.16,
    power: 0.3 + rng() * 0.38,
    safety: true
  };
}

export function chooseShot(state, levelKey, rng) {
  const level = AI.levels[levelKey] || AI.levels.medio;
  const pot = bestPot(state);
  let shot;

  if (!pot || rng() < level.safetyChance * (pot.cut > 45 ? 1.6 : 1)) {
    shot = safety(state, rng) || (pot && { angle: pot.angle, power: 0.5 });
  } else {
    // Força proporcional ao percurso, com folga para o corte.
    const travel = pot.toGhost + pot.toPocket;
    const power = Math.min(0.95, 0.3 + travel / 1500 + pot.cut / 260);
    shot = { angle: pot.angle, power };
  }
  if (!shot) return null;

  const err = (rng() * 2 - 1) * level.errorDeg * Math.PI / 180;
  const powerErr = (rng() * 2 - 1) * level.powerError;
  return {
    angle: shot.angle + err,
    power: Math.max(0.16, Math.min(1, shot.power + powerErr)),
    plan: pot ? { ball: pot.ball.number, pocket: pot.pocket } : null
  };
}

// Usado pela mira do jogador: até onde a branca vai em linha reta antes de
// encostar em alguma bola.
export function firstBlocker(cue, angle, balls) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null;
  for (const b of balls) {
    if (!b.active || b.id === 0) continue;
    const ox = b.x - cue.x, oy = b.y - cue.y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) continue;
    const perp = Math.abs(ox * dy - oy * dx);
    const R = BALL.r * 2;
    if (perp > R) continue;
    const back = Math.sqrt(R * R - perp * perp);
    const t = proj - back;
    if (t < 0) continue;
    if (!best || t < best.t) best = { t, ball: b };
  }
  return best;
}

// Onde a branca para se não houver obstáculo: contra a tabela.
export function railHit(cue, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (TABLE.right - BALL.r - cue.x) / dx);
  if (dx < 0) t = Math.min(t, (TABLE.left + BALL.r - cue.x) / dx);
  if (dy > 0) t = Math.min(t, (TABLE.bottom - BALL.r - cue.y) / dy);
  if (dy < 0) t = Math.min(t, (TABLE.top + BALL.r - cue.y) / dy);
  return Number.isFinite(t) ? Math.max(0, t) : SHOT.guideLength;
}
