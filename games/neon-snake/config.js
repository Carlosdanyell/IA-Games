export const MODES = [
  { id: 'classic', name: 'Clássico', description: 'Desvie do corpo e das paredes. A essência da cobrinha.' },
  { id: 'wrap', name: 'Sem Paredes', description: 'Atravesse as bordas e reapareça do outro lado.' },
  { id: 'challenge', name: 'Desafio', description: 'Cumpra objetivos e enfrente obstáculos e zonas de perigo.' },
  { id: 'zen', name: 'Zen', description: 'Bordas livres e ritmo tranquilo, sem aceleração progressiva.' }
];

export const DIFFICULTIES = [
  { id: 'easy', name: 'Fácil', description: 'Mais tempo para encontrar seu caminho.', step: 0.22, maxSpeed: 0.105, bonusDuration: 10, obstacleEvery: 8 },
  { id: 'normal', name: 'Normal', description: 'Um ritmo crescente para entrar no fluxo.', step: 0.175, maxSpeed: 0.075, bonusDuration: 8, obstacleEvery: 6 },
  { id: 'hard', name: 'Difícil', description: 'Reflexos rápidos e bônus mais curtos.', step: 0.135, maxSpeed: 0.057, bonusDuration: 6, obstacleEvery: 4 }
];

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

export const ITEMS = {
  food: { name: 'Alimento', color: '#ff5c8a', symbol: '●', description: 'Cresça, marque pontos e mantenha o combo.' },
  special: { name: 'Alimento especial', color: '#ffd166', symbol: '★', description: 'Vale cinco vezes mais. Pegue antes que desapareça.' },
  multiplier: { name: 'Multiplicador', color: '#b48aff', symbol: '×2', description: 'Dobra seus pontos por alguns segundos.' },
  shield: { name: 'Escudo', color: '#53f3dc', symbol: '◇', description: 'Absorve uma colisão e encontra uma saída segura.' },
  shrink: { name: 'Redutor', color: '#ff84d9', symbol: '−', description: 'Reduz parte do corpo sem diminuir seu recorde de tamanho.' },
  slow: { name: 'Slow Motion', color: '#68bfff', symbol: '»', description: 'Dá tempo para respirar: movimento mais lento por alguns segundos.' },
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
