// Sintonia do Neon Drop em um lugar só.

// Campo lógico: acompanha o formato do contêiner para o canvas preencher a
// arena em pé e deitado. O tabuleiro em si é encaixado dentro disso pelo
// renderizador, que calcula o tamanho da casa a partir das colunas e linhas
// da fase — é o que permite fases de 5x8 e 9x8 na mesma tela.
export function logicalSize(aspect) {
  const base = 470;
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const raiz = Math.sqrt(Math.max(0.2, Math.min(5, aspect)));
  return {
    w: Math.round(clamp(base * raiz, 330, 900) / 10) * 10,
    h: Math.round(clamp(base / raiz, 300, 720) / 10) * 10
  };
}

// Cores das peças. Fixas de propósito. Antes a peça 1 usava a cor de destaque
// do tema, que muda por fase: nas fases de paleta ciano e âmbar as duas peças
// saíam praticamente da mesma cor e o tabuleiro virava um borrão. Âmbar contra
// ciano é o par que mais se separa, inclusive para quem tem daltonismo — a
// diferença é quente contra fria, não vermelho contra verde. Como reforço, cada
// peça tem também um desenho interno próprio (anel e núcleo), então dá para
// distinguir mesmo sem enxergar cor nenhuma.
export const DISCS = {
  1: { dark: '#ffc24a', light: '#9a6200', name: 'ÂMBAR', word: 'âmbar', glyph: 'ring' },
  2: { dark: '#4fd1ff', light: '#0a6d92', name: 'CIANO', word: 'ciano', glyph: 'core' }
};

export const BOARD = {
  margin: 12,        // folga entre o tabuleiro e a borda do campo
  topBand: 34,       // faixa de cima, onde fica a peça pronta para cair
  strip: 30,         // faixa reservada no topo para o aviso de vez
  rail: 16,          // trilho de colunas embaixo do tabuleiro
  gap: 0.1,          // fração da casa usada como respiro entre as peças
  radius: 0.34,      // arredondamento do quadro, em frações da casa
  maxCell: 96,
  minCell: 18
};

export const DROP = {
  gravity: 3400,     // unidades lógicas/s²: a peça cai com peso
  bounce: 0.22,
  settle: 34,        // abaixo desta velocidade a peça para de quicar
  maxBounces: 2
};

// Quatro níveis. `depth` é o teto de profundidade e `budget` o tempo máximo de
// busca por jogada — quem manda de verdade é o tempo, então a jogada sai
// rápida tanto num celular antigo quanto num tabuleiro grande.
export const LEVELS = {
  facil: {
    label: 'Fácil', depth: 2, noise: 0.5, budget: 25, delay: 0.45, bonus: 0.7,
    note: 'Enxerga pouco e erra metade das jogadas de propósito.'
  },
  medio: {
    label: 'Médio', depth: 4, noise: 0.15, budget: 60, delay: 0.55, bonus: 1,
    note: 'Quatro jogadas à frente, com um descuido de vez em quando.'
  },
  dificil: {
    label: 'Difícil', depth: 8, noise: 0.03, budget: 150, delay: 0.7, bonus: 1.5,
    note: 'Oito jogadas à frente e quase nenhum descuido.'
  },
  mestre: {
    label: 'Mestre', depth: 16, noise: 0, budget: 420, delay: 0.85, bonus: 2.2,
    note: 'Pensa o quanto o tempo deixar. Ganhar dele é conquista.'
  }
};

export const MODES = {
  campanha: { label: 'Campanha', ai: true },
  livre: { label: 'Fase livre', ai: true },
  duo: { label: 'Dois jogadores', ai: false }
};

export const SCORE = {
  win: 200,
  perStage: 60,      // fases mais adiante valem mais
  fast: 12,          // bônus por jogada economizada
  draw: 40
};

export const TIMING = {
  reveal: 0.9,       // pausa depois da linha fechar, antes do resultado
  banner: 2.2,
  hint: 1.6
};
