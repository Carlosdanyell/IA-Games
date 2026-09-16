// Catálogo da biblioteca. Adicionar um jogo = criar a pasta em /games e
// acrescentar uma entrada aqui. O launcher e o shell leem daqui.
export const GAMES = [
  {
    id: 'neon-snake',
    title: 'Neon Snake',
    tagline: 'Siga seu instinto. Quatro modos, seis arenas e combos neon.',
    tags: ['Snake', '4 modos', 'Horizontal'],
    accent: '#b9ff66',
    status: 'ready',
    entry: './games/neon-snake/index.js',
    art: 'snake'
  },
  {
    id: 'neon-break',
    title: 'Neon Break',
    tagline: 'Quebra-blocos com multibola, bônus e 25 arenas.',
    tags: ['Arcade', '1 jogador', 'Offline'],
    accent: '#bf8cff',
    status: 'ready',
    entry: './games/neon-break/index.js',
    art: 'neon'
  },
  {
    id: 'neon-words',
    title: 'Neon Words',
    tagline: 'Conecte letras e complete 25 cruzadinhas em português.',
    tags: ['Palavras', '25 fases', 'Offline'],
    accent: '#ff9c78',
    status: 'ready',
    entry: './games/neon-words/index.js',
    art: 'words'
  },
  {
    id: 'neon-arrow',
    title: 'Neon Arrow',
    tagline: 'Acerte a maçã na cabeça. Errar tem consequência.',
    tags: ['Mira', 'Horizontal', 'Sangue'],
    accent: '#ff5f6d',
    status: 'ready',
    entry: './games/neon-arrow/index.js',
    art: 'arrow'
  },
  {
    id: 'eight-ball',
    title: 'Neon Pool',
    tagline: 'Sinuca 8-ball. Desafie a máquina ou um amigo no mesmo Wi-Fi.',
    tags: ['Sinuca', 'Multiplayer LAN', 'Horizontal'],
    accent: '#5fd39b',
    status: 'ready',
    entry: './games/eight-ball/index.js',
    art: 'pool'
  },
  {
    id: 'neon-grid',
    title: 'Neon Grid',
    tagline: 'Três em linha, luzes neon e uma IA em três níveis.',
    tags: ['Jogo da velha', '3 níveis de IA', 'Offline'],
    accent: '#5fd5ff',
    status: 'ready',
    entry: './games/neon-grid/index.js',
    art: 'grid'
  },
  {
    id: 'neon-drop',
    title: 'Neon Drop',
    tagline: 'Lig 4 com nove tabuleiros e quatro níveis de máquina.',
    tags: ['Lig 4', '9 fases', '2 jogadores'],
    accent: '#ffd166',
    status: 'ready',
    entry: './games/neon-drop/index.js',
    art: 'drop'
  },
  {
    id: 'neon-shooter',
    title: 'Neon Shooter',
    tagline: 'Tiro espacial em ondas, chefes e melhorias a cada nível.',
    tags: ['Arcade', 'Chefes', 'Offline'],
    accent: '#ff4fd8',
    status: 'ready',
    entry: './games/neon-shooter/index.js',
    art: 'shooter'
  },
  {
    id: 'neon-slither',
    title: 'Neon Slither',
    tagline: 'Arena aberta com rivais controlados por IA: colete luz e cresça.',
    tags: ['Arena', 'Rivais por IA', 'Offline'],
    accent: '#65f3cb',
    status: 'ready',
    entry: './games/neon-slither/index.js',
    art: 'slither'
  }
];

export const getGame = id => GAMES.find(g => g.id === id) || null;
