// SVGs independentes e locais: mesmo viewBox, centro X=46 e base Y=84.
// O tamanho da casa escala desenho, contorno e sombra juntos. Os degradês
// pertencem a cada imagem, sem IDs compartilhados nem interferência do shell.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, typeOf, colorOf } from './model.js';

const FILES = { [PAWN]: 'pawn', [KNIGHT]: 'knight', [BISHOP]: 'bishop',
  [ROOK]: 'rook', [QUEEN]: 'queen', [KING]: 'king' };

export const PIECE_NAMES = {
  [PAWN]: 'peão', [KNIGHT]: 'cavalo', [BISHOP]: 'bispo',
  [ROOK]: 'torre', [QUEEN]: 'dama', [KING]: 'rei'
};
export const describePiece = piece =>
  piece ? `${PIECE_NAMES[typeOf(piece)]} ${colorOf(piece) === WHITE ? 'branco' : 'preto'}` : 'vazia';

export function pieceSvg(piece, { decorative = true } = {}) {
  const name = FILES[typeOf(piece)];
  if (!name) return '';
  const color = colorOf(piece) === WHITE ? 'white' : 'black';
  const src = new URL(`./pieces/${color}_${name}.svg`, import.meta.url).href;
  return `<img class="nx-piece" data-color="${color}" src="${src}" width="92" height="92" draggable="false" alt="${decorative ? '' : describePiece(piece)}"${decorative ? ' aria-hidden="true"' : ''}>`;
}
