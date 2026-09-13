import { TABLE, BALL, POCKETS } from './config.js';

// Geometria fixa da mesa: as tabelas são segmentos alinhados aos eixos, com
// vãos nas caçapas, e as pontas viram obstáculos pontuais. Essa ponta é o
// "bico" da caçapa — sem ela a bola que raspa a entrada não quica como deve.
function buildCushions() {
  const { left, right, top, bottom, jawCorner: jc, jawSide: js } = TABLE;
  const mid = 450;
  const rails = [
    // superior: normal aponta para dentro (+y)
    { axis: 'y', at: top, nx: 0, ny: 1, from: left + jc, to: mid - js },
    { axis: 'y', at: top, nx: 0, ny: 1, from: mid + js, to: right - jc },
    // inferior: normal (-y)
    { axis: 'y', at: bottom, nx: 0, ny: -1, from: left + jc, to: mid - js },
    { axis: 'y', at: bottom, nx: 0, ny: -1, from: mid + js, to: right - jc },
    // esquerda: normal (+x)
    { axis: 'x', at: left, nx: 1, ny: 0, from: top + jc, to: bottom - jc },
    // direita: normal (-x)
    { axis: 'x', at: right, nx: -1, ny: 0, from: top + jc, to: bottom - jc }
  ];
  const jaws = [];
  for (const rail of rails) {
    if (rail.axis === 'y') {
      jaws.push({ x: rail.from, y: rail.at }, { x: rail.to, y: rail.at });
    } else {
      jaws.push({ x: rail.at, y: rail.from }, { x: rail.at, y: rail.to });
    }
  }
  return { rails, jaws };
}

export const CUSHIONS = buildCushions();
export const POCKET_LIST = POCKETS;

export const inPlayArea = (x, y, r = BALL.r) =>
  x >= TABLE.left + r && x <= TABLE.right - r &&
  y >= TABLE.top + r && y <= TABLE.bottom - r;

// Uma posição só serve para a bola na mão se estiver no pano, longe das
// caçapas e sem encostar em nenhuma outra bola.
export function isFreeSpot(x, y, balls, ignoreId = null) {
  if (!inPlayArea(x, y)) return false;
  for (const p of POCKETS) {
    if (Math.hypot(x - p.x, y - p.y) < TABLE.pocketR + BALL.r) return false;
  }
  for (const b of balls) {
    if (!b.active || b.id === ignoreId) continue;
    if (Math.hypot(x - b.x, y - b.y) < BALL.r * 2 + 0.5) return false;
  }
  return true;
}

// Procura o ponto livre mais próximo, em espiral: usado ao recolocar a branca
// e ao devolver a 8 ao pé da mesa.
export function nearestFreeSpot(x, y, balls, ignoreId = null) {
  if (isFreeSpot(x, y, balls, ignoreId)) return { x, y };
  const step = BALL.r * 0.9;
  for (let ring = 1; ring <= 40; ring++) {
    const count = ring * 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const px = x + Math.cos(a) * ring * step;
      const py = y + Math.sin(a) * ring * step;
      if (isFreeSpot(px, py, balls, ignoreId)) return { x: px, y: py };
    }
  }
  return { x: TABLE.headX, y: TABLE.centerY };
}
