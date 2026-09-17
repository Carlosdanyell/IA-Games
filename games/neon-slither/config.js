export const ARENA = { radius: 1800, food: 900, maxFood: 2200, speed: 105, boost: 185, startMass: 32, minMass: 20, maxMass: 6000, spacing: 5 };
export const DIFFICULTIES = {
  easy: { name: 'Fácil', bots: 16, reaction: .34, foresight: 95, aggression: .08, note: 'Rivais tranquilos, focados em alimento.' },
  normal: { name: 'Normal', bots: 22, reaction: .20, foresight: 145, aggression: .35, note: 'Rivais disputam alimento e tentam cortar caminho.' },
  hard: { name: 'Difícil', bots: 28, reaction: .12, foresight: 200, aggression: .65, note: 'Rivais antecipam curvas e aceleram para interceptar.' }
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
