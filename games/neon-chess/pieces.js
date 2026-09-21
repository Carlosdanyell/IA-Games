// Peças do tabuleiro, embutidas na página.
//
// O desenho é exatamente o dos SVGs originais. O que mudou foi a cor: onde
// havia creme e grafite fixos agora há PAPÉIS — corpo, brilho, sombra e
// contorno. Quem pinta é o CSS, então a peça acompanha o tema claro/escuro e a
// cor neon escolhida nos ajustes, sem duplicar arte nem recolorir em
// JavaScript.
//
// Por que embutido e não <img>: uma imagem externa é um documento isolado, e
// nenhuma variável de CSS da página atravessa essa fronteira. Embutida, a peça
// enxerga as mesmas variáveis do resto do jogo.
//
// Os dois degradês do corpo ficam num <defs> compartilhado: os doze arquivos
// usavam a mesma geometria (x1=25 y1=16 x2=67 y2=85 em caixa 92x92), então uma
// definição por cor serve para as 32 peças — e não há identificador repetido.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, typeOf, colorOf } from './model.js';

const ART = {
  white: {
    [PAWN]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M40 47 H52 C51 57 55 65 61 71 H31 C37 65 41 57 40 47Z"/> <rect x="36" y="44" width="20" height="5" rx="2.3"/><circle cx="46" cy="35" r="9"/> <path class="s-lite" d="M40 33 Q41 29 45 29" fill="none" opacity=".75"/> <path class="s-shade" d="M49 54 Q50 62 54 66" fill="none" opacity=".65"/> <path d="M32 73 Q31 70 35 68 H57 Q61 70 60 73 L66 79 Q68 84 63 84 H29 Q24 84 26 79Z"/> <path class="s-shade" d="M31 76 H61" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M32 79 H58" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [KNIGHT]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M26 71 C25 60 32 49 42 40 L32 42 L26 48 L16 40 Q15 38 18 35 L28 24 L37 21 L38 11 L46 17 L53 10 L56 21 C68 25 75 42 74 59 L76 71Z"/> <path class="f-shade" d="M53 23 L59 32 L55 34 L63 44 L59 46 L65 59 L62 68 H72 C75 46 69 29 57 24Z" stroke="none" opacity=".65"/> <path class="s-lite" d="M41 40 C34 50 30 57 31 66" fill="none" stroke-width="2.5" opacity=".7"/> <path class="s-lite" d="M23 36 L29 33" fill="none" opacity=".7"/> <circle class="f-ink" cx="41" cy="29" r="2.3" stroke="none"/> <path class="s-ink" d="M23 41 L28 42" fill="none" stroke-width="1.5"/> <path d="M23 73 Q22 70 26 68 H66 Q70 70 69 73 L75 79 Q77 84 72 84 H20 Q15 84 17 79Z"/> <path class="s-shade" d="M22 76 H70" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M23 79 H67" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [BISHOP]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M40 43 H52 C49 55 53 64 62 71 H30 C39 64 43 55 40 43Z"/> <path d="M46 18 C38 24 32 33 32 39 C32 47 60 47 60 39 C60 33 54 24 46 18Z"/> <circle cx="46" cy="15" r="3"/> <path class="s-ink" d="M48 25 L39 37" fill="none" stroke-width="3.4"/> <path class="s-lite" d="M36 37 Q35 40 38 41" fill="none" opacity=".65"/> <path class="s-shade" d="M49 52 Q50 63 56 67" fill="none" opacity=".7"/> <rect x="33" y="46" width="26" height="5" rx="2.3"/><path d="M29 73 Q28 70 32 68 H60 Q64 70 63 73 L69 79 Q71 84 66 84 H26 Q21 84 23 79Z"/> <path class="s-shade" d="M28 76 H64" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M29 79 H61" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [ROOK]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M30 33 H62 L60 60 Q60 66 67 71 H25 Q32 66 32 60Z"/> <path d="M23 18 H34 V27 H41 V18 H51 V27 H58 V18 H69 V37 H23Z"/> <path class="s-lite" d="M29 33 H62 M36 43 L37 62" fill="none" opacity=".65"/> <path class="s-shade" d="M56 43 L55 62" fill="none" opacity=".65"/> <rect x="28" y="37" width="36" height="5" rx="2.3"/><path d="M26 73 Q25 70 29 68 H63 Q67 70 66 73 L72 79 Q74 84 69 84 H23 Q18 84 20 79Z"/> <path class="s-shade" d="M25 76 H67" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M26 79 H64" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [QUEEN]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M36 46 H56 C54 57 58 65 66 71 H26 C34 65 38 57 36 46Z"/> <path d="M20 21 L29 47 H63 L72 21 L59 34 L59 16 L49 34 L46 13 L43 34 L33 16 L33 34Z"/> <circle cx="20" cy="19" r="3"/><circle cx="33" cy="15" r="3"/> <circle cx="46" cy="12" r="3"/><circle cx="59" cy="15" r="3"/><circle cx="72" cy="19" r="3"/> <path class="s-lite" d="M33 42 H59" fill="none" opacity=".65"/> <path class="s-shade" d="M52 54 Q54 62 60 67" fill="none" opacity=".65"/> <rect x="30" y="47" width="32" height="5" rx="2.3"/><path d="M23 73 Q22 70 26 68 H66 Q70 70 69 73 L75 79 Q77 84 72 84 H20 Q15 84 17 79Z"/> <path class="s-shade" d="M22 76 H70" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M23 79 H67" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [KING]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M38 47 H54 C53 57 57 65 65 71 H27 C35 65 39 57 38 47Z"/> <path d="M33 47 C29 44 26 39 27 34 C28 27 36 26 46 30 C56 26 64 27 65 34 C66 39 63 44 59 47Z"/> <path d="M42 8 H50 V16 H57 V23 H50 V32 H42 V23 H35 V16 H42Z"/> <path class="s-lite" d="M31 34 Q32 30 39 32" fill="none" opacity=".7"/> <path class="s-shade" d="M51 52 Q53 62 58 66" fill="none" opacity=".7"/> <rect x="31" y="47" width="30" height="5" rx="2.3"/><path d="M24 73 Q23 70 27 68 H65 Q69 70 68 73 L74 79 Q76 84 71 84 H21 Q16 84 18 79Z"/> <path class="s-shade" d="M23 76 H69" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M24 79 H66" fill="none" stroke-width="1.5" opacity=".65"/> </g>`
  },
  black: {
    [PAWN]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M40 47 H52 C51 57 55 65 61 71 H31 C37 65 41 57 40 47Z"/> <rect x="36" y="44" width="20" height="5" rx="2.3"/><circle cx="46" cy="35" r="9"/> <path class="s-lite" d="M40 33 Q41 29 45 29" fill="none" opacity=".75"/> <path class="s-shade" d="M49 54 Q50 62 54 66" fill="none" opacity=".65"/> <path d="M32 73 Q31 70 35 68 H57 Q61 70 60 73 L66 79 Q68 84 63 84 H29 Q24 84 26 79Z"/> <path class="s-shade" d="M31 76 H61" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M32 79 H58" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [KNIGHT]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M26 71 C25 60 32 49 42 40 L32 42 L26 48 L16 40 Q15 38 18 35 L28 24 L37 21 L38 11 L46 17 L53 10 L56 21 C68 25 75 42 74 59 L76 71Z"/> <path class="f-shade" d="M53 23 L59 32 L55 34 L63 44 L59 46 L65 59 L62 68 H72 C75 46 69 29 57 24Z" stroke="none" opacity=".65"/> <path class="s-lite" d="M41 40 C34 50 30 57 31 66" fill="none" stroke-width="2.5" opacity=".7"/> <path class="s-lite" d="M23 36 L29 33" fill="none" opacity=".7"/> <circle class="f-lite2" cx="41" cy="29" r="2.3" stroke="none"/> <path class="s-lite2" d="M23 41 L28 42" fill="none" stroke-width="1.5"/> <path d="M23 73 Q22 70 26 68 H66 Q70 70 69 73 L75 79 Q77 84 72 84 H20 Q15 84 17 79Z"/> <path class="s-shade" d="M22 76 H70" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M23 79 H67" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [BISHOP]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M40 43 H52 C49 55 53 64 62 71 H30 C39 64 43 55 40 43Z"/> <path d="M46 18 C38 24 32 33 32 39 C32 47 60 47 60 39 C60 33 54 24 46 18Z"/> <circle cx="46" cy="15" r="3"/> <path class="s-lite2" d="M48 25 L39 37" fill="none" stroke-width="3.4"/> <path class="s-lite" d="M36 37 Q35 40 38 41" fill="none" opacity=".65"/> <path class="s-shade" d="M49 52 Q50 63 56 67" fill="none" opacity=".7"/> <rect x="33" y="46" width="26" height="5" rx="2.3"/><path d="M29 73 Q28 70 32 68 H60 Q64 70 63 73 L69 79 Q71 84 66 84 H26 Q21 84 23 79Z"/> <path class="s-shade" d="M28 76 H64" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M29 79 H61" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [ROOK]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M30 33 H62 L60 60 Q60 66 67 71 H25 Q32 66 32 60Z"/> <path d="M23 18 H34 V27 H41 V18 H51 V27 H58 V18 H69 V37 H23Z"/> <path class="s-lite" d="M29 33 H62 M36 43 L37 62" fill="none" opacity=".65"/> <path class="s-shade" d="M56 43 L55 62" fill="none" opacity=".65"/> <rect x="28" y="37" width="36" height="5" rx="2.3"/><path d="M26 73 Q25 70 29 68 H63 Q67 70 66 73 L72 79 Q74 84 69 84 H23 Q18 84 20 79Z"/> <path class="s-shade" d="M25 76 H67" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M26 79 H64" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [QUEEN]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M36 46 H56 C54 57 58 65 66 71 H26 C34 65 38 57 36 46Z"/> <path d="M20 21 L29 47 H63 L72 21 L59 34 L59 16 L49 34 L46 13 L43 34 L33 16 L33 34Z"/> <circle cx="20" cy="19" r="3"/><circle cx="33" cy="15" r="3"/> <circle cx="46" cy="12" r="3"/><circle cx="59" cy="15" r="3"/><circle cx="72" cy="19" r="3"/> <path class="s-lite" d="M33 42 H59" fill="none" opacity=".65"/> <path class="s-shade" d="M52 54 Q54 62 60 67" fill="none" opacity=".65"/> <rect x="30" y="47" width="32" height="5" rx="2.3"/><path d="M23 73 Q22 70 26 68 H66 Q70 70 69 73 L75 79 Q77 84 72 84 H20 Q15 84 17 79Z"/> <path class="s-shade" d="M22 76 H70" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M23 79 H67" fill="none" stroke-width="1.5" opacity=".65"/> </g>`,
    [KING]: `<ellipse class="f-drop" cx="46" cy="86" rx="29" ry="3"/> <g class="f-body s-ink" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M38 47 H54 C53 57 57 65 65 71 H27 C35 65 39 57 38 47Z"/> <path d="M33 47 C29 44 26 39 27 34 C28 27 36 26 46 30 C56 26 64 27 65 34 C66 39 63 44 59 47Z"/> <path d="M42 8 H50 V16 H57 V23 H50 V32 H42 V23 H35 V16 H42Z"/> <path class="s-lite" d="M31 34 Q32 30 39 32" fill="none" opacity=".7"/> <path class="s-shade" d="M51 52 Q53 62 58 66" fill="none" opacity=".7"/> <rect x="31" y="47" width="30" height="5" rx="2.3"/><path d="M24 73 Q23 70 27 68 H65 Q69 70 68 73 L74 79 Q76 84 71 84 H21 Q16 84 18 79Z"/> <path class="s-shade" d="M23 76 H69" fill="none" stroke-width="1.5"/> <path class="s-lite" d="M24 79 H66" fill="none" stroke-width="1.5" opacity=".65"/> </g>`
  }
};

