// Toda a sintonia do Neon Shooter em um lugar só: campo, nave, inimigos,
// chefes, power-ups, melhorias e pontuação. Nada aqui toca no DOM, então a
// simulação e os testes leem os mesmos números que o jogo.

export const FIELD = {
  landscapeH: 460 // altura fixa; largura exata da tela, inclusive ultrawide
};

export function logicalSize(aspect) {
  // A proporção exata elimina as faixas em celulares 19,5:9 e 21:9.
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  return { w: FIELD.landscapeH * a, h: FIELD.landscapeH };
}

// ------------------------------------------------------------------- 3D
// O campo deixa de ser um retângulo e vira um tronco de pirâmide: a nave anda
// num plano em z = 0 e os inimigos vêm de `spawnZ` em direção a ela.
//
// A largura jogável sai da projeção, não de um número solto. Um ponto a `d` da
// câmera aparece a `fov/d` da linha central, então metade do plano de jogo é
// `(metade da tela lógica) * camBack / fov`. Escolher `fov` e `camBack` e
// derivar a largura mantém desenho e jogabilidade presos um ao outro: mudar a
// lente não desalinha a área onde a nave pode andar.
export const SPACE = {
  fov: 460,
  near: 18,
  camBack: 300,      // distância da câmera ao plano da nave
  camLift: 26,       // câmera um pouco acima, para ver o chão do túnel
  camLook: 0,        // mira e limites estáveis durante a manobra
  spawnZ: 1900,      // onde o inimigo aparece
  killZ: -180,       // passou daqui para trás, saiu da partida
  fogStart: 520,
  fogEnd: 2300,
  fogFloor: .45,
  // Meia altura do plano de jogo; a meia largura vem da tela lógica, que muda
  // com a orientação do aparelho.
  halfH: (FIELD.landscapeH - 116) / 2 * 300 / 460,
  halfW: width => Math.max(12, (width / 2 - 8) * (300 - 25.5) / 460 - 25.5)
};

// Folga para o casco e para o HUD, usando exatamente a lente do desenho.
export function flightBounds(w, h) {
  // Usa a parte do casco mais próxima da câmera, inclusive durante a rolagem.
  const radius = PLAYER.size * 1.5, k = (SPACE.camBack - radius) / SPACE.fov;
  const minY = SPACE.camLift - (h / 2 - 8) * k + radius;
  const maxY = SPACE.camLift + (h / 2 - 72) * k - radius;
  return { halfW: SPACE.halfW(w), halfH: Math.max(20, (maxY - minY) / 2), minY, maxY };
}

export const PLAYER = {
  radius: 7,            // hitbox menor que o desenho, de propósito
  size: 17,
  bottom: 92,           // distância da base ao começar
  topLimit: 0.36,       // pode subir até 36% da altura do campo
  speed: 290,           // unidades/s no teclado e no joystick
  response: 24,        // amortecimento da pilotagem; sem salto ao arrastar
  aimAssist: 32,       // pequena tolerância no plano de voo, sem mirar por toda a tela
  maxHp: 5,
  invuln: 1.3,          // segundos intocável depois de levar dano
  grace: 0.9,           // depois de escolher melhoria
  fireInterval: 0.16,
  // O tiro cruza profundidade, não altura de tela. O combate vai até 1900
  // unidades, contra os ~640 do campo antigo: manter a velocidade de lá
  // triplicava o tempo de voo, e um tiro que demora quase um segundo para
  // chegar não acerta nada que se mexe. Medido: com 640 o primeiro chefe
  // terminava com 68% de vida em quatro de seis partidas.
  bulletSpeed: 1100,
  bulletRadius: 3,
  critMult: 2.5,
  pickupRadius: 24,     // generoso: dedo no celular não é mira de precisão
  magnetRadius: 70,
  magnetUpgrade: 170,
  maxBullets: 90
};

