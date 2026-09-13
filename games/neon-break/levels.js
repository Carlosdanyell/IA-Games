import { createRng } from '../../core/rng.js';
import { SPEED } from './config.js';

// Fases desenhadas à mão da campanha. Cada linha tem 7 colunas.
export const PHASES = [
  {
    name: 'NÉBULA', palette: 'purple', shape: 'grid',
    hint: 'Capture ×3 para multiplicar as bolinhas. Os blocos ✳ explodem e atingem os vizinhos.',
    map: [
      'ooooooo',
      'oWoooSo',
      'ooXoXoo',
      'oPoooHo',
      'oo.M.oo'
    ]
  },
  {
    name: 'ECLIPSE', palette: 'red', shape: 'orbit',
    hint: 'Contorne o bloco ∞. Os blocos II precisam de duas rebatidas e o ⊂ segura a bola para você mirar.',
    map: [
      '..AAA..',
      '.oMooo.',
      'Wo...oS',
      'o..#..o',
      'oP...Ho',
      '.ooXoo.',
      '..oKo..'
    ]
  },
  {
    name: 'SOLAR', palette: 'orange', shape: 'rays',
    hint: 'O espelho ◹ devolve a bola em diagonal. O laser ⌁ abre caminho: toque na arena para atirar.',
    map: [
      'FoooooS',
      '.AXXA..',
      '..oZoW.',
      '#..M..#',
      '.oXoXo.',
      'oA.L.Ao',
      'PooHooo'
    ]
  },
  {
    name: 'PRISMA', palette: 'purple', shape: 'diamonds',
    hint: 'Fortaleza blindada. Os gêmeos ⧉ caem juntos, o ↺ volta em 15s e o ⊚ atravessa tudo.',
    map: [
      'AAAMAAA',
      'o#oRo#o',
      'WoXoXoS',
      '.ATTA..',
      'o#.H.#o',
      '.oPBNo.',
      'oo...oo'
    ]
  },
  {
    name: 'SUPERNOVA', palette: 'red', shape: 'nova',
    hint: 'Última arena. O gerador ⊕ repõe blocos e os móveis ⇢ não param. Cuidado com a cápsula ⇄.',
    map: [
      '..AMA..',
      '.AXZXA.',
      'So#G#oW',
      'Mo>#>oF',
      'Ho#I#oS',
      '.AXPXA.',
      '..oLo..'
    ]
  }
];

const SHAPES = ['grid', 'orbit', 'rays', 'diamonds', 'nova'];
const PALETTES = ['purple', 'red', 'orange', 'cyan'];
const NAMES = ['ÓRBITA', 'QUASAR', 'PULSAR', 'ÍON', 'CINTURÃO', 'MERIDIANO', 'VÓRTICE',
               'HÉLIO', 'CRÔMIO', 'ZÊNITE', 'ÂNCORA', 'ESTREITO', 'CORONA', 'RELÍQUIA'];

// Fase procedural com simetria horizontal: dificuldade cresce com o índice,
// mas o mapa nunca fica injusto (sempre há caminho e sempre há bônus).
export function generatePhase(index, seed) {
  const rng = createRng(seed + index * 7919);
  const rows = index < 3 ? 5 : index < 8 ? 6 : 7;
  const cols = 7;
  const half = Math.ceil(cols / 2);
  const density = Math.min(0.86, 0.58 + index * 0.022);
  const hard = Math.min(0.34, index * 0.018);
  const special = Math.min(0.3, 0.08 + index * 0.014);

  const grid = [];
  for (let r = 0; r < rows; r++) {
    const line = new Array(cols).fill('.');
    for (let c = 0; c < half; c++) {
      if (!rng.chance(density)) continue;
      let kind = 'o';
      if (rng.chance(hard)) kind = rng.chance(0.32) ? '#' : 'A';
      else if (rng.chance(special)) kind = rng.pick(['X', 'Z', 'R', 'G', '>']);
      line[c] = kind;
      line[cols - 1 - c] = kind;
    }
    grid.push(line);
  }

  // Gêmeos entram em par, sempre espelhados.
  if (index >= 4 && rng.chance(0.5)) {
    const r = rng.int(0, rows - 1);
    const c = rng.int(0, half - 2);
    if (grid[r][c] !== '#') { grid[r][c] = 'T'; grid[r][cols - 1 - c] = 'T'; }
  }

  // Garante ao menos três cápsulas por fase, uma delas sempre útil.
  const good = ['M', 'W', 'S', 'F', 'H', 'P', 'L', 'K', 'B'];
  const bad = ['N', 'I'];
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c] === 'o') slots.push([r, c]);
  }
  const capsules = Math.min(slots.length, 3 + Math.floor(index / 3));
  for (let i = 0; i < capsules && slots.length; i++) {
    const pick = rng.int(0, slots.length - 1);
    const [r, c] = slots.splice(pick, 1)[0];
    grid[r][c] = index >= 3 && rng.chance(0.18) ? rng.pick(bad) : rng.pick(good);
  }

  // Nenhuma linha pode ser uma parede maciça de aço.
  for (const line of grid) {
    if (line.every(k => k === '#')) line[rng.int(0, cols - 1)] = 'o';
  }
  // Precisa existir pelo menos um bloco destrutível.
  if (!grid.some(line => line.some(k => k !== '.' && k !== '#'))) {
    grid[0][3] = 'o';
  }

  return {
    name: `${NAMES[index % NAMES.length]}-${String(index + 1).padStart(2, '0')}`,
    palette: PALETTES[index % PALETTES.length],
    shape: SHAPES[index % SHAPES.length],
    hint: 'Arena gerada. A dificuldade sobe a cada fase — sobreviva o máximo que conseguir.',
    map: grid.map(line => line.join('')),
    speed: Math.min(SPEED.endlessMax, SPEED.endlessBase + index * SPEED.endlessStep)
  };
}

export function phaseSpeed(phase, index) {
  return phase.speed || SPEED.phase[Math.min(index, SPEED.phase.length - 1)];
}
