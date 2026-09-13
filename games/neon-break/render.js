import { createSpriteCache } from '../../core/sprites.js';
import { FIELD, BRICK, LASER, PADDLE, BALL } from './config.js';
import { brickDef } from './content.js';

// Toda a parte visual. O desenho acontece em unidades lógicas com escala
// uniforme, então o que está na tela é exatamente o que a física calcula:
// a moldura desenhada É a parede de colisão.
export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const ctx = view.ctx;
  const sprites = createSpriteCache();
  let renderScale = 1;

  function rounded(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  const brickColor = (b, levelIndex) => {
    const list = theme.tokens.bricks;
    return list[(b.row + levelIndex) % list.length];
  };

  // Sprite de bloco pré-renderizado com o brilho já embutido. Desenhar
  // `shadowBlur` para 40 blocos a cada frame é o que derruba o FPS no celular;
  // aqui o custo é pago uma vez por cor/estado.
  function brickSprite(color, variant, w, h, low) {
    const pad = 6;
    const key = `b|${color}|${variant}|${w.toFixed(1)}x${h.toFixed(1)}|${renderScale}|${low ? 1 : 0}|${theme.mode}`;
    return sprites.get(key, (w + pad * 2) * renderScale, (h + pad * 2) * renderScale, (c, cw, ch) => {
      c.scale(renderScale, renderScale);
      c.translate(pad, pad);
      const dark = theme.dark;
      let fill = color;
      if (variant === 'steel') fill = dark ? '#30273e' : '#b8aec6';
      if (variant === 'flash') fill = dark ? '#ffffff' : '#efddff';
      if (!low && variant !== 'steel') { c.shadowBlur = 7; c.shadowColor = color + '66'; }
      c.fillStyle = fill;
      rounded(c, 0, 0, w, h, BRICK.radius);
      c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = variant === 'steel' ? (dark ? '#9681ad' : '#726082') : '#ffffff40';
      c.lineWidth = 1;
      rounded(c, 0.5, 0.5, w - 1, h - 1, BRICK.radius);
      c.stroke();
    });
  }

  function glowSprite(color, radius) {
    const size = Math.ceil(radius * 4);
    const key = `g|${color}|${radius}|${renderScale}`;
    return sprites.get(key, size * renderScale, size * renderScale, (c, cw, ch) => {
      const r = cw / 2;
      const grad = c.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, color + 'cc');
      grad.addColorStop(0.45, color + '44');
      grad.addColorStop(1, color + '00');
      c.fillStyle = grad;
      c.fillRect(0, 0, cw, ch);
    });
  }

  function background(clock, shape, low) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD.wallX, FIELD.hudBand, FIELD.w - FIELD.wallX * 2, view.h - FIELD.hudBand);
    ctx.clip();
    ctx.strokeStyle = theme.tokens.accent;
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = theme.dark ? 0.1 : 0.13;
    const cy = view.h * 0.47, W = FIELD.w, H = view.h;

    if (shape === 'grid') {
      for (let y = 52; y < H - 40; y += 26) for (let x = 18; x < W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y);
        ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2);
        ctx.stroke();
      }
    }
    if (shape === 'orbit' || shape === 'nova') {
      for (let r = 45; r < W; r += 45) { ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath();
      ctx.moveTo(W / 2, FIELD.hudBand + 6); ctx.lineTo(W / 2, H - 30);
      ctx.moveTo(8, cy); ctx.lineTo(W - 8, cy);
      ctx.stroke();
    }
    if (shape === 'rays') {
      for (let x = -H; x < W + H; x += 34) {
        ctx.beginPath(); ctx.moveTo(x, FIELD.hudBand); ctx.lineTo(x + H * 0.6, H - 30); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.48, 85, 0, Math.PI * 2); ctx.stroke();
    }
    if (shape === 'diamonds') {
      for (let y = 52; y < H; y += 58) for (let x = 0; x < W + 50; x += 58) {
        ctx.beginPath();
        ctx.moveTo(x, y - 28); ctx.lineTo(x + 28, y); ctx.lineTo(x, y + 28); ctx.lineTo(x - 28, y);
        ctx.closePath(); ctx.stroke();
      }
    }
    if (shape === 'nova') {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6 + (low ? 0 : clock * 0.05);
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * 45, cy + Math.sin(a) * 45);
        ctx.lineTo(W / 2 + Math.cos(a) * 420, cy + Math.sin(a) * 420);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Moldura: as três linhas abaixo são exatamente onde a bola quica.
  // Nada de parede invisível.
  function frame(remaining, phaseName) {
    const left = FIELD.wallX, right = FIELD.w - FIELD.wallX, top = FIELD.hudBand;
    ctx.fillStyle = theme.dark ? '#120c1e' : '#fbf8ff';
    ctx.fillRect(left, top, right - left, view.h - top);

    ctx.strokeStyle = theme.tokens.accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = FIELD.frame;
    ctx.beginPath();
    ctx.moveTo(left, view.h); ctx.lineTo(left, top);
    ctx.lineTo(right, top); ctx.lineTo(right, view.h);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = '600 11px ui-monospace,monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.dark ? '#cbbcdd' : '#5a4c68';
    ctx.fillText(phaseName, left + 6, top / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.tokens.accent;
    ctx.fillText(`${String(remaining).padStart(2, '0')} BLOCOS`, right - 6, top / 2);
  }

  function draw(S, opts) {
    const { alpha, dt, levelIndex, phaseName, lowEffects: low, showAim } = opts;
    const rs = Math.min(4, Math.max(1, Math.round(view.scale * view.dpr * 4) / 4));
    if (rs !== renderScale) { renderScale = rs; sprites.clear(); }

    viewport.begin();
    debug.frame();

    ctx.save();
    if (S.shake > 0 && !low) {
      const m = S.shake * 2.4;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    frame(S.remaining, phaseName);
    background(S.clock, S.phase.shape, low);

    // Blocos
    const pad = 6;
    for (const b of S.bricks) {
      if (b.hp <= 0) continue;
      const def = brickDef(b.kind);
      const variant = b.flash > 0 ? 'flash' : def.steel ? 'steel' : 'normal';
      const color = brickColor(b, levelIndex);
      const sprite = brickSprite(color, variant, b.w, b.h, low);
      ctx.drawImage(sprite, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);

      const symbol = def.symbol && (!def.crack || b.hp === b.maxHp) ? def.symbol : '';
      if (symbol) {
        ctx.fillStyle = def.steel
          ? (theme.dark ? '#cbb8e0' : '#4d3f60')
          : def.bad ? (theme.dark ? '#2a1020' : '#ffffff')
          : (theme.dark ? '#21132ee0' : '#ffffff');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.min(13, b.h - 4)}px ui-monospace,monospace`;
        ctx.fillText(symbol, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      }
      if (def.crack && b.hp < b.maxHp) {
        ctx.strokeStyle = theme.dark ? '#392349aa' : '#ffffffaa';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.52, b.y + 2);
        ctx.lineTo(b.x + b.w * 0.42, b.y + b.h * 0.45);
        ctx.lineTo(b.x + b.w * 0.61, b.y + b.h * 0.58);
        ctx.lineTo(b.x + b.w * 0.49, b.y + b.h - 2);
        ctx.stroke();
      }
      debug.rect(b.x, b.y, b.w, b.h, '#00ff9d');
    }

    // Blocos aguardando regeneração
    for (const b of S.bricks) {
      if (b.hp > 0 || b.regen <= 0) continue;
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(S.clock * 6);
      ctx.strokeStyle = theme.tokens.accent;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      rounded(ctx, b.x, b.y, b.w, b.h, BRICK.radius);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Ondas de explosão
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const r = S.rings[i];
      r.life -= dt; r.r += dt * 190;
      if (r.life <= 0) { S.rings.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, r.life * 2.2);
      ctx.strokeStyle = theme.tokens.accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Partículas
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 92 * dt; p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Tiros
    if (S.shots.length) {
      ctx.fillStyle = theme.tokens.accent;
      for (const s of S.shots) ctx.fillRect(s.x - LASER.w / 2, s.y - LASER.h, LASER.w, LASER.h);
    }

    // Cápsulas
    for (const d of S.drops) {
      const def = brickDef(d.kind);
      const color = def.bad ? theme.tokens.warn : theme.tokens.accent;
      if (!low) ctx.drawImage(glowSprite(color, d.h), d.x - d.h * 2, d.y - d.h * 2, d.h * 4, d.h * 4);
      ctx.fillStyle = theme.dark ? '#1b1229' : '#ffffff';
      rounded(ctx, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, 7);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '750 13px ui-monospace,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.symbol, d.x, d.y + 0.5);
      debug.rect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h, '#ffcc00');
    }

    // Escudo
    if (S.effects.shield > 0) {
      const y = S.paddle.y + PADDLE.shieldGap;
      ctx.strokeStyle = theme.tokens.accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(FIELD.wallX, y); ctx.lineTo(FIELD.w - FIELD.wallX, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      debug.line(FIELD.wallX, y, FIELD.w - FIELD.wallX, y, '#ff00ff');
    }

    // Plataforma (retângulo de cantos redondos = cápsula de colisão)
    const p = S.paddle;
    if (!low) { ctx.shadowBlur = 18; ctx.shadowColor = theme.tokens.accent; }
    ctx.fillStyle = S.effects.narrow > 0 ? theme.tokens.warn : theme.tokens.accent;
    rounded(ctx, p.x - p.w / 2, p.y, p.w, p.h, p.h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.dark ? '#fff4ff' : '#ffffffbb';
    rounded(ctx, p.x - p.w / 2 + 9, p.y + 1.5, Math.max(4, p.w - 18), 2, 1);
    ctx.fill();
    if (S.effects.laser > 0) {
      ctx.fillStyle = theme.dark ? '#fff4ff' : '#ffffff';
      ctx.fillRect(p.x - p.w / 2 + 3, p.y - 3, 3, 3);
      ctx.fillRect(p.x + p.w / 2 - 6, p.y - 3, 3, 3);
    }
    debug.rect(p.x - p.w / 2, p.y, p.w, p.h, '#00ccff');
    debug.line(p.x - (p.w - p.h) / 2, p.y + p.h / 2, p.x + (p.w - p.h) / 2, p.y + p.h / 2, '#00ccff');

    // Bolinhas, interpoladas entre o passo anterior e o atual
    for (const b of S.balls) {
      const bx = b.prevX + (b.x - b.prevX) * alpha;
      const by = b.prevY + (b.y - b.prevY) * alpha;
      if (!low && !b.held) {
        b.trail.unshift({ x: bx, y: by });
        if (b.trail.length > BALL.trail) b.trail.pop();
      }
      for (let i = b.trail.length - 1; i >= 0; i--) {
        ctx.globalAlpha = (1 - i / b.trail.length) * 0.22;
        ctx.fillStyle = S.effects.pierce > 0 ? theme.tokens.warn : theme.tokens.accent;
        ctx.beginPath();
        ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (1 - i / (b.trail.length + 1)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!low) { ctx.shadowBlur = 13; ctx.shadowColor = theme.tokens.accent; }
      ctx.fillStyle = S.effects.pierce > 0 ? theme.tokens.warn : (theme.dark ? '#fff5ff' : theme.tokens.accent);
      ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      debug.circle(b.x, b.y, b.r, '#ff4d4d');
    }

    // Indicador de lançamento
    if (showAim) {
      const b = S.balls.find(x => x.held);
      if (b) {
        const spread = PADDLE.spreadDeg * Math.PI / 180;
        const a = b.held.offset * spread - Math.PI / 2;
        ctx.setLineDash([2, 7]);
        ctx.strokeStyle = theme.tokens.accent + '88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * 12, b.y + Math.sin(a) * 12);
        ctx.lineTo(b.x + Math.cos(a) * 96, b.y + Math.sin(a) * 96);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Pontos flutuantes
    for (let i = S.floats.length - 1; i >= 0; i--) {
      const f = S.floats[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) { S.floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = theme.dark ? '#f7eaff' : '#422154';
      ctx.font = '650 12px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    debug.info(`bolas ${S.balls.length}  blocos ${S.remaining}  combo ${S.combo}`);
    debug.info(`parado ${S.stallTimer.toFixed(1)}s  ganho teto ${S.ceilingGain.toFixed(3)}  sprites ${sprites.size}`);
    debug.render(ctx, view, { ...opts.stats, fps: opts.stats?.fps || 0, steps: opts.stats?.steps || 0,
                              dropped: opts.stats?.dropped || 0, frameMs: opts.stats?.frameMs || 0 });
  }

  return { draw, brickColor, invalidate: () => sprites.clear() };
}
