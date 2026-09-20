// Peças desenhadas em vetor, no mesmo espírito das figuras do Neon Memo: sem
// arquivo de imagem e sem fonte externa. Os glifos Unicode de xadrez foram
// descartados porque em várias fontes de Android o par branco/preto sai quase
// idêntico — num tabuleiro isso é confusão de jogo, não detalhe estético.
//
// Tudo cabe numa caixa 0 0 64 64. A cor vem do CSS (`currentColor`), então a
// mesma arte serve para peça clara e escura, tema claro e escuro.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, typeOf, colorOf } from './model.js';

const BASE = '<path d="M13 49.5h38a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/>';
const PEDESTAL = '<path d="M17.5 42h29l2.5 7h-34z"/>';

const ART = {
  [PAWN]: `<circle cx="32" cy="17" r="7.5"/>
    <path d="M24.8 24.6a12 12 0 0 0 14.4 0c.6 6 2.6 11.4 5.3 15.4H19.5c2.7-4 4.7-9.4 5.3-15.4z"/>
    ${PEDESTAL}${BASE}`,
  [ROOK]: `<path d="M16 10h7v5.5h5.5V10h7v5.5H41V10h7v13.5l-4 3.5H20l-4-3.5z"/>
    <path d="M21.5 29h21l1.5 13h-24z"/>${PEDESTAL}${BASE}`,
  [KNIGHT]: `<path d="M27.5 9.5c.4-1.8 1.6-3.2 3.6-4l1.4 3.6 2.4-3.3c4.6.9 8.3 3.4 11 7.5 2.8 4.2 4.2 9.6 4.4 16.2.2 6.1-.4 12.1-1.7 18h-21c-.6-6.6 1.2-12.3 5.4-17.1-3.2.6-6 2.3-8.4 5.1l-5.7-4.7c2.2-5.5 5.6-9.6 10.1-12.3-1-1.5-1.5-3.2-1.5-5z"/>
    <circle cx="30.6" cy="16.4" r="1.9" class="nx-eye"/>${PEDESTAL}${BASE}`,
  [BISHOP]: `<circle cx="32" cy="10" r="3.6"/>
    <path d="M32 14.5c7.2 4.4 11 10.2 11 17.2 0 4.6-3.7 8.3-11 11.1-7.3-2.8-11-6.5-11-11.1 0-7 3.8-12.8 11-17.2z"/>
    <path d="M26.2 25.1l2.9-2.9 10.7 10.7-2.9 2.9z" class="nx-cut"/>
    ${PEDESTAL}${BASE}`,
  [QUEEN]: `<circle cx="13" cy="15" r="3.2"/><circle cx="22.5" cy="11" r="3.2"/><circle cx="32" cy="9" r="3.4"/>
    <circle cx="41.5" cy="11" r="3.2"/><circle cx="51" cy="15" r="3.2"/>
    <path d="M13 17.5l6 11.5 3.5-15.5 6 15.5 3.5-17 3.5 17 6-15.5 3.5 15.5 6-11.5-3 24.5H16z"/>
    ${PEDESTAL}${BASE}`,
  [KING]: `<path d="M29.6 4h4.8v4.6H39v4.8h-4.6V19h-4.8v-5.6H25V8.6h4.6z"/>
    <path d="M32 20c8.4 0 14.5 5.4 14.5 12.4 0 4.6-2.6 7.9-7 10.6h-15c-4.4-2.7-7-6-7-10.6C17.5 25.4 23.6 20 32 20z"/>
    ${PEDESTAL}${BASE}`
};

export const pieceArt = type => ART[type] || '';

// `piece` é o valor do tabuleiro (tipo | cor). A classe carrega a cor para o
// CSS; o SVG em si é o mesmo dos dois lados.
export function pieceSvg(piece, { decorative = true } = {}) {
  const type = typeOf(piece);
  if (!type) return '';
  const light = colorOf(piece) === WHITE;
  return `<svg class="nx-piece" data-color="${light ? 'white' : 'black'}" viewBox="0 0 64 64"${decorative ? ' aria-hidden="true"' : ''}>${ART[type]}</svg>`;
}

export const PIECE_NAMES = {
  [PAWN]: 'peão', [KNIGHT]: 'cavalo', [BISHOP]: 'bispo',
  [ROOK]: 'torre', [QUEEN]: 'dama', [KING]: 'rei'
};
export const describePiece = piece =>
  piece ? `${PIECE_NAMES[typeOf(piece)]} ${colorOf(piece) === WHITE ? 'branco' : 'preto'}` : 'vazia';
