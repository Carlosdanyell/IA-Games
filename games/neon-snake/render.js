import { ITEMS, MAPS, DIFFICULTIES } from './config.js';

const COLORS = {
  food: '#ff5c8a', special: '#ffd166', multiplier: '#b48aff',
  shield: '#53f3dc', shrink: '#ff84d9', slow: '#68bfff', turbo: '#ff964f'
};
const ACCENTS = Object.fromEntries(MAPS.map(map => [map.id, map.color]));
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const itemColor = (type) => ITEMS[type]?.color || COLORS[type] || COLORS.special;

function rounded(ctx, x, y, w, h, r = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function polygon(ctx, x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * TAU / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// O cenário estático fica em um pequeno canvas, sem texturas externas.
export function createRenderer(viewport) {
  const { ctx } = viewport.view;
  let background = null;
  let backgroundKey = '';
  let clock = 0;
  let reduced = false;
  let flash = 0;
  let geometry = { x: 10, y: 12, cell: 19, w: 380, h: 456, cols: 20, rows: 24 };
  const particles = [];
  const rings = [];
  const labels = [];
  const trail = [];

  function layout(state) {
    const { w, h } = viewport.view;
    const cols = state.cols || 20;
    const rows = state.rows || 24;
    const cell = Math.min((w - 20) / cols, (h - 20) / rows);
    return { x: (w - cell * cols) / 2, y: (h - cell * rows) / 2,
      cell, w: cell * cols, h: cell * rows, cols, rows };
  }

  function makeBackground(map) {
    const g = geometry;
    const { w, h } = viewport.view;
    const surface = document.createElement('canvas');
    // O cenário usa resolução lógica; a grade não precisa de uma textura em DPR alto.
    surface.width = Math.ceil(w);
    surface.height = Math.ceil(h);
    const c = surface.getContext('2d');
    const base = c.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#12171b');
    base.addColorStop(0.55, '#101418');
    base.addColorStop(1, '#0b1013');
    rounded(c, g.x, g.y, g.w, g.h, 6);
    c.fillStyle = base;
    c.fill();
    c.save();
    c.clip();

    c.strokeStyle = 'rgba(183, 202, 188, 0.048)';
    c.lineWidth = 0.65;
    c.beginPath();
    for (let i = 1; i < g.cols; i++) {
      const x = g.x + i * g.cell;
      c.moveTo(x, g.y);
      c.lineTo(x, g.y + g.h);
    }
    for (let i = 1; i < g.rows; i++) {
      const y = g.y + i * g.cell;
      c.moveTo(g.x, y);
      c.lineTo(g.x + g.w, y);
    }
    c.stroke();

    const accent = ACCENTS[map] || ACCENTS.grid;
    c.strokeStyle = accent;
    c.fillStyle = accent;
    c.globalAlpha = 0.09;
    c.lineWidth = 1;
    if (map === 'circuit') {
      for (let i = 0; i < 8; i++) {
        const x = g.x + (i * 47 + 18) % g.w;
        const y = g.y + (i * 71 + 22) % g.h;
        const side = i % 2 ? 1 : -1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + side * 28, y);
        c.lineTo(x + side * 46, y + 18); c.lineTo(x + side * 46, y + 60);
        c.stroke();
        c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.stroke();
      }
    } else if (map === 'hex') {
      for (let y = 27, row = 0; y < h; y += 49, row++) {
        for (let x = 30 + row % 2 * 28; x < w; x += 56) {
          polygon(c, x, y, 32, 6, Math.PI / 6);
          c.stroke();
        }
      }
    } else if (map === 'maze') {
      for (let i = 0; i < 6; i++) {
        const x = g.x + 18 + i % 3 * 125;
        const y = g.y + 38 + Math.floor(i / 3) * 240;
        c.beginPath(); c.moveTo(x, y + 70); c.lineTo(x, y);
        c.lineTo(x + 70, y); c.lineTo(x + 70, y + 36);
        c.lineTo(x + 34, y + 36); c.stroke();
      }
    } else if (map === 'city') {
      for (let i = 0; i < 10; i++) {
        const x = g.x + 4 + i * 39;
        const height = 35 + (i * 37) % 95;
        c.strokeRect(x, g.y + g.h - height, 26, height + 5);
        for (let yy = g.y + g.h - height + 10; yy < g.y + g.h; yy += 10) {
          c.fillRect(x + 7, yy, 3, 3); c.fillRect(x + 16, yy, 3, 3);
        }
      }
    } else if (map === 'void') {
      c.globalAlpha = 0.23;
      for (let i = 0; i < 46; i++) {
        const x = g.x + (i * 139.7 + 19) % g.w;
        const y = g.y + (i * 83.3 + 27) % g.h;
        c.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
      }
      c.globalAlpha = 0.08;
      c.beginPath(); c.ellipse(w * 0.5, h * 0.5, w * 0.4, h * 0.2, -0.7, 0, TAU); c.stroke();
    } else {
      c.globalAlpha = 0.16;
      for (let x = 4; x < g.cols; x += 4) {
        for (let y = 4; y < g.rows; y += 4) {
          const px = g.x + x * g.cell;
          const py = g.y + y * g.cell;
          c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 2, py);
          c.moveTo(px, py - 2); c.lineTo(px, py + 2); c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    const shade = c.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, h * 0.64);
    shade.addColorStop(0, 'rgba(3,6,8,0)');
    shade.addColorStop(1, 'rgba(3,6,8,0.35)');
    c.fillStyle = shade;
    c.fillRect(g.x, g.y, g.w, g.h);
    c.restore();
    return surface;
  }

  function center(point) {
    return { x: geometry.x + (point.x + 0.5) * geometry.cell,
      y: geometry.y + (point.y + 0.5) * geometry.cell };
  }

  function drawFrame(state) {
    const g = geometry;
    const color = flash > 0 ? '#ff6586' : ACCENTS[state.map] || ACCENTS.grid;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = flash > 0 ? 0.65 : 0.24;
    ctx.shadowColor = color;
    ctx.shadowBlur = flash > 0 ? 18 : 8;
    ctx.lineWidth = 1;
    rounded(ctx, g.x - 0.5, g.y - 0.5, g.w + 1, g.h + 1, 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.62;
    const length = 15;
    for (const [x, y, dx, dy] of [
      [g.x, g.y, 1, 1], [g.x + g.w, g.y, -1, 1],
      [g.x, g.y + g.h, 1, -1], [g.x + g.w, g.y + g.h, -1, -1]
    ]) {
      ctx.beginPath(); ctx.moveTo(x, y + length * dy);
      ctx.lineTo(x, y + 4 * dy); ctx.quadraticCurveTo(x, y, x + 4 * dx, y);
      ctx.lineTo(x + length * dx, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawObstacles(state, time) {
    const g = geometry;
    for (const obstacle of state.obstacles || []) {
      const p = center(obstacle);
      const size = g.cell - 3;
      ctx.save();
      ctx.fillStyle = obstacle.pending ? '#343020' : '#273038';
      ctx.strokeStyle = obstacle.pending ? '#ffd166' : '#60707b';
      ctx.globalAlpha = obstacle.pending ? 0.45 + Math.sin(time * 9) * 0.14 : 0.9;
      if (obstacle.pending) ctx.setLineDash([3, 3]);
      rounded(ctx, p.x - size / 2, p.y - size / 2, size, size, 3);
      ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(178,199,203,0.2)';
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y + 3); ctx.lineTo(p.x + 3, p.y - 3); ctx.stroke();
      ctx.restore();
    }
    for (const hazard of state.hazards || []) {
      const p = center(hazard);
      const size = g.cell - 2;
      ctx.save();
      ctx.fillStyle = hazard.active ? '#ff526b' : '#ffc66b';
      ctx.globalAlpha = hazard.active ? 0.23 : 0.09 + (reduced ? 0 : Math.sin(time * 8) * 0.04);
      rounded(ctx, p.x - size / 2, p.y - size / 2, size, size, 2); ctx.fill();
      ctx.globalAlpha = hazard.active ? 0.75 : 0.42;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      if (!hazard.active) ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(p.x - 3, p.y - 3); ctx.lineTo(p.x + 3, p.y + 3);
      ctx.moveTo(p.x + 3, p.y - 3); ctx.lineTo(p.x - 3, p.y + 3); ctx.stroke();
      if (!hazard.active && Number.isFinite(hazard.warning)) {
        // A pequena barra avisa quanto falta para a célula se tornar perigosa.
        ctx.fillStyle = '#ffc66b';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(p.x - size / 2 + 2, p.y + size / 2 - 3,
          (size - 4) * clamp(1 - hazard.warning / 2, 0, 1), 1.3);
      }
      ctx.restore();
    }
  }

  function drawItem(item, time, bonusDuration = 10) {
    if (!item) return;
    const p = center(item);
    const c = itemColor(item.type || 'food');
    const isFood = !item.type || item.type === 'food';
    const radius = geometry.cell * (isFood ? 0.3 : 0.37);
    const pulse = reduced ? 1 : 1 + Math.sin(time * 3.5) * 0.075;
    ctx.save();
    ctx.translate(p.x, p.y);
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 3);
    halo.addColorStop(0, `${c}30`);
    halo.addColorStop(1, `${c}00`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, radius * 3, 0, TAU); ctx.fill();
    ctx.scale(pulse, pulse);
    ctx.shadowColor = c;
    ctx.shadowBlur = isFood ? 12 : 15;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
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
      ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.5;
      if (item.type === 'special') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 2.5 : 5.5;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      } else if (item.type === 'shield') {
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, -3); ctx.lineTo(3, 2);
        ctx.quadraticCurveTo(2, 4, 0, 5); ctx.quadraticCurveTo(-2, 4, -3, 2);
        ctx.lineTo(-4, -3); ctx.closePath(); ctx.stroke();
      } else if (item.type === 'slow') {
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(-3, 4);
        ctx.lineTo(3, 4); ctx.lineTo(-4, -4); ctx.stroke();
      } else if (item.type === 'turbo') {
        ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(-4, 1); ctx.lineTo(0, 1);
        ctx.lineTo(-1, 6); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
      } else if (item.type === 'shrink') {
        ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-2, 0); ctx.lineTo(-5, 3);
        ctx.moveTo(5, -3); ctx.lineTo(2, 0); ctx.lineTo(5, 3); ctx.stroke();
      } else {
        ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('×2', 0, 0.5);
      }
      if (Number.isFinite(item.remaining)) {
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        const fraction = clamp(item.remaining / (item.duration || bonusDuration), 0, 1);
        ctx.arc(0, 0, radius + 4.5, -Math.PI / 2, -Math.PI / 2 + TAU * fraction);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function snakePoints(state) {
    const g = geometry;
    const t = reduced || state.status !== 'running' ? 1 : clamp((state.accumulator || 0) / (state.stepDuration || 0.13), 0, 1);
    return (state.snake || []).map((point, index) => {
      const previous = state.previousSnake?.[index] || point;
      let dx = point.x - previous.x;
      let dy = point.y - previous.y;
      if (dx > g.cols / 2) dx -= g.cols;
      if (dx < -g.cols / 2) dx += g.cols;
      if (dy > g.rows / 2) dy -= g.rows;
      if (dy < -g.rows / 2) dy += g.rows;
      const x = ((previous.x + dx * t + 0.5) % g.cols + g.cols) % g.cols;
      const y = ((previous.y + dy * t + 0.5) % g.rows + g.rows) % g.rows;
      return { x: g.x + x * g.cell, y: g.y + y * g.cell };
    });
  }

  function drawSnake(state, dt) {
    const points = snakePoints(state);
    if (!points.length) return;
    const g = geometry;
    const bodyWidth = g.cell * 0.78;
    const turbo = state.effects?.turbo > 0;
    const shield = state.effects?.shield;
    const color = turbo ? '#e0ff81' : '#c1f760';
    ctx.save();
    if (!reduced && state.status === 'running' && dt > 0) {
      const tail = points[points.length - 1];
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(tail.x - last.x, tail.y - last.y) > 2) {
        trail.push({ ...tail, age: 0 });
        if (trail.length > 12) trail.shift();
      }
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i]; p.age += dt;
      if (p.age > 0.22 || reduced) { trail.splice(i, 1); continue; }
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.09 * (1 - p.age / 0.22);
      const size = bodyWidth * (1 - p.age / 0.44);
      rounded(ctx, p.x - size / 2, p.y - size / 2, size, size, size / 3); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const bodyPath = () => {
      ctx.beginPath();
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i], next = points[i + 1];
        if (!next || Math.abs(p.x - next.x) > g.cell * 1.8 || Math.abs(p.y - next.y) > g.cell * 1.8) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    };
    bodyPath();
    ctx.lineWidth = bodyWidth;
    ctx.strokeStyle = color;
    ctx.shadowColor = '#a6f14b';
    ctx.shadowBlur = reduced ? 7 : 13;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // As cópias próximas da borda deixam a travessia sem paredes contínua.
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      const taper = i === points.length - 1 && points.length > 3 ? 0.8 : 1;
      const size = bodyWidth * taper;
      const offsetsX = p.x < g.x + size / 2 ? [0, g.w] : p.x > g.x + g.w - size / 2 ? [0, -g.w] : [0];
      const offsetsY = p.y < g.y + size / 2 ? [0, g.h] : p.y > g.y + g.h - size / 2 ? [0, -g.h] : [0];
      for (const ox of offsetsX) for (const oy of offsetsY) {
        ctx.fillStyle = color;
        rounded(ctx, p.x + ox - size / 2, p.y + oy - size / 2, size, size, size * 0.35);
        ctx.fill();
        if (i > 0 && i % 2 === 0) {
          ctx.fillStyle = 'rgba(56,90,27,0.19)';
          ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, 1.15, 0, TAU); ctx.fill();
        }
      }
    }
    const head = points[0];
    const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[state.direction] || 0;
    const headSize = g.cell * 0.88;
    const offsetsX = head.x < g.x + headSize / 2 ? [0, g.w] : head.x > g.x + g.w - headSize / 2 ? [0, -g.w] : [0];
    const offsetsY = head.y < g.y + headSize / 2 ? [0, g.h] : head.y > g.y + g.h - headSize / 2 ? [0, -g.h] : [0];
    for (const ox of offsetsX) for (const oy of offsetsY) {
      ctx.save(); ctx.translate(head.x + ox, head.y + oy); ctx.rotate(angle);
      if (shield) {
        ctx.strokeStyle = '#53f3dc'; ctx.lineWidth = 1.4;
        ctx.shadowColor = '#53f3dc'; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.arc(0, 0, headSize * 0.85, 0, TAU); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      const headFill = ctx.createLinearGradient(-headSize / 2, 0, headSize / 2, 0);
      headFill.addColorStop(0, color); headFill.addColorStop(1, '#eaffb1');
      ctx.fillStyle = headFill;
      rounded(ctx, -headSize / 2, -headSize / 2, headSize, headSize, headSize * 0.32); ctx.fill();
      ctx.fillStyle = '#152312';
      for (const yy of [-3.8, 3.8]) {
        rounded(ctx, 2, yy - 1.75, 3.5, 3.5, 1.1); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFeedback(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
      ctx.globalAlpha = Math.pow(1 - p.age / p.life, 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i]; ring.age += dt;
      if (ring.age >= 0.45) { rings.splice(i, 1); continue; }
      const t = ring.age / 0.45;
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.strokeStyle = ring.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, 5 + t * 23, 0, TAU); ctx.stroke();
    }
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = labels.length - 1; i >= 0; i--) {
      const label = labels[i]; label.age += dt;
      if (label.age >= 0.85) { labels.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, (0.85 - label.age) * 4);
      ctx.fillStyle = label.color;
      ctx.shadowColor = '#07100c'; ctx.shadowBlur = 5;
      ctx.fillText(label.text, label.x, label.y - (reduced ? 14 : 10 + label.age * 23));
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function event(value) {
    if (value.type === 'over' || value.type === 'shield') flash = 0.3;
    if (!['eat', 'bonus', 'shield'].includes(value.type)) return;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return;
    const p = center(value);
    const color = itemColor(value.item || (value.type === 'shield' ? 'shield' : 'food'));
    if (value.points > 0) {
      labels.push({ x: p.x, y: p.y, text: `+${value.points}`, color, age: 0 });
      if (labels.length > 8) labels.shift();
    }
    if (reduced) return;
    rings.push({ ...p, color, age: 0 });
    if (rings.length > 6) rings.shift();
    const count = value.type === 'bonus' ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU + Math.random() * 0.3;
      const speed = 28 + Math.random() * 54;
      particles.push({ ...p, color, age: 0, life: 0.32 + Math.random() * 0.25,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 1.5 + Math.random() * 2 });
    }
    if (particles.length > 60) particles.splice(0, particles.length - 60);
  }

  function clear() {
    particles.length = 0; labels.length = 0; rings.length = 0; trail.length = 0; flash = 0; clock = 0;
  }

  return {
    render(state, dt = 0, options = {}) {
      if (!state) return;
      reduced = Boolean(options.reducedMotion);
      const delta = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      clock += delta;
      flash = Math.max(0, flash - delta);
      geometry = layout(state);
      const key = `${state.map || 'grid'}:${geometry.cell}:${geometry.cols}:${geometry.rows}:${viewport.view.w}:${viewport.view.h}`;
      if (key !== backgroundKey) {
        background = makeBackground(state.map || 'grid'); backgroundKey = key;
      }
      viewport.begin();
      ctx.drawImage(background, 0, 0);
      ctx.save();
      rounded(ctx, geometry.x, geometry.y, geometry.w, geometry.h, 5); ctx.clip();
      const time = options.preview ? clock : state.elapsed ?? clock;
      drawObstacles(state, time);
      drawItem(state.food, time);
      const bonusDuration = DIFFICULTIES.find(value => value.id === state.difficulty)?.bonusDuration || 10;
      drawItem(state.bonus, time, bonusDuration);
      drawSnake(state, delta);
      drawFeedback(delta);
      ctx.restore();
      drawFrame(state);
    },
    event,
    clear,
    destroy() { clear(); background = null; backgroundKey = ''; }
  };
}
