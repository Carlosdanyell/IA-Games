import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../games/neon-shooter/world.js';
import { makeEnemy, makeBoss, buildWave } from '../games/neon-shooter/enemies.js';
import { comboMultiplier, logicalSize, PLAYER, UPGRADES, FIELD, ENEMIES, BOSSES, DIFFICULTIES,
  DIFFICULTY_KEYS, WAVES } from '../games/neon-shooter/config.js';
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

// Piloto que desvia: campo de repulsão das ameaças mais atração pelo alvo. Sem
// ele a medição da dificuldade só mede quem não sabe jogar — e a curva que
// interessa é a de quem se mexe.
function dodger(W) {
  const p = W.player;
  let fx = 0, fy = 0;
  const push = (x, y, weight, range) => {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
    if (d > range) return;
    const f = weight * (1 - d / range) / d;
    fx += dx * f; fy += dy * f;
  };
  for (const s of W.shots) {
    const t = ((p.x - s.x) * s.vx + (p.y - s.y) * s.vy) / (s.vx * s.vx + s.vy * s.vy || 1);
    if (t >= 0 && t <= 1.2) push(s.x + s.vx * t * 0.6, s.y + s.vy * t * 0.6, 260, 120);
  }
  for (const e of W.enemies) if (e.y > -20) push(e.x, e.y, 200, 90 + e.r * 2);
  if (W.boss && W.boss.state === 'fight') push(W.boss.x, W.boss.y, 300, 120);
  let target = W.boss && W.boss.state === 'fight' ? W.boss : null, best = Infinity;
  if (!target) for (const e of W.enemies) {
    if (e.y < 0) continue;
    const s = Math.abs(e.x - p.x) + (W.h - e.y) * 0.25;
    if (s < best) { best = s; target = e; }
  }
  fx += Math.max(-1, Math.min(1, ((target ? target.x : W.w / 2) - p.x) / 40)) * 0.55;
  fy += (W.h - PLAYER.bottom - p.y) / 400 * 0.4;
  const m = Math.max(1, Math.hypot(fx, fy));
  return { ...idle, vx: Math.max(-1, Math.min(1, fx / m)), vy: Math.max(-1, Math.min(1, fy / m)) };
}

// Partida completa no compasso do jogo: a melhoria só sai no intervalo, uma por
// onda, e tudo o que está guardado é gasto no intervalo que antecede o chefe.
function simulate(difficulty, seed, seconds) {
  const W = createWorld({ w: 360, h: 640, difficulty, seed });
  let upgradeWave = 0;
  for (let t = 0; t < seconds && !W.over; t += STEP) {
    W.update(STEP, dodger(W));
    W.events.length = 0;
    const beforeBoss = (W.wave + 1) % WAVES.bossEvery === 0;
    while (W.stage === 'rest' && W.pendingLevels > 0 && (beforeBoss || upgradeWave !== W.wave)) {
      upgradeWave = W.wave;
      const offer = W.offerUpgrades();
      if (!offer.length || !W.applyUpgrade(offer[0])) { W.pendingLevels = 0; break; }
      if (!beforeBoss) break;
    }
  }
  return W;
}