export const PIECE_NAMES = {
  [PAWN]: 'peão', [KNIGHT]: 'cavalo', [BISHOP]: 'bispo',
  [ROOK]: 'torre', [QUEEN]: 'dama', [KING]: 'rei'
};
export const describePiece = piece =>
  piece ? `${PIECE_NAMES[typeOf(piece)]} ${colorOf(piece) === WHITE ? 'branco' : 'preto'}` : 'vazia';

export function pieceSvg(piece, { decorative = true } = {}) {
  const type = typeOf(piece);
  if (!type) return '';
  const color = colorOf(piece) === WHITE ? 'white' : 'black';
  const rotulo = decorative ? ' aria-hidden="true"' : ` role="img" aria-label="${describePiece(piece)}"`;
  return `<svg class="nx-piece" data-color="${color}" viewBox="0 0 92 92" width="92" height="92"${rotulo}>${ART[color][type]}</svg>`;
}

// O <defs> precisa ficar DENTRO do elemento do jogo para herdar as variáveis
// de cor; num canto solto da página ele não enxergaria o acabamento escolhido.
export const PIECE_DEFS_ID = 'nx-piece-defs';
export function ensurePieceDefs(host) {
  const doc = host?.ownerDocument || document;
  const antigo = doc.getElementById(PIECE_DEFS_ID);
  if (antigo) { if (host && antigo.parentNode !== host) host.append(antigo); return; }
  const holder = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.id = PIECE_DEFS_ID;
  holder.setAttribute('aria-hidden', 'true');
  holder.setAttribute('width', '0');
  holder.setAttribute('height', '0');
  holder.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  const parada = '<stop class="s1" offset="0"/><stop class="s2" offset=".32"/>' +
                 '<stop class="s3" offset=".67"/><stop class="s4" offset="1"/>';
  const eixo = 'gradientUnits="userSpaceOnUse" x1="25" y1="16" x2="67" y2="85"';
  holder.innerHTML = `<defs>
    <linearGradient id="nxPieceLight" ${eixo}>${parada}</linearGradient>
    <linearGradient id="nxPieceDark" ${eixo}>${parada}</linearGradient>
    <radialGradient id="nxPieceDrop">
      <stop stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  (host || doc.body).append(holder);
}
