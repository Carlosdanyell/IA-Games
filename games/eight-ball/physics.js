import { BALL, TABLE, POCKETS } from './config.js';
import { CUSHIONS } from './table.js';

// Simulação por tempo de impacto (TOI).
//
// Numa tacada forte a branca anda mais que um raio por passo; testar
// sobreposição depois de mover erraria a ordem dos choques e devolveria
// ângulos errados. Aqui, a cada trecho, procuramos o PRIMEIRO contato no
// tempo — bola contra bola, bola contra tabela, bola contra bico — e só então
// avançamos até ele.
const EPS = 1e-7;

function ballPairTime(a, b, limit) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
  const R = a.r + b.r;
  const c = dx * dx + dy * dy - R * R;
  if (c < 0) return dx * dvx + dy * dvy < 0 ? 0 : null;   // já sobrepostas e se aproximando
  const A = dvx * dvx + dvy * dvy;
  if (A < EPS) return null;
  const B = 2 * (dx * dvx + dy * dvy);
  if (B >= 0) return null;                                 // afastando-se
  const disc = B * B - 4 * A * c;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= limit ? t : null;
}

function railTime(ball, rail, limit) {
  const along = rail.axis === 'y' ? 'x' : 'y';
  const across = rail.axis === 'y' ? 'y' : 'x';
  const v = rail.axis === 'y' ? ball.vy : ball.vx;
  const n = rail.axis === 'y' ? rail.ny : rail.nx;
  if (v * n >= 0) return null;                             // movendo-se para longe
  const target = rail.at + n * ball.r;
  const t = (target - ball[across]) / v;
  if (t < 0 || t > limit) return null;
  const pos = ball[along] + (rail.axis === 'y' ? ball.vx : ball.vy) * t;
  if (pos < rail.from || pos > rail.to) return null;       // passou pelo vão da caçapa
  return t;
}

function pointTime(ball, point, limit) {
  const dx = point.x - ball.x, dy = point.y - ball.y;
  const A = ball.vx * ball.vx + ball.vy * ball.vy;
  if (A < EPS) return null;
  const B = -2 * (dx * ball.vx + dy * ball.vy);
  if (B >= 0) return null;
  const c = dx * dx + dy * dy - ball.r * ball.r;
  const disc = B * B - 4 * A * c;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= limit ? t : null;
}

function resolveBalls(a, b, events) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const sep = rvx * nx + rvy * ny;
  if (sep > 0) return;
  // Massas iguais: troca-se a componente normal, com restituição.
  const impulse = -(1 + BALL.restitution) * sep / 2;
  a.vx -= impulse * nx; a.vy -= impulse * ny;
  b.vx += impulse * nx; b.vy += impulse * ny;
  events.onBallHit?.(a, b, Math.abs(sep));
}

function resolveRail(ball, nx, ny, events) {
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot >= 0) return;
  const vnx = dot * nx, vny = dot * ny;
  const vtx = ball.vx - vnx, vty = ball.vy - vny;
  ball.vx = vtx * BALL.railFriction - vnx * BALL.railRestitution;
  ball.vy = vty * BALL.railFriction - vny * BALL.railRestitution;
  events.onRailHit?.(ball, Math.abs(dot));
}

function advance(balls, t) {
  for (const b of balls) {
    if (!b.active) continue;
    b.x += b.vx * t;
    b.y += b.vy * t;
  }
}

function nearestPocket(ball) {
  let best = POCKETS[0], dist = Infinity;
  for (const p of POCKETS) {
    const d = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (d < dist) { dist = d; best = p; }
  }
  return best;
}

function pocketed(ball) {
  for (const p of POCKETS) {
    if (Math.hypot(ball.x - p.x, ball.y - p.y) < TABLE.pocketR * 0.92) return p;
  }
  // Rede de contenção: o centro da bola só ultrapassa a linha da tabela pelos
  // vãos das caçapas. Sem isto, uma bola que raspa o bico sai da mesa.
  if (ball.x < TABLE.left || ball.x > TABLE.right ||
      ball.y < TABLE.top || ball.y > TABLE.bottom) return nearestPocket(ball);
  return null;
}

export function step(balls, dt, events = {}) {
  const moving = () => balls.filter(b => b.active && (b.vx || b.vy));
  let remaining = dt;
  let guard = 0;

  while (remaining > EPS && guard++ < 24) {
    const live = balls.filter(b => b.active);
    let best = null;

    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const t = ballPairTime(a, live[j], remaining);
        if (t !== null && (!best || t < best.t)) best = { t, kind: 'ball', a, b: live[j] };
      }
      if (!a.vx && !a.vy) continue;
      for (const rail of CUSHIONS.rails) {
        const t = railTime(a, rail, remaining);
        if (t !== null && (!best || t < best.t)) best = { t, kind: 'rail', a, rail };
      }
      for (const jaw of CUSHIONS.jaws) {
        const t = pointTime(a, jaw, remaining);
        if (t !== null && (!best || t < best.t)) best = { t, kind: 'jaw', a, point: jaw };
      }
    }

    if (!best) { advance(balls, remaining); break; }

    advance(balls, best.t);
    remaining -= best.t;

    if (best.kind === 'ball') resolveBalls(best.a, best.b, events);
    else if (best.kind === 'rail') resolveRail(best.a, best.rail.nx, best.rail.ny, events);
    else {
      const dx = best.a.x - best.point.x, dy = best.a.y - best.point.y;
      const len = Math.hypot(dx, dy) || 1;
      resolveRail(best.a, dx / len, dy / len, events);
    }
  }

  // Atrito de rolagem: desaceleração constante, como numa mesa de verdade.
  for (const b of balls) {
    if (!b.active) continue;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const next = Math.max(0, speed - BALL.friction * dt);
      if (next <= BALL.stopSpeed) { b.vx = 0; b.vy = 0; }
      else { b.vx = b.vx / speed * next; b.vy = b.vy / speed * next; }
    }
    const hole = pocketed(b);
    if (hole) {
      b.active = false; b.vx = 0; b.vy = 0;
      b.x = hole.x; b.y = hole.y;
      events.onPocket?.(b, hole);
      continue;
    }
    // Correção de penetração: a varredura só resolve quem se APROXIMA da
    // tabela. Uma bola já encostada e empurrada de lado por outra afundava no
    // pano sem nunca disparar um contato.
    if (b.x < TABLE.left + b.r) { b.x = TABLE.left + b.r; if (b.vx < 0) b.vx = -b.vx * BALL.railRestitution; }
    else if (b.x > TABLE.right - b.r) { b.x = TABLE.right - b.r; if (b.vx > 0) b.vx = -b.vx * BALL.railRestitution; }
    if (b.y < TABLE.top + b.r) { b.y = TABLE.top + b.r; if (b.vy < 0) b.vy = -b.vy * BALL.railRestitution; }
    else if (b.y > TABLE.bottom - b.r) { b.y = TABLE.bottom - b.r; if (b.vy > 0) b.vy = -b.vy * BALL.railRestitution; }
  }

  return moving().length > 0;
}

export const anyMoving = balls => balls.some(b => b.active && (b.vx !== 0 || b.vy !== 0));