// `bossHp` anda separado de `hp` de propósito: subir a vida do chefe alonga a
// luta em vez de apertá-la, e luta longa contra 5 pontos de vida é desgaste,
// não desafio. A diferença entre os níveis está na pressão — quantidade de
// inimigos, cadência de tiro e a carência depois de levar dano.
export const DIFFICULTIES = {
  facil:   { label: 'Fácil',   note: 'Inimigos lentos, menos tiros e mais power-ups.',
             speed: 0.78, count: 0.88, fire: 0.72, hp: 0.8, bossHp: 0.82, invuln: 1.3,
             drops: 1.35, score: 0.75 },
  normal:  { label: 'Normal',  note: 'O equilíbrio clássico do arcade.',
             speed: 1, count: 1, fire: 1, hp: 1, bossHp: 1, invuln: 1,
             drops: 1, score: 1 },
  dificil: { label: 'Difícil', note: 'Muito mais inimigos, tiros mais cerrados e menos folga depois do dano.',
             speed: 1.18, count: 1.35, fire: 1.55, hp: 1.3, bossHp: 1.08, invuln: 0.85,
             drops: 0.85, score: 1.8 }
};
export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

// `drop` é a chance de soltar power-up; `xp` alimenta a barra de nível.
// `speed` agora é avanço em profundidade (unidades por segundo em z); o que
// cada tipo faz em x/y está em `enemies.js`. `radius` é raio de colisão em
// unidades do mundo, e a malha é desenhada no mesmo raio — malha maior que a
// hitbox é tiro passando por dentro do desenho.
export const ENEMIES = {
  drone:    { name: 'Drone', role: 'Comum', hp: 2, speed: 150, radius: 15, score: 100, xp: 1,
              drop: 0.05, color: '#ff4fd8', minWave: 1, contact: 1, amp: 16, freq: 1.1 },
  dart:     { name: 'Dardo', role: 'Rápido', hp: 1, speed: 430, radius: 11, score: 150, xp: 1,
              drop: 0.04, color: '#ffe45e', minWave: 2, contact: 1, aim: .55 },
  weaver:   { name: 'Ziguezague', role: 'Lateral', hp: 3, speed: 125, radius: 15, score: 200, xp: 2,
              drop: 0.06, color: '#7dff6a', minWave: 4, contact: 1, amp: 78, freq: 1.3 },
  gunner:   { name: 'Atirador', role: 'Dispara', hp: 4, speed: 190, radius: 16, score: 300, xp: 2,
              drop: 0.09, color: '#ff5a5a', minWave: 3, contact: 1, holdZ: 620, fireEvery: 1.9,
              bulletSpeed: 380, stay: 9 },
  tank:     { name: 'Blindado', role: 'Resistente', hp: 10, speed: 82, radius: 24, score: 450, xp: 4,
              drop: 0.22, color: '#ff9b3d', minWave: 5, contact: 2 },
  splitter: { name: 'Divisor', role: 'Especial', hp: 5, speed: 118, radius: 18, score: 350, xp: 3,
              drop: 0.1, color: '#5ff4ff', minWave: 6, contact: 1, splits: 3 },
  hunter:   { name: 'Caçador', role: 'Especial', hp: 3, speed: 700, radius: 13, score: 280, xp: 2,
              drop: 0.08, color: '#ff7ab8', minWave: 7, contact: 1, lock: 0.8, cruise: 120 },
  spinner:  { name: 'Sentinela', role: 'Especial', hp: 8, speed: 150, radius: 19, score: 520, xp: 4,
              drop: 0.16, color: '#a47bff', minWave: 8, contact: 1, holdZ: 780, fireEvery: 2.7,
              ring: 10, bulletSpeed: 300, stay: 11 },

  // ----------------------------------------------- nascidos da profundidade
  // Estes seis não teriam sentido no plano: todos usam o eixo z como parte da
  // ameaça, seja na rota, no alinhamento ou no tempo até chegar.
  diver:    { name: 'Mergulhador', role: 'Arco', hp: 3, speed: 260, radius: 15, score: 320, xp: 2,
              drop: 0.08, color: '#ffa94d', minWave: 9, contact: 1, swing: 210, arc: 1.5 },
  wall:     { name: 'Muralha', role: 'Barreira', hp: 6, speed: 95, radius: 26, score: 260, xp: 2,
              drop: 0.07, color: '#ff6b6b', minWave: 10, contact: 2, slab: true },
  orbiter:  { name: 'Orbital', role: 'Circula', hp: 5, speed: 230, radius: 16, score: 380, xp: 3,
              drop: 0.11, color: '#9dff6a', minWave: 11, contact: 1, holdZ: 420, orbit: 150,
              spin: 1.25, stay: 12 },
  mirror:   { name: 'Espelho', role: 'Reflete', hp: 4, speed: 110, radius: 18, score: 440, xp: 3,
              drop: 0.14, color: '#7ad7ff', minWave: 12, contact: 1, reflect: .62, turn: 2.6 },
  swarm:    { name: 'Enxame', role: 'Grupo', hp: 2, speed: 205, radius: 11, score: 120, xp: 1,
              drop: 0.03, color: '#ffd166', minWave: 13, contact: 1, cohesion: 46, jitter: 1.9 },
  lancer:   { name: 'Perfurador', role: 'Feixe', hp: 7, speed: 130, radius: 17, score: 560, xp: 4,
              drop: 0.18, color: '#c77bff', minWave: 14, contact: 1, holdZ: 1050, charge: 1.5,
              beam: .9, beamEvery: 3.4, beamR: 34, stay: 14 }
};

