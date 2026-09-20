export const ARENA = {
  radius: 1800, food: 900, maxFood: 2200, speed: 175, boost: 300,
  startMass: 32, minMass: 26, maxMass: 6000, spacing: 6,
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
  easy: { name: 'Fácil', bots: 12, reaction: .30, foresight: 120, aggression: .05, skill: .55, mass: [24, 70],
    note: 'Rivais pequenos e distraídos, quase sempre atrás de alimento.' },
  normal: { name: 'Normal', bots: 16, reaction: .22, foresight: 155, aggression: .20, skill: .78, mass: [26, 120],
    note: 'Rivais disputam alimento e cortam caminho de quem está menor que eles.' },
  hard: { name: 'Difícil', bots: 18, reaction: .14, foresight: 195, aggression: .36, skill: 1, mass: [28, 170],
    note: 'Rivais antecipam curvas e aceleram para interceptar presas menores.' }
};
export const SKINS = [
  { id: 'aurora', name: 'Aurora', colors: ['#65f3cb', '#2cbaa0'], goal: 0 },
  { id: 'plasma', name: 'Plasma', colors: ['#d49aff', '#854dec'], goal: 0 },
  { id: 'solar', name: 'Solar', colors: ['#ffd166', '#ff855e'], goal: 0 },
  { id: 'oceano', name: 'Oceano', colors: ['#72d8ff', '#4186ee'], goal: 0 },
  { id: 'sintese', name: 'Síntese', colors: ['#ff82bc', '#e6b1ff', '#71e9e0'], goal: 150 },
  { id: 'prisma', name: 'Prisma', colors: ['#ff7d88', '#ffd166', '#abeb77', '#67ddd8', '#8eaaff', '#d69aff'], goal: 400 },
  { id: 'polar', name: 'Polar', colors: ['#f1f6ff', '#89b7d9'], goal: 800 },
  { id: 'eclipse', name: 'Eclipse', colors: ['#bf9aff', '#645887', '#ffd166'], goal: 1400 }
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
