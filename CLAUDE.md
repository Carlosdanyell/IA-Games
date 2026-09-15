# IA Games

Biblioteca de jogos em HTML para celular que funcionam offline. Sem framework, sem
build e sem dependências: os módulos ES são publicados como estão pelo GitHub Pages.

- Contrato entre shell e jogo: `docs/ARCHITECTURE.md`
- Multiplayer do Neon Pool: `docs/NEON-POOL-MULTIPLAYER.md`

## Convenções

- Tudo em português do Brasil: textos dos jogos, docs, comentários e commits.
- Commits no formato `tipo(escopo): descrição`. Tipos em uso: `feat`, `fix`, `chore`,
  `ci`, `docs`. O escopo é o id do jogo (`neon-drop`, `eight-ball`) ou a área
  (`core`, `menu`, `pwa`).
- Não adicionar dependências nem etapa de build.

## Rodar e testar

```bash
npx http-server -p 8080 -c-1 .
node --experimental-vm-modules --test "tests/*.test.mjs"
```

- Os módulos ES não abrem por `file://`; use o servidor.
- `play.html?game=<id>&debug=1` mostra FPS, hitboxes e o log de colisões.
- Com a variável `BASE_REF=origin/main`, os testes também conferem se `VERSION` subiu.

## Cache offline (sw.js)

- Arquivo novo em `core/`, `games/` ou `assets/` entra em `ASSETS`.
- Qualquer mudança em arquivo listado em `ASSETS` exige subir `VERSION`
  (`ia-games-vN` para `vN+1`).
- `tests/pwa-assets.test.mjs` confere as duas regras, e o CI roda esse teste.

## Jogo novo

1. `games/<id>/index.js` exportando `meta` e `create(services)`.
2. Entrada em `core/registry.js` e capa em `covers` no `index.html`.
3. Arquivos em `ASSETS`, `VERSION` nova e linha na tabela de títulos do `README.md`.
4. Classes CSS com prefixo próprio do jogo (`ns-` no Neon Snake, `sh-` no Neon Shooter),
   para um jogo nunca herdar estilos de outro.

## GitHub

- `main` é produção: cada commit em `main` publica https://carlosdanyell.github.io/IA-Games/.
- Trabalhe em branch e abra PR para `main`; o CI (`.github/workflows/ci.yml`) roda os testes.
- Antes de continuar num branch antigo, traga a `main` para ele. Nunca publique uma
  árvore antiga sobre a `main`.
