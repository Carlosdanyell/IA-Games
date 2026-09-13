import { FIELD, FIGURE, SCALE } from './config.js';

// Geometria da cena e detecção de acerto.
//
// A cena inteira cabe sempre na tela: o arqueiro fica na margem esquerda e o
// alvo na direita. O que a distância da fase muda é a conversão metro ->
// unidade lógica (e, com ela, o tamanho das figuras), não o enquadramento.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export function layout(view, phase) {
  const x0 = view.w * FIELD.archerRatio;
  const x1 = view.w * FIELD.targetRatio;
  const u = (x1 - x0) / phase.distance;           // unidades lógicas por metro
  return {
    groundY: Math.round(view.h * FIELD.groundRatio),
    x0, x1, u,
    scale: clamp(u / SCALE.ref, SCALE.min, SCALE.max)
  };
}

// Posição do alvo no instante t (segundos de partida): passo horizontal e
// oscilação vertical da plataforma, ambos em metros, convertidos para a tela.
export function targetAt(scene, phase, t) {
  const pace = phase.pace ? Math.sin(t * phase.pace.speed) * phase.pace.range : 0;
  const lift = phase.lift ? (Math.sin(t * phase.lift.speed) + 1) / 2 * phase.lift.range : 0;
  return {
    x: scene.x1 + pace * scene.u,
    y: scene.groundY - lift * scene.u,
    pace, lift
  };
}

// Corpo do alvo como uma cadeia de círculos: o teste de acerto vira uma única
// equação de segundo grau por peça, exata e fácil de desenhar no modo debug.
export function bodyOf(scene, phase, foot) {
  const s = scene.scale;
  const h = FIGURE.height * s;
  const fx = foot.x, fy = foot.y;
  const torsoR = FIGURE.torsoR * s;
  const limbR = FIGURE.limbR * s;
  const headR = FIGURE.headR * s;
  const shoulderY = fy - 0.75 * h;
  const headCy = shoulderY - 0.04 * h - headR;
  const appleR = FIGURE.appleR * s * (phase.apple ?? 1);
  const appleY = headCy - headR - FIGURE.appleGap * s - appleR;

  return {
    h, headR, torsoR, limbR, shoulderY, headCy, appleR, appleY,
    hipY: fy - 0.42 * h,
    apple: { x: fx, y: appleY, r: appleR },
    // Assistência menor quanto menor a maçã: nas fases finais quase não sobra.
    appleHit: { x: fx, y: appleY, r: appleR * (1 + (FIGURE.assist - 1) * (phase.apple ?? 1)) },
    parts: [
      { part: 'cabeça', x: fx, y: headCy, r: headR },
      { part: 'ombro', x: fx, y: shoulderY, r: torsoR * 0.92 },
      { part: 'peito', x: fx, y: fy - 0.63 * h, r: torsoR },
      { part: 'abdômen', x: fx, y: fy - 0.52 * h, r: torsoR * 0.95 },
      { part: 'quadril', x: fx, y: fy - 0.42 * h, r: torsoR * 0.86 },
      { part: 'coxa', x: fx - 0.05 * h, y: fy - 0.28 * h, r: limbR * 1.5 },
      { part: 'coxa', x: fx + 0.05 * h, y: fy - 0.28 * h, r: limbR * 1.5 },
      { part: 'perna', x: fx - 0.07 * h, y: fy - 0.12 * h, r: limbR * 1.25 },
      { part: 'perna', x: fx + 0.07 * h, y: fy - 0.12 * h, r: limbR * 1.25 }
    ]
  };
}

// Instante (0..1) em que o segmento a->b encosta no círculo, ou -1.
// Usar o segmento inteiro, e não a posição do quadro, é o que impede a flecha
// rápida de atravessar a maçã entre dois passos da simulação.
export function segmentCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return (fx * fx + fy * fy <= r * r) ? 0 : -1;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;                       // já começa dentro
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return (t >= 0 && t <= 1) ? t : -1;
}

// Primeiro acerto ao longo do segmento: maçã e corpo disputam pelo instante,
// nunca por prioridade fixa — uma flecha que passa raspando por cima da maçã
// e atinge a cabeça tem de acusar a cabeça.
export function firstHit(ax, ay, bx, by, body) {
  let best = null;
  const apple = segmentCircle(ax, ay, bx, by, body.appleHit.x, body.appleHit.y, body.appleHit.r);
  if (apple >= 0) best = { kind: 'apple', t: apple, part: 'maçã' };
  for (const p of body.parts) {
    const t = segmentCircle(ax, ay, bx, by, p.x, p.y, p.r);
    if (t < 0 || (best && t >= best.t)) continue;
    best = { kind: 'body', t, part: p.part, circle: p };
  }
  return best;
}
