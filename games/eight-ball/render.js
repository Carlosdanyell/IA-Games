import { createSpriteCache } from '../../core/sprites.js';
import { FIELD, TABLE, BALL, PANEL, POCKETS, BALL_COLORS } from './config.js';

// Identidade da biblioteca aplicada à sinuca: pano escuro como as arenas dos
// outros jogos, tabelas e marcações na cor de destaque, e as bolas mantendo a
// leitura clássica de lisa/listrada — sem isso não dá para jogar 8-ball.
export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const ctx = view.ctx;
  const sprites = createSpriteCache();
  let renderScale = 1;

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

  // A mesa não muda durante a partida: desenhada uma vez e copiada por frame.
  function tableSprite() {
    const key = `mesa|${theme.mode}|${theme.tokens.accent}|${renderScale}`;
    return sprites.get(key, FIELD.w * renderScale, FIELD.h * renderScale, c => {
      c.scale(renderScale, renderScale);
      const dark = theme.dark;
      const accent = theme.tokens.accent;
      const frame = dark ? '#241a36' : '#e6dff0';
      const felt = dark ? '#120c1e' : '#fbf8ff';

      // Moldura
      const frameW = TABLE.right + TABLE.rail - 8;
      c.fillStyle = frame;
      rounded(c, 4, 4, frameW, FIELD.tableH - 8, 20);
      c.fill();
      c.strokeStyle = accent + '55';
      c.lineWidth = 2;
      rounded(c, 5, 5, frameW - 2, FIELD.tableH - 10, 19);
      c.stroke();

      // Pano
      c.fillStyle = felt;
      c.fillRect(TABLE.left, TABLE.top, TABLE.width, TABLE.height);
      const glow = c.createRadialGradient(TABLE.midX, TABLE.centerY, 20, TABLE.midX, TABLE.centerY, 430);
      glow.addColorStop(0, accent + (dark ? '16' : '10'));
      glow.addColorStop(1, accent + '00');
      c.fillStyle = glow;
      c.fillRect(TABLE.left, TABLE.top, TABLE.width, TABLE.height);

      // Linha de saída e ponto do pé
      c.strokeStyle = accent + '40';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(TABLE.headX, TABLE.top); c.lineTo(TABLE.headX, TABLE.bottom);
      c.stroke();
      c.fillStyle = accent + '55';
      c.beginPath(); c.arc(TABLE.footX, TABLE.centerY, 2.5, 0, Math.PI * 2); c.fill();

      // Diamantes da tabela
      c.fillStyle = accent + '70';
      const diamond = (x, y) => {
        c.beginPath();
        c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y);
        c.closePath(); c.fill();
      };
      for (let i = 1; i <= 7; i++) {
        if (i === 4) continue;
        const x = TABLE.left + (TABLE.width / 8) * i;
        diamond(x, TABLE.top - 15); diamond(x, TABLE.bottom + 15);
      }
      for (let i = 1; i <= 3; i++) {
        const y = TABLE.top + (TABLE.height / 4) * i;
        diamond(TABLE.left - 15, y); diamond(TABLE.right + 15, y);
      }

      // Borda interna do pano
      c.strokeStyle = accent + '66';
      c.lineWidth = 2;
      c.strokeRect(TABLE.left, TABLE.top, TABLE.width, TABLE.height);

      // Caçapas
      for (const p of POCKETS) {
        c.fillStyle = dark ? '#05030a' : '#2b2338';
        c.beginPath(); c.arc(p.x, p.y, TABLE.pocketR, 0, Math.PI * 2); c.fill();
        c.strokeStyle = accent + 'aa';
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(p.x, p.y, TABLE.pocketR, 0, Math.PI * 2); c.stroke();
      }
    });
  }

  function ballSprite(number) {
    const key = `bola|${number}|${theme.mode}|${renderScale}`;
    const size = BALL.r * 2 + 6;
    return sprites.get(key, size * renderScale, size * renderScale, c => {
      c.scale(renderScale, renderScale);
      c.translate(size / 2, size / 2);
      const r = BALL.r;
      const solid = number === 0 ? '#f7f2ff' : BALL_COLORS[number > 8 ? number - 8 : number];
      const stripe = number > 8;

      c.fillStyle = stripe ? '#f4eeff' : solid;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();

      if (stripe) {
        c.save();
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
        c.fillStyle = solid;
        c.fillRect(-r, -r * 0.52, r * 2, r * 1.04);
        c.restore();
      }

      // Brilho e contorno dão volume sem custar desempenho.
      const shine = c.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
      shine.addColorStop(0, '#ffffff70');
      shine.addColorStop(0.5, '#ffffff10');
      shine.addColorStop(1, '#00000030');
      c.fillStyle = shine;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0006';
      c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();

      if (number > 0) {
        c.fillStyle = '#fdfaff';
        c.beginPath(); c.arc(0, 0, r * 0.56, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#20182c';
        c.font = `700 ${r * 0.82}px ui-monospace,monospace`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(number), 0, r * 0.06);
      }
    });
  }

  function drawBall(ball) {
    const size = BALL.r * 2 + 6;
    ctx.drawImage(ballSprite(ball.number), ball.x - size / 2, ball.y - size / 2, size, size);
  }

  function drawCue(state, aim) {
    const cue = state.balls[0];
    if (!cue.active) return;
    const back = 26 + aim.power * 58;
    const dx = Math.cos(aim.angle), dy = Math.sin(aim.angle);
    const x0 = cue.x - dx * back, y0 = cue.y - dy * back;
    const len = 290;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.dark ? '#d8c39a' : '#9a7b4f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - dx * len, y0 - dy * len);
    ctx.stroke();
    ctx.strokeStyle = theme.tokens.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0 - dx * len * 0.62, y0 - dy * len * 0.62);
    ctx.lineTo(x0 - dx * len, y0 - dy * len);
    ctx.stroke();
    ctx.strokeStyle = theme.dark ? '#2c2238' : '#4a3d5c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - dx * 9, y0 - dy * 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawGuide(state, aim, guide) {
    const cue = state.balls[0];
    const accent = theme.tokens.accent;
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = accent + 'aa';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(guide.x, guide.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bola fantasma: onde a branca encosta.
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(guide.x, guide.y, BALL.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // Para onde a bola alvo deve sair.
    if (guide.target) {
      ctx.strokeStyle = accent + '88';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(guide.target.x, guide.target.y);
      ctx.lineTo(guide.target.x + guide.target.dx * 92, guide.target.y + guide.target.dy * 92);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPanel(aim, canShoot, charging) {
    const accent = theme.tokens.accent;
    const dark = theme.dark;
    ctx.save();
    ctx.fillStyle = dark ? '#1a1226' : '#efe9f6';
    rounded(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
    ctx.fill();
    ctx.strokeStyle = accent + (charging ? 'cc' : '44');
    ctx.lineWidth = 2;
    rounded(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
    ctx.stroke();

    ctx.fillStyle = dark ? '#b2a4c0' : '#625470';
    ctx.font = '600 11px ui-monospace,monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('FORÇA', PANEL.x + PANEL.w / 2, PANEL.y + 12);

    const barX = PANEL.x + PANEL.w / 2 - 12;
    const barY = PANEL.y + 36;
    const barH = PANEL.h - 82;
    ctx.fillStyle = dark ? '#0d0915' : '#ffffff';
    rounded(ctx, barX, barY, 24, barH, 12);
    ctx.fill();
    ctx.strokeStyle = accent + '44';
    ctx.lineWidth = 1.5;
    rounded(ctx, barX, barY, 24, barH, 12);
    ctx.stroke();

    const fill = Math.max(0, Math.min(1, aim.power));
    if (fill > 0.01) {
      const h = barH * fill;
      const grad = ctx.createLinearGradient(0, barY + barH, 0, barY);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, theme.tokens.warn);
      ctx.fillStyle = grad;
      rounded(ctx, barX + 3, barY + barH - h + 3, 18, Math.max(6, h - 6), 9);
      ctx.fill();
    }

    ctx.fillStyle = canShoot ? accent : (dark ? '#493e58' : '#b7a9c8');
    ctx.font = '700 13px ui-monospace,monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${Math.round(fill * 100)}%`, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 26);
    ctx.fillStyle = dark ? '#7d6f8c' : '#8a7c98';
    ctx.font = '500 9px ui-monospace,monospace';
    ctx.fillText(charging ? 'SOLTE' : 'ARRASTE', PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 12);
    ctx.restore();
  }

  function drawRotate() {
    const w = view.cssW / view.scale, h = view.cssH / view.scale;
    const ox = -view.ox / view.scale, oy = -view.oy / view.scale;
    ctx.save();
    ctx.fillStyle = theme.dark ? '#0d0915' : '#f4f1fa';
    ctx.fillRect(ox, oy, w, h);
    const cx = ox + w / 2, cy = oy + h / 2;
    const accent = theme.tokens.accent;
    ctx.translate(cx, cy);
    // Desenha em pixels de CSS: em retrato a escala do campo é pequena e o
    // aviso sairia ilegível se acompanhasse as unidades lógicas.
    ctx.scale(1 / view.scale, 1 / view.scale);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    rounded(ctx, -34, -56, 68, 112, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 76, -Math.PI * 0.78, -Math.PI * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, -30); ctx.lineTo(76, -14); ctx.lineTo(58, -6);
    ctx.stroke();
    ctx.fillStyle = theme.dark ? '#f6efff' : '#271c34';
    ctx.font = '800 20px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gire o aparelho', 0, 108);
    ctx.fillStyle = theme.dark ? '#b2a4c0' : '#625470';
    ctx.font = '500 13px system-ui,sans-serif';
    ctx.fillText('A mesa de sinuca só cabe deitada.', 0, 132);
    ctx.restore();
  }

  function drawPotted(state) {
    const solids = state.balls.filter(b => !b.active && b.group === 'solid');
    const stripes = state.balls.filter(b => !b.active && b.group === 'stripe');
    const eight = state.balls.filter(b => !b.active && b.number === 8);
    const y = FIELD.tableH + (FIELD.h - FIELD.tableH) / 2;
    const size = 19;
    ctx.save();
    ctx.font = '600 10px ui-monospace,monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.dark ? '#7d6f8c' : '#8a7c98';
    ctx.textAlign = 'left';
    ctx.fillText('LISAS', TABLE.left, y);
    ctx.fillText('LISTRADAS', TABLE.midX, y);
    let x = TABLE.left + 42;
    for (const b of [...solids, ...eight.filter(() => false)]) {
      ctx.drawImage(ballSprite(b.number), x, y - size / 2, size, size);
      x += size + 2;
    }
    x = TABLE.midX + 66;
    for (const b of stripes) {
      ctx.drawImage(ballSprite(b.number), x, y - size / 2, size, size);
      x += size + 2;
    }
    if (eight.length) {
      ctx.drawImage(ballSprite(8), TABLE.right - size, y - size / 2, size, size);
    }
    ctx.restore();
  }

  function draw(state, opts) {
    const rs = Math.min(4, Math.max(1, Math.round(view.scale * view.dpr * 4) / 4));
    if (rs !== renderScale) { renderScale = rs; sprites.clear(); }
    viewport.begin();
    debug.frame();

    if (opts.portrait) { drawRotate(); return; }

    ctx.drawImage(tableSprite(), 0, 0, FIELD.w, FIELD.h);

    // Registro das encaçapadas, numa faixa abaixo da mesa — fora do pano,
    // para não disputar espaço com as caçapas nem com os diamantes.
    drawPotted(state);

    for (const ball of state.balls) {
      if (!ball.active) continue;
      if (ball.number === 0 && opts.hideCue) continue;
      drawBall(ball);
      debug.circle(ball.x, ball.y, ball.r, '#00ff9d');
    }

    if (opts.ghostCue) {
      ctx.save();
      ctx.globalAlpha = opts.ghostCue.valid ? 0.85 : 0.3;
      drawBall({ number: 0, x: opts.ghostCue.x, y: opts.ghostCue.y });
      ctx.restore();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = opts.ghostCue.valid ? theme.tokens.accent : theme.tokens.warn;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(opts.ghostCue.x, opts.ghostCue.y, BALL.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (opts.aiming && opts.guide) {
      drawGuide(state, opts.aim, opts.guide);
      drawCue(state, opts.aim);
    }

    drawPanel(opts.aim, opts.aiming, opts.charging);

    if (opts.banner) {
      ctx.save();
      ctx.font = '700 16px ui-monospace,monospace';
      ctx.fillStyle = theme.dark ? '#100b1bdd' : '#fdfbffdd';
      const w = Math.max(210, ctx.measureText(opts.banner).width + 56);
      rounded(ctx, TABLE.midX - w / 2, TABLE.centerY - 22, w, 44, 12);
      ctx.fill();
      ctx.strokeStyle = theme.tokens.accent;
      ctx.lineWidth = 1.5;
      rounded(ctx, TABLE.midX - w / 2, TABLE.centerY - 22, w, 44, 12);
      ctx.stroke();
      ctx.fillStyle = theme.dark ? '#f6efff' : '#271c34';
      ctx.font = '700 16px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.banner, TABLE.midX, TABLE.centerY + 1);
      ctx.restore();
    }

    debug.info(`bolas ${state.balls.filter(b => b.active).length}  fase ${state.phase}`);
    debug.render(ctx, view, opts.stats || {});
  }

  return { draw, invalidate: () => sprites.clear() };
}
