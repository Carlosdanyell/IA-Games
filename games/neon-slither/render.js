import { ARENA, skinFor } from './config.js';
import { radiusOf } from './model.js';

const COLORS = ['#78efd0', '#c4a0ff', '#ff99bf', '#ffd887', '#7dcfff', '#b8ef81'];
const BLOCK = 6; // pontos do corpo por faixa de cor da skin
export function createRenderer(viewport, theme) {
  const v = viewport.view, c = v.ctx;
  const camera = { x: 0, y: 0, zoom: 1 };
  const sprites = COLORS.map(color => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const g = canvas.getContext('2d'), glow = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    glow.addColorStop(0, color); glow.addColorStop(.24, color); glow.addColorStop(1, color + '00');
    g.fillStyle = glow; g.fillRect(0, 0, 32, 32); return canvas;
  });
  function draw(world, dt = 0, joy = null, alpha = 1) {
    const p = world.player;
    const factor = 1 - Math.exp(-Math.min(dt, .1) * 9);
    camera.x += (p.x - camera.x) * factor; camera.y += (p.y - camera.y) * factor;
    // Campo de visão largo o bastante para a velocidade dar tempo de reagir.
    const targetZoom = Math.max(.55, 1 - Math.sqrt(p.mass) * .0085);
    camera.zoom += (targetZoom - camera.zoom) * factor;
    viewport.begin();
    c.fillStyle = theme.dark ? '#0b111b' : '#e8eef4'; c.fillRect(0, 0, v.w, v.h);
    c.save(); c.translate(v.w / 2, v.h / 2); c.scale(camera.zoom, camera.zoom); c.translate(-camera.x, -camera.y);
    const left = camera.x - v.w / camera.zoom / 2, top = camera.y - v.h / camera.zoom / 2;
    const right = camera.x + v.w / camera.zoom / 2, bottom = camera.y + v.h / camera.zoom / 2;
    c.strokeStyle = theme.dark ? '#a0c8ee0b' : '#445e7814'; c.lineWidth = 1;
    c.beginPath();
    for (let x = Math.floor(left / 60) * 60; x < right; x += 60) { c.moveTo(x, top); c.lineTo(x, bottom); }
    for (let y = Math.floor(top / 60) * 60; y < bottom; y += 60) { c.moveTo(left, y); c.lineTo(right, y); }
    c.stroke();
    c.strokeStyle = '#fa6c88'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, ARENA.radius, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#fa6c8820'; c.lineWidth = 35; c.stroke();
    for (const f of world.foods) {
      if (f.eaten || f.x < left - 20 || f.x > right + 20 || f.y < top - 20 || f.y > bottom + 20) continue;
      const size = 16 + Math.min(20, f.value * 2);
      c.drawImage(sprites[f.color % COLORS.length], f.x - size / 2, f.y - size / 2, size, size);
    }
    const ordered = [...world.snakes.filter(s => !s.player), p];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of ordered) {
      if (!s.alive) continue;
      const colors = skinFor(s.skin).colors, r = radiusOf(s), path = s.path;
      // A cabeça é interpolada; o corpo começa nela para os dois não descolarem.
      const hx = s.px + (s.x - s.px) * alpha, hy = s.py + (s.y - s.py) * alpha;
      c.globalAlpha = s.invulnerable > 0 ? .55 : 1;
      // Um traço por faixa de cor, não um por ponto do corpo: uma cobra longa
      // custava centenas de chamadas de desenho por quadro e derrubava o FPS.
      // `band` de -1 desenha o contorno, que sai em um traço só.
      for (let band = -1; band < colors.length; band++) {
        if (band < 0) { c.strokeStyle = s.boost ? '#ffffff33' : '#00000024'; c.lineWidth = r * 2 + (s.boost ? 8 : 3); }
        else { c.strokeStyle = colors[band]; c.lineWidth = r * 2; }
        c.beginPath();
        let ax = hx, ay = hy, pen = false;
        for (let i = 1; i < path.length; i++) {
          const b = path[i];
          const mine = band < 0 || Math.floor((i - 1) / BLOCK) % colors.length === band;
          // Trechos fora da câmera não entram no traço.
          const seen = Math.max(ax, b.x) >= left - r && Math.min(ax, b.x) <= right + r
            && Math.max(ay, b.y) >= top - r && Math.min(ay, b.y) <= bottom + r;
          if (mine && seen) { if (!pen) { c.moveTo(ax, ay); pen = true; } c.lineTo(b.x, b.y); }
          else pen = false;
          ax = b.x; ay = b.y;
        }
        c.stroke();
      }
      c.save(); c.translate(hx, hy); c.rotate(s.angle);
      c.fillStyle = colors[0]; c.beginPath(); c.ellipse(0, 0, r * 1.2, r, 0, 0, Math.PI * 2); c.fill();
      for (const side of [-1, 1]) {
        c.fillStyle = '#f5fbff'; c.beginPath(); c.arc(r * .38, side * r * .54, r * .37, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#162234'; c.beginPath(); c.arc(r * .56, side * r * .54, r * .17, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      if (s.player) {
        c.save(); c.translate(hx, hy); c.rotate(s.target); c.strokeStyle = theme.dark ? '#ffffffaa' : '#263449aa'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(33, -5); c.lineTo(40, 0); c.lineTo(33, 5); c.stroke(); c.restore();
      } else if (s.x > left && s.x < right && s.y > top && s.y < bottom) {
        c.fillStyle = theme.dark ? '#c1cee0' : '#34445b'; c.textAlign = 'center'; c.font = '10px system-ui'; c.fillText(s.name, s.x, s.y - r - 12);
      }
    }
    c.globalAlpha = 1; c.restore();
    if (joy?.active) {
      c.strokeStyle = theme.dark ? '#ffffff55' : '#20334b66'; c.lineWidth = 2;
      c.beginPath(); c.arc(joy.x, joy.y, 38, 0, Math.PI * 2); c.stroke();
      c.fillStyle = theme.tokens.accent + '88'; c.beginPath(); c.arc(joy.x + joy.dx, joy.y + joy.dy, 14, 0, Math.PI * 2); c.fill();
    }
  }
  function minimap(canvas, world) {
    const g = canvas.getContext('2d'), size = canvas.width, k = (size / 2 - 5) / ARENA.radius;
    g.clearRect(0, 0, size, size); g.fillStyle = '#0b111bbd'; g.strokeStyle = '#adc4de55';
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); g.fill(); g.stroke();
    for (const s of world.snakes) if (s.alive) { g.fillStyle = s.player ? '#aaffda' : '#a4b4c866'; g.beginPath(); g.arc(size / 2 + s.x * k, size / 2 + s.y * k, s.player ? 3 : 1.5, 0, Math.PI * 2); g.fill(); }
  }
  return { draw, minimap, camera, reset(world) { camera.x = world.player.x; camera.y = world.player.y; camera.zoom = 1; } };
}
