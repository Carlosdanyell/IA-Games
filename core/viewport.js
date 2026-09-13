// Viewport com ESCALA UNIFORME e letterbox.
//
// Problema que este módulo resolve: se o canvas usar escalas diferentes em X e
// Y, um círculo vira elipse e toda distância vertical aparece comprimida — a
// física deixa de bater com o desenho. Aqui a escala é sempre a mesma nos dois
// eixos e a sobra vira faixa (letterbox), nunca deformação.
export function createViewport(canvas, { logical, maxDpr = 2 }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const view = {
    ctx,
    w: 400, h: 600,        // tamanho do campo em unidades lógicas
    scale: 1,              // unidades lógicas -> px CSS
    ox: 0, oy: 0,          // deslocamento do letterbox, em px CSS
    dpr: 1,
    cssW: 0, cssH: 0,
    changed: false
  };

  let rect = null;
  const invalidateRect = () => { rect = null; };
  const getRect = () => (rect || (rect = canvas.getBoundingClientRect()));

  function resize() {
    const r = canvas.getBoundingClientRect();
    rect = r;
    if (!r.width || !r.height) return false;

    const size = logical(r.width / r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const scale = Math.min(r.width / size.w, r.height / size.h);
    const pxW = Math.round(r.width * dpr);
    const pxH = Math.round(r.height * dpr);

    const same = view.w === size.w && view.h === size.h &&
                 canvas.width === pxW && canvas.height === pxH;
    view.changed = !same;
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;

    view.w = size.w;
    view.h = size.h;
    view.scale = scale;
    view.dpr = dpr;
    view.cssW = r.width;
    view.cssH = r.height;
    view.ox = (r.width - size.w * scale) / 2;
    view.oy = (r.height - size.h * scale) / 2;
    return true;
  }

  // Aplica a transformação para desenhar em unidades lógicas.
  function begin() {
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    ctx.clearRect(-view.ox / view.scale, -view.oy / view.scale,
                  view.cssW / view.scale, view.cssH / view.scale);
  }

  // Converte coordenada de ponteiro (px de janela) para unidade lógica.
  function toLogical(clientX, clientY) {
    const r = getRect();
    return {
      x: (clientX - r.left - view.ox) / view.scale,
      y: (clientY - r.top - view.oy) / view.scale
    };
  }

  window.addEventListener('scroll', invalidateRect, { passive: true });
  window.addEventListener('resize', invalidateRect, { passive: true });

  return { view, resize, begin, toLogical, invalidateRect };
}
