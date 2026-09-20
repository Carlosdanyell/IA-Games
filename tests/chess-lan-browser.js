// Pareamento real entre duas instâncias do Neon Chess, com WebRTC de verdade.
// O que os testes de Node não alcançam: coleta de candidatos, canal de dados e
// a ponte entre a interface e o estado da sala.
const results = document.querySelector('#results');
const run = document.querySelector('#run');
const players = document.querySelector('#players');
const log = text => { results.textContent += text + '\n'; };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(condition, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > until) throw new Error('Tempo esgotado: ' + label);
    await delay(60);
  }
}
function button(win, label) {
  const found = [...win.document.querySelectorAll('.nx-lan button')]
    .find(b => b.textContent.trim() === label);
  assert(found, 'Botão ausente: ' + label);
  found.click();
}
const estado = win => win.__iaGame.game.getState();
const lances = win => [...win.document.querySelectorAll('.nx-move-pair')].map(n => n.textContent.trim()).join(' ');
const casa = (win, algebrica) => {
  const arquivo = 'abcdefgh'.indexOf(algebrica[0]), linha = Number(algebrica[1]) - 1;
  const alvo = win.document.querySelector(`.nx-square[data-square="${linha * 16 + arquivo}"]`);
  assert(alvo, 'Casa ausente: ' + algebrica);
  return alvo;
};
const jogar = async (win, de, para) => {
  casa(win, de).click();
  await delay(80);
  casa(win, para).click();
  await delay(320);
};

async function instancia(nome) {
  const frame = document.createElement('iframe');
  frame.src = '../play.html?game=neon-chess';
  frame.title = nome;
  players.append(frame);
  await waitFor(() => frame.contentWindow.__iaGame, 'carregar ' + nome);
  const win = frame.contentWindow;
  // Só no harness: iframe sem foco pausaria a partida. Em aparelhos separados
  // cada janela tem o próprio foco, e a pausa explícita segue sob teste.
  win.__iaGame.game.onHidden = () => {};
  win.__iaGame.game.openSettings();
  await delay(200);
  const modo = win.document.querySelector('input[name="nx-mode"][value="rede"]');
  assert(modo, 'Modo de rede ausente nos ajustes');
  modo.click();
  win.__iaGame.hud.closeDialog?.();
  win.document.querySelector('dialog[open]')?.close();
  await waitFor(() => win.document.querySelector('.nx-lan input'), 'lobby de ' + nome);
  win.document.querySelector('.nx-lan input').value = nome;
  return win;
}

async function testar() {
  results.textContent = '';
  players.replaceChildren();
  const ana = await instancia('Ana');
  const beto = await instancia('Beto');
  log('Duas instâncias abertas no modo de rede.');

  button(ana, 'Criar sala');
  await waitFor(() => ana.document.querySelector('.nx-lan textarea')?.value.includes('NCHESS1.'), 'convite');
  const convite = ana.document.querySelector('.nx-lan textarea').value;
  log('Convite gerado (' + convite.length + ' caracteres).');

  button(beto, 'Entrar na sala');
  beto.document.querySelector('.nx-lan textarea').value = convite;
  button(beto, 'Gerar resposta');
  await waitFor(() => beto.document.querySelector('.nx-lan textarea')?.value.startsWith('NCHESS1.'), 'resposta');
  const resposta = beto.document.querySelector('.nx-lan textarea').value;
  log('Resposta gerada.');

  ana.document.querySelectorAll('.nx-lan textarea')[1].value = resposta;
  button(ana, 'Conectar');
  await waitFor(() => ana.document.querySelector('.nx-lan-panel').hidden &&
                      beto.document.querySelector('.nx-lan-panel').hidden, 'conexão', 30000);
  log('Conectados: o tabuleiro abriu nos dois.');

  assert(estado(ana).human === 'brancas', 'quem cria a sala joga de brancas');
  assert(estado(beto).human === 'pretas', 'quem entra joga de pretas');

  await jogar(ana, 'e2', 'e4');
  await waitFor(() => lances(beto).includes('e4'), 'lance do anfitrião chegar');
  await jogar(beto, 'e7', 'e5');
  await waitFor(() => lances(ana).includes('e5'), 'lance do convidado chegar');
  await jogar(ana, 'g1', 'f3');
  await waitFor(() => lances(beto).includes('Cf3'), 'segundo lance do anfitrião');
  assert(lances(ana) === lances(beto), 'as duas listas de lances precisam bater');
  assert(estado(ana).fen === estado(beto).fen, 'os dois tabuleiros precisam bater');
  log('Três lances sincronizados: ' + lances(ana));

  // Depois de 2.Cf3 é a vez das pretas: o convidado joga e, aí sim, tenta de
  // novo fora da vez. A casa fica desabilitada, mas o clique direto prova que
  // a recusa é da regra, não só da interface.
  await jogar(beto, 'b8', 'c6');
  await waitFor(() => lances(ana).includes('Cc6'), 'lance legal do convidado');
  await jogar(beto, 'a7', 'a6');
  await delay(400);
  assert(!lances(ana).includes('a6'), 'lance fora da vez não pode entrar na partida');
  assert(lances(ana) === lances(beto), 'as listas continuam iguais depois da tentativa recusada');
  log('Lance legal aceito e lance fora da vez recusado: ' + lances(ana));

  // Pausa: vale para os dois e exige as duas confirmações.
  beto.__iaGame.game.pause();
  await waitFor(() => estado(ana).state === 'paused', 'pausa chegar no anfitrião');
  beto.__iaGame.game.primaryAction();
  await delay(300);
  assert(estado(ana).state === 'paused', 'uma confirmação só não retoma');
  ana.__iaGame.game.primaryAction();
  await waitFor(() => estado(beto).state !== 'paused', 'retomada nos dois');
  log('Pausa e retomada confirmadas pelos dois lados.');

  // Entregar a partida encerra nos dois e conta para o adversário.
  beto.document.querySelector('.nx-resign').click();
  await delay(250);
  beto.__iaGame.game.secondaryAction();
  await waitFor(() => estado(ana).state === 'over', 'desistência chegar no anfitrião');
  assert(estado(ana).reason === 'resign', 'o motivo precisa ser a desistência');
  assert(estado(ana).room.wins[0] === 1, 'o ponto vai para quem não entregou');
  assert(estado(beto).room.wins[0] === 1, 'o placar da sala bate nos dois');
  log('Desistência encerrou a partida nos dois aparelhos.');

  ana.__iaGame.game.destroy();
  beto.__iaGame.game.destroy();
  log('Salas encerradas.');
  log('\nTUDO CERTO.');
}

run.addEventListener('click', async () => {
  run.disabled = true;
  try { await testar(); }
  catch (error) { log('\nFALHOU: ' + error.message); }
  finally { run.disabled = false; }
});
