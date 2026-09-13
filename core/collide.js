// Detecção contínua de colisão (CCD) para círculo em movimento.
//
// Por que contínua: o teste discreto "já sobrepôs?" não diz QUAL face foi
// atingida nem QUAL objeto foi atingido primeiro. É daí que vêm os ângulos de
// reflexão errados e os quiques duplos que parecem colisão fantasma.
//
// `sweepCircleRect` devolve o instante exato do contato (0..1 dentro do passo)
// e a normal da superfície — inclusive nas quinas, onde a resposta correta é a
// reflexão sobre a normal do canto, e não sobre um dos eixos.

const EPS = 1e-6;

export function sweepCircleRect(px, py, r, dx, dy, rx, ry, rw, rh) {
  // Soma de Minkowski: retângulo dilatado pelo raio da bola.
  const ex = rx - r, ey = ry - r, ew = rw + 2 * r, eh = rh + 2 * r;

  let tMinX, tMaxX, tMinY, tMaxY;

  if (Math.abs(dx) < EPS) {
    if (px <= ex || px >= ex + ew) return null;
    tMinX = -Infinity; tMaxX = Infinity;
  } else {
    const inv = 1 / dx;
    let a = (ex - px) * inv, b = (ex + ew - px) * inv;
    if (a > b) { const t = a; a = b; b = t; }
    tMinX = a; tMaxX = b;
  }

  if (Math.abs(dy) < EPS) {
    if (py <= ey || py >= ey + eh) return null;
    tMinY = -Infinity; tMaxY = Infinity;
  } else {
    const inv = 1 / dy;
    let a = (ey - py) * inv, b = (ey + eh - py) * inv;
    if (a > b) { const t = a; a = b; b = t; }
    tMinY = a; tMaxY = b;
  }

  const tEntry = Math.max(tMinX, tMinY);
  const tExit = Math.min(tMaxX, tMaxY);
  if (tEntry > tExit || tExit <= 0 || tEntry >= 1 || tEntry < 0) return null;

  const axisX = tMinX > tMinY;
  const cx = px + dx * tEntry;
  const cy = py + dy * tEntry;

  // Contato numa face reta?
  if (axisX) {
    if (cy >= ry - EPS && cy <= ry + rh + EPS) {
      return { t: tEntry, nx: dx > 0 ? -1 : 1, ny: 0, corner: false };
    }
  } else {
    if (cx >= rx - EPS && cx <= rx + rw + EPS) {
      return { t: tEntry, nx: 0, ny: dy > 0 ? -1 : 1, corner: false };
    }
  }

  // Caso contrário o contato é numa quina: círculo contra ponto.
  const qx = cx < rx + rw / 2 ? rx : rx + rw;
  const qy = cy < ry + rh / 2 ? ry : ry + rh;
  return sweepCirclePoint(px, py, r, dx, dy, qx, qy);
}

export function sweepCirclePoint(px, py, r, dx, dy, qx, qy) {
  const mx = px - qx, my = py - qy;
  const a = dx * dx + dy * dy;
  if (a < EPS) return null;
  const b = 2 * (mx * dx + my * dy);
  const c = mx * mx + my * my - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  let t = (-b - root) / (2 * a);
  if (t < 0) t = (-b + root) / (2 * a);
  if (t < 0 || t >= 1) return null;
  const hx = px + dx * t - qx;
  const hy = py + dy * t - qy;
  const len = Math.hypot(hx, hy) || 1;
  return { t, nx: hx / len, ny: hy / len, corner: true };
}

// Sobreposição já existente no início do passo (pode ocorrer após um bloco
// móvel encostar na bola). Devolve a normal de saída e a profundidade.
export function overlapCircleRect(px, py, r, rx, ry, rw, rh) {
  const cx = Math.max(rx, Math.min(px, rx + rw));
  const cy = Math.max(ry, Math.min(py, ry + rh));
  const dx = px - cx, dy = py - cy;
  const distSq = dx * dx + dy * dy;
  if (distSq > r * r) return null;

  if (distSq > EPS) {
    const dist = Math.sqrt(distSq);
    return { nx: dx / dist, ny: dy / dist, depth: r - dist };
  }
  // Centro dentro do retângulo: sai pela face mais próxima.
  const left = px - rx, right = rx + rw - px;
  const top = py - ry, bottom = ry + rh - py;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { nx: -1, ny: 0, depth: left + r };
  if (min === right) return { nx: 1, ny: 0, depth: right + r };
  if (min === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

export function reflect(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
