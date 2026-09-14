// Catálogo da biblioteca. Adicionar um jogo = criar a pasta em /games e
// acrescentar uma entrada aqui. O launcher e o shell leem daqui.
export const GAMES = [
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
  }
];

export const getGame = id => GAMES.find(g => g.id === id) || null;
