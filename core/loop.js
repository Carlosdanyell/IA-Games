// Loop de passo fixo com acumulador e interpolação de render.
//
// Regras que este loop garante:
//  - a simulação avança sempre em passos idênticos (independente do FPS);
//  - um frame longo nunca gera um surto ilimitado de passos (maxSteps);
//  - o render recebe `alpha` para interpolar entre o passo anterior e o atual,
//    eliminando tremor visual quando o FPS não é múltiplo do passo físico.
export function createLoop({ step = 1 / 120, maxFrame = 0.1, maxSteps = 12, update, render }) {
  let running = false;
  let last = 0;
  let accumulator = 0;
  let raf = 0;
  let fps = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;
  const stats = { fps: 0, steps: 0, frameMs: 0, dropped: 0 };

  function frame(time) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const startedAt = performance.now();
    const raw = last ? (time - last) / 1000 : 0;
    last = time;
    const dt = Math.min(raw, maxFrame);

    accumulator += dt;
    let steps = 0;
    while (accumulator >= step && steps < maxSteps) {
      update(step);
      accumulator -= step;
      steps++;
    }
    if (accumulator >= step) {
      // Dispositivo não acompanha: descarta o excedente em vez de acumular
      // dívida temporal (evita o "espiral da morte").
      stats.dropped += Math.floor(accumulator / step);
      accumulator = accumulator % step;
    }

    fpsAccum += raw;
    fpsFrames++;
    if (fpsAccum >= 0.5) {
      fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }
    stats.fps = fps;
    stats.steps = steps;

    render(dt, accumulator / step);
    stats.frameMs = performance.now() - startedAt;
  }

  return {
    stats,
    get running() { return running; },
    start() {
      if (running) return;
      running = true;
      last = 0;
      accumulator = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // Chamado ao retomar de uma pausa: zera a dívida temporal para que o jogo
    // não execute centenas de passos de uma vez.
    resetClock() {
      last = 0;
      accumulator = 0;
    }
  };
}
