// Catálogo da biblioteca. Adicionar um jogo = criar a pasta em /games e
// acrescentar uma entrada aqui. O launcher e o shell leem daqui.
export const GAMES = [
  {
    id: 'neon-break',
    title: 'Neon Break',
    tagline: 'Quebra-blocos com multibola, bônus e cinco arenas.',
    tags: ['Arcade', '1 jogador', 'Offline'],
    accent: '#bf8cff',
    status: 'ready',
    entry: './games/neon-break/index.js',
    art: 'neon'
  }
];

export const getGame = id => GAMES.find(g => g.id === id) || null;
