# IA Games

[![CI](https://github.com/Carlosdanyell/IA-Games/actions/workflows/ci.yml/badge.svg)](https://github.com/Carlosdanyell/IA-Games/actions/workflows/ci.yml)

Biblioteca de jogos em HTML que funcionam **offline**, feitos para celular.
Sem framework, sem build, sem dependências: HTML, CSS e JavaScript com módulos ES.

**Jogar:** abra [carlosdanyell.github.io/IA-Games](https://carlosdanyell.github.io/IA-Games/) e escolha um título.

---

## Títulos

| Jogo | Descrição |
|---|---|
| **Neon Snake** | Cobrinha neon com movimento livre e controle por arrasto, quatro modos, três dificuldades, seis arenas e seis visuais desbloqueáveis, bônus, combos, conquistas e progresso salvo offline. Só na horizontal: o tabuleiro ganha colunas até ocupar a largura da tela. |
| **Neon Break** | Quebra-blocos com multibola, 12 cápsulas, 9 tipos de bloco, 3 modos e 25 arenas. Guarda a partida a cada arena. |
| **Neon Words** | Cruzadinha com roda de letras: 50 fases em português, palavras bônus fora da grade, dicas e desbloqueio progressivo de letras. |
| **Neon Arrow** | Tiro ao alvo com arco: acerte a maçã na cabeça do parceiro. 25 fases com vento, alvo em movimento e lanterna de vida extra, quatro níveis de dificuldade e efeitos de sangue reguláveis. Só na horizontal. |
| **Neon Grid** | Jogo da velha com três níveis de IA: fácil aleatório, médio tático e difícil imbatível. Rodada e placar salvos no aparelho. |
| **Neon Drop** | Lig 4 com nove tabuleiros diferentes — tamanhos, conecta 4 ou 5 e obstáculos —, quatro níveis de máquina e modo dois jogadores no mesmo aparelho. |
| **Neon Pool** | Sinuca 8-ball com regras completas, máquina de três níveis, dois jogadores no mesmo aparelho ou multiplayer em aparelhos no mesmo Wi-Fi. Mesa na horizontal. |
| **Neon Slither** | Arena aberta com rivais controlados por IA: colete luz, cresça e cerque os outros. Minimapa, ranking ao vivo, 16 skins com padrões próprios, prévias e oito opções iniciais; as demais abrem pelo recorde e três níveis de rival, tudo offline. |
| **Neon Memo** | Jogo da memória com 65 figuras reais (bichos, frutas, transporte, música, natureza, casa, esportes e mar) em 25 fases. Sete regras diferentes — trinca, par por tema, camaleão coringa, troca-troca e relâmpago —, espiada inicial, combos, dicas, estrelas por fase e desafio do dia. |
| **Neon Shooter** | Tiro espacial vertical feito para o dedo: oito tipos de inimigo, chefe com três fases a cada cinco ondas, nove power-ups, melhorias a cada nível, combos, conquistas e trilha synthwave gerada no aparelho. |
| **Neon Chess** | Xadrez com regras completas — roque, en passant, promoção, afogamento, tripla repetição, regra dos 50 lances e material insuficiente. Cinco níveis de máquina (busca alfa-beta com prazo por lance), dois jogadores no mesmo aparelho ou multiplayer em aparelhos no mesmo Wi-Fi, histórico em notação algébrica, voltar lance e partida salva no aparelho. |

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

## Neon Snake

Arraste em qualquer lugar da arena e a cobra vira suavemente para a direção do
dedo, como no slither.io: uma seta na frente da cabeça mostra o rumo, e soltar
mantém a direção. No computador, a cobra segue o mouse ou as **setas**/**WASD**;
**Espaço** pausa a partida.

O jogo é deitado. O tabuleiro tem sempre 20 linhas e ganha colunas conforme a
largura da tela, de 24 a 40, e os obstáculos de cada arena acompanham a
proporção. Em retrato, a partida pausa e aparece o aviso para girar o aparelho.
A curva tem raio fixo e curto: a meia-volta cabe em pouco mais de uma casa, em
qualquer velocidade.

- **Clássico:** evite as paredes e o próprio corpo.
- **Sem Paredes:** atravesse as bordas para surgir do lado oposto.
- **Desafio:** cumpra objetivos progressivos entre obstáculos e áreas perigosas.
- **Zen:** jogue com velocidade mais baixa e progressão tranquila.

As dificuldades **Fácil**, **Normal** e **Difícil** alteram velocidade, obstáculos
e duração dos bônus. O total de alimentos coletados libera seis mapas: **Grid
Neon**, **Circuito**, **Labirinto**, **Arena Hex**, **Cyber City** e **Void**.
Seis aparências da cobra — **Lima Neon**, **Ciano Elétrico**, **Rosa
Cibernético**, **Âmbar Solar**, **Gelo** e **Arco-Íris** — abrem com marcas do
histórico: partidas jogadas, tamanho, combo, pontuação e alimentos. A troca vale
na hora, mesmo no meio da partida.
Alimentos especiais, multiplicador, escudo, redutor, slow motion e turbo criam
novas oportunidades de pontuação. Efeitos sonoros e música têm controles separados.

Recordes gerais, por modo e por dificuldade, mapas, configurações, conquistas e
estatísticas ficam salvos no navegador do aparelho. Após o primeiro carregamento
completo por HTTP local ou pelo GitHub Pages, o service worker guarda os arquivos
no cache da PWA para continuar jogando sem internet. Aguarde o indicador
**Disponível offline** na biblioteca antes de desconectar; nenhum recurso remoto,
login ou servidor de jogo é necessário durante a partida.

## Neon Pool multiplayer

Toque em **Jogar na mesma rede**. Um jogador cria a sala e envia o convite; o
amigo gera e devolve a resposta; quem criou cola a resposta e toca em **Conectar**.
A conexão é direta entre os aparelhos, sem instalar servidor e compatível com
GitHub Pages. Wi-Fi com isolamento de aparelhos pode impedir a conexão.

Instruções, limitações de rede, arquitetura e testes:
[`docs/NEON-POOL-MULTIPLAYER.md`](docs/NEON-POOL-MULTIPLAYER.md).

## Neon Shooter

Arraste em qualquer lugar da tela para pilotar: a nave acompanha o dedo sem ficar
embaixo dele. Nas configurações dá para trocar pelo joystick virtual. O tiro é
automático enquanto houver inimigos. No computador, use **WASD** ou as **setas**
para mover, **Espaço** ou clique para atirar com o tiro automático desligado e
**Esc** para pausar.

- **Ondas:** drones, dardos, atiradores, ziguezagues, blindados, divisores,
  caçadores e sentinelas entram aos poucos, um tipo novo por onda. Quanto mais
  tarde a onda, mais inimigos que atiram ela traz. A cada cinco ondas surge um
  chefe com três fases, e todo ataque dele é anunciado antes; cada fase que cai
  solta um power-up.
- **Power-ups:** reparo, escudo, cadência, tiro duplo, tiro triplo, perfurante,
  dano, câmera lenta e bomba.
- **Melhorias:** a barra verde no topo enche com os abates. No intervalo entre
  ondas a ação pausa e você escolhe um entre três cartões, um por onda — menos
  no intervalo que antecede o chefe, em que saem todas as guardadas.
- **Dificuldade:** Fácil, Normal e Difícil mudam a pressão da onda (quantidade
  de inimigos, cadência de tiro e a carência depois do dano), não o tamanho da
  vida do chefe: chefe com muita vida deixa a luta longa, não difícil.
- **Pontos:** abates sem levar dano sobem o combo, e a cada 10 o multiplicador
  aumenta. Onda terminada sem dano vale o dobro de bônus.

Recordes, dificuldade, configurações, conquistas e estatísticas ficam salvos no
aparelho. Efeitos reduzidos e tremor de tela desligável ajudam em celulares mais
simples.

## Rodar localmente

Os módulos ES exigem um servidor HTTP (abrir o arquivo direto pelo `file://` não
funciona):

```bash
npx http-server -p 8080 -c-1 .
# http://localhost:8080
```

## Testes

Sem instalar dependências, com Node 22 ou mais novo:

```bash
node --experimental-vm-modules --test "tests/*.test.mjs"
```

Além do multiplayer do Neon Pool, os testes conferem o cache offline: todo arquivo
de `core/`, `games/` e `assets/` precisa estar em `ASSETS` no `sw.js`, e todo jogo
precisa estar em `core/registry.js`. Com a variável `BASE_REF=origin/main`, eles
também exigem `VERSION` nova quando algum desses arquivos mudou. O CI roda os
testes em cada PR e em cada push na `main`.

## Publicação

O site é servido pelo GitHub Pages a partir do branch `main`, pasta raiz
(Settings → Pages → Deploy from a branch). O arquivo `.nojekyll` garante que
os diretórios sejam servidos como estão, sem processamento do Jekyll.
Cada commit em `main` publica o site. Por isso o trabalho vai em branch e entra
na `main` por PR, depois que o CI passa.

## Adicionar um jogo

1. `games/<id>/index.js` exportando `meta` e `create(services)`.
2. Registrar em `core/registry.js` e desenhar a capa em `covers` no `index.html`.
3. Listar os arquivos novos em `ASSETS` no `sw.js` e subir `VERSION`.
4. Acrescentar o jogo na tabela de títulos deste README.

O shell cuida de tela, entrada, som, tema, HUD e persistência: o jogo só
implementa a própria lógica e desenha no canvas que recebe.
