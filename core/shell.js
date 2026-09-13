import { createHud } from './hud.js';
import { createViewport } from './viewport.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHaptics } from './haptics.js';
import { createTheme } from './theme.js';
import { createStore } from './storage.js';
import { createLoop } from './loop.js';
import { createDebug } from './debug.js';
import { getGame } from './registry.js';

// Shell genérico da biblioteca.
//
// Contrato de um jogo (games/<id>/index.js):
//   export const meta = { id, title, subtitle, arenaLabel, stats[], logicalSize(aspect) }
//   export function create(services) -> {
//     update(dt), render(dt, alpha), resize(),
//     primaryAction(), secondaryAction(), pause(), resume(), pauseToggle(),
//     openSettings(), onHidden(), onThemeChange(), getState(), destroy()
//   }
// Tudo o que o jogo precisa (tela, entrada, som, tema, persistência, HUD)
// chega pronto em `services`. Adicionar um jogo novo não exige tocar no shell.

export async function boot(gameId, root) {
  const entry = getGame(gameId);
  if (!entry) {
    root.innerHTML = `<main class="app"><h1>Jogo não encontrado</h1>
      <p><a href="./index.html">Voltar para a biblioteca</a></p></main>`;
    return null;
  }

  const mod = await import(new URL(entry.entry, document.baseURI).href);
  const handlers = {};
  document.title = `${entry.title} · IA Games`;

  const hud = createHud(root, {
    title: mod.meta.title,
    subtitle: mod.meta.subtitle,
    arenaLabel: mod.meta.arenaLabel,
    stats: mod.meta.stats,
    backHref: './index.html',
    onAction: () => handlers.game?.primaryAction(),
    onSecondary: () => handlers.game?.secondaryAction(),
    onPauseToggle: () => handlers.game?.pauseToggle(),
    onSettings: () => handlers.game?.openSettings(),
    onSound: () => { audio.setEnabled(!audio.enabled); hud.setSound(audio.enabled); audio.resume();
                     audio.tone({ freq: 680, dur: 0.07 }); },
    onTheme: () => theme.toggleMode()
  });

  const appStore = createStore('app');
  const gameStore = createStore(gameId);
  const audio = createAudio(appStore);
  const haptics = createHaptics(appStore);
  const debug = createDebug();
  const theme = createTheme(appStore, {
    onChange: (tokens, mode) => { hud.setThemeIcon(mode === 'dark'); handlers.game?.onThemeChange?.(); }
  });

  const viewport = createViewport(hud.canvas, { logical: mod.meta.logicalSize });
  viewport.resize();

  const input = createInput(hud.arena, viewport, {
    mode: gameStore.get('control', 'absolute'),
    sensitivity: gameStore.get('sensitivity', 1.6)
  });

  const loop = createLoop({
    update: dt => handlers.game?.update(dt),
    render: (dt, alpha) => handlers.game?.render(dt, alpha)
  });

  const game = mod.create({
    viewport, input, audio, haptics, theme, hud, debug,
    store: gameStore, appStore, stats: loop.stats
  });
  handlers.game = game;

  hud.setSound(audio.enabled);
  hud.setThemeIcon(theme.mode === 'dark');
  hud.setHint(window.matchMedia('(pointer: coarse)').matches
    ? 'Controle com <strong>um dedo</strong>'
    : 'Mouse ou <span class="key">←</span> <span class="key">→</span>');
  game.resize();

  // Redimensionamento coalescido em um único quadro: no celular o
  // ResizeObserver dispara em rajada quando a barra de endereço aparece.
  let pendingResize = 0;
  const scheduleResize = () => {
    if (pendingResize) return;
    pendingResize = requestAnimationFrame(() => {
      pendingResize = 0;
      viewport.invalidateRect();
      if (viewport.resize()) game.resize();
    });
  };
  if ('ResizeObserver' in window) new ResizeObserver(scheduleResize).observe(hud.arena);
  else window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);

  document.addEventListener('visibilitychange', () => { if (document.hidden) game.onHidden?.(); });
  window.addEventListener('blur', () => { input.reset(); game.onHidden?.(); });
  window.addEventListener('pagehide', () => loop.stop(), { once: true });

  loop.start();

  // Ferramentas opcionais para agentes/automação, quando o navegador expõe a API.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = tool => {
      try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
      catch (_) {}
    };
    register({
      name: 'read_game_state', title: 'Consultar partida',
      description: 'Retorna estado, fase, pontos, vidas, bolinhas e efeitos ativos.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => game.getState()
    });
    register({
      name: 'control_game', title: 'Controlar partida',
      description: 'play avança, pause pausa, resume retoma, restart zera a partida.',
      inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['play', 'pause', 'resume', 'restart'] } },
                     required: ['action'], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: input => {
        const action = input?.action;
        if (!['play', 'pause', 'resume', 'restart'].includes(action)) throw new Error('Ação inválida.');
        if (hud.dialogOpen) throw new Error('Feche o painel de ajustes antes de controlar a partida.');
        if (action === 'play') game.primaryAction();
        else if (action === 'pause') game.pause();
        else if (action === 'resume') game.resume();
        else { game.pause(); game.secondaryAction(); }
        return game.getState();
      }
    });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }

  // Exposto para diagnóstico manual e testes automatizados.
  window.__iaGame = { game, loop, viewport, debug, hud };
  return game;
}
