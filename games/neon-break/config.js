// Toda a sintonia do jogo em um lugar só.
//
// Antes estes números estavam espalhados pelo código (5, 35, 24, 64, 11,
// 1250...). Centralizar é o que permite ajustar dificuldade, hitbox e
// velocidade sem caçar constantes soltas.

export const FIELD = {
  w: 400,
  hMin: 470,        // altura lógica mínima do campo
  hMax: 720,        // máxima (telas muito altas não esticam o jogo)
  hStep: 20,        // quantização: variações pequenas da barra de endereço
                    // do celular não mudam o campo lógico, só a escala
  hudBand: 30,      // faixa de HUD desenhada DENTRO do canvas
  wallX: 3,         // parede lateral: colisão e moldura no mesmo x
  frame: 2
};

export const BALL = {
  r: 4.8,
  rAssist: 6.2,
  trail: 10,
  minAngleDeg: 12,  // ângulo mínimo em relação à horizontal
  maxSpeed: 560
};

export const PADDLE = {
  h: 10,
  bottom: 62,       // distância da base do campo
  wBase: 96,
  wPerLevel: 4,
  wMin: 76,
  wWide: 132,
  wNarrow: 62,
  follow: 1500,     // px/s de perseguição do alvo (toque)
  keySpeed: 440,    // px/s no teclado
  english: 0.26,    // fração da velocidade da plataforma transferida à bola
  spreadDeg: 62,    // ângulo máximo de saída, medido da vertical
  shieldGap: 24
};

export const SPEED = {
  phase: [250, 268, 286, 304, 324],
  endlessBase: 250,
  endlessStep: 9,
  endlessMax: 360,
  perBrick: 0.9,
  perBrickMax: 34,
  ceilingGain: 1.012,   // aceleração clássica a cada toque no teto
  ceilingMax: 1.16,
  slow: 0.74,
  fast: 1.26,
  assist: 0.85,
  // Anti-travamento: em vez de reescrever o ângulo (que parece colisão
  // fantasma), a bola acelera aos poucos quando nada é destruído.
  stallAfter: 20,
  stallRate: 0.035,
  stallMax: 1.3,
  // Rede de segurança para trajetória quase horizontal persistente.
  flatAfter: 1.4,
  flatNudgeDeg: 6
};

export const BRICK = {
  cols: 7,
  rows: 7,
  marginX: 16,
  gapX: 12,
  gapY: 14,
  top: 44,
  cellMin: 32,      // espaçamento vertical mínimo entre linhas
  cellMax: 44,      // máximo: usa melhor a altura sem esticar demais
  clearance: 130,   // espaço livre garantido entre a última linha e a plataforma
  gapYMin: 14,      // vão vertical: precisa ser MAIOR que o diâmetro da bola
  hMin: 16,
  h: 24,
  radius: 3,
  moveAmplitude: 0.45,   // fração da largura da célula
  moveSpeed: 0.55,       // ciclos por segundo
  regenTime: 15,
  spawnTime: 9
};

export const DROP = { w: 30, h: 24, vy: 86, vyPerLevel: 4, vyMax: 160 };

// Três formas de ganhar vida, com papéis diferentes: sorte (a cápsula que
// cai), desempenho (marco de pontos) e recuperação (fase sem falhas quando
// você já está abaixo do começo).
export const LIVES = { start: 3, max: 5, scoreStep: 4000, maxBonus: 150 };

export const LASER = { speed: 460, cooldown: 0.26, w: 3, h: 12 };

export const EFFECTS = {
  wide: 12, slow: 10, fast: 8, laser: 10, magnet: 12, pierce: 8,
  narrow: 8, invert: 5, shieldCharges: 2, magnetHold: 2.6
};

export const SCORE = {
  brick: 10,
  comboCap: 5,
  precision: 15,      // acerto na ponta da plataforma
  precisionZone: 0.78,
  bonusCapsule: 250,
  levelBonus: 100,
  flawless: 200,
  chainPerCombo: 20
};

export const MAX_BALLS = 6;

// Altura lógica em função do formato do contêiner. Quantizada de propósito.
export function logicalSize(aspect) {
  const raw = FIELD.w / Math.max(aspect, 0.0001);
  const clamped = Math.min(FIELD.hMax, Math.max(FIELD.hMin, raw));
  return { w: FIELD.w, h: Math.round(clamped / FIELD.hStep) * FIELD.hStep };
}
