# IA Games

Biblioteca de jogos em HTML que funcionam **offline**, feitos para celular.
Sem framework, sem build, sem dependências: HTML, CSS e JavaScript com módulos ES.

**Jogar:** abra `index.html` (ou a página publicada) e escolha um título.

---

## Títulos

| Jogo | Descrição |
|---|---|
| **Neon Break** | Quebra-blocos com multibola, 12 cápsulas, 9 tipos de bloco, 3 modos e 25 arenas. Guarda a partida a cada arena. |
| **Neon Words** | Cruzadinha com roda de letras: 25 fases em português, dicas, desbloqueio progressivo de letras. |
| **Neon Pool** | Sinuca 8-ball com regras completas, oponente de três níveis e dois jogadores no mesmo aparelho. Só na horizontal. |

---

## O que mudou nesta versão

A versão anterior era um arquivo único com física, render, HUD, entrada e áudio
entrelaçados. O sintoma relatado — *colisões fantasmas*, com a bola mudando de
trajetória sem contato visível — tinha cinco causas distintas. Todas foram
corrigidas:

| Causa | Correção |
|---|---|
| Empurrão anti-travamento reescrevia o ângulo da bola após 11s sem destruir bloco | Substituído por aceleração gradual (visível no HUD) e, como rede, uma correção de 6° só em trajetória rasante persistente, com efeito visual e sonoro |
| Teto invisível em `y = 35`, desalinhado do HUD em HTML e variável com a largura da tela | HUD desenhado dentro do canvas; a moldura visível **é** a linha de colisão |
| Escala não uniforme (`sx ≠ sy`) achatava o campo em paisagem | Viewport com escala uniforme e letterbox; círculo é sempre círculo |
| `resize` movia blocos e bola por regras diferentes; havia teletransporte da bola | Grade calculada uma vez por fase e congelada; altura quantizada em passos de 20px |
| Resolução discreta: só um bloco por passo, escolhido pela ordem do array | Varredura contínua (CCD) com escolha do **primeiro contato no tempo**, normal correta inclusive em quinas |
| Vãos de 6px e 7px com bola de 10,8px de diâmetro: corredores visíveis eram intransponíveis | Vãos de 12px (horizontal) e 14px (vertical) contra bola de 9,6px |
| Hitbox da plataforma era AABB inflada pelo raio | Plataforma tratada como cápsula — exatamente a forma desenhada — com varredura do próprio movimento |
| `shadowBlur` em ~49 blocos por frame derrubava o FPS | Sprites pré-renderizados; escrita no DOM acumulada e aplicada uma vez por frame |

Verificação automatizada (Chromium headless, 6× de throttling de CPU, 4 bolas a
482 px/s, 20 segundos): zero bolas dentro de blocos, zero fora dos limites, zero
NaN, zero passos descartados.

Abra com `?debug=1` para ver FPS, passos por frame, hitboxes e o log das últimas
colisões.

---

## Estrutura

```
index.html            Launcher da biblioteca
play.html?game=<id>   Shell genérico que carrega um jogo
core/                 Loop, viewport, colisão, entrada, áudio, tema, HUD, storage
games/<id>/           Um jogo autocontido
sw.js                 Cache offline (PWA)
```

Detalhes do contrato entre shell e jogo: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Rodar localmente

Os módulos ES exigem um servidor HTTP (abrir o arquivo direto pelo `file://` não
funciona):

```bash
npx http-server -p 8080 -c-1 .
# http://localhost:8080
```

## Publicação

O site é servido pelo GitHub Pages a partir do branch `main`, pasta raiz
(Settings → Pages → Deploy from a branch). O arquivo `.nojekyll` garante que
os diretórios sejam servidos como estão, sem processamento do Jekyll.
Para atualizar o site publicado, faça push em `main`.

## Adicionar um jogo

1. `games/<id>/index.js` exportando `meta` e `create(services)`.
2. Registrar em `core/registry.js`.
3. Listar os arquivos novos em `sw.js` e subir `VERSION`.
