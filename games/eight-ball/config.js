// Toda a sintonia da sinuca em um lugar só.
//
// O campo lógico é fixo e largo: o viewport do shell cuida da escala uniforme
// e do letterbox, então a mesa nunca deforma seja qual for o aparelho.

export const FIELD = { w: 980, h: 512, tableH: 480 };

// Faixa de controle à direita da mesa: medidor de força e disparo. Fica fora
// do pano de propósito — em paisagem é onde o polegar direito alcança.
export const PANEL = { x: 906, y: 44, w: 62, h: 392 };

// Faixa de tabela em volta do pano. O retângulo de jogo é exatamente 2:1,
// como numa mesa de verdade.
export const TABLE = {
  rail: 30,
  left: 30, right: 870, top: 30, bottom: 450,
  get width() { return this.right - this.left; },   // 840
  get height() { return this.bottom - this.top; },  // 420
  pocketR: 23,
  jawCorner: 27,   // quanto a tabela recua da caçapa de canto
  jawSide: 24,     // idem para a caçapa do meio
  headX: 240,      // linha de saída: a branca fica atrás dela
  footX: 660,      // ápice do triângulo
  centerY: 240
};

export const BALL = {
  r: 11.5,
  gap: 0.6,                 // folga entre bolas no triângulo
  restitution: 0.96,        // bola contra bola
  railRestitution: 0.82,    // bola contra tabela
  railFriction: 0.99,       // componente tangencial preservada na tabela
  friction: 300,            // desaceleração de rolagem, unidades/s²
  stopSpeed: 7,             // abaixo disto a bola para
  spinKeep: 0.985
};

export const SHOT = {
  maxSpeed: 2050,
  powerCurve: 1.7,          // força não linear: toques leves ficam realmente leves
  minSpeed: 210,
  maxAimDeg: 360,
  fineAimRadius: 90,        // arrastar longe da branca dá mira mais fina
  aimStep: 0.9,             // graus por toque de seta
  powerStep: 0.06,
  guideLength: 640,
  settleTime: 0.25          // tempo parado antes de encerrar a jogada
};

export const AI = {
  levels: {
    facil:  { label: 'Fácil',  errorDeg: 3.6, powerError: 0.16, safetyChance: 0.3 },
    medio:  { label: 'Médio',  errorDeg: 1.7, powerError: 0.09, safetyChance: 0.15 },
    dificil:{ label: 'Difícil', errorDeg: 0.6, powerError: 0.04, safetyChance: 0.05 }
  },
  thinkTime: 0.9,           // pausa antes de tacar, para dar leitura à jogada
  maxCutDeg: 82,            // acima disso a IA considera o corte impossível
  clearance: 1.06           // folga exigida ao conferir o caminho livre
};

// Cores das bolas. Tons puxados para o neon, mas mantendo a leitura clássica
// de qual número é qual — sem isso não dá para jogar 8-ball.
export const BALL_COLORS = {
  1: '#ffd166', 2: '#6aa6ff', 3: '#ff6b6b', 4: '#b98cff',
  5: '#ff9a5c', 6: '#5fd39b', 7: '#d4667f', 8: '#241c33'
};

export const logicalSize = () => ({ w: FIELD.w, h: FIELD.h });

// Caçapas: quatro de canto e duas de meio.
export const POCKETS = [
  { x: TABLE.left,  y: TABLE.top,    corner: true },
  { x: 450,         y: TABLE.top,    corner: false },
  { x: TABLE.right, y: TABLE.top,    corner: true },
  { x: TABLE.left,  y: TABLE.bottom, corner: true },
  { x: 450,         y: TABLE.bottom, corner: false },
  { x: TABLE.right, y: TABLE.bottom, corner: true }
];