export const ENEMY_DESCRIPTIONS = {
  drone: 'Vem reto da profundidade, oscilando de leve.',
  dart: 'Mira uma vez e mergulha em alta velocidade.',
  weaver: 'Varre de um lado ao outro enquanto se aproxima.',
  gunner: 'Para a meia distância e dispara mirado.',
  tank: 'Lento, muito resistente e causa 2 de dano na colisão.',
  splitter: 'Ao ser destruído, se abre em dardos para os lados.',
  hunter: 'Pisca, trava o rumo e avança em linha reta até você.',
  spinner: 'Gira ao longe e solta anéis que se abrem ao vir.',
  diver: 'Abre em arco para fora e volta cortando o seu plano.',
  wall: 'Vem em barreira com uma brecha. Alinhe-se ou abra caminho.',
  orbiter: 'Para perto e circula o seu eixo: tem de girar a mira.',
  mirror: 'A face da frente devolve o seu tiro. Acerte de lado.',
  swarm: 'Nuvem que se move como um corpo só e se abre ao ser tocada.',
  lancer: 'Carrega ao longe e varre a coluna onde você está.'
};

export const POWERUPS = {
  heal:   { name: 'Reparo', desc: 'Recupera 1 ponto de vida.', color: '#6dff9e', weight: 12, instant: true },
  shield: { name: 'Escudo', desc: 'Bloqueia todo dano por 8 s.', color: '#5fd5ff', weight: 11, time: 8 },
  rapid:  { name: 'Cadência', desc: 'Tiros 60% mais rápidos por 10 s.', color: '#ffe45e', weight: 13, time: 10 },
  double: { name: 'Tiro duplo', desc: 'Dois canhões por 12 s.', color: '#ff9b3d', weight: 11, time: 12 },
  triple: { name: 'Tiro triplo', desc: 'Leque de três tiros por 10 s.', color: '#ff7ab8', weight: 7, time: 10 },
  pierce: { name: 'Perfurante', desc: 'Tiros atravessam inimigos por 10 s.', color: '#c6a2ff', weight: 8, time: 10 },
  power:  { name: 'Dano', desc: 'Dano 70% maior por 10 s.', color: '#ff5a5a', weight: 9, time: 10 },
  slow:   { name: 'Câmera lenta', desc: 'Inimigos e tiros deles a 45% por 6 s.', color: '#7aa8ff', weight: 7, time: 6 },
  bomb:   { name: 'Bomba', desc: 'Dano pesado em tudo na tela e limpa os tiros inimigos.', color: '#ffffff', weight: 5, instant: true }
};
export const TIMED_POWERUPS = Object.keys(POWERUPS).filter(k => !POWERUPS[k].instant);

export const POWER = { rapid: 1.6, power: 1.7, slow: 0.45, bombDamage: 14, bombBossDamage: 0.08, fall: 62, life: 14 };

