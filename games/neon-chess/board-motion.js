// Animação e arrasto apenas visuais. A autoridade dos lances continua no
// modelo/local ou na sala; nenhum movimento de ponteiro altera a posição.
export function createBoardMotion(board, { signal, canDrag, select, drop }) {
  let drag = null, suppressClickUntil = 0, dropping = false;
  const animations = new Set(), ghosts = new Set(), moving = new Set();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cells = () => [...board.querySelectorAll('.nx-square')];

  function cancelDrag() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    previous.ghost?.remove();
    previous.cell.classList.remove('nx-drag-origin');
    if (board.hasPointerCapture(previous.id)) board.releasePointerCapture(previous.id);
  }

  function cancelAnimations() {
    for (const animation of animations) {
      animation.onfinish = animation.oncancel = null;
      animation.cancel();
    }
    animations.clear();
    for (const ghost of ghosts) ghost.remove();
    ghosts.clear();
    for (const cell of moving) cell.classList.remove('nx-moving');
    moving.clear();
  }

  function animate(node, frames, options, cleanup = () => {}) {
    const animation = node.animate(frames, options);
    animations.add(animation);
    const done = () => { animations.delete(animation); cleanup(); };
    animation.onfinish = done;
    animation.oncancel = done;
  }

  function snapshot() {
    cancelAnimations();
    return new Map(cells().map(cell => [Number(cell.dataset.square), {
      piece: cell.dataset.piece, image: cell.querySelector('.nx-piece')?.cloneNode(true),
      rect: cell.getBoundingClientRect()
    }]));
  }

  function play(before, from, to, castle = false) {
    if (reduced() || !board.animate) return;
    const after = new Map(cells().map(cell => [Number(cell.dataset.square), cell]));
    const pairs = [[from, to]];
    if (castle) pairs.push([from + (to > from ? 3 : -4), from + (to > from ? 1 : -1)]);
    const origins = new Set(pairs.map(([origin]) => origin));
    const bounds = board.getBoundingClientRect();

    // Também encontra a peça capturada en passant, fora da casa de destino.
    for (const [sq, old] of before) {
      if (!old.image || origins.has(sq) || old.piece === after.get(sq)?.dataset.piece) continue;
      const ghost = old.image;
      ghost.classList.add('nx-captured');
      Object.assign(ghost.style, { left: `${old.rect.left - bounds.left}px`,
        top: `${old.rect.top - bounds.top}px`, width: `${old.rect.width}px`, height: `${old.rect.height}px` });
      board.append(ghost); ghosts.add(ghost);
      animate(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'ease-out' },
        () => { ghost.remove(); ghosts.delete(ghost); });
    }
    for (const [origin, destination] of pairs) {
      // Ao soltar, a peça já chegou pelo ponteiro; não volta à origem para
      // repetir a viagem. Captura e torre do roque ainda podem animar.
      if (dropping && origin === from) continue;
      const old = before.get(origin), cell = after.get(destination);
      const piece = cell?.querySelector('.nx-piece');
      if (!old?.image || !piece) continue;
      const rect = cell.getBoundingClientRect();
      cell.classList.add('nx-moving'); moving.add(cell);
      animate(piece, [
        { transform: `translate(${old.rect.left - rect.left}px, ${old.rect.top - rect.top}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' },
      () => { cell.classList.remove('nx-moving'); moving.delete(cell); });
    }
  }

  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const cell = event.target.closest('.nx-square');
    const index = cells().indexOf(cell);
    if (index < 0 || !canDrag(index)) return;
    cancelDrag(); cancelAnimations();
    drag = { id: event.pointerId, index, cell, x: event.clientX, y: event.clientY, ghost: null };
  }, { signal });

  window.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!canDrag(drag.index)) { cancelDrag(); return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.ghost && Math.hypot(dx, dy) < 6) return;
    if (!drag.ghost) {
      select(drag.index);
      const image = drag.cell.querySelector('.nx-piece');
      if (!image) { cancelDrag(); return; }
      const rect = drag.cell.getBoundingClientRect(), bounds = board.getBoundingClientRect();
      drag.ghost = image.cloneNode(true);
      drag.ghost.classList.add('nx-dragged');
      Object.assign(drag.ghost.style, { left: `${rect.left - bounds.left}px`, top: `${rect.top - bounds.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px` });
      drag.cell.classList.add('nx-drag-origin');
      board.append(drag.ghost);
      board.setPointerCapture(drag.id);
    }
    event.preventDefault();
    drag.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
  }, { signal, passive: false });

  window.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag, active = !!drag.ghost;
    const bounds = board.getBoundingClientRect();
    const column = Math.floor((event.clientX - bounds.left) * 8 / bounds.width);
    const row = Math.floor((event.clientY - bounds.top) * 8 / bounds.height);
    cancelDrag();
    if (!active) return; // O clique normal continua sendo toque + destino.
    suppressClickUntil = performance.now() + 350;
    if (column >= 0 && column < 8 && row >= 0 && row < 8 &&
        row * 8 + column !== previous.index && canDrag(previous.index)) {
      dropping = true;
      try { drop(row * 8 + column); } finally { dropping = false; }
    }
  }, { signal });

  board.addEventListener('click', event => {
    if (event.detail && performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, { capture: true, signal });
  board.addEventListener('lostpointercapture', cancelDrag, { signal });
  window.addEventListener('pointercancel', cancelDrag, { signal });
  window.addEventListener('blur', cancelDrag, { signal });
  const cancel = () => { cancelDrag(); cancelAnimations(); };
  signal.addEventListener('abort', cancel, { once: true });
  return { snapshot, play, cancel };
}
