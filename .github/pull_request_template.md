## O que muda

<!-- Uma ou duas frases. Se resolve uma issue, escreva: Closes #123 -->

## Como testei

- [ ] Abri no celular (ou na emulação) na orientação que o jogo usa
- [ ] `play.html?game=<id>&debug=1` sem erro no console

## Checklist

- [ ] Arquivo novo ou alterado em `core/`, `games/`, `assets/` ou nas páginas: está em `ASSETS` e `VERSION` subiu no `sw.js`
- [ ] Jogo novo: entrada em `core/registry.js`, capa no `index.html` e linha na tabela do `README.md`
- [ ] Testes passando: `node --experimental-vm-modules --test "tests/*.test.mjs"`
