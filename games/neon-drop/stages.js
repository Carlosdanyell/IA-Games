import { PALETTE_CYCLE } from '../../core/theme.js';

// Nove tabuleiros. O que muda de um para o outro é a geometria — tamanho,
// quantas peças fazem linha e onde estão os obstáculos —, e cada mudança
// dessas vira uma partida diferente: em coluna estreita a diagonal some, com
// bloqueio no meio a coluna central deixa de ser a melhor jogada, e conectar
// cinco exige espaço que só o tabuleiro grande tem.
//
// `blocked` lista pares [coluna, linha], com a linha 0 no topo. A peça para em
// cima do bloqueio, então o que fica embaixo dele é um bolso morto.
export const STAGES = [
  {
    name: 'CLÁSSICO', palette: 'purple', cols: 7, rows: 6, connect: 4,
    hint: 'Sete colunas, seis linhas, quatro em linha. A coluna do meio participa de mais linhas que qualquer outra.'
  },
  {
    name: 'RELÂMPAGO', palette: 'cyan', cols: 6, rows: 5, connect: 4,
    hint: 'Tabuleiro curto: dá menos tempo para armar. Quem ameaça primeiro manda na partida.'
  },
  {
    name: 'TORRE', palette: 'azul', cols: 5, rows: 8, connect: 4,
    hint: 'Alto e estreito. Aqui a coluna vertical é a ameaça mais rápida — e a mais fácil de bloquear.'
  },
  {
    name: 'SALÃO', palette: 'verde', cols: 9, rows: 6, connect: 4,
    hint: 'Largo demais para vigiar tudo. Duas ameaças distantes valem mais que uma no centro.'
  },
  {
    name: 'PILARES', palette: 'ambar', cols: 7, rows: 6, connect: 4,
    blocked: [[2, 4], [2, 3], [4, 4], [4, 3]],
    hint: 'Dois pilares no meio. As peças param em cima deles e o espaço embaixo fica morto.'
  },
  {
    name: 'AMPULHETA', palette: 'orange', cols: 7, rows: 7, connect: 4,
    blocked: [[1, 5], [2, 4], [4, 4], [5, 5], [3, 3]],
    hint: 'O funil empurra o jogo para as bordas. Diagonais longas ficam mais valiosas.'
  },
  {
    name: 'CINCO', palette: 'rosa', cols: 9, rows: 7, connect: 5,
    hint: 'Cinco em linha. Ameaça de quatro não ganha sozinha: sempre sobra uma casa para o bloqueio.'
  },
  {
    name: 'CRUZ', palette: 'red', cols: 8, rows: 7, connect: 4,
    blocked: [[3, 3], [4, 3], [3, 2], [4, 2], [3, 4], [4, 4]],
    hint: 'Um bloco no centro parte o tabuleiro em dois lados. Escolha um e feche antes de trocar.'
  },
  {
    name: 'FINAL', palette: 'red', cols: 9, rows: 8, connect: 5,
    blocked: [[2, 6], [6, 6], [4, 4], [0, 5], [8, 5]],
    hint: 'Tudo junto: tabuleiro grande, cinco em linha e obstáculos espalhados.'
  }
];

// O renderizador precisa saber quais casas são bloqueio sem varrer a lista a
// cada quadro; o conjunto de índices vai junto da fase.
export const withBlocked = stage => ({
  ...stage,
  blocked: stage.blocked || [],
  connect: stage.connect || 4,
  blockedSet: new Set((stage.blocked || []).map(([c, r]) => r * stage.cols + c))
});

export const stageAt = index => withBlocked(STAGES[Math.max(0, Math.min(STAGES.length - 1, index))]);

// Modo livre gera tabuleiros além dos desenhados à mão, sempre reproduzíveis.
export function generateStage(index, rng) {
  const cols = 6 + Math.floor(rng.next() * 4);
  const rows = 5 + Math.floor(rng.next() * 4);
  const connect = cols >= 8 && rows >= 7 && rng.chance(0.35) ? 5 : 4;
  const blocked = [];
  const quantos = Math.floor(rng.next() * 5);
  for (let i = 0; i < quantos; i++) {
    const c = 1 + Math.floor(rng.next() * (cols - 2));
    const r = 2 + Math.floor(rng.next() * (rows - 3));
    if (!blocked.some(([bc, br]) => bc === c && br === r)) blocked.push([c, r]);
  }
  return withBlocked({
    name: `CAMPO ${String(index + 1).padStart(2, '0')}`,
    palette: PALETTE_CYCLE[index % PALETTE_CYCLE.length],
    cols, rows, connect, blocked,
    hint: 'Tabuleiro sorteado: tamanho, alvo e obstáculos mudam a cada rodada.'
  });
}
