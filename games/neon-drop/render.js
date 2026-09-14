import { createSpriteCache } from '../../core/sprites.js';
import { BOARD } from './config.js';
import { BLOCK, EMPTY } from './model.js';

// Identidade da biblioteca aplicada ao Lig 4: quadro escuro com furos, peças
// em disco com brilho e a cor de destaque para quem joga primeiro. A segunda
// cor é fixa (ciano) porque as duas precisam se distinguir em qualquer paleta
// — se as duas seguissem o tema, em algumas cores o tabuleiro viraria um borrão.
const P2 = { dark: '#5fd5ff', light: '#0a6f92' };

export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const sprites = createSpriteCache();
  const ctx = () => view.ctx;

  const colorOf = mark => (mark === 1 ? theme.tokens.accent : theme.dark ? P2.dark : P2.light);

  // Geometria do tabuleiro dentro do campo lógico. Recalculada a cada quadro
  // porque é barata e porque a fase pode mudar de tamanho no meio da sessão.
  function layout(stage) {
    const largura = view.w - BOARD.margin * 2;
    const cabe = band => Math.max(BOARD.minCell, Math.min(BOARD.maxCell,
      Math.floor(Math.min(largura / stage.cols, (view.h - band - BOARD.margin) / stage.rows))));
    // Duas passadas: a faixa de cima precisa caber a peça pronta, e o tamanho
    // da peça depende da faixa. Sem isso, em tela baixa a peça nascia fora do
    // canvas.
    let band = BOARD.topBand;
    band = Math.max(BOARD.topBand, Math.min(cabe(band) * 1.1, view.h * 0.2));
    const cell = cabe(band);
    const w = cell * stage.cols, h = cell * stage.rows;
    const x = Math.round((view.w - w) / 2);
    const y = Math.round(band + (view.h - band - BOARD.margin - h) / 2);
    return {
      cell, w, h, x, y, band,
      entryY: Math.max(cell * 0.55 + 2, y - cell * 0.72),
      colX: col => x + col * cell + cell / 2,
      rowY: row => y + row * cell + cell / 2
    };
  }

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

  // O quadro com os furos é sempre igual durante a fase: desenhado uma vez
  // fora da tela e copiado por quadro. Os furos são recortados de verdade
  // (destination-out), então a peça que cai aparece atrás do quadro.
  function frameSprite(stage, geo) {
    const key = `quadro|${stage.name}|${stage.cols}x${stage.rows}|${geo.cell}|${theme.mode}|${theme.tokens.accent}`;
    const pad = Math.round(geo.cell * 0.22);
    return sprites.get(key, geo.w + pad * 2, geo.h + pad * 2, c => {
      const dark = theme.dark;
      const accent = theme.tokens.accent;
      rounded(c, 0, 0, geo.w + pad * 2, geo.h + pad * 2, geo.cell * BOARD.radius + pad);
      c.fillStyle = dark ? '#1a1228' : '#e7dff4';
      c.fill();
      c.strokeStyle = accent + (dark ? '66' : '88');
      c.lineWidth = 2;
      c.stroke();

      const raio = geo.cell * (0.5 - BOARD.gap);
      c.save();
      c.globalCompositeOperation = 'destination-out';
      for (let row = 0; row < stage.rows; row++) {
        for (let col = 0; col < stage.cols; col++) {
          if (stage.blockedSet.has(row * stage.cols + col)) continue;
          c.beginPath();
          c.arc(pad + col * geo.cell + geo.cell / 2, pad + row * geo.cell + geo.cell / 2, raio, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();

      // Bloqueios: bloco maciço com risco, para ler como obstáculo e não como
      // peça de alguém.
      for (let row = 0; row < stage.rows; row++) {
        for (let col = 0; col < stage.cols; col++) {
          if (!stage.blockedSet.has(row * stage.cols + col)) continue;
          const x = pad + col * geo.cell + geo.cell * 0.12;
          const y = pad + row * geo.cell + geo.cell * 0.12;
          const s = geo.cell * 0.76;
          rounded(c, x, y, s, s, geo.cell * 0.16);
          c.fillStyle = dark ? '#3a2f4d' : '#c4b8d6';
          c.fill();
          c.strokeStyle = dark ? '#544468' : '#a495bb';
          c.lineWidth = 1.5;
          c.stroke();
          c.save();
          c.beginPath();
          rounded(c, x, y, s, s, geo.cell * 0.16);
          c.clip();
          c.strokeStyle = dark ? '#2a2139' : '#b0a1c8';
          c.lineWidth = Math.max(1.5, geo.cell * 0.07);
          for (let i = -1; i < 4; i++) {
            c.beginPath();
            c.moveTo(x + i * s * 0.4, y + s);
            c.lineTo(x + i * s * 0.4 + s, y);
            c.stroke();
          }
          c.restore();
        }
      }
    });
  }

  function disc(c, x, y, r, mark, opts = {}) {
    const cor = colorOf(mark);
    c.save();
    if (opts.glow) { c.shadowColor = cor; c.shadowBlur = r * (opts.glow || 0.6); }
    c.fillStyle = cor;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    // Miolo mais escuro e brilho no alto: dá volume sem textura.
    c.globalAlpha = 0.22;
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(x, y, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.5;
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.36, r * 0.26, r * 0.17, -0.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  return {
    invalidate() { sprites.clear(); },
    layout(stage) { return layout(stage); },

    draw(s) {
      const c = ctx();
      const stage = s.stage;
      const geo = layout(stage);
      const raio = geo.cell * (0.5 - BOARD.gap);
      viewport.begin();
      debug.frame();

      c.save();
      if (s.shake > 0) c.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);

      // Peça pronta logo acima do quadro, na coluna escolhida.
      const alturaSaida = geo.y - geo.cell * 0.72;
      if (s.cursor >= 0 && s.showCursor) {
        const x = geo.colX(s.cursor);
        disc(c, x, alturaSaida, raio * 0.92, s.turn, { glow: 0.9 });
        c.save();
        c.globalAlpha = 0.25;
        c.strokeStyle = colorOf(s.turn);
        c.lineWidth = 2;
        c.setLineDash([4, 6]);
        c.beginPath();
        c.moveTo(x, alturaSaida + raio);
        c.lineTo(x, geo.y + geo.h);
        c.stroke();
        c.restore();
        // Sombra de onde a peça vai parar.
        if (s.preview >= 0) {
          c.save();
          c.globalAlpha = 0.3;
          c.strokeStyle = colorOf(s.turn);
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, geo.rowY(s.preview), raio * 0.86, 0, Math.PI * 2);
          c.stroke();
          c.restore();
        }
      }

      // Peças assentadas (a que está caindo é pulada e desenhada por cima).
      for (let row = 0; row < stage.rows; row++) {
        for (let col = 0; col < stage.cols; col++) {
          const v = s.cells[row * stage.cols + col];
          if (v === EMPTY || v === BLOCK) continue;
          if (s.falling && s.falling.col === col && s.falling.row === row) continue;
          const vencedora = s.line && s.line.some(([lc, lr]) => lc === col && lr === row);
          disc(c, geo.colX(col), geo.rowY(row), raio, v,
            { glow: vencedora ? 1.4 + Math.sin(s.clock * 7) * 0.6 : 0 });
        }
      }
      if (s.falling) disc(c, geo.colX(s.falling.col), s.falling.y, raio, s.falling.mark, { glow: 0.7 });

      // Quadro por cima: os furos deixam as peças aparecerem.
      const pad = Math.round(geo.cell * 0.22);
      c.drawImage(frameSprite(stage, geo), geo.x - pad, geo.y - pad);

      // Linha vencedora
      if (s.line && s.line.length > 1) {
        const [c0, r0] = s.line[0];
        const [c1, r1] = s.line[s.line.length - 1];
        c.save();
        c.strokeStyle = colorOf(s.winner);
        c.lineWidth = Math.max(3, geo.cell * 0.12);
        c.lineCap = 'round';
        c.shadowColor = colorOf(s.winner);
        c.shadowBlur = 16;
        c.globalAlpha = 0.9;
        c.beginPath();
        c.moveTo(geo.colX(c0), geo.rowY(r0));
        c.lineTo(geo.colX(c1), geo.rowY(r1));
        c.stroke();
        c.restore();
      }

      if (s.banner) {
        c.save();
        c.textAlign = 'center';
        c.font = `800 ${Math.round(Math.min(view.h * 0.09, 34))}px system-ui, sans-serif`;
        c.fillStyle = s.bannerTone === 'bad' ? '#ff5f6d' : theme.tokens.accent;
        c.shadowColor = c.fillStyle + '88';
        c.shadowBlur = 14;
        c.fillText(s.banner, view.w / 2, geo.y + geo.h / 2 + 10);
        c.restore();
      }
      c.restore();

      if (debug.active) {
        debug.info(`fase ${stage.name} ${stage.cols}x${stage.rows} conecta ${stage.connect}`);
        debug.info(`casa ${geo.cell}  campo ${view.w}x${view.h}  vez ${s.turn}`);
        if (s.search) debug.info(`busca: profundidade ${s.search.depth} em ${s.search.ms.toFixed(0)}ms`);
        debug.render(c, view, s.stats || {});
      }
    }
  };
}
