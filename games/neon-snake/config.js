export const MODES = [
  { id: 'classic', name: 'Clássico', description: 'A borda e o próprio corpo encerram a partida.' },
  { id: 'wrap', name: 'Sem Paredes', description: 'Atravesse as bordas e reapareça do outro lado.' },
  { id: 'challenge', name: 'Desafio', description: 'Obstáculos, zonas de perigo e objetivos em sequência.' },
  { id: 'zen', name: 'Zen', description: 'Bordas livres, ritmo calmo e sem se morder.' }
];

// Velocidades em unidades lógicas por segundo. Uma casa da grade de fundo
// mede 20 unidades, então 100 unidades/s são 5 casas por segundo.
export const DIFFICULTIES = [
  { id: 'easy', name: 'Fácil', description: 'Mais devagar e bônus mais longos.', speed: 80, maxSpeed: 130, bonusDuration: 10, obstacleEvery: 8 },
  { id: 'normal', name: 'Normal', description: 'Um ritmo crescente para entrar no fluxo.', speed: 95, maxSpeed: 165, bonusDuration: 8, obstacleEvery: 6 },
  { id: 'hard', name: 'Difícil', description: 'Rápido desde o início e bônus mais curtos.', speed: 115, maxSpeed: 200, bonusDuration: 6, obstacleEvery: 4 }
];

export const SNAKE = {
  cell: 20,            // tamanho de uma casa da grade de fundo
  rows: 20,            // altura fixa do tabuleiro, em casas
  cols: 24,            // mínimo: deitado o tabuleiro ganha colunas até maxCols
  maxCols: 40,
  spacing: 4,         // distância entre os pontos do caminho do corpo
  headRadius: 7,
  bodyRadius: 6,
  foodRadius: 6,
  startLength: 4,      // em casas
  levelEvery: 5,       // alimentos por nível
  levelSpeedup: 1.045,
  zenSpeed: 0.8,
  slow: 0.6,
  turbo: 1.45,
  invuln: 1.2,         // segundos sem colisão depois do escudo
  deadZone: 10,        // arrasto mínimo do joystick, em unidades lógicas
  turnRadius: 12       // raio da curva em unidades: a meia-volta cabe em 1,2 casa
};

// Giro máximo em rad/s. Como acompanha a velocidade, o raio da curva é o mesmo
// em qualquer ritmo: dá para virar dentro de um corredor de uma casa sem perder
// o desenho do movimento. O piso serve para quando o slow motion freia a cobra.
export const turnRate = speed => Math.max(3.4, speed / SNAKE.turnRadius);

// Os desenhos e as cores valem para todos os modos. Obstáculos e zonas de
// perigo são exclusivos do Desafio, preservando as regras dos outros modos.
export const MAPS = [
  { id: 'grid', name: 'Grid Neon', description: 'O ponto de partida. Uma grade banhada em ciano.', unlock: 0, color: '#53f3dc' },
  { id: 'circuit', name: 'Circuito', description: 'Trilhas elétricas e pilares de energia.', unlock: 15, color: '#68bfff' },
  { id: 'maze', name: 'Labirinto', description: 'Corredores violetas com espaço para manobrar.', unlock: 40, color: '#b48aff' },
  { id: 'hex', name: 'Arena Hex', description: 'Um núcleo âmbar cercado por ilhas geométricas.', unlock: 80, color: '#ffd166' },
  { id: 'city', name: 'Cyber City', description: 'Quarteirões iluminados em uma cidade digital.', unlock: 140, color: '#ff84d9' },
  { id: 'void', name: 'Void', description: 'A última fronteira: neon azul no vazio.', unlock: 220, color: '#91a0ff' }
];