export const UPGRADES = {
  damage:   { name: '+20% de dano', desc: 'Todos os tiros causam mais dano.', max: 5, icon: 'power' },
  firerate: { name: 'Cadência +15%', desc: 'Os canhões disparam mais rápido.', max: 5, icon: 'rapid' },
  bigshot:  { name: 'Projétil maior', desc: 'Tiros 35% maiores, mais fáceis de acertar.', max: 3, icon: 'bigshot' },
  twin:     { name: 'Tiro duplo', desc: 'Um segundo canhão até o fim da partida.', max: 1, icon: 'double' },
  spread:   { name: 'Tiro triplo', desc: 'Leque de três tiros até o fim da partida.', max: 1, icon: 'triple', requires: 'twin' },
  pierce:   { name: 'Perfuração', desc: 'Cada tiro atravessa mais um inimigo.', max: 2, icon: 'pierce' },
  crit:     { name: 'Crítico', desc: '+10% de chance de causar 2,5× o dano.', max: 3, icon: 'crit' },
  speed:    { name: 'Propulsores', desc: 'Nave 15% mais rápida.', max: 3, icon: 'speed' },
  repair:   { name: 'Reparo', desc: 'Recupera 2 pontos de vida agora.', max: 99, icon: 'heal', needsDamage: true },
  vitality: { name: 'Blindagem', desc: '+1 de vida máxima e recupera 1.', max: 3, icon: 'heal' },
  aegis:    { name: 'Escudo periódico', desc: 'Escudo de 3 s a cada 18 s (12 s no nível 2).', max: 2, icon: 'shield' },
  magnet:   { name: 'Ímã', desc: 'Puxa power-ups de longe.', max: 1, icon: 'magnet' },
  lasting:  { name: 'Duração', desc: 'Power-ups duram 40% mais.', max: 2, icon: 'time' }
};

export const LEVELING = { base: 8, growth: 6, curve: 1.18 };
export const xpForLevel = level => Math.round(LEVELING.base + LEVELING.growth * Math.max(0, level - 1) ** LEVELING.curve);

export const WAVES = {
  bossEvery: 5,
  intro: 1.6,
  rest: 1.5,
  bossWarning: 2,
  baseCount: 9,
  perWave: 2.3,
  maxCount: 64,
  gapStart: 1.62,
  gapMin: 0.55,
  gapStep: 0.055,
  speedPerWave: 0.022,
  speedMax: 1.55,
  hpPerWave: 0.06,
  firePerWave: 0.03,
  maxEnemies: 42
};

// Padrões de ataque dos chefes. `telegraph` é o aviso visual antes do ataque:
// todo golpe é anunciado, nada chega sem dar tempo de reagir.
export const PATTERNS = {
  aimed3:        { telegraph: 0.45, kind: 'aimed', count: 3, spread: 0.28, speed: 190, repeat: 2, gap: 0.35 },
  aimed5:        { telegraph: 0.45, kind: 'aimed', count: 5, spread: 0.5, speed: 200, repeat: 2, gap: 0.4 },
  burst:         { telegraph: 0.35, kind: 'aimed', count: 1, spread: 0, speed: 265, repeat: 8, gap: 0.12 },
  fan7:          { telegraph: 0.5, kind: 'fan', count: 7, spread: 1.1, speed: 170, repeat: 2, gap: 0.5 },
  fan9:          { telegraph: 0.5, kind: 'fan', count: 9, spread: 1.4, speed: 185, repeat: 3, gap: 0.45 },
  ring12:        { telegraph: 0.55, kind: 'ring', count: 12, speed: 130, repeat: 2, gap: 0.6, twist: 0 },
  ring12twist:   { telegraph: 0.55, kind: 'ring', count: 12, speed: 140, repeat: 3, gap: 0.45, twist: 0.13 },
  ring16:        { telegraph: 0.55, kind: 'ring', count: 16, speed: 140, repeat: 2, gap: 0.55, twist: 0.1 },
  ring20:        { telegraph: 0.5, kind: 'ring', count: 20, speed: 150, repeat: 3, gap: 0.5, twist: 0.08 },
  spiral:        { telegraph: 0.5, kind: 'spiral', arms: 1, rate: 14, spin: 3.2, speed: 150, duration: 2.8 },
  spiral2:       { telegraph: 0.4, kind: 'spiral', arms: 2, rate: 16, spin: 4, speed: 165, duration: 2.6 },
  spiral3:       { telegraph: 0.5, kind: 'spiral', arms: 3, rate: 18, spin: 2.4, speed: 140, duration: 3 },
  curtain:       { telegraph: 0.95, kind: 'curtain', rows: 3, gap: 0.55, speed: 125, hole: 78 },
  charge:        { telegraph: 0.9, kind: 'charge', speed: 540 },
  drones:        { telegraph: 0.5, kind: 'summon', type: 'drone', count: 4 },
  darts:         { telegraph: 0.5, kind: 'summon', type: 'dart', count: 3 },
  hunters:       { telegraph: 0.5, kind: 'summon', type: 'hunter', count: 2 }
};

