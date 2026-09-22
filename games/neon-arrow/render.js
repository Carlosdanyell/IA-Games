import { createSpriteCache } from '../../core/sprites.js';
import { createRng } from '../../core/rng.js';
import { FIELD, ARROW, FIGURE, BONUS } from './config.js';

import { drawCharacter, drawLimb } from './characters.js';

// Identidade da biblioteca aplicada ao tiro ao alvo: fundo escuro, horizonte e
// chão na cor de destaque, personagens articulados. O sangue e a maçã têm cor
// própria, fora da paleta — se acompanhassem o tema, deixariam de ser lidos
// como sangue e como maçã.
const APPLE = { skin: '#7fe06a', shade: '#3f8f34', stem: '#8a5a33', glow: '#a8ff8f', flesh: '#eaffd9' };

export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const sprites = createSpriteCache();
  const ctx = () => view.ctx;

  const rounded = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  // Camadas estáticas em cache; apenas plataformas e mira mudam por quadro.
  const groundY = () => Math.round(view.h * FIELD.groundRatio);

  function skySprite() {
    return sprites.get(`sky|${theme.mode}|${theme.tokens.accent}|${view.h}`,view.w,view.h,c=>{
      const gy=groundY(),dark=theme.dark;
      const sky=c.createLinearGradient(0,0,0,gy);
      sky.addColorStop(0,dark?'#081524':'#c5deec');
      sky.addColorStop(.6,dark?'#173a50':'#e0e7e5');
      sky.addColorStop(1,dark?'#6b6664':'#eacbb1');
      c.fillStyle=sky;c.fillRect(0,0,view.w,view.h);
      const glow=c.createRadialGradient(view.w*.68,gy*.68,1,view.w*.68,gy*.68,gy*.9);
      glow.addColorStop(0,dark?'#ecaa7940':'#fff6da88');glow.addColorStop(1,'#ecaa7900');
      c.fillStyle=glow;c.fillRect(0,0,view.w,gy);
      const rng=createRng(1704);
      for(let i=0;i<58;i++) {
        c.fillStyle=dark?'#d2efff':'#ffffff';c.globalAlpha=.15+rng.next()*.35;
        c.fillRect(rng.next()*view.w,rng.next()*gy*.65,.45+rng.next()*.5,.8);
      }
      c.globalAlpha=1;
      const x=view.w*.77,y=gy*.27,r=18;
      c.fillStyle=dark?'#e2d8bd':'#fff7df';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
      c.fillStyle=dark?'#bbc7ba55':'#e6cfa555';c.beginPath();c.arc(x+6,y-4,8,0,Math.PI*2);c.fill();
      c.strokeStyle=dark?'#f2dbb333':'#788eaa44';c.lineWidth=.5;
      c.beginPath();c.ellipse(x,y,r*2.1,r*.52,-.32,0,Math.PI*2);c.stroke();
      // Filetes de nuvens étirados no horizonte.
      for(let i=0;i<7;i++) {
        c.fillStyle=dark?'#acd5d008':'#ffffff26';
        c.fillRect(rng.next()*view.w,gy*(.35+rng.next()*.4),50+rng.next()*170,1+rng.next()*2);
      }
    });
  }

  function skylineSprite() {
    const w=view.w*1.6;
    return sprites.get(`city|${theme.mode}|${view.h}`,w,view.h,c=>{
      const gy=groundY(),dark=theme.dark,rng=createRng(8407);
      // Montes distantes e uma cidade baixa atrás do campo.
      for(let layer=0;layer<2;layer++) {
        c.fillStyle=dark?(layer?'#244453':'#48606a'):(layer?'#93a9ad':'#a8b7b4');
        c.beginPath();c.moveTo(0,gy);
        for(let x=0;x<=w+40;x+=40)c.lineTo(x,gy-24-rng.next()*(layer?28:54));
        c.lineTo(w,gy);c.closePath();c.fill();
      }
      for(let x=0;x<w;x+=11+rng.next()*16) {
        const bw=7+rng.next()*15,bh=8+rng.next()*34;
        c.fillStyle=dark?'#1b3545':'#829ba6';c.fillRect(x,gy-bh-7,bw,bh);
        c.fillStyle=dark?'#d2c29b55':'#ebead955';
        for(let y=gy-bh;y<gy-12;y+=7) for(let xx=x+3;xx<x+bw-2;xx+=5)
          if(rng.next()>.55)c.fillRect(xx,y,1.3,1.6);
        if(bh>34){c.fillStyle='#73c3c099';c.fillRect(x+bw*.6,gy-bh-15,.8,8);}
      }
    });
  }

  function deckSprite() {
    return sprites.get(`deck|${theme.mode}|${theme.tokens.accent}|${view.h}`,view.w,view.h,c=>{
      const gy=groundY(),dark=theme.dark,accent=theme.tokens.accent;
      // Grade de proteção atrás dos atletas, sem cobrir a linha de tiro.
      c.strokeStyle=dark?'#75b1b42c':'#33566738';c.lineWidth=.7;
      for(let x=0;x<view.w;x+=32){c.beginPath();c.moveTo(x,gy-20);c.lineTo(x,gy);c.stroke();}
      c.beginPath();c.moveTo(0,gy-20);c.lineTo(view.w,gy-20);c.stroke();
      const fill=c.createLinearGradient(0,gy,0,view.h);
      fill.addColorStop(0,dark?'#233c4a':'#c0d1d7');fill.addColorStop(.22,dark?'#152b39':'#aebfc6');fill.addColorStop(1,dark?'#081521':'#93a8b5');
      c.fillStyle=fill;c.fillRect(0,gy,view.w,view.h-gy);
      c.fillStyle=accent;c.globalAlpha=.65;c.fillRect(0,gy,view.w,1);c.globalAlpha=1;
      c.strokeStyle=dark?'#7999b029':'#56718544';c.lineWidth=.7;
      for(let x=-100;x<view.w+100;x+=65){c.beginPath();c.moveTo(x,gy+2);c.lineTo(x+(x-view.w/2)*.3,view.h);c.stroke();}
      c.fillStyle=dark?'#07131dbb':'#7895a377';c.fillRect(0,gy+24,view.w,2);
      for(let x=12;x<view.w;x+=42){c.fillStyle=dark?'#92c3c24d':'#47687888';c.fillRect(x,gy+28,2,1);}
      for(const x of [12,view.w-16]) {
        c.fillStyle=dark?'#243c48':'#8dabb6';c.fillRect(x,gy-49,4,49);
        c.fillStyle=accent;c.fillRect(x+1,gy-46,2,19);
        c.fillStyle=dark?'#ccd9d7':'#344f5f';c.fillRect(x-2,gy-50,8,3);
      }
    });
  }

  function scenery(s) {
    const c=ctx();c.drawImage(skySprite(),0,0);
    c.drawImage(skylineSprite(),-s.shift*.45,0);c.drawImage(deckSprite(),0,0);
    for(const p of [{x:s.scene.x0,y:s.scene.groundY},s.target]) {
      c.fillStyle=theme.dark?'#06111c55':'#34495833';c.beginPath();c.ellipse(p.x,s.scene.groundY+4,21*s.scene.scale,4,0,0,Math.PI*2);c.fill();
      if(p.y<s.scene.groundY-1) {
        c.fillStyle=theme.dark?'#263e4c':'#8aabb9';c.fillRect(p.x-3,p.y+4,6,s.scene.groundY-p.y-4);
        c.strokeStyle=theme.tokens.accent+'88';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y+5);c.lineTo(p.x,s.scene.groundY);c.stroke();
      }
      const w=22*s.scene.scale;
      c.fillStyle=theme.dark?'#344e5b':'#d0dce0';rounded(c,p.x-w,p.y,w*2,5,2);c.fill();
      c.fillStyle=theme.tokens.accent+'aa';c.fillRect(p.x-w*.76,p.y+1,w*1.52,1);
    }
    c.fillStyle=theme.dark?'#c3d5dcaa':'#315361';c.font='600 8px ui-monospace,monospace';
    c.textAlign='left';c.fillText('CAMPO DE PRECISÃO',23,24);
    c.fillStyle=theme.tokens.accent;c.fillRect(23,30,22,1.5);
    c.textAlign='right';c.fillText(`${s.distance.toFixed(0)} m  /  ${s.phase.name.toUpperCase()}`,view.w-23,24);
  }

  function instruments(c,s) {
    if(s.state==='intro') return;
    const y=view.h-18,x=view.w/2-88,dark=theme.dark,accent=theme.tokens.accent;
    c.save();c.fillStyle=dark?'#09202dd9':'#e3edefe8';rounded(c,x-12,y-12,200,25,5);c.fill();
    c.fillStyle=dark?'#bcd2dc':'#375366';c.font='600 8px ui-monospace,monospace';c.textAlign='left';
    c.fillText('FORÇA',x,y-1);c.fillStyle=accent;c.fillText(`${Math.round(s.aim.power*100)}%`,x+36,y-1);
    c.fillStyle=dark?'#466073':'#adc1ce';rounded(c,x+66,y-6,62,4,2);c.fill();
    c.fillStyle=accent;rounded(c,x+66,y-6,Math.max(1,62*s.aim.power),4,2);c.fill();
    c.fillStyle=dark?'#d7e7e8':'#375366';c.fillText(`${Math.round(s.aim.angle*180/Math.PI)}°`,x+143,y-1);
    c.restore();
    if(s.showApple && !s.wounded) {
      const a=s.body.apple,r=a.r+4;
      c.save();c.strokeStyle=accent+'bb';c.lineWidth=.6;
      for(const side of [-1,1]){c.beginPath();c.moveTo(a.x+side*(r+2),a.y-r*.5);c.lineTo(a.x+side*(r+2),a.y+r*.5);c.stroke();}
      c.restore();
    }
  }

  function marks(scene, distance) {
    const c = ctx();
    c.save();
    c.strokeStyle = theme.tokens.accent + '3a';
    c.fillStyle = theme.tokens.accent + '77';
    c.font = '600 9px ui-monospace, monospace';
    c.textAlign = 'center';
    c.lineWidth = 1;
    const stepM = distance > 34 ? 10 : 5;
    for (let m = stepM; m < distance; m += stepM) {
      const x = scene.x0 + m * scene.u;
      c.beginPath();
      c.moveTo(x, scene.groundY + 2);
      c.lineTo(x, scene.groundY + 9);
      c.stroke();
      c.fillText(`${m}m`, x, scene.groundY + 19);
    }
    c.restore();
  }

  function flag(scene, wind, clock) {
    const c = ctx();
    const x = scene.x0 + (scene.x1 - scene.x0) * 0.62;
    const base = scene.groundY;
    const h = 34 * scene.scale + 12;
    c.save();
    c.strokeStyle = theme.tokens.accent + 'aa';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - h);
    c.stroke();
    const power = Math.min(1, Math.abs(wind) / 7);
    const dir = wind === 0 ? 0 : Math.sign(wind);
    const len = (8 + power * 22) * (dir || 1);
    const wave = Math.sin(clock * (3 + power * 6)) * 2.5 * power;
    c.beginPath();
    c.moveTo(x, base - h);
    c.quadraticCurveTo(x + len * 0.5, base - h + 3 + wave, x + len, base - h + 6);
    c.quadraticCurveTo(x + len * 0.5, base - h + 9 + wave, x, base - h + 12);
    c.closePath();
    c.fillStyle = wind === 0 ? theme.tokens.accent + '33' : theme.tokens.accent + 'cc';
    c.fill();
    c.restore();
  }

  // Lanterna de vida extra: papel translúcido, brasa dentro e um coração.
  function lantern(c, b, clock, accent) {
    const R = b.r;
    c.save();
    c.translate(b.x, b.y);
    const glow = c.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 3);
    glow.addColorStop(0, '#ffb85c55');
    glow.addColorStop(1, '#ffb85c00');
    c.fillStyle = glow;
    c.fillRect(-R * 3, -R * 3, R * 6, R * 6);

    c.strokeStyle = theme.dark ? '#5e4a33' : '#6b5a3e';
    c.lineWidth = Math.max(0.7, R * 0.1);
    c.beginPath();
    c.moveTo(0, -R * 3.4);
    c.lineTo(0, -R);
    c.stroke();

    c.fillStyle = '#ffd28a';
    c.beginPath();
    c.ellipse(0, 0, R * 0.82, R, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff9d3c';
    c.beginPath();
    c.ellipse(0, R * 0.22, R * 0.6, R * 0.62, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a5a33';
    c.lineWidth = Math.max(0.6, R * 0.12);
    c.beginPath();
    c.moveTo(-R * 0.8, -R * 0.85); c.lineTo(R * 0.8, -R * 0.85);
    c.moveTo(-R * 0.8, R * 0.85); c.lineTo(R * 0.8, R * 0.85);
    c.stroke();

    // Coração: diz o que a lanterna dá sem precisar de legenda.
    const hr = R * 0.38;
    c.fillStyle = '#ff4d63';
    c.beginPath();
    c.moveTo(0, hr * 0.9);
    c.bezierCurveTo(-hr * 1.6, -hr * 0.4, -hr * 0.5, -hr * 1.5, 0, -hr * 0.5);
    c.bezierCurveTo(hr * 0.5, -hr * 1.5, hr * 1.6, -hr * 0.4, 0, hr * 0.9);
    c.fill();
    c.restore();
  }

  function apple(c, body, clock) {
    const { x, y, r } = body.apple;
    c.save();
    c.translate(x, y + Math.sin(clock * 1.6) * r * 0.05);
    c.shadowColor = APPLE.glow;
    c.shadowBlur = 7;
    c.fillStyle = APPLE.skin;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = APPLE.shade;
    c.beginPath();
    c.arc(r * 0.3, r * 0.15, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.globalAlpha = 0.55;
    c.beginPath();
    c.ellipse(-r * 0.3, -r * 0.35, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = APPLE.stem;
    c.lineWidth = Math.max(0.8, r * 0.22);
    c.beginPath();
    c.moveTo(0, -r * 0.9);
    c.lineTo(r * 0.35, -r * 1.7);
    c.stroke();
    c.restore();
  }

  // Metades da maçã girando após o acerto.
  function appleBits(c, bits) {
    for (const b of bits) {
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot);
      c.fillStyle = APPLE.flesh;
      c.beginPath();
      c.arc(0, 0, b.r, Math.PI / 2, Math.PI * 1.5);
      c.closePath();
      c.fill();
      c.fillStyle = APPLE.skin;
      c.beginPath();
      c.arc(0, 0, b.r, Math.PI / 2, Math.PI * 1.5);
      c.lineTo(0, -b.r);
      c.closePath();
      c.globalAlpha = 0.9;
      c.fill();
      c.globalAlpha = 1;
      c.restore();
    }
  }

  function drawArrow(c, a, scale, accent) {
    const len = ARROW.len * Math.max(0.7, scale);
    const angle = a.angle ?? Math.atan2(a.vy, a.vx);
    c.save();
    c.translate(a.x, a.y);
    c.rotate(angle);
    c.lineCap = 'round';
    c.strokeStyle = a.bloodied ? '#c4102b' : (theme.dark ? '#d9e9ea' : '#344f60');
    c.lineWidth = Math.max(1.2, 1.6 * scale);
    c.beginPath();
    c.moveTo(-len, 0);
    c.lineTo(0, 0);
    c.stroke();
    c.fillStyle = a.bloodied ? '#e7213f' : accent;
    c.beginPath();
    c.moveTo(len * 0.16, 0);
    c.lineTo(-len * 0.16, -len * 0.15);
    c.lineTo(-len * 0.08, 0);
    c.lineTo(-len * 0.16, len * 0.15);
    c.closePath();
    c.fill();
    c.strokeStyle = accent;
    c.lineWidth = Math.max(0.9, 1.1 * scale);
    c.beginPath();
    c.moveTo(-len, -len * 0.1); c.lineTo(-len * 0.74, 0);
    c.moveTo(-len, len * 0.1); c.lineTo(-len * 0.74, 0);
    c.stroke();
    c.restore();
  }

  function bow(c, x, y, scale, aim, accent) {
    const h = FIGURE.height * scale;
    const handY = y - 0.72 * h;
    const r = 13 * scale + 4;
    const pull = (aim.pulling ? aim.power : Math.min(0.25, aim.power)) * r * 0.75;
    c.save();
    c.translate(x + Math.cos(-aim.angle) * 0.3 * h, handY + Math.sin(-aim.angle) * 0.3 * h);
    c.rotate(-aim.angle);
    c.strokeStyle = theme.dark ? '#708e9e' : '#314c60';
    c.lineWidth = Math.max(2, 3 * scale);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, r, -1.25, 1.25);
    c.stroke();
    const tipY = Math.sin(1.25) * r, tipX = Math.cos(1.25) * r;
    c.strokeStyle=accent;c.lineWidth=scale;
    c.beginPath();c.arc(0,0,r,-.8,.8);c.stroke();
    for(const y of [-tipY,tipY]) {
      c.fillStyle='#122938';c.beginPath();c.arc(tipX,y,2.7*scale,0,Math.PI*2);c.fill();
      c.strokeStyle=accent;c.lineWidth=.7*scale;c.stroke();
    }
    c.lineWidth = Math.max(0.7, 0.9 * scale);
    c.strokeStyle = theme.dark ? '#efe7d6' : '#4b3f2c';
    c.beginPath();
    c.moveTo(tipX, -tipY);
    c.lineTo(-pull, 0);
    c.lineTo(tipX, tipY);
    c.stroke();
    if (aim.ready) drawArrow(c, { x: r * 0.55 - pull, y: 0, angle: 0 }, scale, accent);
    c.restore();
  }

  function guide(c, points, accent) {
    if (!points || points.length < 2) return;
    c.save();
    c.lineWidth = 1.4;
    c.setLineDash([3, 6]);
    c.strokeStyle = accent + '66';
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (const p of points) c.lineTo(p.x, p.y);
    c.stroke();
    c.setLineDash([]);
    // Ponta esmaecida: deixa claro que a linha acaba ali por escolha do jogo.
    const last = points[points.length - 1];
    const fade = c.createRadialGradient(last.x, last.y, 0, last.x, last.y, 9);
    fade.addColorStop(0, accent + '88');
    fade.addColorStop(1, accent + '00');
    c.fillStyle = fade;
    c.beginPath();
    c.arc(last.x, last.y, 9, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function banner(c, text, tone) {
    if (!text) return;
    c.save();
    c.textAlign = 'center';
    c.font = `750 ${Math.round(view.h * 0.046)}px system-ui, sans-serif`;
    c.fillStyle = tone === 'bad' ? '#ff5f6d' : theme.tokens.accent;
    c.shadowColor = tone === 'bad' ? '#ff5f6d88' : theme.tokens.accent + '88';
    c.shadowBlur = 14;
    c.fillText(text, view.w / 2, view.h * 0.22);
    c.restore();
  }

  function drawRotate() {
    const c = ctx();
    const w = view.cssW / view.scale, h = view.cssH / view.scale;
    const ox = -view.ox / view.scale, oy = -view.oy / view.scale;
    c.save();
    c.fillStyle = theme.dark ? '#0d0915' : '#f4f1fa';
    c.fillRect(ox, oy, w, h);
    const accent = theme.tokens.accent;
    c.translate(ox + w / 2, oy + h / 2);
    // Desenha em pixels de CSS: em retrato a escala do campo é pequena e o
    // aviso sairia ilegível se acompanhasse as unidades lógicas.
    c.scale(1 / view.scale, 1 / view.scale);
    c.strokeStyle = accent;
    c.lineWidth = 4;
    c.lineJoin = 'round';
    rounded(c, -34, -56, 68, 112, 10);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 76, -Math.PI * 0.78, -Math.PI * 0.14);
    c.stroke();
    c.beginPath();
    c.moveTo(62, -30); c.lineTo(76, -14); c.lineTo(58, -6);
    c.stroke();
    c.fillStyle = theme.dark ? '#f6efff' : '#271c34';
    c.font = '800 20px system-ui,sans-serif';
    c.textAlign = 'center';
    c.fillText('Gire o aparelho', 0, 108);
    c.fillStyle = theme.dark ? '#b2a4c0' : '#625470';
    c.font = '500 13px system-ui,sans-serif';
    c.fillText('O campo de tiro só cabe deitado.', 0, 132);
    c.restore();
  }

  return {
    invalidate() { sprites.clear(); },
    drawRotate() { viewport.begin(); drawRotate(); },

    draw(s) {
      const c = ctx();
      const accent = theme.tokens.accent;
      viewport.begin();
      debug.frame();

      c.save();
      c.beginPath();c.rect(0,0,view.w,view.h);c.clip();
      if (s.shake > 0) c.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      scenery(s);
      marks(s.scene, s.distance);
      flag(s.scene, s.wind, s.clock);
      s.blood.drawDecals(c);
      if (s.bonus) lantern(c, s.bonus, s.clock, accent);

      const ink = theme.dark ? '#d9d2e8' : '#2a2138';

      // Alvo
      drawCharacter(c, {
        x: s.target.x, y: s.target.y, scale: s.scene.scale,
        ink: s.wounded ? '#b9a9ae' : ink,
        lean: s.lean, arms: s.targetArms, walk: s.walk,
        face: s.targetFace, facing: -1, blink: s.blink, missing: s.detached?.id, dark: theme.dark
      });
      if (s.detached) {
        c.save();c.translate(s.detached.x,s.detached.y);c.rotate(s.detached.angle);drawLimb(c,s.detached,{cut:true});c.restore();
      }
      if (s.showApple) apple(c, s.body, s.clock);
      if (s.bits.length) appleBits(c, s.bits);
      if (s.loose) {
        c.save();
        c.translate(s.loose.x, s.loose.y);
        c.rotate(s.loose.rot);
        apple(c, { apple: { x: 0, y: 0, r: s.loose.r } }, 0);
        c.restore();
      }
      for (const a of s.stuck) drawArrow(c, a, s.scene.scale, accent);

      // Arqueiro
      drawCharacter(c, {
        x: s.archer.x, y: s.archer.y, scale: s.scene.scale,
        ink, arms: 'bow', aimAngle: s.aim.angle, quiver: true,
        face: s.archerFace, facing: 1, blink: 0, role: 'archer', dark: theme.dark
      });
      bow(c, s.archer.x, s.archer.y, s.scene.scale, s.aim, accent);

      if (s.guide) guide(c, s.guide, accent);
      if (s.trail?.length > 1) {
        c.save();c.lineWidth=1.2;c.lineCap='round';
        s.trail.forEach((p,i)=>{if(!i)return;c.strokeStyle=accent;c.globalAlpha=i/s.trail.length*.35;
          c.beginPath();c.moveTo(s.trail[i-1].x,s.trail[i-1].y);c.lineTo(p.x,p.y);c.stroke();});
        c.restore();
      }
      if (s.arrow) drawArrow(c, s.arrow, s.scene.scale, accent);
      s.blood.drawDrops(c);

      if (s.flash > 0) {
        c.save();
        c.globalAlpha = Math.min(0.5, s.flash);
        c.fillStyle = s.flashTone === 'bad' ? '#ff2d4a' : accent;
        c.fillRect(0, 0, view.w, view.h);
        c.restore();
      }
      instruments(c,s);
      banner(c, s.banner, s.bannerTone);
      c.restore();

      if (debug.active) {
        const head=s.body.parts[0];debug.circle(head.x,head.y,head.r,'#ff5f6d');
        for (const b of s.body.bones) {
          c.save();c.strokeStyle='#ff5f6d55';c.lineWidth=b.r*2;c.lineCap='round';
          c.beginPath();c.moveTo(b.a.x,b.a.y);c.lineTo(b.b.x,b.b.y);c.stroke();c.restore();
        }
        debug.circle(s.body.appleHit.x, s.body.appleHit.y, s.body.appleHit.r, '#00ff9d');
        if (s.bonus) debug.circle(s.bonus.x, s.bonus.y, s.bonus.hitR, '#ffd166');
        debug.info(`dist ${s.distance.toFixed(1)}m  u/m ${s.scene.u.toFixed(2)}  escala ${s.scene.scale.toFixed(2)}`);
        debug.info(`vento ${s.wind.toFixed(2)}  sangue ${s.blood.count}  dif ${s.difficulty}`);
        debug.render(c, view, s.stats || {});
      }
    }
  };
}
