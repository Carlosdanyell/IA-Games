// Toda a sintonia do jogo em um lugar só.
//
// Duas unidades convivem aqui e não devem ser confundidas:
//   - METRO: a física do disparo (gravidade, velocidade, vento) é integrada em
//     metros e segundos, como no mundo real.
//   - UNIDADE LÓGICA: o que é desenhado. A conversão é feita por fase, porque a
//     cena inteira sempre cabe na tela: o arqueiro fica na margem esquerda e o
//     alvo na direita, independentemente da distância da fase.
//
// As hitboxes são calculadas no espaço desenhado, a partir da mesma geometria
// que o traço usa. Assim o que a pessoa vê é exatamente o que acerta.

export const FIELD = {
  w: 640,
  hMin: 280,        // altura lógica mínima (celular deitado, tela baixa)
  hMax: 420,        // máxima: acima disso só sobraria céu vazio
  hStep: 20,        // quantização: a barra de endereço do celular não muda o campo
  groundRatio: 0.82,
  archerRatio: 0.09,
  targetRatio: 0.86   // deixa espaço à direita para o corpo caído caber inteiro
};

// O jogo é só na horizontal, então a altura lógica acompanha o formato do
// contêiner dentro de uma faixa estreita. Em retrato o jogo mostra o aviso de
// girar e nem desenha a cena.
export function logicalSize(aspect) {
  const raw = FIELD.w / Math.max(aspect, 0.0001);
  const clamped = Math.min(FIELD.hMax, Math.max(FIELD.hMin, raw));
  return { w: FIELD.w, h: Math.round(clamped / FIELD.hStep) * FIELD.hStep };
}

// Níveis de dificuldade. Mexem em quatro coisas ao mesmo tempo: quanto da
// trajetória a linha de tiro mostra, o tamanho da hitbox da maçã, a força do
// vento e do movimento do alvo, e quantas vidas você tem. O bônus de pontos
// compensa o risco.
export const DIFFICULTY = {
  facil:   { label: 'Fácil',   guide: 1,    assist: 1.35, wind: 0.6,  motion: 0.6, lives: 4, apple: 1.12, bonus: 0.75,
             note: 'Trajetória inteira, vento fraco e maçã maior.' },
  normal:  { label: 'Normal',  guide: 0.3,  assist: 1.12, wind: 1,    motion: 1,   lives: 3, apple: 1,    bonus: 1,
             note: 'A linha some no meio do caminho: o resto é sua leitura.' },
  dificil: { label: 'Difícil', guide: 0.12, assist: 1,    wind: 1.35, motion: 1.35, lives: 2, apple: 0.86, bonus: 1.4,
             note: 'Só o começo da linha, sem folga na maçã, vento forte.' },
  mestre:  { label: 'Mestre',  guide: 0,    assist: 0.94, wind: 1.6,  motion: 1.7, lives: 1, apple: 0.72, bonus: 2,
             note: 'Sem linha de tiro, uma vida e alvo inquieto.' }
};

export const PHYSICS = {
  gravity: 9.81,      // m/s²
  drag: 0.05,         // amortecimento leve por segundo
  minSpeed: 12,       // m/s com força 0
  maxSpeed: 34,       // m/s com força 1
  maxFlight: 9,       // s: segurança contra flecha eterna
  minAngle: -0.35,    // rad (mira para baixo)
  maxAngle: 1.25      // rad
};

// Referência de escala: unidades lógicas por metro na fase mais curta. Serve
// para encolher as figuras conforme a distância cresce, com piso — sem o piso,
// a maçã viraria um ponto impossível de acertar nas fases longas.
export const SCALE = { ref: 21, min: 0.62, max: 1.15 };

export const FIGURE = {
  height: 70,         // unidades lógicas com escala 1, dos pés ao topo da cabeça
  headR: 8,           // cabeça um pouco maior: é onde ficam olhos e boca
  torsoR: 5.6,
  limbR: 2.9,
  appleR: 5.4,
  appleGap: 3.4,      // folga entre o topo da cabeça e a maçã
  assist: 1.35        // hitbox da maçã um pouco maior que o desenho
};

