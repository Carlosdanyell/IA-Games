import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../games/neon-shooter/world.js';
import { makeEnemy } from '../games/neon-shooter/enemies.js';
import { comboMultiplier, logicalSize, PLAYER, UPGRADES, FIELD } from '../games/neon-shooter/config.js';
import { cleanSettings, cleanStats, cleanAchievements, checkAchievements, recordRun, liveStats, emptyStats,
  DEFAULT_SETTINGS } from '../games/neon-shooter/progress.js';

const STEP = 1 / 120;
const idle = { dx: 0, dy: 0, vx: 0, vy: 0, firing: false, autofire: true };
const finite = (...values) => values.every(Number.isFinite);

// Piloto simples: segue na horizontal o chefe ou o inimigo mais próximo da nave.
function autopilot(W) {
  const p = W.player;
  let target = W.boss && W.boss.state === 'fight' ? W.boss : null;
  let best = Infinity;
  if (!target) {
    for (const e of W.enemies) {
      if (e.y < 0) continue;
      const score = Math.abs(e.x - p.x) + (W.h - e.y) * 0.2;
      if (score < best) { best = score; target = e; }
    }
  }
  const tx = target ? target.x : W.w / 2;
  return { ...idle, vx: Math.max(-1, Math.min(1, (tx - p.x) / 30)) };
}

function play(W, seconds, controls = () => idle) {
  for (let t = 0; t < seconds && !W.over; t += STEP) {
    W.update(STEP, controls(t));
    W.events.length = 0;
    // Nos testes a melhoria é escolhida na hora, como se o jogador tocasse no primeiro cartão.
    while (W.pendingLevels > 0) {
      const offer = W.offerUpgrades();
      if (!offer.length || !W.applyUpgrade(offer[0])) W.pendingLevels = 0;
    }
  }
}

test('campo lógico: retrato com largura fixa e paisagem com altura fixa', () => {
  assert.deepEqual(logicalSize(0.5), { w: FIELD.w, h: 720 });
  assert.equal(logicalSize(0.1).h, FIELD.hMax);
  const wide = logicalSize(16 / 9);
  assert.equal(wide.h, FIELD.landscapeH);
  assert.ok(wide.w > FIELD.w && wide.w <= FIELD.wMax && wide.w % FIELD.step === 0);
});

test('três minutos de partida com tiro automático: sem NaN, limites respeitados e ondas avançando', () => {
  const W = createWorld({ w: 360, h: 640, difficulty: 'dificil', seed: 7 });
  W.player.maxHp = W.player.hp = 1e6;
  let maxShots = 0, maxBullets = 0, bossSeen = false;
  const check = () => {
    maxShots = Math.max(maxShots, W.shots.length);
    maxBullets = Math.max(maxBullets, W.bullets.length);
    if (W.boss) bossSeen = true;
    assert.ok(finite(W.player.x, W.player.y, W.score));
    for (const e of W.enemies) assert.ok(finite(e.x, e.y, e.hp), `inimigo ${e.type} inválido`);
    for (const s of W.shots) assert.ok(finite(s.x, s.y));
  };
  for (let i = 0; i < 180 * 120 && !W.over; i++) {
    W.update(STEP, autopilot(W));
    W.events.length = 0;
    while (W.pendingLevels > 0) W.applyUpgrade(W.offerUpgrades()[0]) || (W.pendingLevels = 0);
    if (i % 30 === 0) check();
  }
  assert.ok(W.wave >= 5, `parou na onda ${W.wave}`);
  assert.ok(bossSeen || W.bosses > 0, 'nenhum chefe apareceu');
  assert.ok(maxBullets <= PLAYER.maxBullets && maxShots <= 260);
  assert.ok(W.kills > 50 && W.score > 0);
});

test('dano deixa a nave invulnerável por um tempo e zera o combo', () => {
  const W = createWorld({ w: 360, h: 640, seed: 1 });
  W.combo = 12;
  assert.equal(W.hurtPlayer(1), true);
  assert.equal(W.player.hp, PLAYER.maxHp - 1);
  assert.equal(W.combo, 0);
  assert.equal(W.hurtPlayer(1), false, 'segundo golpe imediato não pode tirar vida');
  assert.equal(W.player.hp, PLAYER.maxHp - 1);
  play(W, PLAYER.invuln + 0.05, () => ({ ...idle, autofire: false }));
  assert.equal(W.hurtPlayer(1), true);
  assert.equal(W.player.hp, PLAYER.maxHp - 2);
});

test('escudo bloqueia o dano e preserva o combo', () => {
  const W = createWorld({ w: 360, h: 640, seed: 2 });
  W.collect('shield');
  W.combo = 9;
  W.hurtPlayer(2);
  assert.equal(W.player.hp, PLAYER.maxHp);
  assert.equal(W.combo, 9);
});

