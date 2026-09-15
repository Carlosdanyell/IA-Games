// Áudio sintetizado localmente: nenhuma requisição, arquivo ou biblioteca externa.
export function createSnakeAudio() {
  let context = null;
  let master = null;
  let effectBus = null;
  let musicBus = null;
  let effects = true;
  let music = false;
  let playing = false;
  let unlocked = false;
  let disposed = false;
  let timer = null;
  let nextBeat = 0;
  let beat = 0;
  const active = new Set();
  const lastPlayed = new Map();
  const melody = [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 3, 10, 14, 10];

  function ensure() {
    if (disposed) return null;
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain(); master.gain.value = 0.55;
      effectBus = context.createGain(); effectBus.gain.value = effects ? 1 : 0;
      musicBus = context.createGain(); musicBus.gain.value = music && playing ? 1 : 0;
      effectBus.connect(master); musicBus.connect(master); master.connect(context.destination);
      return context;
    } catch (_) {
      context = null;
      return null;
    }
  }

  function voice(frequency, duration, { delay = 0, wave = 'sine', gain = 0.09, slide = 1, channel = 'effects' } = {}) {
    if (!context || context.state !== 'running' || active.size >= 24) return;
    try {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = context.currentTime + Math.max(0, delay);
      const end = start + duration;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (slide !== 1) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), end);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.min(gain, 0.16), start + Math.min(0.015, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope);
      envelope.connect(channel === 'music' ? musicBus : effectBus);
      const entry = { oscillator, envelope, channel };
      active.add(entry);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect(); active.delete(entry);
      };
      oscillator.start(start); oscillator.stop(end + 0.02);
    } catch (_) { /* Um contexto fechado nunca deve interromper a partida. */ }
  }

  function silenceMusic() {
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    for (const entry of active) {
      if (entry.channel !== 'music') continue;
      try { entry.oscillator.stop(); } catch (_) {}
      entry.oscillator.disconnect(); entry.envelope.disconnect(); active.delete(entry);
    }
    if (context && musicBus) musicBus.gain.setValueAtTime(0, context.currentTime);
    nextBeat = 0;
  }

  function scheduleMusic() {
    if (!context || context.state !== 'running' || !music || !playing || !unlocked || disposed) return;
    if (nextBeat < context.currentTime) nextBeat = context.currentTime + 0.04;
    // Antecipação curta mantém a música estável sem acumular nós durante pausas.
    while (nextBeat < context.currentTime + 0.14) {
      const delay = nextBeat - context.currentTime;
      const note = 164.81 * 2 ** (melody[beat % melody.length] / 12);
      voice(note, 0.28, { delay, gain: 0.033, wave: 'triangle', channel: 'music' });
      if (beat % 4 === 0) voice(note / 4, 0.7, { delay, gain: 0.045, channel: 'music' });
      nextBeat += 0.3;
      beat++;
    }
  }

  function updateMusic() {
    if (!context || context.state !== 'running' || !music || !playing || !unlocked || disposed) {
      silenceMusic();
      return;
    }
    musicBus.gain.setTargetAtTime(1, context.currentTime, 0.025);
    if (timer !== null) return;
    nextBeat = context.currentTime + 0.04;
    scheduleMusic();
    timer = window.setInterval(scheduleMusic, 80);
  }

  function play(type) {
    if (!effects || !unlocked || !context || context.state !== 'running' || disposed) return;
    const now = context.currentTime;
    if (now - (lastPlayed.get(type) ?? -1) < 0.045) return;
    lastPlayed.set(type, now);
    const notes = (frequencies, duration, gap, options = {}) => frequencies.forEach((frequency, i) =>
      voice(frequency, duration, { ...options, delay: i * gap }));
    switch (type) {
      case 'eat': voice(740, 0.095, { gain: 0.08, slide: 1.5 }); break;
      case 'combo': notes([880, 1109, 1318], 0.12, 0.045, { gain: 0.055 }); break;
      case 'bonus': notes([659, 988, 1318], 0.17, 0.06, { gain: 0.075, wave: 'triangle' }); break;
      case 'level': notes([330, 440, 659, 880], 0.14, 0.06, { gain: 0.06, wave: 'triangle' }); break;
      case 'record': notes([523, 659, 784, 1047, 1318], 0.24, 0.09, { gain: 0.075, wave: 'triangle' }); break;
      case 'over':
        voice(150, 0.4, { gain: 0.13, slide: 0.28, wave: 'triangle' });
        voice(310, 0.2, { gain: 0.045, slide: 0.4, wave: 'sawtooth' });
        break;
      case 'shield': notes([1200, 800, 1600], 0.12, 0.035, { gain: 0.055 }); break;
      case 'objective': notes([659, 880, 1175], 0.17, 0.07, { gain: 0.065 }); break;
      case 'ui': voice(520, 0.05, { gain: 0.04, slide: 1.15 }); break;
      default: break;
    }
  }

  return {
    unlock() {
      const c = ensure();
      if (!c) return Promise.resolve();
      unlocked = true;
      if (c.state === 'suspended') return c.resume().then(updateMusic).catch(() => {});
      updateMusic();
      return Promise.resolve();
    },
    setOptions(options = {}) {
      if (typeof options.effects === 'boolean') effects = options.effects;
      if (typeof options.music === 'boolean') music = options.music;
      if (context && effectBus) effectBus.gain.setTargetAtTime(effects ? 1 : 0, context.currentTime, 0.01);
      updateMusic();
    },
    setPlaying(value) { playing = Boolean(value); updateMusic(); },
    play,
    destroy() {
      disposed = true;
      silenceMusic();
      for (const entry of active) {
        try { entry.oscillator.stop(); } catch (_) {}
        entry.oscillator.disconnect(); entry.envelope.disconnect();
      }
      active.clear(); lastPlayed.clear();
      if (context) {
        effectBus?.disconnect(); musicBus?.disconnect(); master?.disconnect();
        context.close().catch(() => {});
      }
      context = null; master = null; effectBus = null; musicBus = null;
    }
  };
}
