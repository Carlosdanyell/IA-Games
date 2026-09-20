// Peças em vetor, desenhadas no mesmo espírito das figuras do Neon Memo: sem
// arquivo de imagem e sem fonte externa. Os glifos Unicode de xadrez foram
// descartados porque em várias fontes de Android o par branco/preto sai quase
// idêntico — num tabuleiro isso é confusão de jogo, não detalhe estético.
//
// Cada peça cabe numa caixa 0 0 64 64 e é montada sobre a mesma fundação:
// sombra de contato, base, colarinho. O que muda é a parte de cima. Essa
// repetição é o que faz o conjunto parecer um jogo só, e não seis desenhos.
//
// Cor e contorno vêm do CSS. Formas SEM classe recebem o degradê da peça;
// as classificadas (corte do bispo, olho do cavalo, brilho, sombra) têm
// tratamento próprio.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, typeOf, colorOf } from './model.js';

// Sombra no chão: dá peso à peça sobre a casa. Fica atrás de tudo.
const DROP = '<ellipse class="nx-drop" cx="32" cy="57.4" rx="20" ry="2.8"/>';
// Base em dois degraus — o disco largo e o anel que sobe para o corpo.
const FOOT = '<path d="M11.6 49.6h40.8a3 3 0 0 1 3 3v2.2a3 3 0 0 1-3 3H11.6a3 3 0 0 1-3-3v-2.2a3 3 0 0 1 3-3z"/>';
const SKIRT = '<path d="M17.4 41.8h29.2c.7 3.5 2.2 6.1 4.4 7.8H13c2.2-1.7 3.7-4.3 4.4-7.8z"/>';
const COLLAR = '<path d="M21.6 36.4h20.8a1.8 1.8 0 0 1 1.8 1.8v2.2a1.8 1.8 0 0 1-1.8 1.8H21.6a1.8 1.8 0 0 1-1.8-1.8v-2.2a1.8 1.8 0 0 1 1.8-1.8z"/>';
// Peão e cavalo usam fundação um pouco mais estreita, como num jogo de verdade.
const FOOT_S = '<path d="M14.4 49.6h35.2a3 3 0 0 1 3 3v2.2a3 3 0 0 1-3 3H14.4a3 3 0 0 1-3-3v-2.2a3 3 0 0 1 3-3z"/>';
const SKIRT_S = '<path d="M19.6 42.2h24.8c.7 3.3 2.1 5.7 4.2 7.4H15.4c2.1-1.7 3.5-4.1 4.2-7.4z"/>';
const BASE = DROP + FOOT + SKIRT;
const BASE_S = DROP + FOOT_S + SKIRT_S;
// Brilho: uma lasca de luz no alto e à esquerda. Sem ele a peça clara fica
// chapada no tema escuro.
const shine = (cx, cy, rx, ry, rot = -28) =>
  `<ellipse class="nx-shine" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})"/>`;

