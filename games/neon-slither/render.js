import { ARENA, skinFor } from './config.js';
import { radiusOf } from './model.js';
import { drawSnake } from './skins.js';

const COLORS = ['#78efd0', '#c4a0ff', '#ff99bf', '#ffd887', '#7dcfff', '#b8ef81'];
// O zoom acompanha a espessura, então a cabeça ocupa sempre mais ou menos a
// mesma fatia da tela e quem encolhe é o mundo em volta — é assim que o
// slither.io mostra que você cresceu. A curva é assintótica: o antigo
// `1 - raiz(massa)` batia no piso já na massa 2800 e a partir dali crescer não
// mudava mais nada na tela.
export const zoomFor = mass => Math.max(.28, 1 / (1 + Math.sqrt(mass) * .0105));
export function createRenderer(viewport, theme) {
  const v = viewport.view, c = v.ctx;
  const camera = { x: 0, y: 0, zoom: 1 };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sparks = []; let eventTime = -1, backdrop = null, backdropKey = '';

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
    const targetZoom = zoomFor(p.mass);
    camera.zoom += (targetZoom - camera.zoom) * factor;
    viewport.begin();
    // A arena tem cor própria e não segue a paleta. Chegou a segui-la, tingida
    // só na matiz para não comer o contraste das skins, mas o verde da arena é
    // identidade do jogo e mudá-lo não acrescentava nada.
    const key = `${v.w}:${v.h}:${theme.dark}`;
    if (key !== backdropKey) {
      backdropKey = key; backdrop = c.createRadialGradient(v.w*.5,v.h*.42,0,v.w*.5,v.h*.42,Math.max(v.w,v.h)*.75);
      backdrop.addColorStop(0, theme.dark ? '#122c35' : '#e5f4f2');
      backdrop.addColorStop(1, theme.dark ? '#080f20' : '#c3d8e4');
    }
    c.fillStyle = backdrop; c.fillRect(0, 0, v.w, v.h);
    c.save(); c.translate(v.w / 2, v.h / 2); c.scale(camera.zoom, camera.zoom); c.translate(-camera.x, -camera.y);
    const left = camera.x - v.w / camera.zoom / 2, top = camera.y - v.h / camera.zoom / 2;
    const right = camera.x + v.w / camera.zoom / 2, bottom = camera.y + v.h / camera.zoom / 2;
    c.strokeStyle = theme.dark ? '#85d9d310' : '#445e781a'; c.lineWidth = 1;
    c.beginPath();
    for (let x = Math.floor(left / 60) * 60; x < right; x += 60) { c.moveTo(x, top); c.lineTo(x, bottom); }
    for (let y = Math.floor(top / 60) * 60; y < bottom; y += 60) { c.moveTo(left, y); c.lineTo(right, y); }
    c.stroke();
    c.fillStyle = theme.dark ? '#a3eee824' : '#34616a30';
    for (let x=Math.floor(left/180)*180;x<right;x+=180) for (let y=Math.floor(top/180)*180;y<bottom;y+=180) c.fillRect(x-1,y-1,2,2);
    c.strokeStyle = '#fa6c88'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, ARENA.radius, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#fa6c8820'; c.lineWidth = 35; c.stroke();
    for (const f of world.foods) {
      if (f.eaten || f.x < left - 20 || f.x > right + 20 || f.y < top - 20 || f.y > bottom + 20) continue;
      const size = 16 + Math.min(20, f.value * 2);
      c.drawImage(sprites[f.color % COLORS.length], f.x - size / 2, f.y - size / 2, size, size);
      c.fillStyle = theme.dark ? '#f4ffed' : COLORS[f.color % COLORS.length];
      c.beginPath(); c.arc(f.x,f.y,Math.min(3,1.3+f.value*.14),0,Math.PI*2); c.fill();
    }
    const ordered = [...world.snakes.filter(s => !s.player), p];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of ordered) {
      if (!s.alive) continue;
      const r = radiusOf(s);
      const hx = s.px + (s.x - s.px) * alpha, hy = s.py + (s.y - s.py) * alpha;
      drawSnake(c,s,{radius:r,alpha,bounds:{left,top,right,bottom},scale:camera.zoom});
      if (s.player) {
        c.save(); c.translate(hx, hy); c.rotate(s.target); c.strokeStyle = theme.dark ? '#ffffffaa' : '#263449aa'; c.lineWidth = 2;
        const arrow = Math.max(33, r + 14); c.beginPath(); c.moveTo(arrow, -5); c.lineTo(arrow + 7, 0); c.lineTo(arrow, 5); c.stroke(); c.restore();
      } else if (s.x > left && s.x < right && s.y > top && s.y < bottom) {
        c.fillStyle = theme.dark ? '#c1cee0' : '#34445b'; c.textAlign = 'center'; c.font = '600 13px system-ui'; c.fillText(s.name, s.x, s.y - r - 12);
      }
    }
    if (eventTime !== world.time) {
      eventTime = world.time;
      if (!reduced.matches) for (const event of world.events) {
        if (event.type !== 'death' && event.type !== 'eat') continue;
        const count = event.type === 'death' ? 12 : 3;
        for (let i=0;i<count && sparks.length<60;i++) {
          const a=i/count*Math.PI*2 + world.time;
          sparks.push({x:event.x ?? p.x,y:event.y ?? p.y,vx:Math.cos(a)*45,vy:Math.sin(a)*45,life:.45,color:skinFor(p.skin).detail});
        }
      }
    }
    for (let i=sparks.length-1;i>=0;i--) {
      const spark=sparks[i]; spark.life-=Math.min(dt,.05);
      if (spark.life<=0) { sparks.splice(i,1); continue; }
      spark.x+=spark.vx*dt; spark.y+=spark.vy*dt;
      c.globalAlpha=spark.life/.45; c.fillStyle=spark.color;
      c.beginPath(); c.arc(spark.x,spark.y,2,0,Math.PI*2); c.fill();
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
    g.clearRect(0, 0, size, size); g.fillStyle = '#071623df'; g.strokeStyle = '#8ddeca88';
    g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#a6e6dd18'; g.beginPath(); g.moveTo(size/2,6); g.lineTo(size/2,size-6); g.moveTo(6,size/2); g.lineTo(size-6,size/2); g.stroke();
    // O ponto do jogador fica na cor viva e os rivais em cinza: achar a si
    // mesmo no mapa não pode depender de distinguir matizes parecidas.
    for (const s of world.snakes) if (s.alive) { g.fillStyle = s.player ? '#b4ffda' : '#afc6d988'; g.beginPath(); g.arc(size / 2 + s.x * k, size / 2 + s.y * k, s.player ? 4.5 : 2, 0, Math.PI * 2); g.fill(); }
  }
  return { draw, minimap, camera, reset(world) { camera.x = world.player.x; camera.y = world.player.y; camera.zoom = 1; sparks.length=0; eventTime=-1; } };
}
