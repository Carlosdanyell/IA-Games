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

  function noise({ dur = 0.12, vol = 0.05, cutoff = 1200 } = {}) {
    if (!enabled) return;
    const c = ensure();
    if (!c || c.state !== 'running' || !budgetOk()) return;
    try {
      const frames = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, frames, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const g = c.createGain();
      g.gain.value = vol;
      src.connect(filter); filter.connect(g); g.connect(master);
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
