import { createSpriteCache } from '../../core/sprites.js';
import { BOARD, DISCS } from './config.js';
import { BLOCK, EMPTY } from './model.js';

// Identidade da biblioteca aplicada ao Lig 4: quadro escuro com furos e a cor
// de destaque do tema no quadro, na linha vencedora e nos detalhes. As peças
// têm cor própria (ver DISCS em config.js) porque precisam se distinguir uma
// da outra em qualquer paleta, e o destaque do tema muda a cada fase.
export function createRenderer(viewport, theme, debug) {
  const view = viewport.view;
  const sprites = createSpriteCache();
  const ctx = () => view.ctx;

  const skin = mark => DISCS[mark] || DISCS[1];
  const colorOf = mark => (theme.dark ? skin(mark).dark : skin(mark).light);

  // Geometria do campo, de cima para baixo: faixa do aviso de vez, faixa da
  // peça pronta, tabuleiro e trilho de colunas. Tudo isso é centralizado em
  // bloco, para o conjunto não ficar encostado no topo com um vazio embaixo.
  function layout(stage) {
    const largura = view.w - BOARD.margin * 2;
    const head = BOARD.strip;
    const cabe = band => Math.max(BOARD.minCell, Math.min(BOARD.maxCell,
      Math.floor(Math.min(largura / stage.cols,
        (view.h - head - band - BOARD.rail - BOARD.margin * 2) / stage.rows))));
    // Duas passadas: a faixa da peça pronta precisa caber a peça inteira entre
    // o aviso de vez e a borda do quadro, e o tamanho da peça depende da faixa.
    // A peça pronta fica a 0,72 casa acima do tabuleiro e tem raio de 0,368
    // casa, então a faixa precisa de 1,12 casa mais uma folga — com 1,1 ela
    // encostava no quadro quando o painel não sobrava altura.
    const precisa = c => Math.max(BOARD.topBand, Math.min(c * 1.12 + 3, view.h * 0.28));
    const band = precisa(cabe(BOARD.topBand));
    const cell = cabe(band);
    const w = cell * stage.cols, h = cell * stage.rows;
    const x = Math.round((view.w - w) / 2);
    const pad = Math.round(cell * 0.22);
    const bloco = band + h + pad + BOARD.rail;
    const topo = head + Math.max(0, (view.h - head - BOARD.margin - bloco) / 2);
    const y = Math.round(topo + band);
    return {
      cell, w, h, x, y, band, head, pad,
      stripY: Math.max(head / 2, topo - head / 2),
      railY: y + h + pad + BOARD.rail * 0.5,
      entryY: Math.max(head + cell * 0.368 + 2, y - cell * 0.72),
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
    const pad = geo.pad;
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

  // Peça: cor própria mais um desenho interno que também identifica o dono —
  // a peça 1 é um anel e a 2 tem núcleo cheio. Duas pistas em vez de uma só.
  function disc(c, x, y, r, mark, opts = {}) {
    const cor = colorOf(mark);
    const forma = skin(mark).glyph;
    const fundo = theme.dark ? '#0d0a18' : '#f4f0fa';
    c.save();
    if (opts.glow) { c.shadowColor = cor; c.shadowBlur = r * (opts.glow || 0.6); }
    c.fillStyle = cor;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    if (forma === 'ring') {
      // Anel: o miolo é vazado até a cor do fundo, então a peça lê como um "O".
      c.globalAlpha = opts.ghost ? 0.55 : 0.92;
      c.fillStyle = fundo;
      c.beginPath();
      c.arc(x, y, r * 0.46, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = cor;
      c.lineWidth = Math.max(1, r * 0.1);
      c.beginPath();
      c.arc(x, y, r * 0.46, 0, Math.PI * 2);
      c.stroke();
    } else {
      // Núcleo: miolo escuro cheio, leitura de alvo preenchido.
      c.globalAlpha = 0.3;
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(x, y, r * 0.58, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.85;
      c.fillStyle = cor;
      c.beginPath();
      c.arc(x, y, r * 0.26, 0, Math.PI * 2);
      c.fill();
    }
    // Brilho no alto: dá volume sem textura.
    c.globalAlpha = 0.45;
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(x - r * 0.34, y - r * 0.4, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Aviso de vez: pílula com a peça de quem joga e o texto. É a pista grande
  // que faltava — a cor da peça aparece do lado do nome de quem está na vez.
  function turnPill(c, geo, s) {
    if (!s.turnLabel) return;
    const alturaTexto = Math.min(13, Math.max(10, geo.head * 0.42));
    c.save();
    c.font = `700 ${alturaTexto}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    const texto = s.turnLabel.toUpperCase();
    const larguraTexto = c.measureText(texto).width;
    const bolinha = alturaTexto * 0.62;
    const pad = alturaTexto * 0.85;
    const w = larguraTexto + bolinha * 2 + pad * 2 + alturaTexto * 0.5;
    const h = alturaTexto * 2;
    const x = (view.w - w) / 2;
    const y = geo.stripY - h / 2;
    const cor = s.turnMark ? colorOf(s.turnMark) : theme.tokens.accent;
    rounded(c, x, y, w, h, h / 2);
    c.fillStyle = theme.dark ? '#ffffff0e' : '#00000008';
    c.fill();
    c.strokeStyle = cor + (theme.dark ? '88' : 'aa');
    c.lineWidth = 1.5;
    c.stroke();
    if (s.turnMark) {
      const cx = x + pad + bolinha;
      disc(c, cx, y + h / 2, bolinha, s.turnMark, { glow: s.waiting ? 0 : 1.1 });
      c.textAlign = 'left';
      c.fillStyle = cor;
      c.fillText(texto, cx + bolinha + alturaTexto * 0.5, y + h / 2 + alturaTexto * 0.36);
    } else {
      c.textAlign = 'center';
      c.fillStyle = cor;
      c.fillText(texto, view.w / 2, y + h / 2 + alturaTexto * 0.36);
    }
    c.restore();
  }

  // Trilho embaixo: uma barra por coluna. Mostra qual está armada, marca as
  // cheias e dá um alvo de toque óbvio fora do tabuleiro.
  function columnRail(c, stage, geo, s) {
    const alturaBarra = Math.max(3, BOARD.rail * 0.32);
    const largura = geo.cell * 0.58;
    for (let col = 0; col < stage.cols; col++) {
      const ativa = col === s.cursor && s.showCursor;
      const cheia = s.full && s.full[col];
      const x = geo.colX(col) - largura / 2;
      rounded(c, x, geo.railY - alturaBarra / 2, largura, alturaBarra, alturaBarra / 2);
      c.fillStyle = ativa ? colorOf(s.turn) : cheia
        ? (theme.dark ? '#ffffff14' : '#00000012')
        : theme.tokens.accent + (theme.dark ? '3a' : '44');
      c.fill();
    }
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

      turnPill(c, geo, s);

      // Peça pronta logo acima do quadro, na coluna escolhida.
      if (s.cursor >= 0 && s.showCursor) {
        const x = geo.colX(s.cursor);
        const flutua = Math.sin(s.clock * 3.4) * geo.cell * 0.035;
        disc(c, x, geo.entryY + flutua, raio * 0.92, s.turn, { glow: 0.9 });
        c.save();
        c.globalAlpha = 0.34;
        c.strokeStyle = colorOf(s.turn);
        c.lineWidth = 2;
        c.setLineDash([4, 6]);
        c.beginPath();
        c.moveTo(x, geo.entryY + raio);
        c.lineTo(x, geo.y + geo.h);
        c.stroke();
        c.restore();
        // Sombra de onde a peça vai parar: peça fantasma, não só um contorno.
        if (s.preview >= 0) {
          c.save();
          c.globalAlpha = 0.34;
          disc(c, x, geo.rowY(s.preview), raio * 0.9, s.turn);
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
          const ultima = s.lastMove && s.lastMove.col === col && s.lastMove.row === row;
          disc(c, geo.colX(col), geo.rowY(row), raio, v,
            { glow: vencedora ? 1.4 + Math.sin(s.clock * 7) * 0.6 : ultima ? 0.45 : 0 });
        }
      }
      if (s.falling) disc(c, geo.colX(s.falling.col), s.falling.y, raio, s.falling.mark, { glow: 0.7 });

      // Quadro por cima: os furos deixam as peças aparecerem.
      const pad = geo.pad;
      c.drawImage(frameSprite(stage, geo), geo.x - pad, geo.y - pad);

      // Trilho depois do quadro: desenhado antes, ficava escondido atrás da
      // borda do quadro, que se estende `pad` além do tabuleiro.
      columnRail(c, stage, geo, s);

      // Marca discreta na última jogada, por cima do quadro, para achar de
      // relance onde o oponente jogou.
      if (s.lastMove && !s.falling && !s.line) {
        c.save();
        c.globalAlpha = 0.85;
        c.strokeStyle = theme.dark ? '#fff' : '#000';
        c.lineWidth = Math.max(1.5, geo.cell * 0.045);
        c.beginPath();
        c.arc(geo.colX(s.lastMove.col), geo.rowY(s.lastMove.row), raio * 1.02, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }

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