const ART = {
  [PAWN]: `${BASE_S}
    <path d="M25.6 24.4h12.8c1 6.5 3 11.4 5.8 14.6-3.9 1.6-7.9 2.4-12.2 2.4s-8.3-.8-12.2-2.4c2.8-3.2 4.8-8.1 5.8-14.6z"/>
    <path d="M25.8 20.4h12.4a1.7 1.7 0 0 1 1.7 1.7v1.2a1.7 1.7 0 0 1-1.7 1.7H25.8a1.7 1.7 0 0 1-1.7-1.7v-1.2a1.7 1.7 0 0 1 1.7-1.7z"/>
    <circle cx="32" cy="13.8" r="7.3"/>
    ${shine(28.4, 10.8, 2.5, 1.5)}`,

  [ROOK]: `${BASE}${COLLAR}
    <path d="M18.2 24.6h27.6l1.9 11.8H16.3z"/>
    <path d="M14 8.8h6v5.2h4V8.8h6v5.2h4V8.8h6v5.2h4V8.8h6v15.8H14z"/>
    ${shine(21.5, 14, 2.4, 4.6, 0)}`,

  [KNIGHT]: `${BASE_S}
    <path d="M27.2 42.6c-1-7.4 1-13.4 5.8-18-4.9.5-9 2.9-12.2 7.2l-6.2-6c3.4-5.9 8.2-10.2 14.4-12.9-1.3-2.1-1.8-4.5-1.5-7.2l.4-3.6 3.4 2.7 2.2-4.9 3 2.7c1.9-1.6 4-2.5 6.3-2.7l-.5 3.9c6.2 2 10.5 6.5 12.8 13.4 2.3 6.9 3 15.7 2.2 26.4z"/>
    <path class="nx-shade" d="M40.2 7.4c4.4 2.7 7.5 6.7 9.4 11.9 1.9 5.2 2.6 11.8 2.3 19.9-1.3-7.7-2.9-13.9-4.7-18.5-1.9-4.6-4.2-8.9-7-12.9z"/>
    <path class="nx-shade" d="M33 24.1c-3.3 4.6-4.8 10.7-4.5 18.5h-1.3c-.9-7.4 1-13.4 5.8-18.5z"/>
    <circle class="nx-eye" cx="34.6" cy="19" r="2.1"/>
    ${shine(26.5, 23, 2.4, 5.4, 22)}`,

  [BISHOP]: `${BASE}${COLLAR}
    <path d="M23.4 30.2h17.2c.6 2.6 1.6 4.7 3 6.2H20.4c1.4-1.5 2.4-3.6 3-6.2z"/>
    <path d="M32 11.6c6.9 4.3 10.7 9.8 11.4 16.5.2 2.2-.7 3.9-2.7 5.1H23.3c-2-1.2-2.9-2.9-2.7-5.1.7-6.7 4.5-12.2 11.4-16.5z"/>
    <path class="nx-cut" d="M28 23.1l2.1-2.1 7.1 7.1-2.1 2.1z"/>
    <circle cx="32" cy="7.6" r="3.4"/>
    ${shine(26.6, 17.5, 2.6, 4.6)}`,

  [QUEEN]: `${BASE}${COLLAR}
    <path d="M19.6 30.8h24.8c.5 2.5 1.3 4.4 2.5 5.6H17.1c1.2-1.2 2-3.1 2.5-5.6z"/>
    <path d="M12.6 17.4l6 13.8 3.6-16.6 6.2 15.4 3.6-17.6 3.6 17.6 6.2-15.4 3.6 16.6 6-13.8-2.6 14.6H15.2z"/>
    <circle cx="12.6" cy="14.6" r="3.4"/><circle cx="22.2" cy="11.2" r="3.2"/>
    <circle cx="32" cy="9.4" r="3.6"/><circle cx="41.8" cy="11.2" r="3.2"/>
    <circle cx="51.4" cy="14.6" r="3.4"/>
    ${shine(21, 24, 2.4, 4.4)}`,

  [KING]: `${BASE}${COLLAR}
    <path d="M20.4 30.4h23.2c.6 2.6 1.5 4.6 2.8 6H17.6c1.3-1.4 2.2-3.4 2.8-6z"/>
    <path d="M32 15.4c8.6 0 14.6 5.2 14.6 11.9 0 3.2-1.4 6-4.2 8.4H21.6c-2.8-2.4-4.2-5.2-4.2-8.4 0-6.7 6-11.9 14.6-11.9z"/>
    <path d="M29.4 3.2h5.2v4.6h4.6V13h-4.6v4.4h-5.2V13h-4.6V7.8h4.6z"/>
    ${shine(23.5, 23, 2.6, 4.2)}`
};

export const pieceArt = type => ART[type] || '';

// `piece` é o valor do tabuleiro (tipo | cor). A classe carrega a cor para o
// CSS; o desenho é o mesmo dos dois lados.
export function pieceSvg(piece, { decorative = true } = {}) {
  const type = typeOf(piece);
  if (!type) return '';
  const light = colorOf(piece) === WHITE;
  return `<svg class="nx-piece" data-color="${light ? 'white' : 'black'}" viewBox="0 0 64 64"${decorative ? ' aria-hidden="true"' : ''}>${ART[type]}</svg>`;
}

// Degradês compartilhados por todas as peças da página. Ficam num SVG oculto
// para os identificadores não se repetirem nas 32 peças do tabuleiro.
export const PIECE_DEFS_ID = 'nx-piece-defs';
export function ensurePieceDefs(doc = document) {
  if (doc.getElementById(PIECE_DEFS_ID)) return;
  const holder = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.id = PIECE_DEFS_ID;
  holder.setAttribute('aria-hidden', 'true');
  holder.setAttribute('width', '0');
  holder.setAttribute('height', '0');
  holder.style.position = 'absolute';
  holder.innerHTML = `<defs>
    <linearGradient id="nxWhitePiece" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#eef2fb"/>
      <stop offset="1" stop-color="#bfcbe4"/>
    </linearGradient>
    <linearGradient id="nxBlackPiece" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#46536f"/><stop offset=".45" stop-color="#232c47"/>
      <stop offset="1" stop-color="#0a0f1d"/>
    </linearGradient>
  </defs>`;
  doc.body.append(holder);
}

export const PIECE_NAMES = {
  [PAWN]: 'peão', [KNIGHT]: 'cavalo', [BISHOP]: 'bispo',
  [ROOK]: 'torre', [QUEEN]: 'dama', [KING]: 'rei'
};
export const describePiece = piece =>
  piece ? `${PIECE_NAMES[typeOf(piece)]} ${colorOf(piece) === WHITE ? 'branco' : 'preto'}` : 'vazia';
