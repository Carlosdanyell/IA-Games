import { ARENA, skinFor } from './config.js';

const TAU = Math.PI * 2;
// A mesma pintura serve à arena e às prévias. Cada estampa é rasterizada uma
// única vez: sem shadowBlur nem gradiente por ponto do corpo durante a partida.
const stamps = new Map();
function stampFor(skin) {
  if (stamps.has(skin.id)) return stamps.get(skin.id);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'); g.translate(32, 32);
  g.fillStyle = g.strokeStyle = skin.detail; g.lineWidth = 3;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = points => { g.beginPath(); points.forEach(([x,y], i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke(); };
  const dot = (x,y,r) => { g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); };
  switch (skin.pattern) {
    case 'ribbon': g.globalAlpha = .62; g.fillRect(-18,-5,36,4); break;
    case 'rings': g.lineWidth = 4; line([[0,-24],[0,24]]); break;
    case 'chevron': line([[-9,-23],[7,0],[-9,23]]); break;
    case 'wave':
      g.beginPath(); g.moveTo(-18,-8); g.bezierCurveTo(-3,-23,3,23,18,8); g.stroke(); break;
    case 'confetti': dot(-8,-10,4); dot(10,9,3); g.fillRect(-7,6,6,6); break;
    case 'facets':
      g.globalAlpha = .72; g.beginPath(); g.moveTo(-16,-20); g.lineTo(15,0); g.lineTo(-16,20); g.closePath(); g.fill();
      g.strokeStyle = '#3b82ac'; g.lineWidth = 1.5; line([[-16,-20],[15,0],[-16,20]]); break;
    case 'tiger':
      for (const side of [-1,1]) { g.beginPath(); g.moveTo(-12,side*25); g.lineTo(2,side*3); g.lineTo(8,side*25); g.closePath(); g.fill(); } break;
    case 'spots':
      g.beginPath(); g.ellipse(-5,-9,12,10,.5,0,TAU); g.ellipse(9,12,7,8,0,0,TAU); g.fill();
      g.fillStyle = '#4c4348'; dot(13,-17,3); break;
    case 'circuit':
      g.lineWidth = 2.5; line([[-18,0],[-6,0],[2,-12],[18,-12]]); line([[0,4],[7,14],[17,14]]);
      dot(3,-12,3); dot(7,14,3); break;
    case 'pixels': g.fillRect(-11,-17,11,11); g.fillRect(0,-6,11,11); g.fillStyle='#e0b7ff'; g.fillRect(-11,5,11,11); break;
    case 'cracks': line([[-10,-25],[0,-11],[-5,2],[10,13],[6,25]]); g.lineWidth = 2; line([[-5,2],[-18,9]]); break;
    case 'scales':
      g.lineWidth = 2; for (const y of [-14,0,14]) line([[-9,y-7],[0,y],[9,y-7]]); break;
    case 'stars':
      line([[-7,-16],[-7,-4]]); line([[-13,-10],[-1,-10]]); dot(10,10,2.8); dot(-12,17,1.8); break;
    case 'diamonds':
      g.beginPath(); g.moveTo(0,-11); g.lineTo(8,0); g.lineTo(0,11); g.lineTo(-8,0); g.closePath(); g.fill();
      dot(0,-21,2); dot(0,21,2); break;
  }
  stamps.set(skin.id, canvas); return canvas;
}

// Fileiras de escamas atravessando o corpo. Cada fileira é desenhada no
// referencial local da carne — `t` ao longo do corpo, `nx`/`ny` cruzando —, por
// isso a escama acompanha a curva em vez de ficar chapada. As fileiras vêm
// alternadas, como na pele de uma cobra de verdade, e o passo é escolhido pelo
// número de série do ponto para a textura não escorregar quando a cauda anda.
const SCALE_ROWS = [-.62, 0, .62];
function scales(c, path, { r, hx, hy, seen, pointSpacing, scale }) {
  // Escama menor que uns poucos pixels na tela não aparece, só custa. Uma cobra
  // pequena ao longe pula a textura inteira sem diferença visível.
  const naTela = r * scale;
  if (naTela < 5) return;
  // Uma fileira a cada meio raio: mais espaçado vira listra, mais junto vira borrão.
  const step = Math.max(1, Math.round(r * .55 / pointSpacing));
  const largura = r * .34, fundo = r * .3;
  // Sulco e brilho saem em dois traços só, um para cada tom do relevo.
  const camadas = [['#0a141e40', Math.max(.8, r * .13), 0]];
  if (naTela >= 11) camadas.push(['#ffffff20', Math.max(.6, r * .09), -r * .1]);
  for (const [tom, espessura, recuo] of camadas) {
    c.strokeStyle = tom; c.lineWidth = espessura; c.beginPath();
    for (let i = 1; i < path.length - 1; i++) {
      const p = path[i], serie = p.n ?? -i;
      if ((((serie % step) + step) % step) !== 0) continue;
      const anterior = i === 1 ? { x: hx, y: hy } : path[i - 1];
      if (!seen(p, p)) continue;
      let tx = anterior.x - path[i + 1].x, ty = anterior.y - path[i + 1].y;
      const comp = Math.hypot(tx, ty) || 1; tx /= comp; ty /= comp;
      const nx = -ty, ny = tx;
      // Fileiras ímpares deslocadas meia escama: o encaixe é o que lê como pele.
      const desloca = (((Math.floor(serie / step) % 2) + 2) % 2) ? largura : 0;
      for (const linha of SCALE_ROWS) {
        const meio = linha * r + desloca;
        if (Math.abs(meio) > r * .92) continue;
        const ax = meio - largura, bx = meio + largura;
        // Arco abrindo para a cauda: a ponta da escama aponta para trás.
        c.moveTo(p.x + nx * ax + tx * recuo, p.y + ny * ax + ty * recuo);
        c.quadraticCurveTo(
          p.x + nx * meio - tx * (fundo - recuo), p.y + ny * meio - ty * (fundo - recuo),
          p.x + nx * bx + tx * recuo, p.y + ny * bx + ty * recuo);
      }
    }
    c.stroke();
  }
}

// Halo neon somado por cima do corpo. `shadowBlur` daria o borrão de graça mas
// custa caro demais por quadro, então o brilho sai de traços largos e fracos em
// modo `lighter`: cada camada soma luz e o degrau entre elas lê como difusão.
// Duas camadas bastam; a terceira não muda nada que o olho note.
function halo(c, path, { r, hx, hy, seen, cor, forca, boost }) {
  const camadas = boost
    ? [[r * 2 + 26, .1 * forca], [r * 2 + 12, .17 * forca]]
    : [[r * 2 + 13, .07 * forca], [r * 2 + 6, .12 * forca]];
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = cor;
  for (const [largura, alfa] of camadas) {
    c.globalAlpha = alfa; c.lineWidth = largura;
    c.beginPath();
    let a = { x: hx, y: hy }, pen = false;
    for (let i = 1; i < path.length; i++) {
      const b = path[i];
      if (seen(a, b, largura)) { if (!pen) c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); pen = true; } else pen = false;
      a = b;
    }
    c.stroke();
  }
  c.restore();
}

