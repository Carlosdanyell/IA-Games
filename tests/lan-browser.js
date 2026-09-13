const results = document.querySelector('#results');
const run = document.querySelector('#run');
const players = document.querySelector('#players');
const log = text => { results.textContent += text + '\n'; };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(condition, label, timeout = 12000) {
  const until = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > until) throw new Error('Tempo esgotado: ' + label);
    await delay(50);
  }
}
function button(win, label) {
  const found = [...win.document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
  assert(found, 'Botão ausente: ' + label); found.click();
}
const shoot = win => win.dispatchEvent(new win.KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
const state = win => win.__iaGame.game.inspect().S;
const stats = win => win.__iaGame.game.getState();
const equalTables = (a, b) => JSON.stringify(state(a)) === JSON.stringify(state(b));
function place(win, x, y) {
  const { viewport, hud } = win.__iaGame;
  const rect = hud.canvas.getBoundingClientRect();
  const v = viewport.view;
  for (const type of ['pointerdown', 'pointerup']) hud.arena.dispatchEvent(new win.PointerEvent(type, {
    bubbles: true, pointerId: 42, pointerType: 'touch', button: 0,
    clientX: rect.left + v.ox + x * v.scale, clientY: rect.top + v.oy + y * v.scale
  }));
}
async function player(name) {
  const frame = document.createElement('iframe');
  frame.src = '../play.html?game=eight-ball';
  frame.title = name;
  players.append(frame);
  await waitFor(() => frame.contentWindow.__iaGame, 'carregar ' + name);
  const win = frame.contentWindow;
  // Somente o harness evita pausa por foco de iframe. Em aparelhos separados,
  // cada janela mantém seu próprio foco. A pausa explícita continua sob teste.
  win.__iaGame.game.onHidden = () => {};
  win.__iaGame.game.secondaryAction();
  const input = win.document.querySelector('.pool-lan input');
  input.value = name;
  return { win, frame };
}

run.addEventListener('click', async () => {
  run.disabled = true; results.textContent = ''; players.replaceChildren();
  let h, g;
  try {
    h = await player('Ana teste'); g = await player('Bruno teste');
    const host = h.win, guest = g.win;
    button(host, 'Criar sala');
    await waitFor(() => host.document.querySelector('textarea[readonly]'), 'convite com candidatos ICE');
    const offer = host.document.querySelector('textarea[readonly]').value;
    button(guest, 'Entrar na sala');
    guest.document.querySelector('textarea').value = offer;
    button(guest, 'Gerar resposta');
    await waitFor(() => guest.document.querySelector('textarea[readonly]'), 'resposta com candidatos ICE');
    host.document.querySelector('textarea:not([readonly])').value = guest.document.querySelector('textarea[readonly]').value;
    button(host, 'Conectar');
    await waitFor(() => stats(host).network?.started && stats(guest).network?.started, 'conexão WebRTC real', 35000);
    await waitFor(() => equalTables(host, guest), 'mesa inicial sincronizada');
    log('PASS · convite, resposta, WebRTC real e mesa inicial idêntica');
    shoot(guest); await delay(150); assert(state(host).shots === 0, 'Convidado tacou fora da vez');
    const aim = host.__iaGame.game.inspect().aim;
    aim.angle = Math.PI; aim.power = .05; shoot(host);
    await waitFor(() => state(host).flow === 'placing' && equalTables(host, guest), 'falta e bola na mão', 12000);
    assert(state(host).turn === 1, 'Vez não passou ao convidado');
    log('PASS · bloqueio fora da vez, saída fraca, falta e bola na mão sincronizada');
    place(guest, 240, 200);
    await waitFor(() => state(host).flow === 'aiming' && equalTables(host, guest), 'colocação da branca');
    assert(Math.abs(state(host).balls[0].x - 240) < 1, 'Posição da branca incorreta');
    shoot(guest);
    await waitFor(() => state(host).shots === 2, 'tacada do convidado');
    host.__iaGame.game.pause();
    await waitFor(() => state(guest).flow === 'paused', 'pausa compartilhada');
    const frozen = JSON.stringify(state(host));
    await delay(300); assert(JSON.stringify(state(host)) === frozen, 'A física avançou durante pausa');
    guest.__iaGame.game.resume(); await delay(150);
    assert(state(host).flow === 'paused', 'Retomou sem os dois jogadores');
    host.__iaGame.game.resume();
    await waitFor(() => state(host).flow !== 'paused', 'retomada confirmada');
    await waitFor(() => !['rolling', 'paused'].includes(state(host).flow) && equalTables(host, guest), 'fim da tacada', 15000);
    log('PASS · colocação e tacada do convidado; pausa/retomada nos dois aparelhos');
    // Layout do jogo em celular deitado e pareamento em retrato.
    h.frame.style.width = '844px'; h.frame.style.height = '390px';
    await delay(250);
    assert(host.document.documentElement.scrollWidth <= 844, 'Overflow na horizontal');
    host.__iaGame.game.openSettings();
    h.frame.style.width = '390px'; h.frame.style.height = '844px';
    await delay(250);
    const dialog = host.document.querySelector('dialog');
    assert(dialog.open && dialog.getBoundingClientRect().width <= 390, 'Pareamento não cabe no celular');
    log('PASS · mesa em 844×390 e diálogo de conexão em 390×844');
    button(host, 'Sair da sala');
    await waitFor(() => stats(guest).network.connected === false, 'saída sinalizada');
    assert(stats(host).network === null, 'Sala não foi limpa');
    log('PASS · saída encerra a conexão e restaura o modo local');
    log('CONCLUÍDO · todos os testes WebRTC passaram.');
    document.body.dataset.result = 'passed';
  } catch (error) {
    log('FAIL · ' + error.message); console.error(error); document.body.dataset.result = 'failed';
  } finally {
    h?.win.__iaGame?.game.destroy(); g?.win.__iaGame?.game.destroy(); run.disabled = false;
  }
});