// Aparências da cobra. Cada uma abre com uma marca diferente do histórico, para
// dar um motivo a mais de voltar: partidas, tamanho, combo, pontos e alimentos.
export const SKINS = [
  { id: 'lima', name: 'Lima Neon', description: 'A cobra original da biblioteca.', pattern: 'solid',
    body: '#c1f760', turbo: '#e6ff9e', glow: '#a6f14b', shine: 'rgba(234,255,196,0.35)', head: '#f2ffc8', eye: '#152312',
    unlockBy: 'games', unlock: 0 },
  { id: 'ciano', name: 'Ciano Elétrico', description: 'Vidro de neon azul, recém-aceso.', pattern: 'solid',
    body: '#53f3dc', turbo: '#a6fff2', glow: '#22c9b1', shine: 'rgba(214,255,250,0.38)', head: '#dbfff9', eye: '#04241f',
    unlockBy: 'games', unlock: 5 },
  { id: 'rosa', name: 'Rosa Cibernético', description: 'Magenta de letreiro de esquina.', pattern: 'solid',
    body: '#ff5ce1', turbo: '#ffa6ef', glow: '#d92bb8', shine: 'rgba(255,214,246,0.38)', head: '#ffd9f6', eye: '#2b0424',
    unlockBy: 'maxLength', unlock: 25 },
  { id: 'ambar', name: 'Âmbar Solar', description: 'O calor de uma lâmpada de rua.', pattern: 'solid',
    body: '#ffb347', turbo: '#ffd79a', glow: '#e8860c', shine: 'rgba(255,233,200,0.4)', head: '#ffe7c2', eye: '#2e1602',
    unlockBy: 'best', unlock: 1000 },
  { id: 'gelo', name: 'Gelo', description: 'Listras claras correndo pelo corpo.', pattern: 'stripes',
    body: '#bfe9ff', turbo: '#e8f7ff', glow: '#4aa8dd', shine: 'rgba(255,255,255,0.72)', head: '#ffffff', eye: '#0b2233',
    unlockBy: 'bestCombo', unlock: 8 },
  { id: 'arco', name: 'Arco-Íris', description: 'Todas as cores da grade de uma vez.', pattern: 'rainbow',
    body: '#ff8a5c', turbo: '#ffd3a1', glow: '#ff5ce1', shine: 'rgba(255,255,255,0.3)', head: '#fff1d6', eye: '#241030',
    colors: ['#ff5c5c', '#ffb347', '#c1f760', '#53f3dc', '#68bfff', '#b48aff'],
    unlockBy: 'foods', unlock: 150 }
];

// Como ler a condição de cada aparência no diálogo.
export const SKIN_GOALS = { games: 'partidas', maxLength: 'de tamanho', bestCombo: 'de combo', best: 'pontos', foods: 'alimentos' };

export const ITEMS = {
  food: { name: 'Alimento', color: '#ff5c8a', symbol: '●', description: 'Cresça, marque pontos e mantenha o combo.' },
  special: { name: 'Alimento especial', color: '#ffd166', symbol: '★', description: 'Vale cinco vezes mais. Pegue antes que desapareça.' },
  multiplier: { name: 'Multiplicador', color: '#b48aff', symbol: '×2', description: 'Dobra seus pontos por alguns segundos.' },
  shield: { name: 'Escudo', color: '#53f3dc', symbol: '◇', description: 'Absorve uma colisão e vira a cobra para o centro.' },
  shrink: { name: 'Redutor', color: '#ff84d9', symbol: '−', description: 'Reduz parte do corpo sem diminuir seu recorde de tamanho.' },
  slow: { name: 'Slow Motion', color: '#68bfff', symbol: '»', description: 'Movimento mais lento por alguns segundos.' },
  turbo: { name: 'Turbo', color: '#ff964f', symbol: 'ϟ', description: 'Um grande bônus de pontos e uma explosão temporária de velocidade.' }
};

export const ACHIEVEMENTS = [
  { id: 'length25', name: 'Crescendo no neon', description: 'Atinja o tamanho 25.' },
  { id: 'length50', name: 'Serpente elétrica', description: 'Atinja o tamanho 50.' },
  { id: 'length100', name: 'Lenda da grade', description: 'Atinja o tamanho 100.' },
  { id: 'combo10', name: 'Em sintonia', description: 'Faça um combo ×10.' },
  { id: 'score2000', name: 'Alta voltagem', description: 'Marque 2.000 pontos em uma partida.' },
  { id: 'allmaps', name: 'Explorador do futuro', description: 'Desbloqueie todas as arenas.' },
  { id: 'survivor', name: 'Pulso constante', description: 'Sobreviva por três minutos em uma partida.' }
];
