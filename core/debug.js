// Overlay de diagnóstico (ative com ?debug=1).
//
// Existe por um motivo prático: sem ver a hitbox real e o log de colisões não
// há como afirmar que uma "colisão fantasma" foi corrigida — só suposição.
export function createDebug() {
  const params = new URLSearchParams(location.search);
  const active = params.get('debug') === '1';
  const shapes = [];
  const events = [];
  const lines = [];

  return {
    active,
    frame() { if (active) shapes.length = 0, lines.length = 0; },
    rect(x, y, w, h, color = '#00ff9d') { if (active) shapes.push({ k: 'r', x, y, w, h, color }); },
    circle(x, y, r, color = '#00ff9d') { if (active) shapes.push({ k: 'c', x, y, r, color }); },
    line(x1, y1, x2, y2, color = '#ffcc00') { if (active) shapes.push({ k: 'l', x1, y1, x2, y2, color }); },
    info(text) { if (active) lines.push(text); },
    event(text) {
      if (!active) return;
      events.unshift(`${(performance.now() / 1000).toFixed(2)} ${text}`);
      if (events.length > 9) events.pop();
    },
    render(ctx, view, stats) {
      if (!active) return;
      ctx.save();
      ctx.lineWidth = 1;
      for (const s of shapes) {
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        if (s.k === 'r') ctx.rect(s.x, s.y, s.w, s.h);
        else if (s.k === 'c') ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        else { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
        ctx.stroke();
      }
      const text = [
        `fps ${stats.fps.toFixed(0)}  passos/frame ${stats.steps}  descartados ${stats.dropped}`,
        `frame ${stats.frameMs.toFixed(1)}ms  campo ${view.w}x${view.h}  escala ${view.scale.toFixed(3)}  dpr ${view.dpr}`,
        ...lines, '— colisões —', ...events
      ];
      ctx.font = '600 7px ui-monospace,monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const w = 176, h = text.length * 9 + 8;
      ctx.fillStyle = '#000000cc';
      ctx.fillRect(4, view.h - h - 4, w, h);
      ctx.fillStyle = '#7dffc4';
      text.forEach((t, i) => ctx.fillText(t, 8, view.h - h + 2 + i * 9));
      ctx.restore();
    }
  };
}
