// Camada de entrada normalizada: ponteiro (toque/mouse), teclado e modos de
// controle. O jogo consome apenas `state` e os eventos de toque/atalho.
export function createInput(element, viewport, options = {}) {
  const state = {
    pointerActive: false,
    tracking: false,      // já houve interação: a plataforma pode seguir o ponteiro
    x: 0, y: 0,          // posição lógica do ponteiro
    axis: 0,             // -1/0/1 vindo do teclado
    mode: options.mode || 'absolute',   // 'absolute' | 'relative'
    inverted: false,
    relativeAnchor: 0,
    relativeValue: 0,
    sensitivity: options.sensitivity || 1.6
  };
  const keys = { left: false, right: false };
  const listeners = { tap: [], press: [], move: [], release: [], key: [] };
  let pointerId = null;
  let enabled = true;
  let moved = 0;

  const emit = (name, payload) => listeners[name].forEach(fn => fn(payload));

  function reset() {
    if (pointerId !== null && element.hasPointerCapture?.(pointerId)) {
      try { element.releasePointerCapture(pointerId); } catch (_) {}
    }
    pointerId = null;
    state.pointerActive = false;
    keys.left = keys.right = false;
    state.axis = 0;
  }

  function readPointer(e) {
    const p = viewport.toLogical(e.clientX, e.clientY);
    state.tracking = true;
    if (state.mode === 'relative') {
      const delta = (p.x - state.relativeAnchor) * state.sensitivity;
      state.relativeAnchor = p.x;
      state.relativeValue += state.inverted ? -delta : delta;
      state.x = state.relativeValue;
    } else {
      state.x = state.inverted ? viewport.view.w - p.x : p.x;
    }
    state.y = p.y;
  }

  element.addEventListener('pointerdown', e => {
    if (!enabled || pointerId !== null) return;
    if (e.target.closest && e.target.closest('button,a,input,label')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    pointerId = e.pointerId;
    state.pointerActive = true;
    moved = 0;
    const p = viewport.toLogical(e.clientX, e.clientY);
    state.relativeAnchor = p.x;
    if (state.mode === 'relative') state.relativeValue = options.getAnchor ? options.getAnchor() : p.x;
    readPointer(e);
    try { element.setPointerCapture(e.pointerId); } catch (_) {}
    emit('press', { x: state.x, y: state.y });
  });

  element.addEventListener('pointermove', e => {
    if (!enabled) return;
    if (e.pointerId !== pointerId && e.pointerType !== 'mouse') return;
    if (e.pointerType === 'mouse' && pointerId === null && state.mode === 'relative') return;
    if (pointerId !== null || e.pointerType === 'mouse') {
      const before = state.x;
      readPointer(e);
      moved += Math.abs(state.x - before);
      if (pointerId !== null) e.preventDefault();
      // No toque só chega aqui com o dedo na tela; no mouse chega sempre.
      // Quem quiser arrasto contínuo (ou prévia sob o cursor) escuta isto.
      emit('move', { x: state.x, y: state.y, dragging: pointerId !== null });
    }
  });

  function up(e) {
    if (e.pointerId !== pointerId) return;
    if (element.hasPointerCapture?.(e.pointerId)) {
      try { element.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    pointerId = null;
    state.pointerActive = false;
    emit('release', { x: state.x, y: state.y, tap: moved < 6 });
    if (moved < 6) emit('tap', { x: state.x, y: state.y });
  }
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
  element.addEventListener('lostpointercapture', () => { pointerId = null; state.pointerActive = false; });

  function onKeyDown(e) {
    if (!enabled) return;
    if (document.querySelector('dialog[open]')) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      keys[e.key === 'ArrowLeft' ? 'left' : 'right'] = true;
    }
    if (e.repeat) return;
    emit('key', e);
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    state, keys, reset,
    on(name, fn) { listeners[name].push(fn); return () => {
      const i = listeners[name].indexOf(fn);
      if (i >= 0) listeners[name].splice(i, 1);
    }; },
    setEnabled(value) { enabled = value; if (!value) reset(); },
    setMode(mode) { state.mode = mode; reset(); },
    setInverted(value) { state.inverted = !!value; },
    poll() {
      const left = keys.left ? 1 : 0, right = keys.right ? 1 : 0;
      state.axis = (right - left) * (state.inverted ? -1 : 1);
      return state.axis;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      reset();
    }
  };
}
