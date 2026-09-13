import { createRng } from '../../core/rng.js';
import { SPEED } from './config.js';
import { PALETTE_CYCLE } from '../../core/theme.js';

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
  },
  {
    name: 'ATLAS', palette: 'azul', shape: 'grid', speed: 323,
    hint: 'Blocos blindados II em pares e dois explosivos ✳ no centro.',
    map: [
      'ooooooo',
      'oAoWoAo',
      'ooXoXoo',
      '.oPoHo.',
      'ooo.ooo'
    ]
  },
  {
    name: 'RIGEL', palette: 'rosa', shape: 'orbit', speed: 325,
    hint: 'Os espelhos ◹ devolvem a bola em diagonal exata. Use isso a seu favor.',
    map: [
      '.oMoMo.',
      'oZoooZo',
      'oo#o#oo',
      'oWo.oSo',
      '.oXoXo.',
      'ooo.ooo'
    ]
  },
  {
    name: 'ÂNCORA', palette: 'ambar', shape: 'rays', speed: 326,
    hint: 'A cápsula ♥ vale uma vida. Vale a pena arriscar para pegá-la.',
    map: [
      'ooooooo',
      'oA.E.Ao',
      'o#ooo#o',
      'oPoXoHo',
      '.oo.oo.',
      'ooLoKoo'
    ]
  },
  {
    name: 'TÉTHYS', palette: 'purple', shape: 'diamonds', speed: 328,
    hint: 'Dois blocos ⇢ deslizam pelo corredor. Antecipe o movimento.',
    map: [
      '.AAoAA.',
      'oo>.>oo',
      'oMo#oSo',
      '.oXoXo.',
      'oRo.oRo',
      'ooFoBoo'
    ]
  },
  {
    name: 'HÉLIX', palette: 'red', shape: 'nova', speed: 329,
    hint: 'Os gêmeos ⧉ caem juntos: acerte um e o par vai embora.',
    map: [
      'ooTooTo',
      '.o#o#o.',
      'oXoMoXo',
      'oo.W.oo',
      'oPo#oHo',
      '.ooooo.'
    ]
  },
  {
    name: 'ÍON', palette: 'orange', shape: 'grid', speed: 330,
    hint: 'O gerador ⊕ repõe blocos a cada nove segundos. Não deixe acumular.',
    map: [
      'oooGooo',
      'oAo.oAo',
      'ooXoXoo',
      'oWo#oSo',
      '.oPoHo.',
      'ooLoNoo'
    ]
  },
  {
    name: 'CRÔMIO', palette: 'cyan', shape: 'orbit', speed: 332,
    hint: 'Fortaleza de blindados. O perfurante ⊚ abre caminho reto.',
    map: [
      '.AAAAA.',
      'oo#o#oo',
      'oZoMoZo',
      '.oXoXo.',
      'oRoFoRo',
      'ooo.ooo',
      '.oKoBo.'
    ]
  },
  {
    name: 'LUMEN', palette: 'verde', shape: 'rays', speed: 333,
    hint: 'Outra vida ♥ atrás do aço. Explosões ✳ chegam onde a bola não chega.',
    map: [
      'ooooooo',
      'oA#E#Ao',
      'ooooooo',
      '.oXoXo.',
      'oMo.oSo',
      'ooToToo',
      '.oPoHo.'
    ]
  },
  {
    name: 'ZÊNITE', palette: 'azul', shape: 'diamonds', speed: 335,
    hint: 'Móveis na primeira linha e a cápsula ⇄ escondida no meio.',
    map: [
      'oo>.>oo',
      '.AoooA.',
      'o#oMo#o',
      'ooXoXoo',
      'oWo.oIo',
      '.oRoRo.',
      'oooLooo'
    ]
  },
  {
    name: 'NADIR', palette: 'rosa', shape: 'nova', speed: 336,
    hint: 'Aço em cruz e dois geradores. Priorize os ⊕ antes que se espalhem.',
    map: [
      'AAAoAAA',
      'o#ooo#o',
      'oZoXoZo',
      '.oMoSo.',
      'oGo.oGo',
      'ooo#ooo',
      '.oHoPo.'
    ]
  },
  {
    name: 'BÓREAS', palette: 'ambar', shape: 'grid', speed: 337,
    hint: 'Gêmeos no alto, móveis embaixo e o ímã ⊂ para você mirar.',
    map: [
      'ooooooo',
      'oTo.oTo',
      'o#XoX#o',
      'ooMoWoo',
      '.o>.>o.',
      'oAoooAo',
      'ooKoBoo'
    ]
  },
  {
    name: 'MERIDIANO', palette: 'purple', shape: 'orbit', speed: 339,
    hint: 'Corredores estreitos entre o aço. Paciência rende mais que força.',
    map: [
      '.ooooo.',
      'oA#o#Ao',
      'ooXoXoo',
      'oMo.oFo',
      '.oRoRo.',
      'oo#o#oo',
      'oPoNoHo'
    ]
  },
  {
    name: 'VÓRTICE', palette: 'red', shape: 'rays', speed: 340,
    hint: 'Vida extra ♥ na primeira linha, dois geradores embaixo.',
    map: [
      'oooEooo',
      '.A#o#A.',
      'ooZoZoo',
      'oXo.oXo',
      '.oMoSo.',
      'oGoooGo',
      'ooLoIoo'
    ]
  },
  {
    name: 'ARGOS', palette: 'orange', shape: 'diamonds', speed: 342,
    hint: 'Três colunas de aço. Os explosivos são o único atalho.',
    map: [
      'AAoooAA',
      'o#o#o#o',
      'ooXoXoo',
      'oTo.oTo',
      '.oMoWo.',
      'oRo#oRo',
      'ooPoHoo'
    ]
  },
  {
    name: 'CALIXTO', palette: 'cyan', shape: 'nova', speed: 343,
    hint: 'Blindados, móveis, espelhos e geradores na mesma arena.',
    map: [
      '.AAAAA.',
      'oo>.>oo',
      'oZoXoZo',
      'ooMoBoo',
      '.o#o#o.',
      'oGoooGo',
      'oLoNoKo'
    ]
  },
  {
    name: 'TITÃ', palette: 'verde', shape: 'grid', speed: 344,
    hint: 'Blindados encaixados no aço. Multiplique as bolinhas cedo.',
    map: [
      'ooooooo',
      'A#AoA#A',
      'ooXoXoo',
      'oMo.oSo',
      '.oToTo.',
      'oR#o#Ro',
      'ooHoPoo'
    ]
  },
  {
    name: 'RÉGULUS', palette: 'azul', shape: 'orbit', speed: 346,
    hint: 'Móveis no centro e dois espelhos logo abaixo. Cuidado com o ⇄.',
    map: [
      'oAoooAo',
      '.o#o#o.',
      'oXoMoXo',
      'oo>.>oo',
      'oZo.oZo',
      '.oWoFo.',
      'ooIoLoo'
    ]
  },
  {
    name: 'ALCYONE', palette: 'rosa', shape: 'rays', speed: 347,
    hint: 'A última vida ♥ da campanha. Depois daqui, só o que você trouxer.',
    map: [
      'ooooooo',
      'oA.E.Ao',
      'o#XoX#o',
      'ooMoSoo',
      '.oGoGo.',
      'oToooTo',
      'ooBoHoo'
    ]
  },
  {
    name: 'ÉREBO', palette: 'ambar', shape: 'diamonds', speed: 349,
    hint: 'Aço alternado, regenerativos nas laterais e móveis na base.',
    map: [
      'AAAoAAA',
      'o#o#o#o',
      'oXoZoXo',
      '.oMoWo.',
      'oRo.oRo',
      'o>ooo>o',
      'oPoNoKo'
    ]
  },
  {
    name: 'SINGULARIDADE', palette: 'purple', shape: 'nova', speed: 350,
    hint: 'Tudo de uma vez. Guarde o escudo ◇ para o fim.',
    map: [
      'AAAMAAA',
      '#oXoXo#',
      'oZo.oZo',
      'oGoRoGo',
      '.oToTo.',
      'o#o#o#o',
      'oLoBoIo'
    ]
  }
];

const SHAPES = ['grid', 'orbit', 'rays', 'diamonds', 'nova'];
const PALETTES = PALETTE_CYCLE;
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
    // Vida extra é rara de propósito: no infinito ela é o que estica a corrida.
    grid[r][c] = rng.chance(0.05) ? 'E'
      : index >= 3 && rng.chance(0.18) ? rng.pick(bad)
      : rng.pick(good);
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
