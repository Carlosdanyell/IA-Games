# Arquitetura da biblioteca

Objetivo: adicionar um jogo novo sem tocar em nada que já existe.

```
index.html              Launcher: lê core/registry.js e monta os cards
play.html?game=<id>     Shell genérico: carrega games/<id>/index.js
sw.js                   Cache offline (atualize ASSETS + VERSION ao adicionar jogos)
manifest.webmanifest    PWA instalável

core/                   Infraestrutura compartilhada, sem lógica de jogo
  shell.js              Boot: monta serviços, injeta no jogo, roda o loop
  shell.css             Tokens visuais e chrome (tema claro/escuro, responsivo)
  hud.js                Topbar, placar, chips, overlay, toast, diálogo
  loop.js               Passo fixo + acumulador + interpolação + FPS
  viewport.js           Escala UNIFORME com letterbox (nunca deforma)
  collide.js            Varredura contínua círculo x retângulo (CCD)
  input.js              Ponteiro, teclado, modo absoluto/arrasto, inversão
  audio.js              WebAudio com ganho mestre e teto de vozes
  haptics.js            Vibração
  storage.js            localStorage com namespace por jogo
  theme.js              Temas e paletas
  sprites.js            Cache de sprites fora da tela
  debug.js              Overlay de diagnóstico (?debug=1)
  rng.js                Gerador com semente (fases reproduzíveis)
  registry.js           Catálogo de jogos

games/<id>/             Um jogo, autocontido
```

## Contrato de um jogo

`games/<id>/index.js` exporta:

```js
export const meta = {
  id, title, subtitle, arenaLabel,
  logicalSize(aspect) -> { w, h },      // campo lógico; o shell cuida da escala
  stats: [{ id, label, accent?, type?: 'hearts', flex? }]
};

export function create(services) {
  // services = { viewport, input, audio, haptics, theme, hud, debug, store, appStore, stats }
  return {
    update(dt),            // passo fixo — só física e estado
    render(dt, alpha),     // desenho; alpha interpola entre passos
    resize(),              // chamado após o viewport recalcular
    primaryAction(), secondaryAction(), pause(), resume(), pauseToggle(),
    openSettings(), onHidden(), onThemeChange(), getState(), destroy()
  };
}
```

Regras que o shell garante e o jogo não precisa reimplementar:

- a simulação roda em passo fixo e não depende do FPS;
- o canvas nunca deforma: escala igual em X e Y, sobra vira letterbox;
- `store` é isolado por jogo; `appStore` guarda tema, som e vibração;
- escritas no HUD são acumuladas e aplicadas uma vez por frame.

## Checklist para publicar um jogo novo

1. Criar `games/<id>/index.js` seguindo o contrato.
2. Registrar em `core/registry.js` (id, título, tagline, tags, cor, `entry`).
3. Acrescentar os arquivos do jogo em `sw.js` (`ASSETS`) e subir `VERSION`.
4. Abrir `play.html?game=<id>&debug=1` e conferir hitboxes e FPS.
