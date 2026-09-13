# Neon Pool: multiplayer na mesma rede

## Jogar

1. Abra `play.html?game=eight-ball` nos dois aparelhos, conectados ao mesmo Wi-Fi.
2. Toque em **Jogar na mesma rede** e informe seu nome.
3. Um jogador toca em **Criar sala** e envia o convite ao amigo (Copiar ou Compartilhar).
4. O amigo abre o link ou usa **Entrar na sala**, cola o convite e toca em **Gerar resposta**.
5. O amigo devolve o código de resposta. Quem criou cola a resposta e toca em **Conectar**.
6. A mesa abre automaticamente. Gire os aparelhos para a horizontal. Quem criou faz a saída.

Uma sala aceita dois jogadores. Só quem está na vez pode mirar, posicionar a branca
ou tacar. Após uma falta, o adversário recebe bola na mão. As regras e a física são
as mesmas dos modos contra a máquina e no mesmo aparelho. O placar da sala dura
enquanto a conexão existir; não altera os retrospectos dos modos locais.

Pausa vale para os dois. Para retomar ou jogar uma revanche, ambos confirmam.
Ao trocar de aplicativo ou girar para retrato a partida pausa. Mantenha a página
aberta: recarregar, fechar ou sair encerra a sala; não há recuperação após reload.
Interrupções breves que o WebRTC consegue recuperar mantêm a mesa pausada.

## Rede e hospedagem

O GitHub Pages serve os arquivos estáticos. Não executa WebSocket, Node ou servidor
de jogo. Esta implementação usa `RTCPeerConnection` / `RTCDataChannel` nativos, com
`iceServers: []`: a troca manual de convite/resposta substitui a sinalização.
Não usa PeerJS Cloud, CDN, STUN ou TURN; não pede microfone/câmera; não varre IPs.

Os candidatos ICE locais vão dentro dos próprios códigos. A coleta não espera o
estado `complete` do navegador — que em muitas máquinas nunca chega, com VPN,
mDNS lento ou interfaces virtuais: segue 1,2s após o último candidato, ou no
limite de 10s, e só falha se nenhum candidato aparecer. O link usa `#pool=...`, que
não é enviado ao GitHub Pages; o jogo remove o fragmento ao abrir o convite.
Envie os códigos somente ao adversário. Expiram em 30 minutos e deixam de funcionar
ao fechar a sala. A criptografia do transporte é a fornecida pelo WebRTC.

É preciso carregar os arquivos uma vez (o PWA guarda os módulos). Depois disso,
pareamento e jogo podem funcionar sem internet, desde que os aparelhos ainda
consigam se comunicar na mesma rede e o navegador disponibilize candidatos locais.
Uma conversa usada para compartilhar os códigos pode, por sua vez, exigir internet.

Wi-Fi de convidados com isolamento de clientes, firewall, VPN ou restrição do
navegador à rede local podem bloquear UDP/mDNS e impedir a conexão. Nesses casos,
use uma rede que permita comunicação entre os aparelhos. Não há relay para superar
esse bloqueio e não há busca automática de salas. Não se promete conexão entre
redes diferentes. Use versões atuais de Chrome, Edge, Firefox ou Safari.

Referências: [WebRTC data channels (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels),
[conectividade WebRTC (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity).

## Integração para Claude Code e próximos desenvolvedores

- `lan-transport.js`: uma conexão por sala, SDP completo, transporte ordenado,
  heartbeat, expiração, limites de pacote, backpressure e fechamento dos recursos.
- `lan-protocol.js`: versão do protocolo, validação de convites, comandos e snapshots.
- `lan-ui.js`: criar/entrar, copiar/compartilhar, instruções e mensagens de erro.
- `index.js`: mantém o motor existente. O anfitrião executa física/regras e envia
  snapshots a até 30 Hz, além das transições. O convidado aplica a mesa recebida,
  preserva sua mira durante a própria vez e envia apenas intenções.
- `render.js`: permite mostrar a mira do adversário com a barra de força desativada.
- `sw.js`: módulos novos no precache e versão incrementada. Não é necessário build.

Comandos levam `match`, `revision` e `seq`. Tacada/colocação exigem a revisão e a vez
corretas; ações repetidas, antigas, posições ocupadas e valores inválidos são
rejeitados. Somente o host transmite estado. Pausa/revanche exigem confirmação de
ambos e não permitem reiniciar unilateralmente a partida. Nomes e mensagens são
escapados nos pontos em que o HUD compartilhado usa HTML.

Ao alterar campos de estado, regras ou física que afetem compatibilidade, atualize
o protocolo nos dois lados, seus validadores e os testes. Atualize também o cache
PWA. Antes de continuar o desenvolvimento em uma branch anterior, incorpore a
`main` para preservar esta feature. Não publique uma árvore antiga sobre `main`.

## Verificação

Sem instalar dependências, com Node 22+:

```bash
node --experimental-vm-modules --test tests/lan-protocol.test.mjs tests/lan-game.test.mjs
```

O teste de jogo instancia dois contextos isolados com o código real, física e regras
reais, e substitui DOM/canvas/transporte. Cobre mesa inicial, vez, saída, falta,
colocação, tacada remota, pausa, revanche, bola 8, placar, descarte de comandos
repetidos/antigos, validação de payload e encerramento.

Para exercitar **WebRTC real**, sirva a raiz e abra `tests/lan-browser.html` em um
navegador com WebRTC. O botão executa o pareamento e uma sequência de jogo entre
duas instâncias em iframes, verifica sincronização e tamanhos de tela e encerra as
salas descartáveis. Esse teste não substitui testar dois aparelhos físicos no
roteador de destino (mDNS, isolamento de Wi-Fi e permissões variam).

Para verificar no roteador real: computador + celular e, se disponível, Android +
iOS; fazer saída, falta/bola na mão, tacada do convidado, pausa ao trocar de app,
retomada confirmada, bola 8, revanche e saída. Repetir após carregar o PWA e remover
o acesso à internet, mantendo o Wi-Fi local ativo.
