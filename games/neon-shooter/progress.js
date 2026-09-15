import { DIFFICULTIES, DIFFICULTY_KEYS } from './config.js';

// Progresso salvo no aparelho: configurações, estatísticas e conquistas.
// Tudo que vem do localStorage passa por aqui e é limpo antes de ser usado —
// um valor corrompido nunca derruba a tela inicial.

export const ACHIEVEMENTS = [
  { id: 'kills100', name: 'Caçador', desc: 'Destrua 100 inimigos.', stat: 'kills', goal: 100, icon: 'crit' },
  { id: 'kills1000', name: 'Exterminador', desc: 'Destrua 1.000 inimigos.', stat: 'kills', goal: 1000, icon: 'skull' },
  { id: 'boss1', name: 'Primeiro chefe', desc: 'Derrote um chefe.', stat: 'bosses', goal: 1, icon: 'star' },
  { id: 'wave10', name: 'Veterano', desc: 'Chegue à onda 10.', stat: 'bestWave', goal: 10, icon: 'wave' },
  { id: 'wave25', name: 'Lenda', desc: 'Chegue à onda 25.', stat: 'bestWave', goal: 25, icon: 'wave' },
  { id: 'combo20', name: 'Em chamas', desc: 'Alcance combo x20.', stat: 'bestCombo', goal: 20, icon: 'combo' },
  { id: 'flawless', name: 'Intocável', desc: 'Termine uma onda sem sofrer dano.', stat: 'flawless', goal: 1, icon: 'shield' },
  { id: 'combo50', name: 'Imparável', desc: 'Alcance combo x50.', stat: 'bestCombo', goal: 50, icon: 'combo' },
  { id: 'bosses5', name: 'Caça-chefes', desc: 'Derrote 5 chefes.', stat: 'bosses', goal: 5, icon: 'trophy' },
  { id: 'hard10', name: 'Sem medo', desc: 'Chegue à onda 10 no Difícil.', stat: 'bestWaveHard', goal: 10, icon: 'skull' },
  { id: 'powerups50', name: 'Colecionador', desc: 'Colete 50 power-ups.', stat: 'powerups', goal: 50, icon: 'magnet' },
  { id: 'score100k', name: 'Seis dígitos', desc: 'Faça 100.000 pontos em uma partida.', stat: 'bestScore', goal: 100000, icon: 'star' }
];

export const DEFAULT_SETTINGS = {
  difficulty: 'normal',
  control: 'drag',      // drag | joystick
  sensitivity: 1.2,
  autofire: true,
  effects: 'full',      // full | low
  shake: true,
  sfx: true,
  sfxVolume: 0.8,
  music: true,
  musicVolume: 0.45
};

const count = (value, max = 1e12) =>
  Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : 0;
const unit = (value, fallback) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    difficulty: DIFFICULTY_KEYS.includes(s.difficulty) ? s.difficulty : d.difficulty,
    control: s.control === 'joystick' ? 'joystick' : 'drag',
    sensitivity: Number.isFinite(s.sensitivity) ? Math.min(2.2, Math.max(0.6, s.sensitivity)) : d.sensitivity,
    autofire: bool(s.autofire, d.autofire),
    effects: s.effects === 'low' ? 'low' : 'full',
    shake: bool(s.shake, d.shake),
    sfx: bool(s.sfx, d.sfx),
    sfxVolume: unit(s.sfxVolume, d.sfxVolume),
    music: bool(s.music, d.music),
    musicVolume: unit(s.musicVolume, d.musicVolume)
  };
}

export function emptyStats() {
  return {
    games: 0, kills: 0, bosses: 0, powerups: 0, flawless: 0, time: 0,
    bestScore: 0, bestWave: 0, bestCombo: 0,
    best: Object.fromEntries(DIFFICULTY_KEYS.map(key => [key, { score: 0, wave: 0 }]))
  };
}

export function cleanStats(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const stats = emptyStats();
  for (const key of ['games', 'kills', 'bosses', 'powerups', 'flawless', 'time', 'bestScore', 'bestWave', 'bestCombo']) {
    stats[key] = count(s[key]);
  }
  for (const key of DIFFICULTY_KEYS) {
    stats.best[key] = { score: count(s.best?.[key]?.score), wave: count(s.best?.[key]?.wave, 1e6) };
  }
  return stats;
}

export function cleanAchievements(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const def of ACHIEVEMENTS) {
    if (Number.isFinite(raw[def.id]) && raw[def.id] > 0) out[def.id] = raw[def.id];
  }
  return out;
}

// Estatísticas somadas à partida em andamento: permite liberar conquistas
// no momento em que acontecem, sem gravar nada antes do fim da partida.
export function liveStats(stats, run) {
  if (!run) return stats;
  const hard = run.difficulty === 'dificil' ? run.wave : 0;
  return {
    ...stats,
    kills: stats.kills + run.kills,
    bosses: stats.bosses + run.bosses,
    powerups: stats.powerups + run.powerups,
    flawless: stats.flawless + run.flawless,
    bestScore: Math.max(stats.bestScore, run.score),
    bestWave: Math.max(stats.bestWave, run.wave),
    bestCombo: Math.max(stats.bestCombo, run.maxCombo),
    best: { ...stats.best, dificil: { ...stats.best.dificil, wave: Math.max(stats.best.dificil.wave, hard) } }
  };
}

export function statValue(stats, stat) {
  if (stat === 'bestWaveHard') return stats.best.dificil.wave;
  return stats[stat] || 0;
}

export function achievementProgress(stats, def) {
  const value = Math.min(def.goal, statValue(stats, def.stat));
  return { value, goal: def.goal, ratio: value / def.goal };
}

// Devolve só as conquistas recém-liberadas e marca a data em `unlocked`.
export function checkAchievements(stats, unlocked, now = Date.now()) {
  const fresh = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked[def.id]) continue;
    if (statValue(stats, def.stat) >= def.goal) {
      unlocked[def.id] = now;
      fresh.push(def);
    }
  }
  return fresh;
}

// Fecha a partida nas estatísticas. Retorna quais recordes caíram.
export function recordRun(stats, run) {
  const key = DIFFICULTIES[run.difficulty] ? run.difficulty : 'normal';
  const best = stats.best[key];
  const result = { score: run.score > best.score, wave: run.wave > best.wave };
  stats.games += 1;
  stats.kills += count(run.kills);
  stats.bosses += count(run.bosses);
  stats.powerups += count(run.powerups);
  stats.flawless += count(run.flawless);
  stats.time += count(run.time);
  stats.bestScore = Math.max(stats.bestScore, count(run.score));
  stats.bestWave = Math.max(stats.bestWave, count(run.wave));
  stats.bestCombo = Math.max(stats.bestCombo, count(run.maxCombo));
  best.score = Math.max(best.score, count(run.score));
  best.wave = Math.max(best.wave, count(run.wave));
  return result;
}