// A vida do chefe é o relógio da luta: cada 10 pontos valem cerca de um segundo
// de mira certeira no meio da partida, e na prática o jogador passa a maior
// parte do tempo desviando. Vida alta demais não deixa a luta difícil, deixa
// longa — e o desgaste cobra a vida do jogador antes da perícia.
// A vida dos chefes foi reduzida a 60% na passagem para 3D. Ela tinha sido
// calibrada contra um alvo no topo da tela, acertado por tiro que subia pela
// coluna; contra um chefe que varre lateralmente a quinhentas unidades de
// distância, a taxa de acerto sustentada é bem menor. Medido com seis
// sementes: sem o corte, seis de seis partidas terminavam na onda 5.
export const BOSSES = [
  { id: 'prisma', name: 'Guardião Prisma', color: '#5ff4ff', radius: 42, hp: 55,
    phases: [
      { speed: 40, rest: 1, patterns: ['aimed3', 'ring12', 'aimed3'] },
      { speed: 55, rest: 0.8, patterns: ['spiral', 'aimed5', 'ring16'] },
      { speed: 72, rest: 0.55, patterns: ['curtain', 'spiral2', 'aimed5', 'drones'] }
    ] },
  { id: 'vespa', name: 'Vespa Ômega', color: '#ffb13d', radius: 44, hp: 112,
    phases: [
      { speed: 60, rest: 1, patterns: ['fan7', 'aimed3', 'fan7'] },
      { speed: 75, rest: 0.8, patterns: ['charge', 'fan9', 'darts'] },
      { speed: 95, rest: 0.55, patterns: ['charge', 'burst', 'ring16', 'fan9'] }
    ] },
  { id: 'eclipse', name: 'Núcleo Eclipse', color: '#c07bff', radius: 40, hp: 161,
    phases: [
      { speed: 30, rest: 1, patterns: ['ring12', 'aimed3', 'ring12twist'] },
      { speed: 40, rest: 0.8, patterns: ['spiral3', 'hunters', 'ring16'] },
      { speed: 55, rest: 0.55, patterns: ['curtain', 'spiral3', 'burst', 'ring20'] }
    ] }
];
export const BOSS = { hpPerCycle: 0.55, phaseAt: [0.66, 0.33], enterY: 0.2, contact: 2 };

export const SCORE = {
  comboStep: 10, comboBonus: 0.25, comboMaxMult: 3,
  waveClear: 250, flawlessMult: 2, boss: 3000, perSecond: 10, pickup: 50
};
export const comboMultiplier = combo =>
  Math.min(SCORE.comboMaxMult, 1 + Math.floor(Math.max(0, combo) / SCORE.comboStep) * SCORE.comboBonus);

export const FX = { particlesFull: 320, particlesLow: 90, floats: 14 };

// Ícones em path SVG (viewBox 24×24, traço). A mesma string vira <svg> nos
// cartões e Path2D no canvas: o ícone do power-up que cai é o do cartão.
export const ICONS = {
  heal: 'M12 5v14M5 12h14',
  shield: 'M12 3 5 6v6c0 4.2 3 7.4 7 9 4-1.6 7-4.8 7-9V6z',
  rapid: 'M6 12.5l6-6 6 6M6 18.5l6-6 6 6',
  double: 'M8 20V5M16 20V5M5.5 8 8 5l2.5 3M13.5 8 16 5l2.5 3',
  triple: 'M12 20V4M12 20 5.5 6.5M12 20l6.5-13.5M9.5 6 12 3.5 14.5 6',
  pierce: 'M2 12h18M15 7l5 5-5 5M8 6.5v11',
  power: 'M13 2.5 5 14h6l-1 7.5 8-11.5h-6z',
  slow: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  bomb: 'M11 21a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM15.5 7.5 18 5M19 2.5v2M21.5 5h-2',
  bigshot: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5',
  crit: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4',
  speed: 'M12 3 19 20l-7-4-7 4z',
  magnet: 'M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3zM6 7h4M14 7h4',
  time: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
  skull: 'M12 3a8 8 0 0 0-5 14.2V21h10v-3.8A8 8 0 0 0 12 3zM9 11h.01M15 11h.01M10 17v4M14 17v4',
  wave: 'M2 15c2.5 0 2.5-6 5-6s2.5 6 5 6 2.5-6 5-6 2.5 6 5 6',
  combo: 'M13 2.5 5 14h6l-1 7.5 8-11.5h-6z',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'
};
