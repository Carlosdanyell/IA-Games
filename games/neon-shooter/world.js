import { createRng } from '../../core/rng.js';
import { PLAYER, POWERUPS, POWER, TIMED_POWERUPS, UPGRADES, WAVES, SCORE, BOSS, DIFFICULTIES,
  xpForLevel, comboMultiplier } from './config.js';
import { buildWave, spawnGroup, updateEnemy, splitEnemy, makeBoss, updateBoss, weightedPick, clamp }
  from './enemies.js';

// Simulação da partida: nave, tiros, colisões, ondas, chefes, power-ups,
// melhorias e pontuação. Não desenha nem toca som: registra `events`, que o
// jogo consome a cada quadro para efeitos visuais, áudio e HUD.

const hit = (ax, ay, bx, by, r) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy < r * r;
};

export function createWorld({ w, h, difficulty = 'normal', seed = Date.now() }) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const zeroEffects = () => Object.fromEntries(TIMED_POWERUPS.map(k => [k, 0]));
  const W = {
    w, h, difficulty: DIFFICULTIES[difficulty] ? difficulty : 'normal', diff, rng: createRng(seed >>> 0),
    time: 0, over: false, slowmo: 0,
    player: { x: w / 2, y: h - PLAYER.bottom, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
              invuln: 0, fire: 0, aegis: 0, tilt: 0, alive: true, hitFlash: 0 },
    bullets: [], enemies: [], shots: [], drops: [], boss: null,
    wave: 0, stage: 'intro', stageTimer: 0, queue: [], queueTimer: 0, waveDamaged: false, bossCount: 0,
    score: 0, kills: 0, combo: 0, maxCombo: 0, bosses: 0, powerups: 0, flawless: 0,
    scoreClock: 0, dropPity: 0,
    xp: 0, level: 1, xpNext: xpForLevel(1), pendingLevels: 0,
    effects: zeroEffects(), effectMax: zeroEffects(),
    up: Object.fromEntries(Object.keys(UPGRADES).map(k => [k, 0])),
    events: []
  };
  const p = W.player;
  const emit = event => { if (W.events.length < 400) W.events.push(event); };

  // --------------------------------------------------------------- ondas
  function beginWave(n) {
    W.wave = n;
    W.waveDamaged = false;
    const boss = n % WAVES.bossEvery === 0;
    W.stage = boss ? 'warning' : 'intro';
    W.stageTimer = boss ? WAVES.bossWarning : WAVES.intro;
    W.queue = boss ? [] : buildWave(W, n);
    W.queueTimer = W.queue[0]?.delay ?? 0;
    emit({ type: boss ? 'bossWarning' : 'waveStart', wave: n });
  }

  function clearWave() {
    const flawless = !W.waveDamaged;
    const bonus = Math.round(SCORE.waveClear * W.wave * diff.score * (flawless ? SCORE.flawlessMult : 1));
    W.score += bonus;
    if (flawless) W.flawless++;
    W.stage = 'rest';
    W.stageTimer = WAVES.rest;
    emit({ type: 'waveClear', wave: W.wave, bonus, flawless });
  }

  function updateWaves(dt, edt) {
    switch (W.stage) {
      case 'intro':
        W.stageTimer -= dt;
        if (W.stageTimer <= 0) W.stage = 'fight';
        break;
      case 'warning':
        W.stageTimer -= dt;
        if (W.stageTimer <= 0) {
          W.boss = makeBoss(W, W.bossCount);
          W.stage = 'boss';
          emit({ type: 'bossSpawn', name: W.boss.name, color: W.boss.def.color });
        }
        break;
      case 'fight':
        if (W.queue.length) {
          W.queueTimer -= edt;
          if (W.queueTimer <= 0) {
            spawnGroup(W, W.queue.shift());
            W.queueTimer = W.queue[0]?.delay ?? 0;
          }
        } else if (!W.enemies.length) clearWave();
        break;
      case 'boss':
        // Depois da queda do chefe, a explosão e o aviso ficam na tela antes do bônus da onda.
        if (!W.boss && !W.enemies.length && (W.stageTimer -= dt) <= 0) clearWave();
        break;
      case 'rest':
        W.stageTimer -= dt;
        if (W.stageTimer <= 0) beginWave(W.wave + 1);
        break;
    }
  }

  // ---------------------------------------------------------- progressão
  function gainXp(amount) {
    W.xp += amount;
    while (W.xp >= W.xpNext) {
      W.xp -= W.xpNext;
      W.level++;
      W.xpNext = xpForLevel(W.level);
      W.pendingLevels++;
      emit({ type: 'levelUp', level: W.level });
    }
  }

  function canUpgrade(id) {
    const def = UPGRADES[id];
    if (!def || W.up[id] >= def.max) return false;
    if (def.requires && !W.up[def.requires]) return false;
    return !(def.needsDamage && p.hp >= p.maxHp);
  }

  function offerUpgrades(count = 3) {
    const pool = Object.keys(UPGRADES).filter(canUpgrade);
    const out = [];
    // Com pouca vida, o reparo sempre aparece entre as opções.
    if (p.hp <= 2 && pool.includes('repair')) out.push(pool.splice(pool.indexOf('repair'), 1)[0]);
    while (out.length < count && pool.length) out.push(pool.splice(Math.floor(W.rng.next() * pool.length), 1)[0]);
    return out;
  }

  function applyUpgrade(id) {
    if (!canUpgrade(id)) return false;
    W.up[id]++;
    if (id === 'repair') p.hp = Math.min(p.maxHp, p.hp + 2);
    if (id === 'vitality') { p.maxHp++; p.hp = Math.min(p.maxHp, p.hp + 1); }
    if (id === 'aegis') p.aegis = Math.min(p.aegis || 4, 4);
    if (W.pendingLevels > 0) W.pendingLevels--;
    // Carência depois da pausa: nada acerta a nave no instante em que a ação volta.
    p.invuln = Math.max(p.invuln, PLAYER.grace);
    emit({ type: 'upgrade', id });
    return true;
  }

  // ------------------------------------------------------------ jogador
  function hurtPlayer(amount) {
    if (W.over || p.invuln > 0) return false;
    if (W.effects.shield > 0) {
      p.invuln = 0.35;
      emit({ type: 'shieldBlock', x: p.x, y: p.y });
      return true;
    }
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = PLAYER.invuln * diff.invuln;
    p.hitFlash = 0.35;
    W.combo = 0;
    W.waveDamaged = true;
    emit({ type: 'playerHit', x: p.x, y: p.y, hp: p.hp, damage: amount });
    if (p.hp <= 0) {
      W.over = true;
      p.alive = false;
      emit({ type: 'gameOver', x: p.x, y: p.y });
    }
    return true;
  }

  const fireInterval = () =>
    PLAYER.fireInterval / ((1 + W.up.firerate * 0.15) * (W.effects.rapid > 0 ? POWER.rapid : 1));
  const damageFactor = () => (1 + W.up.damage * 0.2) * (W.effects.power > 0 ? POWER.power : 1);

  function fire() {
    const double = W.up.twin > 0 || W.effects.double > 0;
    const triple = W.up.spread > 0 || W.effects.triple > 0;
    const r = PLAYER.bulletRadius * (1 + W.up.bigshot * 0.35);
    const pierce = W.up.pierce + (W.effects.pierce > 0 ? 3 : 0);
    const guns = double ? [[-7, 0], [7, 0]] : [[0, 0]];
    if (triple) guns.push([-5, -0.17], [5, 0.17]);
    for (const [ox, angle] of guns) {
      if (W.bullets.length >= PLAYER.maxBullets) break;
      const crit = W.up.crit > 0 && W.rng.chance(W.up.crit * 0.1);
      W.bullets.push({
        x: p.x + ox, y: p.y - 16, vx: Math.sin(angle) * PLAYER.bulletSpeed, vy: -Math.cos(angle) * PLAYER.bulletSpeed,
        r: crit ? r * 1.35 : r, damage: damageFactor() * (crit ? PLAYER.critMult : 1), pierce, crit, hits: null
      });
    }
    emit({ type: 'shoot', count: guns.length });
  }

  function updatePlayer(dt, c) {
    const speed = PLAYER.speed * (1 + W.up.speed * 0.15);
    const oldX = p.x;
    p.x = clamp(p.x + (c.dx || 0) + (c.vx || 0) * speed * dt, 14, W.w - 14);
    p.y = clamp(p.y + (c.dy || 0) + (c.vy || 0) * speed * dt, W.h * PLAYER.topLimit, W.h - 26);
    p.tilt += (clamp((p.x - oldX) / dt / 520, -1, 1) - p.tilt) * Math.min(1, dt * 10);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (W.up.aegis) {
      p.aegis -= dt;
      if (p.aegis <= 0) {
        p.aegis = W.up.aegis >= 2 ? 12 : 18;
        W.effects.shield = Math.max(W.effects.shield, 3);
        W.effectMax.shield = Math.max(W.effectMax.shield, W.effects.shield);
        emit({ type: 'aegis', x: p.x, y: p.y });
      }
    }
    const targets = (W.boss && W.boss.state === 'fight') || W.enemies.some(e => e.y > 0 && e.y < W.h);
    p.fire -= dt;
    if ((c.autofire && targets) || c.firing) {
      if (p.fire <= 0) { fire(); p.fire = fireInterval(); }
    } else if (p.fire < 0) p.fire = 0;
  }

  // ------------------------------------------------------------- inimigos
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    W.kills++;
    W.combo++;
    W.maxCombo = Math.max(W.maxCombo, W.combo);
    const points = Math.round(e.score * comboMultiplier(W.combo) * diff.score);
    W.score += points;
    gainXp(e.xp);
    W.dropPity++;
    if (e.drop && (W.rng.chance(e.drop * diff.drops * (p.hp <= 2 ? 1.3 : 1)) || W.dropPity >= 28)) {
      spawnDrop(e.x, e.y);
    }
    if (e.type === 'splitter') splitEnemy(W, e);
    emit({ type: 'kill', x: e.x, y: e.y, color: e.color, r: e.r, kind: e.type, points, combo: W.combo });
  }

  function damageEnemy(e, amount, crit = false) {
    if (e.dead) return;
    e.hp -= amount;
    e.flash = 0.07;
    if (e.hp <= 0) killEnemy(e);
    else emit({ type: 'hit', x: e.x, y: e.y, color: e.color, crit });
  }

  function damageBoss(amount, crit = false) {
    const b = W.boss;
    if (!b || b.state !== 'fight') return;
    b.hp -= amount;
    b.flash = 0.06;
    if (b.hp > 0) { emit({ type: 'bossHit', x: b.x, y: b.y, crit }); return; }
    W.bosses++;
    W.bossCount++;
    const points = Math.round(SCORE.boss * (b.index + 1) * diff.score * comboMultiplier(W.combo));
    W.score += points;
    W.shots.length = 0;
    for (const e of W.enemies) killEnemy(e);
    spawnDrop(b.x - 26, b.y);
    spawnDrop(b.x + 26, b.y, p.hp < p.maxHp ? 'heal' : null);
    gainXp(W.xpNext - W.xp);
    W.slowmo = 0.9;
    emit({ type: 'bossDown', x: b.x, y: b.y, r: b.r, color: b.def.color, name: b.name, points });
    W.boss = null;
    W.stageTimer = 2.4;
  }

  // ----------------------------------------------------------- power-ups
  function pickPowerup() {
    const list = Object.entries(POWERUPS).map(([k, d]) => ({
      k, w: d.weight * (k === 'heal' ? (p.hp >= p.maxHp ? 0.15 : p.hp <= 2 ? 2.5 : 1.2) : 1)
    }));
    return weightedPick(W.rng, list).k;
  }

  function spawnDrop(x, y, kind = null) {
    if (W.drops.length >= 6) return;
    W.dropPity = 0;
    W.drops.push({ x: clamp(x, 20, W.w - 20), y, kind: kind || pickPowerup(), t: 0 });
  }

  function collect(kind, x = p.x, y = p.y) {
    W.powerups++;
    W.score += Math.round(SCORE.pickup * diff.score);
    const def = POWERUPS[kind];
    if (kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 1);
    else if (kind === 'bomb') {
      const damage = POWER.bombDamage * damageFactor();
      for (const e of W.enemies) if (e.y > -e.r) damageEnemy(e, damage);
      if (W.boss) damageBoss(W.boss.maxHp * POWER.bombBossDamage);
      W.shots.length = 0;
    } else {
      const time = def.time * (1 + W.up.lasting * 0.4);
      W.effects[kind] = Math.max(W.effects[kind], time);
      W.effectMax[kind] = W.effects[kind];
    }
    emit({ type: kind === 'bomb' ? 'bomb' : 'pickup', kind, x, y, color: def.color });
  }

  // ------------------------------------------------------------- passo
  function update(dt, controls) {
    const c = controls || {};
    if (W.slowmo > 0) { W.slowmo -= dt; dt *= 0.35; }
    const edt = W.effects.slow > 0 ? dt * POWER.slow : dt;

    if (!W.over) {
      W.time += dt;
      W.scoreClock += dt;
      if (W.scoreClock >= 1) { W.scoreClock -= 1; W.score += Math.round(SCORE.perSecond * diff.score); }
      for (const k of TIMED_POWERUPS) if (W.effects[k] > 0) W.effects[k] = Math.max(0, W.effects[k] - dt);
      updatePlayer(dt, c);
      updateWaves(dt, edt);
    }

    // Tiros do jogador contra chefe e inimigos.
    const boss = W.boss;
    for (let i = W.bullets.length - 1; i >= 0; i--) {
      const b = W.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let remove = b.y < -20 || b.x < -20 || b.x > W.w + 20;
      if (!remove && boss && boss.state === 'fight' && hit(b.x, b.y, boss.x, boss.y, boss.r * 0.85 + b.r)) {
        damageBoss(b.damage, b.crit);
        remove = true;
      }
      if (!remove) {
        for (const e of W.enemies) {
          if (e.dead || e.y < -e.r || (e.small && e.t < 0.12) || (b.hits && b.hits.includes(e))) continue;
          if (!hit(b.x, b.y, e.x, e.y, e.r + b.r)) continue;
          damageEnemy(e, b.damage, b.crit);
          if (b.pierce > 0) { b.pierce--; (b.hits ||= []).push(e); } else remove = true;
          break;
        }
      }
      if (remove) { W.bullets[i] = W.bullets[W.bullets.length - 1]; W.bullets.pop(); }
    }

    // Inimigos: movimento, colisão com a nave e limpeza.
    for (let i = W.enemies.length - 1; i >= 0; i--) {
      const e = W.enemies[i];
      const keep = !e.dead && updateEnemy(W, e, edt);
      if (keep && p.alive && hit(e.x, e.y, p.x, p.y, e.r * 0.8 + PLAYER.radius) && hurtPlayer(e.contact)) {
        damageEnemy(e, e.type === 'tank' ? 4 : 99);
      }
      if (!keep || e.dead) { W.enemies[i] = W.enemies[W.enemies.length - 1]; W.enemies.pop(); }
    }

    if (W.boss) {
      const before = W.events.length;
      updateBoss(W, W.boss, edt);
      // Cada virada de fase solta um power-up: a luta longa vira troca de golpes
      // em vez de desgaste, e quem tira vida do chefe ganha fôlego de volta.
      for (let i = before; i < W.events.length; i++) {
        if (W.events[i].type !== 'bossPhase') continue;
        spawnDrop(W.boss.x, W.boss.y + W.boss.r * 0.8, p.hp < p.maxHp ? 'heal' : null);
      }
      const b = W.boss;
      if (p.alive && b.state === 'fight' && hit(b.x, b.y, p.x, p.y, b.r * 0.8 + PLAYER.radius)) hurtPlayer(BOSS.contact);
    }

    // Tiros inimigos.
    for (let i = W.shots.length - 1; i >= 0; i--) {
      const s = W.shots[i];
      s.x += s.vx * edt;
      s.y += s.vy * edt;
      s.t += edt;
      let remove = s.y > W.h + 20 || s.y < -30 || s.x < -20 || s.x > W.w + 20;
      if (!remove && p.alive && hit(s.x, s.y, p.x, p.y, s.r * 0.8 + PLAYER.radius) && hurtPlayer(1)) remove = true;
      if (remove) { W.shots[i] = W.shots[W.shots.length - 1]; W.shots.pop(); }
    }

    // Power-ups caindo, com ímã perto da nave.
    const magnet = W.up.magnet ? PLAYER.magnetUpgrade : PLAYER.magnetRadius;
    for (let i = W.drops.length - 1; i >= 0; i--) {
      const d = W.drops[i];
      d.t += dt;
      const dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy) || 1;
      if (p.alive && dist < magnet) { d.x += dx / dist * 280 * dt; d.y += dy / dist * 280 * dt; }
      else d.y += POWER.fall * dt;
      let remove = d.y > W.h + 30;
      if (p.alive && dist < PLAYER.pickupRadius + 12) { collect(d.kind, d.x, d.y); remove = true; }
      if (remove) { W.drops[i] = W.drops[W.drops.length - 1]; W.drops.pop(); }
    }
  }

  function resize(nw, nh) {
    if (nw === W.w && nh === W.h) return;
    const sx = nw / W.w;
    for (const list of [W.enemies, W.bullets, W.shots, W.drops]) {
      for (const o of list) { o.x *= sx; if (o.baseX !== undefined) o.baseX *= sx; }
    }
    if (W.boss) W.boss.x *= sx;
    p.x = clamp(p.x * sx, 14, nw - 14);
    W.w = nw;
    W.h = nh;
    p.y = clamp(p.y, nh * PLAYER.topLimit, nh - 26);
  }

  function summary() {
    const b = W.boss;
    return {
      wave: W.wave, stage: W.stage, score: W.score, kills: W.kills, combo: W.combo, maxCombo: W.maxCombo,
      multiplier: comboMultiplier(W.combo), hp: p.hp, maxHp: p.maxHp, level: W.level, xp: W.xp, xpNext: W.xpNext,
      boss: b ? { name: b.name, hp: Math.max(0, Math.ceil(b.hp)), maxHp: b.maxHp, phase: b.phase + 1 } : null,
      effects: Object.fromEntries(TIMED_POWERUPS.filter(k => W.effects[k] > 0).map(k => [k, +W.effects[k].toFixed(1)])),
      upgrades: Object.fromEntries(Object.entries(W.up).filter(([, v]) => v > 0)),
      enemies: W.enemies.length, over: W.over
    };
  }

  Object.assign(W, {
    update, resize, summary, beginWave, offerUpgrades, applyUpgrade, canUpgrade,
    hurtPlayer, damageBoss, collect, fire
  });
  beginWave(1);
  return W;
}
