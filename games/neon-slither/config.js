export const ARENA = {
  // A arena acompanha o teto de crescimento: com o raio antigo de 1800 uma
  // cobra grande enxergava quase o mapa inteiro e não sobrava para onde fugir.
  radius: 3600, food: 3400, maxFood: 8000, speed: 175, boost: 300,
  // O teto de massa é alto de propósito: no ritmo real de uma partida ele nunca
  // é alcançado, então crescer não esbarra em parede como acontecia com 6000.
  startMass: 32, minMass: 26, maxMass: 120000, spacing: 6,
  // Luz reposta por ciclo de 0,25 s. Acompanha o tamanho da arena, senão uma
  // cobra grande limpa a região e o mapa demora a repor.
  refill: 40,
  // Luz comum vale mais de um ponto: o crescimento inicial precisa ser sentido
  // nos primeiros segundos, como no slither.io.
  foodValue: 1.8,
  // Acelerar custa uma fração da massa por segundo, com piso para as pequenas.
  boostDrain: .022, boostFloor: 3.4,
  // Alcance em que a luz é puxada para a cabeça. Comer vira um movimento
  // contínuo em vez de exigir passar por cima do ponto exato.
  magnet: 34
};
// bots: quantos rivais; reaction: intervalo entre decisões; foresight: alcance
// da leitura de perigo; aggression: chance de caçar quem já está em desvantagem;
// skill: precisão do rumo escolhido; mass: faixa de massa no nascimento.
export const DIFFICULTIES = {
  easy: { name: 'Fácil', bots: 20, reaction: .30, foresight: 120, aggression: .05, skill: .55, mass: [24, 70],
    note: 'Rivais pequenos e distraídos, quase sempre atrás de alimento.' },
  normal: { name: 'Normal', bots: 28, reaction: .22, foresight: 155, aggression: .20, skill: .78, mass: [26, 120],
    note: 'Rivais disputam alimento e cortam caminho de quem está menor que eles.' },
  hard: { name: 'Difícil', bots: 32, reaction: .14, foresight: 195, aggression: .36, skill: 1, mass: [28, 170],
    note: 'Rivais antecipam curvas e aceleram para interceptar presas menores.' }
};
export const SKINS = [
  { id: 'aurora', name: 'Aurora', colors: ['#75ffd0', '#27bf9e'], pattern: 'ribbon', detail: '#d6fff0', note: 'Uma fita de luz verde.', goal: 0 },
  { id: 'plasma', name: 'Plasma', colors: ['#c887ff', '#733be0'], pattern: 'rings', detail: '#efd5ff', note: 'Anéis de energia violeta.', goal: 0 },
  { id: 'solar', name: 'Solar', colors: ['#ffc75a', '#ff8650'], pattern: 'chevron', detail: '#fff0ae', note: 'Raios dourados em movimento.', goal: 0 },
  { id: 'oceano', name: 'Oceano', colors: ['#54d4ff', '#3675d9'], pattern: 'wave', detail: '#c4f6ff', note: 'Ondas de azul profundo.', goal: 0 },
  { id: 'sintese', name: 'Síntese', colors: ['#ff82bc', '#b99dff', '#71e9e0'], pattern: 'confetti', detail: '#fff1fd', note: 'Confetes em tons de doce.', goal: 150 },
  { id: 'prisma', name: 'Prisma', colors: ['#ff7d88', '#ffd166', '#abeb77', '#67ddd8', '#8eaaff', '#d69aff'], pattern: 'ribbon', detail: '#ffffff', note: 'O espectro inteiro na arena.', goal: 400 },
  { id: 'polar', name: 'Polar', colors: ['#e9f6ff', '#81badb'], pattern: 'facets', detail: '#ffffff', note: 'Cristais talhados em gelo.', goal: 800 },
  { id: 'eclipse', name: 'Eclipse', colors: ['#5a477d', '#332848'], pattern: 'rings', detail: '#ffd77c', note: 'Anéis de ouro na escuridão.', goal: 1400 },
  { id: 'tigre', name: 'Tigre', colors: ['#ffb23f', '#f7812f'], pattern: 'tiger', detail: '#342235', note: 'Listras selvagens em âmbar.', goal: 0 },
  { id: 'koi', name: 'Koi', colors: ['#fff5e8', '#e8dbd1'], pattern: 'spots', detail: '#f45859', note: 'Manchas vermelhas sobre pérola.', goal: 0 },
  { id: 'circuito', name: 'Circuito', colors: ['#163e45', '#102b35'], pattern: 'circuit', detail: '#60ffe2', note: 'Trilhas elétricas e visor neon.', goal: 0 },
  { id: 'pixel', name: 'Pixel', colors: ['#8060f2', '#5543be'], pattern: 'pixels', detail: '#9eff65', note: 'Blocos verdes. Alma de arcade.', goal: 0 },
  { id: 'magma', name: 'Magma', colors: ['#74352e', '#35232b'], pattern: 'cracks', detail: '#ff9958', note: 'Fendas acesas como lava.', goal: 250 },
  { id: 'draco', name: 'Draco', colors: ['#4fb589', '#24604e'], pattern: 'scales', detail: '#d4ef8a', note: 'Escamas de jade e ouro.', goal: 600 },
  { id: 'galaxia', name: 'Galáxia', colors: ['#7545b4', '#353262'], pattern: 'stars', detail: '#aff1ff', note: 'Uma constelação para guiar.', goal: 1100 },
  { id: 'imperial', name: 'Imperial', colors: ['#efd078', '#bd8844'], pattern: 'diamonds', detail: '#433048', note: 'Diamantes sobre ouro polido.', goal: 2000 }
];
export const NAMES = ['Órbita', 'Cometa', 'Íon', 'Vórtice', 'Quasar', 'Nébula', 'Pulso', 'Fóton', 'Vega', 'Nova', 'Cosmo', 'Prisma', 'Lúmen', 'Eclipse'];
export const skinFor = id => SKINS.find(s => s.id === id) || SKINS[0];
const validNumber = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(n, 1e9) : 0;
export function cleanProfile(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const best = validNumber(raw.best);
  return { best, games: Math.floor(validNumber(raw.games)), kills: Math.floor(validNumber(raw.kills)), time: validNumber(raw.time),
    difficulty: Object.hasOwn(DIFFICULTIES, raw.difficulty) ? raw.difficulty : 'normal',
    skin: SKINS.find(s => s.id === raw.skin && s.goal <= best)?.id || 'aurora',
    control: raw.control === 'direct' ? 'direct' : 'joystick', fullscreen: raw.fullscreen !== false };
}
