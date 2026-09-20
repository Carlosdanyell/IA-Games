// Figuras do Neon Memo: ilustrações de coisas reais, coloridas e cheias — nada
// de formas abstratas. Cada carta mostra um objeto que a pessoa nomeia em voz
// alta (gato, banana, bicicleta), porque o par é lembrado pelo nome.
//
// Cada `art` é o miolo de um <svg viewBox="0 0 64 64">. As cores são próprias
// da figura (maçã é vermelha, banana é amarela) e não dependem do tema: a face
// da carta é sempre clara, como carta de baralho de verdade.
export const FAMILIES = [
  { id: 'animais',    label: 'Animais' },
  { id: 'frutas',     label: 'Frutas' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'musica',     label: 'Música' },
  { id: 'natureza',   label: 'Natureza' },
  { id: 'casa',       label: 'Casa' },
  { id: 'esportes',   label: 'Esportes' },
  { id: 'mar',        label: 'Mar' }
];

export const WILD = 'camaleao';

// Olho com brilho e traço solto: as duas coisas que mais repetem nos desenhos.
const eye = (x, y, r = 2.8) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#34293f"/><circle cx="${x + r * .34}" cy="${y - r * .36}" r="${r * .33}" fill="#fff"/>`;
const ln = (d, color = '#5a4a6a', w = 2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const FIGURES = [
  // ---------------------------------------------------------------- animais
  { id: 'gato', name: 'Gato', family: 'animais', art:
    `<path d="m15 11 6 16 10-7z" fill="#f0a05e"/><path d="m49 11-6 16-10-7z" fill="#f0a05e"/>
     <path d="m18 16 3 8 5-3z" fill="#f9c3ae"/><path d="m46 16-3 8-5-3z" fill="#f9c3ae"/>
     <ellipse cx="32" cy="34" rx="18" ry="16" fill="#f5ae6c"/>
     ${ln('M24 22v4M32 20v5M40 22v4', '#dd8b41', 3)}
     <ellipse cx="32" cy="42" rx="12" ry="8" fill="#fde8d4"/>
     ${eye(25, 32)}${eye(39, 32)}
     <path d="m32 41-3.5-3h7z" fill="#e87d94"/>
     ${ln('M32 41v3M27.5 46.5c2.5 2 6.5 2 9 0', '#a4693f', 1.8)}
     ${ln('M10 36h9M11 43l8-3M54 36h-9M53 43l-8-3', '#a4693f', 1.6)}` },
  { id: 'cachorro', name: 'Cachorro', family: 'animais', art:
    `<path d="M15 17c-5 3-5 17-2 22 2 4 6 4 9 1z" fill="#8c5a38"/>
     <path d="M49 17c5 3 5 17 2 22-2 4-6 4-9 1z" fill="#8c5a38"/>
     <ellipse cx="32" cy="33" rx="16" ry="17" fill="#c78c55"/>
     <ellipse cx="32" cy="43" rx="11" ry="8" fill="#f7e5cc"/>
     ${eye(26, 30)}${eye(38, 30)}
     <ellipse cx="32" cy="39" rx="4.4" ry="3.4" fill="#3b2f2a"/>
     ${ln('M32 42v3M28 47c2.5 2 5.5 2 8 0', '#a97040', 1.8)}
     <path d="M25 18c5-3 9-3 14 0" fill="none" stroke="#a97040" stroke-width="2"/>` },
  { id: 'coelho', name: 'Coelho', family: 'animais', art:
    `<ellipse cx="25" cy="17" rx="5" ry="12" transform="rotate(-10 25 17)" fill="#ece7f2"/>
     <ellipse cx="39" cy="17" rx="5" ry="12" transform="rotate(10 39 17)" fill="#ece7f2"/>
     <ellipse cx="25" cy="17" rx="2.4" ry="8" transform="rotate(-10 25 17)" fill="#f4b3c4"/>
     <ellipse cx="39" cy="17" rx="2.4" ry="8" transform="rotate(10 39 17)" fill="#f4b3c4"/>
     <ellipse cx="32" cy="40" rx="16" ry="15" fill="#f5f1f8"/>
     ${eye(26, 37)}${eye(38, 37)}
     <path d="m32 45-3-2.5h6z" fill="#f4a0b4"/>
     ${ln('M32 45v3M28 49c2.4 1.8 5.6 1.8 8 0', '#c3b4cf', 1.8)}
     ${ln('M12 40h8M13 46l7-3M52 40h-8M51 46l-7-3', '#cdc2d8', 1.5)}` },
  { id: 'peixe', name: 'Peixe', family: 'animais', art:
    `<path d="m43 32 16-12v24z" fill="#ef8b34"/>
     <path d="M25 18c4-6 10-7 13-3-2 3-3 6-3 9zM25 46c4 6 10 7 13 3-2-3-3-6-3-9z" fill="#ef8b34"/>
     <ellipse cx="26" cy="32" rx="20" ry="14" fill="#f9a84d"/>
     <path d="M30 20c4 7 4 17 0 24" fill="none" stroke="#e07c2c" stroke-width="2.4"/>
     <circle cx="17" cy="29" r="4.4" fill="#fff"/>${eye(17, 29, 2.4)}
     <circle cx="13" cy="36" r="1.8" fill="#e07c2c"/>` },
  { id: 'passaro', name: 'Pássaro', family: 'animais', art:
    `<ellipse cx="35" cy="36" rx="17" ry="15" fill="#4f9fdd"/>
     <ellipse cx="31" cy="41" rx="11" ry="9" fill="#fbe7a4"/>
     <path d="m49 38 11-5-4 12z" fill="#3a7fba"/>
     <circle cx="24" cy="22" r="10" fill="#6cb6ec"/>
     <path d="m14 21-8 4 8 3z" fill="#f2a03d"/>
     ${eye(24, 20, 2.6)}
     <path d="M38 33c8-2 14 2 15 8-6 3-13 1-16-3z" fill="#3a7fba"/>
     ${ln('M28 50v6M37 50v6', '#f2a03d', 2.6)}` },
  { id: 'tartaruga', name: 'Tartaruga', family: 'animais', art:
    `<path d="M15 43h7v6a3.5 3.5 0 0 1-7 0zM42 43h7v6a3.5 3.5 0 0 1-7 0z" fill="#8fd39b"/>
     <circle cx="51" cy="38" r="7.5" fill="#8fd39b"/>${eye(53, 36, 2.1)}
     <path d="M9 44a23 17 0 0 1 46 0z" fill="#57ab68"/>
     <path d="M32 28v16M20 44l7-11M44 44l-7-11M19 37h26" fill="none" stroke="#3a8a4c" stroke-width="2.2"/>
     <path d="M9 44h46" fill="none" stroke="#3a8a4c" stroke-width="2.4"/>` },
  { id: 'abelha', name: 'Abelha', family: 'animais', art:
    `<ellipse cx="22" cy="21" rx="9" ry="6" transform="rotate(-28 22 21)" fill="#d3e9fb"/>
     <ellipse cx="42" cy="21" rx="9" ry="6" transform="rotate(28 42 21)" fill="#d3e9fb"/>
     <path d="m47 33 9 5-9 5z" fill="#3b3348"/>
     <ellipse cx="31" cy="38" rx="16" ry="12" fill="#f7c93f"/>
     <rect x="24" y="30" width="5" height="17" rx="2.4" fill="#3b3348"/>
     <rect x="34" y="30" width="5" height="17" rx="2.4" fill="#3b3348"/>
     ${ln('M25 25l-3-6M35 25l3-6', '#3b3348', 2)}
     <circle cx="21" cy="18" r="2" fill="#3b3348"/><circle cx="39" cy="18" r="2" fill="#3b3348"/>
     ${eye(21, 33, 2.2)}` },
  { id: 'elefante', name: 'Elefante', family: 'animais', art:
    `<path d="M19 24c-9-4-17 1-17 9s8 15 17 12z" fill="#93a0c2"/>
     <path d="M45 24c9-4 17 1 17 9s-8 15-17 12z" fill="#93a0c2"/>
     <path d="M20 25a12 12 0 0 1 24 0v8c0 7-4 11-9 12h-6c-5-1-9-5-9-12z" fill="#adb7d6"/>
     ${eye(27, 29, 2.6)}${eye(37, 29, 2.6)}
     ${ln('M26 44c-1 5 0 8 3 10M38 44c1 4 1 7 0 9', '#fff', 3)}
     ${ln('M32 44v8a6 6 0 0 0 11 2', '#adb7d6', 8)}` },

  // ----------------------------------------------------------------- frutas
  { id: 'maca', name: 'Maçã', family: 'frutas', art:
    `<path d="M32 23c5-6 15-5 18 3 3 9-3 24-11 28-3 2-5 0-7 0s-4 2-7 0c-8-4-14-19-11-28 3-8 13-9 18-3Z" fill="#e0453c"/>
     ${ln('M25 26c-4 2-6 7-5 12', '#ff8f7f', 3)}
     ${ln('M32 23V13', '#8a5a2b', 3)}
     <path d="M33 16c4-6 11-7 14-6 0 6-5 10-12 10z" fill="#52b356"/>` },
  { id: 'banana', name: 'Banana', family: 'frutas', art:
    `<path d="M16 18c0 20 11 32 26 32 6 0 10-3 10-6 0-2-2-4-5-3-11 4-23-7-23-23 0-2-1-3-4-3s-4 1-4 3Z" fill="#f3cf46"/>
     <path d="M21 22c2 15 11 24 23 24" fill="none" stroke="#dcb22c" stroke-width="2.6"/>
     <path d="M14 14h8v6h-8z" transform="rotate(-8 18 17)" fill="#8a6a3a"/>
     <circle cx="50" cy="45" r="3.2" fill="#8a6a3a"/>` },
  { id: 'uva', name: 'Uva', family: 'frutas', art:
    `${ln('M32 30V13', '#8a5a2b', 3)}
     <path d="M33 16c4-6 12-7 15-6 0 6-6 10-13 10z" fill="#52b356"/>
     <circle cx="17" cy="28" r="6.5" fill="#8b64c4"/><circle cx="47" cy="28" r="6.5" fill="#8b64c4"/>
     <circle cx="32" cy="31" r="6.5" fill="#9e77d6"/><circle cx="23" cy="39" r="6.5" fill="#9e77d6"/>
     <circle cx="41" cy="39" r="6.5" fill="#9e77d6"/><circle cx="32" cy="48" r="6.5" fill="#8b64c4"/>
     <circle cx="30" cy="29" r="1.8" fill="#fff" opacity=".6"/><circle cx="21" cy="37" r="1.6" fill="#fff" opacity=".5"/>` },
  { id: 'melancia', name: 'Melancia', family: 'frutas', art:
    `<path d="M4 21h56c0 18-13 32-28 32S4 39 4 21Z" fill="#41a24a"/>
     <path d="M8 24h48c0 16-11 28-24 28S8 40 8 24Z" fill="#f4f0e2"/>
     <path d="M11 27h42c0 14-10 24-21 24S11 41 11 27Z" fill="#e8455c"/>
     <ellipse cx="24" cy="34" rx="2" ry="3" fill="#3b2f2a"/><ellipse cx="40" cy="34" rx="2" ry="3" fill="#3b2f2a"/>
     <ellipse cx="32" cy="42" rx="2" ry="3" fill="#3b2f2a"/>` },
  { id: 'cereja', name: 'Cereja', family: 'frutas', art:
    `${ln('M22 44c0-13 6-21 15-24M43 44c0-9-2-16-7-20', '#63a04c', 2.8)}
     <path d="M37 13c5-5 14-4 17-1-3 5-11 7-16 5z" fill="#52b356"/>
     <circle cx="21" cy="45" r="9.5" fill="#cf3644"/><circle cx="43" cy="45" r="9.5" fill="#e8455c"/>
     <circle cx="18" cy="42" r="2.4" fill="#fff" opacity=".65"/><circle cx="40" cy="42" r="2.4" fill="#fff" opacity=".65"/>` },
  { id: 'abacaxi', name: 'Abacaxi', family: 'frutas', art:
    `<path d="M32 14c-5-7-12-9-15-8 0 7 6 12 13 13M32 14c5-7 12-9 15-8 0 7-6 12-13 13" fill="#52b356"/>
     <path d="M29 9h6v15h-6z" fill="#41a24a"/>
     <rect x="15" y="24" width="34" height="35" rx="17" fill="#efb63c"/>
     ${ln('M15 33 49 50M49 33 15 50M15 43l17 9M49 43l-17 9', '#c47f1e', 2.4)}
     <path d="M20 26c-3 4-5 9-5 15 0 7 3 13 8 17-2-5-3-11-3-17s0-11 0-15Z" fill="#f7cd63"/>` },
  { id: 'pera', name: 'Pera', family: 'frutas', art:
    `<path d="M32 19c-3 0-6 2-6 5s3 5 2 9c-2 6-10 9-10 17 0 8 7 13 14 13s14-5 14-13c0-8-8-11-10-17-1-4 2-6 2-9s-3-5-6-5Z" fill="#c2d84c"/>
     ${ln('M25 40c-3 3-4 7-3 10', '#e2ee9a', 3)}
     ${ln('M32 19v-7', '#8a5a2b', 3)}
     <path d="M33 13c4-4 11-5 13-4-1 5-7 8-12 7z" fill="#52b356"/>` },
  { id: 'morango', name: 'Morango', family: 'frutas', art:
    `<path d="M32 22c-11 0-19 6-19 14 0 11 11 22 19 22s19-11 19-22c0-8-8-14-19-14Z" fill="#e5424f"/>
     <path d="M19 19h26l-7 7H26z" fill="#52b356"/><path d="M30 13h4v7h-4z" fill="#41a24a"/>
     <circle cx="25" cy="33" r="1.6" fill="#f7d94a"/><circle cx="39" cy="33" r="1.6" fill="#f7d94a"/>
     <circle cx="32" cy="40" r="1.6" fill="#f7d94a"/><circle cx="26" cy="45" r="1.6" fill="#f7d94a"/>
     <circle cx="38" cy="45" r="1.6" fill="#f7d94a"/><circle cx="32" cy="29" r="1.6" fill="#f7d94a"/>` },

  // ------------------------------------------------------------- transporte
  { id: 'carro', name: 'Carro', family: 'transporte', art:
    `<path d="M6 45v-10l7-2 6-11h26l6 11 7 2v10z" fill="#e0483f"/>
     <path d="M21 25h9v8H16zM34 25h7l5 8H34z" fill="#a8dbf5"/>
     <path d="M6 36h52v4H6z" fill="#c3372f"/>
     <circle cx="19" cy="46" r="6.5" fill="#3b3348"/><circle cx="19" cy="46" r="2.8" fill="#cdc6d8"/>
     <circle cx="45" cy="46" r="6.5" fill="#3b3348"/><circle cx="45" cy="46" r="2.8" fill="#cdc6d8"/>
     <circle cx="55" cy="35" r="2.4" fill="#ffe08a"/>` },
  { id: 'bicicleta', name: 'Bicicleta', family: 'transporte', art:
    `<circle cx="15" cy="42" r="11.5" fill="none" stroke="#3b3348" stroke-width="4"/>
     <circle cx="49" cy="42" r="11.5" fill="none" stroke="#3b3348" stroke-width="4"/>
     ${ln('m15 42 13-20h10l11 20M24 42h13l3-16', '#2f9fd6', 3.6)}
     ${ln('M28 22h-6', '#2f9fd6', 3.6)}
     <path d="M19 24h10v4H19z" transform="rotate(-8 24 26)" fill="#5a4a6a"/>
     ${ln('M38 22h9', '#5a4a6a', 3)}` },
  { id: 'aviao', name: 'Avião', family: 'transporte', art:
    `<path d="M32 6c3 0 5 5 5 12v9l20 12v6l-20-6v10l6 5v4l-11-4-11 4v-4l6-5V39L7 45v-6l20-12v-9c0-7 2-12 5-12Z" fill="#c9d7ee"/>
     <path d="m37 27 20 12v6l-20-6zM37 39v10l6 5v4l-11-4z" fill="#8fa8d0"/>
     <path d="M32 6c3 0 5 5 5 12v9h-10v-9c0-7 2-12 5-12Z" fill="#e3e9f4"/>
     <circle cx="32" cy="20" r="2.6" fill="#4f9fdd"/><circle cx="32" cy="29" r="2.2" fill="#4f9fdd"/>` },
  { id: 'barco', name: 'Barco', family: 'transporte', art:
    `<path d="M30 41V9L16 41z" fill="#f2f4fa"/><path d="M34 41V15l14 26z" fill="#e5424f"/>
     ${ln('M32 41V8', '#8a5a2b', 2.6)}
     <path d="M5 42h54l-8 13H13z" fill="#a9682f"/><path d="M5 42h54l-2 4H7z" fill="#87511f"/>
     ${ln('M3 59c5-4 10-4 15 0s10 4 15 0 10-4 15 0 10 4 15 0', '#4f9fdd', 3)}` },
  { id: 'trem', name: 'Trem', family: 'transporte', art:
    `<path d="M41 28h9l7 10v7H41z" fill="#3f8a55"/>
     <rect x="7" y="17" width="34" height="28" rx="5" fill="#4aa264"/>
     <rect x="13" y="23" width="10" height="10" rx="2" fill="#f7d94a"/>
     <rect x="27" y="23" width="10" height="10" rx="2" fill="#f7d94a"/>
     <rect x="44" y="32" width="9" height="8" rx="2" fill="#f7d94a"/>
     <path d="M12 17v-6h7v6z" fill="#3b3348"/>
     <circle cx="16" cy="49" r="5" fill="#3b3348"/><circle cx="32" cy="49" r="5" fill="#3b3348"/>
     <circle cx="49" cy="49" r="5" fill="#3b3348"/>
     <circle cx="15" cy="8" r="4" fill="#d5d0de"/><circle cx="23" cy="5" r="3" fill="#e4e0ea"/>` },
  { id: 'foguete', name: 'Foguete', family: 'transporte', art:
    `<path d="M32 5c8 7 12 17 12 28v9H20v-9c0-11 4-21 12-28Z" fill="#eef1f8"/>
     <path d="M32 5c4 3.5 7 8.5 9 14H23c2-5.5 5-10.5 9-14Z" fill="#e5424f"/>
     <circle cx="32" cy="28" r="6" fill="#6cc0ef"/><circle cx="30" cy="26" r="2" fill="#fff" opacity=".7"/>
     <path d="M20 34 11 45v8l9-6zM44 34l9 11v8l-9-6z" fill="#e5424f"/>
     <path d="M26 42h12v6H26z" fill="#c9c4d4"/>
     <path d="M32 49c5 5 5 10 0 14-5-4-5-9 0-14Z" fill="#f2a03d"/>
     <path d="M32 52c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9Z" fill="#f7d94a"/>` },
  { id: 'onibus', name: 'Ônibus', family: 'transporte', art:
    `<rect x="5" y="14" width="54" height="30" rx="6" fill="#f2b535"/>
     <rect x="10" y="20" width="14" height="11" rx="2" fill="#a8dbf5"/>
     <rect x="27" y="20" width="12" height="11" rx="2" fill="#a8dbf5"/>
     <rect x="42" y="20" width="12" height="11" rx="2" fill="#a8dbf5"/>
     <path d="M5 35h54v5H5z" fill="#d99a25"/>
     <circle cx="17" cy="47" r="6" fill="#3b3348"/><circle cx="17" cy="47" r="2.5" fill="#cdc6d8"/>
     <circle cx="47" cy="47" r="6" fill="#3b3348"/><circle cx="47" cy="47" r="2.5" fill="#cdc6d8"/>` },
  { id: 'moto', name: 'Moto', family: 'transporte', art:
    `<circle cx="14" cy="44" r="10.5" fill="none" stroke="#3b3348" stroke-width="5"/>
     <circle cx="50" cy="44" r="10.5" fill="none" stroke="#3b3348" stroke-width="5"/>
     ${ln('M14 44h10l8-12h8l6 12', '#cf3644', 5)}
     <path d="M24 26h14l3 8H22z" fill="#e5424f"/>
     <path d="M20 26h9v6h-9z" fill="#3b3348"/>
     ${ln('M25 26h-6M42 28l5-6h7', '#5a4a6a', 3.4)}
     <rect x="46" y="18" width="11" height="4" rx="2" fill="#3b3348"/>` },

  // ----------------------------------------------------------------- música
  { id: 'guitarra', name: 'Guitarra', family: 'musica', art:
    `<rect x="27" y="7" width="10" height="16" rx="1" fill="#6b4324"/>
     <rect x="24" y="2" width="16" height="7" rx="2" fill="#4d2f18"/>
     <path d="M32 21c5 0 9 3 9 8 0 4-3 6-3 9 0 4 7 6 7 14s-6 12-13 12-13-4-13-12 7-10 7-14c0-3-3-5-3-9 0-5 4-8 9-8Z" fill="#c98a4a"/>
     <circle cx="32" cy="45" r="5.5" fill="#4d2f18"/>
     <rect x="26" y="52" width="12" height="3.4" rx="1.4" fill="#4d2f18"/>
     ${ln('M29 9v40M35 9v40', '#f4ecdd', 1.4)}` },
  { id: 'tambor', name: 'Tambor', family: 'musica', art:
    `${ln('M5 12 21 25M59 12 43 25', '#8a5a2b', 3)}
     <circle cx="4" cy="11" r="3.4" fill="#c98a4a"/><circle cx="60" cy="11" r="3.4" fill="#c98a4a"/>
     <path d="M11 27v13c0 4 9 7 21 7s21-3 21-7V27z" fill="#d94a4a"/>
     <ellipse cx="32" cy="27" rx="21" ry="7.5" fill="#f6ecd9"/>
     <ellipse cx="32" cy="27" rx="15" ry="5" fill="#ece0c8"/>
     ${ln('m12 31 8 8m32-8-8 8M22 41l10-8m10 8-10-8', '#f7d94a', 2.4)}` },
  { id: 'piano', name: 'Piano', family: 'musica', art:
    `<rect x="4" y="17" width="56" height="30" rx="4" fill="#3b3348"/>
     <rect x="7" y="22" width="50" height="22" rx="2" fill="#f7f4fa"/>
     ${ln('M16 22v22M24 22v22M32 22v22M40 22v22M48 22v22', '#c5bed0', 1.6)}
     <rect x="12" y="22" width="7" height="13" rx="1" fill="#3b3348"/>
     <rect x="21" y="22" width="7" height="13" rx="1" fill="#3b3348"/>
     <rect x="37" y="22" width="7" height="13" rx="1" fill="#3b3348"/>
     <rect x="45" y="22" width="7" height="13" rx="1" fill="#3b3348"/>` },
  { id: 'microfone', name: 'Microfone', family: 'musica', art:
    `<rect x="24" y="6" width="16" height="27" rx="8" fill="#5a4a6a"/>
     ${ln('M25 14h14M25 20h14M25 26h14', '#8d81a0', 1.6)}
     ${ln('M16 28c0 9 7 16 16 16s16-7 16-16', '#cdc6d8', 3.4)}
     <rect x="30" y="43" width="4" height="10" fill="#8d81a0"/>
     <path d="M20 58c0-3 5-5 12-5s12 2 12 5z" fill="#3b3348"/>` },
  { id: 'fone', name: 'Fone', family: 'musica', art:
    `${ln('M11 39V31a21 21 0 0 1 42 0v8', '#8b64c4', 6)}
     <rect x="4" y="34" width="14" height="21" rx="6" fill="#6f49ad"/>
     <rect x="46" y="34" width="14" height="21" rx="6" fill="#6f49ad"/>
     <rect x="8" y="38" width="6" height="13" rx="3" fill="#cdbcf0"/>
     <rect x="50" y="38" width="6" height="13" rx="3" fill="#cdbcf0"/>` },
  { id: 'trompete', name: 'Trompete', family: 'musica', art:
    `<path d="m34 32 24-16v32z" fill="#e8b23a"/>
     <ellipse cx="58" cy="32" rx="3" ry="16" fill="#cf9a26"/>
     <rect x="6" y="28" width="30" height="9" rx="4.5" fill="#f2c94c"/>
     <rect x="1" y="26" width="8" height="13" rx="3.5" fill="#cf9a26"/>
     <rect x="13" y="15" width="6" height="14" rx="2" fill="#cf9a26"/>
     <rect x="22" y="15" width="6" height="14" rx="2" fill="#cf9a26"/>
     <rect x="31" y="15" width="6" height="14" rx="2" fill="#cf9a26"/>
     <rect x="11" y="11" width="10" height="5" rx="2.5" fill="#f2c94c"/>
     <rect x="20" y="11" width="10" height="5" rx="2.5" fill="#f2c94c"/>
     <rect x="29" y="11" width="10" height="5" rx="2.5" fill="#f2c94c"/>` },
  { id: 'violino', name: 'Violino', family: 'musica', art:
    `<g transform="rotate(-20 32 32)">
       <rect x="29" y="6" width="6" height="16" fill="#4d2f18"/>
       <path d="M27 2h10v6H27z" fill="#3a2211"/>
       <path d="M32 20c5 0 8 3 8 7 0 3-2 5-2 7 0 4 6 5 6 12s-5 11-12 11-12-4-12-11 6-8 6-12c0-2-2-4-2-7 0-4 3-7 8-7Z" fill="#b5702f"/>
       ${ln('M28 40c-1-4-1-8 0-11M36 40c1-4 1-8 0-11', '#3a2211', 1.8)}
       ${ln('M30 22v26M34 22v26', '#f4ecdd', 1.2)}
     </g>
     ${ln('M6 48 56 16', '#d9c39a', 3)}${ln('M8 52 58 20', '#8a5a2b', 1.6)}` },
  { id: 'maracas', name: 'Maracás', family: 'musica', art:
    `${ln('M18 36v20M46 42v14', '#8a5a2b', 5.5)}
     <rect x="14" y="52" width="9" height="4" rx="2" fill="#6b4324"/>
     <rect x="42" y="52" width="9" height="4" rx="2" fill="#6b4324"/>
     <path d="M18 5c7 0 13 7 13 16s-6 15-13 15S5 30 5 21 11 5 18 5Z" fill="#ef8b34"/>
     <path d="M46 11c7 0 13 7 13 16s-6 15-13 15-13-6-13-15 6-16 13-16Z" fill="#e05a5a"/>
     ${ln('M7 26c7 3 15 3 22 0M35 32c7 3 15 3 22 0', '#c25a16', 2.6)}
     <circle cx="14" cy="15" r="2.2" fill="#fbe7a4"/><circle cx="23" cy="20" r="2.2" fill="#fbe7a4"/>
     <circle cx="42" cy="21" r="2.2" fill="#fbe7a4"/><circle cx="51" cy="26" r="2.2" fill="#fbe7a4"/>` },

  // --------------------------------------------------------------- natureza
  { id: 'arvore', name: 'Árvore', family: 'natureza', art:
    `<rect x="28" y="40" width="8" height="18" fill="#8a5a2b"/>
     <path d="M32 6 18 28h28zM32 20 13 45h38z" fill="#3f9553"/>
     <path d="M32 14 22 28h20zM32 27 18 45h28z" fill="#52b356"/>
     ${ln('M24 58h16', '#6b4324', 3)}` },
  { id: 'flor', name: 'Flor', family: 'natureza', art:
    `${ln('M32 32v25', '#41a24a', 3.4)}
     <path d="M32 46c7-7 14-5 16-3-3 6-10 9-16 5z" fill="#52b356"/>
     <circle cx="32" cy="15" r="8" fill="#f07fae"/><circle cx="45" cy="24" r="8" fill="#f07fae"/>
     <circle cx="40" cy="38" r="8" fill="#f07fae"/><circle cx="24" cy="38" r="8" fill="#f07fae"/>
     <circle cx="19" cy="24" r="8" fill="#f07fae"/>
     <circle cx="32" cy="27" r="8" fill="#f7d94a"/>
     <circle cx="30" cy="25" r="2.4" fill="#fff" opacity=".6"/>` },
  { id: 'sol', name: 'Sol', family: 'natureza', art:
    `${ln('M32 3v9M32 52v9M3 32h9M52 32h9M11 11l6.5 6.5M46.5 46.5 53 53M53 11l-6.5 6.5M17.5 46.5 11 53', '#ef8b34', 4)}
     <circle cx="32" cy="32" r="15" fill="#f7c93f"/>
     <circle cx="27" cy="27" r="4" fill="#fbe7a4" opacity=".8"/>` },
  { id: 'lua', name: 'Lua', family: 'natureza', art:
    `<path d="M40 7a25 25 0 1 0 0 50 28 28 0 0 1 0-50Z" fill="#f4dd76"/>
     <circle cx="30" cy="22" r="4" fill="#e0c65a"/><circle cx="24" cy="36" r="5.5" fill="#e0c65a"/>
     <circle cx="34" cy="45" r="3" fill="#e0c65a"/>
     <path d="m53 11 2 5 5 2-5 2-2 5-2-5-5-2 5-2zM50 39l1.6 3.6 3.6 1.6-3.6 1.6L50 49.4l-1.6-3.6L44.8 44l3.6-1.6z" fill="#f7d94a"/>` },
  { id: 'nuvem', name: 'Nuvem', family: 'natureza', art:
    `<path d="M19 44a12 12 0 0 1 1-24 16 16 0 0 1 30 4 10 10 0 0 1-2 20z" fill="#e8ecf5"/>
     <path d="M19 44a12 12 0 0 1-6-9c3 2 7 3 11 2 6-2 9-8 8-14 3 2 5 5 6 9 4-2 9-1 12 2 2 3 2 7 0 10z" fill="#cfd8ea"/>
     ${ln('M20 50v6M31 50v8M42 50v6', '#4f9fdd', 3.4)}` },
  { id: 'folha', name: 'Folha', family: 'natureza', art:
    `<path d="M53 8C27 8 11 24 11 44c0 5 2 9 4 9 20 0 38-18 38-45Z" fill="#52b356"/>
     <path d="M53 8C27 8 11 24 11 44c0 3 .6 5 1.4 6.6C20 28 34 14 53 8Z" fill="#3f9553"/>
     ${ln('M15 53C25 39 37 27 51 18', '#2f7a42', 2.4)}
     ${ln('M29 41c-1-7 0-13 2-18M39 31c-1-7 0-12 2-16', '#2f7a42', 2)}` },
  { id: 'montanha', name: 'Montanha', family: 'natureza', art:
    `<path d="M2 51 23 14l12 20 7-11 20 28z" fill="#7f8bb0"/>
     <path d="m23 14 7 12H16zM42 23l6 9H36z" fill="#f4f6fb"/>
     <path d="M2 51h60v3H2z" fill="#52b356"/>
     ${ln('M23 14 12 33', '#65719a', 2)}` },
  { id: 'cacto', name: 'Cacto', family: 'natureza', art:
    `<path d="M25 30h-5a6 6 0 0 0-6 6v4a7 7 0 0 0 7 7M39 22h5a6 6 0 0 1 6 6v6a7 7 0 0 1-7 7" fill="none" stroke="#3f9553" stroke-width="7" stroke-linecap="round"/>
     <rect x="24" y="10" width="15" height="38" rx="7.5" fill="#52b356"/>
     ${ln('M31 18v22', '#3f9553', 2)}
     <path d="M17 46h30l-3 12H20z" fill="#c9764a"/>
     <path d="M16 44h32v5H16z" fill="#e0895a"/>
     <circle cx="31" cy="8" r="4" fill="#f07fae"/>` },

  // ------------------------------------------------------------------- casa
  { id: 'casa', name: 'Casa', family: 'casa', art:
    `<path d="M32 7 3 30h58z" fill="#cf3644"/>
     <path d="M12 29h40v28H12z" fill="#f4e6cf"/>
     <rect x="27" y="39" width="11" height="18" fill="#8a5a2b"/>
     <circle cx="35" cy="48" r="1.4" fill="#f7d94a"/>
     <rect x="16" y="34" width="8" height="8" fill="#6cc0ef"/>
     <rect x="41" y="34" width="8" height="8" fill="#6cc0ef"/>
     <rect x="43" y="12" width="7" height="12" fill="#a9682f"/>` },
  { id: 'cadeira', name: 'Cadeira', family: 'casa', art:
    `<path d="M14 6h5v50h-5z" fill="#8a5a2b"/>
     <path d="M14 12h20v5H14zM14 22h20v5H14z" fill="#a9682f"/>
     <path d="M32 6h4v28h-4z" fill="#8a5a2b"/>
     <path d="M11 33h37l-4 8H13z" fill="#c98a4a"/>
     <path d="M15 41h5v16h-5zM41 41h5v16h-5z" fill="#8a5a2b"/>
     <path d="M17 47h27v4H17z" fill="#a9682f"/>` },
  { id: 'xicara', name: 'Xícara', family: 'casa', art:
    `${ln('M22 17c0-4 4-5 4-9M34 17c0-4 4-5 4-9', '#cdc6d8', 2.6)}
     <path d="M45 28h4a8 8 0 0 1 0 16h-4z" fill="none" stroke="#e8ecf5" stroke-width="4"/>
     <path d="M10 24h36v14a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill="#f4f6fb"/>
     <path d="M13 27h30v4c0 2-7 4-15 4s-15-2-15-4z" fill="#7a4a24"/>
     <path d="M7 55h42v4H7z" fill="#cfd8ea"/>` },
  { id: 'relogio', name: 'Relógio', family: 'casa', art:
    `<circle cx="32" cy="33" r="22" fill="#5a4a6a"/><circle cx="32" cy="33" r="18" fill="#f7f4fa"/>
     ${ln('M32 19v14l9 6', '#3b3348', 3)}
     ${ln('M32 33 22 25', '#cf3644', 2.4)}
     <circle cx="32" cy="33" r="2.4" fill="#3b3348"/>
     ${ln('M32 17v3M48 33h-3M32 49v-3M16 33h3', '#8d81a0', 2)}` },
  { id: 'lampada', name: 'Lâmpada', family: 'casa', art:
    `<circle cx="32" cy="25" r="17" fill="#fbe7a4"/>
     <path d="M32 8a17 17 0 0 0-9 31c2 2 2 5 2 7h14c0-2 0-5 2-7A17 17 0 0 0 32 8Z" fill="#f7d94a"/>
     ${ln('m26 30 6-8 6 8', '#cf9a26', 2.4)}
     <rect x="24" y="44" width="16" height="5" rx="2" fill="#a8a2b6"/>
     <rect x="26" y="50" width="12" height="5" rx="2" fill="#8d81a0"/>` },
  { id: 'livro', name: 'Livro', family: 'casa', art:
    `<path d="M32 17c-6-4-14-7-24-7v36c10 0 18 3 24 7z" fill="#4f9fdd"/>
     <path d="M32 17c6-4 14-7 24-7v36c-10 0-18 3-24 7z" fill="#e5424f"/>
     <path d="M32 21c-5-3-11-5-19-6v27c8 1 14 3 19 6z" fill="#f7f4fa"/>
     <path d="M32 21c5-3 11-5 19-6v27c-8 1-14 3-19 6z" fill="#efe9f2"/>
     ${ln('M32 21v32', '#8d81a0', 2)}` },
  { id: 'chave', name: 'Chave', family: 'casa', art:
    `<circle cx="17" cy="32" r="12" fill="#e8b23a"/><circle cx="17" cy="32" r="5" fill="#f7f4fa"/>
     <rect x="27" y="28" width="31" height="8" rx="3" fill="#f2c94c"/>
     <rect x="46" y="34" width="5" height="10" rx="2" fill="#f2c94c"/>
     <rect x="37" y="34" width="5" height="8" rx="2" fill="#f2c94c"/>` },
  { id: 'guardachuva', name: 'Guarda-chuva', family: 'casa', art:
    `<path d="M4 34a28 28 0 0 1 56 0z" fill="#e5424f"/>
     <path d="M18 34c0-16 6-29 14-29s14 13 14 29z" fill="#f7f4fa"/>
     <path d="M4 34c5-7 9-7 14 0 5-7 9-7 14 0 5-7 9-7 14 0 5-7 9-7 14 0l-2 4H6z" fill="#c9323e"/>
     ${ln('M32 5V1', '#8a5a2b', 3)}
     ${ln('M32 34v17a7 7 0 0 0 13 3', '#8a5a2b', 4)}` },

  // --------------------------------------------------------------- esportes
  { id: 'futebol', name: 'Bola de futebol', family: 'esportes', art:
    `<circle cx="32" cy="32" r="23" fill="#f7f4fa"/>
     <circle cx="32" cy="32" r="23" fill="none" stroke="#c5bed0" stroke-width="2"/>
     <path d="m32 19 11 8-4 13H25l-4-13z" fill="#3b3348"/>
     <path d="M32 9v9M45 27l9-3M39 41l7 10M25 41l-7 10M19 27l-9-3" fill="none" stroke="#3b3348" stroke-width="2.6"/>
     <path d="m10 24 4 12-4 4M54 24l-4 12 4 4M18 51h28" fill="none" stroke="#3b3348" stroke-width="2.2"/>` },
  { id: 'basquete', name: 'Bola de basquete', family: 'esportes', art:
    `<circle cx="32" cy="32" r="23" fill="#ef8b34"/>
     <path d="M9 32h46M32 9v46" fill="none" stroke="#3b3348" stroke-width="2.4"/>
     <path d="M16 15c7 6 11 11 11 17s-4 11-11 17M48 15c-7 6-11 11-11 17s4 11 11 17" fill="none" stroke="#3b3348" stroke-width="2.4"/>
     <circle cx="24" cy="22" r="4" fill="#f4a85c" opacity=".7"/>` },
  { id: 'raquete', name: 'Raquete', family: 'esportes', art:
    `<ellipse cx="29" cy="23" rx="17" ry="19" fill="#2f9fd6"/>
     <ellipse cx="29" cy="23" rx="13" ry="15" fill="#f7f4fa"/>
     ${ln('M22 10v26M29 8v30M36 10v26M17 16h24M16 23h26M18 30h22', '#c5bed0', 1.4)}
     <path d="M25 41h8l3 17h-14z" fill="#5a4a6a"/>
     <circle cx="50" cy="46" r="7" fill="#c8e05a"/>${ln('M45 42c3 3 4 6 4 9', '#f7f4fa', 1.6)}` },
  { id: 'skate', name: 'Skate', family: 'esportes', art:
    `<path d="M4 32c0-5 8-7 28-7s28 2 28 7-8 7-28 7S4 37 4 32Z" fill="#ef8b34"/>
     <path d="M14 27c10-2 26-2 36 0-10 2-26 2-36 0Z" fill="#f2b535"/>
     <rect x="15" y="38" width="5" height="5" fill="#5a4a6a"/><rect x="44" y="38" width="5" height="5" fill="#5a4a6a"/>
     <circle cx="17" cy="47" r="5.5" fill="#c5bed0"/><circle cx="47" cy="47" r="5.5" fill="#c5bed0"/>
     <circle cx="17" cy="47" r="2" fill="#8d81a0"/><circle cx="47" cy="47" r="2" fill="#8d81a0"/>` },
  { id: 'trofeu', name: 'Troféu', family: 'esportes', art:
    `<path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#f2c94c"/>
     <path d="M18 13h-7a10 10 0 0 0 10 10M46 13h7a10 10 0 0 1-10 10" fill="none" stroke="#e8b23a" stroke-width="3.4"/>
     <rect x="28" y="35" width="8" height="9" fill="#e8b23a"/>
     <path d="M24 44h16v6H24z" fill="#a9682f"/><path d="M18 50h28l2 7H16z" fill="#8a5a2b"/>
     <path d="m32 14 2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8z" fill="#fbe7a4"/>` },
  { id: 'halter', name: 'Halter', family: 'esportes', art:
    `<rect x="20" y="28" width="24" height="8" rx="2" fill="#8d81a0"/>
     <rect x="6" y="19" width="10" height="26" rx="4" fill="#cf3644"/>
     <rect x="48" y="19" width="10" height="26" rx="4" fill="#cf3644"/>
     <rect x="16" y="24" width="7" height="16" rx="3" fill="#5a4a6a"/>
     <rect x="41" y="24" width="7" height="16" rx="3" fill="#5a4a6a"/>` },
  { id: 'medalha', name: 'Medalha', family: 'esportes', art:
    `<path d="M15 5h11l11 21-8 5z" fill="#4f9fdd"/><path d="M49 5H38L27 26l8 5z" fill="#cf3644"/>
     <circle cx="32" cy="42" r="16" fill="#e8b23a"/><circle cx="32" cy="42" r="11" fill="#f2c94c"/>
     <path d="m32 34 2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8z" fill="#fbe7a4"/>` },
  { id: 'bandeira', name: 'Bandeira', family: 'esportes', art:
    `<rect x="11" y="6" width="4" height="52" rx="2" fill="#8d81a0"/>
     <rect x="15" y="10" width="34" height="24" fill="#f7f4fa"/>
     <path d="M15 10h11v8H15zM37 10h12v8H37zM26 18h11v8H26zM15 26h11v8H15zM37 26h12v8H37z" fill="#3b3348"/>` },

  // -------------------------------------------------------------------- mar
  { id: 'boia', name: 'Boia', family: 'mar', art:
    `<circle cx="32" cy="32" r="23" fill="#e5424f"/>
     <path d="M32 9a23 23 0 0 1 16 6.7L38.7 25A10 10 0 0 0 32 22zM9 32a23 23 0 0 1 6.7-16L25 25.3A10 10 0 0 0 22 32zM32 55a23 23 0 0 1-16-6.7l9.3-9.3A10 10 0 0 0 32 42zM55 32a23 23 0 0 1-6.7 16L39 38.7A10 10 0 0 0 42 32z" fill="#f7f4fa"/>
     <circle cx="32" cy="32" r="11" fill="none" stroke="#c5bed0" stroke-width="2"/>
     <circle cx="32" cy="32" r="23" fill="none" stroke="#c5bed0" stroke-width="2"/>` },
  { id: 'estrelamar', name: 'Estrela-do-mar', family: 'mar', art:
    `<path d="m32 5 9 19 21 3-15 14 4 21-19-10-19 10 4-21L2 27l21-3z" fill="#ef8b34"/>
     <circle cx="32" cy="30" r="2.2" fill="#d9701f"/><circle cx="25" cy="38" r="2" fill="#d9701f"/>
     <circle cx="39" cy="38" r="2" fill="#d9701f"/><circle cx="32" cy="45" r="2" fill="#d9701f"/>
     <circle cx="28" cy="22" r="1.8" fill="#d9701f"/><circle cx="37" cy="22" r="1.8" fill="#d9701f"/>` },
  { id: 'concha', name: 'Concha', family: 'mar', art:
    `<path d="M32 56 4 24c0-10 13-17 28-17s28 7 28 17z" fill="#f2a8bd"/>
     <path d="M32 56V7M32 56 18 10M32 56 46 10M32 56 7 20M32 56l25-36" fill="none" stroke="#dd7f9c" stroke-width="2.6"/>
     <path d="M32 56 4 24c0-4 2-7 6-10 6 16 14 30 22 42Z" fill="#f7c2d2"/>` },
  { id: 'ancora', name: 'Âncora', family: 'mar', art:
    `<circle cx="32" cy="11" r="7" fill="none" stroke="#8d81a0" stroke-width="4"/>
     <rect x="29" y="16" width="6" height="38" rx="2" fill="#8d81a0"/>
     <rect x="17" y="24" width="30" height="5" rx="2.5" fill="#8d81a0"/>
     ${ln('M11 37c0 12 10 20 21 20s21-8 21-20', '#8d81a0', 5)}
     <path d="m11 37-6 5 8 2zM53 37l6 5-8 2z" fill="#8d81a0"/>` },
  { id: 'caranguejo', name: 'Caranguejo', family: 'mar', art:
    `${ln('M16 45l-9 7M19 49l-7 8M48 45l9 7M45 49l7 8', '#d94a4a', 3)}
     <path d="M14 34 4 25c-3 4-2 10 3 12zM50 34l10-9c3 4 2 10-3 12z" fill="#e05a5a"/>
     <ellipse cx="32" cy="38" rx="19" ry="13" fill="#e5424f"/>
     ${ln('M25 27v-5M39 27v-5', '#e5424f', 2.6)}
     <circle cx="25" cy="19" r="4" fill="#fff"/><circle cx="39" cy="19" r="4" fill="#fff"/>
     ${eye(25, 19, 2.2)}${eye(39, 19, 2.2)}
     ${ln('M26 41c4 3 8 3 12 0', '#a92d38', 2.2)}` },
  { id: 'baleia', name: 'Baleia', family: 'mar', art:
    `<path d="m50 27 11-11v32L50 37z" fill="#3a7fba"/>
     <path d="M5 35c0-11 10-19 23-19 11 0 20 5 24 11v13c-4 7-13 11-24 11C15 51 5 45 5 35Z" fill="#4f9fdd"/>
     <path d="M7 42c5 6 13 9 21 9 8 0 16-3 21-8v-3c-5 5-13 8-21 8-8 0-16-3-21-6Z" fill="#dcebf8"/>
     ${ln('M24 16V5M17 12 11 3M31 12l6-9', '#9fd2f2', 3.4)}
     <circle cx="24" cy="3" r="3" fill="#9fd2f2"/><circle cx="11" cy="2" r="2.4" fill="#9fd2f2"/>
     <circle cx="37" cy="2" r="2.4" fill="#9fd2f2"/>
     ${eye(17, 33, 2.4)}` },
  { id: 'polvo', name: 'Polvo', family: 'mar', art:
    `${ln('M17 38c0 9-3 13-7 15 5 3 10 1 12-5M27 38c0 11-2 16-5 20 6 2 10-3 10-10M37 38c0 11 2 16 5 20-6 2-10-3-10-10M47 38c0 9 3 13 7 15-5 3-10 1-12-5', '#a06fd6', 5)}
     <path d="M16 32a16 16 0 0 1 32 0v7H16z" fill="#b483e8"/>
     <circle cx="25" cy="29" r="4.5" fill="#fff"/><circle cx="39" cy="29" r="4.5" fill="#fff"/>
     ${eye(25, 29, 2.4)}${eye(39, 29, 2.4)}
     <circle cx="22" cy="38" r="2" fill="#8b5cc4" opacity=".6"/><circle cx="42" cy="38" r="2" fill="#8b5cc4" opacity=".6"/>` },
  { id: 'farol', name: 'Farol', family: 'mar', art:
    `${ln('M23 16 6 9M23 24 6 28M41 16l17-7M41 24l17 4', '#f7d94a', 3.4)}
     <path d="M25 27h14l5 29H20z" fill="#f4f6fb"/>
     <path d="M22 37h20l1.2 7H20.8zM20.4 48h23.2l1 7H19.4z" fill="#e5424f"/>
     <rect x="23" y="16" width="18" height="11" rx="2" fill="#5a4a6a"/>
     <circle cx="32" cy="21" r="4.4" fill="#f7d94a"/>
     <path d="M26 6h12l5 9H21z" fill="#cf3644"/>
     <rect x="21" y="26" width="22" height="3" rx="1.5" fill="#8d81a0"/>
     <rect x="16" y="55" width="32" height="5" rx="2" fill="#8d81a0"/>` },

  // --------------------------------------------------------------- coringa
  { id: WILD, name: 'Camaleão', family: 'coringa', art:
    `${ln('M14 35c-6 3-8 11-3 15s12 0 11-6-7-5-7 2', '#52b356', 5)}
     ${ln('M25 43v9h-6M40 40v13h7', '#3f9553', 4)}
     <path d="M57 21c0 6-5 11-12 11-7 0-9 5-13 9s-11 7-17 5c-7-2-10-10-8-17 2-6 8-9 15-9 5 0 9-2 12-5 4-4 12-4 15-1 3 2 8 4 8 7Z" fill="#52b356"/>
     <path d="M50 12c4 2 7 5 7 9l-6 3z" fill="#3f9553"/>
     <circle cx="47" cy="20" r="5" fill="#f7d94a"/>${eye(47, 20, 2.4)}
     <circle cx="26" cy="30" r="3" fill="#f07fae" opacity=".8"/>
     <circle cx="34" cy="36" r="2.6" fill="#6cc0ef" opacity=".8"/>
     <circle cx="20" cy="38" r="2.4" fill="#f7d94a" opacity=".8"/>` }
];

export const FIGURE_BY_ID = new Map(FIGURES.map(figure => [figure.id, figure]));
export const figure = id => FIGURE_BY_ID.get(id) || null;
export const familyFigures = family => FIGURES.filter(item => item.family === family);
export const FAMILY_LABEL = Object.fromEntries(FAMILIES.map(item => [item.id, item.label]));
