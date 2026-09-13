// Tabela única de blocos e cápsulas. Render, lógica de jogo e o guia da tela
// de ajustes leem daqui — não existe símbolo duplicado em dois lugares.

export const POWERS = {
  M: { symbol: '×3', name: 'Multibola', desc: 'Mais 2 bolinhas, até 6 em jogo.' },
  W: { symbol: '↔',  name: 'Expansão', desc: 'Plataforma maior por 12 segundos.' },
  S: { symbol: '↓',  name: 'Câmera lenta', desc: '26% mais devagar por 10 segundos.' },
  F: { symbol: '↑',  name: 'Turbo', desc: '26% mais rápido e pontos em dobro por 8s.' },
  H: { symbol: '◇',  name: 'Escudo', desc: 'Barreira que salva 2 quedas.' },
  P: { symbol: '+',  name: 'Bônus', desc: '250 pontos na hora da captura.' },
  L: { symbol: '⌁',  name: 'Laser', desc: 'Toque na arena para atirar. 10 segundos.' },
  K: { symbol: '⊂',  name: 'Ímã', desc: 'A plataforma segura a bola e você mira. 12s.' },
  B: { symbol: '⊚',  name: 'Perfurante', desc: 'A bola atravessa blocos por 8 segundos.' },
  N: { symbol: '▭',  name: 'Encolher', desc: 'Plataforma menor por 8 segundos.', bad: true },
  I: { symbol: '⇄',  name: 'Inversão', desc: 'Controles invertidos por 5 segundos.', bad: true },
  E: { symbol: '♥',  name: 'Vida extra', desc: 'Mais uma vida, até o limite de cinco.' }
};

// hp finito = destrutível. `steel` nunca entra na contagem de blocos restantes.
export const BRICKS = {
  o:   { hp: 1 },
  A:   { hp: 2, symbol: 'II', crack: true },
  '#': { hp: Infinity, steel: true, symbol: '∞' },
  X:   { hp: 1, explosive: true, symbol: '✳' },
  Z:   { hp: 1, mirror: true, symbol: '◹' },
  R:   { hp: 1, regen: true, symbol: '↺' },
  T:   { hp: 1, twin: true, symbol: '⧉' },
  G:   { hp: 2, spawner: true, symbol: '⊕', crack: true },
  '>': { hp: 1, moving: true, symbol: '⇢' }
};

for (const key of Object.keys(POWERS)) {
  BRICKS[key] = { hp: 1, power: key, symbol: POWERS[key].symbol, bad: POWERS[key].bad };
}

export const brickDef = kind => BRICKS[kind] || BRICKS.o;
export const isSteel = kind => !!brickDef(kind).steel;

export const GUIDE_BRICKS = [
  { symbol: 'II', name: 'Blindado', desc: 'Dois impactos. Racha no primeiro.' },
  { symbol: '∞',  name: 'Aço', desc: 'Rebate a bola. Não precisa ser destruído.' },
  { symbol: '✳',  name: 'Explosivo', desc: 'Explode e atinge os oito vizinhos.' },
  { symbol: '◹',  name: 'Espelho', desc: 'Devolve a bola numa diagonal de 45°.' },
  { symbol: '↺',  name: 'Regenerativo', desc: 'Volta a existir 15 segundos depois.' },
  { symbol: '⧉',  name: 'Gêmeo', desc: 'Destruir um destrói o par imediatamente.' },
  { symbol: '⊕',  name: 'Gerador', desc: 'Cria um bloco vizinho a cada 9 segundos.' },
  { symbol: '⇢',  name: 'Móvel', desc: 'Desliza na horizontal dentro da linha.' }
];
