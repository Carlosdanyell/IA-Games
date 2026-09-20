# Neon Chess: multiplayer na mesma rede

## Jogar

1. Abra `play.html?game=neon-chess` nos dois aparelhos, conectados ao mesmo Wi-Fi.
2. Em **Ajustes & regras**, escolha o modo **Na mesma rede**. O tabuleiro dá lugar à sala.
3. Informe seu nome. Um jogador toca em **Criar sala** e envia o convite ao amigo
   (Copiar ou Compartilhar).
4. O amigo abre o link ou usa **Entrar na sala**, cola o convite e toca em **Gerar resposta**.
5. O amigo devolve o código de resposta. Quem criou cola a resposta e toca em **Conectar**.
6. O tabuleiro abre automaticamente nos dois aparelhos.

Quem cria a sala joga de brancas na primeira partida; cada revanche troca as cores.
Só quem está com a vez consegue mover. As regras são as mesmas dos modos contra a
máquina e no mesmo aparelho: roque, en passant, promoção, xeque-mate, afogamento,
tripla repetição, regra dos 50 lances e material insuficiente.

O botão **Entregar** pede confirmação antes de dar a partida ao adversário. Voltar
lance não existe na sala — desfazer lance só vale nos modos locais.

O placar da sala dura enquanto a conexão existir e não altera os retrospectos por
nível dos modos locais.

Pausa vale para os dois. Para retomar, os dois confirmam; o mesmo para a revanche.
Ao trocar de aplicativo a partida pausa. Mantenha a página aberta: recarregar,
fechar ou sair encerra a sala, e não há recuperação depois do reload. Interrupções
breves que o WebRTC consegue recuperar mantêm o tabuleiro pausado.

## Rede e hospedagem

O GitHub Pages serve os arquivos estáticos. Não executa WebSocket, Node ou servidor
de jogo. Esta implementação usa `RTCPeerConnection` / `RTCDataChannel` nativos, com
`iceServers: []`: a troca manual de convite/resposta substitui a sinalização.
Não usa PeerJS Cloud, CDN, STUN ou TURN; não pede microfone/câmera; não varre IPs.

Os candidatos ICE locais vão dentro dos próprios códigos. A coleta não espera o
estado `complete` do navegador — que em muitas máquinas nunca chega, com VPN,
mDNS lento ou interfaces virtuais: segue 1,2s após o último candidato, ou no
limite de 10s, e só falha se nenhum candidato aparecer. O link usa `#chess=...`, que
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

## Por que este protocolo é mais simples que o do Neon Pool

Na sinuca o anfitrião precisa transmitir a mesa inteira a até 30 Hz, porque a
física é contínua e duas simulações divergem sozinhas. No xadrez um lance é
discreto e determinístico: o anfitrião transmite a **lista de lances** e o
convidado reconstrói o tabuleiro aplicando-a com as mesmas regras.

A consequência prática é que divergência de estado deixa de ser possível. Ou a
lista inteira passa pelas regras locais do convidado, ou o pacote é recusado — e
um pacote recusado por ilegalidade fecha a sala com mensagem explícita, em vez de
deixar os dois aparelhos jogando partidas diferentes. Uma lista de 600 lances
ocupa poucos kilobytes, bem abaixo do limite de pacote.

## Integração para Claude Code e próximos desenvolvedores

- `lan-match.js`: o estado autoritativo da sala, **sem DOM e sem rede**. Quem decide
  lance, pausa, revanche e desistência é este módulo, e é ele que os testes
  exercitam com as regras de verdade dos dois lados.
- `lan-protocol.js`: versão do protocolo, validação de convites, comandos e pacotes.
- `lan-transport.js`: uma conexão por sala, SDP completo, transporte ordenado,
  heartbeat, expiração, limites de pacote, backpressure e fechamento dos recursos.
  É uma cópia adaptada do transporte do Neon Pool, de propósito: o Pool é a
  funcionalidade mais delicada do repositório e um jogo novo não deve exigir mexer
  nele. Se um terceiro jogo precisar do mesmo transporte, aí vale promovê-lo a
  `core/`, com os testes do Pool como rede de segurança.
- `lan-ui.js`: criar/entrar, copiar/compartilhar, instruções e mensagens de erro.
- `index.js`: mantém o motor e a interface existentes. O anfitrião aplica os lances
  (os dele e os pedidos do convidado) e transmite; o convidado envia apenas
  intenções e adota o que recebe.
- `sw.js`: módulos novos no precache e versão incrementada. Não é necessário build.

Comandos levam `match`, `revision` e `seq`. Um lance exige a revisão e a vez
corretas; comandos repetidos, antigos, de outra partida e lances ilegais são
recusados. Somente o anfitrião transmite estado. Pausa e revanche exigem confirmação
dos dois e não permitem reiniciar a partida unilateralmente. Nomes são limpos
(`cleanName`) antes de chegar à tela.

Ao alterar regras ou o formato do pacote, atualize o protocolo nos dois lados, seus
validadores e os testes. Atualize também o cache PWA. Antes de continuar o
desenvolvimento em uma branch anterior, incorpore a `main`.

## Verificação

Sem instalar dependências, com Node 22+:

```bash
node --experimental-vm-modules --test tests/neon-chess.test.mjs tests/neon-chess-lan.test.mjs
```

`neon-chess.test.mjs` cobre as regras (perft nas seis posições padrão, incluindo
kiwipete), e `neon-chess-lan.test.mjs` cobre a sala: sincronização, lance fora da
vez, comando repetido, lance ilegal, pacote adulterado, pausa com dupla
confirmação, revanche com troca de cores, desistência, fim por mate e por
afogamento, além dos validadores e do convite.

Para exercitar **WebRTC real**, sirva a raiz e abra `tests/chess-lan-browser.html`
em um navegador com WebRTC. O botão pareia duas instâncias em iframes, joga alguns
lances, tenta um lance fora da vez, pausa, retoma e entrega a partida, verificando
que os dois tabuleiros batem. Esse teste não substitui testar dois aparelhos
físicos no roteador de destino (mDNS, isolamento de Wi-Fi e permissões variam).

Para verificar no roteador real: computador + celular e, se disponível, Android +
iOS; abrir a sala, jogar lances dos dois lados, promover um peão, pausar ao trocar
de app, retomar com as duas confirmações, dar mate, pedir revanche e conferir a
troca de cores. Repetir depois de carregar o PWA e remover o acesso à internet,
mantendo o Wi-Fi local ativo.
