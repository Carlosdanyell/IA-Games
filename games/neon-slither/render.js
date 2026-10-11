import { ARENA, skinFor } from './config.js';
import { lengthOf, radiusOf, zoomFor } from './model.js';
import { drawSnake } from './skins.js';
import { createEffects } from './effects.js';

// O zoom mora no modelo: o nascimento precisa saber o que o jogador enxerga
// para pôr rival grande fora da vista dele. Reexportado aqui para quem já o
// importava do renderizador.
export { zoomFor };

const COLORS = ['#78efd0', '#c4a0ff', '#ff99bf', '#ffd887', '#7dcfff', '#b8ef81'];
export function createRenderer(viewport, theme) {
  const v = viewport.view, c = v.ctx;
  const camera = { x: 0, y: 0, zoom: 1 };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sparks = [], fantasmas = []; let eventTime = -1, backdrop = null, backdropKey = '';
  // Relógio do renderizador: só a skin de pulso o usa, para o brilho respirar.
  let clock = 0;
  // Partículas das skins, com teto: a arena inteira divide duzentas, e cada
  // rival solta menos da metade do que o jogador solta — o efeito que se olha
  // é o da própria cobra. Medido com a CPU seis vezes mais lenta e uma arena
  // cheia, trezentas custavam 4 ms por quadro, quase tudo em carimbar imagem.
  // Com o movimento reduzido pedido pelo sistema, nenhuma é solta.
  const efeitos = createEffects(200);
  let tempoDoMundo = -1;

  const sprites = COLORS.map(color => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const g = canvas.getContext('2d'), glow = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    glow.addColorStop(0, color); glow.addColorStop(.24, color); glow.addColorStop(1, color + '00');
    g.fillStyle = glow; g.fillRect(0, 0, 32, 32); return canvas;
  });
  function draw(world, dt = 0, joy = null, alpha = 1) {
    const p = world.player;
    clock += Math.min(dt, .1);
    // Com o mundo parado (pausa, fim de partida) as partículas que existem
    // terminam de viver, mas ninguém solta novas.
    const passo = Math.min(dt, .1), andando = world.time !== tempoDoMundo;
    tempoDoMundo = world.time;
    if (reduced.matches) efeitos.limpar(); else efeitos.atualizar(passo);
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
      // A luz deixada por quem morreu brilha na largura do corpo dele.
      const corpo = f.size || 0, size = Math.max(16 + Math.min(20, f.value * 2), corpo * 2), meio = size / 2;
      if (f.eaten || f.x < left - meio || f.x > right + meio || f.y < top - meio || f.y > bottom + meio) continue;
      c.drawImage(sprites[f.color % COLORS.length], f.x - meio, f.y - meio, size, size);
      c.fillStyle = theme.dark ? '#f4ffed' : COLORS[f.color % COLORS.length];
      c.beginPath(); c.arc(f.x,f.y,Math.max(Math.min(3,1.3+f.value*.14),corpo*.18),0,Math.PI*2); c.fill();
    }
    // O corpo que acabou de morrer acende e se abre por meio segundo antes de
    // sumir, deixando a luz para trás. O clarão é o traço do próprio corpo, então
    // o tamanho dele é o da cobra: o gigante explode largo, o novato, fino.
    const passoFantasma = Math.max(1, Math.round(5 / (ARENA.spacing * camera.zoom)));
    for (let i = fantasmas.length - 1; i >= 0; i--) {
      const g = fantasmas[i]; g.vida -= Math.min(dt, .05);
      if (g.vida <= 0) { fantasmas.splice(i, 1); continue; }
      const k = g.vida / .5, largura = g.r * 2 * (1.7 - .7 * k), folga = largura;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5 * k * k; c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = g.cor; c.lineWidth = largura; c.beginPath();
      let a = g.path[0], pen = false;
      for (let j = passoFantasma; j < g.path.length + passoFantasma - 1; j += passoFantasma) {
        const b = g.path[Math.min(j, g.path.length - 1)];
        if (Math.max(a.x,b.x) >= left-folga && Math.min(a.x,b.x) <= right+folga && Math.max(a.y,b.y) >= top-folga && Math.min(a.y,b.y) <= bottom+folga) {
          if (!pen) c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); pen = true;
        } else pen = false;
        a = b;
      }
      c.stroke(); c.restore();
    }
    const vista = { left, top, right, bottom };
    efeitos.desenhar(c, 'chao', { escuro: theme.dark, vista });
    const ordered = [...world.snakes.filter(s => !s.player), p];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of ordered) {
      if (!s.alive) continue;
      const r = radiusOf(s);
      const hx = s.px + (s.x - s.px) * alpha, hy = s.py + (s.y - s.py) * alpha;
      // `points` é quantos pontos o modelo guarda com o corpo cheio: a pele usa
      // isso para a ponta da cauda andar lisa.
      drawSnake(c,s,{radius:r,alpha,bounds:vista,scale:camera.zoom,time:clock,
        points:Math.ceil(lengthOf(s) / ARENA.spacing) + 1,
        effects:reduced.matches ? null : efeitos, effectsRate:s.player ? 1 : .45,
        dt:andando ? passo : 0, speed:s.boost ? ARENA.boost : ARENA.speed});
      if (s.player) {
        c.save(); c.translate(hx, hy); c.rotate(s.target); c.strokeStyle = theme.dark ? '#ffffffaa' : '#263449aa'; c.lineWidth = 2;
        const arrow = Math.max(33, r + 14); c.beginPath(); c.moveTo(arrow, -5); c.lineTo(arrow + 7, 0); c.lineTo(arrow, 5); c.stroke(); c.restore();
      } else if (s.x > left && s.x < right && s.y > top && s.y < bottom) {
        c.fillStyle = theme.dark ? '#c1cee0' : '#34445b'; c.textAlign = 'center'; c.font = '600 13px system-ui'; c.fillText(s.name, s.x, s.y - r - 12);
      }
    }
    efeitos.desenhar(c, 'ar', { escuro: theme.dark, vista });
    if (eventTime !== world.time) {
      eventTime = world.time;
      if (!reduced.matches) for (const event of world.events) {
        if (event.type !== 'death' && event.type !== 'eat') continue;
        // A faísca da morte tem a cor de quem morreu e se abre na proporção do
        // tamanho dele; a de comer é do jogador, que é quem come.
        const morte = event.type === 'death', r = morte ? event.r ?? 10 : 0;
        const cor = skinFor(morte ? event.skin ?? p.skin : p.skin).detail;
        if (morte && event.path?.length) fantasmas.push({ path: event.path, r, cor, vida: .5 });
        const count = morte ? Math.round(10 + Math.min(14, r * .3)) : 3;
        const rapidez = morte ? 45 + r * 2.2 : 45, tamanho = morte ? 2 + r * .05 : 2;
        for (let i=0;i<count && sparks.length<90;i++) {
          const a=i/count*Math.PI*2 + world.time;
          sparks.push({x:event.x ?? p.x,y:event.y ?? p.y,vx:Math.cos(a)*rapidez,vy:Math.sin(a)*rapidez,life:.45,color:cor,size:tamanho});
        }
      }
    }
    for (let i=sparks.length-1;i>=0;i--) {
      const spark=sparks[i]; spark.life-=Math.min(dt,.05);
      if (spark.life<=0) { sparks.splice(i,1); continue; }
      spark.x+=spark.vx*dt; spark.y+=spark.vy*dt;
      c.globalAlpha=spark.life/.45; c.fillStyle=spark.color;
      c.beginPath(); c.arc(spark.x,spark.y,spark.size,0,Math.PI*2); c.fill();
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
  return { draw, minimap, camera, reset(world) { camera.x = world.player.x; camera.y = world.player.y; camera.zoom = 1; sparks.length=0; fantasmas.length=0; efeitos.limpar(); eventTime=-1; } };
}
