import { BLOOD } from './config.js';

// Sangue: gotas com gravidade e arrasto, poças que ficam no chão até o fim da
// fase e um filete escorrendo do ferimento. É desenhado, não simulado a sério —
// a física do jogo é só a da flecha.
//
// O nível de efeito é configurável ('forte', 'leve', 'desligado') porque nem
// todo mundo quer ver isso; desligado, o impacto continua legível pelo tranco
// da tela e pela marca da flecha.
export function createBlood(levelName = 'forte') {
  let level = BLOOD.levels[levelName] || BLOOD.levels.forte;
  const drops = [];
  const decals = [];
  let wound = null;          // { x, y, time } enquanto o alvo está ferido
  let dripClock = 0;

  const rand = (min, max) => min + Math.random() * (max - min);
  const color = () => BLOOD.colors[(Math.random() * BLOOD.colors.length) | 0];

  function drop(x, y, vx, vy, r) {
    if (drops.length >= BLOOD.maxDrops) drops.shift();
    const life = rand(BLOOD.life[0], BLOOD.life[1]);
    drops.push({ x, y, px: x, py: y, vx, vy, r, life, maxLife: life, color: color() });
  }

  function decal(x, y, r, alpha = 0.85, tint) {
    if (decals.length >= BLOOD.maxDecals) decals.shift();
    decals.push({
      x, y, rx: r * rand(1.1, 2.1), ry: r * rand(0.35, 0.7),
      rot: rand(-0.4, 0.4), life: BLOOD.decalLife, alpha, color: tint || color()
    });
  }

  return {
    get level() { return level; },
    get count() { return drops.length + decals.length; },
    setLevel(name) { level = BLOOD.levels[name] || BLOOD.levels.forte; },
    clear() { drops.length = 0; decals.length = 0; wound = null; },

    // Jato no impacto: um leque no sentido da flecha e um respingo de volta.
    // `opts.colors` e `opts.count` permitem reaproveitar o mesmo jato para o
    // estouro da maçã, que não é sangue e não depende do nível de efeito.
    splash(x, y, dirX, dirY, strength = 1, opts = {}) {
      const palette = opts.colors || BLOOD.colors;
      const pick = () => palette[(Math.random() * palette.length) | 0];
      const total = opts.count ?? Math.round(level.drops * strength);
      for (let i = 0; i < total; i++) {
        const back = i % 5 === 0;                 // parte do sangue volta contra a flecha
        const spread = back ? 2.4 : 1.05;
        const angle = Math.atan2(dirY, dirX) + rand(-spread, spread) + (back ? Math.PI : 0);
        const speed = rand(BLOOD.speed[0], BLOOD.speed[1]) * (back ? 0.55 : 1) * (0.6 + strength * 0.5);
        const d = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - rand(20, 130), r: rand(1, 2.8) };
        drop(d.x, d.y, d.vx, d.vy, d.r);
        drops[drops.length - 1].color = pick();
      }
      if (total) decal(x, y, rand(2, 4), 0.5, opts.colors ? pick() : undefined);
    },

    // Ferimento aberto: pinga enquanto durar e mancha o chão embaixo.
    setWound(x, y) { if (level.drip > 0) wound = wound ? { ...wound, x, y } : { x, y, time: 0 }; },
    healWound() { wound = null; },

    update(dt, groundY) {
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.px = d.x; d.py = d.y;
        d.vy += BLOOD.gravity * dt;
        const damp = Math.max(0, 1 - BLOOD.drag * dt);
        d.vx *= damp; d.vy *= damp;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
        if (d.y >= groundY) {
          decal(d.x, groundY, d.r, 0.85, d.color);
          drops.splice(i, 1);
        } else if (d.life <= 0 || d.x < -40 || d.x > 9999) {
          drops.splice(i, 1);
        }
      }
      if (wound) {
        wound.time += dt;
        dripClock += dt;
        const every = 0.09 / Math.max(0.2, level.drip);
        while (dripClock > every) {
          dripClock -= every;
          drop(wound.x + rand(-1.5, 1.5), wound.y, rand(-14, 14), rand(10, 60), rand(0.9, 2));
        }
      }
      for (let i = decals.length - 1; i >= 0; i--) {
        const s = decals[i];
        s.life -= dt;
        if (s.life <= 0) decals.splice(i, 1);
      }
    },

    // Separado em dois porque a ordem importa: poça fica sob as figuras,
    // gota em voo fica na frente.
    drawDecals(ctx) {
      ctx.save();
      for (const s of decals) {
        ctx.globalAlpha = s.alpha * Math.min(1, s.life / 3);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.rx, s.ry, s.rot, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    drawDrops(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const d of drops) {
        const fade = Math.min(1, d.life / (d.maxLife * 0.5));
        ctx.globalAlpha = 0.35 + fade * 0.65;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.r * 1.4;
        ctx.beginPath();
        ctx.moveTo(d.px, d.py);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  };
}