// Sob um teto de tempo, a onda alcançada mede o relógio, não a perícia: quem
// sobrevive para no teto. O que separa os níveis é quanto tempo a nave dura.
function survival(difficulty, seeds, seconds) {
  let alive = 0, total = 0;
  for (const seed of seeds) {
    const W = createWorld({ w: 360, h: 640, difficulty, seed });
    let upgradeWave = 0, t = 0;
    for (; t < seconds && !W.over; t += STEP) {
      W.update(STEP, dodger(W));
      W.events.length = 0;
      const beforeBoss = (W.wave + 1) % WAVES.bossEvery === 0;
      while (W.stage === 'rest' && W.pendingLevels > 0 && (beforeBoss || upgradeWave !== W.wave)) {
        upgradeWave = W.wave;
        const offer = W.offerUpgrades();
        if (!offer.length || !W.applyUpgrade(offer[0])) { W.pendingLevels = 0; break; }
        if (!beforeBoss) break;
      }
    }
    total += t;
    if (!W.over) alive++;
  }
  return { time: total / seeds.length, alive };
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

test('a vida do chefe anda separada da vida dos inimigos e varia pouco entre os níveis', () => {
  for (const key of DIFFICULTY_KEYS) {
    const d = DIFFICULTIES[key];
    for (const field of ['bossHp', 'invuln', 'count', 'fire', 'hp', 'drops', 'score', 'speed']) {
      assert.equal(typeof d[field], 'number', `${key} sem ${field}`);
    }
  }
  // Chefe com muita vida não fica difícil, fica longo: a luta longa cobra a vida
  // do jogador por desgaste. A separação entre os níveis mora na pressão.
  const spread = f => DIFFICULTIES.dificil[f] / DIFFICULTIES.facil[f];
  assert.ok(spread('bossHp') < spread('count'), 'a vida do chefe não pode ser o que separa os níveis');
  assert.ok(spread('bossHp') < spread('fire'), 'a cadência tem de separar mais que a vida do chefe');
  assert.ok(DIFFICULTIES.facil.invuln > 1 && DIFFICULTIES.dificil.invuln < 1);

  const hard = createWorld({ w: 360, h: 640, difficulty: 'dificil', seed: 21 });
  const easy = createWorld({ w: 360, h: 640, difficulty: 'facil', seed: 21 });
  hard.beginWave(5); easy.beginWave(5);
  const hardBoss = makeBoss(hard, 0), easyBoss = makeBoss(easy, 0);
  assert.equal(hardBoss.maxHp, Math.round(BOSSES[0].hp * DIFFICULTIES.dificil.bossHp));
  assert.ok(hardBoss.maxHp / easyBoss.maxHp < 1.5, 'a luta do Difícil não pode ser 50% mais longa que a do Fácil');
});

test('a carência depois do dano acompanha a dificuldade', () => {
  const take = key => {
    const W = createWorld({ w: 360, h: 640, difficulty: key, seed: 12 });
    W.hurtPlayer(1);
    return W.player.invuln;
  };
  assert.ok(take('facil') > take('normal'));
  assert.ok(take('normal') > take('dificil'));
  assert.equal(take('normal'), PLAYER.invuln);
});

test('cada virada de fase do chefe solta um power-up', () => {
  const W = createWorld({ w: 360, h: 640, seed: 31 });
  W.player.hp = W.player.maxHp = 1e6;
  W.beginWave(5);
  W.enemies.length = 0;
  let guard = 0;
  while (!(W.boss && W.boss.state === 'fight') && guard++ < 1200) {
    W.update(STEP, { ...idle, autofire: false });
    W.events.length = 0;
  }
  const boss = W.boss;
  assert.ok(boss, 'chefe não apareceu');
  W.drops.length = 0;
  boss.hp = boss.maxHp * 0.6;
  W.update(STEP, { ...idle, autofire: false });
  assert.equal(boss.phase, 1);
  assert.equal(W.drops.length, 1, 'a segunda fase precisa soltar um power-up');
  boss.hp = boss.maxHp * 0.3;
  W.update(STEP, { ...idle, autofire: false });
  assert.equal(boss.phase, 2);
  assert.equal(W.drops.length, 2, 'a terceira fase precisa soltar outro power-up');
});

test('cada onda até a oitava estreia exatamente um tipo, e o primeiro que atira vem antes do meio', () => {
  const byWave = new Map();
  for (const [type, def] of Object.entries(ENEMIES)) {
    byWave.set(def.minWave, (byWave.get(def.minWave) || 0) + 1);
  }
  for (let wave = 1; wave <= 8; wave++) {
    assert.equal(byWave.get(wave), 1, `onda ${wave} devia estrear um tipo só`);
  }
  // Nada no campo acerta quem se mexe antes do primeiro inimigo que atira: é ele
  // que termina o silêncio da abertura e ensina a desviar.
  const shooters = Object.values(ENEMIES).filter(d => d.fireEvery).map(d => d.minWave);
  assert.ok(Math.min(...shooters) <= 3, 'o primeiro inimigo que atira não pode demorar tanto');
});

test('a onda tardia pesa mais que a inicial: mais orçamento, menos intervalo e mais quem atira', () => {
  const budget = w => Math.min(WAVES.maxCount, Math.round(WAVES.baseCount + (w - 1) * WAVES.perWave));
  const gap = w => Math.max(WAVES.gapMin, WAVES.gapStart - (w - 1) * WAVES.gapStep);
  assert.ok(budget(10) > budget(1) * 2, 'a onda 10 tem de dobrar o orçamento da onda 1');
  assert.ok(gap(12) < gap(1), 'o intervalo entre grupos tem de encolher');

  // A composição tem de migrar para quem atira: é de onde vem quase todo o dano.
  const share = wave => {
    const W = createWorld({ w: 360, h: 640, seed: 44 });
    W.wave = wave;
    let shooters = 0, total = 0;
    for (let i = 0; i < 400; i++) {
      for (const s of buildWave(W, wave)) {
        for (const spawn of s.spawns) { total++; if (ENEMIES[spawn.type].fireEvery) shooters++; }
      }
    }
    return shooters / total;
  };
  assert.ok(share(14) > share(5) * 1.3, 'ondas tardias precisam trazer bem mais inimigos que atiram');
});

test('a curva separa os três níveis: a nave dura mais no Fácil que no Difícil', { timeout: 180000 }, () => {
  const seeds = [17, 59, 113, 211, 307];
  const facil = survival('facil', seeds, 420);
  const normal = survival('normal', seeds, 420);
  const dificil = survival('dificil', seeds, 420);
  const conta = s => `${s.time.toFixed(0)} s, ${s.alive} de ${seeds.length} vivas`;
  assert.ok(facil.time > normal.time, `Fácil (${conta(facil)}) tem de durar mais que Normal (${conta(normal)})`);
  assert.ok(normal.time > dificil.time, `Normal (${conta(normal)}) tem de durar mais que Difícil (${conta(dificil)})`);
  // Antes deste ajuste os três níveis morriam na mesma onda 5, com a mesma
  // mediana de tempo: a escolha do jogador não mudava a partida.
  assert.ok(facil.time >= dificil.time * 1.4,
    `a folga entre Fácil (${conta(facil)}) e Difícil (${conta(dificil)}) ficou pequena demais`);
  assert.ok(facil.alive > dificil.alive, 'o Fácil tem de terminar o teto com mais naves de pé');
});

test('o primeiro chefe não é um muro: cai antes do Normal passar da metade da vida', { timeout: 120000 }, () => {
  // Com o piloto que desvia, o jogador entrega perto de um quinto do dano teórico
  // durante a luta. O primeiro chefe aparece com poucas melhorias no bolso, então
  // a vida dele tem de caber nessa conta — senão a partida inteira acaba na onda 5.
  const dps = (1 + 2 * 0.2) * (1 + 2 * 0.15) / PLAYER.fireInterval;
  const segundos = BOSSES[0].hp / (dps * 0.2);
  assert.ok(segundos < 60, `o Guardião Prisma leva ${segundos.toFixed(0)} s de luta`);

  const mortes = [17, 59, 113, 211].filter(seed => simulate('normal', seed, 200).over
    && simulate('normal', seed, 200).wave === 5).length;
  assert.ok(mortes <= 2, `${mortes} de 4 partidas no Normal ainda terminam na onda 5`);
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
