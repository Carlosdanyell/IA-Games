// Som do Neon Shooter: efeitos sintetizados e trilha synthwave procedural.
// Nenhum arquivo de áudio: tudo nasce de osciladores e ruído, então funciona
// offline e não pesa no download. Efeitos e música têm volumes separados; o
// botão de som do topo da biblioteca continua sendo o mudo geral.

const midi = n => 440 * 2 ** ((n - 69) / 12);

const TRACKS = {
  menu: { bpm: 96, prog: [[45, 48, 52], [40, 43, 47], [41, 45, 48], [43, 47, 50]], pad: true, arp: 4, hat: false },
  play: { bpm: 118, prog: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], kick: true, snare: true, hat: true, bass: true, arp: 2 },
  boss: { bpm: 132, prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], kick: true, snare: true, hat: true, fastHat: true, bass: true, arp: 1 }
};

// Intervalo mínimo entre repetições do mesmo efeito: 8 tiros por segundo
// soando todos viram ruído e cansam o ouvido.
const THROTTLE = { shoot: 0.075, hit: 0.035, enemyShot: 0.09, bossHit: 0.06, bossShot: 0.08, kill: 0.025, pickup: 0.05 };

export function createSoundEngine(masterService) {
  let ctx = null, master, sfxBus, musicBus, musicFilter, noiseBuffer;
  let settings = { sfx: true, sfxVolume: 0.8, music: true, musicVolume: 0.45 };
  let track = null, trackName = 'off', step = 0, nextTime = 0, timer = 0;
  let ducked = false, voices = 0, masterOn = null;
  const lastPlayed = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000;
      musicBus = ctx.createGain(); musicBus.connect(musicFilter); musicFilter.connect(master);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      applyLevels(true);
    } catch (_) { ctx = null; }
    return ctx;
  }

  const ramp = (param, value, instant) => {
    if (instant) param.value = value;
    else param.setTargetAtTime(value, ctx.currentTime, 0.08);
  };

  function applyLevels(instant = false) {
    if (!ctx) return;
    masterOn = masterService.enabled;
    ramp(master.gain, masterOn ? 1 : 0, instant);
    ramp(sfxBus.gain, settings.sfx ? settings.sfxVolume * 0.9 : 0, instant);
    ramp(musicBus.gain, settings.music ? settings.musicVolume * (ducked ? 0.35 : 0.6) : 0, instant);
    ramp(musicFilter.frequency, ducked ? 900 : 18000, instant);
  }

  function voice(dest, { type = 'sine', freq, end, t, dur, vol, attack = 0.004, filter = 0, q = 0.7 }) {
    if (voices > 28) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    voices++;
    o.onended = () => { voices--; };
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dest, { t, dur, vol, type = 'lowpass', freq = 1200, end = 0, q = 0.8 }) {
    if (voices > 28) return;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (end) f.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    voices++;
    src.onended = () => { voices--; };
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  const notes = (list, t, gap, opts) => list.forEach((f, i) => voice(sfxBus, { ...opts, freq: f, t: t + i * gap }));

  const SFX = {
    shoot: t => voice(sfxBus, { type: 'square', freq: 1150, end: 520, t, dur: 0.055, vol: 0.03, filter: 3200 }),
    hit: t => noise(sfxBus, { t, dur: 0.045, vol: 0.07, type: 'highpass', freq: 2600 }),
    crit: t => { voice(sfxBus, { type: 'triangle', freq: 1600, end: 900, t, dur: 0.08, vol: 0.07 }); noise(sfxBus, { t, dur: 0.06, vol: 0.08, type: 'highpass', freq: 3000 }); },
    kill: (t, o) => {
      const big = (o?.r || 0) >= 16;
      noise(sfxBus, { t, dur: big ? 0.45 : 0.22, vol: big ? 0.26 : 0.15, freq: big ? 1500 : 2600, end: 160 });
      voice(sfxBus, { freq: big ? 170 : 250, end: 45, t, dur: big ? 0.35 : 0.16, vol: big ? 0.28 : 0.14 });
    },
    enemyShot: t => voice(sfxBus, { type: 'sawtooth', freq: 540, end: 300, t, dur: 0.09, vol: 0.028, filter: 1800 }),
    playerHit: t => {
      voice(sfxBus, { type: 'sawtooth', freq: 260, end: 70, t, dur: 0.36, vol: 0.16, filter: 1400 });
      noise(sfxBus, { t, dur: 0.32, vol: 0.2, freq: 900, end: 120 });
    },
    shieldBlock: t => voice(sfxBus, { type: 'triangle', freq: 900, end: 1500, t, dur: 0.16, vol: 0.09 }),
    aegis: t => voice(sfxBus, { type: 'sine', freq: 400, end: 1200, t, dur: 0.3, vol: 0.08 }),
    pickup: t => notes([660, 880, 1320], t, 0.055, { type: 'triangle', dur: 0.12, vol: 0.085 }),
    bomb: t => {
      noise(sfxBus, { t, dur: 1.1, vol: 0.38, freq: 2400, end: 60 });
      voice(sfxBus, { freq: 95, end: 26, t, dur: 0.95, vol: 0.42 });
    },
    levelUp: t => notes([523, 659, 784, 1047, 1319], t, 0.06, { type: 'square', dur: 0.14, vol: 0.045, filter: 4200 }),
    upgrade: t => notes([784, 1175, 1568], t, 0.05, { type: 'triangle', dur: 0.18, vol: 0.08 }),
    waveStart: t => notes([392, 587], t, 0.1, { type: 'triangle', dur: 0.2, vol: 0.06 }),
    waveClear: t => {
      notes([523, 659, 784], t, 0, { type: 'triangle', dur: 0.55, vol: 0.05 });
      notes([1047, 1319, 1568], t + 0.12, 0.06, { type: 'sine', dur: 0.25, vol: 0.04 });
    },
    bossWarning: t => {
      for (let i = 0; i < 3; i++) {
        voice(sfxBus, { type: 'sawtooth', freq: 440, end: 880, t: t + i * 0.55, dur: 0.26, vol: 0.07, filter: 2400 });
        voice(sfxBus, { type: 'sawtooth', freq: 880, end: 440, t: t + i * 0.55 + 0.27, dur: 0.26, vol: 0.07, filter: 2400 });
      }
    },
    bossSpawn: t => { voice(sfxBus, { type: 'sawtooth', freq: 55, end: 110, t, dur: 1.2, vol: 0.18, filter: 600 }); noise(sfxBus, { t, dur: 1, vol: 0.12, freq: 300, end: 1800 }); },
    bossPhase: t => { noise(sfxBus, { t, dur: 0.6, vol: 0.22, freq: 1200, end: 100 }); voice(sfxBus, { type: 'square', freq: 110, end: 55, t, dur: 0.5, vol: 0.12, filter: 900 }); },
    bossTelegraph: t => voice(sfxBus, { freq: 320, end: 960, t, dur: 0.32, vol: 0.05 }),
    bossShot: t => voice(sfxBus, { type: 'square', freq: 380, end: 180, t, dur: 0.12, vol: 0.035, filter: 1600 }),
    bossHit: t => noise(sfxBus, { t, dur: 0.04, vol: 0.05, type: 'bandpass', freq: 1800, q: 2 }),
    bossSlam: t => { voice(sfxBus, { freq: 110, end: 35, t, dur: 0.45, vol: 0.3 }); noise(sfxBus, { t, dur: 0.4, vol: 0.2, freq: 700, end: 90 }); },
    bossDown: t => {
      for (let i = 0; i < 5; i++) noise(sfxBus, { t: t + i * 0.18, dur: 0.55, vol: 0.28, freq: 1900 - i * 220, end: 90 });
      voice(sfxBus, { freq: 120, end: 24, t, dur: 1.7, vol: 0.42 });
    },
    dash: t => noise(sfxBus, { t, dur: 0.26, vol: 0.09, type: 'bandpass', freq: 700, end: 3200, q: 1.4 }),
    summon: t => voice(sfxBus, { type: 'triangle', freq: 200, end: 700, t, dur: 0.3, vol: 0.06 }),
    gameOver: t => notes([392, 330, 262, 196], t, 0.17, { type: 'triangle', dur: 0.32, vol: 0.09 }),
    achievement: t => notes([988, 1319, 1976], t, 0.07, { type: 'sine', dur: 0.3, vol: 0.07 }),
    ui: t => voice(sfxBus, { type: 'triangle', freq: 880, end: 1100, t, dur: 0.05, vol: 0.05 }),
    select: t => notes([660, 990], t, 0.05, { type: 'triangle', dur: 0.1, vol: 0.07 })
  };

  function play(name, opts) {
    if (!ctx || ctx.state !== 'running' || !settings.sfx || !masterOn || !SFX[name]) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name];
    if (gap && now - (lastPlayed[name] || 0) < gap) return;
    lastPlayed[name] = now;
    try { SFX[name](now + 0.005, opts); } catch (_) {}
  }

  // ---------------------------------------------------------------- música
  function drum(kind, t) {
    if (kind === 'kick') voice(musicBus, { freq: 150, end: 42, t, dur: 0.22, vol: 0.55, attack: 0.002 });
    else if (kind === 'snare') noise(musicBus, { t, dur: 0.16, vol: 0.2, type: 'bandpass', freq: 1800, q: 0.9 });
    else noise(musicBus, { t, dur: 0.04, vol: 0.09, type: 'highpass', freq: 7000 });
  }

  function playStep(s, t) {
    const beat = 60 / track.bpm / 4;
    const bar = Math.floor(s / 16) % 4, pos = s % 16, chord = track.prog[bar];
    if (track.kick && pos % 4 === 0) drum('kick', t);
    if (track.snare && (pos === 4 || pos === 12)) drum('snare', t);
    if (track.hat && (pos % 4 === 2 || (track.fastHat && pos % 2 === 1))) drum('hat', t);
    if (track.bass && pos % 2 === 0) {
      voice(musicBus, { type: 'sawtooth', freq: midi(chord[0] - 12 + (pos % 8 === 6 ? 12 : 0)), t, dur: beat * 1.7, vol: 0.16, filter: 520, q: 4 });
    }
    if (track.arp && pos % track.arp === 0) {
      const tone = chord[[0, 1, 2, 1][Math.floor(pos / track.arp) % 4]] + (bar % 2 ? 24 : 12);
      voice(musicBus, { type: 'square', freq: midi(tone), t, dur: beat * 0.9, vol: 0.05, filter: 2600 });
    }
    if (track.pad && pos === 0) {
      for (const n of chord) {
        voice(musicBus, { type: 'sawtooth', freq: midi(n), t, dur: beat * 16, vol: 0.035, attack: 0.6, filter: 900 });
        voice(musicBus, { type: 'sawtooth', freq: midi(n) * 1.006, t, dur: beat * 16, vol: 0.03, attack: 0.6, filter: 900 });
      }
    }
  }

  function schedule() {
    if (!ctx || !track || ctx.state !== 'running') return;
    if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.14) {
      if (settings.music && masterOn) playStep(step, nextTime);
      nextTime += 60 / track.bpm / 4;
      step = (step + 1) % 64;
    }
  }

  function setMusic(name) {
    if (name === trackName) return;
    trackName = name;
    track = TRACKS[name] || null;
    if (!track) { clearInterval(timer); timer = 0; return; }
    if (!timer && typeof setInterval === 'function') timer = setInterval(schedule, 30);
    if (ctx) nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
  }

  return {
    play, setMusic,
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    configure(next) { settings = { ...settings, ...next }; applyLevels(); },
    duck(value) { if (ducked !== value) { ducked = value; applyLevels(); } },
    // Chamado todo quadro: acompanha o botão de som geral da biblioteca.
    tick() { if (ctx && masterService.enabled !== masterOn) applyLevels(); },
    destroy() {
      clearInterval(timer);
      timer = 0;
      track = null;
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
    }
  };
}
