import { createSpriteCache } from '../../core/sprites.js';
import { createRng } from '../../core/rng.js';
import { FIELD, ARROW, FIGURE } from './config.js';

// Identidade da biblioteca aplicada ao tiro ao alvo: fundo escuro, horizonte e
// chão na cor de destaque, figuras em silhueta. O sangue e a maçã têm cor
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

  // ------------------------------------------------------------- cenário
  // Três camadas separadas para dar parallax na troca de fase: céu parado,
  // morros distantes deslizando devagar e arvoredo perto deslizando o dobro.
  const groundY = () => Math.round(view.h * FIELD.groundRatio);

  function skySprite() {
    const key = `ceu|${theme.mode}|${theme.tokens.accent}|${view.w}x${view.h}`;
    return sprites.get(key, view.w, view.h, c => {
      const dark = theme.dark;
      const accent = theme.tokens.accent;
      const gy = groundY();
      const sky = c.createLinearGradient(0, 0, 0, gy);
      sky.addColorStop(0, dark ? '#08060f' : '#f6f3fc');
      sky.addColorStop(0.62, dark ? '#120c1f' : '#ece6f7');
      sky.addColorStop(1, dark ? '#1b1230' : '#e2daf2');
      c.fillStyle = sky;
      c.fillRect(0, 0, view.w, gy);

      // Estrelas: posição fixa por semente, para não cintilarem de lugar.
      const rng = createRng(90210);
      c.fillStyle = dark ? '#ffffff' : '#8f83a8';
      for (let i = 0; i < 70; i++) {
        const x = rng.next() * view.w;
        const y = rng.next() * gy * 0.75;
        const r = rng.next() * 0.9 + 0.25;
        c.globalAlpha = (dark ? 0.5 : 0.25) * (0.3 + rng.next() * 0.7);
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // Lua baixa, com halo na cor de destaque.
      const mx = view.w * 0.78, my = gy * 0.24;
      const halo = c.createRadialGradient(mx, my, 4, mx, my, gy * 0.7);
      halo.addColorStop(0, accent + (dark ? '2e' : '20'));
      halo.addColorStop(1, accent + '00');
      c.fillStyle = halo;
      c.fillRect(0, 0, view.w, gy);
      c.fillStyle = dark ? '#e9e2f7' : '#fdfbff';
      c.beginPath();
      c.arc(mx, my, 13, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = dark ? '#120c1f' : '#ece6f7';
      c.beginPath();
      c.arc(mx + 5.5, my - 3.5, 12, 0, Math.PI * 2);
      c.fill();
    });
  }

  // Uma crista de morros, desenhada com largura extra para poder deslizar.
  function ridgeSprite(index, amp, seed, alpha) {
    const w = view.w * 1.6;
    const key = `morro${index}|${theme.mode}|${theme.tokens.accent}|${view.w}x${view.h}`;
    return sprites.get(key, w, view.h, c => {
      const gy = groundY();
      const rng = createRng(seed);
      const peaks = [];
      for (let i = 0; i <= 14; i++) peaks.push(0.35 + rng.next() * 0.65);
      c.beginPath();
      c.moveTo(0, gy);
      for (let x = 0; x <= w; x += 6) {
        const t = (x / w) * 14;
        const i = Math.floor(t);
        const f = t - i;
        const smooth = f * f * (3 - 2 * f);
        const hgt = peaks[i] * (1 - smooth) + peaks[Math.min(14, i + 1)] * smooth;
        c.lineTo(x, gy - hgt * view.h * amp);
      }
      c.lineTo(w, gy);
      c.closePath();
      c.fillStyle = theme.tokens.accent;
      c.globalAlpha = alpha;
      c.fill();
      c.globalAlpha = 1;
    });
  }

  // Arvoredo/pedras na linha do chão, também mais largo que a tela.
  function treeSprite() {
    const w = view.w * 1.6;
    const key = `mato|${theme.mode}|${theme.tokens.accent}|${view.w}x${view.h}`;
    return sprites.get(key, w, view.h, c => {
      const gy = groundY();
      const rng = createRng(4242);
      c.fillStyle = theme.dark ? '#0b0716' : '#c9bee0';
      c.strokeStyle = theme.dark ? '#0b0716' : '#c9bee0';
      c.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = rng.next() * w;
        const s = 8 + rng.next() * 16;
        if (rng.chance(0.55)) {                       // pinheiro
          c.beginPath();
          c.moveTo(x, gy);
          c.lineTo(x - s * 0.38, gy);
          c.lineTo(x, gy - s);
          c.lineTo(x + s * 0.38, gy);
          c.closePath();
          c.fill();
        } else if (rng.chance(0.6)) {                 // arbusto
          c.beginPath();
          c.arc(x, gy - s * 0.22, s * 0.3, Math.PI, 0);
          c.fill();
        } else {                                      // poste seco
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(x, gy);
          c.lineTo(x + 2, gy - s * 0.8);
          c.moveTo(x + 1, gy - s * 0.45);
          c.lineTo(x + 6, gy - s * 0.62);
          c.stroke();
        }
      }
    });
  }

  function groundSprite() {
    const key = `chao|${theme.mode}|${theme.tokens.accent}|${view.w}x${view.h}`;
    return sprites.get(key, view.w, view.h, c => {
      const dark = theme.dark;
      const accent = theme.tokens.accent;
      const gy = groundY();
      c.fillStyle = dark ? '#090512' : '#dcd2ee';
      c.fillRect(0, gy, view.w, view.h - gy);
      c.strokeStyle = accent + (dark ? 'aa' : 'bb');
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, gy + 1);
      c.lineTo(view.w, gy + 1);
      c.stroke();

      // Capim rente à linha do chão e cascalho espalhado: dá textura sem
      // competir com as figuras.
      const rng = createRng(7777);
      c.strokeStyle = accent + (dark ? '55' : '66');
      c.lineWidth = 1;
      for (let i = 0; i < 130; i++) {
        const x = rng.next() * view.w;
        const hgt = 2 + rng.next() * 5;
        c.beginPath();
        c.moveTo(x, gy);
        c.lineTo(x + (rng.next() * 2 - 1) * 2, gy - hgt);
        c.stroke();
      }
      c.fillStyle = accent + (dark ? '22' : '33');
      for (let i = 0; i < 60; i++) {
        const x = rng.next() * view.w;
        const y = gy + 6 + rng.next() * (view.h - gy - 8);
        c.beginPath();
        c.ellipse(x, y, 1 + rng.next() * 2.2, 0.7 + rng.next() * 1.2, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = accent + (dark ? '14' : '1e');
      for (let i = 1; i <= 4; i++) {
        const y = gy + i * ((view.h - gy) / 4);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(view.w, y);
        c.stroke();
      }
    });
  }

  function scenery(shift) {
    const c = ctx();
    c.drawImage(skySprite(), 0, 0);
    c.drawImage(ridgeSprite(1, 0.13, 1357, theme.dark ? 0.1 : 0.07), -shift * 0.35, 0);
    c.drawImage(ridgeSprite(2, 0.08, 9182, theme.dark ? 0.17 : 0.11), -shift * 0.7, 0);
    c.drawImage(treeSprite(), -shift, 0);
    c.drawImage(groundSprite(), 0, 0);
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

  // ------------------------------------------------------------- figuras
  // Silhueta com roupa, cinto, botas e mãos. Sem contorno na cabeça: o traço
  // de destaque em volta do rosto tirava a leitura de silhueta.
  function figure(c, opts) {
    const { x, y, scale, ink, lean = 0, arms = 'down', aimAngle = 0, walk = 0, quiver = false } = opts;
    const h = FIGURE.height * scale;
    const torso = FIGURE.torsoR * scale;
    const limb = FIGURE.limbR * scale;
    const headR = FIGURE.headR * scale;
    const shoulderY = -0.72 * h;
    const headCy = -0.75 * h - 0.04 * h - headR;
    const swing = Math.sin(walk) * 0.09 * h;

    c.save();
    c.translate(x, y);
    c.rotate(lean);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = ink;
    c.fillStyle = ink;

    // Pernas com passada e botas
    c.lineWidth = limb * 2.1;
    c.beginPath();
    c.moveTo(-0.07 * h, -0.02 * h); c.lineTo(-0.03 * h - swing, -0.42 * h);
    c.moveTo(0.07 * h, -0.02 * h); c.lineTo(0.03 * h + swing, -0.42 * h);
    c.stroke();
    c.lineWidth = limb * 2.6;
    c.beginPath();
    c.moveTo(-0.085 * h, 0); c.lineTo(-0.055 * h, 0);
    c.moveTo(0.055 * h, 0); c.lineTo(0.085 * h, 0);
    c.stroke();

    // Aljava nas costas do arqueiro, com flechas aparecendo
    if (quiver) {
      c.save();
      c.rotate(0.25);
      c.lineWidth = limb * 1.7;
      c.beginPath();
      c.moveTo(-0.02 * h, -0.48 * h); c.lineTo(-0.02 * h, -0.72 * h);
      c.stroke();
      c.lineWidth = Math.max(0.8, 0.9 * scale);
      for (const off of [-2.5, 0, 2.5]) {
        c.beginPath();
        c.moveTo(-0.02 * h + off * scale, -0.72 * h);
        c.lineTo(-0.02 * h + off * scale, -0.86 * h);
        c.stroke();
      }
      c.restore();
    }

    // Braços
    c.lineWidth = limb * 1.8;
    c.beginPath();
    if (arms === 'bow') {
      const reach = 0.3 * h;
      c.moveTo(0, shoulderY);
      c.lineTo(Math.cos(-aimAngle) * reach, shoulderY + Math.sin(-aimAngle) * reach);
      c.moveTo(0, shoulderY);
      c.lineTo(-0.14 * h, shoulderY + 0.11 * h);
    } else if (arms === 'up') {
      c.moveTo(-0.02 * h, shoulderY); c.lineTo(-0.16 * h, shoulderY - 0.1 * h);
      c.moveTo(0.02 * h, shoulderY); c.lineTo(0.16 * h, shoulderY - 0.1 * h);
    } else {
      c.moveTo(-0.02 * h, shoulderY); c.lineTo(-0.11 * h + swing * 0.5, -0.4 * h);
      c.moveTo(0.02 * h, shoulderY); c.lineTo(0.11 * h - swing * 0.5, -0.4 * h);
    }
    c.stroke();

    // Tronco, com camisa um pouco mais larga que o quadril
    c.lineWidth = torso * 2;
    c.beginPath();
    c.moveTo(0, -0.42 * h);
    c.lineTo(0, -0.75 * h);
    c.stroke();
    c.lineWidth = torso * 2.3;
    c.beginPath();
    c.moveTo(0, -0.58 * h);
    c.lineTo(0, -0.73 * h);
    c.stroke();

    // Cinto
    c.strokeStyle = theme.dark ? '#2b2436' : '#b7abc9';
    c.lineWidth = Math.max(1.1, 1.6 * scale);
    c.beginPath();
    c.moveTo(-torso, -0.44 * h);
    c.lineTo(torso, -0.44 * h);
    c.stroke();

    // Cabeça e cabelo
    c.fillStyle = ink;
    c.beginPath();
    c.arc(0, headCy, headR, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = theme.dark ? '#2b2436' : '#b7abc9';
    c.beginPath();
    c.arc(0, headCy - headR * 0.25, headR * 0.92, Math.PI * 1.02, Math.PI * 2.02);
    c.fill();
    c.restore();
    return { headCy: y + headCy, headR };
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
    c.strokeStyle = a.bloodied ? '#c4102b' : (theme.dark ? '#cdbfa6' : '#6b5a3e');
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
    c.strokeStyle = theme.dark ? '#cdbfa6' : '#6b5a3e';
    c.lineWidth = Math.max(1.4, 2 * scale);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, r, -1.25, 1.25);
    c.stroke();
    const tipY = Math.sin(1.25) * r, tipX = Math.cos(1.25) * r;
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
    c.font = `800 ${Math.round(view.h * 0.062)}px system-ui, sans-serif`;
    c.fillStyle = tone === 'bad' ? '#ff5f6d' : theme.tokens.accent;
    c.shadowColor = tone === 'bad' ? '#ff5f6d88' : theme.tokens.accent + '88';
    c.shadowBlur = 14;
    c.fillText(text, view.w / 2, view.h * 0.2);
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
      if (s.shake > 0) c.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      scenery(s.shift);
      marks(s.scene, s.distance);
      flag(s.scene, s.wind, s.clock);
      s.blood.drawDecals(c);

      const ink = theme.dark ? '#d9d2e8' : '#2a2138';

      // Alvo
      figure(c, {
        x: s.target.x, y: s.target.y, scale: s.scene.scale,
        ink: s.wounded ? '#b9a9ae' : ink,
        lean: s.lean, arms: s.targetArms, walk: s.walk
      });
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
      figure(c, {
        x: s.archer.x, y: s.archer.y, scale: s.scene.scale,
        ink, arms: 'bow', aimAngle: s.aim.angle, quiver: true
      });
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
        debug.info(`dist ${s.distance.toFixed(1)}m  u/m ${s.scene.u.toFixed(2)}  escala ${s.scene.scale.toFixed(2)}`);
        debug.info(`vento ${s.wind.toFixed(2)}  sangue ${s.blood.count}  dif ${s.difficulty}`);
        debug.render(c, view, s.stats || {});
      }
    }
  };
}
