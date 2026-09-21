# Neon Chess · interface 2D

O tabuleiro usa uma referência de 736 × 736, com oito linhas e oito colunas
de 92. A moldura acrescenta 46 de cada lado. Largura e altura disponíveis
determinam uma única escala; peças e linhas vazias não alteram a grade.
As coordenadas externas acompanham o giro, mantendo A8 clara e A1 escura.

Os doze SVGs em `games/neon-chess/pieces/` são independentes e funcionam
offline. Todos usam `viewBox="0 0 92 92"`, centro horizontal em 46 e base em
84. Silhueta, contorno de 2 unidades, volume e sombra escalam juntos.
As peças brancas são creme; as pretas, grafite. Nenhuma fonte ou imagem
externa é necessária.

Em **Ajustes & regras**, **Madeira clássica** preserva a madeira clara/escura;
**Cor da biblioteca** tinge casas e moldura com a paleta compartilhada.
As oito cores e os temas claro/escuro continuam sendo preferências globais.
O acabamento é salvo apenas na sessão do xadrez, junto dos lances existentes.

Toque + destino, mouse, arrasto e teclado usam os mesmos lances legais.
Movimentos duram 160 ms; capturas desaparecem em 100 ms. No arrasto, a peça
fica acima das outras e cresce apenas 3%. Ao soltar, ela não repete a viagem.
Roque anima rei e torre; en passant remove a peça da casa correta.
`prefers-reduced-motion` desativa as animações dos lances.

A superfície da partida tem seu próprio contexto de empilhamento. Pausa,
resultado e confirmações ficam acima de todas as peças e bloqueiam a
interação com a partida. A promoção oferece dama, torre, bispo e cavalo,
mantém o foco nas opções e o devolve ao tabuleiro ao terminar.

## Verificação

Execute a suíte da biblioteca:

```sh
BASE_REF=origin/main node --experimental-vm-modules --test 'tests/*.test.mjs'
```

Com o servidor local iniciado, abra `tests/chess-ui-browser.html`.
O teste usa o jogo real em seis tamanhos, incluindo celular em retrato e
paisagem. Confere geometria antes/depois de capturas, ausência de corte
horizontal, camadas da pausa, bloqueio de Z, giro, promoção e 16 combinações
de tema/paleta. Ele restaura a sessão e as preferências anteriores ao terminar.

Para conferir o gesto real, arraste uma peça, solte numa casa legal e depois
fora do tabuleiro. Confira também pausa durante o gesto, recarga da página,
roque, en passant e a preferência do sistema por movimento reduzido.

Arquivos do jogo e sprites estão no precache do `sw.js`. Mudanças futuras
nesses arquivos precisam incrementar `VERSION`. O teste do PWA também
compila o worker para detectar erros de sintaxe antes da publicação.