export const AIM = {
  maxPull: 120,       // unidades lógicas de arrasto = força máxima
  minPull: 14,        // abaixo disso o tiro é cancelado
  keyAngle: 1.1,      // rad/s no teclado
  keyPower: 0.7,      // fração/s no teclado
  guideSteps: 30,
  guideDt: 0.055
};

// Troca de fase: a câmera afasta até a nova distância enquanto o alvo novo
// entra caminhando. Sem isso a distância mudava num corte seco.
export const TRAVEL = {
  time: 1.25,         // s de afastamento
  walkIn: 0.62,       // fração do tempo em que o alvo caminha até o lugar
  entry: 90,          // unidades lógicas fora da tela de onde ele vem
  parallax: 5         // unidades lógicas que o cenário desliza por metro a mais
};

// Queda do alvo atingido, no espírito do original: tomba de vez, bate no chão
// e ainda dá um tranco antes de parar.
export const FALL = {
  time: 1.15,
  angle: 1.46,        // rad: deitado
  bounce: 0.13,
  appleSpin: 7,
  bitsSpeed: [70, 190]
};

export const ARROW = {
  len: 22,            // comprimento desenhado, unidades lógicas
  trail: 14
};

export const SCORE = {
  hit: 100,
  perMeter: 4,
  precision: 120,     // bônus máximo por acertar o centro da maçã
  streakStep: 25,
  streakMax: 150,
  firstArrow: 40      // bônus por resolver a fase na primeira flecha
};

export const LIVES = {
  start: 3,
  max: 5,
  scoreStep: 2500,    // vida extra a cada tanto de pontos
  streakStep: 6       // vida extra a cada tantos acertos seguidos
};

// Alvo-bônus: uma lanterna pendurada no meio do caminho, a partir da fase 10.
// Acertá-la gasta a flecha e não passa de fase — é uma escolha, não um brinde:
// troca-se um tiro por uma vida.
export const BONUS = {
  fromPhase: 10,      // índice 1-based da primeira fase que pode ter lanterna
  chance: 0.7,
  r: 8.5,             // raio desenhado, unidades lógicas com escala 1
  hit: 1.25,          // folga da hitbox
  xRange: [0.34, 0.72],   // fração da distância onde ela pode aparecer
  yRange: [0.3, 0.6],     // fração da altura do campo acima do chão
  bob: { amp: 9, speed: 1.4 },
  points: 180,        // quando já se está no máximo de vidas
  sparks: 26
};

// Rostos. A cara do alvo é o que dá clímax à cena, então ela reage: espera,
// medo enquanto a corda é puxada, alívio quando a maçã estoura e dor quando
// a flecha acerta a pessoa.
export const FACE = {
  eye: 0.2,           // raio do olho em frações do raio da cabeça
  eyeGap: 0.66,      // com menos que isso os dois olhos se encostam e viram um borrão
  eyeY: 0.02,        // logo abaixo da franja, senão o cabelo corta os olhos
  mouthY: 0.42,
  blinkEvery: [2.4, 5.5],
  blinkTime: 0.12
};

// Sangue: quantidade de partículas por nível de efeito. 'off' mantém o jogo
// jogável para quem não quer ver — o impacto vira faísca da cor de destaque.
export const BLOOD = {
  levels: {
    forte: { label: 'Forte', drops: 90, decals: 14, drip: 1, shake: 1 },
    leve:  { label: 'Leve', drops: 34, decals: 5, drip: 0.45, shake: 0.6 },
    off:   { label: 'Desligado', drops: 0, decals: 0, drip: 0, shake: 0.35 }
  },
  gravity: 780,       // unidades lógicas/s² (o sangue é desenhado, não físico)
  drag: 0.6,
  life: [0.5, 1.5],
  speed: [90, 420],
  decalLife: 14,
  maxDrops: 260,
  maxDecals: 90,
  colors: ['#e7213f', '#c4102b', '#ff4d63', '#8f0a1e']
};

export const TIMING = {
  freezeHit: 0.35,    // congela um instante no acerto, para o impacto ler
  nextLevel: 1.5,
  retry: 1.25,
  bannerDefault: 2
};