test('chefe surge na onda 5, muda de fase pela vida e rende melhoria ao cair', () => {
  const W = createWorld({ w: 360, h: 640, seed: 3 });
  W.player.hp = W.player.maxHp = 1e6;
  W.beginWave(5);
  W.enemies.length = 0;
  let guard = 0;
  while (!(W.boss && W.boss.state === 'fight') && guard++ < 1200) { W.update(STEP, { ...idle, autofire: false }); W.events.length = 0; }
  const boss = W.boss;
  assert.ok(boss, 'chefe não apareceu');
  boss.hp = boss.maxHp * 0.6;
  W.update(STEP, { ...idle, autofire: false });
  assert.equal(boss.phase, 1);
  boss.hp = boss.maxHp * 0.3;
  W.update(STEP, { ...idle, autofire: false });
  assert.equal(boss.phase, 2);
  W.events.length = 0;
  W.damageBoss(boss.hp + 1);
  assert.equal(W.boss, null);
  assert.equal(W.bosses, 1);
  assert.ok(W.pendingLevels >= 1, 'derrotar o chefe precisa liberar uma melhoria');
  assert.ok(W.events.some(e => e.type === 'bossDown'));
});

test('bomba fere todos os inimigos e limpa os tiros inimigos', () => {
  const W = createWorld({ w: 360, h: 640, seed: 4 });
  for (let i = 0; i < 5; i++) W.enemies.push(makeEnemy(W, 'drone', 40 + i * 60, 120));
  W.shots.push({ x: 100, y: 300, vx: 0, vy: 100, r: 4, color: '#fff', t: 0 });
  W.collect('bomb');
  assert.ok(W.enemies.every(e => e.dead));
  assert.equal(W.shots.length, 0);
});

test('tiro duplo, triplo e os dois juntos', () => {
  const count = setup => {
    const W = createWorld({ w: 360, h: 640, seed: 5 });
    setup(W);
    W.fire();
    return W.bullets.length;
  };
  assert.equal(count(() => {}), 1);
  assert.equal(count(W => { W.effects.double = 5; }), 2);
  assert.equal(count(W => { W.effects.triple = 5; }), 3);
  assert.equal(count(W => { W.effects.double = 5; W.effects.triple = 5; }), 4);
});

test('melhorias: opções distintas, requisito do tiro triplo e reparo com vida baixa', () => {
  const W = createWorld({ w: 360, h: 640, seed: 6 });
  const offer = W.offerUpgrades();
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer).size, 3);
  assert.equal(W.canUpgrade('spread'), false);
  assert.equal(W.canUpgrade('repair'), false, 'reparo não aparece com vida cheia');
  assert.equal(W.applyUpgrade('twin'), true);
  assert.equal(W.canUpgrade('spread'), true);
  assert.equal(W.applyUpgrade('twin'), false, 'máximo do tiro duplo é 1');
  W.player.hp = 1;
  assert.equal(W.offerUpgrades()[0], 'repair');
  for (const id of Object.keys(UPGRADES)) assert.ok(UPGRADES[id].max >= 1);
});

test('dificuldade muda vida e velocidade dos inimigos', () => {
  const easy = createWorld({ w: 360, h: 640, difficulty: 'facil', seed: 8 });
  const hard = createWorld({ w: 360, h: 640, difficulty: 'dificil', seed: 8 });
  const a = makeEnemy(easy, 'tank', 100, 50), b = makeEnemy(hard, 'tank', 100, 50);
  assert.ok(b.hp > a.hp && b.speed > a.speed);
});

test('combo multiplica os pontos até o teto', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(9), 1);
  assert.equal(comboMultiplier(10), 1.25);
  assert.equal(comboMultiplier(500), 3);
});

test('progresso salvo: dados corrompidos viram padrão, conquistas liberam uma vez e recordes contam', () => {
  assert.deepEqual(cleanSettings({ control: 'x', sensitivity: 'alto', sfxVolume: 9, autofire: 'sim' }),
    { ...DEFAULT_SETTINGS, sfxVolume: 1 });
  const stats = cleanStats({ kills: -5, bestScore: 'x', best: { normal: { score: 12.7, wave: NaN } } });
  assert.equal(stats.kills, 0);
  assert.equal(stats.best.normal.score, 12);
  assert.equal(stats.best.normal.wave, 0);
  assert.deepEqual(cleanAchievements({ kills100: 5, falso: 1, boss1: 'ontem' }), { kills100: 5 });

  const unlocked = {};
  const run = { difficulty: 'dificil', score: 120000, wave: 11, kills: 130, bosses: 2, powerups: 3, flawless: 1, maxCombo: 25, time: 400 };
  const fresh = checkAchievements(liveStats(emptyStats(), run), unlocked, 99).map(a => a.id).sort();
  assert.deepEqual(fresh, ['boss1', 'combo20', 'flawless', 'hard10', 'kills100', 'score100k', 'wave10']);
  assert.deepEqual(checkAchievements(liveStats(emptyStats(), run), unlocked), []);

  const saved = emptyStats();
  assert.deepEqual(recordRun(saved, run), { score: true, wave: true });
  assert.deepEqual(recordRun(saved, { ...run, score: 10 }), { score: false, wave: false });
  assert.equal(saved.games, 2);
  assert.equal(saved.best.dificil.score, 120000);
});
