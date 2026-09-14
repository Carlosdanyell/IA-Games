// Barramento WebAudio mínimo, com orçamento por frame.
//
// O jogo original criava um oscilador por bloco destruído; uma explosão em
// cadeia criava nove no mesmo instante e estourava o áudio no celular.
// Aqui há um teto de vozes simultâneas e um ganho mestre único.
export function createAudio(store) {
  let ctx = null;
  let master = null;
  let enabled = store.get('sound', false);
  let volume = store.get('volume', 0.6);
  let voices = 0;
  let lastFrame = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }

  function resume() {
    if (!enabled) return;
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function budgetOk() {
    const now = performance.now();
    if (now - lastFrame > 16) { voices = 0; lastFrame = now; }
    return voices++ < 4;
  }

  function tone({ freq = 440, dur = 0.07, type = 'sine', vol = 0.05, slide = 0.6 } = {}) {
    if (!enabled) return;
    const c = ensure();
    if (!c || c.state !== 'running' || !budgetOk()) return;
    try {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide !== 1) {
        o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), c.currentTime + dur);
      }
      g.gain.setValueAtTime(Math.max(0.0005, vol), c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start();
      o.stop(c.currentTime + dur);
    } catch (_) {}
  }

  // Ruído com envelope e filtro opcionais. Os parâmetros extras (tipo de
  // filtro, varredura do corte, ataque e formato do envelope) são o que separa
  // um "tsc" de corda de um baque surdo — sem eles todo impacto soa igual.
  function noise({ dur = 0.12, vol = 0.05, cutoff = 1200, cutoffEnd = null,
                   filter: kind = 'lowpass', q = 1, attack = 0, curve = 'fall' } = {}) {
    if (!enabled) return;
    const c = ensure();
    if (!c || c.state !== 'running' || !budgetOk()) return;
    try {
      const frames = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, frames, c.sampleRate);
      const data = buffer.getChannelData(0);
      const rise = Math.max(1, Math.floor(frames * Math.min(0.9, attack)));
      for (let i = 0; i < frames; i++) {
        const t = i / frames;
        let env;
        if (curve === 'flat') env = 1;
        else if (curve === 'rise') env = t;
        else if (curve === 'bump') env = Math.sin(Math.PI * t);
        else env = (1 - t) * (1 - t);
        if (i < rise) env *= i / rise;
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = c.createBufferSource();
      src.buffer = buffer;
      const f = c.createBiquadFilter();
      f.type = kind;
      f.Q.value = q;
      f.frequency.setValueAtTime(cutoff, c.currentTime);
      if (cutoffEnd && cutoffEnd !== cutoff) {
        f.frequency.exponentialRampToValueAtTime(Math.max(40, cutoffEnd), c.currentTime + dur);
      }
      const g = c.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (_) {}
  }

  return {
    tone, noise, resume,
    get enabled() { return enabled; },
    get volume() { return volume; },
    setEnabled(value) {
      enabled = value;
      store.set('sound', value);
      if (value) resume();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      store.set('volume', volume);
      if (master) master.gain.value = volume;
    }
  };
}
