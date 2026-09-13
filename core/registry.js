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
  }
];

export const getGame = id => GAMES.find(g => g.id === id) || null;
