import { ITEMS, MAPS, SNAKE } from './config.js';
import { BOARD, wrapAngle } from './model.js';

// Desenho em Canvas 2D. A simulação usa unidades do tabuleiro (uma casa = 20);
// aqui tudo é convertido para o campo lógico do viewport. O cenário estático
// fica num canvas próprio e só é refeito quando muda a arena ou o tamanho.

const ACCENTS = Object.fromEntries(MAPS.map(map => [map.id, map.color]));
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const itemColor = type => ITEMS[type]?.color || ITEMS.special.color;

function rounded(ctx, x, y, w, h, r = 4) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function polygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * TAU / sides;
    const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(viewport) {
  const { ctx } = viewport.view;
  let background = null, backgroundKey = '';
  let clock = 0, reduced = false, flash = 0;
  let g = { x: 10, y: 12, cell: 19, w: 380, h: 456, k: 0.95 };
  const particles = [], rings = [], labels = [], trail = [];

  function layout() {
    const { w, h } = viewport.view;
    const cell = Math.min((w - 20) / BOARD.cols, (h - 20) / BOARD.rows);
    return { x: (w - cell * BOARD.cols) / 2, y: (h - cell * BOARD.rows) / 2, cell,
      w: cell * BOARD.cols, h: cell * BOARD.rows, k: cell / BOARD.cell };
  }
  const sx = x => g.x + x * g.k;
  const sy = y => g.y + y * g.k;

  function makeBackground(map) {
    const { w, h } = viewport.view;
    const surface = document.createElement('canvas');
    surface.width = Math.ceil(w);
    surface.height = Math.ceil(h);
    const c = surface.getContext('2d');
    const base = c.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#12171b'); base.addColorStop(0.55, '#101418'); base.addColorStop(1, '#0b1013');
    rounded(c, g.x, g.y, g.w, g.h, 6);
    c.fillStyle = base;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(183, 202, 188, 0.05)';
    c.lineWidth = 0.65;
    c.beginPath();
    for (let i = 1; i < BOARD.cols; i++) { const x = g.x + i * g.cell; c.moveTo(x, g.y); c.lineTo(x, g.y + g.h); }
    for (let i = 1; i < BOARD.rows; i++) { const y = g.y + i * g.cell; c.moveTo(g.x, y); c.lineTo(g.x + g.w, y); }
    c.stroke();

    const accent = ACCENTS[map] || ACCENTS.grid;
    c.strokeStyle = accent; c.fillStyle = accent; c.globalAlpha = 0.09; c.lineWidth = 1;
    if (map === 'circuit') {
      for (let i = 0; i < 8; i++) {
        const x = g.x + (i * 47 + 18) % g.w, y = g.y + (i * 71 + 22) % g.h, side = i % 2 ? 1 : -1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * 28, y); c.lineTo(x + side * 46, y + 18); c.lineTo(x + side * 46, y + 60); c.stroke();
        c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.stroke();
      }
    } else if (map === 'hex') {
      for (let y = 27, row = 0; y < h; y += 49, row++) for (let x = 30 + row % 2 * 28; x < w; x += 56) { polygon(c, x, y, 32, 6, Math.PI / 6); c.stroke(); }
    } else if (map === 'maze') {
      for (let i = 0; i < 6; i++) {
        const x = g.x + 18 + i % 3 * 125, y = g.y + 38 + Math.floor(i / 3) * 240;
        c.beginPath(); c.moveTo(x, y + 70); c.lineTo(x, y); c.lineTo(x + 70, y); c.lineTo(x + 70, y + 36); c.lineTo(x + 34, y + 36); c.stroke();
      }
    } else if (map === 'city') {
      for (let i = 0; i < 10; i++) {
        const x = g.x + 4 + i * 39, height = 35 + (i * 37) % 95;
        c.strokeRect(x, g.y + g.h - height, 26, height + 5);
        for (let yy = g.y + g.h - height + 10; yy < g.y + g.h; yy += 10) { c.fillRect(x + 7, yy, 3, 3); c.fillRect(x + 16, yy, 3, 3); }
      }
    } else if (map === 'void') {
      c.globalAlpha = 0.23;
      for (let i = 0; i < 46; i++) c.fillRect(g.x + (i * 139.7 + 19) % g.w, g.y + (i * 83.3 + 27) % g.h, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
      c.globalAlpha = 0.08;
      c.beginPath(); c.ellipse(w * 0.5, h * 0.5, w * 0.4, h * 0.2, -0.7, 0, TAU); c.stroke();
    } else {
      c.globalAlpha = 0.16;
      for (let x = 4; x < BOARD.cols; x += 4) for (let y = 4; y < BOARD.rows; y += 4) {
        const px = g.x + x * g.cell, py = g.y + y * g.cell;
        c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 2, py); c.moveTo(px, py - 2); c.lineTo(px, py + 2); c.stroke();
      }
    }
    c.globalAlpha = 1;
    const shade = c.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, h * 0.64);
    shade.addColorStop(0, 'rgba(3,6,8,0)'); shade.addColorStop(1, 'rgba(3,6,8,0.35)');
    c.fillStyle = shade;
    c.fillRect(g.x, g.y, g.w, g.h);
    c.restore();
    return surface;
  }

  function drawFrame(state) {
    const color = flash > 0 ? '#ff6586' : ACCENTS[state.map] || ACCENTS.grid;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = flash > 0 ? 0.7 : 0.26;
    ctx.shadowColor = color;
    ctx.shadowBlur = flash > 0 ? 18 : 8;
    ctx.lineWidth = state.mode === 'wrap' || state.mode === 'zen' ? 1 : 1.6;
    if (state.mode === 'wrap' || state.mode === 'zen') ctx.setLineDash([6, 6]);
    rounded(ctx, g.x - 0.5, g.y - 0.5, g.w + 1, g.h + 1, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacles(state, time) {
    for (const rect of state.obstacles) {
      const size = rect.w * g.k - 3, px = sx(rect.x + rect.w / 2), py = sy(rect.y + rect.h / 2);
      ctx.fillStyle = '#273038';
      ctx.strokeStyle = '#60707b';
      rounded(ctx, px - size / 2, py - size / 2, size, size, 3);
      ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
    }
    for (const hazard of state.hazards) {
      const size = hazard.w * g.k - 2, px = sx(hazard.x + hazard.w / 2), py = sy(hazard.y + hazard.h / 2);
      ctx.save();
      ctx.fillStyle = hazard.active ? '#ff526b' : '#ffc66b';
      ctx.globalAlpha = hazard.active ? 0.25 : 0.1 + (reduced ? 0 : Math.sin(time * 8) * 0.04);
      rounded(ctx, px - size / 2, py - size / 2, size, size, 2);
      ctx.fill();
      ctx.globalAlpha = hazard.active ? 0.75 : 0.45;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      if (!hazard.active) ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px - 3, py - 3); ctx.lineTo(px + 3, py + 3); ctx.moveTo(px + 3, py - 3); ctx.lineTo(px - 3, py + 3); ctx.stroke();
      if (!hazard.active && Number.isFinite(hazard.warning)) {
        ctx.fillStyle = '#ffc66b';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(px - size / 2 + 2, py + size / 2 - 3, (size - 4) * clamp(1 - hazard.warning / 2, 0, 1), 1.3);
      }
      ctx.restore();
    }
  }

  function drawItem(item, time) {
    if (!item) return;
    const px = sx(item.x), py = sy(item.y);
    const color = itemColor(item.type || 'food');
    const isFood = !item.type || item.type === 'food';
    const radius = g.cell * (isFood ? 0.3 : 0.37);
    const pulse = reduced ? 1 : 1 + Math.sin(time * 3.5) * 0.075;
    ctx.save();
    ctx.translate(px, py);
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 3);
    halo.addColorStop(0, `${color}30`); halo.addColorStop(1, `${color}00`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, radius * 3, 0, TAU); ctx.fill();
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color;
    ctx.shadowBlur = isFood ? 12 : 15;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (isFood) {
      rounded(ctx, -radius, -radius, radius * 2, radius * 2, radius * 0.72);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffe4ef';
      rounded(ctx, -radius * 0.5, -radius * 0.55, radius * 0.55, radius * 0.3, 1);
      ctx.fill();
    } else {
      ctx.lineWidth = 1.1;
      polygon(ctx, 0, 0, radius + 1, 6, Math.PI / 6);
      ctx.fillStyle = '#151d23'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
      if (item.type === 'special') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.5 : 5.5;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
      } else if (item.type === 'shield') {
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, -3); ctx.lineTo(3, 2);
        ctx.quadraticCurveTo(2, 4, 0, 5); ctx.quadraticCurveTo(-2, 4, -3, 2); ctx.lineTo(-4, -3); ctx.closePath(); ctx.stroke();
      } else if (item.type === 'slow') {
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(-3, 4); ctx.lineTo(3, 4); ctx.lineTo(-4, -4); ctx.stroke();
      } else if (item.type === 'turbo') {
        ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(-4, 1); ctx.lineTo(0, 1); ctx.lineTo(-1, 6); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
      } else if (item.type === 'shrink') {
        ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-2, 0); ctx.lineTo(-5, 3); ctx.moveTo(5, -3); ctx.lineTo(2, 0); ctx.lineTo(5, 3); ctx.stroke();
      } else {
        ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('×2', 0, 0.5);
      }
      if (Number.isFinite(item.remaining)) {
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4.5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(item.remaining / (item.duration || 10), 0, 1));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // O corpo é uma linha contínua pelo caminho da cabeça, quebrada onde a
  // cobra atravessou a borda no modo sem paredes.
  function bodyPath(points) {
    ctx.beginPath();
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i], next = points[i + 1];
      const jump = next && (Math.abs(p.x - next.x) > BOARD.w / 2 || Math.abs(p.y - next.y) > BOARD.h / 2);
      if (!next || jump) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y));
    }
  }

  function drawSnake(state, dt) {
    const points = [state.head, ...state.path];
    const turbo = state.effects.turbo > 0;
    const color = turbo ? '#e0ff81' : '#c1f760';
    const width = SNAKE.bodyRadius * 2.3 * g.k;
    const blink = state.effects.invuln > 0 && Math.floor(clock * 12) % 2 === 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (blink) ctx.globalAlpha = 0.45;

    if (!reduced && dt > 0 && state.status === 'running' && !state.waiting) {
      trail.unshift({ x: sx(state.head.x), y: sy(state.head.y), age: 0 });
      if (trail.length > 10) trail.pop();
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const t = trail[i];
      t.age += dt;
      if (t.age > 0.25 || reduced) { trail.splice(i, 1); continue; }
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.08 * (1 - t.age / 0.25);
      ctx.beginPath(); ctx.arc(t.x, t.y, width * 0.6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = blink ? 0.45 : 1;

    bodyPath(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = '#a6f14b';
    ctx.shadowBlur = reduced ? 6 : 13;
    ctx.stroke();
    ctx.shadowBlur = 0;
    bodyPath(points);
    ctx.strokeStyle = 'rgba(234,255,196,0.35)';
    ctx.lineWidth = width * 0.28;
    ctx.stroke();

    const hx = sx(state.head.x), hy = sy(state.head.y), r = SNAKE.headRadius * 1.3 * g.k;
    if (state.effects.shield) {
      ctx.strokeStyle = '#53f3dc'; ctx.lineWidth = 1.6;
      ctx.shadowColor = '#53f3dc'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(hx, hy, r * 1.7, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const headFill = ctx.createRadialGradient(hx - r * 0.3, hy - r * 0.3, 1, hx, hy, r);
    headFill.addColorStop(0, '#f2ffc8'); headFill.addColorStop(1, color);
    ctx.fillStyle = headFill;
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
    // Olhos voltados para onde a cabeça aponta.
    ctx.fillStyle = '#152312';
    for (const side of [-1, 1]) {
      const a = state.angle + side * 0.62;
      ctx.beginPath(); ctx.arc(hx + Math.cos(a) * r * 0.55, hy + Math.sin(a) * r * 0.55, r * 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Seta para onde a cobra está virando: é o retorno imediato do gesto.
  function drawIndicator(state, showHint) {
    if (state.status !== 'running') return;
    const hx = sx(state.head.x), hy = sy(state.head.y), r = SNAKE.headRadius * 1.3 * g.k;
    const angle = state.waiting ? state.angle : state.target;
    const pulse = state.waiting && !reduced ? 0.5 + 0.5 * Math.sin(clock * 5) : 1;
    const d = r + 11 + (state.waiting && !reduced ? Math.sin(clock * 5) * 2 : 0);
    ctx.save();
    ctx.translate(hx + Math.cos(angle) * d, hy + Math.sin(angle) * d);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillStyle = '#eaffc4';
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    const turn = wrapAngle(state.target - state.angle);
    if (!state.waiting && Math.abs(turn) > 0.08) {
      ctx.save();
      ctx.strokeStyle = '#eaffc4';
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, r + 5, state.angle, state.angle + turn, turn < 0);
      ctx.stroke();
      ctx.restore();
    }
    if (state.waiting && showHint) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.fillStyle = '#eaffc4';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Arraste em qualquer direção para começar', g.x + g.w / 2, g.y + g.h - 22);
      ctx.restore();
    }
  }

  function drawJoystick(joystick) {
    if (!joystick || !joystick.active) return;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#eaffc4';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joystick.x, joystick.y, joystick.radius, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#c1f760';
    ctx.beginPath(); ctx.arc(joystick.x + joystick.kx, joystick.y + joystick.ky, 16, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawFeedback(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
      ctx.globalAlpha = Math.pow(1 - p.age / p.life, 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.age += dt;
      if (ring.age >= 0.45) { rings.splice(i, 1); continue; }
      const t = ring.age / 0.45;
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = ring.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, 5 + t * 23, 0, TAU); ctx.stroke();
    }
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = labels.length - 1; i >= 0; i--) {
      const label = labels[i];
      label.age += dt;
      if (label.age >= 0.85) { labels.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, (0.85 - label.age) * 4);
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, label.x, label.y - (reduced ? 14 : 10 + label.age * 23));
    }
    ctx.globalAlpha = 1;
  }

  function event(value) {
    if (value.type === 'over' || value.type === 'shield') flash = 0.3;
    if (!['eat', 'bonus', 'shield'].includes(value.type) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return;
    const px = sx(value.x), py = sy(value.y);
    const color = itemColor(value.item || (value.type === 'shield' ? 'shield' : 'food'));
    if (value.points > 0) {
      labels.push({ x: px, y: py, text: `+${value.points}`, color, age: 0 });
      if (labels.length > 6) labels.shift();
    }
    if (reduced) return;
    rings.push({ x: px, y: py, color, age: 0 });
    if (rings.length > 6) rings.shift();
    const count = value.type === 'bonus' ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU + Math.random() * 0.3, speed = 28 + Math.random() * 54;
      particles.push({ x: px, y: py, color, age: 0, life: 0.32 + Math.random() * 0.25,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 1.5 + Math.random() * 2 });
    }
    if (particles.length > 60) particles.splice(0, particles.length - 60);
  }

  function clear() {
    particles.length = labels.length = rings.length = trail.length = 0;
    flash = 0;
    clock = 0;
  }

  return {
    render(state, dt = 0, options = {}) {
      if (!state) return;
      reduced = Boolean(options.reducedMotion);
      const delta = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      clock += delta;
      flash = Math.max(0, flash - delta);
      g = layout();
      const key = `${state.map}:${g.cell}:${viewport.view.w}:${viewport.view.h}`;
      if (key !== backgroundKey) { background = makeBackground(state.map); backgroundKey = key; }
      viewport.begin();
      ctx.drawImage(background, 0, 0);
      ctx.save();
      rounded(ctx, g.x, g.y, g.w, g.h, 5);
      ctx.clip();
      drawObstacles(state, clock);
      drawItem(state.food, clock);
      drawItem(state.bonus, clock);
      drawSnake(state, options.frozen ? 0 : delta);
      drawFeedback(options.frozen ? 0 : delta);
      ctx.restore();
      drawIndicator(state, options.hint);
      drawFrame(state);
      drawJoystick(options.joystick);
    },
    event,
    clear,
    // Converte um ponto do campo lógico (ponteiro) para unidades do tabuleiro.
    toBoard: (x, y) => ({ x: (x - g.x) / g.k, y: (y - g.y) / g.k }),
    destroy() { clear(); background = null; backgroundKey = ''; }
  };
}
