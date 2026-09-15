import { createSpriteCache } from '../../core/sprites.js';
import { POWERUPS, ICONS, FX, TIMED_POWERUPS } from './config.js';

// Toda a parte visual em Canvas 2D. O brilho (`shadowBlur`) é pago uma vez por
// sprite; a cada quadro só se copiam bitmaps. Partículas, anéis e textos
// flutuantes vivem aqui, alimentados pelos eventos da simulação.

const TAU = Math.PI * 2;
const SHIP = '#5ff4ff';
const fmt = n => Math.round(n).toLocaleString('pt-BR');

const SHAPES = {
  drone(c, r) { poly(c, [[0, r], [r * 0.95, -r * 0.55], [r * 0.35, -r * 0.2], [0, -r * 0.75], [-r * 0.35, -r * 0.2], [-r * 0.95, -r * 0.55]]); },
  dart(c, r) { poly(c, [[0, r * 1.1], [r * 0.6, -r], [0, -r * 0.4], [-r * 0.6, -r]]); },
  weaver(c, r) { poly(c, [[0, r], [r * 0.45, 0], [r * 1.05, -r * 0.35], [r * 0.45, -r * 0.3], [0, -r], [-r * 0.45, -r * 0.3], [-r * 1.05, -r * 0.35], [-r * 0.45, 0]]); },
  gunner(c, r) {
    const k = r * 0.42;
    poly(c, [[-k, -r], [k, -r], [r, -k], [r, k * 0.6], [k, r * 0.7], [k * 0.45, r * 1.1], [-k * 0.45, r * 1.1], [-k, r * 0.7], [-r, k * 0.6], [-r, -k]]);
  },
  tank(c, r) { ngon(c, 6, r, Math.PI / 6); ngon(c, 6, r * 0.55, Math.PI / 6); },
  splitter(c, r) {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * TAU / 3, x = Math.cos(a) * r * 0.45, y = Math.sin(a) * r * 0.45;
      c.moveTo(x + r * 0.5, y); c.arc(x, y, r * 0.5, 0, TAU);
    }
  },
  hunter(c, r) { poly(c, [[0, r * 1.15], [r * 0.8, -r * 0.5], [r * 0.3, -r * 0.25], [r * 0.45, -r], [0, -r * 0.55], [-r * 0.45, -r], [-r * 0.3, -r * 0.25], [-r * 0.8, -r * 0.5]]); },
  spinner(c, r) {
    c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU);
    c.moveTo(r * 0.45, 0); c.arc(0, 0, r * 0.45, 0, TAU);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      c.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      c.lineTo(Math.cos(a + 0.5) * r * 1.3, Math.sin(a + 0.5) * r * 1.3);
    }
  }
};
const BOSS_SHAPES = {
  prisma(c, r) { ngon(c, 6, r, 0); ngon(c, 6, r * 0.6, Math.PI / 6); },
  vespa(c, r) { poly(c, [[0, r * 0.95], [r * 0.5, r * 0.3], [r * 1.15, -r * 0.15], [r * 0.75, -r * 0.75], [r * 0.2, -r * 0.45], [0, -r * 0.8], [-r * 0.2, -r * 0.45], [-r * 0.75, -r * 0.75], [-r * 1.15, -r * 0.15], [-r * 0.5, r * 0.3]]); },
  eclipse(c, r) { c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU); c.moveTo(r * 0.62, 0); c.arc(0, 0, r * 0.62, 0, TAU); }
};
function poly(c, points) { points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
function ngon(c, n, r, rot) { for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }

export function createRenderer(viewport, debug) {
  const view = viewport.view;
  const ctx = view.ctx;
  const sprites = createSpriteCache();
  const paths = {};
  const icon = name => paths[name] || (paths[name] = new Path2D(ICONS[name] || ICONS.star));
  const particles = [], rings = [], floats = [], flashes = [], delayed = [];
  const stars = Array.from({ length: 120 }, (_, i) => ({ x: Math.random(), y: Math.random(), layer: i % 3, tw: Math.random() * TAU }));
  let rs = 1, low = false, shakeOn = true, clock = 0, grid = 0;
  let shake = 0, flash = 0, flashColor = '#ffffff', hurt = 0, strip = null;
  let vignette = null, vignetteKey = '';

  // ------------------------------------------------------------- sprites
  function sprite(key, size, draw) {
    return sprites.get(`${key}|${rs}|${low ? 1 : 0}`, size * rs, size * rs, c => {
      c.scale(rs, rs);
      c.translate(size / 2, size / 2);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      draw(c);
    });
  }
  const glow = (c, color, blur) => { if (!low) { c.shadowColor = color; c.shadowBlur = blur; } };

  function blit(img, x, y, size, angle = 0) {
    if (!angle) { ctx.drawImage(img, x - size / 2, y - size / 2, size, size); return; }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  const enemySprite = (type, color, r, lit) => sprite(`e|${type}|${color}|${r}|${lit ? 1 : 0}`, Math.ceil(r * 2.8 + 20), c => {
    glow(c, color, 12);
    c.strokeStyle = lit ? '#ffffff' : color;
    c.fillStyle = lit ? '#ffffffd0' : color + '30';
    c.lineWidth = 2;
    c.beginPath();
    SHAPES[type](c, r);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, type === 'tank' || type === 'spinner' ? 0 : -r * 0.1, Math.max(1.8, r * 0.16), 0, TAU);
    c.fill();
  });

  const bossSprite = (b, lit) => sprite(`b|${b.def.id}|${b.r}|${lit ? 1 : 0}`, Math.ceil(b.r * 3.2), c => {
    glow(c, b.def.color, 24);
    c.strokeStyle = lit ? '#ffffff' : b.def.color;
    c.fillStyle = lit ? '#ffffffb0' : b.def.color + '28';
    c.lineWidth = 3;
    c.beginPath();
    BOSS_SHAPES[b.def.id](c, b.r);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, b.r * 0.17, 0, TAU);
    c.fill();
  });

  const shipSprite = lit => sprite(`p|${lit ? 1 : 0}`, 60, c => {
    glow(c, SHIP, 14);
    c.fillStyle = lit ? '#ffffff' : '#0b2a33';
    c.strokeStyle = lit ? '#ffffff' : SHIP;
    c.lineWidth = 2;
    c.beginPath();
    poly(c, [[0, -18], [5, -6], [15, 6], [15, 11], [5, 8], [3, 12], [-3, 12], [-5, 8], [-15, 11], [-15, 6], [-5, -6]]);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = '#e9feff';
    c.beginPath();
    poly(c, [[0, -12], [2.6, -3], [0, 1], [-2.6, -3]]);
    c.fill();
    c.strokeStyle = '#ff4fd8';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-12, 8); c.lineTo(-6, 5); c.moveTo(12, 8); c.lineTo(6, 5);
    c.stroke();
  });

  const orb = (color, r) => sprite(`o|${color}|${r}`, Math.ceil(r * 5), c => {
    if (!low) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.5);
      g.addColorStop(0, color + 'aa');
      g.addColorStop(1, color + '00');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, r * 2.5, 0, TAU); c.fill();
    }
    c.fillStyle = color;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill();
  });

  const dropSprite = kind => sprite(`d|${kind}`, 48, c => {
    const color = POWERUPS[kind].color;
    glow(c, color, 16);
    c.fillStyle = '#0a0714';
    c.strokeStyle = color;
    c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); c.stroke();
    c.shadowBlur = 0;
    c.scale(0.8, 0.8);
    c.translate(-12, -12);
    c.lineWidth = 2.8;
    c.stroke(icon(kind));
  });

  const glowSprite = color => sprite(`g|${color}`, 64, c => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, color + 'ee');
    g.addColorStop(0.35, color + '55');
    g.addColorStop(1, color + '00');
    c.fillStyle = g;
    c.fillRect(-32, -32, 64, 64);
  });

  // ------------------------------------------------------------- efeitos
  function burst(x, y, color, count, speed, life, size) {
    const max = low ? FX.particlesLow : FX.particlesFull;
    for (let i = 0; i < count && particles.length < max; i++) {
      const a = Math.random() * TAU, v = speed * (0.25 + Math.random() * 0.75);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5),
                       size: size * (0.6 + Math.random() * 0.8), color });
    }
  }
  const ring = (x, y, color, r0, r1, life, width = 2) => rings.push({ x, y, color, r0, r1, life, max: life, width });
  function float(x, y, text, color, life = 0.8) {
    if (floats.length >= FX.floats) floats.shift();
    floats.push({ x, y, text, color, life, max: life });
  }
  const addShake = v => { if (shakeOn) shake = Math.max(shake, v); };
  const flashScreen = (color, amount) => { flashColor = color; flash = Math.max(flash, low ? amount * 0.4 : amount); };

  function explode(x, y, color, r) {
    burst(x, y, color, low ? 6 : Math.min(28, Math.round(8 + r)), 60 + r * 7, 0.7, 2.4);
    if (!low) burst(x, y, '#ffffff', 5, 90, 0.35, 1.6);
    ring(x, y, color, r * 0.4, r * 2.4, 0.4);
    if (!low) flashes.push({ x, y, size: r * 5, color, life: 0.22, max: 0.22 });
    if (r >= 20) addShake(3);
  }

  // Aviso curto numa faixa fina no topo da arena: nunca no meio do campo.
  function setStrip(text, color, duration, alarm = false) { strip = { text, color, duration, t: 0, alarm }; }

  function event(e, W) {
    switch (e.type) {
      case 'hit': burst(e.x, e.y + 4, e.crit ? '#ffe45e' : e.color, low ? 1 : 3, 90, 0.25, 2); break;
      case 'kill':
        explode(e.x, e.y, e.color, e.r);
        // Texto só no que merece atenção: marco de combo ou inimigo grande.
        if (e.combo > 0 && e.combo % 10 === 0) float(e.x, e.y - 12, `COMBO x${e.combo}`, '#ffe45e', 1);
        else if (e.r >= 20) float(e.x, e.y - 12, `+${fmt(e.points)}`, '#ffffff');
        break;
      case 'playerHit': explode(e.x, e.y, '#ff4d6d', 14); addShake(8); hurt = 0.6; break;
      case 'shieldBlock': ring(e.x, e.y, '#5fd5ff', 12, 36, 0.35, 3); break;
      case 'aegis': ring(e.x, e.y, '#5fd5ff', 8, 44, 0.5); break;
      case 'pickup': ring(e.x, e.y, e.color, 10, 46, 0.45, 3); break;
      case 'bomb':
        flashScreen('#ffffff', 0.75);
        ring(e.x, e.y, '#ffffff', 10, Math.max(view.w, view.h), 0.8, 5);
        addShake(10);
        break;
      case 'levelUp': ring(W.player.x, W.player.y, '#b6ff5f', 12, 64, 0.6, 3); break;
      case 'bossWarning': setStrip('Chefe se aproximando', '#ff4d6d', 2, true); break;
      case 'bossSpawn': addShake(5); break;
      case 'bossPhase':
        // A troca de fase aparece no próprio chefe: brilho na cor dele e onda de choque.
        addShake(5);
        ring(e.x, e.y, '#ffffff', 20, 130, 0.6, 4);
        if (!low) flashes.push({ x: e.x, y: e.y, size: 240, color: W.boss?.def.color || '#ffffff', life: 0.6, max: 0.6 });
        break;
      case 'bossSlam': addShake(6); ring(e.x, e.y, '#ffffff', 10, 96, 0.5, 4); break;
      case 'bossDown':
        for (let i = 0; i < 9; i++) {
          delayed.push({ t: i * 0.13, fn: () => explode(e.x + (Math.random() - 0.5) * e.r * 2, e.y + (Math.random() - 0.5) * e.r * 2, i % 2 ? '#ffffff' : e.color, 16 + Math.random() * 12) });
        }
        delayed.push({ t: 1.2, fn: () => { explode(e.x, e.y, e.color, 44); flashScreen('#ffffff', 0.8); addShake(14); ring(e.x, e.y, e.color, 20, 260, 0.9, 6); } });
        setStrip(`Chefe derrotado · +${fmt(e.points)}`, e.color, 1.8);
        break;
      case 'gameOver':
        explode(e.x, e.y, SHIP, 26);
        explode(e.x, e.y, '#ff4fd8', 20);
        addShake(14);
        flashScreen('#ff4d6d', 0.45);
        break;
    }
  }

  function updateFx(dt) {
    for (let i = delayed.length - 1; i >= 0; i--) {
      delayed[i].t -= dt;
      if (delayed[i].t <= 0) { const fn = delayed[i].fn; delayed.splice(i, 1); fn(); }
    }
    const drag = Math.pow(0.05, dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag;
    }
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
    for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 28);
    flash = Math.max(0, flash - dt * 2.4);
    hurt = Math.max(0, hurt - dt * 1.6);
  }

  // ------------------------------------------------------------- fundo
  function background(dt, boost) {
    const w = view.w, h = view.h;
    ctx.fillStyle = '#04020a';
    ctx.fillRect(-view.ox / view.scale, -view.oy / view.scale, view.cssW / view.scale, view.cssH / view.scale);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07041a');
    sky.addColorStop(0.62, '#12072a');
    sky.addColorStop(1, '#1a0833');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    if (!low) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glowSprite('#7a2cff'), w * 0.1 + Math.sin(clock * 0.05) * 30 - 150, h * 0.22 - 150, 300, 300);
      ctx.drawImage(glowSprite('#ff2fb4'), w * 0.85 - 120, h * 0.5 + Math.cos(clock * 0.04) * 40 - 120, 240, 240);
      ctx.globalAlpha = 1;
    }

    // Grade em perspectiva rolando no chão.
    const horizon = h * 0.64;
    grid = (grid + dt * 0.45 * boost) % 1;
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 1;
    const lines = low ? 5 : 9;
    for (let i = 0; i < lines; i++) {
      const k = (i + grid) / lines, y = horizon + (h - horizon) * k * k;
      ctx.globalAlpha = 0.03 + k * 0.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    const spokes = low ? 4 : 7;
    for (let i = -spokes; i <= spokes; i++) {
      ctx.moveTo(w / 2 + i * w * 0.03, horizon);
      ctx.lineTo(w / 2 + i * w * 0.22, h);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Estrelas em três camadas de paralaxe.
    ctx.fillStyle = '#dff6ff';
    const speed = [10, 26, 62], size = [0.9, 1.3, 1.9], alpha = [0.35, 0.55, 0.9];
    const count = low ? 45 : stars.length;
    for (let i = 0; i < count; i++) {
      const s = stars[i];
      s.y += speed[s.layer] * boost * dt / h;
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
      ctx.globalAlpha = alpha[s.layer] * (low ? 1 : 0.7 + 0.3 * Math.sin(clock * 3 + s.tw));
      const z = size[s.layer];
      ctx.fillRect(s.x * w, s.y * h, z, boost > 1.5 ? z * 5 : z);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- mundo
  function drawShip(x, y, tilt, lit, blink) {
    const flame = 6 + Math.random() * 6;
    ctx.fillStyle = '#ff4fd8';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(x - 4.5, y + 10); ctx.lineTo(x + 4.5, y + 10); ctx.lineTo(x, y + 12 + flame); ctx.fill();
    ctx.fillStyle = '#ffe45e';
    ctx.beginPath(); ctx.moveTo(x - 2, y + 10); ctx.lineTo(x + 2, y + 10); ctx.lineTo(x, y + 10 + flame * 0.6); ctx.fill();
    ctx.globalAlpha = 1;
    if (blink) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 - Math.abs(tilt) * 0.28, 1);
    ctx.drawImage(shipSprite(lit), -30, -30, 60, 60);
    ctx.restore();
  }

  function drawBoss(W, b) {
    const r = b.r, w = view.w, h = view.h;
    const p = b.pattern;
    if (p && p.kind === 'curtain') {
      const hx = b.hole * w, half = p.hole / 2;
      ctx.fillStyle = '#b6ff5f';
      ctx.globalAlpha = b.telegraph > 0 ? 0.1 + 0.07 * Math.sin(clock * 20) : 0.06;
      ctx.fillRect(hx - half, b.y + r, half * 2, h - b.y - r);
      ctx.globalAlpha = 1;
    }
    if (b.charge && b.charge.stage === 'aim') {
      ctx.strokeStyle = '#ff4d6d';
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(clock * 24);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y + r); ctx.lineTo(b.x, h * 0.64 + r); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    blit(bossSprite(b, b.flash > 0), b.x, b.y, Math.ceil(r * 3.2));
    ctx.strokeStyle = b.def.color;
    ctx.lineWidth = 2;
    if (b.def.id === 'prisma') {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = clock * 1.4 + i * TAU / 3;
        i ? ctx.lineTo(b.x + Math.cos(a) * r * 0.42, b.y + Math.sin(a) * r * 0.42) : ctx.moveTo(b.x + Math.cos(a) * r * 0.42, b.y + Math.sin(a) * r * 0.42);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (b.def.id === 'eclipse') {
      const node = orb(b.def.color, 5);
      for (let i = 0; i < 6; i++) {
        const a = clock * 1.2 + i * TAU / 6;
        blit(node, b.x + Math.cos(a) * r * 1.3, b.y + Math.sin(a) * r * 1.3, 25);
      }
    }
    if (p && b.telegraph > 0) {
      const k = 1 - b.telegraph / p.telegraph;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.7 * (1 - k) + 0.15;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * (1.7 - 0.55 * k), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawWorld(W) {
    for (const d of W.drops) {
      blit(dropSprite(d.kind), d.x, d.y + Math.sin(d.t * 5) * 2, 48);
      if (!low) {
        ctx.strokeStyle = POWERUPS[d.kind].color;
        ctx.globalAlpha = 0.5 * (1 - (d.t * 1.2) % 1);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, 16 + ((d.t * 1.2) % 1) * 12, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const e of W.enemies) {
      const size = Math.ceil(e.r * 2.8 + 20);
      if (e.type === 'hunter' && e.state === 'lock') {
        const k = 1 - e.timer / e.def.lock;
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = 0.2 + 0.55 * k * (0.5 + 0.5 * Math.sin(clock * 30));
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.angle) * 560, e.y + Math.sin(e.angle) * 560); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      const angle = e.type === 'dart' || (e.type === 'hunter' && e.state !== 'enter') ? e.angle - Math.PI / 2
        : e.type === 'spinner' ? e.angle : 0;
      blit(enemySprite(e.type, e.color, e.r, e.flash > 0), e.x, e.y, size, angle);
      if (e.charge > 0) {
        const k = 1 - e.charge / (e.type === 'gunner' ? 0.34 : 0.5);
        ctx.globalAlpha = 0.4 + 0.6 * k;
        blit(glowSprite(e.color), e.x, e.y + (e.type === 'gunner' ? e.r * 0.8 : 0), 14 + k * 30);
        ctx.globalAlpha = 1;
      }
      if (e.maxHp >= 8 && e.hp < e.maxHp) {
        ctx.fillStyle = '#ffffff22';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * Math.max(0, e.hp / e.maxHp), 3);
      }
      debug.circle(e.x, e.y, e.r, '#ff4d4d');
    }

    if (W.boss) { drawBoss(W, W.boss); debug.circle(W.boss.x, W.boss.y, W.boss.r * 0.85, '#ff4d4d'); }

    for (const s of W.shots) {
      const r = Math.round(s.r * 2) / 2;
      blit(orb(s.color, r), s.x, s.y, Math.ceil(r * 5));
    }

    if (W.bullets.length) {
      if (!low) {
        ctx.globalAlpha = 0.45;
        ctx.lineCap = 'round';
        for (const crit of [false, true]) {
          ctx.strokeStyle = crit ? '#ffe45e' : SHIP;
          ctx.lineWidth = crit ? 4 : 3;
          ctx.beginPath();
          for (const b of W.bullets) {
            if (b.crit !== crit) continue;
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      for (const b of W.bullets) {
        const r = Math.round(b.r * 2) / 2;
        blit(orb(b.crit ? '#ffe45e' : '#bff9ff', r), b.x, b.y, Math.ceil(r * 5));
      }
    }

    const p = W.player;
    if (p.alive) {
      drawShip(p.x, p.y, p.tilt, p.hitFlash > 0, p.invuln > 0 && Math.floor(clock * 18) % 2 === 0);
      if (W.effects.shield > 0) {
        const fading = W.effects.shield < 1.5 && Math.floor(clock * 10) % 2 === 0;
        ctx.strokeStyle = '#5fd5ff';
        ctx.fillStyle = '#5fd5ff';
        ctx.globalAlpha = fading ? 0.15 : 0.08;
        ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, TAU); ctx.fill();
        ctx.globalAlpha = fading ? 0.3 : 0.65 + 0.2 * Math.sin(clock * 8);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      debug.circle(p.x, p.y, 7, '#00ccff');
    }
  }

  function drawFx() {
    if (!low) ctx.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      ctx.globalAlpha = f.life / f.max;
      blit(glowSprite(f.color), f.x, f.y, f.size);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)), 0, TAU); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px ui-monospace,SFMono-Regular,Consolas,monospace';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life / f.max * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- HUD no canvas
  function drawHud(W, dt) {
    const w = view.w, h = view.h;
    ctx.fillStyle = '#ffffff14';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = '#b6ff5f';
    ctx.fillRect(0, 0, w * Math.min(1, W.xp / W.xpNext), 3);

    let top = 12;
    const b = W.boss;
    if (b) {
      const x = 14, bw = w - 28, y = 24;
      ctx.font = '750 10px ui-monospace,SFMono-Regular,Consolas,monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = b.def.color;
      ctx.fillText(b.name.toUpperCase(), x, y - 5);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffffaa';
      ctx.fillText(`FASE ${b.phase + 1}/3`, x + bw, y - 5);
      ctx.fillStyle = '#ffffff1f';
      ctx.fillRect(x, y, bw, 6);
      ctx.fillStyle = b.flash > 0 ? '#ffffff' : b.def.color;
      ctx.fillRect(x, y, bw * Math.max(0, b.hp / b.maxHp), 6);
      ctx.fillStyle = '#07041a';
      ctx.fillRect(x + bw * 0.66 - 1, y, 2, 6);
      ctx.fillRect(x + bw * 0.33 - 1, y, 2, 6);
      top = y + 14;
    }

    let x = 12;
    for (const k of TIMED_POWERUPS) {
      const t = W.effects[k];
      if (t <= 0) continue;
      if (t < 2 && Math.floor(clock * 8) % 2 === 0) { x += 32; continue; }
      const cx = x + 14, cy = top + 14;
      ctx.drawImage(dropSprite(k), cx - 18, cy - 18, 36, 36);
      ctx.strokeStyle = POWERUPS[k].color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 15.5, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, t / (W.effectMax[k] || t)));
      ctx.stroke();
      x += 32;
    }

    const lowHp = W.player.alive && W.player.hp <= 1;
    const amount = Math.max(hurt, lowHp ? 0.22 + 0.12 * Math.sin(clock * 6) : 0);
    if (amount > 0) {
      const key = `${w}x${h}`;
      if (key !== vignetteKey) {
        vignetteKey = key;
        vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        vignette.addColorStop(0, '#ff2a4d00');
        vignette.addColorStop(1, '#ff2a4d');
      }
      ctx.globalAlpha = Math.min(0.75, amount);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlays(dt, ui) {
    const w = view.w, h = view.h;
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.85, flash);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (strip) {
      strip.t += dt;
      if (strip.t >= strip.duration) strip = null;
      else {
        const a = Math.min(1, strip.t * 6, (strip.duration - strip.t) * 4);
        ctx.globalAlpha = a * (strip.alarm ? 0.55 + 0.45 * Math.sin(strip.t * 14) : 1);
        ctx.fillStyle = strip.color;
        ctx.fillRect(0, 0, w, 3);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '700 10px ui-monospace,SFMono-Regular,Consolas,monospace';
        ctx.fillText(strip.text.toUpperCase(), w / 2, 8);
        ctx.globalAlpha = 1;
      }
    }
    const j = ui.joystick;
    if (j && j.active) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(j.x, j.y, j.radius, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = SHIP;
      ctx.beginPath(); ctx.arc(j.x + j.kx, j.y + j.ky, 20, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------- quadro
  function draw(W, ui) {
    const dt = Math.min(0.05, ui.dt || 0);
    clock += dt;
    const scale = Math.min(3, Math.max(1, Math.round(view.scale * view.dpr * 2) / 2));
    if (scale !== rs) { rs = scale; sprites.clear(); }
    viewport.begin();
    debug.frame();
    if (!ui.frozen) updateFx(dt);
    const boost = W && (W.stage === 'rest' || W.stage === 'warning') && !W.over ? 2.6 : 1;
    background(ui.frozen ? 0 : dt, boost);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (W) drawWorld(W);
    else drawShip(view.w / 2, view.h * 0.74 + Math.sin(clock * 2) * 5, Math.sin(clock * 0.8) * 0.3, false, false);
    drawFx();
    ctx.restore();

    if (W && ui.hud) drawHud(W, dt);
    drawOverlays(ui.frozen ? 0 : dt, ui);
    if (W) debug.info(`inimigos ${W.enemies.length}  tiros ${W.bullets.length}/${W.shots.length}  partículas ${particles.length}  sprites ${sprites.size}`);
    debug.render(ctx, view, ui.stats || { fps: 0, steps: 0, dropped: 0, frameMs: 0 });
  }

  return {
    draw, event,
    setOptions({ effects, shake: allowShake }) { low = effects === 'low'; shakeOn = !!allowShake; if (!shakeOn) shake = 0; sprites.clear(); },
    reset() {
      particles.length = rings.length = floats.length = flashes.length = delayed.length = 0;
      strip = null;
      shake = flash = hurt = 0;
    },
    invalidate: () => sprites.clear()
  };
}