// Borrão da aceleração: um rastro curto e claro logo atrás da cabeça, que vai
// sumindo. É o que dá a leitura de velocidade sem mexer no corpo inteiro.
function rastro(c, path, { r, hx, hy, seen, cor }) {
  const quanto = Math.min(path.length - 1, 16);
  if (quanto < 5) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = cor; c.lineCap = 'round';
  let a = path[1];
  for (let i = 2; i <= quanto; i++) {
    const b = path[i], t = (i - 2) / (quanto - 2);
    // O brilho acende logo atrás da cabeça e some na cauda. Começar nela lavava
    // a cabeça de branco e engolia os olhos.
    if (seen(a, b, r * 3)) {
      c.globalAlpha = .26 * Math.min(1, t * 4) * (1 - t) ** 1.6;
      c.lineWidth = r * (1.9 + (1 - t) * 1.2);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    a = b;
  }
  c.restore();
}

export function drawSnake(c, snake, { radius = 10, alpha = 1, bounds = null, details = true, pointSpacing = ARENA.spacing, scale = 1 } = {}) {
  const skin = skinFor(snake.skin), path = snake.path;
  if (!path?.length) return;
  const hx = (snake.px ?? snake.x) + (snake.x - (snake.px ?? snake.x)) * alpha;
  const hy = (snake.py ?? snake.y) + (snake.y - (snake.py ?? snake.y)) * alpha;
  const r = radius, colors = skin.colors;
  const seen = (a,b,margin=r+8) => !bounds || Math.max(a.x,b.x) >= bounds.left-margin && Math.min(a.x,b.x) <= bounds.right+margin
    && Math.max(a.y,b.y) >= bounds.top-margin && Math.min(a.y,b.y) <= bounds.bottom+margin;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // Brilho abaixo de uns poucos pixels na tela não aparece, só custa.
  const aceso = details && r * scale >= 4;
  if (aceso && (skin.glow || snake.boost)) {
    // Acelerar acende qualquer skin; as de identidade neon já vêm acesas.
    const forca = Math.max(skin.glow ?? 0, snake.boost ? .85 : 0);
    halo(c, path, { r, hx, hy, seen, cor: skin.detail, forca, boost: snake.boost });
  }
  // Proteção mantém a skin legível; o anel na cabeça explica seu estado.
  c.globalAlpha = snake.invulnerable > 0 ? .8 : 1;
  // Largura das faixas e distância das estampas acompanham o crescimento.
  const bandLength = Math.max(3, Math.round(r * (colors.length > 3 ? 2.5 : 4) / pointSpacing));
  // A estampa é pintada na carne, então segue o número de série do ponto. Pelo
  // índice do array ela escorregaria um espaçamento a cada ponto novo na
  // cabeça — trinta saltos por segundo, que é o corpo tremendo.
  const bandOf = (b, i) => ((Math.floor((b.n ?? -i) / bandLength) % colors.length) + colors.length) % colors.length;
  for (let band=-2; band<colors.length; band++) {
    if (band === -2) { c.strokeStyle = skin.detail+'66'; c.lineWidth=r*2+(snake.boost ? 10 : 2); }
    else if (band === -1) { c.strokeStyle=colors[1]; c.lineWidth=r*2; }
    else { c.strokeStyle=colors[band]; c.lineWidth=r*1.82; }
    c.beginPath(); let a={x:hx,y:hy}, pen=false;
    for (let i=1;i<path.length;i++) {
      const b=path[i], mine=band<0 || bandOf(b,i)===band;
      if (mine && seen(a,b)) { if (!pen) c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); pen=true; } else pen=false;
      a=b;
    }
    c.stroke();
  }
  if (details) scales(c, path, { r, hx, hy, seen, pointSpacing, scale });
  if (details) {
    const stamp=stampFor(skin), gap=Math.max(3,Math.round(r * (skin.pattern==='ribbon' ? 1.4 : 2) / pointSpacing));
    for (let i=3;i<path.length-2;i++) {
      const p=path[i];
      // Cada estampa nasce num ponto da carne e fica ali até a cauda passar.
      if ((((p.n ?? i) % gap) + gap) % gap !== 0) continue;
      const next=path[i+1]; if (!seen(p,p)) continue;
      c.save(); c.translate(p.x,p.y); c.rotate(Math.atan2(p.y-next.y,p.x-next.x));
      c.drawImage(stamp,-r*1.2,-r*1.2,r*2.4,r*2.4); c.restore();
    }
  }
  if (aceso && snake.boost) rastro(c, path, { r, hx, hy, seen, cor: skin.detail });
  // Reflexo dorsal em um traço só, para o corpo ter volume sem borrar a borda.
  c.strokeStyle='#ffffff24'; c.lineWidth=Math.max(1,r*.3); c.beginPath();
  let a={x:hx,y:hy}, pen=false;
  for (let i=1;i<path.length;i++) {
    const b=path[i];
    if (seen(a,b)) { if (!pen) c.moveTo(a.x,a.y-r*.38); c.lineTo(b.x,b.y-r*.38); pen=true; } else pen=false;
    a=b;
  }
  c.stroke();
  if (seen({x:hx,y:hy},{x:hx,y:hy},r*3)) {
    c.save(); c.translate(hx,hy); c.rotate(snake.angle);
    const shine=c.createLinearGradient(0,-r,0,r);
    shine.addColorStop(0,skin.detail); shine.addColorStop(.33,colors[0]); shine.addColorStop(1,colors[1]);
    c.fillStyle=shine; c.beginPath(); c.ellipse(0,0,r*1.17,r,0,0,TAU); c.fill();
    if (skin.pattern==='circuit' || skin.pattern==='pixels') {
      c.fillStyle='#071e2a'; c.fillRect(-r*.05,-r*.8,r*.82,r*1.6);
      c.fillStyle=skin.detail; c.fillRect(r*.28,-r*.6,r*.3,r*.36); c.fillRect(r*.28,r*.24,r*.3,r*.36);
    } else for (const side of [-1,1]) {
      c.fillStyle='#ffffff'; c.beginPath(); c.ellipse(r*.32,side*r*.52,r*.4,r*.37,0,0,TAU); c.fill();
      c.fillStyle='#13233b'; c.beginPath(); c.arc(r*.48,side*r*.52,r*.21,0,TAU); c.fill();
      c.fillStyle='#ffffff'; c.beginPath(); c.arc(r*.52,side*r*.52-r*.08,r*.065,0,TAU); c.fill();
    }
    if (snake.invulnerable>0) {
      c.strokeStyle=skin.detail; c.lineWidth=1.6; c.setLineDash([5,5]);
      c.beginPath(); c.arc(0,0,r+7,0,TAU); c.stroke();
    }
    c.restore();
  }
  c.restore();
}

export function drawSkinPreview(canvas, id, time = 0) {
  const c=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  c.clearRect(0,0,w,h); c.save(); c.scale(w/360,h/160);
  const skin=skinFor(id), halo=c.createRadialGradient(180,90,4,180,90,175);
  halo.addColorStop(0,skin.colors[0]+'22'); halo.addColorStop(1,skin.colors[0]+'00');
  c.fillStyle=halo; c.fillRect(0,0,360,160);
  const path=[];
  for (let i=0;i<=66;i++) {
    const t=i/66, x=304-t*249, y=80+Math.sin(t*TAU*1.04+time*.65)*30;
    path.push({x,y,n:-i});
  }
  const head=path[0], next=path[1];
  drawSnake(c,{...head,px:head.x,py:head.y,path,skin:id,angle:Math.atan2(head.y-next.y,head.x-next.x)}, {radius:14,pointSpacing:5});
  c.restore();
}
