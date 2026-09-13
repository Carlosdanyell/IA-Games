import { createSpriteCache } from '../../core/sprites.js';
import { FIELD, ARROW, FIGURE } from './config.js';

// Identidade da biblioteca aplicada ao tiro ao alvo: fundo escuro, horizonte e
// chão na cor de destaque, figuras em silhueta com contorno neon. O sangue tem
// vermelho próprio, fora da paleta — se acompanhasse o tema, viraria decoração.
const APPLE = { skin: '#7fe06a', shade: '#3f8f34', stem: '#8a5a33', glow: '#a8ff8f' };

export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const sprites = createSpriteCache();
  const ctx = () => view.ctx;

  // O cenário não muda durante a fase: desenhado uma vez e copiado por quadro.
  function background() {
    const key = `cena|${theme.mode}|${theme.tokens.accent}|${view.w}x${view.h}`;
    return sprites.get(key, view.w, view.h, c => {
      const dark = theme.dark;
      const accent = theme.tokens.accent;
      const groundY = Math.round(view.h * FIELD.groundRatio);

      const sky = c.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, dark ? '#0b0716' : '#f4f0fb');
      sky.addColorStop(1, dark ? '#150d24' : '#e9e2f6');
      c.fillStyle = sky;
      c.fillRect(0, 0, view.w, groundY);

      // Sol/lua baixo no horizonte, só para dar profundidade ao fundo.
      const glow = c.createRadialGradient(view.w * 0.74, groundY - 6, 4, view.w * 0.74, groundY - 6, view.h * 0.55);
      glow.addColorStop(0, accent + (dark ? '30' : '22'));
      glow.addColorStop(1, accent + '00');
      c.fillStyle = glow;
      c.fillRect(0, 0, view.w, groundY);

      // Morros distantes: duas cristas em alturas diferentes.
      for (const [amp, off, alpha, step] of [[0.11, 0.5, dark ? 0.18 : 0.1, 47], [0.07, 0.2, dark ? 0.3 : 0.16, 31]]) {
        c.beginPath();
        c.moveTo(0, groundY);
        for (let x = 0; x <= view.w; x += 8) {
          const t = x / view.w;
          const y = groundY - (Math.sin(t * 6.3 + off) * 0.5 + 0.5) * view.h * amp -
                    Math.sin(x / step) * 3 - view.h * 0.02;
          c.lineTo(x, y);
        }
        c.lineTo(view.w, groundY);
        c.closePath();
        c.fillStyle = accent + (dark ? '22' : '18');
        c.globalAlpha = alpha * 3;
        c.fill();
        c.globalAlpha = 1;
      }

      // Chão
      c.fillStyle = dark ? '#0a0612' : '#ddd4ee';
      c.fillRect(0, groundY, view.w, view.h - groundY);
      c.strokeStyle = accent + (dark ? '99' : 'aa');
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, groundY + 1);
      c.lineTo(view.w, groundY + 1);
      c.stroke();
      c.strokeStyle = accent + (dark ? '22' : '2a');
      c.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const y = groundY + i * ((view.h - groundY) / 5);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(view.w, y);
        c.stroke();
      }
    });
  }

  function marks(scene, phase) {
    const c = ctx();
    c.save();
    c.strokeStyle = theme.tokens.accent + '3a';
    c.fillStyle = theme.tokens.accent + '77';
    c.font = '600 9px ui-monospace, monospace';
    c.textAlign = 'center';
    c.lineWidth = 1;
    const stepM = phase.distance > 34 ? 10 : 5;
    for (let m = stepM; m < phase.distance; m += stepM) {
      const x = scene.x0 + m * scene.u;
      c.beginPath();
      c.moveTo(x, scene.groundY + 2);
      c.lineTo(x, scene.groundY + 9);
      c.stroke();
      c.fillText(`${m}m`, x, scene.groundY + 19);
    }
    c.restore();
  }

  // Bandeira do vento: direção e tamanho acompanham a força, para a informação
  // existir na cena e não só no placar.
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

  function figureBody(c, x, y, scale, ink, outline, lean = 0, arms = 'down', aimAngle = 0) {
    const h = FIGURE.height * scale;
    const torso = FIGURE.torsoR * scale;
    const limb = FIGURE.limbR * scale;
    c.save();
    c.translate(x, y);
    c.rotate(lean);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = ink;
    c.fillStyle = ink;

    // Pernas
    c.lineWidth = limb * 2.1;
    c.beginPath();
    c.moveTo(-0.07 * h, 0); c.lineTo(-0.03 * h, -0.42 * h);
    c.moveTo(0.07 * h, 0); c.lineTo(0.03 * h, -0.42 * h);
    c.stroke();

    // Braços: caídos no alvo, um estendido ao arco e outro puxando a corda no
    // arqueiro. É o que faz a silhueta ler como alguém mirando.
    const shoulder = -0.72 * h;
    c.lineWidth = limb * 1.8;
    c.beginPath();
    if (arms === 'bow') {
      const reach = 0.3 * h;
      c.moveTo(0, shoulder);
      c.lineTo(Math.cos(-aimAngle) * reach, shoulder + Math.sin(-aimAngle) * reach);
      c.moveTo(0, shoulder);
      c.lineTo(-0.13 * h, shoulder + 0.1 * h);
    } else {
      c.moveTo(-0.02 * h, shoulder); c.lineTo(-0.1 * h, -0.4 * h);
      c.moveTo(0.02 * h, shoulder); c.lineTo(0.1 * h, -0.4 * h);
    }
    c.stroke();

    // Tronco
    c.lineWidth = torso * 2;
    c.beginPath();
    c.moveTo(0, -0.42 * h);
    c.lineTo(0, -0.75 * h);
    c.stroke();

    // Cabeça
    const headR = FIGURE.headR * scale;
    const headCy = -0.75 * h - 0.04 * h - headR;
    c.beginPath();
    c.arc(0, headCy, headR, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = outline;
    c.lineWidth = Math.max(0.8, 1.1 * scale);
    c.beginPath();
    c.arc(0, headCy, headR, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    return { h, headCy: y + headCy, headR };
  }

  function apple(c, body, hit, clock) {
    if (hit) return;
    const { x, y, r } = body.apple;
    c.save();
    c.shadowColor = APPLE.glow;
    c.shadowBlur = 8;
    c.fillStyle = APPLE.skin;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = APPLE.shade;
    c.beginPath();
    c.arc(x + r * 0.3, y + r * 0.15, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = APPLE.stem;
    c.lineWidth = Math.max(0.8, r * 0.22);
    c.beginPath();
    c.moveTo(x, y - r * 0.9);
    c.lineTo(x + r * 0.35, y - r * 1.7);
    c.stroke();
    c.restore();
  }

  function drawArrow(c, a, scale, accent) {
    const len = ARROW.len * Math.max(0.7, scale);
    const angle = a.angle ?? Math.atan2(a.vy, a.vx);
    c.save();
    c.translate(a.x, a.y);
    c.rotate(angle);
    c.lineCap = 'round';
    c.strokeStyle = a.bloodied ? '#c4102b' : accent;
    c.lineWidth = Math.max(1.2, 1.6 * scale);
    c.beginPath();
    c.moveTo(-len, 0);
    c.lineTo(0, 0);
    c.stroke();
    // Ponta: maior de propósito. Com a cabeça pequena, as penas na outra
    // extremidade viravam a leitura da flecha e ela parecia apontar ao contrário.
    c.fillStyle = a.bloodied ? '#e7213f' : accent;
    c.beginPath();
    c.moveTo(len * 0.16, 0);
    c.lineTo(-len * 0.16, -len * 0.15);
    c.lineTo(-len * 0.08, 0);
    c.lineTo(-len * 0.16, len * 0.15);
    c.closePath();
    c.fill();
    // Penas: dois traços inclinados para trás, junto ao encaixe.
    c.lineWidth = Math.max(0.9, 1.1 * scale);
    c.beginPath();
    c.moveTo(-len, -len * 0.1); c.lineTo(-len * 0.74, 0);
    c.moveTo(-len, len * 0.1); c.lineTo(-len * 0.74, 0);
    c.stroke();
    c.restore();
  }

  function bow(c, x, y, scale, aim, accent) {
    const h = FIGURE.height * scale;
    const handY = y - 0.72 * h;   // altura do ombro, igual à do braço
    const r = 13 * scale + 4;
    const pull = (aim.pulling ? aim.power : Math.min(0.25, aim.power)) * r * 0.75;
    c.save();
    c.translate(x + Math.cos(-aim.angle) * 0.3 * h, handY + Math.sin(-aim.angle) * 0.3 * h);
    c.rotate(-aim.angle);
    c.strokeStyle = accent;
    c.lineWidth = Math.max(1.2, 1.8 * scale);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, r, -1.25, 1.25);
    c.stroke();
    const tipY = Math.sin(1.25) * r, tipX = Math.cos(1.25) * r;
    c.lineWidth = Math.max(0.7, 1 * scale);
    c.strokeStyle = accent + 'cc';
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
    c.strokeStyle = accent + '66';
    c.lineWidth = 1.4;
    c.setLineDash([3, 6]);
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (const p of points) c.lineTo(p.x, p.y);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = accent + '88';
    const last = points[points.length - 1];
    c.beginPath();
    c.arc(last.x, last.y, 2.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function banner(c, text, tone) {
    if (!text) return;
    c.save();
    c.textAlign = 'center';
    c.font = `800 ${Math.round(view.h * 0.055)}px system-ui, sans-serif`;
    c.fillStyle = tone === 'bad' ? '#ff5f6d' : theme.tokens.accent;
    c.shadowColor = tone === 'bad' ? '#ff5f6d88' : theme.tokens.accent + '88';
    c.shadowBlur = 14;
    c.fillText(text, view.w / 2, view.h * 0.19);
    c.restore();
  }

  return {
    invalidate() { sprites.clear(); },

    draw(s) {
      const c = ctx();
      const accent = theme.tokens.accent;
      viewport.begin();
      debug.frame();

      c.save();
      if (s.shake > 0) {
        c.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }
      c.drawImage(background(), 0, 0);
      marks(s.scene, s.phase);
      flag(s.scene, s.wind, s.clock);
      s.blood.drawDecals(c);

      const ink = theme.dark ? '#d9d2e8' : '#2a2138';
      const outline = accent + 'cc';

      // Alvo
      figureBody(c, s.target.x, s.target.y, s.scene.scale, s.wounded ? '#b9a9ae' : ink, outline,
                 s.wounded ? s.woundLean : 0, 'down');
      if (!s.wounded) apple(c, s.body, s.appleHit, s.clock);
      for (const a of s.stuck) drawArrow(c, a, s.scene.scale, accent);

      // Arqueiro
      figureBody(c, s.archer.x, s.archer.y, s.scene.scale, ink, outline, 0, 'bow', s.aim.angle);
      bow(c, s.archer.x, s.archer.y, s.scene.scale, s.aim, accent);

      if (s.guide) guide(c, s.guide, accent);
      if (s.arrow) drawArrow(c, s.arrow, s.scene.scale, accent);
      s.blood.drawDrops(c);

      if (s.flash > 0) {
        c.save();
        c.globalAlpha = Math.min(0.5, s.flash);
        c.fillStyle = s.flashTone === 'bad' ? '#ff2d4a' : accent;
        c.fillRect(0, 0, view.w, view.h);
        c.restore();
      }
      banner(c, s.banner, s.bannerTone);
      c.restore();

      if (debug.active) {
        for (const p of s.body.parts) debug.circle(p.x, p.y, p.r, '#ff5f6d');
        debug.circle(s.body.appleHit.x, s.body.appleHit.y, s.body.appleHit.r, '#00ff9d');
        debug.info(`dist ${s.phase.distance}m  u/m ${s.scene.u.toFixed(2)}  escala ${s.scene.scale.toFixed(2)}`);
        debug.info(`vento ${s.wind.toFixed(2)}  sangue ${s.blood.count}`);
        debug.render(c, view, s.stats || {});
      }
    }
  };
}
